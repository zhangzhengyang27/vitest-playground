# 运行器容器化隔离（Docker）实施方案

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `/api/run-vitest` 的测试执行从「宿主受限执行」升级为「一次性容器执行」——用户代码只接触无网络、只读根文件系统、限 CPU/内存、非 root 的临时容器，宿主不再直接运行用户代码。

**Architecture:** 运行器引入可切换后端：`VITEST_RUNNER_BACKEND=local`（现状，默认，本地开发零依赖）或 `docker`。docker 后端下，`runInSandbox` 仍在宿主生成 run 目录与配置（宿主侧校验、并发信号量、400/429 全部不变），随后 `docker run` 一次性容器挂载 run 目录执行 vitest，超时用 `docker kill` 兜底。镜像内**烘焙**项目依赖（不能用宿主 node_modules 挂载——宿主是 macOS，esbuild/rollup 的原生二进制与 Linux 不兼容），并通过镜像内预置的 `node_modules` 符号链接满足 vitest 的向上解析。

**Tech Stack:** Docker（node:22-slim 基镜像）、pnpm 10（镜像内）、现有 Node 22 中间件不变。

**Spec:** 用户 2026-09-28 决策「容器化：先出实施方案」。安全目标（对应 AGENTS.md 铁律 2 的「如需更强隔离应迁移到一次性容器」）：
1. 用户代码不可访问宿主文件系统（除 run 目录）；
2. 无出网能力（`--network none`）；
3. 资源受限（CPU 1 核 / 内存 512M / pids 128）；
4. 非 root + 只读根文件系统 + `no-new-privileges` + drop 全部 capabilities；
5. 本地开发体验不变（默认 local 后端）。

**Spec 之外不做:** Firecracker/gVisor（微 VM 级隔离）、Windows 容器、镜像自动构建流水线（列为后续项）。

## Global Constraints

- API 契约零变化：`{ chapterKey, lessonKey, code }` → `RunResult`；前端零改动。
- 铁律不削弱：60s 超时保留；400/429/信号量语义不变；COEP/COOP 不动。
- 默认后端 local：不装 Docker 的环境（开发者本机）行为与今天完全一致。
- pnpm-only；Node ≥ 22；每任务完成条件 `pnpm tsc` + `pnpm test` 全绿。
- 所有新增环境变量必须有默认值，`vite.config.ts` 不读取秘密。

## Review Focus

1. **后端切换不可破坏现有契约**：local 后端下全部既有集成测试必须原样通过（不 mock，真跑）。钉在 Task 2。
2. **容器内路径解析**：`--root /work/run` 向上解析必须命中镜像内 `/work/node_modules -> /app/node_modules`（baked symlink），否则 vitest 报 Cannot find module。钉在 Task 3（真实 docker 集成测试）。
3. **超时必须真正终止容器**：`docker run` 客户端进程被 SIGKILL 不保证容器终止——必须按 `--name` `docker kill`。钉在 Task 3（死循环 spec + docker 后端 + 2s 超时 → 容器在超时后 5s 内不存在）。
4. **宿主侧校验先于容器创建**：非法课时/文件数超限仍 400，且不产生 docker 容器（`docker ps -a` 无残留）。钉在 Task 2/3。
5. **镜像依赖与 lockfile 漂移**：镜像内依赖来自 `pnpm-lock.yaml`；runbook 必须写明「lockfile 变更后需重建镜像」，并提供一键重建脚本。钉在 Task 1/4。

---

### Task 1: 运行器镜像与构建脚本

**Files:**
- Create: `docker/runner/Dockerfile`
- Create: `docker/runner/build-image.sh`
- Modify: `docs/deploy/runbook.md`（镜像重建与升级小节）

**Interfaces:**
- Produces: 本地镜像 `vitest-runner:latest`；镜像内布局 `/app`（仓库代码 + node_modules）与 `/work/node_modules -> /app/node_modules`；`/work/run` 为运行时挂载点（镜像内仅占位目录）。

- [ ] **Step 1: 写 Dockerfile**

```dockerfile
# 运行器一次性容器镜像：依赖烘焙进镜像，宿主只挂载 run 目录
# 重建：bash docker/runner/build-image.sh（pnpm-lock.yaml 变更后必须重建）
FROM node:22-slim

RUN corepack enable && corepack prepare pnpm@10.34.5 --activate

# 非 root 运行用户
RUN useradd -m -u 1000 vitest-runner

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
# 先装依赖（利用层缓存：lockfile 不变时此层命中）
RUN pnpm install --frozen-lockfile

COPY vitestServerRunner.ts ./          # 仅占位说明用途；镜像内不执行宿主代码
COPY src/pages/vitest-learn/types.ts ./src/pages/vitest-learn/types.ts

# 预置运行目录与 node_modules 解析链：--root /work/run 向上走到 /work/node_modules
RUN mkdir -p /work/run && ln -s /app/node_modules /work/node_modules \
    && chown -R vitest-runner:vitest-runner /work

USER vitest-runner
WORKDIR /work/run
```

