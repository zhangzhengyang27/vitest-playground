# Backlog 执行方案（coverage 失效 / 服务端课时装配 / bench / 门禁补强）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 落地 2026-09-27 最终审查裁定的 backlog：修复 coverage 静默失效、把课时测试装配权从客户端收归服务端（消除 grader/hidden/extraFiles 篡改面）、修复 bench 课时、为 8 门无 solution 课时建立语法门禁、以及 runbook/limiter/保护名单等小修。

**Architecture:** 四个任务批次。Task A 与 Task D 改 `vitestServerRunner.ts`（串行执行避免冲突）；Task B 改 API 契约（前端与服务端同仓同发，无兼容负担——`runner.ts` 是唯一客户端）；Task C 独立改 `scripts/check-lessons.ts` 与 runbook。服务端装配复用 `data.ts`（其仅含 `import type`，可被 vite.config 的 esbuild 打包安全引入，`scripts/check-lessons.ts` 已验证此路径）。

**Tech Stack:** 沿用现状（Node 22 / TS strict / Vitest 4 / GitHub Actions）。

**Spec:** 用户批准的 backlog 清单（2026-09-27 会话）：
P1：① coverage 配置块失效修复（移入 `test.coverage`，带回归断言）；② 服务端按课时 key 重建 grader/hidden/extraFiles（现由客户端 files 传递可篡改）。
P2：③ 8 门无 solution 课时的最低校验（语法门禁）；④ `vitest bench --reporter=json` 在 Vitest 4.1.8 失效（benchmark 课时坏）；⑤ limiter 所有权转移式 release；⑥ `tsconfig.json` 入受保护名单；⑦ runbook `proxy_read_timeout` 调 600s 及同文件两处准确性修正。

**Spec 之外不做:** 给 8 门课时补参考答案（内容决策，留用户）；容器化隔离；400 响应保真（req.destroy 固有属性，审查明确本波不改）。

## Global Constraints

- 铁律不变：不删除/绕过 `vitestRunnerMiddleware` 与 `vitestServerRunner.ts`；不削弱 60s 超时与进程组 kill；不动 COEP/COOP、manualChunks。
- **API 契约升级为本方案唯一契约变更**：`POST /api/run-vitest` 新 body `{ chapterKey, lessonKey, code }`；`RunResult` 响应结构不变。前端（`runner.ts`/`chapter.tsx`）与服务端同分支同发；旧 `files` 形态请求一律 400。
- `scripts/check-lessons.ts` 自建文件布局，不依赖前端契约，不受 Task B 影响。
- 包管理 pnpm-only；每任务完成条件 `pnpm tsc` + `pnpm test` 全绿；独立提交（中文 conventional commits）。
- Task D 的 spike 在 /tmp 进行，探索性产物不入库。

## Review Focus

1. **新契约的 400 面**：`chapterKey`/`lessonKey` 不存在、`code` 非字符串、缺字段、旧 `files` 形态——全部 400 且不触碰沙箱。钉在 Task B。
2. **装配语义与前端旧语义逐字等价**：TDD（有 grader）＝用户文件 + grader→spec + hiddenGrader→hidden；无 grader＝userCode→spec + hiddenGrader→hidden；jsdom 加 happy-dom pragma 且用 `.tsx`；extraFiles 原样并入。钉在 Task B（用 data.ts 真实课时抽验）。
3. **coverage 回归**：`coverage:true` 运行后 `result.coverage.total` 为数值对象（修复前恒 undefined）。钉在 Task A。
4. **bench 全链路**：真实课时 `coverage-advanced/benchmark` 经新契约运行返回 success 且 tests 非空（含 `bench.include` 适配）。钉在 Task D。
5. **语法门禁不误报**：esbuild transform 不解析 import（`./lesson` 等未解析导入不报错），只抓语法/转义损坏。钉在 Task C。

---

### Task A: 运行器小修（coverage 配置、tsconfig 保护、limiter 所有权转移）

**Files:**
- Modify: `vitestServerRunner.ts`（writeRunConfig、PROTECTED_NAMES、createRunLimiter）
- Test: `tests/runner-security.test.ts`（追加 2 用例 + 1 向量）

