/**
 * Vitest 学习平台 - 章节详情页面
 * 包含代码编辑器和测试运行功能
 */
import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Space, message, Alert, Tag, Divider, Typography, Card, Row, Col } from 'antd';
import {
  PlayCircleOutlined,
  LeftOutlined,
  RightOutlined,
  BulbOutlined,
  CheckCircleOutlined,
  CopyOutlined,
  ThunderboltOutlined,
  BookOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { chapters } from './data';
import { useCodeExecution } from './sandbox';
import styles from './chapter.module.css';

// 动态导入 highlight.js
let hljs: typeof import('highlight.js').default | null = null;

const { Paragraph, Text } = Typography;

interface TestResult {
  status: 'idle' | 'running' | 'success' | 'error';
  output: string;
  duration?: string;
  passed?: number;
  failed?: number;
}

const CodeEditor: React.FC<{
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
  result: TestResult;
  isReady?: boolean;
}> = ({ value, onChange, onRun, result, isReady = true }) => {
  const [copied, setCopied] = useState(false);
  const [highlightedCode, setHighlightedCode] = useState('');
  const [hljsReady, setHljsReady] = useState(false);

  // 初始化 highlight.js
  useEffect(() => {
    import('highlight.js').then((module) => {
      hljs = module.default;
      hljs.configure({ ignoreUnescapedHTML: true });
      setHljsReady(true);
    });
  }, []);

  // 语法高亮
  useEffect(() => {
    if (hljsReady && value && hljs) {
      const highlighted = hljs.highlight(value, { language: 'javascript' });
      setHighlightedCode(highlighted.value);
    }
  }, [value, hljsReady]);

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

  return (
    <div className={styles.editorContainer}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <span className={styles.fileIcon}>📄</span>
          <span className={styles.toolbarTitle}>test.ts</span>
          <span className={styles.langTag}>TypeScript</span>
        </div>
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
      </div>

      {/* Code Input */}
      <div className={styles.codeInput}>
        <pre className={styles.codePre}>
          <code
            className={`hljs language-javascript ${styles.codeContent}`}
            dangerouslySetInnerHTML={{ __html: highlightedCode || value }}
          />
        </pre>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={styles.codeTextarea}
          spellCheck={false}
          placeholder="在此输入代码..."
          onKeyDown={(e) => {
            if (e.key === 'Tab') {
              e.preventDefault();
              const start = e.currentTarget.selectionStart;
              const end = e.currentTarget.selectionEnd;
              const newValue = value.substring(0, start) + '  ' + value.substring(end);
              onChange(newValue);
              setTimeout(() => {
                e.currentTarget.selectionStart = e.currentTarget.selectionEnd = start + 2;
              }, 0);
            }
          }}
        />
      </div>

      {/* Result Panel */}
      <div className={`${styles.resultPanel} ${getResultClass()}`}>
        <div className={styles.resultHeader}>
          <span className={styles.resultTitle}>{getResultTitle()}</span>
          {result.duration && (
            <span className={styles.resultDuration}>{result.duration}</span>
          )}
          {result.passed !== undefined && result.failed !== undefined && (
            <span className={styles.resultStats}>
              <Tag color="success">{result.passed} 通过</Tag>
              {result.failed > 0 && <Tag color="error">{result.failed} 失败</Tag>}
            </span>
          )}
        </div>
        <pre className={styles.resultOutput}>
          {result.output || '点击"运行测试"查看结果'}
        </pre>
      </div>
    </div>
  );
};

const LessonPage: React.FC = () => {
  const params = useParams<{ chapterKey: string; lessonKey?: string }>();
  const { chapterKey, lessonKey } = params;
  const navigate = useNavigate();
  const { runCode, isReady } = useCodeExecution();

  const chapter = chapters.find((c) => c.key === chapterKey);
  // 如果没有 lessonKey，使用第一个课时
  const effectiveLessonKey = lessonKey || chapter?.lessons[0]?.key;
  const currentLessonIndex = chapter?.lessons.findIndex((l) => l.key === effectiveLessonKey) ?? 0;
  const currentLesson = chapter?.lessons[currentLessonIndex];

  const [code, setCode] = useState(currentLesson?.code || '');
  const [result, setResult] = useState<TestResult>({ status: 'idle', output: '' });
  const [showSolution, setShowSolution] = useState(false);

  // 当切换课时时重置状态
  useEffect(() => {
    const lesson = chapter?.lessons.find((l) => l.key === effectiveLessonKey);
    setCode(lesson?.code || '');
    setResult({ status: 'idle', output: '' });
    setShowSolution(false);
  }, [effectiveLessonKey, chapter]);

  const handleRunTest = useCallback(() => {
    setResult({ status: 'running', output: '正在编译运行...' });

    const codeToRun = showSolution && currentLesson?.solution
      ? currentLesson.solution
      : code;

    runCode(codeToRun).then((runResult) => {
      if (runResult.success) {
        setResult({
          status: 'success',
          output: runResult.output || `✓ 通过 ${runResult.passed} 个测试`,
          duration: `${runResult.passed + runResult.failed}ms`,
          passed: runResult.passed,
          failed: runResult.failed,
        });
        message.success('测试全部通过！');
      } else {
        setResult({
          status: 'error',
          output: runResult.output || runResult.error || '测试失败',
          duration: '0ms',
          passed: runResult.passed || 0,
          failed: runResult.failed || 1,
        });
        message.error('有测试未通过');
      }
    }).catch((err) => {
      setResult({
        status: 'error',
        output: `运行错误: ${err.message}`,
        duration: '0ms',
        passed: 0,
        failed: 1,
      });
    });
  }, [code, showSolution, currentLesson, runCode]);

  if (!chapter) {
    return (
      <Card>
        <div className={styles.notFound}>
          <h2>章节未找到</h2>
          <Button type="primary" onClick={() => navigate('/vitest-learn')}>
            返回首页
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className={styles.pageContainer}>
      {/* Header */}
      <div className={styles.header}>
        <Button
          type="text"
          icon={<LeftOutlined />}
          onClick={() => navigate('/vitest-learn')}
          className={styles.backButton}
        >
          返回目录
        </Button>
        <div className={styles.headerContent}>
          <div className={styles.headerIcon}>
            <BookOutlined />
          </div>
          <div className={styles.headerTitle}>
            <h1>{chapter.title}</h1>
            <p>{chapter.description}</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className={styles.mainContent}>
        <Row gutter={24}>
          {/* 左侧：课时列表 */}
          <Col xs={24} lg={8}>
            <div className={styles.lessonListPanel}>
              <h3 className={styles.lessonListTitle}>
                <FileTextOutlined /> 课时列表
              </h3>
              <div className={styles.lessonList}>
                {chapter.lessons.map((lesson, index) => (
                  <Card
                    key={lesson.key}
                    className={`${styles.lessonCard} ${lesson.key === effectiveLessonKey ? styles.lessonCardActive : ''}`}
                    size="small"
                    hoverable
                    onClick={() => navigate(`/vitest-learn/${chapter.key}/${lesson.key}`)}
                  >
                    <div className={styles.lessonCardContent}>
                      <span className={styles.lessonNumber}>{index + 1}</span>
                      <span className={styles.lessonCardTitle}>{lesson.title}</span>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </Col>

          {/* 右侧：学习内容 + 代码编辑器 */}
          <Col xs={24} lg={16}>
            <div className={styles.editorPanel}>
              {/* 当前课时信息 */}
              {currentLesson && (
                <>
                  <div className={styles.currentLessonInfo}>
                    <h2 className={styles.lessonTitle}>{currentLesson.title}</h2>
                    <p className={styles.lessonDesc}>{currentLesson.description}</p>
                  </div>

                  {/* Tips */}
                  {currentLesson.tips && currentLesson.tips.length > 0 && (
                    <Alert
                      type="info"
                      icon={<BulbOutlined />}
                      title="学习提示"
                      className={styles.tips}
                      description={
                        <ul className={styles.tipsList}>
                          {currentLesson.tips.map((tip, i) => (
                            <li key={i}>{tip}</li>
                          ))}
                        </ul>
                      }
                    />
                  )}
                </>
              )}

              {/* 代码编辑器 */}
              <CodeEditor
                value={showSolution && currentLesson?.solution ? currentLesson.solution : code}
                onChange={setCode}
                onRun={handleRunTest}
                result={result}
                isReady={isReady}
              />

              {/* Solution Toggle */}
              {currentLesson?.solution && (
                <div className={styles.solutionToggle}>
                  <Button
                    type="primary"
                    ghost={!showSolution}
                    icon={<ThunderboltOutlined />}
                    onClick={() => setShowSolution(!showSolution)}
                  >
                    {showSolution ? '隐藏参考答案' : '查看参考答案'}
                  </Button>
                  <Text type="secondary" className={styles.solutionHint}>
                    （先自己尝试，再看答案效果更好）
                  </Text>
                </div>
              )}

              {/* Navigation */}
              <div className={styles.navigation}>
                <Button
                  icon={<LeftOutlined />}
                  disabled={currentLessonIndex <= 0}
                  onClick={() => {
                    const prevLesson = chapter.lessons[currentLessonIndex - 1];
                    if (prevLesson) {
                      navigate(`/vitest-learn/${chapter.key}/${prevLesson.key}`);
                    }
                  }}
                >
                  上一节
                </Button>

                <Tag color="blue" className={styles.progressTag}>
                  {currentLessonIndex + 1} / {chapter.lessons.length}
                </Tag>

                <Button
                  icon={<RightOutlined />}
                  disabled={currentLessonIndex >= chapter.lessons.length - 1}
                  onClick={() => {
                    const nextLesson = chapter.lessons[currentLessonIndex + 1];
                    if (nextLesson) {
                      navigate(`/vitest-learn/${chapter.key}/${nextLesson.key}`);
                    }
                  }}
                >
                  下一节
                </Button>
              </div>
            </div>
          </Col>
        </Row>
      </div>

      {/* Chapter Progress */}
      <Divider className={styles.divider} />
      <div className={styles.chapterProgress}>
        <Text type="secondary" className={styles.progressLabel}>本章进度：</Text>
        <div className={styles.progressTags}>
          {chapter.lessons.map((lesson, index) => (
            <Tag
              key={lesson.key}
              color={lesson.key === effectiveLessonKey ? 'blue' : 'default'}
              className={styles.progressTagItem}
              onClick={() => navigate(`/vitest-learn/${chapter.key}/${lesson.key}`)}
            >
              <span className={styles.lessonIndex}>{index + 1}</span>
              {lesson.title}
            </Tag>
          ))}
        </div>
      </div>
    </Card>
  );
};

export default LessonPage;
