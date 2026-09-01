import { describe, test, expect } from 'vitest';
import { chapters } from '../src/pages/vitest-learn/data';

describe('课程数据完整性', () => {
  test('每个章节都包含至少一个课时', () => {
    expect(chapters.length).toBeGreaterThan(0);
    for (const c of chapters) {
      expect(c.lessons.length, `${c.key} 课时为空`).toBeGreaterThan(0);
    }
  });

  test('章节 key 全局唯一', () => {
    const keys = chapters.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test('课时 key 全局唯一', () => {
    const keys = chapters.flatMap((c) => c.lessons.map((l) => `${c.key}/${l.key}`));
    expect(new Set(keys).size).toBe(keys.length);
  });

  test('每个课时都有可运行内容（code 或 grader）', () => {
    for (const c of chapters) {
      for (const l of c.lessons) {
        expect(l.code || l.grader, `${c.key}/${l.key} 缺少 code 或 grader`).toBeTruthy();
      }
    }
  });

  test('已补充第九章（覆盖率与高级技巧）与第十六章（TDD 进阶）', () => {
    const keys = chapters.map((c) => c.key);
    expect(keys).toContain('coverage-advanced');
    expect(keys).toContain('tdd-advanced');
  });
});