**Interfaces:**
- Consumes: 现有 `runInSandbox(files, options)`、`createRunLimiter(maxConcurrent, maxQueue)`、`PROTECTED_NAMES`。
- Produces: coverage 字段首次真实可用；`tsconfig.json` 被拒；release 为「槽位所有权转移」语义（对 `handleRunVitest` 调用方透明）。

- [ ] **Step 1: 写失败测试（追加）**

```ts
describe('coverage 回归（修复前恒 undefined）', () => {
  it('coverage:true 时返回覆盖率摘要', { timeout: 30_000 }, async () => {
    const result = await runInSandbox({ 'lesson.spec.ts': PASSING_SPEC }, { coverage: true });
    expect(result.success).toBe(true);
    expect(result.coverage).toBeDefined();
    expect(typeof result.coverage!.total.lines).toBe('number');
  });
});

describe('sanitizeEntryName 追加保护', () => {
  it('拒绝 tsconfig.json（构建侧配置）', () => {
    expect(() => sanitizeEntryName('tsconfig.json')).toThrow('非法文件名');
  });
});
```

并在 limiter 测试后追加一条注释性断言用例（所有权转移下唤醒不改变 active 计数）：

```ts
it('release 将槽位直接移交排队者（active 全程不超过 max）', async () => {
  const limiter = createRunLimiter(1, 2);
  await limiter.acquire();
  const q1 = limiter.acquire();
  const q2 = limiter.acquire();
  limiter.release();      // 交给 q1，active 仍为 1
  await q1;
  limiter.release();      // 交给 q2
  await q2;
  limiter.release();      // 无排队者，active 归零
  limiter.release();      // 冗余 release 不产生负计数/幻影唤醒
  await expect(limiter.acquire()).resolves.toBeUndefined();
});
```

- [ ] **Step 2: 确认失败**

Run: `pnpm test -- tests/runner-security.test.ts`
Expected: FAIL —— coverage 用例 `result.coverage` 为 undefined；tsconfig.json 向量放行；新 limiter 用例在旧 release 语义下时序可过但注释语义不符（此用例主要作回归锚，允许绿，重点看前两条红）

- [ ] **Step 3: 实现**

3a. `writeRunConfig` 中 coverage 块从顶层移入 `test`（缩进同步）：

```js
export default {
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./setup.ts'],
    include: ['*.spec.ts', '*.spec.tsx', '*.test.ts', '*.test.tsx'],
    coverage: { reporter: ['json-summary'], ${coverage ? 'enabled: true' : 'enabled: false'} },
  },
  esbuild: { jsx: 'automatic' },
};
```

3b. `PROTECTED_NAMES` 追加 `'tsconfig.json'`（集合本身已是小写比对语义）。

3c. `createRunLimiter` 的 release 改为所有权转移（消除微任务间隙超订）：

```ts
release(): void {
  const next = waiters.shift();
  if (next) {
    next(); // 槽位所有权直接移交，active 保持不变
    return;
  }
  active = Math.max(0, active - 1);
}
```

acquire 中唤醒路径删除 `active++`（唤醒即已持有槽位）。

- [ ] **Step 4: 验证通过**

Run: `pnpm test -- tests/runner-security.test.ts && pnpm tsc && pnpm test`
Expected: 全绿（runner-security 16→18 用例），tsc 0 错误

- [ ] **Step 5: Commit**

```bash
git add vitestServerRunner.ts tests/runner-security.test.ts
git commit -m "fix(runner): coverage 配置移入 test 块、tsconfig 入保护名单、limiter 槽位所有权转移"
```

---

### Task B: 服务端按课时 key 重建测试文件（API 契约升级）

**Files:**
- Modify: `vitestServerRunner.ts`（新增 findLesson/resolveRunOptions/buildLessonFiles；handleRunVitest 换新契约）
- Modify: `src/pages/vitest-learn/runner.ts`（RunOptions 精简 + POST body）
- Modify: `src/pages/vitest-learn/chapter.tsx`（handleRunTest 调用点）
- Modify: `AGENTS.md`（「运行契约」一节同步）
- Test: `tests/runner-security.test.ts`（追加）

