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
