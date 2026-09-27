# 运行器止血加固 + tsc 回绿 + CI 落地 实施方案

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将公网暴露的 `/api/run-vitest` 从「无鉴权任意代码执行」降级为「受限的受控执行」（文件名白名单、最小 env、每请求独立临时目录、并发上限、反代限流），同时修复 `pnpm tsc` 回归并接入 CI 门禁。

**Architecture:** 不改变现有架构（浏览器 → Vite 中间件 → 服务端真实 Vitest），只对 `vitestServerRunner.ts` 做纵深加固：请求进入时快速失败校验 → 每次运行分配项目根下 `.vitest-runs/run-<rand>/` 独立目录（保证 node_modules 可解析）→ 以最小环境变量 + 独立进程组 spawn → 结果优先从 `--outputFile.json` 文件读取（免疫用户 stdout 输出污染）→ finally 整目录删除。并发由模块级信号量控制（2 并发 / 8 排队，满则 429）。前端 API 契约完全不变。

**Tech Stack:** Node 22 + TypeScript（strict）、Vite 6 中间件、Vitest 4（自测）、GitHub Actions、nginx（限流，服务器侧手动）。

**Spec:** 本方案实现 2026-09-27 项目评审的 P0 结论与用户决策「止血并保持公网」：
1. 文件名白名单校验，禁止路径穿越与覆盖运行器自身配置；
2. spawn 使用最小环境变量（不继承 `process.env`）；
3. 每请求独立临时目录 + 跑完删除（消除并发竞态与残留）；
4. 全局并发上限 + 排队上限，超出返回 429；
5. 反向代理层按 IP 限流（nginx，服务器手动配置，方案内交付配置片段）；
6. 修复 `src/App.tsx` 大小写使 `pnpm tsc` 通过；
7. GitHub Actions CI：tsc + test + build + 课程内容校验。

**Spec 之外明确不做（后续 backlog）:** 容器化隔离（gVisor/Docker）、WebContainer 双引擎、Umami 事件埋点、防刷通关（参考答案运行不标记 passed）、进度导出、i18n。

## Global Constraints

- 包管理器只用 pnpm（10.34.5），禁止生成 `package-lock.json`。
- Node ≥ 22（本机 22.15.0，CI 钉 22）。
- **铁律 1：不得删除或绕过 `vitestRunnerMiddleware`（`vite.config.ts`）与 `vitestServerRunner.ts`**——本方案只加固，不动挂载点。
- **铁律 2：不得削弱超时与 kill 兜底**——默认 60s 超时保留，仅允许测试通过 `timeoutMs` 参数缩短。
- **API 契约不变**：`POST /api/run-vitest` 请求体 `{ files, jsdom, coverage, benchmark }` 与返回 `RunResult` 结构不变（`src/pages/vitest-learn/runner.ts`、`tests/lessons.test.ts`、`scripts/check-lessons.ts` 均依赖）。
- **前端零改动**：`src/` 下除 `src/main.tsx` 大小写一行外不动。
- Monaco manualChunks、COEP/COOP 响应头一律不动。
- 每个任务完成条件：`pnpm tsc` 与 `pnpm test` 全绿，然后独立 commit（中文 conventional commits，匹配仓库历史风格）。
- 新增目录 `.vitest-runs/` 必须加入 `.gitignore`。

## Review Focus

方案隐含但任务测试未自然覆盖的失败模式（每条已钉到对应任务的测试步骤）：

1. **反斜杠/绝对路径文件名**（`C:\evil.ts`、`/etc/cron.d/x`、`..\..\x`）→ 必须在 400 拒绝，且不产生任何写盘。钉在 Task 2。
2. **覆盖运行器自身配置**（`vitest.config.js`、`setup.ts`、`package.json`、`result.json`）→ 必须拒绝，否则最小 env/白名单形同虚设。钉在 Task 2。
3. **用户测试代码向 stdout 打印 JSON**（如 `console.log('{"a":1}')`）→ 结果解析不受污染（现状 `extractJson` 首尾大括号截取会被污染）。钉在 Task 3。
4. **死循环用例** → 进程组被整体 kill（无 vitest worker 孤儿）、返回超时结果、运行目录被清理。钉在 Task 3。
5. **并发双击「运行测试」** → 两个请求排队串行执行而不是互相覆盖文件；队列满返回 429 与可读文案。钉在 Task 4。

---

### Task 1: 修复 App.tsx 大小写，让 `pnpm tsc` 回绿

**Files:**
- Modify: `src/main.tsx:5`
- Modify: `tsconfig.json:23`（include 数组内 `src/App.tsx`）

