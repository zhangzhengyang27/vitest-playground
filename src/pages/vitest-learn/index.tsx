/**
 * Vitest 学习平台 - 课程中心（主页）
 * 展示学习路径：Hero 区 + 搜索/标签筛选 + 章节卡片网格 + 学习特色。
 */
import { useMemo, useState } from 'react';
import {
  BookOutlined,
  ExperimentOutlined,
  TrophyOutlined,
  ThunderboltOutlined,
  ReadOutlined,
  FireOutlined,
  CheckCircleOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { Button, Progress, Tag, Input } from 'antd';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/AppLayout';
import { usePageMeta } from '../../usePageMeta';
import { chapters } from './data';
import { isLessonPassed } from './progress';
import styles from './welcome.module.css';

/** 各章节的图标色系（按章节顺序轮换） */
const CHAPTER_STYLES = [
  { icon: <ExperimentOutlined />, gradient: 'linear-gradient(135deg,#2563eb,#7c3aed)' },
  { icon: <ThunderboltOutlined />, gradient: 'linear-gradient(135deg,#059669,#0ea5e9)' },
  { icon: <ReadOutlined />, gradient: 'linear-gradient(135deg,#d97706,#f43f5e)' },
  { icon: <FireOutlined />, gradient: 'linear-gradient(135deg,#7c3aed,#db2777)' },
];

const FILTER_TAGS = ['全部', 'React', '异步', 'Mock', '快照', '覆盖率', '测试替身', 'TDD'];

const TAG_MAP: Record<string, string[]> = {
  'react-testing': ['React'],
  async: ['异步'],
  timers: ['异步'],
  mock: ['Mock'],
  'test-doubles': ['Mock', '测试替身'],
  'tdd-practice': ['TDD'],
  'tdd-advanced': ['TDD'],
  snapshot: ['快照'],
  'coverage-advanced': ['覆盖率'],
};

const FEATURES = [
  {
    icon: <ExperimentOutlined />,
    title: '浏览器内真实运行',
    desc: '无需安装环境，代码直接跑在真实 Vitest 上，结果即时反馈',
  },
  {
    icon: <ReadOutlined />,
    title: '循序渐进的学习路径',
    desc: '从断言语法到 TDD 实战，章节环环相扣，每个课时独立可练',
  },
  {
    icon: <TrophyOutlined />,
    title: '进度自动保存',
    desc: '学习进度与代码自动持久化，随时继续上次未完成的练习',
  },
];

const Welcome: React.FC = () => {
  usePageMeta();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState('全部');

  const stats = useMemo(() => {
    const totalLessons = chapters.reduce((s, c) => s + c.lessons.length, 0);
    const passed = chapters.reduce(
      (s, c) => s + c.lessons.filter((l) => isLessonPassed(c.key, l.key)).length,
      0,
    );
    return { chapters: chapters.length, totalLessons, passed };
  }, []);

  const percent = stats.totalLessons
    ? Math.round((stats.passed / stats.totalLessons) * 100)
    : 0;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return chapters.filter((c) => {
      const matchTag = activeTag === '全部' || (TAG_MAP[c.key] ?? []).includes(activeTag);
      const matchQuery =
        !q ||
        c.title.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.lessons.some((l) => l.title.toLowerCase().includes(q));
      return matchTag && matchQuery;
    });
  }, [query, activeTag]);

  return (
    <AppLayout>
      {/* ===== Hero ===== */}
      <section className={styles.hero}>
        <div className={styles.heroBadge}>
          <span className={styles.heroBadgeDot} />
          交互式 Vitest 教学平台
        </div>
        <h1 className={styles.heroTitle}>
          学会 <span className={styles.heroAccent}>Vitest</span>，从零到实战
        </h1>
        <p className={styles.heroSubtitle}>
          内置代码编辑器 + 浏览器内真实测试运行，边写边测、即时反馈，带你系统掌握前端测试。
        </p>
        <div className={styles.heroActions}>
          <Button
            type="primary"
            size="large"
            icon={<ThunderboltOutlined />}
            className={styles.heroCta}
            onClick={() => navigate(`/vitest-learn/${chapters[0]?.key}`)}
          >
            开始学习
          </Button>
          <Button
            size="large"
            className={styles.heroSecondary}
            onClick={() => {
              document.getElementById('chapters')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            浏览课程大纲
          </Button>
        </div>

        <div className={styles.heroStats}>
          <div className={styles.heroStat}>
            <span className={styles.heroStatValue}>{stats.chapters}</span>
            <span className={styles.heroStatLabel}>章 节</span>
          </div>
          <div className={styles.heroStatDivider} />
          <div className={styles.heroStat}>
            <span className={styles.heroStatValue}>{stats.totalLessons}</span>
            <span className={styles.heroStatLabel}>个课时</span>
          </div>
          <div className={styles.heroStatDivider} />
          <div className={styles.heroStat}>
            <span className={styles.heroStatValue}>{stats.passed}</span>
            <span className={styles.heroStatLabel}>已通关</span>
          </div>
        </div>
      </section>

      {/* ===== 课程大纲 + 搜索/筛选 ===== */}
      <section id="chapters" className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>课程大纲</h2>
          <span className={styles.sectionHint}>选择章节开始你的学习之旅</span>
        </div>

        <div className={styles.filterBar}>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="搜索章节或课时关键词"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={styles.searchInput}
          />
          <div className={styles.tagRow}>
            {FILTER_TAGS.map((t) => (
              <Tag.CheckableTag
                key={t}
                checked={activeTag === t}
                onChange={() => setActiveTag(t)}
                className={styles.filterTag}
              >
                {t}
              </Tag.CheckableTag>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className={styles.emptyHint}>没有匹配「{query || activeTag}」的章节，换个关键词试试。</p>
        ) : (
          <div className={styles.chapterGrid}>
            {filtered.map((chapter, ci) => {
              const chapterPassed = chapter.lessons.filter((l) =>
                isLessonPassed(chapter.key, l.key),
              ).length;
              const chapterPercent = chapter.lessons.length
                ? Math.round((chapterPassed / chapter.lessons.length) * 100)
                : 0;
              const style = CHAPTER_STYLES[ci % CHAPTER_STYLES.length];

              return (
                <div
                  key={chapter.key}
                  className={styles.chapterCard}
                  onClick={() => navigate(`/vitest-learn/${chapter.key}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(`/vitest-learn/${chapter.key}`)}
                >
                  <div className={styles.chapterCardTop}>
                    <span className={styles.chapterIcon} style={{ background: style.gradient }}>
                      {style.icon}
                    </span>
                    <div className={styles.chapterCardInfo}>
                      <h3 className={styles.chapterTitle}>{chapter.title}</h3>
                      <p className={styles.chapterDesc}>{chapter.description}</p>
                    </div>
                  </div>

                  <div className={styles.chapterCardMeta}>
                    <Tag className={styles.chapterLessonsTag}>
                      <BookOutlined /> {chapter.lessons.length} 个课时
                    </Tag>
                    {chapterPassed > 0 && (
                      <Tag color="success" className={styles.chapterPassedTag}>
                        <CheckCircleOutlined /> 已通关 {chapterPassed}
                      </Tag>
                    )}
                  </div>

                  <div className={styles.chapterProgressRow}>
                    <Progress
                      percent={chapterPercent}
                      size="small"
                      strokeColor="#2563eb"
                      showInfo={false}
                      className={styles.chapterProgress}
                    />
                    <span className={styles.chapterProgressText}>{chapterPercent}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {stats.totalLessons > 0 && (
          <div className={styles.totalProgress}>
            <div className={styles.totalProgressText}>
              <span>整体学习进度</span>
              <span>
                已完成 {stats.passed}/{stats.totalLessons} 课时
              </span>
            </div>
            <Progress percent={percent} strokeColor={{ '0%': '#2563eb', '100%': '#7c3aed' }} />
          </div>
        )}
      </section>

      {/* ===== 学习特色 ===== */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>学习特色</h2>
          <span className={styles.sectionHint}>为什么选择这套课程</span>
        </div>
        <div className={styles.featureGrid}>
          {FEATURES.map((f) => (
            <div key={f.title} className={styles.featureCard}>
              <span className={styles.featureIcon}>{f.icon}</span>
              <h3 className={styles.featureTitle}>{f.title}</h3>
              <p className={styles.featureDesc}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </AppLayout>
  );
};

export default Welcome;
