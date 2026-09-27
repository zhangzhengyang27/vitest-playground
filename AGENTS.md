# AGENTS.md

面向 AI 编程助手（CodeBuddy / Claude Code / Cursor 等）的本项目工作指南。改动前请先读完“核心架构”与“铁律”两节。

## 项目简介

**Vitest 可视化学习平台**（`vitest-playground`）：基于 Vite + React + 真实 Vitest 的交互式前端单元测试学习网站。用户在浏览器内编写/运行测试，页面用**本机真实安装的 Vitest** 实时跑测试并返回结构化结果。

站点域名：`https://vitest-playground.zhangzhengyang.com`

## 核心架构（必读）

本项目的差异化能力是“**浏览器内运行真实 Vitest**”，实现方式**不是** WebContainer / StackBlitz CDN，而是：

1. 浏览器把用户代码 `POST /api/run-vitest`（同源 JSON）。
2. `vite.config.ts` 里的 `vitestRunnerMiddleware()` 插件把这个接口挂到 **dev 服务器与 preview 服务器** 上。
3. `vitestServerRunner.ts` 的 `handleRunVitest` 在 `.vitest-runs/run-<rand>/` 每请求独立临时目录里用 `node_modules/vitest/vitest.mjs` **真正起进程跑测试**（带 60s 超时并强制 kill，跑完即删），把 `RunResult` 返回前端。
4. 前端 `runner.ts` 的 `runVitest()` 负责请求与解析，`chapter.tsx` 的 `useRealVitest` 钩子驱动 UI。

**推论（非常重要）**：测试能力依赖 Vite 的 dev/preview 服务器及其自定义中间件。纯静态托管（Vercel 静态、GitHub Pages 等）**跑不了测试**——必须用一个包含该中间件的 Node 服务来托管，或本地 `pnpm dev` / `pnpm preview`。

### 运行契约

`POST /api/run-vitest`，body：

```json
{ "chapterKey": "basics", "lessonKey": "first-test", "code": "..." }
```

返回 `RunResult`（`src/pages/vitest-learn/types.ts`）：`{ success, passed, failed, output, tests[], markers[], coverage? }`。

**测试装配在服务端完成（防篡改）**：`grader` / `hiddenGrader` / `extraFiles` / 运行环境 / coverage / benchmark 均由服务端按课时数据（`data.ts`）装配，客户端只能提交课时 key 与当前代码；`code` 之外任何注入尝试会被 400 拒绝。

两种课时模式（装配规则见 `vitestServerRunner.ts` 的 `buildLessonFiles`）：
- **普通模式**：`code` 即用户编写的测试文件（`lesson.spec.ts`）。
- **TDD 模式**（数据里存在 `grader`）：`code` 为用户实现（`lesson.ts`），`grader` 为可见测试（`lesson.spec.ts`，主校验），`hiddenGrader` 为隐藏测试（`lesson.hidden.spec.ts`，不展示、防作弊）。
- jsdom 课时（`environment: 'jsdom'`）：装配时向 spec/hidden 注入 `// @vitest-environment happy-dom` 并使用 `.tsx`（React 组件测试）。

## 技术栈

- 构建：Vite 6、TypeScript 6、@vitejs/plugin-react
- 前端：React 19、react-router-dom 7、antd 6 + @ant-design/icons、@monaco-editor/react + monaco-editor
- 测试：vitest 4 + happy-dom（组件/环境）、@vitest/coverage-v8、@vitest/ui
- 包管理器：**pnpm**（Node ≥ 22）。**不要提交 `package-lock.json`**，只用 `pnpm-lock.yaml`。

## 常用命令

```bash
pnpm install          # 安装依赖（含 vitest，测试运行所必需）
pnpm dev              # 开发服务器 :8000（已注入 COEP/COOP 头）
pnpm build            # 生产构建到 dist/
pnpm preview          # 预览构建产物 :8000（同样挂载 /api/run-vitest）
pnpm tsc              # 仅类型检查（无 emit）
pnpm test             # 跑本仓库自身测试（vitest run）
pnpm test:watch       # vitest watch
pnpm test:ui          # vitest UI
pnpm test:coverage    # 覆盖率
```

## 目录结构