**Interfaces:**
- Consumes: 无
- Produces: `pnpm tsc` 全绿（后续所有任务用它做门禁）。`src/app.tsx` 文件名保持不变（唯一入口组件，默认导出）。

- [ ] **Step 1: 确认现状（失败基线）**

Run: `pnpm tsc`
Expected: FAIL，报 `TS1261: Already included file name ... 'src/App.tsx' differs from ... 'src/app.tsx' only in casing`

- [ ] **Step 2: 修改导入**

`src/main.tsx` 第 5 行：

```tsx
import App from './app';
```

- [ ] **Step 3: 修改 tsconfig include**

`tsconfig.json` include 数组中，把 `"src/App.tsx"` 改为：

```json
"src/app.tsx",
```

- [ ] **Step 4: 验证通过**

Run: `pnpm tsc`
Expected: 退出码 0，无任何输出（无 emit）

- [ ] **Step 5: Commit**

```bash
git add src/main.tsx tsconfig.json
git commit -m "fix: 修正 App 导入与 tsconfig 的大小写，修复 pnpm tsc"
```

---

### Task 2: 文件名白名单（防路径穿越与配置覆盖）

**Files:**
- Modify: `vitestServerRunner.ts`（文件顶部常量区 + 新增导出函数；暂不动 `runInSandbox` 内部，Task 3 才接入写入逻辑）
- Test: `tests/runner-security.test.ts`（新建）

**Interfaces:**
- Consumes: 无
- Produces:
  - `export function sanitizeEntryName(name: unknown): string` — 合法时原样返回 name（便于后续 `path.join`），非法时 `throw new Error('非法文件名: ...')`。合法规则：`/^[A-Za-z0-9][A-Za-z0-9._-]*$/` 且不含 `..` 且不在受保护名单 `{ vitest.config.js, setup.ts, package.json, result.json }`。
  - `tests/runner-security.test.ts` 测试文件（Task 3/4 会继续往里加用例）。

- [ ] **Step 1: 写失败测试**

创建 `tests/runner-security.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { sanitizeEntryName } from '../vitestServerRunner';

describe('sanitizeEntryName（沙箱文件名白名单）', () => {
  it('放行合法课时文件名', () => {
    for (const name of [
      'lesson.ts',
      'lesson.tsx',
      'lesson.spec.ts',
      'lesson.spec.tsx',
      'lesson.hidden.spec.ts',
      'api.ts',
      'database.ts',
      'v1-utils.test.ts',
    ]) {
      expect(sanitizeEntryName(name)).toBe(name);
    }
  });

  it('拒绝路径穿越与路径分隔符', () => {
    for (const name of ['../evil.ts', '..\\evil.ts', 'a/b.ts', 'a\\b.ts', '/etc/cron.d/x', 'C:\\evil.ts', '..', '.', 'foo/../bar.ts']) {
      expect(() => sanitizeEntryName(name)).toThrow('非法文件名');
    }
  });

  it('拒绝覆盖运行器自身配置', () => {
    for (const name of ['vitest.config.js', 'setup.ts', 'package.json', 'result.json']) {
      expect(() => sanitizeEntryName(name)).toThrow('非法文件名');
    }
  });

  it('拒绝非字符串与空名', () => {
    for (const name of [undefined, null, 42, '', {}]) {
      expect(() => sanitizeEntryName(name as unknown as string)).toThrow();
    }
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm test -- tests/runner-security.test.ts`
Expected: FAIL — `sanitizeEntryName` 未导出（TS/运行时报错）

- [ ] **Step 3: 实现**

在 `vitestServerRunner.ts` 常量区（`RUN_TIMEOUT` 附近）加入：

```ts
/** 受保护文件：运行器自身写入沙箱的配置，禁止被请求覆盖 */
const PROTECTED_NAMES = new Set(['vitest.config.js', 'setup.ts', 'package.json', 'result.json']);
/** 沙箱文件名白名单：扁平名、无路径分隔符、无 `..`（data.ts 的 extraFiles 均为扁平名，已确认兼容） */
const SAFE_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** 校验请求要写入沙箱的文件名；非法直接抛错（由 handleRunVitest 转 400） */
export function sanitizeEntryName(name: unknown): string {
  const valid =
    typeof name === 'string' &&
    SAFE_NAME_RE.test(name) &&
    !name.includes('..') &&
    !PROTECTED_NAMES.has(name);
  if (!valid) {
    throw new Error(`非法文件名: ${typeof name === 'string' ? name.slice(0, 50) : String(name)}`);
  }
  return name;
}
```

