/**
 * 全局应用布局：顶部导航 + 全局进度 + 内容容器。
 * 所有页面通过该布局获得统一的品牌头部、导航和页面骨架。
 */
import { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Progress, Tag } from 'antd';
import { ThunderboltOutlined, HomeOutlined, ReadOutlined } from '@ant-design/icons';
import { chapters } from '../pages/vitest-learn/data';
import { isLessonPassed } from '../pages/vitest-learn/progress';
import styles from './appLayout.module.css';

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const inChapter = location.pathname.startsWith('/vitest-learn/');

  const total = useMemo(
    () => chapters.reduce((sum, c) => sum + c.lessons.length, 0),
    [],
  );
  const passed = useMemo(
    () =>
      chapters.reduce(
        (sum, c) => sum + c.lessons.filter((l) => isLessonPassed(c.key, l.key)).length,
        0,
      ),
    [],
  );
  const percent = total ? Math.round((passed / total) * 100) : 0;

  return (
    <div className={styles.layout}>
      <header className={styles.topbar}>
        <div className={styles.topbarInner}>
          <div
            className={styles.brand}
            onClick={() => navigate('/')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && navigate('/')}
          >
            <span className={styles.brandIcon}>
              <ThunderboltOutlined />
            </span>
            <span className={styles.brandName}>Vitest 实验室</span>
          </div>

          <nav className={styles.nav}>
            <span
              className={`${styles.navItem} ${!inChapter ? styles.navItemActive : ''}`}
              onClick={() => navigate('/')}
            >
              <HomeOutlined /> 课程中心
            </span>
            {inChapter && (
              <span className={`${styles.navItem} ${styles.navItemActive}`}>
                <ReadOutlined /> 学习工作台
              </span>
            )}
          </nav>

          <div className={styles.topbarRight}>
            <Tag className={styles.progressTag}>
              已完成 {passed}/{total} 课时
            </Tag>
            <Progress
              percent={percent}
              size="small"
              className={styles.progressBar}
              strokeColor="#2563eb"
            />
          </div>
        </div>
      </header>

      <main className={styles.content}>{children}</main>
    </div>
  );
};

export default AppLayout;
