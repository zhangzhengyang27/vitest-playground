/**
 * 代码执行沙箱
 * 在主窗口中直接执行用户代码
 */

import { useState, useCallback } from 'react';

export interface TestResult {
  status: 'idle' | 'running' | 'success' | 'error';
  output: string;
  duration?: string;
  passed?: number;
  failed?: number;
  pending?: number;
  error?: string;
}

export interface TestCaseResult {
  name: string;
  status: 'passed' | 'failed' | 'pending';
  error?: string;
  duration?: number;
}

// 生成唯一 ID
let idCounter = 0;
const generateId = () => `test-${Date.now()}-${++idCounter}`;

// ==================== 核心测试 API ====================

class Expectation {
  value: any;
  _negate: boolean;
  _pass: boolean;

  constructor(value: any) {
    this.value = value;
    this._negate = false;
    this._pass = false;
  }

  get not(): this {
    this._negate = !this._negate;
    return this;
  }

  _getPass(): boolean {
    return this._negate ? !this._pass : this._pass;
  }

  _match(name: string, pass: boolean, expected: any, actual: any) {
    this._pass = pass;
    return {
      pass: this._getPass(),
      matcher: name,
      expected,
      actual,
      negate: this._negate,
    };
  }

  toBe(expected: any) {
    const pass = Object.is(this.value, expected);
    return this._match('toBe', pass, expected, this.value);
  }

  toEqual(expected: any) {
    const pass = this._deepEqual(this.value, expected);
    return this._match('toEqual', pass, expected, this.value);
  }

  toStrictEqual(expected: any) {
    return this.toEqual(expected);
  }

  _deepEqual(a: any, b: any): boolean {
    if (a === b) return true;
    if (a === null || b === null) return a === b;
    if (typeof a !== typeof b) return false;
    if (typeof a !== 'object') return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (a.constructor !== b.constructor) return false;

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
      if (!keysB.includes(key)) return false;
      if (!this._deepEqual(a[key], b[key])) return false;
    }
    return true;
  }

  toBeTruthy() {
    const pass = !!this.value;
    return this._match('toBeTruthy', pass, 'truthy value', this.value);
  }

  toBeFalsy() {
    const pass = !this.value;
    return this._match('toBeFalsy', pass, 'falsy value', this.value);
  }

  toBeNull() {
    const pass = this.value === null;
    return this._match('toBeNull', pass, null, this.value);
  }

  toBeUndefined() {
    const pass = this.value === undefined;
    return this._match('toBeUndefined', pass, undefined, this.value);
  }

  toBeDefined() {
    const pass = this.value !== undefined;
    return this._match('toBeDefined', pass, 'defined', this.value);
  }

  toContain(item: any) {
    let pass: boolean;
    if (typeof this.value === 'string') {
      pass = this.value.includes(item);
    } else if (Array.isArray(this.value)) {
      pass = this.value.some((v: any) => this._deepEqual(v, item));
    } else if (this.value instanceof Map) {
      pass = this.value.has(item);
    } else if (this.value instanceof Set) {
      pass = this.value.has(item);
    } else {
      pass = false;
    }
    return this._match('toContain', pass, item, this.value);
  }

  toContainEqual(item: any) {
    const pass = Array.isArray(this.value) && this.value.some((v: any) => this._deepEqual(v, item));
    return this._match('toContainEqual', pass, item, this.value);
  }

  toHaveLength(length: number) {
    const pass = this.value && typeof this.value.length === 'number' && this.value.length === length;
    return this._match('toHaveLength', pass, length, this.value?.length);
  }

  toMatch(pattern: RegExp | string) {
    const pass = pattern instanceof RegExp
      ? pattern.test(this.value)
      : String(this.value).includes(pattern);
    return this._match('toMatch', pass, pattern, this.value);
  }

  toThrow(error?: string | RegExp | Error) {
    let threw = false;
    let thrownError: Error | null = null;
    try {
      if (typeof this.value === 'function') {
        this.value();
      } else {
        throw new Error('toThrow requires a function');
      }
    } catch (e) {
      threw = true;
      thrownError = e as Error;
    }
    let pass = threw;
    if (error) {
      if (typeof error === 'string') {
        pass = threw && (thrownError?.message?.includes(error) ?? false);
      } else if (error instanceof RegExp) {
        pass = threw && error.test(thrownError?.message || '');
      } else if (error instanceof Error) {
        pass = threw && thrownError?.message === error.message;
      }
    }
    return this._match('toThrow', pass, error, thrownError?.message);
  }

  toBeGreaterThan(num: number) {
    const pass = typeof this.value === 'number' && this.value > num;
    return this._match('toBeGreaterThan', pass, `> ${num}`, this.value);
  }

  toBeLessThan(num: number) {
    const pass = typeof this.value === 'number' && this.value < num;
    return this._match('toBeLessThan', pass, `< ${num}`, this.value);
  }

  toBeGreaterThanOrEqual(num: number) {
    const pass = typeof this.value === 'number' && this.value >= num;
    return this._match('toBeGreaterThanOrEqual', pass, `>= ${num}`, this.value);
  }

  toBeLessThanOrEqual(num: number) {
    const pass = typeof this.value === 'number' && this.value <= num;
    return this._match('toBeLessThanOrEqual', pass, `<= ${num}`, this.value);
  }

  toBeNaN() {
    const pass = Number.isNaN(this.value);
    return this._match('toBeNaN', pass, 'NaN', this.value);
  }

  toHaveProperty(key: string, value?: any) {
    const hasKey = this.value !== null && typeof this.value === 'object' && key in this.value;
    let pass = hasKey;
    if (value !== undefined && hasKey) {
      pass = this._deepEqual(this.value[key], value);
    }
    return this._match('toHaveProperty', pass, key, this.value);
  }

  toBeInstanceOf(cls: any) {
    const pass = this.value instanceof cls;
    return this._match('toBeInstanceOf', pass, cls.name, this.value?.constructor?.name);
  }

  toBeCloseTo(num: number, precision = 2) {
    const pass = typeof this.value === 'number' && Math.abs(this.value - num) < Math.pow(10, -precision);
    return this._match('toBeCloseTo', pass, num, this.value);
  }
}

