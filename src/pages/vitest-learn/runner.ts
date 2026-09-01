/**
 * 测试运行引擎
 *
 * 通过同源接口 POST 到本地 Vite 服务器，由服务端用「项目已安装的 vitest」
 * 真正运行测试，再返回结构化结果。完全不依赖 WebContainer / StackBlitz CDN，
 * 离线即可运行（前提是本机 node_modules 已安装 vitest 等相关依赖）。
 */
import { useState, useCallback } from 'react';
import type { RunResult } from './types';

export async function runVitest(
  specFiles: Record<string, string>,
  jsdom = false,
): Promise<RunResult> {
  try {
    const resp = await fetch('/api/run-vitest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: specFiles, jsdom }),
    });
    if (!resp.ok) {
      return {
        success: false,
        output: `服务端返回 ${resp.status}`,
        passed: 0,
        failed: 1,
      };
    }
    const result = (await resp.json()) as RunResult;
    return result;
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
 * 运行选项：
 * - 普通模式：userCode 即用户编写的测试文件（lesson.spec.ts / lesson.spec.tsx）。
 * - TDD 模式（存在 testCode）：userCode 为用户编写的实现（userFileName），
 *   testCode 为可见测试文件（lesson.spec.ts，同时作为主校验），
 *   hiddenCode 为额外隐藏校验（lesson.hidden.spec.ts，不展示给用户，用于防作弊/强化验证）。
 * - jsdom：为 true 时向测试文件注入 `// @vitest-environment happy-dom`（React 组件测试）。
 * - onProgress：保留兼容字段（当前服务端一次性返回结果，不流式回调）。
 */
export interface RunOptions {
  userCode: string;
  userFileName?: string;
  testCode?: string;
  hiddenCode?: string;
  /** 是否运行在 happy-dom 环境（React 组件测试）：注入 @vitest-environment happy-dom 并使用 .tsx 文件 */
  jsdom?: boolean;
  /** 进度回调：保留兼容字段 */
  onProgress?: (chunk: string) => void;
  /** 额外写入沙箱的文件（如 vi.mock 所需的真实模块），键为相对文件名，值为内容 */
  extraFiles?: Record<string, string>;
}

/**
 * React Hook：供课时页面调用。
 */
export function useRealVitest() {
  const [isReady] = useState(true);

  const runCode = useCallback(async (opts: RunOptions): Promise<RunResult> => {
    const isTsx = !!opts.jsdom;
    const ext = isTsx ? 'tsx' : 'ts';
    // 服务端已安装 happy-dom，React 章节用它当环境（无需联网装 jsdom）
    const pragma = opts.jsdom ? '// @vitest-environment happy-dom\n\n' : '';
    const files: Record<string, string> = {};
    if (opts.testCode && opts.testCode.trim()) {
      // TDD 模式：用户编辑实现，可见测试由 grader 提供
      const userFile = opts.userFileName ?? `lesson.${ext}`;
      files[userFile] = opts.userCode;
      files[`lesson.spec.${ext}`] = pragma + opts.testCode;
      if (opts.hiddenCode && opts.hiddenCode.trim()) {
        files[`lesson.hidden.spec.${ext}`] = pragma + opts.hiddenCode;
      }
    } else {
      // 普通模式：用户编辑的即为测试文件
      files[`lesson.spec.${ext}`] = pragma + opts.userCode;
      if (opts.hiddenCode && opts.hiddenCode.trim()) {
        files[`lesson.hidden.spec.${ext}`] = pragma + opts.hiddenCode;
      }
    }
    // 额外文件（如 vi.mock 所需的真实模块文件）
    if (opts.extraFiles) {
      for (const [name, contents] of Object.entries(opts.extraFiles)) {
        files[name] = contents;
      }
    }
    return runVitest(files, !!opts.jsdom);
  }, []);

  return { runCode, isReady };
}
