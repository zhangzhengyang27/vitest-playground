/**
 * 测试运行引擎
 *
 * 通过同源接口 POST 到 Vite 服务端，由服务端按课时数据装配沙箱文件后
 * 用真实 Vitest 运行并返回结构化结果。grader / hiddenGrader / extraFiles /
 * 运行环境 / coverage / benchmark 均由服务端决定，客户端只提交课时 key
 * 与当前编辑的代码（防篡改）。
 */
import { useState, useCallback } from 'react';
import type { RunResult } from './types';

export interface RunOptions {
  /** 章节 key */
  chapterKey: string;
  /** 课时 key（章节内唯一） */
  lessonKey: string;
  /** 用户当前编辑的代码（普通模式=测试文件，TDD=实现文件） */
  code: string;
}

export async function runVitest(opts: RunOptions): Promise<RunResult> {
  try {
    const resp = await fetch('/api/run-vitest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chapterKey: opts.chapterKey, lessonKey: opts.lessonKey, code: opts.code }),
    });
    if (!resp.ok) {
      return {
        success: false,
        output: `服务端返回 ${resp.status}`,
        passed: 0,
        failed: 1,
      };
    }
    return (await resp.json()) as RunResult;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      success: false,
      output: `无法连接运行服务: ${msg}（请确认开发服务器已启动）`,
      passed: 0,
      failed: 1,
    };
  }
}

/**
 * React Hook：供课时页面调用。
 */
export function useRealVitest() {
  const [isReady] = useState(true);

  const runCode = useCallback((opts: RunOptions): Promise<RunResult> => runVitest(opts), []);

  return { runCode, isReady };
}
