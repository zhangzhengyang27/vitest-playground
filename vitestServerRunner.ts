/**
 * 服务端 Vitest 运行器（替代 WebContainer）
 *
 * 思路：浏览器把用户代码 POST 到本接口，Node（Vite 开发服务器所在进程）
 * 在本地沙箱目录里用「项目已安装的 vitest」真正跑测试，再把结构化结果返回。
 * 完全不经过 WebContainer / StackBlitz CDN，离线即可运行（依赖已在本机 node_modules）。
 *
 * 安全说明：此运行器会在本机执行用户代码，仅适用于本地学习工具。
 * 已对单次执行加超时并强制 kill，避免用例死循环拖垮进程。
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { RunResult, CoverageSummary, CoverageFile } from './src/pages/vitest-learn/types';

const ROOT = process.cwd();
const VITEST_BIN = path.join(ROOT, 'node_modules', 'vitest', 'vitest.mjs');
/** 每次运行的独立临时目录根（必须在项目根之下，vitest 才能向上解析到 node_modules） */
export const RUNS_ROOT = path.join(ROOT, '.vitest-runs');
/** 单次执行超时（毫秒） */
const RUN_TIMEOUT = 60_000;
/** 单次请求允许写入的文件数上限 */
const MAX_FILES = 20;

/** 受保护文件：运行器自身写入沙箱的配置，禁止被请求覆盖（对 name 小写化后全量比对，防大小写变体在不区分大小写的文件系统上覆盖真实文件） */
const PROTECTED_NAMES = new Set(['vitest.config.js', 'setup.ts', 'package.json', 'result.json', 'tsconfig.json']);
/** vitest/vite 任意扩展名的配置文件一律拒绝（Vitest 4 配置解析含 .ts/.mts/.cts/.js/.mjs/.cjs） */
const VITE_CONFIG_RE = /^(vitest|vite)\.config\./i;
/** 沙箱文件名白名单：扁平名、无路径分隔符、无 `..`（data.ts 的 extraFiles 均为扁平名，已确认兼容） */
const SAFE_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** 校验请求要写入沙箱的文件名；非法直接抛错（由 handleRunVitest 转 400） */
export function sanitizeEntryName(name: unknown): string {
  const lower = typeof name === 'string' ? name.toLowerCase() : '';
  const valid =
    typeof name === 'string' &&
    SAFE_NAME_RE.test(name) &&
    !name.includes('..') &&
    !PROTECTED_NAMES.has(lower) &&
    !VITE_CONFIG_RE.test(lower);
  if (!valid) {
    throw new Error(`非法文件名: ${typeof name === 'string' ? name.slice(0, 50) : String(name)}`);
  }
  return name;
}

interface RunBody {
  files: Record<string, string>;
  jsdom: boolean;
  /** 是否开启覆盖率收集（--coverage，reporter 见 vitest.config.js） */
  coverage?: boolean;
  /** 是否以基准模式运行（vitest bench） */
  benchmark?: boolean;
}

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

function writeRunConfig(runDir: string, coverage: boolean) {
  fs.writeFileSync(
    path.join(runDir, 'vitest.config.js'),
    `export default {
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./setup.ts'],
    include: ['*.spec.ts', '*.spec.tsx', '*.test.ts', '*.test.tsx'],
    coverage: { reporter: ['json-summary'], ${coverage ? 'enabled: true' : 'enabled: false'} },
  },
  esbuild: { jsx: 'automatic' },
};
`,
  );
  // 引入 jest-dom 匹配器（happy-dom 环境下 React 测试用）
  fs.writeFileSync(path.join(runDir, 'setup.ts'), `import '@testing-library/jest-dom/vitest';\n`);
}

/** 读取覆盖率摘要（vitest --coverage 写出的 coverage-summary.json） */
function readCoverage(runDir: string): CoverageSummary | undefined {
  try {
    const summaryPath = path.join(runDir, 'coverage', 'coverage-summary.json');
    if (!fs.existsSync(summaryPath)) return undefined;
    const raw = JSON.parse(fs.readFileSync(summaryPath, 'utf-8')) as Record<string, any>;
    const toFile = (obj: any): CoverageFile => ({
      lines: Number(obj?.lines?.pct ?? 0),
      statements: Number(obj?.statements?.pct ?? 0),
      branches: Number(obj?.branches?.pct ?? 0),
      functions: Number(obj?.functions?.pct ?? 0),
    });
    const total = toFile(raw.total);
    const files: CoverageFile[] = Object.entries(raw)
      .filter(([k]) => k !== 'total')
      .map(([k, v]) => ({ file: path.basename(k), ...toFile(v) }));
    return { total, files };
  } catch {
    return undefined;
  }
}

