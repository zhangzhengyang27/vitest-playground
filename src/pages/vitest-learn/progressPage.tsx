/**
 * 全局学习进度总览
 * 展示整体/分章进度、成就徽章，并支持重置与导出进度。
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Progress, Tag, message } from 'antd';
import {
  TrophyOutlined,
  ReloadOutlined,
  DownloadOutlined,
  CheckCircleTwoTone,
} from '@ant-design/icons';
import AppLayout from '../../components/AppLayout';
import { chapters } from './data';
import { isLessonPassed, clearProgress } from './progress';
import styles from './welcome.module.css';

const PROGRESS_KEY = 'vitest-playground-progress-v1';

const BADGES = [
  { id: 'first', name: '初次通关', desc: '完成首个课时' },
  { id: 'ten', name: '小有成效', desc: '完成 10 个课时' },
  { id: 'half', name: '渐入佳境', desc: '完成过半课时' },
  { id: 'chapter', name: '整章攻克', desc: '完整通关任意一章' },
  { id: 'master', name: '测试大师', desc: '通关全部课时' },
];

const ProgressPage: React.FC = () => {
  const navigate = useNavigate();
  const [version, setVersion] = useState(0);

  const { total, passed, perChapter, badges } = useMemo(() => {
    const perChapter = chapters.map((c) => {
      const done = c.lessons.filter((l) => isLessonPassed(c.key, l.key)).length;
      return {
        key: c.key,
        title: c.title,
        done,
        total: c.lessons.length,
        percent: c.lessons.length ? Math.round((done / c.lessons.length) * 100) : 0,
        allDone: done === c.lessons.length && c.lessons.length > 0,
      };
    });
    const total = perChapter.reduce((s, c) => s + c.total, 0);
    const passed = perChapter.reduce((s, c) => s + c.done, 0);
    const badges = BADGES.map((b) => ({
      ...b,
      ok:
        b.id === 'first'
          ? passed >= 1
          : b.id === 'ten'
            ? passed >= 10
            : b.id === 'half'
              ? passed >= Math.ceil(total / 2)
              : b.id === 'chapter'
                ? perChapter.some((c) => c.allDone)
                : passed >= total && total > 0,
    }));
    return { total, passed, perChapter, badges };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  const overallPercent = total ? Math.round((passed / total) * 100) : 0;

  const handleReset = () => {
    clearProgress();
    setVersion((v) => v + 1);
    message.success('学习进度已重置');
  };

  const handleExport = () => {
    const raw = localStorage.getItem(PROGRESS_KEY) ?? '{}';
    const blob = new Blob([raw], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vitest-playground-progress.json';
    a.click();
    URL.revokeObjectURL(url);
    message.success('进度已导出为 JSON');
  };

  return (
    <AppLayout>
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>学习进度总览</h2>
          <span className={styles.sectionHint}>
            已完成 {passed}/{total} 课时 · {overallPercent}%
          </span>
        </div>

        <div className={styles.totalProgress}>
          <Progress
            percent={overallPercent}
            strokeColor={{ '0%': '#2563eb', '100%': '#7c3aed' }}
          />
          <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button icon={<ReloadOutlined />} onClick={handleReset}>
              重置进度
            </Button>
            <Button icon={<DownloadOutlined />} onClick={handleExport}>
              导出进度
            </Button>
          </div>
        </div>

        {/* 成就徽章 */}
        <h3 style={{ margin: '28px 0 12px' }}>成就徽章</h3>
        <div className={styles.featureGrid}>
          {badges.map((b) => (
            <div
              key={b.id}
              className={styles.featureCard}
              style={{
                opacity: b.ok ? 1 : 0.55,
                borderColor: b.ok ? '#7c3aed' : undefined,
              }}
            >
              <span className={styles.featureIcon} style={{ color: b.ok ? '#7c3aed' : '#94a3b8' }}>
                {b.ok ? (
                  <CheckCircleTwoTone twoToneColor="#7c3aed" />
                ) : (
                  <TrophyOutlined />
                )}
              </span>
              <h3 className={styles.featureTitle}>{b.name}</h3>
              <p className={styles.featureDesc}>{b.desc}</p>
              <Tag color={b.ok ? 'success' : 'default'}>{b.ok ? '已获得' : '未解锁'}</Tag>
            </div>
          ))}
        </div>

        {/* 分章进度 */}
        <h3 style={{ margin: '28px 0 12px' }}>分章进度</h3>
        <div className={styles.chapterGrid}>
          {perChapter.map((c) => (
            <div
              key={c.key}
              className={styles.chapterCard}
              onClick={() => navigate(`/vitest-learn/${c.key}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && navigate(`/vitest-learn/${c.key}`)}
            >
              <div className={styles.chapterCardInfo}>
                <h3 className={styles.chapterTitle}>{c.title}</h3>
                <p className={styles.chapterDesc}>
                  已通关 {c.done}/{c.total}
                  {c.allDone && ' · 全部通关 🎉'}
                </p>
              </div>
              <div className={styles.chapterProgressRow}>
                <Progress
                  percent={c.percent}
                  size="small"
                  strokeColor={c.allDone ? '#7c3aed' : '#2563eb'}
                  showInfo={false}
                  className={styles.chapterProgress}
                />
                <span className={styles.chapterProgressText}>{c.percent}%</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </AppLayout>
  );
};

export default ProgressPage;