注意：`C:\evil.ts` 含反斜杠、`a/b.ts` 含 `/`，均不匹配 `SAFE_NAME_RE`；`..`、`foo/../bar.ts` 被 `includes('..')` 拦截。

- [ ] **Step 4: 运行确认通过**

Run: `pnpm test -- tests/runner-security.test.ts && pnpm tsc`
Expected: 全部 PASS，tsc 无错误

- [ ] **Step 5: Commit**

```bash
git add vitestServerRunner.ts tests/runner-security.test.ts
git commit -m "feat(runner): 沙箱文件名白名单，拒绝路径穿越与配置覆盖"
```

---

### Task 3: 独立临时目录 + 最小 env + 进程组 kill + 结果文件解析

**Files:**
- Modify: `vitestServerRunner.ts`（重写 `ensureSandbox`/`runInSandbox`/`readCoverage` 调用方式；删除共享沙箱模式）
- Modify: `.gitignore`（追加 `.vitest-runs`）
- Test: `tests/runner-security.test.ts`（追加集成用例）

**Interfaces:**
- Consumes: `sanitizeEntryName`（Task 2）
- Produces:
  - `export interface RunInSandboxOptions { coverage?: boolean; benchmark?: boolean; timeoutMs?: number }`
  - `export async function runInSandbox(files: Record<string, string>, options?: RunInSandboxOptions): Promise<RunResult>` — Task 4 的 `handleRunVitest` 与现有中间件语义依赖此签名；`timeoutMs` 仅测试注入，生产默认 `RUN_TIMEOUT`（60_000）。
  - `export function buildChildEnv(homeDir: string): NodeJS.ProcessEnv`（白名单 env 构造，供测试断言）
  - `export const RUNS_ROOT: string`（`.vitest-runs` 绝对路径，供清理断言）
  - 模块级常量 `MAX_FILES = 20`（单次请求文件数上限）

- [ ] **Step 1: 写失败测试（追加到 `tests/runner-security.test.ts`）**

```ts
import fs from 'node:fs';
import path from 'node:path';
import { RUNS_ROOT, buildChildEnv, runInSandbox } from '../vitestServerRunner';

const PASSING_SPEC = `import { it, expect } from 'vitest';\nit('ok', () => expect(1 + 1).toBe(2));\n`;

describe('runInSandbox（真实运行，集成）', () => {
  it('合法用例通过并返回结构化结果', { timeout: 30_000 }, async () => {
    const result = await runInSandbox({ 'lesson.spec.ts': PASSING_SPEC });
    expect(result.success).toBe(true);
    expect(result.passed).toBe(1);
    expect(result.tests?.[0]?.status).toBe('passed');
  });

  it('父进程环境变量不泄漏进沙箱', { timeout: 30_000 }, async () => {
    process.env.RUNNER_SENTINEL = 'leak-me-if-you-can';
    try {
      const result = await runInSandbox({
        'lesson.spec.ts': `import { it, expect } from 'vitest';\nit('no leak', () => expect(process.env.RUNNER_SENTINEL).toBeUndefined());\n`,
      });
      expect(result.success).toBe(true);
    } finally {
      delete process.env.RUNNER_SENTINEL;
    }
  });

  it('用户 stdout 打印 JSON 不污染结果解析', { timeout: 30_000 }, async () => {
    const result = await runInSandbox({
      'lesson.spec.ts': `import { it, expect } from 'vitest';\nit('noisy', () => { console.log('{"fake": "json"}'); expect(1).toBe(1); });\n`,
    });
    expect(result.success).toBe(true);
    expect(result.passed).toBe(1);
    expect(result.tests?.[0]?.name).toBe('noisy');
  });

  it('死循环用例：超时 kill、目录清理', { timeout: 30_000 }, async () => {
    const result = await runInSandbox(
      { 'lesson.spec.ts': `import { it } from 'vitest';\nit('loop', () => { for (;;) {} });\n` },
      { timeoutMs: 2000 },
    );
    expect(result.success).toBe(false);
    expect(result.output).toContain('超时');
    // 全部运行结束后不应残留任何运行目录
    expect(fs.readdirSync(RUNS_ROOT)).toEqual([]);
  });

  it('文件数超上限直接失败', async () => {
    const files: Record<string, string> = {};
    for (let i = 0; i < 21; i++) files[`f${i}.spec.ts`] = PASSING_SPEC;
    const result = await runInSandbox(files);
    expect(result.success).toBe(false);
    expect(result.output).toContain('文件数量超过上限');
  });
});

describe('buildChildEnv（最小环境变量白名单）', () => {
  it('只包含 PATH/HOME/NODE_ENV/LANG，不含父进程其它变量', () => {
    process.env.RUNNER_SENTINEL = 'leak-me-if-you-can';
    try {
      const env = buildChildEnv('/tmp/run-x');
      expect(Object.keys(env).sort()).toEqual(['HOME', 'LANG', 'NODE_ENV', 'PATH'].sort());
      expect(env.HOME).toBe('/tmp/run-x');
      expect(env.NODE_ENV).toBe('test');
      expect(env.RUNNER_SENTINEL).toBeUndefined();
    } finally {
      delete process.env.RUNNER_SENTINEL;
    }
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm test -- tests/runner-security.test.ts`
Expected: FAIL — `RUNS_ROOT`、`buildChildEnv` 未导出；旧 `runInSandbox` 签名不含 options（TS 编译期即报错）

