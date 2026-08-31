/**
 * 知识小测卡片（在动手练习之间穿插选择题，巩固概念）
 */
import { useState } from 'react';
import { Card, Radio, Space, Button } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import type { Quiz as QuizType } from './types';
import styles from './chapter.module.css';

interface QuizCardProps {
  quizzes: QuizType[];
}

const QuizCard: React.FC<QuizCardProps> = ({ quizzes }) => {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState<Record<number, boolean>>({});

  if (!quizzes.length) return null;

  return (
    <Card className={styles.quizCard} title="📝 知识小测">
      {quizzes.map((q, i) => {
        const answered = answers[i];
        const isCorrect = answered === q.answer;
        const done = submitted[i];
        return (
          <div key={i} className={styles.quizItem}>
            <p className={styles.quizQuestion}>
              <span className={styles.quizIndex}>{i + 1}</span>
              {q.question}
            </p>
            <Radio.Group
              value={answered}
              disabled={done}
              onChange={(e) => setAnswers((a) => ({ ...a, [i]: e.target.value }))}
            >
              <Space direction="vertical">
                {q.options.map((opt, oi) => (
                  <Radio key={oi} value={oi}>
                    {opt}
                  </Radio>
                ))}
              </Space>
            </Radio.Group>
            {done && (
              <div className={styles.quizFeedback}>
                {isCorrect ? (
                  <span className={styles.quizCorrect}>
                    <CheckCircleOutlined /> 回答正确
                  </span>
                ) : (
                  <span className={styles.quizWrong}>
                    ✗ 正确答案：{q.options[q.answer]}
                  </span>
                )}
              </div>
            )}
            <div>
              <Button
                size="small"
                type="primary"
                ghost
                className={styles.quizSubmit}
                disabled={answered === undefined || done}
                onClick={() => setSubmitted((s) => ({ ...s, [i]: true }))}
              >
                提交
              </Button>
            </div>
          </div>
        );
      })}
    </Card>
  );
};

export default QuizCard;
