import { useEffect } from 'react';

const DEFAULT_TITLE = 'Vitest 可视化学习平台 | 交互式前端单元测试教程';

/**
 * 轻量级逐路由 SEO 元信息：设置 document.title 与 <meta name="description">。
 * 不引入额外依赖（避免 react-helmet 的安装/网络开销），直接操作 DOM，
 * 在 SPA 路由切换时为各页面设置独立标题，利于搜索引擎深链收录。
 */
export function usePageMeta(title?: string, description?: string) {
  useEffect(() => {
    document.title = title ?? DEFAULT_TITLE;
  }, [title]);

  useEffect(() => {
    if (!description) return;
    let el = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute('name', 'description');
      document.head.appendChild(el);
    }
    el.setAttribute('content', description);
  }, [description]);
}