**Interfaces:**
- Consumes: `runInSandbox(files, options)`（Task A 后状态）；`data.ts` 的 `chapters`（type-only 依赖，esbuild 可打包）。
- Produces:
  - `export function findLesson(chapterKey: string, lessonKey: string): Lesson | undefined`
  - `export function resolveRunOptions(lesson: Lesson): { coverage: boolean; benchmark: boolean }` —— 返回 `{ coverage: !lesson.benchmark, benchmark: !!lesson.benchmark }`
  - `export function buildLessonFiles(lesson: Lesson, userCode: string): Record<string, string>` —— 装配规则见 Review Focus 2
  - 新请求契约：`{ chapterKey: string, lessonKey: string, code: string }`，任何缺失/非法（含旧 `files` 形态）→ 400 且不触碰沙箱。

- [ ] **Step 1: 写失败测试（追加）**

```ts
import { buildLessonFiles, findLesson, resolveRunOptions } from '../vitestServerRunner';

const fakeLesson = (over: Partial<import('../src/pages/vitest-learn/types').Lesson> = {}) => ({
  key: 'k', title: 't', description: 'd', code: '', ...over,
});

describe('buildLessonFiles（服务端装配）', () => {
  it('TDD：grader→spec、hiddenGrader→hidden、用户码→lesson.ts', () => {
    const files = buildLessonFiles(fakeLesson({ grader: 'G', hiddenGrader: 'H' }), 'U');
    expect(files).toEqual({ 'lesson.ts': 'U', 'lesson.spec.ts': 'G', 'lesson.hidden.spec.ts': 'H' });
  });
  it('TDD 无 hidden：不写 hidden 文件', () => {
    const files = buildLessonFiles(fakeLesson({ grader: 'G' }), 'U');
    expect(files).toEqual({ 'lesson.ts': 'U', 'lesson.spec.ts': 'G' });
  });
  it('普通模式：userCode→spec；hiddenGrader→hidden', () => {
    const files = buildLessonFiles(fakeLesson({ hiddenGrader: 'H' }), 'U');
    expect(files).toEqual({ 'lesson.spec.ts': 'U', 'lesson.hidden.spec.ts': 'H' });
  });
  it('jsdom：.tsx 扩展名 + happy-dom pragma', () => {
    const files = buildLessonFiles(fakeLesson({ environment: 'jsdom' }), 'U');
    expect(Object.keys(files)).toEqual(['lesson.spec.tsx']);
    expect(files['lesson.spec.tsx']).toMatch(/^\/\/ @vitest-environment happy-dom\n/);
  });
  it('extraFiles 由服务端并入（客户端无法篡改）', () => {
    const files = buildLessonFiles(fakeLesson({ extraFiles: { 'api.ts': 'A' } }), 'U');
    expect(files['api.ts']).toBe('A');
  });
  it('resolveRunOptions：benchmark 课时开 bench、关 coverage', () => {
    expect(resolveRunOptions(fakeLesson())).toEqual({ coverage: true, benchmark: false });
    expect(resolveRunOptions(fakeLesson({ benchmark: true }))).toEqual({ coverage: false, benchmark: true });
  });
  it('findLesson：真实课时可查、乱 key 返回 undefined', () => {
    expect(findLesson('basics', 'first-test')?.title).toContain('第一个测试用例');
    expect(findLesson('nope', 'nope')).toBeUndefined();
  });
});

describe('handleRunVitest 新契约', () => {
  it('旧 files 形态请求被 400 拒绝', async () => {
    const { res, done } = collectRes();
    await handleRunVitest(postRequest({ files: { 'lesson.spec.ts': 'x' } }), res);
    expect((await done).statusCode).toBe(400);
  });
  it('未知课时被 400 拒绝', async () => {
    const { res, done } = collectRes();
    await handleRunVitest(postRequest({ chapterKey: 'x', lessonKey: 'y', code: 'z' }), res);
    const { statusCode, body } = await done;
    expect(statusCode).toBe(400);
    expect(body).toContain('未知');
  });
  it('code 非字符串被 400 拒绝', async () => {
    const { res, done } = collectRes();
    await handleRunVitest(postRequest({ chapterKey: 'basics', lessonKey: 'first-test', code: 42 }), res);
    expect((await done).statusCode).toBe(400);
  });
  it('真实课时全链路可用（basics/first-test 以其初始 code 运行通过）', { timeout: 30_000 }, async () => {
    const { res, done } = collectRes();
    const lesson = findLesson('basics', 'first-test')!;
    await handleRunVitest(postRequest({ chapterKey: 'basics', lessonKey: 'first-test', code: lesson.code }), res);
    const { statusCode, body } = await done;
    expect(statusCode).toBe(200);
    expect(JSON.parse(body).success).toBe(true);
  });
});
```