function parseVitestJson(
  raw: string,
  exitCode: number,
  coverage?: CoverageSummary,
): RunResult {
  try {
    const data = JSON.parse(raw);
    const passed: number = data.numPassedTests ?? 0;
    const failed: number = data.numFailedTests ?? 0;
    const pending: number = data.numPendingTests ?? 0;
    const success = failed === 0;

    const tests: RunResult['tests'] = [];
    const markers: RunResult['markers'] = [];

    const lines: string[] = ['Test Results', '============', ''];
    for (const fileResult of data.testResults ?? []) {
      const fileName = fileResult.name ? path.basename(fileResult.name) : '';
      lines.push(`📄 ${fileName}`);
      for (const t of fileResult.assertionResults ?? []) {
        const icon =
          t.status === 'passed'
            ? '✓'
            : t.status === 'failed'
              ? '✗'
              : t.status === 'skipped' || t.status === 'pending'
                ? '○'
                : '·';
        const dur =
          typeof t.duration === 'number' ? ` (${Math.round(t.duration)}ms)` : '';
        lines.push(`  ${icon} ${t.title ?? ''}${dur}`);
        tests.push({
          name: t.title ?? '',
          status: t.status,
          duration: typeof t.duration === 'number' ? t.duration : undefined,
          file: fileName,
          line: t.location?.line,
        });
        if (t.status === 'failed' && Array.isArray(t.failureMessages) && t.failureMessages.length) {
          const msg = t.failureMessages[0]
            .split('\n')
            .slice(0, 6)
            .map((l: string) => `    ${l}`)
            .join('\n');
          lines.push(msg);
          markers.push({
            line: t.location?.line ?? 1,
            message: (t.failureMessages[0].split('\n')[0] ?? '测试失败').slice(0, 200),
          });
        }
      }
      lines.push('');
    }
    lines.push(`通过: ${passed}  失败: ${failed}  跳过: ${pending}`);
    if (exitCode !== 0 && failed === 0) {
      lines.push('（进程退出码非 0，可能存在配置/环境问题）');
    }
    return { success, output: lines.join('\n'), passed, failed, pending, tests, markers, coverage };
  } catch {
    return {
      success: false,
      output: `测试结果解析失败，原始输出:\n${raw.slice(0, 2000)}`,
      passed: 0,
      failed: 1,
    };
  }
}

/** 解析 vitest bench --reporter=json 的输出 */
function parseBenchJson(raw: string): RunResult {
  try {
    const data = JSON.parse(raw);
    const lines: string[] = ['Benchmark Results', '================', ''];
    const tests: RunResult['tests'] = [];
    for (const file of data.files ?? []) {
      lines.push(`📄 ${file.filepath ?? ''}`);
      for (const g of file.groups ?? []) {
        for (const b of g.benchmarks ?? []) {
          const mean = typeof b.mean === 'number' ? b.mean : 0;
          const hz = typeof b.hz === 'number' ? b.hz : 0;
          lines.push(`  • ${b.name}: ${mean.toFixed(3)}ms (${Math.round(hz)} ops/s)`);
          tests.push({ name: b.name, status: 'passed', duration: mean });
        }
      }
      lines.push('');
    }
    return {
      success: true,
      output: lines.join('\n'),
      passed: tests.length,
      failed: 0,
      tests,
    };
  } catch {
    return {
      success: false,
      output: `基准结果解析失败，原始输出:\n${raw.slice(0, 2000)}`,
      passed: 0,
      failed: 1,
    };
  }
}

function readBody(req: IncomingMessage): Promise<RunBody> {
  return new Promise((resolve, reject) => {
    let data = '';
    let settled = false; // 防双重 settle；超限销毁后丢弃残余 chunk，不再拼接
    req.on('data', (chunk) => {
      if (settled) return;
      data += chunk;
      if (data.length > 5 * 1024 * 1024) {
        settled = true;
        req.destroy();
        reject(new Error('提交内容过大'));
      }
    });
    req.on('end', () => {
      if (settled) return;
      try {
        resolve(JSON.parse(data) as RunBody);
      } catch {
        reject(new Error('请求体不是合法 JSON'));
      }
    });
    req.on('error', (err) => {
      if (!settled) {
        settled = true;
        reject(err);
      }
    });
  });
}

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
 * benchmark 为 true 时改用 `vitest bench` 子命令。
 */
export async function runInSandbox(
  files: Record<string, string>,
  options: RunInSandboxOptions = {},
): Promise<RunResult> {
  const { coverage = false, benchmark = false, timeoutMs = RUN_TIMEOUT } = options;
  // 防线纵深：运行超时即便被注入也不得超过生产默认 RUN_TIMEOUT
  const effectiveTimeoutMs = Math.min(timeoutMs, RUN_TIMEOUT);
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
    return await spawnVitest(runDir, { coverage, benchmark, timeoutMs: effectiveTimeoutMs });
  } finally {
    await fs.promises.rm(runDir, { recursive: true, force: true });
  }
}

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
      // 唤醒即已持有槽位（release 所有权转移），此处不得再 active++
    },
    release(): void {
      const next = waiters.shift();
      if (next) {
        next(); // 槽位所有权直接移交排队者，active 保持不变（消除微任务间隙超订）
        return;
      }
      active = Math.max(0, active - 1);
    },
  };
}

const limiter = createRunLimiter(MAX_CONCURRENT_RUNS, MAX_QUEUE);

function spawnVitest(
  runDir: string,
  opts: { coverage: boolean; benchmark: boolean; timeoutMs: number },
): Promise<RunResult> {
  return new Promise((resolve) => {
    const args = opts.benchmark
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
    // 尾部窗口：只累计前 1MB 输出，防用户海量 stdout 打爆宿主内存（解析主路径是 result.json，消费方只读尾部 slice(-2000)）
    child.stdout.on('data', (d) => {
      if (out.length < 1_000_000) out += d.toString();
    });
    child.stderr.on('data', (d) => {
      if (out.length < 1_000_000) out += d.toString();
    });

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

    child.on('close', () => {
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

/** 从 vitest --reporter=json 的 stdout 中提取 JSON 片段 */
function extractJson(text: string): string {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return '';
  return text.slice(start, end + 1);
}

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
