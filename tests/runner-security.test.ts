import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sanitizeEntryName } from '../vitestServerRunner';
import { RUNS_ROOT, buildChildEnv, runInSandbox } from '../vitestServerRunner';
import type { Lesson } from '../src/pages/vitest-learn/data';
import { buildLessonFiles, findLesson, resolveRunOptions } from '../vitestServerRunner';
import { parseBenchTable } from '../vitestServerRunner';

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
    for (const name of ['vitest.config.js', 'setup.ts', 'package.json', 'result.json', 'vitest.config.ts', 'vitest.config.mjs', 'vite.config.ts', 'VITEST.CONFIG.JS', 'Setup.TS', 'package.JSON']) {
      expect(() => sanitizeEntryName(name)).toThrow('非法文件名');
    }
  });

  it('拒绝非字符串与空名', () => {
    for (const name of [undefined, null, 42, '', {}]) {
      expect(() => sanitizeEntryName(name as unknown as string)).toThrow();
    }
  });
});

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
  // PassThrough 没有 setHeader（ServerResponse 才有），测试替身需补齐该接口
  (res as any).setHeader = () => {};
  const done = new Promise<{ statusCode: number; body: string }>((resolve) => {
    (res as any).on('data', (c: Buffer) => chunks.push(c));
    (res as any).on('end', () => resolve({ statusCode: (res as any).statusCode, body: Buffer.concat(chunks).toString() }));
  });
  return { res, done };
}

describe('handleRunVitest（API 层快速失败）', () => {
  it('非法 body（缺字段或类型错误）返回 400', { timeout: 15_000 }, async () => {
    for (const body of [{}, { chapterKey: 42, lessonKey: 'first-test', code: 'x' }]) {
      const { res, done } = collectRes();
      await handleRunVitest(postRequest(body), res);
      const { statusCode } = await done;
      expect(statusCode).toBe(400);
    }
  });

  it('JSON null / 数组 body 返回 400 而非 500', { timeout: 15_000 }, async () => {
    for (const raw of ['null', '[]']) {
      const req = new PassThrough() as unknown as import('node:http').IncomingMessage;
      (req as any).method = 'POST';
      (req as any).end(raw);
      const { res, done } = collectRes();
      await handleRunVitest(req, res);
      const { statusCode } = await done;
      expect(statusCode).toBe(400);
    }
  });
});

describe('最终审查修复波（内存 DoS 加固）', () => {
  it('海量 stdout 不破坏解析且进程稳定', { timeout: 30_000 }, async () => {
    const result = await runInSandbox({
      'lesson.spec.ts': `import { it, expect } from 'vitest';\nit('flood', () => { for (let i = 0; i < 20000; i++) console.log('x'.repeat(200)); expect(1).toBe(1); });\n`,
    });
    expect(result.success).toBe(true);
    expect(result.passed).toBe(1);
  });

  it('超过 5MB 的请求体被 400 拒绝', { timeout: 15_000 }, async () => {
    const req = new PassThrough();
    (req as any).method = 'POST';
    req.on('error', () => {}); // destroy 后的残余流错误与本断言无关
    const { res, done } = collectRes();
    const pending = handleRunVitest(req as unknown as import('node:http').IncomingMessage, res); // 先挂 readBody 监听再灌数据
    req.write('x'.repeat(5 * 1024 * 1024 + 1));
    req.end();
    await pending;
    const { statusCode } = await done;
    expect(statusCode).toBe(400);
  });
});

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

describe('createRunLimiter（所有权转移语义）', () => {
  it('release 将槽位直接移交排队者（active 全程不超过 max）', async () => {
    const limiter = createRunLimiter(1, 2);
    await limiter.acquire();
    const q1 = limiter.acquire();
    const q2 = limiter.acquire();
    limiter.release(); // 交给 q1，active 仍为 1
    await q1;
    limiter.release(); // 交给 q2
    await q2;
    limiter.release(); // 无排队者，active 归零
    limiter.release(); // 冗余 release 不产生负计数/幻影唤醒
    await expect(limiter.acquire()).resolves.toBeUndefined();
  });
});

const fakeLesson = (over: Partial<Lesson> = {}): Lesson =>
  ({ key: 'k', title: 't', description: 'd', code: '', ...over }) as Lesson;

