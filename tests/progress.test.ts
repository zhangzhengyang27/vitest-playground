import { describe, test, expect, beforeEach } from 'vitest';
import {
  setLessonProgress,
  isLessonPassed,
  clearProgress,
  getLessonProgress,
  computeBadges,
} from '../src/pages/vitest-learn/progress';

describe('computeBadges（成就徽章进度模型）', () => {
  const base = { chaptersTotal: 16, lessonsTotal: 56 };

  test('零进度：全部未解锁，current 为 0', () => {
    const badges = computeBadges({ ...base, chaptersCompleted: 0, lessonsPassed: 0 });
    expect(badges.every((b) => !b.ok)).toBe(true);
    expect(badges.find((b) => b.id === 'first')?.current).toBe(0);
    expect(badges.find((b) => b.id === 'half')?.goal).toBe(28); // ceil(56/2)
  });

  test('完成 1 课时：初次通关解锁，小有成效显示 1/10', () => {
    const badges = computeBadges({ ...base, chaptersCompleted: 0, lessonsPassed: 1 });
    const first = badges.find((b) => b.id === 'first')!;
    const ten = badges.find((b) => b.id === 'ten')!;
    expect(first.ok).toBe(true);
    expect(ten.ok).toBe(false);
    expect(ten.current).toBe(1);
    expect(ten.goal).toBe(10);
  });

  test('完成 10 课时：小有成效解锁，渐入佳境未过半', () => {
    const badges = computeBadges({ ...base, chaptersCompleted: 0, lessonsPassed: 10 });
    expect(badges.find((b) => b.id === 'ten')?.ok).toBe(true);
    expect(badges.find((b) => b.id === 'half')?.ok).toBe(false);
  });

  test('整章攻克只看完整通关章数，不受课时数影响', () => {
    // 通关 10 课时但没有任何一章完整通关
    expect(
      computeBadges({ ...base, chaptersCompleted: 0, lessonsPassed: 10 }).find((b) => b.id === 'chapter')?.ok,
    ).toBe(false);
    // 只通关 1 门课但恰是某章唯一一门（构造：3 章各 1 门）
    expect(
      computeBadges({ chaptersTotal: 3, lessonsTotal: 3, chaptersCompleted: 1, lessonsPassed: 1 }).find(
        (b) => b.id === 'chapter',
      )?.ok,
    ).toBe(true);
  });

  test('全部通关：测试大师解锁', () => {
    const badges = computeBadges({ ...base, chaptersCompleted: 16, lessonsPassed: 56 });
    expect(badges.every((b) => b.ok)).toBe(true);
    expect(badges.find((b) => b.id === 'master')?.current).toBe(56);
  });

  test('零课时总数时过半/大师不误判解锁', () => {
    const badges = computeBadges({ chaptersTotal: 0, lessonsTotal: 0, chaptersCompleted: 0, lessonsPassed: 0 });
    expect(badges.find((b) => b.id === 'half')?.ok).toBe(false);
    expect(badges.find((b) => b.id === 'master')?.ok).toBe(false);
  });
});

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
