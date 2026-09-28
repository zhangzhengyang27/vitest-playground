/**
 * 课时代码质量验证脚本：
 * 逐课时模拟 runner 的文件布局，用本地 vitest 实测 code / solution。
 * 契约：
 * - 有 solution 的课时：solution 运行必须通过，否则 FAIL；
 *   code（starter）运行允许「断言失败」类结果（教学性失败起点）计 WARN，
 *   进程崩溃、语法错误等套件级失败、无合法 JSON 结果仍判 FAIL
 * - 无 solution 的课时：不实测运行（补 solution 属内容决策），但其
 *   code / grader / hiddenGrader / extraFiles 全部过 esbuild 语法门禁
 *   （只 transform 不解析 import），损坏计 FAIL，全过计 SYN
 * - 摘要输出 passed / failed / warned / syntax-ok / skipped 五个计数；仅 failed > 0 时退出码 1
 * 运行：node --experimental-strip-types scripts/check-lessons.ts
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// 用 esbuild 编译 data.ts（Node strip-types 无法处理嵌套模板字符串）
const ROOT_ABS = process.cwd();
// 与产品运行器保持一致：子进程不继承 CI 标记（产品 env 白名单不含 CI）。
// 否则 CI 上 vitest 进入 CI 模式：.only 被直接拒绝、缺失快照不创建而是判失败，
// 会让 skip-only 与 snapshot 课时出现本地没有的假失败。
const { CI: _ci, GITHUB_ACTIONS: _ga, ...childEnv } = process.env;
const pnpmDir = path.join(ROOT_ABS, 'node_modules', '.pnpm');
const esbuildPkg = fs
  .readdirSync(pnpmDir)
  .find((d) => d.startsWith('esbuild@') && fs.existsSync(path.join(pnpmDir, d, 'node_modules', 'esbuild', 'bin', 'esbuild')));
if (!esbuildPkg) throw new Error('未找到 esbuild 包');
const ESBUILD_BIN = path.join(pnpmDir, esbuildPkg, 'node_modules', 'esbuild', 'bin', 'esbuild');

const DATA_SRC = path.join(ROOT_ABS, 'src/pages/vitest-learn/data.ts');
const compiledPath = path.join(os.tmpdir(), 'vitest-check-data.mjs');
const build = spawnSync(ESBUILD_BIN, [DATA_SRC, '--bundle', '--format=esm', `--outfile=${compiledPath}`, '--platform=node'], { encoding: 'utf-8' });
if (build.status !== 0) {
  console.error(build.stdout, build.stderr);
  process.exit(1);
}
const { chapters } = await import(`file://${compiledPath}`);

const ROOT = process.cwd();
const VITEST_BIN = path.join(ROOT, 'node_modules', 'vitest', 'vitest.mjs');
// realpath：macOS 的 os.tmpdir() 返回 /var/folders/...（符号链接），而 vitest/vite
// 会把 spec 解析为 /private/var/...（真实路径），root 与文件路径不一致时模块被
// 外部化，报 Cannot find module '/@fs/...'。统一用真实路径建沙箱根。
const TMP = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'vitest-lessons-')));

/** 语法门禁：esbuild transform（不 bundle、不解析 import），失败返回错误摘要首行，通过返回 null。
 *  必须直接执行 esbuild 二进制（pnpm allowBuilds 下 bin/esbuild 为原生二进制，不能用 node 跑）。 */
function checkSyntax(source: string, loader: 'ts' | 'tsx'): string | null {
  const res = spawnSync(ESBUILD_BIN, [`--loader=${loader}`], { input: source, encoding: 'utf-8' });
  if (res.status === 0) return null;
  return (res.stderr ?? '').split('\n')[0].slice(0, 300) || 'esbuild transform 失败';
}

function writeSandbox(dir: string, files: Record<string, string>, benchmark = false) {
  fs.mkdirSync(dir, { recursive: true });
  // 与产品沙箱（.vitest-runs/run-<rand>，位于仓库内）对齐：把仓库 node_modules 链接进沙箱，
  // 使 react / @testing-library 等裸导入可解析（os.tmpdir() 父链上没有 node_modules）。
  // cacheDir 重定向到沙箱内，避免经符号链接把 vite 缓存写进仓库 node_modules。
  const nm = path.join(dir, 'node_modules');
  if (!fs.existsSync(nm)) fs.symlinkSync(path.join(ROOT_ABS, 'node_modules'), nm, 'junction');
  fs.writeFileSync(
    path.join(dir, 'vitest.config.mjs'),
    `export default {
  test: { globals: true, environment: 'node', include: ['*.spec.ts', '*.spec.tsx']${benchmark ? ", benchmark: { include: ['*.spec.ts', '*.spec.tsx'] }" : ''} },
  esbuild: { jsx: 'automatic' },
  cacheDir: '.vite-cache',
};
`,
  );
  for (const [name, contents] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), contents);
  }
}