describe('buildLessonFiles（服务端装配）', () => {
  it('TDD：grader→spec、hiddenGrader→hidden、用户码→lesson.ts', () => {
    const files = buildLessonFiles(fakeLesson({ grader: 'G', hiddenGrader: 'H' }), 'U');
    expect(files).toEqual({ 'lesson.ts': 'U', 'lesson.spec.ts': 'G', 'lesson.hidden.spec.ts': 'H' });
  });

  it('TDD 无 hidden：不写 hidden 文件', () => {
    const files = buildLessonFiles(fakeLesson({ grader: 'G' }), 'U');
    expect(files).toEqual({ 'lesson.ts': 'U', 'lesson.spec.ts': 'G' });
  });

  it('纯空白的 grader/hiddenGrader 视为不存在（与旧前端 trim 守卫等价）', () => {
    const files = buildLessonFiles(fakeLesson({ grader: '   ', hiddenGrader: '  ' }), 'U');
    expect(files).toEqual({ 'lesson.spec.ts': 'U' });
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

  it('真实课时全链路可用（basics/first-test 以其初始 code 运行通过）', { timeout: 60_000 }, async () => {
    const { res, done } = collectRes();
    const lesson = findLesson('basics', 'first-test')!;
    await handleRunVitest(postRequest({ chapterKey: 'basics', lessonKey: 'first-test', code: lesson.code }), res);
    const { statusCode, body } = await done;
    expect(statusCode).toBe(200);
    expect(JSON.parse(body).success).toBe(true);
  });
});

describe('parseBenchTable（bench 默认表格解析）', () => {
  const SAMPLE = `
 ✓ lesson.spec.ts > sum 性能 1770ms
     name                 hz     min     max    mean     p75     p99    p995    p999     rme  samples
   · 累加 1000    1,117,900.18  0.0008  0.1765  0.0009  0.0009  0.0012  0.0013  0.0017  ±0.14%   558951
   · 累加 100000      7,505.62  0.1216  0.3707  0.1332  0.1368  0.1587  0.1739  0.2052  ±0.21%     3753

 BENCH  Summary

  累加 1000 - lesson.spec.ts > sum 性能
    148.94x faster than 累加 100000
`;

  it('解析 name / hz / mean 并忽略 Summary 段', () => {
    const result = parseBenchTable(SAMPLE);
    expect(result.success).toBe(true);
    expect(result.passed).toBe(2);
    expect(result.tests?.[0]).toMatchObject({ name: '累加 1000', status: 'passed', duration: 0.0009 });
    expect(result.tests?.[1]).toMatchObject({ name: '累加 100000', status: 'passed', duration: 0.1332 });
  });

  it('剥离 ANSI 颜色码后解析（真实运行器输出带色）', () => {
    const ansi = SAMPLE.replace(/· /g, '\x1b[32m·\x1b[39m ').replace(/name /, '\x1b[1mname    \x1b[22m');
    const result = parseBenchTable(ansi);
    expect(result.success).toBe(true);
    expect(result.passed).toBe(2);
    expect(result.tests?.[0]?.name).toBe('累加 1000');
  });

  it('无表格行时返回失败', () => {
    const result = parseBenchTable('No benchmark files found, exiting with code 1');
    expect(result.success).toBe(false);
    expect(result.output).toContain('无法从输出解析基准结果');
  });
});

describe('bench 课时全链路', () => {
  it('coverage-advanced/benchmark 经新契约成功运行', { timeout: 60_000 }, async () => {
    const { res, done } = collectRes();
    const lesson = findLesson('coverage-advanced', 'benchmark')!;
    await handleRunVitest(
      postRequest({ chapterKey: 'coverage-advanced', lessonKey: 'benchmark', code: lesson.code }),
      res,
    );
    const { statusCode, body } = await done;
    expect(statusCode).toBe(200);
    const parsed = JSON.parse(body);
    expect(parsed.success).toBe(true);
    expect(parsed.tests?.length).toBeGreaterThan(0);
  });

  it('bench 用例抛错时结果不标成功（失败时默认 reporter 不打印表格，解析 0 行）', { timeout: 60_000 }, async () => {
    const result = await runInSandbox(
      {
        'lesson.spec.ts': `import { bench, describe } from 'vitest';\ndescribe('bad', () => {\n  bench('会抛错', () => { throw new Error('boom'); });\n  bench('正常', () => { 1 + 1; });\n});\n`,
      },
      { benchmark: true },
    );
    expect(result.success).toBe(false);
    expect(result.passed).toBe(0);
  });
});
