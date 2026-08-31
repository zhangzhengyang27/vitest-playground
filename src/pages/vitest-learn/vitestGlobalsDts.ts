/**
 * 给 Monaco 注入的精简 Vitest / React Testing Library / React 全局 & 模块声明。
 *
 * Monaco 是独立打包的 TS 语言服务，看不到本项目的 node_modules。
 * 把这些声明通过 addExtraLib 注进去，编辑器就不再报“Cannot find name 'test' / 'expect'”
 * 以及“Cannot find module 'vitest'”之类的红色波浪线。
 *
 * 注：这里的类型只用于编辑器诊断，不需要完全精确，能让 90%+ 的课时代码不爆红即可。
 * 真正的运行结果以服务端 vitest 为准。
 */
export const VITEST_GLOBALS_DTS = `
declare function describe(name: string, fn: () => any): any;
declare function describe(name: string, options: any, fn: () => any): any;
declare function test(name: string, fn: () => any): any;
declare function test(name: string, options: any, fn: () => any): any;
declare function it(name: string, fn: () => any): any;
declare function it(name: string, options: any, fn: () => any): any;
declare function beforeAll(fn: () => any): void;
declare function beforeEach(fn: () => any): void;
declare function afterEach(fn: () => any): void;
declare function afterAll(fn: () => any): void;

declare interface Expect {
  toBe(expected: any): any;
  toEqual(expected: any): any;
  toStrictEqual(expected: any): any;
  toBeTruthy(): any;
  toBeFalsy(): any;
  toBeNull(): any;
  toBeUndefined(): any;
  toBeDefined(): any;
  toContain(item: any): any;
  toMatch(expected: string | RegExp): any;
  toThrow(err?: any): any;
  toHaveBeenCalled(): any;
  toHaveBeenCalledTimes(n: number): any;
  toHaveBeenCalledWith(...args: any[]): any;
  toHaveBeenLastCalledWith(...args: any[]): any;
  toBeGreaterThan(n: number | bigint): any;
  toBeGreaterThanOrEqual(n: number | bigint): any;
  toBeLessThan(n: number | bigint): any;
  toBeLessThanOrEqual(n: number | bigint): any;
  toBeCloseTo(n: number, digits?: number): any;
  not: Expect;
  resolves: Expect;
  rejects: Expect;
}
declare function expect<T = any>(actual: T): Expect;

declare interface ViMockedFunction<F extends (...a: any[]) => any = (...a: any[]) => any> {
  (...a: Parameters<F>): ReturnType<F>;
  mockReturnValue(v: ReturnType<F>): void;
  mockResolvedValue(v: Awaited<ReturnType<F>>): void;
  mockImplementation(fn: F): void;
  mockReset(): void;
  mockClear(): void;
  mockRestore(): void;
}
declare interface Vi {
  fn<F extends (...a: any[]) => any = (...a: any[]) => any>(impl?: F): ViMockedFunction<F>;
  mock(path: string, factory?: () => any): void;
  unmock(path: string): void;
  doMock(path: string, factory?: () => any): void;
  doUnmock(path: string): void;
  spyOn<T, M extends keyof T>(obj: T, m: M): ViMockedFunction<T[M]>;
  resetAllMocks(): void;
  clearAllMocks(): void;
  restoreAllMocks(): void;
  useFakeTimers(): void;
  useRealTimers(): void;
  advanceTimersByTime(ms: number): void;
  mocked<T>(item: T): T;
  isMockFunction(fn: any): boolean;
  waitFor(cb: () => any, opts?: { timeout?: number; interval?: number }): Promise<void>;
}
declare const vi: Vi;

declare module 'vitest' {
  export {
    describe,
    test,
    it,
    beforeAll,
    beforeEach,
    afterAll,
    afterEach,
    expect,
    vi,
  };
}

// React Testing Library（react 章节）
declare module '@testing-library/react' {
  export const render: (ui: any, options?: any) => any;
  export const screen: any;
  export const fireEvent: any;
  export const cleanup: () => void;
  export const act: (cb: () => any) => any;
}
declare module '@testing-library/dom' {
  export const screen: any;
  export const fireEvent: any;
  export const waitFor: (cb: () => any, opts?: any) => Promise<void>;
}
declare module '@testing-library/jest-dom' {
  // matchers 通过 side-effect import 注册；编辑器只关心不报错
}

// React / ReactDOM（最小声明，避免编辑器因找不到模块爆红）
declare module 'react' {
  const React: any;
  export = React;
  export as namespace React;
}
declare module 'react/jsx-runtime' {
  export const jsx: (type: any, props: any, key?: any) => any;
  export const jsxs: (type: any, props: any, key?: any) => any;
  export const Fragment: any;
}
declare module 'react-dom' {
  export const render: (node: any, container: any) => any;
}
declare module 'react-dom/client' {
  export const createRoot: (container: any) => any;
}
`;