说明：镜像内只放依赖与类型存根，**不放课程数据与课时文件**——它们每次由宿主写入 run 目录后挂载；`vitestServerRunner.ts`/`types.ts` 的 COPY 仅满足依赖安装期类型完整性，可按实际安装输出裁剪（实现者验证 `pnpm install` 所需最小文件集并如实调整，禁止放入 `data.ts` 全量课程数据）。

- [ ] **Step 2: 构建脚本（校验 lockfile 与镜像一致性）**

```bash
#!/usr/bin/env bash
# 构建/重建运行器镜像。pnpm-lock.yaml 变更后必须重跑。
set -euo pipefail
cd "$(dirname "$0")/../.."
docker build -f docker/runner/Dockerfile -t vitest-runner:latest .
docker images vitest-runner:latest --format 'built: {{.ID}} {{.Size}}'
```

- [ ] **Step 3: 本机验证**

Run: `bash docker/runner/build-image.sh && docker run --rm vitest-runner:latest node -e "console.log(require('/app/node_modules/vitest/package.json').version)"`
Expected: 输出 `4.1.8`（或 lockfile 对应版本），exit 0

- [ ] **Step 4: runbook 增补「镜像管理」小节**（重建时机：lockfile 变更 / 基镜像安全更新；验证命令；磁盘清理 `docker image prune`）

- [ ] **Step 5: Commit** `feat(docker): 运行器镜像与构建脚本（依赖烘焙 + node_modules 解析链）`

---

### Task 2: 运行器后端抽象（local / docker）

**Files:**
- Modify: `vitestServerRunner.ts`（新增 `spawnVitestDocker`；`runInSandbox` 按 env 选择后端）
- Modify: `tests/runner-security.test.ts`（后端选择纯函数单测）
- Modify: `AGENTS.md`（铁律 2 与运行契约补后端说明）

**Interfaces:**
- Consumes: 现有 `runInSandbox` 内部流程（校验 → mkdtemp → 写配置/文件 → spawn → finishRun → finally rm）。
- Produces:
  - `export function resolveBackend(env = process.env): 'local' | 'docker'` —— `VITEST_RUNNER_BACKEND=docker` 时返回 docker，其余一律 local。
  - docker 后端 spawn 参数（`spawnVitestDocker`）：`docker run --rm --name vitest-run-<rand> --network none --memory 512m --cpus 1 --pids-limit 128 --read-only --security-opt no-new-privileges --cap-drop ALL --tmpfs /tmp:rw,size=64m -v <runDir>:/work/run:rw vitest-runner:latest node /app/node_modules/vitest/vitest.mjs <args 同 local>`。
  - 容器名由 `makeRunDir` 的随机后缀派生，超时与完成后都执行 `docker kill <name>` + `docker rm -f <name>` 兜底。

- [ ] **Step 1: RED——后端选择单测**

```ts
import { resolveBackend } from '../vitestServerRunner';

describe('resolveBackend（后端选择）', () => {
  it('默认 local；显式 docker 才用 docker', () => {
    expect(resolveBackend({})).toBe('local');
    expect(resolveBackend({ VITEST_RUNNER_BACKEND: 'local' })).toBe('local');
    expect(resolveBackend({ VITEST_RUNNER_BACKEND: 'docker' })).toBe('docker');
    expect(resolveBackend({ VITEST_RUNNER_BACKEND: 'DOCKER ' })).toBe('local'); // 严格匹配，防误开
  });
});
```

- [ ] **Step 2: 确认 RED → 实现 `resolveBackend`（仅接受字面量 `'docker'`，其余 local）→ GREEN**

- [ ] **Step 3: 实现 `spawnVitestDocker`**：与 `spawnVitest` 共享解析逻辑（`finishRun`），仅替换子进程命令与 kill 语义：
  - spawn：`spawn('docker', [ ...run 参数, 'node', '/app/node_modules/vitest/vitest.mjs', ...args ])`，env 仍用 `buildChildEnv`（docker CLI 只需 PATH）。
  - `killGroup` 改为：`spawnSync('docker', ['kill', name])` + `docker rm -f name`（超时分支与 finally 均调用，幂等）。
  - run 目录仍由宿主创建与删除（finally rm 不变）。
