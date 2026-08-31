/**
 * Vitest 学习平台 - 主页
 * 展示所有学习章节的入口页面
 */
import { BookOutlined, BulbOutlined, RocketOutlined } from '@ant-design/icons';
import { Card } from 'antd';
import { useNavigate } from 'react-router-dom';
import { chapters } from './data';
import styles from './welcome.module.css';

const Welcome: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className={styles.container}>
      {/* Hero Section */}
      <div className={styles.hero}>
        <h1 className={styles.title}>
          <RocketOutlined /> Vitest 可视化学习平台
        </h1>
        <p className={styles.subtitle}>
          通过交互式代码编辑器，边学边练掌握 Vitest 测试框架
        </p>
        <div className={styles.badges}>
          <span className={styles.badge}>React 19</span>
          <span className={styles.badge}>Vitest 4</span>
          <span className={styles.badge}>@testing-library</span>
        </div>
      </div>

      {/* Chapter Cards */}
      <div className={styles.chapterList}>
        {chapters.map((chapter) => (
          <Card
            key={chapter.key}
            bordered
            hoverable
            className={styles.chapterCard}
            onClick={() => {
              navigate(`/vitest-learn/${chapter.key}`);
            }}
          >
            <div className={styles.chapterContent}>
              <div className={styles.chapterIcon}>
                <BookOutlined />
              </div>
              <div className={styles.chapterInfo}>
                <h3 className={styles.chapterTitle}>{chapter.title}</h3>
                <p className={styles.chapterDesc}>{chapter.description}</p>
                <div className={styles.chapterMeta}>
                  <span>
                    <BulbOutlined /> {chapter.lessons.length} 个课时
                  </span>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Features */}
      <Card className={styles.features}>
        <h2 className={styles.sectionTitle}>学习特色</h2>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <Card>
            <h4>边写边测</h4>
            <p>内置代码编辑器，实时运行测试</p>
          </Card>
          <Card>
            <h4>循序渐进</h4>
            <p>从基础到实战，章节环环相扣</p>
          </Card>
          <Card>
            <h4>即时反馈</h4>
            <p>测试结果秒级展示，错误信息清晰</p>
          </Card>
        </div>
      </Card>
    </div>
  );
};

export default Welcome;
