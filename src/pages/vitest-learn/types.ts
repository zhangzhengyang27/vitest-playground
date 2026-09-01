export interface TestResult {
  status: 'idle' | 'running' | 'success' | 'error';
  output: string;
  duration?: string;
  passed?: number;
  failed?: number;
  pending?: number;
  error?: string;
  /** 逐用例结果（含耗时与失败定位） */
  tests?: TestCaseSummary[];
  /** 失败用例在编辑器中的定位标记（普通模式，用户编辑测试文件时有效） */
  markers?: ErrorMarker[];
  /** 覆盖率摘要（开启 coverage 时返回） */
  coverage?: CoverageSummary;
}

export interface RunResult {
  success: boolean;
  output: string;
  passed: number;
  failed: number;
  pending?: number;
  error?: string;
  tests?: TestCaseSummary[];
  markers?: ErrorMarker[];
  coverage?: CoverageSummary;
}

/** 知识小测 */
export interface Quiz {
  question: string;
  options: string[];
  /** 正确选项下标 */
  answer: number;
}

/** 单个文件的覆盖率（百分比 0-100） */
export interface CoverageFile {
  file?: string;
  lines: number;
  statements: number;
  branches: number;
  functions: number;
}

/** 覆盖率摘要 */
export interface CoverageSummary {
  total: CoverageFile;
  files: CoverageFile[];
}

/** 逐用例结果 */
export interface TestCaseSummary {
  name: string;
  status: 'passed' | 'failed' | 'pending' | 'skipped';
  duration?: number;
  file?: string;
  line?: number;
}

/** 编辑器内错误定位 */
export interface ErrorMarker {
  line: number;
  message: string;
}