// ==================== Mock 函数 ====================

interface MockResult {
  type: 'return' | 'throw';
  value?: any;
  error?: any;
}

interface MockObject {
  (): any;
  mock: { calls: any[][]; results: MockResult[] };
  mockClear(): MockObject;
  mockReset(): MockObject;
  mockRestore(): MockObject;
  mockReturnValue(v: any): MockObject;
  mockResolvedValue(v: any): MockObject;
  mockRejectedValue(v: any): MockObject;
  mockReturnValueOnce(v: any): MockObject;
  mockResolvedValueOnce(v: any): MockObject;
  mockImplementation(fn: any): MockObject;
  mockImplementationOnce(fn: any): MockObject;
  calls: any[][];
  results: MockResult[];
}

class MockFn {
  _fn: any;
  _impl: any;
  _calls: any[][];
  _results: MockResult[];

  constructor(fn?: any) {
    this._fn = fn;
    this._impl = fn;
    this._calls = [];
    this._results = [];
  }

  mockImplementation(fn: any): this {
    this._impl = fn;
    return this;
  }

  mockReturnValue(val: any): this {
    this._impl = () => val;
    return this;
  }

  mockResolvedValue(val: any): this {
    this._impl = async () => val;
    return this;
  }

  mockRejectedValue(error: any): this {
    this._impl = async () => { throw error; };
    return this;
  }

  mockReturnValueOnce(val: any): this {
    const fn = this._impl;
    const values = [val];
    this._impl = () => {
      const v = values.shift();
      if (v !== undefined) return v;
      return fn ? fn() : undefined;
    };
    return this;
  }

  mockResolvedValueOnce(val: any): this {
    return this.mockReturnValueOnce(Promise.resolve(val));
  }

  mockImplementationOnce(fn: any): this {
    const fns = [fn];
    const origImpl = this._impl;
    this._impl = (...args: any[]) => {
      const f = fns.shift();
      if (f) return f(...args);
      return origImpl ? origImpl(...args) : undefined;
    };
    return this;
  }

  get mock() {
    return {
      calls: this._calls,
      results: this._results,
    };
  }

  get calls() {
    return this._calls;
  }

  get results() {
    return this._results;
  }

  clear(): this {
    this._calls = [];
    this._results = [];
    return this;
  }

  reset(): this {
    this._calls = [];
    this._results = [];
    if (this._fn !== undefined) {
      this._impl = this._fn;
    }
    return this;
  }

