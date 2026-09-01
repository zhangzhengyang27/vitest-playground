import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { handleRunVitest } from './vitestServerRunner';

/** 把“服务端跑真实 Vitest”的接口挂到 dev/preview 服务器 */
function vitestRunnerMiddleware() {
  return {
    name: 'vitest-runner-middleware',
    configureServer(server: { middlewares: { use: (p: string, fn: (req: any, res: any, next: any) => void) => void } }) {
      server.middlewares.use('/api/run-vitest', (req, res, next) => {
        handleRunVitest(req, res).catch(next);
      });
    },
    configurePreviewServer(server: { middlewares: { use: (p: string, fn: (req: any, res: any, next: any) => void) => void } }) {
      server.middlewares.use('/api/run-vitest', (req, res, next) => {
        handleRunVitest(req, res).catch(next);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), vitestRunnerMiddleware()],
  build: {
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      output: {
        manualChunks: {
          monaco: ['monaco-editor', '@monaco-editor/react'],
          antd: ['antd', '@ant-design/icons'],
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@root': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
  server: {
    port: 8000,
    // WebContainer 需要页面处于跨域隔离状态（SharedArrayBuffer）
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
  preview: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
});