```
index.html                 # 入口；含 SEO/OG/JSON-LD 元信息
vite.config.ts             # 插件（含 /api/run-vitest 中间件）、manualChunks、COEP/COOP 头、allowedHosts
vitestServerRunner.ts      # 服务端 Vitest 运行器（替代 WebContainer）
.vitest-runs/              # 运行临时目录根（每次运行独立 run-<rand> 子目录，跑完即删，已 gitignore）
src/
  main.tsx, app.tsx        # 入口与路由（/、/vitest-learn/:chapterKey、/vitest-learn/:chapterKey/:lessonKey、/progress）
  usePageMeta.ts           # 逐路由动态 title/description（零依赖）
  theme/                    # 主题 Provider
  components/AppLayout.tsx  # 通用布局
  pages/vitest-learn/
    index.tsx              # 首页（课程中心）
    chapter.tsx            # 课时页（LessonPage），useRealVitest 在此驱动运行
    progressPage.tsx       # 学习进度总览
    data.ts                # ★ 课程数据（chapters / lessons），扩展内容只改这里
    types.ts               # Lesson / Chapter / RunResult / Quiz 等类型
    runner.ts              # 前端请求 /api/run-vitest 的客户端
    monacoSetup.ts         # Monaco 仅加载 TS/JS 语言（体积优化）
    progress.ts            # 进度持久化（localStorage）
    Quiz.tsx               # 知识小测组件
public/
  favicon.png              # 512×422，暗色 V 勾 logo（无水印）
  og-cover.png             # 社交分享图，必须为 1200×630
  robots.txt, sitemap.xml, llms.txt   # SEO/GEO，域名统一 zhangzhengyang.com
```

## 扩展课程内容（最常见改动）

所有课程在 `src/pages/vitest-learn/data.ts` 的 `chapters: Chapter[]` 中。新增/修改仅编辑此文件，无需改组件。

```ts
interface Lesson {
  key: string;            // 路由用，全局唯一
  title: string;
  description: string;
  code: string;           // 初始展示代码
  solution?: string;      // 参考答案
  tips?: string[];
  grader?: string;        // 存在即进入 TDD 模式（可见测试文件）
  hiddenGrader?: string;  // 隐藏测试（防作弊）
  quiz?: Quiz[];          // 知识小测
  environment?: 'jsdom';  // React 组件测试（注入 @vitest-environment jsdom + .tsx）
  extraFiles?: Record<string, string>; // 额外写入沙箱的文件（如 vi.mock 的真实模块）
  benchmark?: boolean;    // 以 vitest bench 运行
}
interface Chapter { key: string; title: string; description: string; lessons: Lesson[] }
```

新增课时：在对应 `Chapter` 的 `lessons` 里追加一个 `Lesson`；新增章：在 `chapters` 末尾追加 `Chapter`。注意：
- 测试代码里引用用户代码用相对路径 `./lesson` 或 `./lesson.ts`，服务端会按 `lesson.ts/lesson.tsx/lesson.spec.ts/lesson.spec.tsx` 候选写入沙箱。
- 普通模式用户编辑 `lesson.spec.ts`；TDD 模式用户编辑 `lesson.ts`，`grader` 作为主校验。

## 铁律（改动前务必遵守）

1. **不要删除或绕过** `vitestRunnerMiddleware`（`vite.config.ts`）与 `vitestServerRunner.ts`——这是产品的核心能力。本地预览/测试都依赖它。
2. **安全敏感**：运行器在本机执行用户代码，仅用于本地/受信学习环境。不要把它暴露到公网或不可信网络；已加超时与 kill 兜底，改动时不要削弱。运行器已按「受限执行」加固：文件名白名单、最小 env、独立临时目录、2 并发/8 排队（满则 429）。修改时不要放宽这些限制；如需更强隔离应迁移到一次性容器，而不是回退共享目录模式。
3. **包管理器用 pnpm**，不要生成 `package-lock.json`；若误生成请删除（保留 `pnpm-lock.yaml`）。
4. **Monaco 体积**：构建已用 `manualChunks` 把 monaco/antd/react 拆分，且 `chunkSizeWarningLimit: 2500`。不要引入其它重型依赖或改坏该拆分。
5. **COEP/COOP 头**（`server` 与 `preview` 均已设 `Cross-Origin-Embedder-Policy: require-corp` 与 `Cross-Origin-Opener-Policy: same-origin`）——Monaco worker 跨域隔离所需，**不要删除**。部署到生产宿主时也要配置同样的响应头。
6. **部署约束**：纯静态托管无法运行测试（无中间件）。要运行测试必须托管包含该中间件的 Node 服务；若只部署静态站点，需明确告知用户测试功能不可用。生产 `preview.allowedHosts` 含本站域名。
7. **SEO 资源保持同步**：`public/og-cover.png` 保持 1200×630；改路由/域名时同步更新 `public/sitemap.xml`、`public/llms.txt`、`public/robots.txt` 与 `index.html` 中的 `zhangzhengyang.com` 相关链接与 `usePageMeta` 标题。
8. **不要提交** `dist/`（构建产物，已 gitignore）与 `.vitest-runs/`（运行临时目录）。

## 发布核对清单（简短）

- [ ] `pnpm install` 成功且含 vitest
- [ ] `pnpm tsc` 无类型错误
- [ ] `pnpm build` 成功，无 chunk 体积告警
- [ ] 本地 `pnpm preview` 能正常跑测试（验证中间件）
- [ ] 远程 `origin` 指向**自己的仓库**（默认仍是 ant-design-pro 的占位地址，需改）
- [ ] 生产托管配置了 COEP/COOP 响应头（若需测试功能）
- [ ] 服务器 nginx 已配置 /api/run-vitest 按 IP 限流（见 docs/deploy/runbook.md）
