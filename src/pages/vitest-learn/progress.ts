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

/** 成就徽章定义与进度（纯数据 + 纯计算，供进度页渲染与单测使用） */
export interface Badge {
  id: 'first' | 'ten' | 'half' | 'chapter' | 'master';
  name: string;
  desc: string;
  icon: 'medal' | 'fire' | 'rocket' | 'crown' | 'trophy';
  goal: number;
  current: number;
  /** 覆盖默认 current/goal 展示的文本（如整章攻克显示「已通关 x/16 章」） */
  hint?: string;
  ok: boolean;
}

export interface BadgeContext {
  chaptersTotal: number;
  chaptersCompleted: number;
  lessonsTotal: number;
  lessonsPassed: number;
}

export function computeBadges(ctx: BadgeContext): Badge[] {
  const { chaptersTotal, chaptersCompleted, lessonsTotal, lessonsPassed } = ctx;
  const halfGoal = Math.ceil(lessonsTotal / 2);
  const defs: Array<Omit<Badge, 'ok'> & { goal: number; current: number }> = [
    { id: 'first', name: '初次通关', desc: '完成首个课时', icon: 'medal', goal: 1, current: Math.min(lessonsPassed, 1) },
    { id: 'ten', name: '小有成效', desc: '完成 10 个课时', icon: 'fire', goal: 10, current: Math.min(lessonsPassed, 10) },
    { id: 'half', name: '渐入佳境', desc: '完成过半课时', icon: 'rocket', goal: halfGoal, current: Math.min(lessonsPassed, halfGoal) },
    // 「任意一章」语义：有任一章完整通关即解锁；进度展示用 hint 呈现章级明细
    { id: 'chapter', name: '整章攻克', desc: '完整通关任意一章', icon: 'crown', goal: 1, current: Math.min(chaptersCompleted, 1), hint: `已通关 ${chaptersCompleted}/${chaptersTotal} 章` },
    { id: 'master', name: '测试大师', desc: '通关全部课时', icon: 'trophy', goal: lessonsTotal, current: Math.min(lessonsPassed, lessonsTotal) },
  ];
  return defs.map((d) => {
    // 零课时总数时过半/大师没有意义，保持未解锁（与原判定等价）
    const meaningless = (d.id === 'half' || d.id === 'master') && lessonsTotal === 0;
    return { ...d, ok: !meaningless && d.current >= d.goal };
  });
}
