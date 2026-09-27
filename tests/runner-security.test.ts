import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sanitizeEntryName } from '../vitestServerRunner';
import { RUNS_ROOT, buildChildEnv, runInSandbox } from '../vitestServerRunner';

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
