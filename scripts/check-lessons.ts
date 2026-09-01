/**
 * 课时代码质量验证脚本：
 * 逐课时模拟 runner 的文件布局，用本地 vitest 实测 code / solution。
 * 非 TDD 课时要求 code 与 solution 均通过；TDD 课时要求 solution 通过、code 不崩溃。
 * 运行：node --experimental-strip-types scripts/check-lessons.ts
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// 用 esbuild 编译 data.ts（Node strip-types 无法处理嵌套模板字符串）
const ROOT_ABS = process.cwd();
const pnpmDir = path.join(ROOT_ABS, 'node_modules', '.pnpm');
const esbuildPkg = fs
  .readdirSync(pnpmDir)
  .find((d) => d.startsWith('esbuild@') && fs.existsSync(path.join(pnpmDir, d, 'node_modules', 'esbuild', 'bin', 'esbuild')));
if (!esbuildPkg) throw new Error('未找到 esbuild 包');
const ESBUILD_BIN = path.join(pnpmDir, esbuildPkg, 'node_modules', 'esbuild', 'bin', 'esbuild');

const DATA_SRC = path.join(ROOT_ABS, 'src/pages/vitest-learn/data.ts');
const compiledPath = path.join(os.tmpdir(), 'vitest-check-data.mjs');
const build = spawnSync(process.execPath, [ESBUILD_BIN, DATA_SRC, '--bundle', '--format=esm', `--outfile=${compiledPath}`, '--platform=node'], { encoding: 'utf-8' });
if (build.status !== 0) {
  console.error(build.stdout, build.stderr);
  process.exit(1);
}
const { chapters } = await import(`file://${compiledPath}`);

const ROOT = process.cwd();
const VITEST_BIN = path.join(ROOT, 'node_modules', 'vitest', 'vitest.mjs');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'vitest-lessons-'));

function writeSandbox(dir: string, files: Record<string, string>) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'vitest.config.mjs'),
    `export default {
  test: { globals: true, environment: 'node', include: ['*.spec.ts', '*.spec.tsx'] },
  esbuild: { jsx: 'automatic' },
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

function run(dir: string): { passed: number; failed: number; error: string | null; fails: string[] } {
  const res = spawnSync(
    'node',
    [VITEST_BIN, 'run', '--root', dir, '--reporter=json'],
    { cwd: dir, timeout: 30_000, encoding: 'utf-8' },
  );
  const out = `${res.stdout ?? ''}\n${res.stderr ?? ''}`;
  const start = out.indexOf('{');
  const end = out.lastIndexOf('}');
  if (start === -1 || end < start) {
    return { passed: 0, failed: 1, error: `无法解析输出: ${out.slice(-400)}`, fails: [] };
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
    return {
      passed: data.numPassedTests ?? 0,
      failed: data.numFailedTests ?? 0,
      error: null,
      fails,
    };
  } catch {
    return { passed: 0, failed: 1, error: `JSON 解析失败: ${out.slice(-400)}`, fails: [] };
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

let failedCount = 0;
const results: string[] = [];
// 支持传课时 key 过滤：node scripts/check-lessons.ts key1 key2 ...
const FILTER = new Set(process.argv.slice(2));

for (const chapter of chapters) {
  for (const lesson of chapter.lessons) {
    if (FILTER.size && !FILTER.has(lesson.key)) continue;
    for (const which of ['code', 'solution'] as const) {
      const { label, files, mustPass } = buildRuns(lesson, which);
      const dir = path.join(TMP, `${chapter.key}-${lesson.key}-${which}`);
      writeSandbox(dir, files);
      const r = run(dir);
      const ok = mustPass ? r.failed === 0 : r.error === null;
      const tag = ok ? 'PASS' : 'FAIL';
      if (!ok) failedCount++;
      const detail = r.error
        ? ` [${r.error}]`
        : ` (${r.passed} passed / ${r.failed} failed)${r.fails.length ? '\n        ' + r.fails.join('\n        ') : ''}`;
      results.push(`[${tag}] ${chapter.key}/${lesson.key} ${label}${detail}`);
      console.log(`[${tag}] ${chapter.key}/${lesson.key} ${label}${detail}`);
    }
  }
}

console.log('\n========== 汇总 ==========');
console.log(`总课时：${chapters.reduce((s, c) => s + c.lessons.length, 0)}`);
if (failedCount > 0) {
  console.log(`失败数：${failedCount}`);
  process.exitCode = 1;
} else {
  console.log('全部通过 ✅');
}