  restore(): this {
    this._impl = this._fn;
    return this;
  }

  apply(ctx: any, args: any[]) {
    return this._call(ctx, args);
  }

  call(ctx: any, ...args: any[]) {
    return this._call(ctx, args);
  }

  _call(ctx: any, args: any[]) {
    this._calls.push(args);
    try {
      if (this._impl) {
        const result = this._impl.apply(ctx, args);
        if (result instanceof Promise || (result && typeof result.then === 'function')) {
          return result
            .then((val: any) => {
              this._results.push({ type: 'return', value: val });
              return val;
            })
            .catch((err: any) => {
              this._results.push({ type: 'throw', error: err });
              throw err;
            });
        } else {
          this._results.push({ type: 'return', value: result });
          return result;
        }
      } else {
        // 没有实现时返回 undefined
        this._results.push({ type: 'return', value: undefined });
        return undefined;
      }
    } catch (err) {
      this._results.push({ type: 'throw', error: err });
      throw err;
    }
  }

  valueOf() {
    return this._impl;
  }

  [Symbol.toStringTag] = 'MockFunction';

  toString() {
    return this._fn ? `MockFn(${this._fn.name || 'anonymous'})` : 'MockFn';
  }
}

function createMockFn(fn?: any): MockObject {
  const mock = new MockFn(fn);
  const callable: MockObject = (...args: any[]) => mock.call(undefined, ...args);
  callable.mock = mock.mock;
  callable.calls = mock.calls;
  callable.results = mock.results;
  callable.mockClear = () => { mock.clear(); return callable; };
  callable.mockReset = () => { mock.reset(); return callable; };
  callable.mockRestore = () => { mock.restore(); return callable; };
  callable.mockReturnValue = (v: any) => { mock.mockReturnValue(v); return callable; };
  callable.mockResolvedValue = (v: any) => { mock.mockResolvedValue(v); return callable; };
  callable.mockRejectedValue = (v: any) => { mock.mockRejectedValue(v); return callable; };
  callable.mockReturnValueOnce = (v: any) => { mock.mockReturnValueOnce(v); return callable; };
  callable.mockResolvedValueOnce = (v: any) => { mock.mockResolvedValueOnce(v); return callable; };
  callable.mockImplementation = (fn: any) => { mock.mockImplementation(fn); return callable; };
  callable.mockImplementationOnce = (fn: any) => { mock.mockImplementationOnce(fn); return callable; };
  return callable;
}

// ==================== vi 对象 ====================

const vi = {
  fn: createMockFn,
  mock: createMockFn,

  spyOn(obj: any, method: string) {
    if (!obj || !method) {
      throw new Error('spyOn requires an object and a method name');
    }
    const original = obj[method];
    const mockFn = createMockFn(original);
    (mockFn as any).mockRestore = () => {
      obj[method] = original;
    };
    obj[method] = mockFn;
    return mockFn;
  },

  useFakeTimers() {
    // 简化实现
  },

  useRealTimers() {
    // 简化实现
  },

  clearAllMocks() {},
  restoreAllMocks() {},
};

// ==================== 测试运行器 ====================

interface Suite {
  name: string;
  tests: any[];
  suites: Suite[];
  beforeAll: (() => any)[];
  afterAll: (() => any)[];
  beforeEach: (() => any)[];
  afterEach: (() => any)[];
  parent: Suite | null;
  startTime: number | null;
  endTime: number | null;
}

interface TestCaseInternal {
  name: string;
  fn: () => any;
  suite: Suite;
  status: 'pending' | 'passed' | 'failed';
  error: any;
  startTime: number | null;
  endTime: number | null;
  duration: number | null;
}

let currentSuite: Suite | null = null;
let suites: Suite[] = [];

function resetGlobals() {
  currentSuite = null;
  suites = [];
}

function describe(name: string, fn: () => void) {
  const suite: Suite = {
    name,
    tests: [],
    suites: [],
    beforeAll: [],
    afterAll: [],
    beforeEach: [],
    afterEach: [],
    parent: currentSuite,
    startTime: null,
    endTime: null,
  };

  const parentSuite = currentSuite;
  currentSuite = suite;

  fn();

  currentSuite = parentSuite;

  if (parentSuite) {
    parentSuite.suites.push(suite);
  } else {
    suites.push(suite);
  }
}

