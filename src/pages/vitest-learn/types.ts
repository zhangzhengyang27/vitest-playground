/**
 * 学习平台共享类型定义
 */

export interface TestResult {
  status: 'idle' | 'running' | 'success' | 'error';
  output: string;
  duration?: string;
  passed?: number;
  failed?: number;
  pending?: number;
  error?: string;
}

export interface RunResult {
  success: boolean;
  output: string;
  passed: number;
  failed: number;
  pending?: number;
  error?: string;
}

/** 知识小测 */
export interface Quiz {
  question: string;
  options: string[];
  /** 正确选项下标 */
  answer: number;
}
