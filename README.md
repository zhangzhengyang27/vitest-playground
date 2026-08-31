# Vitest 可视化学习平台

一个交互式的 Vitest 测试框架学习平台，通过左侧导航 + 右侧代码编辑器 + 实时测试运行的方式，让你边学边练。

## 学习章节

### 第一章：Vitest 基础入门
- [环境配置与安装](./src/pages/vitest-learn/basics)
- [第一个测试用例](./src/pages/vitest-learn/basics)
- [测试运行模式](./src/pages/vitest-learn/basics)

### 第二章：测试结构
- [describe/it/expect](./src/pages/vitest-learn/structure)
- [beforeEach/afterEach](./src/pages/vitest-learn/structure)
- [嵌套与组织测试](./src/pages/vitest-learn/structure)

### 第三章：Mock 与 Stub
- [vi.fn() 模拟函数](./src/pages/vitest-learn/mock)
- [vi.mock() 模块模拟](./src/pages/vitest-learn/mock)
- [vi.spyOn() 监听方法](./src/pages/vitest-learn/mock)

### 第四章：异步测试
- [async/await](./src/pages/vitest-learn/async)
- [Promise 测试](./src/pages/vitest-learn/async)
- [错误处理测试](./src/pages/vitest-learn/async)

### 第五章：组件测试实战
- [React 组件测试](./src/pages/vitest-learn/component-test)
- [用户交互模拟](./src/pages/vitest-learn/component-test)
- [状态管理测试](./src/pages/vitest-learn/component-test)

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
- Vitest 4 + @testing-library/react（测试）
- highlight.js（代码高亮）

> 说明：本项目已从 Ant Design Pro（Umi Max）模板剥离，仅保留 antd 组件库。
> 测试运行在浏览器内的自研沙箱中执行（见 `src/pages/vitest-learn/sandbox`）。