注意：真实课时用例依赖 `first-test` 初始 code 本身是可通过的测试（事实核查过：1.1 的 starter 为自包含通过用例）。若运行发现它并非通过（例如依赖交互），换用任一「code 即通过测试」的普通课时并在报告中注明。

- [ ] **Step 2: 确认失败**

Run: `pnpm test -- tests/runner-security.test.ts && pnpm tsc`
Expected: FAIL —— 三个函数未导出；旧契约下新契约用例全部 400/失败

- [ ] **Step 3: 实现**

3a. `vitestServerRunner.ts` 顶部新增：

```ts
import { chapters } from './src/pages/vitest-learn/data';
import type { Lesson } from './src/pages/vitest-learn/types';

export function findLesson(chapterKey: string, lessonKey: string): Lesson | undefined {
  return chapters.find((c) => c.key === chapterKey)?.lessons.find((l) => l.key === lessonKey);
}

export function resolveRunOptions(lesson: Lesson): { coverage: boolean; benchmark: boolean } {
  return { coverage: !lesson.benchmark, benchmark: !!lesson.benchmark };
}

export function buildLessonFiles(lesson: Lesson, userCode: string): Record<string, string> {
  const isJsdom = lesson.environment === 'jsdom';
  const ext = isJsdom ? 'tsx' : 'ts';
  const pragma = isJsdom ? '// @vitest-environment happy-dom\n\n' : '';
  const files: Record<string, string> = {};
  if (lesson.grader) {
    // TDD：用户实现为 lesson.*，grader 为可见主校验，hiddenGrader 为隐藏测试
    files[`lesson.${ext}`] = userCode;
    files[`lesson.spec.${ext}`] = pragma + lesson.grader;
    if (lesson.hiddenGrader) files[`lesson.hidden.spec.${ext}`] = pragma + lesson.hiddenGrader;
  } else {
    // 普通模式：用户编辑的即测试文件
    files[`lesson.spec.${ext}`] = pragma + userCode;
    if (lesson.hiddenGrader) files[`lesson.hidden.spec.${ext}`] = pragma + lesson.hiddenGrader;
  }
  if (lesson.extraFiles) Object.assign(files, lesson.extraFiles);
  return files;
}
```

3b. `RunBody` 换为 `{ chapterKey: unknown; lessonKey: unknown; code: unknown }`；`handleRunVitest` 校验链替换为：

```ts
if (
  typeof body.chapterKey !== 'string' ||
  typeof body.lessonKey !== 'string' ||
  typeof body.code !== 'string'
) {
  sendJson(res, 400, failResult('请求无效: 需要 chapterKey / lessonKey / code 三个字符串字段'));
  return;
}
const lesson = findLesson(body.chapterKey, body.lessonKey);
if (!lesson) {
  sendJson(res, 400, failResult(`未知课时: ${body.chapterKey}/${body.lessonKey}`));
  return;
}
try {
  await limiter.acquire();
} catch {
  sendJson(res, 429, failResult('运行排队已满，请稍后再试'));
  return;
}
try {
  const files = buildLessonFiles(lesson, body.code);
  const { coverage, benchmark } = resolveRunOptions(lesson);
  const result = await runInSandbox(files, { coverage, benchmark });
  sendJson(res, 200, result);
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  sendJson(res, 500, failResult(`服务端错误: ${msg}`));
} finally {
  limiter.release();
}
```

（`sanitizeEntryName` 校验保留在 `runInSandbox` 内——extraFiles 键同样要过白名单。）

3c. `src/pages/vitest-learn/runner.ts`：

```ts
export interface RunOptions {
  chapterKey: string;
  lessonKey: string;
  /** 用户当前编辑的代码（普通模式=测试文件，TDD=实现文件） */
  code: string;
}

export async function runVitest(opts: RunOptions): Promise<RunResult> {
  try {
    const resp = await fetch('/api/run-vitest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chapterKey: opts.chapterKey, lessonKey: opts.lessonKey, code: opts.code }),
    });
    // …错误处理与现文件一致…
```

`useRealVitest` 的 `runCode(opts)` 直接 `return runVitest(opts)`（删除全部装配逻辑与 jsdom/coverage/benchmark/extraFiles 字段）。文件头注释同步：「测试装配已收归服务端，防篡改」。

