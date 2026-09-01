import { describe, test, expect, beforeEach } from 'vitest';
import {
  setLessonProgress,
  isLessonPassed,
  clearProgress,
  getLessonProgress,
} from '../src/pages/vitest-learn/progress';

describe('学习进度持久化', () => {
  beforeEach(() => {
    clearProgress();
  });

  test('初始状态无通过记录', () => {
    expect(isLessonPassed('basics', 'first-test')).toBe(false);
  });

  test('标记通过后可通过校验', () => {
    setLessonProgress('basics', 'first-test', { status: 'passed' });
    expect(isLessonPassed('basics', 'first-test')).toBe(true);
  });

  test('保存的代码可被读取', () => {
    setLessonProgress('basics', 'first-test', { code: 'const a = 1;' });
    expect(getLessonProgress('basics', 'first-test').code).toBe('const a = 1;');
  });

  test('clearProgress 清空所有进度', () => {
    setLessonProgress('basics', 'first-test', { status: 'passed' });
    clearProgress();
    expect(isLessonPassed('basics', 'first-test')).toBe(false);
  });
});