- [ ] **Step 3: 重写运行器核心**

在 `vitestServerRunner.ts` 中做以下修改（保持 `parseVitestJson`/`parseBenchJson` 不动）：

3a. 替换沙箱常量区（删除 `SANDBOX`/`COVERAGE_DIR`/`LESSON_FILE_CANDIDATES`/`ensureSandbox`/`cleanupLessonFiles`）：

```ts
const ROOT = process.cwd();
const VITEST_BIN = path.join(ROOT, 'node_modules', 'vitest', 'vitest.mjs');
/** 每次运行的独立临时目录根（必须在项目根之下，vitest 才能向上解析到 node_modules） */
export const RUNS_ROOT = path.join(ROOT, '.vitest-runs');
/** 单次执行超时（毫秒） */
const RUN_TIMEOUT = 60_000;
/** 单次请求允许写入的文件数上限 */
const MAX_FILES = 20;
```

3b. 新增独立运行目录与最小 env：

```ts
async function makeRunDir(): Promise<string> {
  await fs.promises.mkdir(RUNS_ROOT, { recursive: true });
  return fs.promises.mkdtemp(path.join(RUNS_ROOT, 'run-'));
}

/** 子进程环境变量白名单：绝不继承 process.env（防密钥经测试代码外泄） */
export function buildChildEnv(homeDir: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    NODE_ENV: 'test',
    HOME: homeDir,
    LANG: process.env.LANG ?? 'C.UTF-8',
    PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin',
  };
  if (process.platform === 'win32') {
    if (process.env.SystemRoot) env.SystemRoot = process.env.SystemRoot;
    if (process.env.COMSPEC) env.COMSPEC = process.env.COMSPEC;
  }
  return env;
}
```

3c. 新增每目录配置写入（替代原 `ensureSandbox`，内容与原文件一致，仅目标目录变化）：

```ts
function writeRunConfig(runDir: string, coverage: boolean) {
  fs.writeFileSync(
    path.join(runDir, 'vitest.config.js'),
    `export default {
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./setup.ts'],
    include: ['*.spec.ts', '*.spec.tsx', '*.test.ts', '*.test.tsx'],
  },
  esbuild: { jsx: 'automatic' },
  coverage: { reporter: ['json-summary'], ${coverage ? 'enabled: true' : 'enabled: false'} },
};
`,
  );
  fs.writeFileSync(path.join(runDir, 'setup.ts'), `import '@testing-library/jest-dom/vitest';\n`);
}
```

3d. `readCoverage` 改为接收目录参数：`function readCoverage(runDir: string)`，内部 `summaryPath = path.join(runDir, 'coverage', 'coverage-summary.json')`，其余不变。

3e. 用下面的实现整体替换 `runInSandbox`（原「写入共享 SANDBOX + spawn」逻辑迁入，spawn 加 `detached` 与进程组 kill，结果优先读文件）：