interface RunInfo {
  key: string;
  label: string;
  files: Record<string, string>;
  /** 是否要求通过 */
  mustPass: boolean;
}

type RunStats = { passed: number; failed: number; error: string | null; fails: string[]; broken: boolean };

function run(dir: string, benchmark = false): RunStats {
  // benchmark 课时与产品一致用 vitest bench（默认 reporter，无内置 json 可用）
  if (benchmark) {
    const benchRes = spawnSync('node', [VITEST_BIN, 'bench', '--root', dir], {
      cwd: dir,
      timeout: 120_000,
      encoding: 'utf-8',
      env: childEnv,
    });
    const benchOut = `${benchRes.stdout ?? ''}\n${benchRes.stderr ?? ''}`.replace(/\x1B\[[0-9;]*[A-Za-z]/g, '');
    const rowRe = /^\s*[·✓×]\s+(.+?)\s{2,}([\d,.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/;
    const rows = benchOut.split('\n').filter((l) => rowRe.test(l));
    if (rows.length === 0) {
      return { passed: 0, failed: 1, error: `无基准结果行: ${benchOut.slice(-300)}`, fails: [], broken: false };
    }
    return { passed: rows.length, failed: 0, error: null, fails: [], broken: false };
  }
  const res = spawnSync(
    'node',
    [VITEST_BIN, 'run', '--root', dir, '--reporter=json'],
    { cwd: dir, timeout: 30_000, encoding: 'utf-8', env: childEnv },
  );
  const out = `${res.stdout ?? ''}\n${res.stderr ?? ''}`;
  const start = out.indexOf('{');
  const end = out.lastIndexOf('}');
  if (start === -1 || end < start) {
    return { passed: 0, failed: 1, error: `无法解析输出: ${out.slice(-400)}`, fails: [], broken: false };
  }
  try {
    const data = JSON.parse(out.slice(start, end + 1));
    const fails: string[] = [];
    for (const fr of data.testResults ?? []) {
      for (const t of fr.assertionResults ?? []) {
        if (t.status === 'failed') {
          const msg = (t.failureMessages?.[0] ?? '').split('\n').slice(0, 3).join(' ');
          fails.push(`${t.fullName ?? t.title} → ${msg}`);
        }
      }
    }
    // 有套件失败但没有任何断言级失败 → 加载/收集错误（如语法错误），归入「崩溃」类
    const broken = (data.numFailedTestSuites ?? 0) > 0 && (data.numFailedTests ?? 0) === 0;
    if (broken) {
      for (const fr of data.testResults ?? []) {
        if (fr.status === 'failed') {
          const msg = (fr.message ?? '').split('\n').slice(0, 2).join(' ').slice(0, 300);
          fails.push(`${fr.name ?? 'suite'} → ${msg}`);
        }
      }
    }
    return {
      passed: data.numPassedTests ?? 0,
      failed: data.numFailedTests ?? 0,
      error: null,
      fails,
      broken,
    };
  } catch {
    return { passed: 0, failed: 1, error: `JSON 解析失败: ${out.slice(-400)}`, fails: [], broken: false };
  }
}

function buildRuns(lesson: (typeof chapters)[number]['lessons'][number], which: 'code' | 'solution') {
  const isTDD = !!lesson.grader;
  const jsdom = lesson.environment === 'jsdom';
  const ext = jsdom ? 'tsx' : 'ts';
  const pragma = jsdom ? '// @vitest-environment happy-dom\n\n' : '';
  const userCode = which === 'code' ? lesson.code : lesson.solution ?? '';
  const files: Record<string, string> = {};
  const label = `${which === 'code' ? 'code' : 'solution'}`;

  if (isTDD) {
    const userFile = jsdom ? 'lesson.tsx' : 'lesson.ts';
    files[userFile] = userCode;
    files[`lesson.spec.${ext}`] = pragma + (lesson.grader ?? '');
    if (lesson.hiddenGrader?.trim()) {
      files[`lesson.hidden.spec.${ext}`] = pragma + lesson.hiddenGrader;
    }
  } else {
    files[`lesson.spec.${ext}`] = pragma + userCode;
  }
  if (lesson.extraFiles) {
    Object.assign(files, lesson.extraFiles);
  }
  return { label, files, mustPass: which === 'solution' || !isTDD };
}

let passedCount = 0;
let failedCount = 0;
let warnedCount = 0;
let syntaxOkCount = 0;
let skippedCount = 0;
const results: string[] = [];
// 支持传课时 key 过滤：node scripts/check-lessons.ts key1 key2 ...
const FILTER = new Set(process.argv.slice(2));

for (const chapter of chapters) {
  for (const lesson of chapter.lessons) {
    if (FILTER.size && !FILTER.has(lesson.key)) continue;
    if (!lesson.solution?.trim()) {
      // 无 solution 的课时：不实测运行，但过语法门禁——抓转义/抄录损坏
      // （历史真实缺陷形态：模板字符串少闭合导致整段答案损坏）
      const loader = lesson.environment === 'jsdom' ? 'tsx' : 'ts';
      // extraFiles 只 transform TS/TSX；其他类型（未来可能的 .json/.css 等）没有语法门禁意义，跳过
      const extraLoaders = Object.entries(lesson.extraFiles ?? {}).map(([n, c]): [string, string, 'ts' | 'tsx' | null] => [
        n,
        c,
        n.endsWith('.tsx') ? 'tsx' : /\.(ts|mts|cts)$/.test(n) ? 'ts' : null,
      ]);
      const sources: Array<[string, string, 'ts' | 'tsx']> = [
        ['code', lesson.code, loader],
        ...(lesson.grader ? [['grader', lesson.grader, loader] as [string, string, 'ts' | 'tsx']] : []),
        ...(lesson.hiddenGrader ? [['hiddenGrader', lesson.hiddenGrader, loader] as [string, string, 'ts' | 'tsx']] : []),
        ...extraLoaders.filter((e): e is [string, string, 'ts' | 'tsx'] => e[2] !== null),
      ];
      const bad = sources
        .map(([label, src, ld]) => ({ label, err: checkSyntax(src, ld) }))
        .filter((x) => x.err !== null);
      if (bad.length) {
        failedCount++;
        const line = `[FAIL] ${chapter.key}/${lesson.key} 语法门禁\n        ${bad
          .map((b) => `${b.label}: ${b.err}`)
          .join('\n        ')}`;
        results.push(line);
        console.log(line);
      } else {
        syntaxOkCount++;
        const line = `[SYN] ${chapter.key}/${lesson.key}（无 solution：语法门禁通过 ${sources.length} 个源）`;
        results.push(line);
        console.log(line);
      }
      continue;
    }
    for (const which of ['code', 'solution'] as const) {
      const { label, files } = buildRuns(lesson, which);
      const dir = path.join(TMP, `${chapter.key}-${lesson.key}-${which}`);
      const bench = !!lesson.benchmark;
      writeSandbox(dir, files, bench);
      const r = run(dir, bench);
      // solution 运行必须通过；code（starter）运行允许「断言失败」类结果（教学性失败起点）计 WARN，
      // 但崩溃/语法错误等套件级失败、无合法 JSON 结果仍判 FAIL
      const tag = which === 'solution'
        ? r.error === null && !r.broken && r.failed === 0
          ? 'PASS'
          : 'FAIL'
        : r.error !== null || r.broken
          ? 'FAIL'
          : r.failed > 0
            ? 'WARN'
            : 'PASS';
      if (tag === 'PASS') passedCount++;
      else if (tag === 'WARN') warnedCount++;
      else failedCount++;
      const detail = r.error
        ? ` [${r.error}]`
        : ` (${r.passed} passed / ${r.failed} failed)${r.fails.length ? '\n        ' + r.fails.join('\n        ') : ''}${r.broken ? ' [套件级失败：加载/收集错误]' : ''}`;
      results.push(`[${tag}] ${chapter.key}/${lesson.key} ${label}${detail}`);
      console.log(`[${tag}] ${chapter.key}/${lesson.key} ${label}${detail}`);
    }
  }
}

console.log('\n========== 汇总 ==========');
console.log(`总课时：${chapters.reduce((s, c) => s + c.lessons.length, 0)}`);
console.log(
  `passed：${passedCount} / failed：${failedCount} / warned：${warnedCount} / syntax-ok：${syntaxOkCount} / skipped：${skippedCount}`,
);
if (failedCount > 0) {
  console.log('存在失败运行 ❌');
  process.exitCode = 1;
} else {
  console.log('无失败 ✅（warned 为教学性失败起点，syntax-ok 为无 solution 课时通过语法门禁）');
}