3d. `chapter.tsx` 的 `handleRunTest`：`runOpts` 替换为

```ts
const runOpts: RunOptions = {
  chapterKey,
  lessonKey: effectiveLessonKey!,
  code: codeToRun,
};
```

（`isTDD`/`isJsdom` 仅保留给 UI 标签与只读编辑器展示；删除 onProgress 兼容赋值。）

3e. `AGENTS.md`「运行契约」一节更新：body 为 `{ "chapterKey": "...", "lessonKey": "...", "code": "..." }`，说明「grader/hiddenGrader/extraFiles/环境/coverage/benchmark 均由服务端按课时数据装配，客户端不可注入」；两种课时模式的描述保持。

3f. **改写旧契约 API 测试**（tests/runner-security.test.ts 中 Task 4 遗留的两条会被本契约变更打破）：
- 删除「路径穿越文件名被 400 拒绝」（旧 `files` 形态）——穿越面已随契约消失，`sanitizeEntryName` 仍由 `runInSandbox` 内部把守（extraFiles 键），其单测保留；
- 将「合法请求返回 200 与结构化结果」（`files` 形态）替换为本任务 Step 1 的「真实课时全链路可用」用例；
- 「files 缺失或为数组返回 400」改断言新契约缺失字段的 400（保留用例名意图：非法 body → 400）。

- [ ] **Step 4: 验证通过 + 回归**

Run: `pnpm tsc && pnpm test && pnpm build && pnpm check:lessons`
Expected: 全绿。`check:lessons` 不受影响（自建布局）；`pnpm build` 确认 vite.config 打包 data.ts 无告警。

- [ ] **Step 5: Commit**

```bash
git add vitestServerRunner.ts src/pages/vitest-learn/runner.ts src/pages/vitest-learn/chapter.tsx AGENTS.md tests/runner-security.test.ts
git commit -m "feat(runner): 测试装配收归服务端，按课时 key 重建 grader/hidden/extraFiles"
```

---

### Task C: check-lessons 语法门禁 + runbook 修缮

**Files:**
- Modify: `scripts/check-lessons.ts`（SKIP 课时改为语法门禁；修 ：44 过时注释）
- Modify: `docs/deploy/runbook.md`（超时 600s；两处准确性修正）

**Interfaces:**
- Consumes: 脚本内已有 ESBUILD_BIN（Task 5 修复后可直接 spawn）。
- Produces: 无 solution 课时不再跳过——其 `code`/`grader`/`hiddenGrader`/`extraFiles` 每个非空字符串经 esbuild transform（`loader: 'ts'`/`'tsx'`，**不 bundle、不解析 import**），transform 失败 = FAIL；全部通过计入新类别 `syntax-ok`。汇总行四计数变五计数。

- [ ] **Step 1: 实现**

1a. 新增 transform 校验函数（用现有 spawn 方式调用 ESBUILD_BIN，`--loader=ts`，stdin 传内容或写临时文件；非零退出 = 语法损坏）：

```ts
function checkSyntax(label: string, source: string, loader: 'ts' | 'tsx'): string | null {
  // 返回 null=通过，否则返回错误摘要（取 stderr 首行）
}
```

1b. 主循环：`!lesson.solution?.trim()` 分支从「整课 SKIP」改为：收集 `lesson.code`（loader tsx）、`lesson.grader`、`lesson.hiddenGrader`、`Object.values(lesson.extraFiles ?? {})`（loader tsx），逐个 `checkSyntax`；任一失败 → `[FAIL]`（附课时名与首个错误行）；全部通过 → `[SYN]` 计数。`skipped` 归零。

1c. 汇总行更新为 `passed / failed / warned / syntax-ok / skipped(0)`；文件头契约注释同步；`:44` 的 `.vitest-sandbox` 注释改为 `.vitest-runs/run-*`。

1d. `docs/deploy/runbook.md`：`proxy_read_timeout 90s` → `600s`（注释：运行器 60s 超时 × 8 深排队最长约 480s，600s 留缓冲）；`pgrep -af 'vite'` 与「正常应为 0」的表述改为 `pgrep -af 'vite.js preview'` 并注明「正常 1-2 个（master+worker）」；env 排查一节补一行覆盖 shell 历史与 crontab 的命令（`grep -riE 'export .*(KEY|TOKEN|SECRET)' ~/.bash_history ~/.zsh_history 2>/dev/null; crontab -l 2>/dev/null | grep -iE 'key|token|secret'`）。