```ts
export interface RunInSandboxOptions {
  coverage?: boolean;
  benchmark?: boolean;
  /** 仅供测试注入；生产默认 RUN_TIMEOUT(60s)，不得调大 */
  timeoutMs?: number;
}

/** 单次失败结果 */
function failResult(output: string): RunResult {
  return { success: false, output, passed: 0, failed: 1 };
}

/**
 * 在独立临时目录里跑一次真实 vitest，返回结构化结果。
 * 目录生命周期完全归属本次调用：进入时创建，finally 删除。
 */
export async function runInSandbox(
  files: Record<string, string>,
  options: RunInSandboxOptions = {},
): Promise<RunResult> {
  const { coverage = false, benchmark = false, timeoutMs = RUN_TIMEOUT } = options;
  const names = Object.keys(files ?? {});
  if (names.length === 0) return failResult('缺少文件');
  if (names.length > MAX_FILES) return failResult(`文件数量超过上限（${MAX_FILES}）`);
  for (const name of names) sanitizeEntryName(name);

  const runDir = await makeRunDir();
  try {
    writeRunConfig(runDir, coverage);
    for (const [name, contents] of Object.entries(files)) {
      await fs.promises.writeFile(path.join(runDir, name), contents);
    }
    return await spawnVitest(runDir, { coverage, benchmark, timeoutMs });
  } finally {
    await fs.promises.rm(runDir, { recursive: true, force: true });
  }
}

function spawnVitest(
  runDir: string,
  opts: { coverage: boolean; benchmark: boolean; timeoutMs: number },
): Promise<RunResult> {
  return new Promise((resolve) => {
    const args = benchmark
      ? ['bench', '--root', runDir, '--reporter=json', '--outputFile.json=result.json']
      : ['run', '--root', runDir, '--reporter=json', '--outputFile.json=result.json'];
    if (opts.coverage && !opts.benchmark) args.push('--coverage');
    const child = spawn('node', [VITEST_BIN, ...args], {
      cwd: runDir,
      env: buildChildEnv(runDir),
      detached: true, // 独立进程组：超时可整组 kill，避免 vitest worker 孤儿
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let out = '';
    child.stdout.on('data', (d) => (out += d.toString()));
    child.stderr.on('data', (d) => (out += d.toString()));

    let killed = false;
    const killGroup = () => {
      killed = true;
      try {
        if (child.pid) process.kill(-child.pid, 'SIGKILL');
      } catch {
        /* 进程组可能已退出 */
      }
    };

    const timer = setTimeout(() => {
      killGroup();
      resolve(failResult(`Vitest 运行超时（${opts.timeoutMs / 1000}s，可能有用例陷入死循环）:\n${out.slice(-2000)}`));
    }, opts.timeoutMs);

    child.on('exit', () => {
      clearTimeout(timer);
      if (killed) return; // 超时分支已 resolve
      const coverageData = opts.coverage ? readCoverage(runDir) : undefined;
      resolve(finishRun(runDir, out, coverageData, opts.benchmark));
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      resolve(failResult(`启动 Vitest 失败: ${err.message}\n（请确认项目已安装 vitest：pnpm install）`));
    });
  });
}

/** 优先读取 --outputFile 写出的 result.json（免疫用户 stdout 打印干扰），失败回退 stdout 截取 */
function finishRun(runDir: string, out: string, coverageData: CoverageSummary | undefined, benchmark: boolean): RunResult {
  try {
    const resultPath = path.join(runDir, 'result.json');
    if (fs.existsSync(resultPath)) {
      const raw = fs.readFileSync(resultPath, 'utf-8');
      return benchmark ? parseBenchJson(raw) : parseVitestJson(raw, 0, coverageData);
    }
  } catch {
    /* 回退到 stdout 解析 */
  }
  const raw = extractJson(out);
  if (!raw) {
    return { ...failResult(`无法从输出解析测试结果，Vitest 输出:\n${out.slice(-2000)}`), coverage: coverageData };
  }
  return benchmark ? parseBenchJson(raw) : parseVitestJson(raw, 0, coverageData);
}
```

3f. `.gitignore` 追加一行：

```
.vitest-runs
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm test -- tests/runner-security.test.ts && pnpm tsc`
Expected: 全部 PASS（Task 2 的 4 个 + 本任务新增 6 个，集成用例总耗时约 15–40s），tsc 无错误

- [ ] **Step 5: 回归全量测试 + 本地端到端验证**

Run: `pnpm test && pnpm build && pnpm preview`（另开终端）`curl -s -X POST localhost:8000/api/run-vitest -H 'Content-Type: application/json' -d '{"files":{"lesson.spec.ts":"import {it,expect} from \"vitest\";\nit(\"ok\",()=>expect(1).toBe(1));"}}'`
Expected: 全量测试 9+10 用例全绿；preview 返回 `{"success":true,...}`；`ls .vitest-runs` 为空（目录已清理）

- [ ] **Step 6: Commit**

```bash
git add vitestServerRunner.ts .gitignore tests/runner-security.test.ts
git commit -m "feat(runner): 每请求独立临时目录、最小 env、进程组 kill、结果文件解析"
```

---

### Task 4: 并发限制 + handleRunVitest 400/429 快速失败

**Files:**
- Modify: `vitestServerRunner.ts`（新增 limiter、重写 `handleRunVitest` 校验/限流分支）
- Test: `tests/runner-security.test.ts`（追加）