function test(name: string, fn: () => any, _timeout?: number) {
  // Vitest 允许顶级测试
  if (!currentSuite) {
    const virtualSuite: Suite = {
      name: '__root__',
      tests: [],
      suites: [],
      beforeAll: [],
      afterAll: [],
      beforeEach: [],
      afterEach: [],
      parent: null,
      startTime: null,
      endTime: null,
    };
    currentSuite = virtualSuite;
    suites.push(virtualSuite);
  }

  const testCase: TestCaseInternal = {
    name,
    fn,
    suite: currentSuite,
    status: 'pending',
    error: null,
    startTime: null,
    endTime: null,
    duration: null,
  };

  currentSuite.tests.push(testCase);
}

// 添加 skip, only, todo 支持
(test as any).skip = (name: string, fn: () => any) => {
  // skip 不注册测试，或注册为 skipped 状态
};

(test as any).only = (name: string, fn: () => any) => {
  return test(name, fn);
};

(test as any).todo = (name: string) => {
  // todo 不注册测试
};

const it = test;

// 添加 skip, only, todo 支持到 it
(it as any).skip = (test as any).skip;
(it as any).only = (test as any).only;
(it as any).todo = (test as any).todo;

function beforeAll(fn: () => any) {
  if (currentSuite) {
    currentSuite.beforeAll.push(fn);
  }
}

function afterAll(fn: () => any) {
  if (currentSuite) {
    currentSuite.afterAll.push(fn);
  }
}

function beforeEach(fn: () => any) {
  if (currentSuite) {
    currentSuite.beforeEach.push(fn);
  }
}

function afterEach(fn: () => any) {
  if (currentSuite) {
    currentSuite.afterEach.push(fn);
  }
}

// ==================== 执行测试 ====================

async function runSuite(suite: Suite) {
  for (const hook of suite.beforeAll) {
    await hook();
  }

  for (const testCase of suite.tests) {
    let parent: Suite | null = suite;
    while (parent) {
      for (const hook of parent.beforeEach) {
        await hook();
      }
      parent = parent.parent;
    }

    testCase.startTime = Date.now();
    try {
      await testCase.fn();
      testCase.status = 'passed';
    } catch (e) {
      testCase.status = 'failed';
      testCase.error = e;
    }
    testCase.endTime = Date.now();
    testCase.duration = testCase.endTime - testCase.startTime;

    parent = suite;
    while (parent) {
      for (const hook of parent.afterEach) {
        await hook();
      }
      parent = parent.parent;
    }
  }

  for (const childSuite of suite.suites) {
    await runSuite(childSuite);
  }

  for (const hook of suite.afterAll) {
    await hook();
  }

  suite.endTime = Date.now();
}

async function runAllTests() {
  for (const suite of suites) {
    await runSuite(suite);
  }
}

interface TestResults {
  suites: any[];
  tests: TestCaseResult[];
  passed: number;
  failed: number;
  pending: number;
  totalTime: number;
}

function collectResults(): TestResults {
  const results: TestResults = {
    suites: [],
    tests: [],
    passed: 0,
    failed: 0,
    pending: 0,
    totalTime: 0,
  };

  function collectSuite(suite: Suite, path = '') {
    const suiteResult = {
      name: suite.name,
      path: path ? `${path} > ${suite.name}` : suite.name,
      tests: [],
      suites: [],
    };

    for (const test of suite.tests) {
      const testResult: TestCaseResult = {
        name: `${suiteResult.path} > ${test.name}`,
        status: test.status,
        error: typeof test.error === 'string' ? test.error : test.error?.message,
        duration: test.duration,
      };
      results.tests.push(testResult);
      if (test.status === 'passed') results.passed++;
      else if (test.status === 'failed') results.failed++;
      else results.pending++;
    }

    for (const childSuite of suite.suites) {
      collectSuite(childSuite, suiteResult.path);
    }

    results.suites.push(suiteResult);
  }

  for (const suite of suites) {
    collectSuite(suite);
  }

  return results;
}

