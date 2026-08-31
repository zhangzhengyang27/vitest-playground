/**
 * Vitest 学习平台 - 章节详情页面
 * 包含：Monaco 代码编辑器 + 真实 Vitest 运行 + 进度持久化 + 知识小测。
 */
import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Space, message, Alert, Tag, Divider, Typography, Card, Row, Col } from 'antd';
import {
  LeftOutlined,
  RightOutlined,
  BulbOutlined,
  CheckCircleOutlined,
  ThunderboltOutlined,
  BookOutlined,
  FileTextOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { chapters } from './data';
import { useRealVitest, type RunOptions } from './runner';
import CodeEditor from './CodeEditor';
import QuizCard from './Quiz';
import {
  getLessonProgress,
  setLessonProgress,
  isLessonPassed,
} from './progress';
import type { TestResult } from './types';
import styles from './chapter.module.css';

const { Text } = Typography;

const LessonPage: React.FC = () => {
  const params = useParams<{ chapterKey: string; lessonKey?: string }>();
  const { chapterKey, lessonKey } = params;
  const navigate = useNavigate();
  const { runCode, isReady } = useRealVitest();

  const chapter = chapters.find((c) => c.key === chapterKey);
  // 如果没有 lessonKey，使用第一个课时
  const effectiveLessonKey = lessonKey || chapter?.lessons[0]?.key;
  const currentLessonIndex = chapter?.lessons.findIndex((l) => l.key === effectiveLessonKey) ?? 0;
  const currentLesson = chapter?.lessons[currentLessonIndex];
  // TDD 课时：存在 grader（可见测试）即进入 TDD 模式，用户编辑实现，测试由 grader 提供
  const isTDD = !!currentLesson?.grader;
  // jsdom 课时（React 组件测试）：用户编辑 .tsx 组件，测试文件为 .spec.tsx
  const isJsdom = currentLesson?.environment === 'jsdom';
  const editorFileName = isTDD
    ? isJsdom ? 'lesson.tsx' : 'lesson.ts'
    : 'lesson.spec.ts';
  const graderFileName = isJsdom ? 'lesson.spec.tsx' : 'lesson.spec.ts';

  const [code, setCode] = useState(currentLesson?.code || '');
  const [result, setResult] = useState<TestResult>({ status: 'idle', output: '' });
  const [showSolution, setShowSolution] = useState(false);

  // 当切换课时时：恢复已保存代码 / 重置状态
  useEffect(() => {
    const lesson = chapter?.lessons.find((l) => l.key === effectiveLessonKey);
    const saved = chapterKey && effectiveLessonKey
      ? getLessonProgress(chapterKey, effectiveLessonKey).code
      : undefined;
    setCode(saved ?? lesson?.code ?? '');
    setResult({ status: 'idle', output: '' });
    setShowSolution(false);
  }, [effectiveLessonKey, chapterKey, chapter]);

  const handleCodeChange = useCallback(
    (value: string) => {
      setCode(value);
      if (chapterKey && effectiveLessonKey) {
        setLessonProgress(chapterKey, effectiveLessonKey, { code: value });
      }
    },
    [chapterKey, effectiveLessonKey],
  );

  const handleReset = useCallback(() => {
    setCode(currentLesson?.code ?? '');
    if (chapterKey && effectiveLessonKey) {
      setLessonProgress(chapterKey, effectiveLessonKey, { code: currentLesson?.code ?? '' });
    }
    message.info('已重置为初始代码');
  }, [currentLesson, chapterKey, effectiveLessonKey]);

  const handleRunTest = useCallback(() => {
    if (!chapterKey || !effectiveLessonKey || !currentLesson) return;
    setResult({ status: 'running', output: '准备运行环境...\n' });

    const codeToRun = showSolution && currentLesson?.solution
      ? currentLesson.solution
      : code;

    const runOpts: RunOptions = isTDD
      ? {
          userCode: codeToRun,
          userFileName: isJsdom ? 'lesson.tsx' : 'lesson.ts',
          testCode: currentLesson.grader ?? '',
          hiddenCode: currentLesson.hiddenGrader,
          jsdom: isJsdom,
        }
      : { userCode: codeToRun, hiddenCode: currentLesson.grader, jsdom: isJsdom };

    // 实时回传安装/运行进度，避免一直停留在一句话
    runOpts.onProgress = (chunk: string) => {
      setResult((r) => ({ ...r, output: r.output + chunk }));
    };

    runCode(runOpts)
      .then((runResult) => {
        if (runResult.success) {
          setResult({
            status: 'success',
            output: runResult.output,
            passed: runResult.passed,
            failed: runResult.failed,
          });
          setLessonProgress(chapterKey, effectiveLessonKey, {
            status: 'passed',
            lastRunAt: Date.now(),
          });
          message.success('测试全部通过！');
        } else {
          setResult({
            status: 'error',
            output: runResult.output,
            passed: runResult.passed || 0,
            failed: runResult.failed || 1,
          });
          message.error('有测试未通过');
        }
      })
      .catch((err: Error) => {
        setResult({
          status: 'error',
          output: `运行错误: ${err.message}`,
          passed: 0,
          failed: 1,
        });
      });
  }, [code, showSolution, currentLesson, isTDD, runCode, chapterKey, effectiveLessonKey]);

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
                {chapter.lessons.map((lesson, index) => {
                  const passed = isLessonPassed(chapter.key, lesson.key);
                  return (
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
                        {passed && (
                          <CheckCircleOutlined className={styles.lessonPassedIcon} />
                        )}
                      </div>
                    </Card>
                  );
                })}
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

                  {/* 知识小测（M5） */}
                  {currentLesson.quiz && currentLesson.quiz.length > 0 && (
                    <QuizCard quizzes={currentLesson.quiz} />
                  )}
                </>
              )}

              {/* TDD 模式：展示可见测试（只读），用户据此实现 */}
              {isTDD && currentLesson.grader && (
                <div className={styles.tddTestHint}>
                  📋 下面是已给定的测试用例（只读）。请在下方编辑实现，让它们全部通过：
                </div>
              )}
              {isTDD && currentLesson.grader && (
                <CodeEditor
                  value={currentLesson.grader}
                  fileName={graderFileName}
                  language="typescript"
                  readOnly
                  onChange={() => {}}
                  onRun={() => {}}
                  result={{ status: 'idle', output: '' }}
                  isReady={isReady}
                />
              )}

              {/* 代码编辑器（M1：Monaco） */}
              <CodeEditor
                value={showSolution && currentLesson?.solution ? currentLesson.solution : code}
                onChange={handleCodeChange}
                onRun={handleRunTest}
                result={result}
                isReady={isReady}
                fileName={editorFileName}
              />

              {/* Solution / Reset Toggle */}
              <div className={styles.solutionToggle}>
                <Space wrap>
                  <Button
                    type="primary"
                    ghost={!showSolution}
                    icon={<ThunderboltOutlined />}
                    onClick={() => setShowSolution(!showSolution)}
                  >
                    {showSolution ? '隐藏参考答案' : '查看参考答案'}
                  </Button>
                  <Button icon={<ReloadOutlined />} onClick={handleReset}>
                    重置代码
                  </Button>
                </Space>
                <Text type="secondary" className={styles.solutionHint}>
                  （先自己尝试，再看答案效果更好）
                </Text>
              </div>

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
          {chapter.lessons.map((lesson, index) => {
            const passed = isLessonPassed(chapter.key, lesson.key);
            return (
              <Tag
                key={lesson.key}
                color={passed ? 'success' : lesson.key === effectiveLessonKey ? 'blue' : 'default'}
                className={styles.progressTagItem}
                onClick={() => navigate(`/vitest-learn/${chapter.key}/${lesson.key}`)}
              >
                <span className={styles.lessonIndex}>{index + 1}</span>
                {passed && '✓ '}
                {lesson.title}
              </Tag>
            );
          })}
        </div>
      </div>
    </Card>
  );
};

export default LessonPage;