**Interfaces:**
- Consumes: `sanitizeEntryName`（Task 2）、`runInSandbox(files, options)`（Task 3）、`failResult(output: string): RunResult`（Task 3 定义的模块内辅助函数，本任务新增的 `sendJson` 会用到；`readBody`/`RunBody` 沿用现状不动）
- Produces:
  - `export function createRunLimiter(maxConcurrent: number, maxQueue: number)`，返回 `{ acquire(): Promise<void>; release(): void }`；队列满时 `acquire()` 抛 `Error('RUNNER_BUSY')`。
  - `handleRunVitest` 行为新增：文件名非法 → HTTP 400（JSON body 含 `非法文件名`）；`files` 缺失/非对象/数组 → 400；排队满 → HTTP 429（JSON body 含 `运行排队已满`）。成功路径响应体不变。

- [ ] **Step 1: 写失败测试（追加）**

```ts
import { PassThrough } from 'node:stream';
import { createRunLimiter, handleRunVitest } from '../vitestServerRunner';

describe('createRunLimiter（并发信号量）', () => {
  it('满载排队，队列满拒绝，释放后排队者获得槽位', async () => {
    const limiter = createRunLimiter(2, 1);
    await limiter.acquire();
    await limiter.acquire();
    const queued = limiter.acquire();
    await expect(limiter.acquire()).rejects.toThrow('RUNNER_BUSY');
    limiter.release();
    await queued;
    limiter.release();
    limiter.release();
  });
});

function postRequest(body: unknown) {
  const req = new PassThrough() as unknown as import('node:http').IncomingMessage;
  (req as any).method = 'POST';
  (req as any).end(JSON.stringify(body));
  return req;
}

function collectRes() {
  const chunks: Buffer[] = [];
  const res = new PassThrough() as unknown as import('node:http').ServerResponse;
  (res as any).statusCode = 200;
  const done = new Promise<{ statusCode: number; body: string }>((resolve) => {
    (res as any).on('data', (c: Buffer) => chunks.push(c));
    (res as any).on('end', () => resolve({ statusCode: (res as any).statusCode, body: Buffer.concat(chunks).toString() }));
  });
  return { res, done };
}

describe('handleRunVitest（API 层快速失败）', () => {
  it('路径穿越文件名返回 400，不触发运行', { timeout: 15_000 }, async () => {
    const { res, done } = collectRes();
    await handleRunVitest(postRequest({ files: { '../evil.ts': 'x' } }), res);
    const { statusCode, body } = await done;
    expect(statusCode).toBe(400);
    expect(body).toContain('非法文件名');
  });

  it('files 缺失或为数组返回 400', { timeout: 15_000 }, async () => {
    for (const body of [{}, { files: ['a.ts'] }]) {
      const { res, done } = collectRes();
      await handleRunVitest(postRequest(body), res);
      const { statusCode } = await done;
      expect(statusCode).toBe(400);
    }
  });

  it('合法请求返回 200 与结构化结果', { timeout: 30_000 }, async () => {
    const { res, done } = collectRes();
    await handleRunVitest(postRequest({ files: { 'lesson.spec.ts': `import { it, expect } from 'vitest';\nit('ok', () => expect(1).toBe(1));\n` } }), res);
    const { statusCode, body } = await done;
    expect(statusCode).toBe(200);
    expect(JSON.parse(body).success).toBe(true);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm test -- tests/runner-security.test.ts`
Expected: FAIL — `createRunLimiter` 未导出；现状对非法文件名是 500（写盘时抛错）而非 400

- [ ] **Step 3: 实现 limiter 与新 handleRunVitest**

在 `vitestServerRunner.ts` 加入（`runInSandbox` 之后）：

```ts
/** 并发上限与排队上限：公网止血核心参数，宁可拒绝不可拖垮宿主机 */
const MAX_CONCURRENT_RUNS = 2;
const MAX_QUEUE = 8;

export function createRunLimiter(maxConcurrent: number, maxQueue: number) {
  let active = 0;
  const waiters: Array<() => void> = [];
  return {
    async acquire(): Promise<void> {
      if (active < maxConcurrent) {
        active++;
        return;
      }
      if (waiters.length >= maxQueue) throw new Error('RUNNER_BUSY');
      await new Promise<void>((r) => waiters.push(r));
      active++;
    },
    release(): void {
      active = Math.max(0, active - 1);
      const next = waiters.shift();
      if (next) next();
    },
  };
}

const limiter = createRunLimiter(MAX_CONCURRENT_RUNS, MAX_QUEUE);
```

用下面的实现整体替换 `handleRunVitest`（`RunBody` 接口与 `readBody` 不动）：

