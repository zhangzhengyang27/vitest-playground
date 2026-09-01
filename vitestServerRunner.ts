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
const SANDBOX = path.join(ROOT, '.vitest-sandbox');
const COVERAGE_DIR = path.join(SANDBOX, 'coverage');
const VITEST_BIN = path.join(ROOT, 'node_modules', 'vitest', 'vitest.mjs');
/** 单次执行超时（毫秒） */
const RUN_TIMEOUT = 60_000;

interface RunBody {
  files: Record<string, string>;
  jsdom: boolean;
  /** 是否开启覆盖率收集（--coverage，reporter 见 vitest.config.js） */
  coverage?: boolean;
  /** 是否以基准模式运行（vitest bench） */
  benchmark?: boolean;
}

/** 上一轮写入的临时文件，便于每轮清理，避免跨模式/跨课时残留互相干扰 */
const LESSON_FILE_CANDIDATES = [
  'lesson.ts',
  'lesson.tsx',
  'lesson.spec.ts',
  'lesson.spec.tsx',
  'lesson.hidden.spec.ts',
  'lesson.hidden.spec.tsx',
  'result.json',
];

function ensureSandbox(coverage: boolean) {
  fs.mkdirSync(SANDBOX, { recursive: true });
  // vitest 配置：globals / 自动 jsx；环境默认 node，jsdom 章节由文件内 pragma 覆盖。
  // 注意：不用 reporter 的 tuple 形式（[['json',{outputFile}]] 在部分环境会被当成
  // 自定义模块解析而崩溃），改用 CLI `--reporter=json` 并解析 stdout。
  // coverage.reporter 设为 json-summary 备用；CLI 传 --coverage 时启用。
  fs.writeFileSync(
    path.join(SANDBOX, 'vitest.config.js'),
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
  // 引入 jest-dom 匹配器（happy-dom 环境下 React 测试用）
  fs.writeFileSync(
    path.join(SANDBOX, 'setup.ts'),
    `import '@testing-library/jest-dom/vitest';\n`,
  );
}

function cleanupLessonFiles() {
  for (const name of LESSON_FILE_CANDIDATES) {
    try {
      fs.rmSync(path.join(SANDBOX, name));
    } catch {
      /* 不存在则忽略 */
    }
  }
}

/** 读取覆盖率摘要（vitest --coverage 写出的 coverage-summary.json） */
function readCoverage(): CoverageSummary | undefined {
  try {
    const summaryPath = path.join(COVERAGE_DIR, 'coverage-summary.json');
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
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 5 * 1024 * 1024) reject(new Error('提交内容过大'));
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(data) as RunBody);
      } catch {
        reject(new Error('请求体不是合法 JSON'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * 在沙箱目录跑一次真实 vitest，返回结构化结果。
 * benchmark 为 true 时改用 `vitest bench` 子命令。
 */
function runInSandbox(
  files: Record<string, string>,
  coverage: boolean,
  benchmark: boolean,
): Promise<RunResult> {
  ensureSandbox(coverage);
  cleanupLessonFiles();
  for (const [name, contents] of Object.entries(files)) {
    fs.writeFileSync(path.join(SANDBOX, name), contents);
  }

  return new Promise<RunResult>((resolve) => {
    const args = benchmark
      ? ['bench', '--root', SANDBOX, '--reporter=json']
      : ['run', '--root', SANDBOX, '--reporter=json'];
    if (coverage && !benchmark) args.push('--coverage');
    const child = spawn('node', [VITEST_BIN, ...args], {
      cwd: SANDBOX,
      env: { ...process.env, NODE_ENV: 'test' },
    });

    let out = '';
    child.stdout.on('data', (d) => (out += d.toString()));
    child.stderr.on('data', (d) => (out += d.toString()));

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve({
        success: false,
        output: `Vitest 运行超时（${RUN_TIMEOUT / 1000}s，可能有用例陷入死循环）:\n${out.slice(-2000)}`,
        passed: 0,
        failed: 1,
      });
    }, RUN_TIMEOUT);

    child.on('exit', (code) => {
      clearTimeout(timer);
      const raw = extractJson(out);
      if (benchmark) {
        if (!raw) {
          resolve({
            success: false,
            output: `无法从输出解析基准结果，Vitest 输出:\n${out.slice(-2000)}`,
            passed: 0,
            failed: 1,
          });
          return;
        }
        resolve(parseBenchJson(raw));
        return;
      }
      const coverageData = coverage ? readCoverage() : undefined;
      if (!raw) {
        resolve({
          success: false,
          output: `无法从输出解析测试结果，Vitest 输出:\n${out.slice(-2000)}`,
          passed: 0,
          failed: 1,
          coverage: coverageData,
        });
        return;
      }
      resolve(parseVitestJson(raw, code ?? 0, coverageData));
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        success: false,
        output: `启动 Vitest 失败: ${err.message}\n（请确认项目已安装 vitest：npm install）`,
        passed: 0,
        failed: 1,
      });
    });
  });
}

/** 从 vitest --reporter=json 的 stdout 中提取 JSON 片段 */
function extractJson(text: string): string {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return '';
  return text.slice(start, end + 1);
}

/** Vite 中间件处理函数 */
export async function handleRunVitest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end('Method Not Allowed');
    return;
  }
  try {
    const body = await readBody(req);
    if (!body.files || typeof body.files !== 'object') {
      res.statusCode = 400;
      res.end(JSON.stringify({ success: false, output: '缺少 files 字段', passed: 0, failed: 1 }));
      return;
    }
    const result = await runInSandbox(body.files, !!body.coverage, !!body.benchmark);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(result));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: false, output: `服务端错误: ${msg}`, passed: 0, failed: 1 }));
  }
}
