/**
 * Vitest 学习平台 - 章节学习工作台
 * 布局：面包屑 + 章节总览 + 左侧课时导航（sticky）+ 右侧学习内容（信息分区）。
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePageMeta } from '../../usePageMeta';
import {
  Button,
  Space,
  message,
  Alert,
  Tag,
  Typography,
  Progress,
  Breadcrumb,
  Switch,
  Tabs,
} from 'antd';
import {
  LeftOutlined,
  RightOutlined,
  BulbOutlined,
  CheckCircleOutlined,
  ThunderboltOutlined,
  ReloadOutlined,
  ExperimentOutlined,
  TrophyOutlined,
  DownloadOutlined,
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
import AppLayout from '../../components/AppLayout';
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

  // 逐路由 SEO：动态设置页面标题（如「第三章：Mock 与 Stub | Vitest 可视化学习平台」）
  usePageMeta(
    currentLesson?.title ? `${currentLesson.title} | Vitest 可视化学习平台` : undefined,
  );
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
  const [autoRun, setAutoRun] = useState(false);

  // 章节整体进度
  const chapterPassedCount = chapter
    ? chapter.lessons.filter((l) => isLessonPassed(chapter.key, l.key)).length
    : 0;
  const chapterPercent = chapter?.lessons.length
    ? Math.round((chapterPassedCount / chapter.lessons.length) * 100)
    : 0;

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

  const handleExport = useCallback(() => {
    const content = showSolution && currentLesson?.solution ? currentLesson.solution : code;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = editorFileName;
    a.click();
    URL.revokeObjectURL(url);
  }, [code, showSolution, currentLesson, editorFileName]);

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
          extraFiles: currentLesson.extraFiles,
          coverage: !currentLesson.benchmark,
          benchmark: !!currentLesson.benchmark,
        }
      : {
          userCode: codeToRun,
          hiddenCode: currentLesson.grader,
          jsdom: isJsdom,
          extraFiles: currentLesson.extraFiles,
          coverage: !currentLesson.benchmark,
          benchmark: !!currentLesson.benchmark,
        };

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
            tests: runResult.tests,
            markers: runResult.markers,
            coverage: runResult.coverage,
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
            tests: runResult.tests,
            markers: runResult.markers,
            coverage: runResult.coverage,
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

  // 自动重跑（watch 体验替代）：代码停止输入 1.2s 后自动运行
  const handleRunTestRef = useRef(handleRunTest);
  handleRunTestRef.current = handleRunTest;
  useEffect(() => {
    if (!autoRun) return;
    const t = window.setTimeout(() => handleRunTestRef.current(), 1200);
    return () => window.clearTimeout(t);
  }, [code, autoRun]);

  if (!chapter) {
    return (
      <AppLayout>
        <div className={styles.notFound}>
          <h2>章节未找到</h2>
          <Button type="primary" onClick={() => navigate('/')}>
            返回首页
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* ===== 面包屑 ===== */}
      <Breadcrumb
        className={styles.breadcrumb}
        items={[
          { title: <a onClick={() => navigate('/')}>课程中心</a> },
          { title: chapter.title },
          { title: currentLesson?.title },
        ]}
      />

      {/* ===== 章节总览 ===== */}
      <section className={styles.chapterOverview}>
        <div className={styles.chapterOverviewLeft}>
          <h1 className={styles.chapterTitle}>{chapter.title}</h1>
          <p className={styles.chapterDesc}>{chapter.description}</p>
          <div className={styles.chapterTags}>
            <Tag icon={<ExperimentOutlined />} className={styles.chapterTag}>
              {chapter.lessons.length} 个课时
            </Tag>
            <Tag
              icon={<TrophyOutlined />}
              color={chapterPassedCount === chapter.lessons.length ? 'success' : 'default'}
              className={styles.chapterTag}
            >
              {chapterPassedCount}/{chapter.lessons.length} 已通关
            </Tag>
          </div>
        </div>
        <div className={styles.chapterOverviewRight}>
          <Progress
            type="circle"
            percent={chapterPercent}
            size={72}
            strokeColor={{ '0%': '#2563eb', '100%': '#7c3aed' }}
          />
        </div>
      </section>

      {/* ===== 工作台：左侧课时导航 + 右侧学习内容 ===== */}
      <div className={styles.workbench}>
        {/* 左侧课时导航 */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <span className={styles.sidebarTitle}>课时进度</span>
            <span className={styles.sidebarCount}>
              {chapterPassedCount}/{chapter.lessons.length}
            </span>
          </div>
          <Progress
            percent={chapterPercent}
            size="small"
            strokeColor="#2563eb"
            className={styles.sidebarProgress}
            showInfo={false}
          />
          <div className={styles.lessonList}>
            {chapter.lessons.map((lesson, index) => {
              const passed = isLessonPassed(chapter.key, lesson.key);
              const active = lesson.key === effectiveLessonKey;
              return (
                <div
                  key={lesson.key}
                  className={`${styles.lessonItem} ${active ? styles.lessonItemActive : ''}`}
                  onClick={() => navigate(`/vitest-learn/${chapter.key}/${lesson.key}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) =>
                    e.key === 'Enter' && navigate(`/vitest-learn/${chapter.key}/${lesson.key}`)
                  }
                >
                  <span
                    className={`${styles.lessonIndex} ${
                      passed ? styles.lessonIndexPassed : ''
                    } ${active ? styles.lessonIndexActive : ''}`}
                  >
                    {passed ? <CheckCircleOutlined /> : index + 1}
                  </span>
                  <span className={styles.lessonItemTitle}>{lesson.title}</span>
                  {active && <RightOutlined className={styles.lessonItemArrow} />}
                </div>
              );
            })}
          </div>
        </aside>

        {/* 右侧学习内容 */}
        <main className={styles.content}>
          {currentLesson && (
            <>
              {/* 课时信息 */}
              <section className={styles.lessonInfo}>
                <div className={styles.lessonInfoHead}>
                  <h2 className={styles.lessonTitle}>{currentLesson.title}</h2>
                  <div className={styles.lessonBadges}>
                    {isTDD && (
                      <Tag color="gold" className={styles.lessonBadge}>
                        TDD 实战
                      </Tag>
                    )}
                    {isJsdom && (
                      <Tag color="geekblue" className={styles.lessonBadge}>
                        React + jsdom
                      </Tag>
                    )}
                    {!isJsdom && (
                      <Tag className={styles.lessonBadge}>Node 环境</Tag>
                    )}
                  </div>
                </div>
                <p className={styles.lessonDesc}>{currentLesson.description}</p>
              </section>

              {/* 学习提示 */}
              {currentLesson.tips && currentLesson.tips.length > 0 && (
                <Alert
                  type="info"
                  icon={<BulbOutlined />}
                  showIcon
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

              {/* 知识小测 */}
              {currentLesson.quiz && currentLesson.quiz.length > 0 && (
                <QuizCard quizzes={currentLesson.quiz} />
              )}

              {/* 代码练习区 */}
              <section className={styles.practiceCard}>
                <div className={styles.practiceHeader}>
                  <span className={styles.practiceIcon}>
                    <ThunderboltOutlined />
                  </span>
                  <div>
                    <h3 className={styles.practiceTitle}>动手练习</h3>
                    <p className={styles.practiceDesc}>
                      {isTDD
                        ? '下面是已给定的测试用例（只读），请在编辑器中实现让它们全部通过。'
                        : '在编辑器中编写测试代码，点击「运行测试」验证结果。'}
                    </p>
                  </div>
                </div>

                {/* TDD 模式：展示可见测试（只读） */}
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

                {/* 代码编辑器 */}
                <CodeEditor
                  value={showSolution && currentLesson?.solution ? currentLesson.solution : code}
                  onChange={handleCodeChange}
                  onRun={handleRunTest}
                  result={result}
                  isReady={isReady}
                  fileName={editorFileName}
                  errorMarkers={!isTDD ? result.markers : undefined}
                />

                {/* 操作区 */}
                {/* 真实模块（只读）：vi.mock 等依赖的源文件，可切换查看 */}
                {currentLesson?.extraFiles && Object.keys(currentLesson.extraFiles).length > 0 && (
                  <Tabs
                    defaultActiveKey={Object.keys(currentLesson.extraFiles)[0]}
                    items={Object.entries(currentLesson.extraFiles).map(([name, content]) => ({
                      key: name,
                      label: name,
                      children: (
                        <CodeEditor
                          value={content}
                          fileName={name}
                          language="typescript"
                          readOnly
                          onChange={() => {}}
                          onRun={() => {}}
                          result={{ status: 'idle', output: '' }}
                          isReady={isReady}
                        />
                      ),
                    }))}
                  />
                )}

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
                    <Button icon={<DownloadOutlined />} onClick={handleExport}>
                      导出代码
                    </Button>
                    <Switch
                      checkedChildren="自动运行"
                      unCheckedChildren="手动"
                      checked={autoRun}
                      onChange={setAutoRun}
                    />
                  </Space>
                  <Text type="secondary" className={styles.solutionHint}>
                    （先自己尝试，再看答案效果更好）
                  </Text>
                </div>
              </section>

              {/* 上下课时导航 */}
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
                <span className={styles.navigationCenter}>
                  {currentLessonIndex + 1} / {chapter.lessons.length}
                </span>
                <Button
                  type={currentLessonIndex >= chapter.lessons.length - 1 ? 'default' : 'primary'}
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
            </>
          )}
        </main>
      </div>
    </AppLayout>
  );
};

export default LessonPage;
