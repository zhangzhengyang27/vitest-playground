/**
 * 基于 Monaco 的代码编辑器（替换原 textarea + highlight.js 方案）
 * 提供：行号、语法高亮、自动补全、括号匹配、暗色主题、Ctrl/Cmd+Enter 运行。
 */
import { useRef, useState } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import './monacoSetup';
import { Button, Space, message } from 'antd';
import {
  PlayCircleOutlined,
  CopyOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import type { TestResult } from './types';
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
}) => {
  const onRunRef = useRef(onRun);
  onRunRef.current = onRun;
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    message.success('代码已复制');
    setTimeout(() => setCopied(false), 2000);
  };

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
    if (readOnly) return;
    // Ctrl/Cmd + Enter 运行测试
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      onRunRef.current();
    });
  };

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
          theme="vs-dark"
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
        </div>
      )}
    </div>
  );
};

export default CodeEditor;