```ts
function sendJson(res: ServerResponse, statusCode: number, payload: RunResult) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

/** Vite 中间件处理函数 */
export async function handleRunVitest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end('Method Not Allowed');
    return;
  }

  let body: RunBody;
  try {
    body = await readBody(req);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    sendJson(res, 400, failResult(`请求无效: ${msg}`));
    return;
  }
  if (!body.files || typeof body.files !== 'object' || Array.isArray(body.files)) {
    sendJson(res, 400, failResult('缺少 files 字段'));
    return;
  }
  try {
    for (const name of Object.keys(body.files)) sanitizeEntryName(name);
  } catch (e) {
    sendJson(res, 400, failResult(e instanceof Error ? e.message : String(e)));
    return;
  }

  try {
    await limiter.acquire();
  } catch {
    sendJson(res, 429, failResult('运行排队已满，请稍后再试'));
    return;
  }
  try {
    const result = await runInSandbox(body.files, {
      coverage: !!body.coverage,
      benchmark: !!body.benchmark,
    });
    sendJson(res, 200, result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    sendJson(res, 500, failResult(`服务端错误: ${msg}`));
  } finally {
    limiter.release();
  }
}
```

- [ ] **Step 4: 运行确认通过 + 全量回归**

Run: `pnpm test && pnpm tsc`
Expected: 全部 PASS（既有 9 个 + 本测试文件累计新增 14 个 = 23 个用例），tsc 无错误

- [ ] **Step 5: Commit**

```bash
git add vitestServerRunner.ts tests/runner-security.test.ts
git commit -m "feat(runner): 并发信号量与排队上限，API 层 400/429 快速失败"
```

---

### Task 5: GitHub Actions CI（tsc + test + build + 课程内容校验）

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `package.json`（新增 `"packageManager"` 与 `"check:lessons"` script）

**Interfaces:**
- Consumes: Task 1 的 `pnpm tsc` 全绿；`scripts/check-lessons.ts`（已有，按文件头注释以 `node --experimental-strip-types` 运行，需 node_modules 中存在 esbuild——`pnpm install` 后可用）
- Produces: push/PR 时自动执行 `quality`（install → tsc → test → build）与 `lessons`（课程逐课实跑校验）两个 job；发布核对清单从「人工记忆」变为「机器门禁」。

- [ ] **Step 1: package.json 钉住 pnpm 版本并补脚本**

在 `package.json` 顶层（`"type": "module"` 之后）加入：

```json
"packageManager": "pnpm@10.34.5",
```

在 `scripts` 中加入：

```json
"check:lessons": "node --experimental-strip-types scripts/check-lessons.ts",
```

- [ ] **Step 2: 本地验证 check:lessons 可跑**

Run: `pnpm check:lessons`
Expected: 逐课时校验通过、退出码 0（57 课时实跑，约 2–5 分钟；若有既有课时失败，先停下向用户报告，不要顺手改课程数据）

- [ ] **Step 3: 写 workflow**

创建 `.github/workflows/ci.yml`：

```yaml
name: CI

on:
  push:
    branches: [master]
  pull_request:

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm tsc
      - run: pnpm test
      - run: pnpm build

  lessons:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm check:lessons
```

说明：`pnpm/action-setup@v4` 自动读取 `packageManager` 字段；`lessons` 单独成 job，避免 57 课实跑拖慢常规反馈。

- [ ] **Step 4: 本地等价验证（无法本地跑 Actions，用同序命令模拟）**

Run: `pnpm install --frozen-lockfile && pnpm tsc && pnpm test && pnpm build`
Expected: 四条命令全部成功，build 无 chunk 体积告警

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml package.json
git commit -m "ci: 接入 GitHub Actions（tsc/test/build + 逐课内容校验），钉住 pnpm 版本"
```

---

### Task 6: 文档同步 + 部署 runbook（nginx 限流与服务器 env 检查）

**Files:**
- Modify: `AGENTS.md`（目录结构、铁律 2、发布清单三处同步新行为）
- Create: `docs/deploy/runbook.md`

**Interfaces:**
- Consumes: Task 3/4 已实现的运行器新行为（`.vitest-runs/`、最小 env、2 并发 / 8 排队）
- Produces: 服务器操作者手册——部署步骤、nginx 限流配置片段（止血第 5 项，需人工在服务器执行）、env 泄露面检查命令（对应你「不确定」的密钥风险排查）。

- [ ] **Step 1: 更新 AGENTS.md**

1. 「目录结构」中 `.vitest-sandbox/` 行替换为：
   `  .vitest-runs/            # 运行临时目录根（每次运行独立 run-<rand> 子目录，跑完即删，已 gitignore）`
2. 「铁律 2」末尾追加一句：
   `运行器已按「受限执行」加固：文件名白名单、最小 env、独立临时目录、2 并发/8 排队（满则 429）。修改时不要放宽这些限制；如需更强隔离应迁移到一次性容器，而不是回退共享目录模式。`
