/**
 * Monaco 本地打包配置（仅 TS/JS，按需裁剪其余语言以大幅减小产物体积）。
 * 平台只用 TypeScript/JavaScript 编辑器，因此只引入编辑器内核 +
 * typescript 语言贡献，不再打包 json/css/html 等用不到的语言与 worker。
 */
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import 'monaco-editor/esm/vs/basic-languages/typescript/typescript.contribution';
import 'monaco-editor/esm/vs/language/typescript/monaco.contribution';
import { loader } from '@monaco-editor/react';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';
import { VITEST_GLOBALS_DTS } from './vitestGlobalsDts';

self.MonacoEnvironment = {
  getWorker(_workerId, label) {
    if (label === 'typescript' || label === 'javascript') return new tsWorker();
    return new editorWorker();
  },
};

// 兜底：monaco TS worker 在模型被异步回收/切换时偶尔会抛
// "Could not find source file: 'inmemory://...'"，
// 这是 monaco-editor 已知的 race condition（HMR / 课时切换时尤为常见），
// 不影响编辑器功能，吞掉就行。
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reason: any = event.reason;
    if (
      reason &&
      typeof reason.message === 'string' &&
      reason.message.startsWith("Could not find source file: 'inmemory://")
    ) {
      event.preventDefault();
    }
  });
}

loader.config({ monaco });

// === 让 Monaco 认识 vitest 全局与课程里常用的模块，避免编辑器爆红 ===
monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
  target: monaco.languages.typescript.ScriptTarget.ESNext,
  module: monaco.languages.typescript.ModuleKind.ESNext,
  moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
  strict: true,
  skipLibCheck: true,
  esModuleInterop: true,
  allowSyntheticDefaultImports: true,
  jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
  lib: ['esnext', 'dom'],
  noEmit: true,
  allowJs: true,
  resolveJsonModule: true,
});
monaco.languages.typescript.typescriptDefaults.addExtraLib(
  VITEST_GLOBALS_DTS,
  'inmemory://model/vitest-globals.d.ts',
);
// React/jsx 章节也用相同声明
monaco.languages.typescript.javascriptDefaults.addExtraLib(
  VITEST_GLOBALS_DTS,
  'inmemory://model/vitest-globals.d.ts',
);