- [ ] **Step 2: 验证**

Run: `pnpm check:lessons && pnpm tsc && pnpm test`
Expected: exit 0；汇总含 8 门 syntax-ok、skipped=0；既有 87 PASS 不回退

- [ ] **Step 3: Commit**

```bash
git add scripts/check-lessons.ts docs/deploy/runbook.md
git commit -m "feat(scripts): 无 solution 课时改为 esbuild 语法门禁；runbook 超时与排查命令修缮"
```

---

### Task D: bench reporter spike 与修复

**Files:**
- Modify: `vitestServerRunner.ts`（writeRunConfig 的 bench.include；spawnVitest bench 分支 reporter 组合；必要时新增 table 解析器）
- Test: `tests/runner-security.test.ts`（追加全链路用例）

**Interfaces:**
- Consumes: Task B 后的新契约（`resolveRunOptions` 提供 benchmark）。
- Produces: `coverage-advanced/benchmark` 课时经 `handleRunVitest` 全链路 success 且 tests 非空。

- [ ] **Step 1: Spike（/tmp，不入库）**

用 `coverage-advanced/benchmark` 的 code 内容在 /tmp 沙箱（结构与运行器一致：vitest.config.js + setup.ts + lesson.spec.ts）依次尝试并记录 stdout/exit：

```bash
node node_modules/vitest/vitest.mjs bench --root /tmp/xx --reporter=json
node node_modules/vitest/vitest.mjs bench --root /tmp/xx --reporter=basic
node node_modules/vitest/vitest.mjs bench --root /tmp/xx --outputFile.json=result.json
node node_modules/vitest/vitest.mjs bench --root /tmp/xx
```

同时验证关键假设：bench 默认 `include` 为 `*.bench.*`，而课时文件名为 `lesson.spec.ts`——预期需在 writeRunConfig 的 benchmark 分支加 `bench: { include: ['*.spec.ts', '*.spec.tsx'] }` 才能被发现。

- [ ] **Step 2: 按结论实现**

- 若某 reporter 组合产出 JSON（stdout 或 result.json）：沿用 `finishRun` 主路径，bench 分支仅改 args。
- 若 JSON 不可用：以 default/basic 输出的表格行为准新增 `parseBenchTable(text): RunResult`（行结构：`✓ name  +ms  ops/sec ±x%` 之类，以 spike 实测格式写正则，逐行 `tests.push`；解析失败回退现有 failResult 文案）。
- `writeRunConfig(runDir, coverage, benchmark)` 增加 benchmark 参数并按需写入 `bench.include`（调用点同步）。
- `spawnVitest` bench 分支 args 按 spike 结论更新。

- [ ] **Step 3: 写失败测试 → 实现 → 通过**

```ts
it('bench 课时全链路（coverage-advanced/benchmark）', { timeout: 60_000 }, async () => {
  const { res, done } = collectRes();
  const lesson = findLesson('coverage-advanced', 'benchmark')!;
  await handleRunVitest(postRequest({ chapterKey: 'coverage-advanced', lessonKey: 'benchmark', code: lesson.code }), res);
  const { statusCode, body } = await done;
  expect(statusCode).toBe(200);
  const parsed = JSON.parse(body);
  expect(parsed.success).toBe(true);
  expect(parsed.tests?.length).toBeGreaterThan(0);
});
```

（先跑一次确认红——修复前 bench 课时必然失败；再实现转绿。真实 bench 运行 2-10s，测试超时给 60s。）

Run: `pnpm test -- tests/runner-security.test.ts && pnpm tsc && pnpm test`
Expected: 全绿

- [ ] **Step 4: Commit**

```bash
git add vitestServerRunner.ts tests/runner-security.test.ts
git commit -m "fix(runner): bench 课时修复（bench.include 适配 + 可用 reporter 组合）"
```

---

## 完成定义（全部任务结束后）

- [ ] `pnpm tsc`、`pnpm test`、`pnpm build`、`pnpm check:lessons` 全绿（check:lessons 无 skip）
- [ ] coverage 字段真实返回；bench 课时经新契约可用；8 门语法门禁生效
- [ ] AGENTS.md 运行契约与实现一致
- [ ] 最终全分支审查通过