3. 「发布核对清单」追加一项：
   `- [ ] 服务器 nginx 已配置 /api/run-vitest 按 IP 限流（见 docs/deploy/runbook.md）`

- [ ] **Step 2: 写 runbook**

创建 `docs/deploy/runbook.md`，内容如下：

````markdown
# 部署 Runbook（vitest-playground）

## 架构与部署形态

- 生产形态：服务器上 `pnpm build && pnpm preview`（Vite preview :8000，内置 `/api/run-vitest` 中间件），nginx 反代 443 → 127.0.0.1:8000。
- 运行器当前为「受限执行」：文件名白名单、最小 env、每请求独立临时目录、2 并发 / 8 排队（满则 429）、60s 超时进程组 kill。
- 更新发布：`git pull && pnpm install --frozen-lockfile && pnpm build`，然后重启 preview 进程（建议用 systemd 或 pm2 托管，避免裸 nohup）。

## nginx 限流（必须配置）

`/etc/nginx/conf.d/vitest-playground.conf`：

```nginx
# 每个 IP 每分钟最多 10 次运行请求，突发最多 3 个
limit_req_zone $binary_remote_addr zone=vitest_run:10m rate=10r/m;

server {
    listen 443 ssl;
    server_name vitest-playground.zhangzhengyang.com;
    # ... 证书等既有配置 ...

    location /api/run-vitest {
        limit_req zone=vitest_run burst=3 nodelay;
        limit_req_status 429;
        proxy_pass http://127.0.0.1:8000;
        proxy_read_timeout 90s;   # 大于运行器 60s 超时
    }

    location / {
        proxy_pass http://127.0.0.1:8000;
        # COEP/COOP 由 vite preview 响应头携带，透传即可，勿在此重复 add_header
    }
}
```

生效：`nginx -t && nginx -s reload`。验证：`for i in $(seq 1 6); do curl -s -o /dev/null -w '%{http_code}\n' -X POST https://vitest-playground.zhangzhengyang.com/api/run-vitest; done` —— 第 4 个起应出现 429。

## 环境变量泄露面检查（一次性，务必执行）

运行器已不再把 `process.env` 传给测试进程，但仍需确认历史暴露期内无密钥被读取过。在生产服务器上、以运行 preview 的同一用户执行：

```bash
# 1. 找到 preview 进程
pgrep -af 'vite'

# 2. 打印该进程的完整环境变量（把 <PID> 换成上一步结果）
tr '\0' '\n' < /proc/<PID>/environ | sort

# 3. 只看疑似敏感条目
tr '\0' '\n' < /proc/<PID>/environ | grep -iE 'key|token|secret|pass|cred|apikey|private'
```

判定与处置：
- 输出只有域名/端口/PATH 等公开配置 → 无泄露面，记录检查日期即可。
- 出现任何密钥/token/凭据 → 视为已泄露：立即轮换该凭据，并把新凭据改为配置文件（`chmod 600`）或 systemd `EnvironmentFile=` 注入到「不运行 preview 的」其它服务，而不是留在 preview 进程 env 里。
- 同时检查 shell 历史 / systemd unit / crontab 里是否有导出密钥的行：`grep -riE 'export .*(KEY|TOKEN|SECRET)' ~/.bashrc ~/.zshrc /etc/systemd/system 2>/dev/null`。

## 故障处理

- 跑测试一直 429：先 `pgrep -af vitest | wc -l` 看是否有卡死的 vitest 进程（正常应为 0）；有则确认运行器日志后重启 preview。
- 磁盘增长：`du -sh .vitest-runs` 应接近 0；若残留大量目录说明有运行被强杀后 finally 未执行，手动 `rm -rf .vitest-runs/run-*` 并提 issue 排查。
- 站点能开但测试报「无法连接运行服务」：preview 进程未启动或 nginx 上游端口不符。
````

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md docs/deploy/runbook.md
git commit -m "docs: 运行器加固说明同步与部署 runbook（nginx 限流 + env 泄露面检查）"
```

---

## 完成定义（全部任务结束后）

- [ ] `pnpm tsc`、`pnpm test`、`pnpm build` 全绿；`pnpm check:lessons` 通过
- [ ] 本地 `pnpm preview` + curl 实测：合法请求 200、非法文件名 400、连发 11 次出现排队/429
- [ ] `.vitest-runs/` 无残留目录
- [ ] GitHub Actions 两个 job 在仓库为绿色
- [ ] 服务器侧人工项（runbook 指引）：nginx 限流生效、env 检查已执行并记录结论
