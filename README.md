# Vitest 可视化学习平台

一个交互式的 Vitest 测试框架学习平台，通过左侧导航 + 右侧代码编辑器 + 实时测试运行的方式，让你边学边练。

## 学习章节

### 第一章：Vitest 基础入门
- [1.1 第一个测试用例](./src/pages/vitest-learn/basics)
- [1.2 常用匹配器](./src/pages/vitest-learn/basics)
- [1.3 测试运行模式](./src/pages/vitest-learn/basics)

### 第二章：测试结构
- [2.1 describe 和 it](./src/pages/vitest-learn/structure)
- [2.2 生命周期钩子](./src/pages/vitest-learn/structure)
- [2.3 跳过和专注测试](./src/pages/vitest-learn/structure)

### 第三章：Mock 与 Stub
- [3.1 vi.fn() 模拟函数](./src/pages/vitest-learn/mock)
- [3.2 vi.mock() 模块模拟](./src/pages/vitest-learn/mock)
- [3.3 vi.spyOn() 方法监控](./src/pages/vitest-learn/mock)
- [3.4 清除和重置 Mock](./src/pages/vitest-learn/mock)

### 第四章：异步测试
- [4.1 async/await 测试](./src/pages/vitest-learn/async)
- [4.2 Promise 链式测试](./src/pages/vitest-learn/async)
- [4.3 错误处理测试](./src/pages/vitest-learn/async)

### 第五章：数组和对象测试
- [5.1 toEqual vs toBe](./src/pages/vitest-learn/array-object)
- [5.2 数组匹配器](./src/pages/vitest-learn/array-object)
- [5.3 对象匹配器](./src/pages/vitest-learn/array-object)
- [5.4 组合匹配器](./src/pages/vitest-learn/array-object)

### 第六章：Timer 和 Fake Timers
- [6.1 假时钟](./src/pages/vitest-learn/timers)
- [6.2 setInterval 测试](./src/pages/vitest-learn/timers)
- [6.3 Date 对象假时钟](./src/pages/vitest-learn/timers)

### 第七章：Snapshot 测试
- [7.1 基础快照](./src/pages/vitest-learn/snapshot)
- [7.2 更新快照](./src/pages/vitest-learn/snapshot)

### 第八章：高级测试技巧
- [8.1 参数化测试](./src/pages/vitest-learn/advanced)
- [8.2 自定义匹配器](./src/pages/vitest-learn/advanced)
- [8.3 测试配置和隔离](./src/pages/vitest-learn/advanced)

> 注：课程数据中暂无第九章，章节编号从第八章直接跳到第十章。

### 第十章：测试替身
- [10.1 Dummy（虚设对象）](./src/pages/vitest-learn/test-doubles)
- [10.2 Stub（存根）](./src/pages/vitest-learn/test-doubles)
- [10.3 Spy（监视器）](./src/pages/vitest-learn/test-doubles)
- [10.4 Fake（伪对象）](./src/pages/vitest-learn/test-doubles)
- [10.5 测试替身对比](./src/pages/vitest-learn/test-doubles)

### 第十一章：测试数据构建
- [11.1 隐式 vs 内联 Fixture](./src/pages/vitest-learn/fixture)
- [11.2 工厂函数](./src/pages/vitest-learn/fixture)
- [11.3 序列工厂函数](./src/pages/vitest-learn/fixture)

### 第十二章：Vitest 与 Jest 对比
- [12.1 语法对比](./src/pages/vitest-learn/vitest-vs-jest)
- [12.2 Jest 迁移到 Vitest](./src/pages/vitest-learn/vitest-vs-jest)
- [12.3 为什么选择 Vitest](./src/pages/vitest-learn/vitest-vs-jest)

### 第十三章：测试策略
- [13.1 状态验证 vs 行为验证](./src/pages/vitest-learn/test-strategy)
- [13.2 独居测试 vs 群居测试](./src/pages/vitest-learn/test-strategy)
- [13.3 不需要测试的代码](./src/pages/vitest-learn/test-strategy)

### 第十四章：TDD 实战演练
- [14.1 TDD：实现 FizzBuzz](./src/pages/vitest-learn/tdd-practice)
- [14.2 TDD：判断变位词](./src/pages/vitest-learn/tdd-practice)
- [14.3 TDD：判断闰年](./src/pages/vitest-learn/tdd-practice)
- [14.4 TDD：判断回文](./src/pages/vitest-learn/tdd-practice)
- [14.5 TDD：凯撒密码](./src/pages/vitest-learn/tdd-practice)

### 第十五章：React 组件测试（jsdom）
- [15.1 渲染组件](./src/pages/vitest-learn/react-testing)
- [15.2 状态与事件](./src/pages/vitest-learn/react-testing)
- [15.3 受控输入](./src/pages/vitest-learn/react-testing)

## 运行项目

```bash
cd vitest-playground
npm install
npm run dev
```

## 技术栈

- Vite 6（构建/开发服务器）
- React 19
- antd v6（仅作为 UI 组件库，已移除 Ant Design Pro 框架层）
- react-router-dom v7（路由）
- Monaco Editor（代码编辑器，本地打包，含行号/补全/暗色主题）
- @webcontainer/api（在浏览器内启动真实 Node 环境运行 Vitest）
- Vitest 4 + @testing-library/react（测试）
- highlight.js（文档代码高亮）

## 新增能力

- **真代码编辑器**：Monaco 替代原 textarea，支持行号、语法高亮、自动补全、括号匹配、`Ctrl/Cmd+Enter` 运行。
- **真实 Vitest 运行**：通过 WebContainer 在浏览器内启动真实 Node 环境安装并运行 Vitest（多文件、`vi.mock`、快照等行为与本地一致）。首次运行需联网安装依赖。
- **进度持久化**：学习进度（代码、是否已通过）存入 `localStorage`，刷新不丢，课时列表与进度标签显示 ✓。
- **知识小测**：章节可穿插选择题卡片（`Lesson.quiz`），动手前巩固概念。
- **TDD 自动批改**：课时可设 `Lesson.grader`（可见测试用例，只读展示给用户并作为主校验）与 `Lesson.hiddenGrader`（额外隐藏校验，防作弊/强化验证）。设置 `grader` 后该课时进入 TDD 模式：用户只写实现，编辑器上方展示给定测试。新增「第十四章：TDD 实战演练」即采用此模式。

## 运行注意

WebContainer 需要页面处于跨域隔离状态，开发/预览服务器已在 `vite.config.ts` 设置了
`Cross-Origin-Embedder-Policy: require-corp` 与 `Cross-Origin-Opener-Policy: same-origin`。
因此首次运行测试需联网（拉取 npm 依赖）。

> 说明：本项目已从 Ant Design Pro（Umi Max）模板剥离，仅保留 antd 组件库。
> 测试执行引擎为 WebContainer 内的真实 Vitest（见 `src/pages/vitest-learn/runner.ts`）。