- [ ] **Step 4: `runInSandbox` 接线**：`const backend = resolveBackend();` → `backend === 'docker' ? spawnVitestDocker(...) : spawnVitest(...)`。
- [ ] **Step 5: GREEN 验证**：`pnpm test -- --no-file-parallelism`（local 后端全绿，证明切换不破坏现状）+ `pnpm tsc`
- [ ] **Step 6: Commit** `feat(runner): 运行器后端抽象，支持 docker 一次性容器执行`

---

### Task 3: docker 后端集成测试（CI 可跑）

**Files:**
- Modify: `tests/runner-security.test.ts`（env 门控的 docker 集成组）
- Modify: `.github/workflows/ci.yml`（quality job 增加docker 集成步骤）

**Interfaces:**
- Consumes: Task 2 的 docker 后端；GitHub ubuntu runner 自带 Docker。
- Produces: 真容器执行的回归证据（Review Focus 2/3）。

- [ ] **Step 1: env 门控测试组**（本机未装/未构建镜像时自动跳过，不假绿）：

```ts
describe.skipIf(!hasDockerImage())('docker 后端（真实容器）', () => {
  it('合法用例经容器执行成功', { timeout: 90_000 }, async () => {
    // 强制后端：resolveBackend 只认 env —— 通过 vi.stubEnv 或注入参数实现（以 Task 2 实际接口为准）
    const result = await runInSandbox({ 'lesson.spec.ts': PASSING_SPEC }, { backend: 'docker' });
    expect(result.success).toBe(true);
    expect(result.passed).toBe(1);
  });

  it('死循环 spec：超时后容器被 kill 且无残留', { timeout: 90_000 }, async () => {
    const result = await runInSandbox(
      { 'lesson.spec.ts': `import { it } from 'vitest';\nit('loop', () => { for (;;) {} });\n` },
      { backend: 'docker', timeoutMs: 5000 },
    );
    expect(result.success).toBe(false);
    expect(result.output).toContain('超时');
    // 宿主侧 docker ps -a 不应有 vitest-run-* 残留（spawnSync 检查）
  });
});
```

说明：`RunInSandboxOptions` 增加 `backend?: 'local' | 'docker'`（测试注入，生产仍走 env）；`hasDockerImage()` 用 `docker images -q vitest-runner:latest` 非空判定，实现于测试文件内。**每个测试先确认 RED（docker 后端未实现注入前跳过不算绿）**。

- [ ] **Step 2: 实现 options.backend 注入 → GREEN（本机需先跑 build-image.sh）**
- [ ] **Step 3: CI 接线**：quality job 中 docker 组前加 `bash docker/runner/build-image.sh`；lockfile 未变时层缓存使命中构建 < 1min
- [ ] **Step 4: 全量验证**：`pnpm test -- --no-file-parallelism`（含 docker 组）+ `pnpm tsc`
- [ ] **Step 5: Commit** `test(runner): docker 后端真实容器集成测试（含超时 kill 断言）`

---

### Task 4: 部署切换与 runbook

**Files:**
- Modify: `docs/deploy/runbook.md`（后端切换、镜像重建、故障处理三条新增）
- Modify: `AGENTS.md`（发布清单加「生产 VITEST_RUNNER_BACKEND=docker 且镜像已构建」）

**Interfaces:**
- Produces: 服务器操作者可按文档完成切换与回滚（回滚 = 删 env 改回 local 并重启 preview）。

- [ ] **Step 1: runbook 增补**：服务器安装 docker → 构建/拉取镜像 → systemd unit 环境注入 `Environment=VITEST_RUNNER_BACKEND=docker` → 重启 preview → 验证（curl 一次合法运行 + `docker ps` 观察一次性容器出现与消失）→ 回滚步骤
- [ ] **Step 2: AGENTS.md 发布清单追加一项** `- [ ] 生产运行器后端为 docker 且镜像构建自当前 pnpm-lock.yaml`
- [ ] **Step 3: Commit** `docs: 容器化部署切换与回滚 runbook`

---

## 完成定义（全部任务结束后）

- [ ] local 后端：`pnpm tsc`、`pnpm test`（44+ 用例）、`pnpm check:lessons` 全绿，行为与切换前一致
- [ ] docker 后端：合法运行 / 死循环超时 kill / 无容器残留 三条真实容器集成测试绿
- [ ] runbook 与 AGENTS.md 同步；服务器切换属人工操作（发布窗口执行，回滚路径已文档化）

## 风险与代价（供审批参考）

- 每次运行增加 ~1-2s 容器冷启动（可接受：测试运行本身 2-6s）。
- pnpm-lock 变更需要重建镜像（runbook 一键脚本 + CI 层缓存缓解）。
- 服务器需安装 Docker（一次性运维成本）；不装则回退 local 后端，安全水位与今天相同。