function formatResults(results: TestResults): string {
  const lines: string[] = [];

  lines.push(`Test Results`);
  lines.push(`============`);
  lines.push(``);

  for (const test of results.tests) {
    const icon = test.status === 'passed' ? '✓' : test.status === 'failed' ? '✗' : '○';
    lines.push(`${icon} ${test.name}`);
    if (test.status === 'failed' && test.error) {
      lines.push(`  Error: ${test.error}`);
    }
    if (test.duration !== null && test.duration !== undefined) {
      lines.push(`  Duration: ${test.duration}ms`);
    }
  }

  lines.push(``);
  lines.push(`Summary`);
  lines.push(`-------`);
  lines.push(`Passed:  ${results.passed}`);
  lines.push(`Failed:  ${results.failed}`);
  lines.push(`Pending: ${results.pending}`);

  return lines.join('\n');
}

// ==================== expect 函数 ====================

function expect(value: any) {
  const exp = new Expectation(value);
  return {
    toBe: (expected: any) => {
      const result = exp.toBe(expected);
      if (!result.pass) {
        throw new Error(`Expected ${JSON.stringify(result.actual)} to be ${JSON.stringify(result.expected)}`);
      }
    },
    toEqual: (expected: any) => {
      const result = exp.toEqual(expected);
      if (!result.pass) {
        throw new Error(`Expected ${JSON.stringify(result.actual)} to equal ${JSON.stringify(result.expected)}`);
      }
    },
    toStrictEqual: (expected: any) => {
      const result = exp.toStrictEqual(expected);
      if (!result.pass) {
        throw new Error(`Expected ${JSON.stringify(result.actual)} to strictly equal ${JSON.stringify(result.expected)}`);
      }
    },
    toBeTruthy: () => {
      const result = exp.toBeTruthy();
      if (!result.pass) {
        throw new Error(`Expected ${JSON.stringify(result.actual)} to be truthy`);
      }
    },
    toBeFalsy: () => {
      const result = exp.toBeFalsy();
      if (!result.pass) {
        throw new Error(`Expected ${JSON.stringify(result.actual)} to be falsy`);
      }
    },
    toBeNull: () => {
      const result = exp.toBeNull();
      if (!result.pass) {
        throw new Error(`Expected ${JSON.stringify(result.actual)} to be null`);
      }
    },
    toBeUndefined: () => {
      const result = exp.toBeUndefined();
      if (!result.pass) {
        throw new Error(`Expected ${JSON.stringify(result.actual)} to be undefined`);
      }
    },
    toBeDefined: () => {
      const result = exp.toBeDefined();
      if (!result.pass) {
        throw new Error(`Expected ${JSON.stringify(result.actual)} to be defined`);
      }
    },
    toContain: (item: any) => {
      const result = exp.toContain(item);
      if (!result.pass) {
        throw new Error(`Expected ${JSON.stringify(result.actual)} to contain ${JSON.stringify(item)}`);
      }
    },
    toContainEqual: (item: any) => {
      const result = exp.toContainEqual(item);
      if (!result.pass) {
        throw new Error(`Expected ${JSON.stringify(result.actual)} to contain equal ${JSON.stringify(item)}`);
      }
    },
    toHaveLength: (length: number) => {
      const result = exp.toHaveLength(length);
      if (!result.pass) {
        throw new Error(`Expected ${JSON.stringify(result.actual)} to have length ${length}`);
      }
    },
    toMatch: (pattern: RegExp | string) => {
      const result = exp.toMatch(pattern);
      if (!result.pass) {
        throw new Error(`Expected ${JSON.stringify(result.actual)} to match ${pattern}`);
      }
    },
    toThrow: (error?: string | RegExp | Error) => {
      const result = exp.toThrow(error);
      if (!result.pass) {
        throw new Error(`Expected function to throw ${error || 'an error'}`);
      }
    },
    // toThrowError 是 toThrow 的别名
    toThrowError: (error?: string | RegExp | Error) => {
      const result = exp.toThrow(error);
      if (!result.pass) {
        throw new Error(`Expected function to throw ${error || 'an error'}`);
      }
    },
    toBeGreaterThan: (num: number) => {
      const result = exp.toBeGreaterThan(num);
      if (!result.pass) {
        throw new Error(`Expected ${JSON.stringify(result.actual)} to be greater than ${num}`);
      }
    },
    toBeLessThan: (num: number) => {
      const result = exp.toBeLessThan(num);
      if (!result.pass) {
        throw new Error(`Expected ${JSON.stringify(result.actual)} to be less than ${num}`);
      }
    },
    toBeGreaterThanOrEqual: (num: number) => {
      const result = exp.toBeGreaterThanOrEqual(num);
      if (!result.pass) {
        throw new Error(`Expected ${JSON.stringify(result.actual)} to be >= ${num}`);
      }
    },
    toBeLessThanOrEqual: (num: number) => {
      const result = exp.toBeLessThanOrEqual(num);
      if (!result.pass) {
        throw new Error(`Expected ${JSON.stringify(result.actual)} to be <= ${num}`);
      }
    },
    toBeNaN: () => {
      const result = exp.toBeNaN();
      if (!result.pass) {
        throw new Error(`Expected ${JSON.stringify(result.actual)} to be NaN`);
      }
    },
    toHaveProperty: (key: string, value?: any) => {
      const result = exp.toHaveProperty(key, value);
      if (!result.pass) {
        throw new Error(`Expected object to have property ${key}`);
      }
    },
    toBeInstanceOf: (cls: any) => {
      const result = exp.toBeInstanceOf(cls);
      if (!result.pass) {
        throw new Error(`Expected ${JSON.stringify(result.actual)} to be instance of ${cls.name}`);
      }
    },
    toBeCloseTo: (num: number, precision?: number) => {
      const result = exp.toBeCloseTo(num, precision);
      if (!result.pass) {
        throw new Error(`Expected ${JSON.stringify(result.actual)} to be close to ${num}`);
      }
    },
    // Mock 函数匹配器
    toHaveBeenCalled: () => {
      if (!value?.calls || value.calls.length === 0) {
        throw new Error('Expected function to have been called');
      }
    },
    toHaveBeenCalledTimes: (times: number) => {
      if (!value?.calls) {
        throw new Error('Expected function to have been called');
      }
      if (value.calls.length !== times) {
        throw new Error(`Expected function to have been called ${times} times, but it was called ${value.calls.length} times`);
      }
    },
    toHaveBeenCalledWith: (...args: any[]) => {
      if (!value?.calls) {
        throw new Error('Expected function to have been called');
      }
      const hasCall = value.calls.some((call: any[]) =>
        call.length === args.length && call.every((a, i) => Object.is(a, args[i]))
      );
      if (!hasCall) {
        throw new Error(`Expected function to have been called with ${JSON.stringify(args)}`);
      }
    },
    toHaveBeenLastCalledWith: (...args: any[]) => {
      if (!value?.calls || value.calls.length === 0) {
        throw new Error('Expected function to have been called');
      }
      const lastCall = value.calls[value.calls.length - 1];
      if (lastCall.length !== args.length || !lastCall.every((a: any, i: number) => Object.is(a, args[i]))) {
        throw new Error(`Expected function to have been last called with ${JSON.stringify(args)}, but last call was ${JSON.stringify(lastCall)}`);
      }
    },
    toHaveReturnedWith: (val: any) => {
      if (!value?.results) {
        throw new Error('Expected function to have returned');
      }
      const hasReturn = value.results.some((r: any) => !r.type && Object.is(r.value, val));
      if (!hasReturn) {
        throw new Error(`Expected function to have returned with ${JSON.stringify(val)}`);
      }
    },
    not: {
      toBe: (expected: any) => {
        const result = exp.not.toBe(expected);
        if (!result.pass) {
          throw new Error(`Expected ${JSON.stringify(result.actual)} not to be ${JSON.stringify(expected)}`);
        }
      },
      toEqual: (expected: any) => {
        const result = exp.not.toEqual(expected);
        if (!result.pass) {
          throw new Error(`Expected ${JSON.stringify(result.actual)} not to equal ${JSON.stringify(expected)}`);
        }
      },
      toBeTruthy: () => {
        const result = exp.not.toBeTruthy();
        if (!result.pass) {
          throw new Error(`Expected ${JSON.stringify(result.actual)} not to be truthy`);
        }
      },
      toBeFalsy: () => {
        const result = exp.not.toBeFalsy();
        if (!result.pass) {
          throw new Error(`Expected ${JSON.stringify(result.actual)} not to be falsy`);
        }
      },
      toBeNull: () => {
        const result = exp.not.toBeNull();
        if (!result.pass) {
          throw new Error(`Expected ${JSON.stringify(result.actual)} not to be null`);
        }
      },
      toContain: (item: any) => {
        const result = exp.not.toContain(item);
        if (!result.pass) {
          throw new Error(`Expected ${JSON.stringify(result.actual)} not to contain ${JSON.stringify(item)}`);
        }
      },
      toThrow: () => {
        const result = exp.not.toThrow();
        if (!result.pass) {
          throw new Error(`Expected function not to throw`);
        }
      },
    },
    // resolves - 用于异步测试
    resolves: {
      toBe: async (expected: any) => {
        const val = await value;
        const result = new Expectation(val).toBe(expected);
        if (!result.pass) {
          throw new Error(`Expected ${JSON.stringify(result.actual)} to be ${JSON.stringify(result.expected)}`);
        }
      },
      toEqual: async (expected: any) => {
        const val = await value;
        const result = new Expectation(val).toEqual(expected);
        if (!result.pass) {
          throw new Error(`Expected ${JSON.stringify(result.actual)} to equal ${JSON.stringify(result.expected)}`);
        }
      },
      toContain: async (item: any) => {
        const val = await value;
        const result = new Expectation(val).toContain(item);
        if (!result.pass) {
          throw new Error(`Expected ${JSON.stringify(result.actual)} to contain ${JSON.stringify(item)}`);
        }
      },
    },
    // rejects - 用于测试异步错误
    rejects: {
      toThrow: async (error?: any) => {
        let rejected = false;
        let err: any;
        try {
          await value;
        } catch (e) {
          rejected = true;
          err = e;
        }
        if (!rejected) {
          throw new Error(`Expected promise to reject, but it resolved`);
        }
        if (error) {
          const msg = err?.message || '';
          if (typeof error === 'string' && !msg.includes(error)) {
            throw new Error(`Expected error message to include "${error}", but got "${msg}"`);
          }
          if (error instanceof RegExp && !error.test(msg)) {
            throw new Error(`Expected error message to match ${error}, but got "${msg}"`);
          }
        }
      },
      toBe: async (expected: any) => {
        let rejected = false;
        let err: any;
        try {
          await value;
        } catch (e) {
          rejected = true;
          err = e;
        }
        if (!rejected) {
          throw new Error(`Expected promise to reject`);
        }
        const result = new Expectation(err).toBe(expected);
        if (!result.pass) {
          throw new Error(`Expected ${JSON.stringify(result.actual)} to be ${JSON.stringify(result.expected)}`);
        }
      },
    },
  };
}

