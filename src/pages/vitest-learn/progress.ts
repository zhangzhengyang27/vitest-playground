/**
 * 学习进度持久化（localStorage）
 * 个人学习场景：记住学到哪一节、哪些课时已跑通、上次写的代码。
 */

const KEY = 'vitest-playground-progress-v1';

export interface LessonProgress {
  code?: string;
  status?: 'idle' | 'passed';
  lastRunAt?: number;
}

export type ProgressMap = Record<string, LessonProgress>;

const lessonId = (chapterKey: string, lessonKey: string) => `${chapterKey}:${lessonKey}`;

export function loadProgress(): ProgressMap {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') as ProgressMap;
  } catch {
    return {};
  }
}

export function saveProgress(map: ProgressMap): void {
  localStorage.setItem(KEY, JSON.stringify(map));
}

export function getLessonProgress(chapterKey: string, lessonKey: string): LessonProgress {
  return loadProgress()[lessonId(chapterKey, lessonKey)] ?? {};
}

export function setLessonProgress(
  chapterKey: string,
  lessonKey: string,
  patch: Partial<LessonProgress>,
): void {
  const map = loadProgress();
  const id = lessonId(chapterKey, lessonKey);
  map[id] = { ...map[id], ...patch };
  saveProgress(map);
}

export function isLessonPassed(chapterKey: string, lessonKey: string): boolean {
  return getLessonProgress(chapterKey, lessonKey).status === 'passed';
}

export function clearProgress(): void {
  localStorage.removeItem(KEY);
}
