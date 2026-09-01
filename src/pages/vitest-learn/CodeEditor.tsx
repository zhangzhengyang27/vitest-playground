/**
 * 基于 Monaco 的代码编辑器（替换原 textarea + highlight.js 方案）
 * 提供：行号、语法高亮、自动补全、括号匹配、暗色主题、Ctrl/Cmd+Enter 运行。
 * 运行结果附带：逐用例耗时、覆盖率摘要、失败用例行内标记（Monaco markers）。
 */
import { useRef, useState, useEffect } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import './monacoSetup';
import { Button, Space, message, Progress } from 'antd';
import {
  PlayCircleOutlined,
  CopyOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import type { TestResult, ErrorMarker } from './types';
import { useTheme } from '../../theme';
import styles from './chapter.module.css';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
  result: TestResult;
  isReady?: boolean;
  fileName?: string;
  language?: 'typescript' | 'javascript';
  /** 只读模式（用于 TDD 课时的可见测试预览） */
  readOnly?: boolean;
  /** 失败用例在编辑器中的定位标记（普通模式：用户编辑测试文件时有效） */
  errorMarkers?: ErrorMarker[];
}

const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  onChange,
  onRun,
  result,
  isReady = true,
  fileName = 'test.ts',
  language = 'typescript',
  readOnly = false,
  errorMarkers,
}) => {
  const onRunRef = useRef(onRun);
  onRunRef.current = onRun;
  const [copied, setCopied] = useState(false);
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const { theme } = useTheme();
  const monacoTheme = theme === 'dark' ? 'vs-dark' : 'vs';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    message.success('代码已复制');
    setTimeout(() => setCopied(false), 2000);
  };

  // 失败用例行内标记：把 markers 写到当前模型，Monaco 会显示红色波浪线与 hover 信息
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;
    const model = editor.getModel();
    if (!model) return;
    if (!errorMarkers || errorMarkers.length === 0) {
      monaco.editor.setModelMarkers(model, 'vitest', []);
      return;
    }
    monaco.editor.setModelMarkers(
      model,
      'vitest',
      errorMarkers.map((m) => ({
        startLineNumber: m.line,
        startColumn: 1,
        endLineNumber: m.line,
        endColumn: 1000,
        message: m.message,
        severity: monaco.MarkerSeverity.Error,
      })),
    );
  }, [errorMarkers]);

  const getResultClass = () => {
    switch (result.status) {
      case 'success':
        return styles.resultSuccess;
      case 'error':
        return styles.resultError;
      default:
        return '';
    }
  };

  const getResultTitle = () => {
    switch (result.status) {
      case 'running':
        return '运行中...';
      case 'success':
        return (
          <>
            <CheckCircleOutlined /> 测试通过
          </>
        );
      case 'error':
        return '测试失败';
      default:
        return '测试结果';
    }
  };

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    if (readOnly) return;
    // Ctrl/Cmd + Enter 运行测试
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      onRunRef.current();
    });
  };

  const covColor = (v: number) => (v >= 80 ? '#34d399' : v >= 60 ? '#fbbf24' : '#f87171');

  return (
    <div className={styles.editorContainer}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <span className={styles.fileIcon}>📄</span>
          <span className={styles.toolbarTitle}>{fileName}</span>
          <span className={styles.langTag}>{language === 'typescript' ? 'TypeScript' : 'JavaScript'}</span>
          {readOnly && <span className={styles.readonlyTag}>只读</span>}
        </div>
        {!readOnly && (
          <Space>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={onRun}
              loading={result.status === 'running'}
              disabled={!isReady}
            >
              运行测试
            </Button>
            <Button icon={<CopyOutlined />} onClick={handleCopy}>
              {copied ? '已复制' : '复制'}
            </Button>
          </Space>
        )}
      </div>

      {/* Monaco 编辑器 */}
      <div className={styles.monacoWrap}>
        <Editor
          height={readOnly ? '240px' : '360px'}
          language={language}
          theme={monacoTheme}
          value={value}
          path={fileName}
          onChange={(v) => onChange(v ?? '')}
          onMount={handleMount}
          options={{
            readOnly,
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace",
            padding: { top: 12, bottom: 12 },
            renderLineHighlight: 'line',
            smoothScrolling: true,
          }}
        />
      </div>

      {/* Result Panel（只读预览不展示结果） */}
      {!readOnly && (
        <div className={`${styles.resultPanel} ${getResultClass()}`}>
          <div className={styles.resultHeader}>
            <span className={styles.resultTitle}>{getResultTitle()}</span>
            {result.duration && (
              <span className={styles.resultDuration}>{result.duration}</span>
            )}
            {result.passed !== undefined && result.failed !== undefined && (
              <span className={styles.resultStats}>
                <span className={styles.statPassed}>通过 {result.passed}</span>
                {result.failed > 0 && <span className={styles.statFailed}>失败 {result.failed}</span>}
              </span>
            )}
          </div>
          <pre className={styles.resultOutput}>
            {result.output || '点击"运行测试"查看结果（首次运行需联网安装依赖）'}
          </pre>

          {/* 覆盖率摘要 */}
          {result.coverage && (
            <div style={{ marginTop: 12, padding: '12px 14px', background: '#0b1020', borderRadius: 8, border: '1px solid #1f2937' }}>
              <div style={{ fontWeight: 600, marginBottom: 8, color: '#e5e7eb' }}>覆盖率（整体）</div>
              {(['lines', 'branches', 'functions'] as const).map((k) => (
                <div key={k} style={{ marginBottom: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#cbd5e1' }}>
                    <span>{k === 'lines' ? '行' : k === 'branches' ? '分支' : '函数'}</span>
                    <span>{Math.round(result.coverage!.total[k])}%</span>
                  </div>
                  <Progress
                    percent={Math.round(result.coverage!.total[k])}
                    showInfo={false}
                    size="small"
                    strokeColor={covColor(result.coverage!.total[k])}
                  />
                </div>
              ))}
              {result.coverage.files.length > 1 && (
                <div style={{ marginTop: 8, color: '#94a3b8', fontSize: 12, lineHeight: 1.8 }}>
                  {result.coverage.files.map((f) => (
                    <span key={f.file} style={{ marginRight: 12 }}>
                      {f.file}: <span style={{ color: covColor(f.lines) }}>{Math.round(f.lines)}%</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 逐用例耗时 */}
          {result.tests && result.tests.length > 0 && (
            <div style={{ marginTop: 12 }}>
              {result.tests.map((t, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '4px 0',
                    borderBottom: '1px solid #1f2937',
                    color:
                      t.status === 'failed'
                        ? '#f87171'
                        : t.status === 'passed'
                          ? '#34d399'
                          : '#9ca3af',
                    fontSize: 13,
                  }}
                >
                  <span>
                    {t.status === 'passed' ? '✓' : t.status === 'failed' ? '✗' : t.status === 'skipped' ? '○' : '·'}{' '}
                    {t.name}
                  </span>
                  <span>{typeof t.duration === 'number' ? `${Math.round(t.duration)}ms` : ''}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CodeEditor;