// expect.any
(expect as any).any = (type: any) => ({
  __expectAny: true,
  type,
  match: (v: any) => v !== null && typeof v === type.name.toLowerCase() || v instanceof type
});

// ==================== 代码执行函数 ====================

async function executeCode(code: string): Promise<{
  success: boolean;
  output: string;
  passed: number;
  failed: number;
  pending: number;
  error?: string;
  results?: TestResults;
}> {
  try {
    resetGlobals();

    const executeCodeFn = new Function(
      'expect', 'test', 'it', 'describe',
      'beforeAll', 'afterAll', 'beforeEach', 'afterEach',
      'vi', 'console',
      `"use strict";\n${code}`
    );

    executeCodeFn(expect, test, it, describe, beforeAll, afterAll, beforeEach, afterEach, vi, console);

    await runAllTests();

    const results = collectResults();
    const output = formatResults(results);

    return {
      success: results.failed === 0,
      output,
      passed: results.passed,
      failed: results.failed,
      pending: results.pending,
      results,
    };
  } catch (error: any) {
    return {
      success: false,
      output: `Runtime Error:\n${error.message}\n\n${error.stack || ''}`,
      passed: 0,
      failed: 1,
      pending: 0,
      error: error.message,
    };
  }
}

// ==================== React Hook ====================

export function useCodeExecution() {
  const [isReady] = useState(true);

  const runCode = useCallback(async (code: string): Promise<{
    success: boolean;
    output: string;
    passed: number;
    failed: number;
    pending: number;
    error?: string;
    results?: TestResults;
  }> => {
    const timeoutPromise = new Promise<any>((_, reject) => {
      setTimeout(() => reject(new Error('Execution timeout (10s)')), 10000);
    });

    const executePromise = executeCode(code);

    return Promise.race([executePromise, timeoutPromise]).catch((error: Error) => ({
      success: false,
      output: error.message,
      passed: 0,
      failed: 1,
      pending: 0,
      error: error.message,
    }));
  }, []);

  return {
    runCode,
    isReady,
  };
}
