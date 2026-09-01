/**
 * Vitest 学习平台 - 数据定义
 */
import type { Quiz } from './types';

export interface Lesson {
  key: string;
  title: string;
  description: string;
  code: string;
  solution?: string;
  tips?: string[];
  /** M4：TDD 模式下的可见测试文件（同时作为主校验）。设置后该课时进入 TDD 模式：用户编辑实现，测试由 grader 提供 */
  grader?: string;
  /** M4：额外隐藏校验（不展示给用户，用于防作弊 / 强化验证） */
  hiddenGrader?: string;
  /** M5：知识小测 */
  quiz?: Quiz[];
  /** M6：运行环境。设为 'jsdom' 时，测试文件顶部注入 `// @vitest-environment jsdom` 并使用 .tsx（React 组件测试） */
  environment?: 'jsdom';
  /** 额外写入运行沙箱的文件（如 vi.mock 所需的真实模块），键为相对文件名，值为内容 */
  extraFiles?: Record<string, string>;
  /** 以基准模式运行（vitest bench）：用户编写 bench() 而非 test() */
  benchmark?: boolean;
}

export interface Chapter {
  key: string;
  title: string;
  description: string;
  lessons: Lesson[];
}

export interface APIData {
  name: string;
}

export const chapters: Chapter[] = [
  // ========== 第一章：Vitest 基础入门 ==========
  {
    key: 'basics',
    title: '第一章：Vitest 基础入门',
    description: '了解 Vitest 的基本概念、环境配置和运行方式',
    lessons: [
      {
        key: 'first-test',
        title: '1.1 第一个测试用例',
        description: '编写你的第一个 Vitest 测试',
        code: `// Vitest 测试入门
// test() 或 it() 用于定义测试用例

// 待测试的加法函数
function add(a, b) {
  return a + b;
}

// 编写你的第一个测试
test('add function should return correct sum', () => {
  expect(add(1, 2)).toBe(3);
});

// 尝试添加更多测试用例！
// 1. 测试 add(0, 0) 应该等于 0
// 2. 测试 add(-1, 1) 应该等于 0
// 3. 测试 add(100, 200) 应该等于 300
`,
        solution: `// 待测试的加法函数
function add(a, b) {
  return a + b;
}

// 完整测试用例
test('add function should return correct sum', () => {
  expect(add(1, 2)).toBe(3);
  expect(add(0, 0)).toBe(0);
  expect(add(-1, 1)).toBe(0);
  expect(add(100, 200)).toBe(300);
});`,
        tips: [
          'test() 是 Vitest 的核心函数，用于定义一个测试用例',
          'expect() 接收实际值，返回匹配器对象',
          'toBe() 是严格相等匹配器，使用 Object.is 比较',
          'it() 是 test() 的别名，语义更自然'
        ],
        quiz: [
          {
            question: 'Vitest 中用于定义测试用例的两个等价函数是？',
            options: ['test() 与 it()', 'describe() 与 expect()', 'assert() 与 should()', 'run() 与 check()'],
            answer: 0,
          },
          {
            question: 'toBe(3) 使用的是哪种相等判断？',
            options: ['== 宽松相等', 'Object.is 严格相等', 'JSON 字符串比较', '深比较'],
            answer: 1,
          },
        ],
      },
      {
        key: 'matchers-basic',
        title: '1.2 常用匹配器',
        description: '学习各种断言匹配器的用法',
        code: `// 常用匹配器示例
test('common matchers demo', () => {
  // 1. 严格相等 toBe
  expect(2 + 2).toBe(4);
  expect('hello').toBe('hello');

  // 2. 深度相等 toEqual（用于对象和数组）
  expect({ name: 'Vitest' }).toEqual({ name: 'Vitest' });
  expect([1, 2, 3]).toEqual([1, 2, 3]);

  // 3. 真假判断
  expect(null).toBeNull();
  expect(undefined).toBeUndefined();
  expect('').toBeFalsy();
  expect(1).toBeTruthy();

  // 4. 包含判断
  expect('Hello Vitest').toContain('Vitest');
  expect([1, 2, 3]).toContain(2);

  // 5. 正则匹配
  expect('hello world').toMatch(/hello/);

  // 6. 数值比较
  expect(10).toBeGreaterThan(5);
  expect(3).toBeLessThan(10);
});
`,
        solution: `test('common matchers - complete', () => {
  // 严格相等
  expect(2 + 2).toBe(4);
  expect(2 + 2).not.toBe(5); // not 取反

  // 深度相等
  expect({ a: 1 }).toEqual({ a: 1 });
  expect([1, 2, 3]).toEqual([1, 2, 3]);

  // 真假判断
  expect(null).toBeNull();
  expect(undefined).toBeUndefined();
  expect('').toBeFalsy();
  expect(1).toBeTruthy();
  expect(NaN).toBeNaN();

  // 包含
  expect('Hello').toContain('ell');
  expect([1, 2]).toContain(1);

  // 正则
  expect('hello123').toMatch(/\\d+/);

  // 数值
  expect(10).toBeGreaterThan(5);
  expect(3).toBeLessThan(10);
  expect(5).toBeGreaterThanOrEqual(5);
});`,
        tips: [
          'toBe() 使用 Object.is() 进行比较',
          'toEqual() 递归检查对象/数组的每个属性',
          'toContain() 可以检查数组、字符串、Map、Set 等',
          '使用 .not 取反任何匹配器'
        ]
      },
      {
        key: 'run-mode',
        title: '1.3 测试运行模式',
        description: '了解 Vitest 的各种运行方式',
        code: `// Vitest 运行模式
// 在终端运行不同的命令体验效果

// 运行所有测试（watch 模式，会监听文件变化）
// vitest

// 单次运行（CI/CD 常用）
// vitest run

// 指定文件运行
// vitest run src/example.test.ts

// UI 模式（可视化界面）
// vitest --ui

// 覆盖模式（不watch，只跑一次）
// vitest --run

// 只运行包含指定名称的测试
// vitest -t "add function"

// 下面用真实用例演示各种运行方式的效果
describe('Vitest CLI Commands', () => {
  test('vitest run - 单次运行测试', () => {
    expect(true).toBe(true);
  });

  test('vitest -t "demo" 只运行匹配的测试', () => {
    expect('demo').toContain('demo');
  });
});
`,
        solution: `// 常用命令速查
describe('Vitest CLI Commands', () => {
  test('vitest run - 单次运行测试', () => {
    expect(true).toBe(true);
  });

  test('vitest - 监听模式', () => {
    expect(true).toBe(true);
  });

  test('vitest --ui - 可视化界面', () => {
    expect(true).toBe(true);
  });
});`,
        tips: [
          'vitest run 执行一次测试后退出',
          'vitest (不带参数) 默认进入 watch 模式',
          'vitest --ui 提供可视化测试界面',
          '按 q 退出 watch 模式'
        ]
      }
    ]
  },

  // ========== 第二章：测试结构 ==========
  {
    key: 'structure',
    title: '第二章：测试结构',
    description: '学习 describe、it、beforeEach 等测试组织结构',
    lessons: [
      {
        key: 'describe-it',
        title: '2.1 describe 和 it',
        description: '用 describe 分组测试，用 it 描述测试用例',
        code: `// describe 用于将相关测试分组
// it 是 test 的别名，语义更自然

describe('Calculator', () => {
  describe('add', () => {
    it('should add two positive numbers', () => {
      expect(1 + 2).toBe(3);
    });

    it('should handle negative numbers', () => {
      expect(-1 + 1).toBe(0);
    });
  });

  describe('subtract', () => {
    it('should subtract two numbers', () => {
      expect(5 - 3).toBe(2);
    });
  });
});
`,
        solution: `describe('Calculator', () => {
  let calculator;

  beforeEach(() => {
    calculator = {
      add: (a, b) => a + b,
      subtract: (a, b) => a - b,
      multiply: (a, b) => a * b,
      divide: (a, b) => a / b
    };
  });

  describe('add', () => {
    it('adds positive numbers', () => {
      expect(calculator.add(1, 2)).toBe(3);
    });
    it('adds negative numbers', () => {
      expect(calculator.add(-1, 1)).toBe(0);
    });
    it('adds zero', () => {
      expect(calculator.add(5, 0)).toBe(5);
    });
  });

  describe('subtract', () => {
    it('subtracts numbers', () => {
      expect(calculator.subtract(5, 3)).toBe(2);
    });
  });
});`,
        tips: [
          'describe 创建测试套件，it/test 创建测试用例',
          '嵌套的 describe 有助于组织相关测试',
          'describe 内的变量对子测试可见',
          '描述文本推荐使用 "should" 风格'
        ]
      },
      {
        key: 'before-after',
        title: '2.2 生命周期钩子',
        description: 'beforeEach/afterEach/beforeAll/afterAll 的使用',
        code: `// 生命周期钩子在测试套件中执行
describe('Lifecycle Hooks Demo', () => {
  let counter = 0;

  beforeAll(() => {
    // 在所有测试之前执行一次
    console.log('beforeAll - 首次执行');
  });

  beforeEach(() => {
    // 在每个测试之前执行
    counter += 1;
    console.log('beforeEach - 重置状态');
  });

  afterEach(() => {
    // 在每个测试之后执行
    console.log('afterEach - 清理');
  });

  afterAll(() => {
    // 在所有测试之后执行一次
    console.log('afterAll - 全部结束');
  });

  test('first test', () => {
    expect(counter).toBe(1);
  });

  test('second test', () => {
    expect(counter).toBe(2);
  });
});
`,
        solution: `describe('Lifecycle Demo', () => {
  let db;

  beforeAll(async () => {
    // 模拟数据库连接
    db = { query: () => [], connected: true };
    console.log('Database connected');
  });

  beforeEach(() => {
    // 每个测试前重置数据
    db.data = [];
  });

  afterAll(() => {
    // 关闭连接
    db.connected = false;
    console.log('Database disconnected');
  });

  test('first operation', () => {
    db.data.push(1);
    expect(db.data.length).toBe(1);
  });

  test('second operation', () => {
    db.data.push(2);
    expect(db.data.length).toBe(1); // 因为 beforeEach 已重置
  });
});`,
        tips: [
          'beforeAll/afterAll 在整个套件前后执行一次',
          'beforeEach/afterEach 在每个测试前后执行',
          'beforeEach 最常用于重置共享状态',
          '异步操作记得用 async/await'
        ]
      },
      {
        key: 'skip-only',
        title: '2.3 跳过和专注测试',
        description: '使用 skip、only、todo 控制测试执行',
        code: `// 跳过某些测试，只运行特定的测试

test('always run this', () => {
  expect(true).toBe(true);
});

// skip - 跳过这个测试
test.skip('skip this test', () => {
  throw new Error('This should never run');
});

// only - 只运行这个测试（调试时很有用）
test.only('only this test runs', () => {
  expect('focused').toBeTruthy();
});

// todo - 标记待实现的测试
test.todo('implement this later');
`,
        solution: `describe('Test Control', () => {
  test('normal test', () => {
    expect(1 + 1).toBe(2);
  });

  // 使用 describe.skip 跳过整个测试套件
  describe.skip('skipped suite', () => {
    test('this will not run', () => {
      expect(true).toBe(false);
    });
  });

  // 使用 describe.only 只运行特定套件
  describe.only('focused suite', () => {
    test('runs this', () => {
      expect('a').toBe('a');
    });
  });

  // todo 标记计划要写的测试
  test.todo('add validation test');
  test.todo('add error handling test');
});`,
        tips: [
          'test.skip() 或 it.skip() 跳过测试',
          'test.only() 只运行这一个测试',
          'test.todo() 标记计划要写的测试',
          'describe.skip/describe.only 可以控制整个套件'
        ]
      }
    ]
  },

  // ========== 第三章：Mock 与 Stub ==========
  {
    key: 'mock',
    title: '第三章：Mock 与 Stub',
    description: '学习模拟函数、模块和方法监控',
    lessons: [
      {
        key: 'vi-fn',
        title: '3.1 vi.fn() 模拟函数',
        description: '创建和控制函数的调用行为',
        code: `// vi.fn() 创建一个模拟函数
test('vi.fn() basics', () => {
  // 创建模拟函数
  const mockFn = vi.fn();

  // 调用函数
  mockFn('hello', 123);

  // 检查调用次数
  expect(mockFn).toHaveBeenCalledTimes(1);

  // 检查调用参数
  expect(mockFn).toHaveBeenCalledWith('hello', 123);

  // 检查返回值
  mockFn.mockReturnValue('mocked');
  expect(mockFn()).toBe('mocked');
});
`,
        solution: `test('vi.fn() comprehensive', () => {
  // 基本创建
  const mockFn = vi.fn();

  // 调用
  mockFn('a', 1);
  mockFn('b', 2);

  // 验证调用
  expect(mockFn).toHaveBeenCalledTimes(2);
  expect(mockFn).toHaveBeenCalledWith('a', 1);
  expect(mockFn).toHaveBeenNthCalledWith(1, 'a', 1);

  // 链式调用记录
  expect(mockFn.mock.calls[0]).toEqual(['a', 1]);
  expect(mockFn.mock.results[0].value).toBeUndefined();

  // 设置返回值
  mockFn.mockReturnValue('result');
  expect(mockFn()).toBe('result');

  // 清除记录
  mockFn.mockClear();
  expect(mockFn).toHaveBeenCalledTimes(0);

  // 设置实现
  mockFn.mockImplementation((x) => x * 2);
  expect(mockFn(5)).toBe(10);
});`,
        tips: [
          'mockFn.mock.calls 记录所有调用参数',
          'mockReturnValue 设置固定返回值',
          'mockImplementation 自定义实现逻辑',
          'mockClear() 清除调用记录'
        ]
      },
      {
        key: 'vi-mock',
        title: '3.2 vi.mock() 模块模拟',
        description: '模拟整个模块的导入',
        code: `// vi.mock() 用于模拟整个模块
// 注意：需要将模拟代码写在模块顶部

// 假设我们有一个 API 模块
// api.ts
// export const fetchUser = (id) => fetch(\`/api/users/\${id}\`);

// 测试文件
vi.mock('./api', () => ({
  fetchUser: vi.fn().mockResolvedValue({ id: 1, name: 'Test' })
}));

test('mocked fetchUser', async () => {
  const { fetchUser } = await import('./api');
  const user = await fetchUser(1);
  expect(user.name).toBe('Test');
});
`,
        solution: `// 模拟整个模块
vi.mock('./api', () => ({
  getUser: vi.fn(),
  createUser: vi.fn(),
  deleteUser: vi.fn()
}));

import { getUser, createUser } from './api';

test('mock API calls', async () => {
  // 模拟成功响应
  getUser.mockResolvedValue({ id: 1, name: 'Alice' });

  const user = await getUser(1);
  expect(user.name).toBe('Alice');

  // 模拟失败响应
  getUser.mockRejectedValue(new Error('Not found'));

  await expect(getUser(999)).rejects.toThrow('Not found');

  // 模拟不同返回值
  getUser
    .mockResolvedValueOnce({ id: 1, name: 'Bob' })
    .mockResolvedValueOnce({ id: 2, name: 'Carol' });

  expect(await getUser(1)).toEqual({ id: 1, name: 'Bob' });
  expect(await getUser(2)).toEqual({ id: 2, name: 'Carol' });
});`,
        // vi.mock 需要模块真实可解析，故额外提供一个 api 模块文件供 mock 替换
        extraFiles: {
          'api.ts': `// 真实 API 模块（测试中会被 vi.mock 替换）
export const fetchUser = (id: number) => Promise.resolve({ id, name: \`User \${id}\` });
export const getUser = (id: number) => Promise.resolve({ id, name: \`User \${id}\` });
export const createUser = (data: { name: string }) => Promise.resolve({ id: 99, ...data });
export const deleteUser = (id: number) => Promise.resolve(true);
`,
        },
        tips: [
          'vi.mock() 会提升到文件顶部自动执行',
          '使用 mockResolvedValue 模拟异步成功',
          '使用 mockRejectedValue 模拟异步失败',
          'mockResolvedValueOnce 只在下次调用生效'
        ]
      },
      {
        key: 'vi-spy',
        title: '3.3 vi.spyOn() 方法监控',
        description: '监听对象方法的调用',
        code: `// vi.spyOn() 监听对象方法，不改变其行为
const obj = {
  getName: () => 'original',
  value: 42
};

test('spyOn method', () => {
  const spy = vi.spyOn(obj, 'getName');

  // 调用方法
  const result = obj.getName();

  // 验证调用
  expect(spy).toHaveBeenCalled();
  expect(result).toBe('original'); // 原行为保持不变

  // 修改实现
  spy.mockReturnValue('mocked');
  expect(obj.getName()).toBe('mocked');

  // 恢复原实现
  spy.mockRestore();
  expect(obj.getName()).toBe('original');
});
`,
        solution: `test('spyOn with objects', () => {
  const mathObj = {
    multiply: (a, b) => a * b,
    add: (a, b) => a + b
  };

  // 监控 multiply
  const spy = vi.spyOn(mathObj, 'multiply');

  // 原始行为
  expect(mathObj.multiply(3, 4)).toBe(12);
  expect(spy).toHaveBeenCalledWith(3, 4);

  // 修改实现
  spy.mockReturnValue(100);
  expect(mathObj.multiply(1, 1)).toBe(100);

  // 恢复
  spy.mockRestore();
  expect(mathObj.multiply(3, 4)).toBe(12);

  // 监控 add
  const spyAdd = vi.spyOn(mathObj, 'add');
  mathObj.add(1, 2);
  expect(spyAdd).toHaveBeenCalledTimes(1);
});`,
        tips: [
          'spyOn 不会改变原方法的实现',
          'mockRestore() 恢复原始方法',
          '常用于测试方法的调用次数和参数',
          '只能 spy 对象上已存在的属性'
        ]
      },
      {
        key: 'vi-clear',
        title: '3.4 清除和重置 Mock',
        description: '学习如何清理 mock 状态',
        code: `// 清除和重置 mock
const mockFn = vi.fn();

test('clear mocks', () => {
  mockFn('call 1');
  mockFn('call 2');

  expect(mockFn).toHaveBeenCalledTimes(2);

  // 清除调用记录
  mockFn.mockClear();

  expect(mockFn).toHaveBeenCalledTimes(0);
});
`,
        solution: `test('mock reset vs clear', () => {
  const mockFn = vi.fn().mockReturnValue('initial');

  // 初始调用
  expect(mockFn()).toBe('initial');
  expect(mockFn).toHaveBeenCalledTimes(1);

  // mockReset 完全重置
  mockFn.mockReset();
  expect(mockFn()).toBeUndefined(); // 返回值也被清空

  // mockClear 只清除调用记录
  mockFn.mockReturnValue('value');
  mockFn();
  mockFn.mockClear();
  expect(mockFn()).toBe('value'); // 返回值保留

  // 重置所有 mock
  vi.restoreAllMocks(); // 恢复所有被 spy 的方法
});`,
        tips: [
          'mockClear() 只清除调用记录',
          'mockReset() 完全重置 mock 状态',
          'vi.restoreAllMocks() 恢复所有被 spy 的方法',
          '在 beforeEach 中常用 mockClear()'
        ]
      }
    ]
  },

  // ========== 第四章：异步测试 ==========
  {
    key: 'async',
    title: '第四章：异步测试',
    description: '测试 Promise、async/await 和错误处理',
    lessons: [
      {
        key: 'async-await',
        title: '4.1 async/await 测试',
        description: '用 async/await 测试异步函数',
        code: `// 使用 async/await 测试异步函数
const fetchData = () => Promise.resolve({ id: 1, name: 'Async' });

test('async function with await', async () => {
  const data = await fetchData();
  expect(data.name).toBe('Async');
});

// 使用 resolves/rejects 匹配器
test('async with resolves', async () => {
  await expect(fetchData()).resolves.toEqual({ id: 1, name: 'Async' });
});

// 模拟异步数据
const fetchUser = (id) => Promise.resolve({ id, name: \`User \${id}\` });

test('fetch user', async () => {
  const user = await fetchUser(42);
  expect(user).toEqual({ id: 42, name: 'User 42' });
});
`,
        solution: `// 异步测试完整示例
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const fetchUser = (id) => Promise.resolve({ id, name: \`User \${id}\`);
const fetchUserAsync = async (id) => {
  await delay(10);
  return { id, name: \`User \${id}\` };
};

test('async/await basic', async () => {
  const user = await fetchUser(1);
  expect(user.name).toBe('User 1');
});

test('resolves matcher', async () => {
  await expect(fetchUser(2)).resolves.toEqual({ id: 2, name: 'User 2' });
});

test('async function with delay', async () => {
  const start = Date.now();
  const user = await fetchUserAsync(3);
  const elapsed = Date.now() - start;
  expect(user.id).toBe(3);
  expect(elapsed).toBeGreaterThanOrEqual(10);
});`,
        tips: [
          '测试函数标记 async，await 等待 Promise',
          'resolves/rejects 自动 unwrap Promise',
          '记得在 test 函数前加 async',
          'await expect().resolves 更易读'
        ]
      },
      {
        key: 'promise-test',
        title: '4.2 Promise 链式测试',
        description: '使用 .then().catch() 链式调用',
        code: `// Promise 链式测试
const fetchData = () => Promise.resolve({ id: 1, name: 'Async' });

test('promise chain', () => {
  return fetchData()
    .then(data => {
      expect(data.name).toBe('Async');
      return data.id;
    })
    .then(id => {
      expect(id).toBe(1);
    });
});

// 使用 .rejects 测试错误
const fetchWithError = () => Promise.reject(new Error('Not found'));

test('promise rejection', () => {
  return expect(fetchWithError()).rejects.toThrow('Not found');
});
`,
        solution: `// Promise 链式完整示例
const fetchUser = (id) => Promise.resolve({ id, name: \`User \${id}\` });
const fetchError = () => Promise.reject(new Error('API Error'));

test('promise then chain', () => {
  return fetchUser(1)
    .then(user => {
      expect(user.name).toBe('User 1');
      return user.id;
    })
    .then(id => {
      expect(id).toBe(1);
      return fetchUser(id + 1);
    })
    .then(newUser => {
      expect(newUser.id).toBe(2);
    });
});

test('promise catch chain', () => {
  return fetchError()
    .catch(err => {
      expect(err.message).toBe('API Error');
      return { error: true };
    })
    .then(result => {
      expect(result.error).toBe(true);
    });
});

test('promise finally', () => {
  let cleaned = false;
  return fetchUser(1)
    .finally(() => {
      cleaned = true;
    })
    .then(() => {
      expect(cleaned).toBe(true);
    });
});`,
        tips: [
          '返回 Promise 以确保 Vitest 等待完成',
          '.rejects.toThrow() 检查抛出的错误',
          '.finally() 常用于清理资源',
          '不要忘记 return Promise'
        ]
      },
      {
        key: 'error-handling',
        title: '4.3 错误处理测试',
        description: '测试同步和异步代码的错误抛出',
        code: `// 测试错误抛出
const throwError = () => {
  throw new Error('Sync error!');
};

test('sync error', () => {
  expect(throwError).toThrow('Sync error!');
  expect(throwError).toThrowError(/sync/i);
});

// 异步错误处理
const asyncError = async () => {
  throw new Error('Async error!');
};

test('async error with rejects', async () => {
  await expect(asyncError()).rejects.toThrow('Async error!');
});
`,
        solution: `// 错误处理完整示例
const syncThrow = () => { throw new TypeError('Invalid type'); };
const asyncThrow = async () => { throw new Error('Async error'); };
const conditionalThrow = (flag) => {
  if (flag) throw new Error('Flag is true');
};

test('toThrow - sync error', () => {
  expect(syncThrow).toThrow();
  expect(syncThrow).toThrow('Invalid type');
  expect(syncThrow).toThrow(TypeError);
  expect(syncThrow).toThrow(/type/i);
});

test('toThrowError - alias', () => {
  expect(syncThrow).toThrowError('Invalid type');
});

test('rejects - async error', async () => {
  await expect(asyncThrow()).rejects.toThrow('Async error');
  await expect(asyncThrow()).rejects.toThrowError();
});

test('conditional throw', () => {
  expect(() => conditionalThrow(true)).toThrow();
  expect(() => conditionalThrow(false)).not.toThrow();
});

test('try/catch manual', async () => {
  try {
    await asyncThrow();
    fail('Should have thrown'); // 不会执行到这里
  } catch (e) {
    expect(e.message).toBe('Async error');
  }
});`,
        tips: [
          'toThrow() 期望函数抛出错误',
          'async 错误用 .rejects.toThrow()',
          '可以用 try/catch 手动验证错误信息',
          'toThrow() 期望的是函数，不是函数调用'
        ]
      }
    ]
  },

  // ========== 第五章：数组和对象测试 ==========
  {
    key: 'array-object',
    title: '第五章：数组和对象测试',
    description: '深度匹配器、嵌套对象和数组测试技巧',
    lessons: [
      {
        key: 'deep-equal',
        title: '5.1 toEqual vs toBe',
        description: '深度相等与严格相等的区别',
        code: `// toBe vs toEqual
test('toBe vs toEqual', () => {
  const obj = { name: 'test' };

  // toBe 使用 Object.is() - 比较引用
  expect(obj).not.toBe({ name: 'test' }); // 不同引用

  // toEqual 深度比较 - 递归检查每个属性
  expect(obj).toEqual({ name: 'test' }); // 相同内容

  // 数组也适用
  const arr = [1, 2, 3];
  expect(arr).not.toBe([1, 2, 3]);
  expect(arr).toEqual([1, 2, 3]);

  // 嵌套对象
  const nested = { user: { name: 'Alice', age: 25 } };
  expect(nested).toEqual({ user: { name: 'Alice', age: 25 } });
});
`,
        solution: `// 深度比较完整示例
test('deep equality', () => {
  // 简单值
  expect(5).toBe(5);
  expect(5).toEqual(5);

  // 数组
  expect([1, 2, 3]).toEqual([1, 2, 3]);
  expect([1, [2, 3]]).toEqual([1, [2, 3]]);

  // 对象
  const user = { name: 'Alice', age: 25 };
  expect(user).toEqual({ name: 'Alice', age: 25 });
  expect(user).not.toBe({ name: 'Alice', age: 25 });

  // 嵌套结构
  const apiResponse = {
    data: {
      users: [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' }
      ],
      meta: { total: 2, page: 1 }
    },
    status: 200
  };

  expect(apiResponse.data.users).toHaveLength(2);
  expect(apiResponse.data.users[0]).toEqual({ id: 1, name: 'Alice' });
  expect(apiResponse.data.meta.total).toBe(2);
});`,
        tips: [
          'toBe() 使用 Object.is() 比较引用',
          'toEqual() 递归比较每个属性值',
          '对于原始类型两者效果相同',
          '对象和数组比较用 toEqual()'
        ]
      },
      {
        key: 'array-matchers',
        title: '5.2 数组匹配器',
        description: '测试数组长度、包含和部分匹配',
        code: `// 数组匹配器
test('array matchers', () => {
  const numbers = [1, 2, 3, 4, 5];
  const users = [
    { name: 'Alice', age: 25 },
    { name: 'Bob', age: 30 }
  ];

  // 数组长度
  expect(numbers).toHaveLength(5);

  // 包含元素
  expect(numbers).toContain(3);
  expect(users).toContainEqual({ name: 'Alice', age: 25 });

  // 包含（使用深度相等）
  expect(numbers).toContain(3);

  // 数组元素满足条件
  expect(numbers).toEqual(
    expect.arrayContaining([1, 2, 3])
  );

  // 对象数组成员
  expect(users).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: 'Alice' })
    ])
  );
});
`,
        solution: `// 数组匹配器完整示例
test('array matchers comprehensive', () => {
  const products = [
    { id: 1, name: 'Apple', price: 10, tags: ['fruit', 'fresh'] },
    { id: 2, name: 'Bread', price: 5, tags: ['bakery'] },
    { id: 3, name: 'Milk', price: 8, tags: ['dairy', 'fresh'] }
  ];

  // 基本匹配
  expect(products).toHaveLength(3);
  expect(products).toContainEqual({ id: 1, name: 'Apple', price: 10, tags: ['fruit', 'fresh'] });

  // 数组部分匹配
  expect(products).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: 1, name: 'Apple' })
    ])
  );

  // 至少包含某些元素
  expect(products).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: 'Apple' }),
      expect.objectContaining({ name: 'Milk' })
    ])
  );

  // 每个元素满足条件
  products.forEach(product => {
    expect(product.id).toBeGreaterThan(0);
    expect(product.price).toBeGreaterThan(0);
  });

  // 查找特定元素
  const expensive = products.find(p => p.price > 8);
  expect(expensive?.name).toBe('Apple');
});`,
        tips: [
          'toHaveLength() 检查数组长度',
          'toContain() 检查元素存在（严格相等）',
          'toContainEqual() 检查深度相等',
          'arrayContaining + objectContaining 组合使用'
        ]
      },
      {
        key: 'object-matchers',
        title: '5.3 对象匹配器',
        description: '测试对象属性、部分匹配和扩展',
        code: `// 对象匹配器
test('object matchers', () => {
  const user = {
    id: 1,
    name: 'Alice',
    email: 'alice@example.com',
    age: 25,
    address: {
      city: 'Beijing',
      zip: '100000'
    }
  };

  // 对象部分匹配
  expect(user).toEqual(
    expect.objectContaining({
      name: 'Alice',
      age: 25
    })
  );

  // 检查对象键
  expect(user).toHaveProperty('id');
  expect(user).toHaveProperty('address.city');

  // 嵌套对象匹配
  expect(user).toEqual(
    expect.objectContaining({
      address: expect.objectContaining({
        city: 'Beijing'
      })
    })
  );
});
`,
        solution: `// 对象匹配器完整示例
test('object matchers comprehensive', () => {
  const config = {
    app: {
      name: 'MyApp',
      version: '1.0.0',
      env: 'production'
    },
    database: {
      host: 'localhost',
      port: 5432,
      credentials: {
        user: 'admin',
        password: 'secret'
      }
    },
    features: ['auth', 'analytics', 'billing']
  };

  // 部分匹配
  expect(config).toEqual(
    expect.objectContaining({
      app: expect.objectContaining({
        name: 'MyApp',
        version: '1.0.0'
      })
    })
  );

  // 检查属性存在
  expect(config).toHaveProperty('app.name');
  expect(config).toHaveProperty('database.port');
  expect(config).toHaveProperty('database.credentials.user');

  // 属性值匹配
  expect(config.app.name).toBe('MyApp');
  expect(config.database.port).toBe(5432);

  // 数组属性
  expect(config.features).toContain('auth');

  // 深度嵌套
  expect(config.database.credentials.user).toBe('admin');

  // 使用 not
  expect(config.app.env).not.toBe('development');
});`,
        tips: [
          'toHaveProperty() 检查嵌套属性',
          'objectContaining() 只需包含指定属性',
          '可以嵌套使用 objectContaining',
          '用 not 排除某些属性'
        ]
      },
      {
        key: 'combined-matchers',
        title: '5.4 组合匹配器',
        description: '组合使用多个匹配器',
        code: `// 组合匹配器
test('combined matchers', () => {
  const users = [
    { id: 1, name: 'Alice', role: 'admin', active: true },
    { id: 2, name: 'Bob', role: 'user', active: true },
    { id: 3, name: 'Carol', role: 'user', active: false }
  ];

  // 数组 + 对象组合
  expect(users).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        role: 'admin',
        active: true
      })
    ])
  );

  // 至少包含一个匹配
  expect(users).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: 'Alice' }),
      expect.objectContaining({ name: 'Bob' })
    ])
  );
});
`,
        solution: `// 组合匹配器完整示例
test('combined matchers advanced', () => {
  const apiResponse = {
    status: 200,
    data: {
      users: [
        { id: 1, name: 'Alice', scores: [90, 85, 88] },
        { id: 2, name: 'Bob', scores: [75, 80, 72] },
        { id: 3, name: 'Carol', scores: [95, 92, 98] }
      ],
      pagination: { page: 1, perPage: 10, total: 3 }
    }
  };

  // 状态 + 数据组合
  expect(apiResponse).toEqual(
    expect.objectContaining({
      status: 200,
      data: expect.objectContaining({
        users: expect.arrayContaining([
          expect.objectContaining({ name: 'Alice' })
        ])
      })
    })
  );

  // 数组中每个对象的部分匹配
  const allHaveScores = apiResponse.data.users.every(
    user => user.scores && user.scores.length > 0
  );
  expect(allHaveScores).toBe(true);

  // 多个条件组合
  expect(apiResponse.data.users).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        name: 'Alice',
        scores: expect.arrayContaining([expect.any(Number)])
      })
    ])
  );

  // any 类型匹配
  expect([1, 'a', true]).toEqual(
    expect.arrayContaining([expect.any(Number)])
  );
});`,
        tips: [
          'arrayContaining + objectContaining 组合',
          'every() + expect.any() 检查所有元素',
          'expect.any(Type) 匹配任何该类型的值',
          '可以无限嵌套匹配器'
        ]
      }
    ]
  },

  // ========== 第六章：Timer 和 Fake Timers ==========
  {
    key: 'timers',
    title: '第六章：Timer 和 Fake Timers',
    description: '控制时间、模拟 setTimeout 和 setInterval',
    lessons: [
      {
        key: 'fake-timers',
        title: '6.1 假时钟',
        description: '使用 fake timers 控制时间',
        code: `// fake timers - 假时钟
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

test('fake timers basic', () => {
  const callback = vi.fn();

  setTimeout(callback, 1000);

  // 时间未到，callback 未执行
  expect(callback).not.toHaveBeenCalled();

  // 快进 1 秒
  vi.advanceTimersByTime(1000);

  // callback 执行了
  expect(callback).toHaveBeenCalled();
});
`,
        solution: `// fake timers 完整示例
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

test('advance timers by time', () => {
  const fn = vi.fn();

  setTimeout(fn, 100);
  setTimeout(fn, 200);
  setTimeout(fn, 300);

  vi.advanceTimersByTime(150);
  expect(fn).toHaveBeenCalledTimes(1);

  vi.advanceTimersByTime(50); // 累计 200ms，触发第 2 个
  expect(fn).toHaveBeenCalledTimes(2);

  vi.advanceTimersByTime(100); // 累计 300ms，触发第 3 个
  expect(fn).toHaveBeenCalledTimes(3);

  vi.advanceTimersByTime(1000); // 全部触发完，不再变化
  expect(fn).toHaveBeenCalledTimes(3);
});

test('advance to timer', () => {
  const fn = vi.fn();
  setTimeout(fn, 1000);

  vi.advanceTimersToNextTimer();
  expect(fn).toHaveBeenCalled();
});

test('run all timers', () => {
  const fn = vi.fn();
  setTimeout(fn, 100);
  setTimeout(fn, 200);

  vi.runAllTimers();
  expect(fn).toHaveBeenCalledTimes(2);
});`,
        tips: [
          'vi.useFakeTimers() 启用假时钟',
          'vi.useRealTimers() 恢复正常时钟',
          'advanceTimersByTime(ms) 快进指定时间',
          'beforeEach/afterEach 管理时钟状态'
        ]
      },
      {
        key: 'setinterval',
        title: '6.2 setInterval 测试',
        description: '测试定时器循环',
        code: `// setInterval 测试
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

test('setInterval', () => {
  const fn = vi.fn();
  let count = 0;

  const id = setInterval(() => {
    count++;
    fn();
  }, 100);

  // 快进 350ms，应该执行 3 次
  vi.advanceTimersByTime(350);

  expect(count).toBe(3);
  expect(fn).toHaveBeenCalledTimes(3);

  // 清除定时器
  clearInterval(id);

  // 再快进 500ms，不应该再执行
  vi.advanceTimersByTime(500);
  expect(fn).toHaveBeenCalledTimes(3);
});
`,
        solution: `// setInterval 完整示例
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

test('countdown timer', () => {
  let count = 3;
  const callbacks = vi.fn();

  const id = setInterval(() => {
    callbacks();
    count--;
    if (count <= 0) {
      clearInterval(id);
    }
  }, 1000);

  expect(count).toBe(3);

  vi.advanceTimersByTime(1000); // 第1次
  expect(count).toBe(2);
  expect(callbacks).toHaveBeenCalledTimes(1);

  vi.advanceTimersByTime(2000); // 第2、3次
  expect(count).toBe(0);
  expect(callbacks).toHaveBeenCalledTimes(3);

  vi.advanceTimersByTime(1000); // 定时器已清除，不再执行
  expect(callbacks).toHaveBeenCalledTimes(3);
});

test('pause and resume simulation', () => {
  let tick = 0;
  const id = setInterval(() => tick++, 100);

  vi.advanceTimersByTime(250);
  expect(tick).toBe(2);

  // 模拟暂停（不清除，只是"不调用"）
  vi.advanceTimersByTime(1000); // 继续运行
  expect(tick).toBe(12);

  clearInterval(id);
});`,
        tips: [
          'setInterval 会在每个周期执行',
          '记得在适当时候 clearInterval',
          '用 advanceTimersByTime 快进',
          '可以用 clearInterval 停止'
        ]
      },
      {
        key: 'date-fake',
        title: '6.3 Date 对象假时钟',
        description: '模拟 Date.now() 和 Date 对象',
        code: `// Date 假时钟
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

test('fake Date', () => {
  const now = new Date('2024-01-01T10:00:00Z');
  vi.setSystemTime(now);

  expect(Date.now()).toBe(now.getTime());
  expect(new Date().toISOString()).toBe('2024-01-01T10:00:00.000Z');

  // 快进 1 小时
  vi.advanceTimersByTime(60 * 60 * 1000);

  expect(Date.now()).toBe(now.getTime() + 60 * 60 * 1000);
});
`,
        solution: `// Date 假时钟完整示例
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

test('system time manipulation', () => {
  // 设置固定时间
  const fixedDate = new Date('2024-06-15T12:00:00Z');
  vi.setSystemTime(fixedDate);

  expect(Date.now()).toBe(fixedDate.getTime());
  expect(new Date().getFullYear()).toBe(2024);
  expect(new Date().getMonth()).toBe(5); // 0-indexed

  // 快进一天
  vi.advanceTimersByTime(24 * 60 * 60 * 1000);

  const tomorrow = new Date('2024-06-16T12:00:00Z');
  expect(Date.now()).toBe(tomorrow.getTime());

  // 设置为相对时间（基于推进后的当前时间回拨 1 秒）
  vi.setSystemTime(Date.now() - 1000);
  expect(Date.now()).toBe(tomorrow.getTime() - 1000);
});

test('date-based scheduling', () => {
  const now = Date.now();
  let expiresAt = now + 5000; // 5秒后过期

  vi.setSystemTime(now);
  expect(expiresAt - Date.now()).toBe(5000);

  vi.advanceTimersByTime(3000);
  expect(expiresAt - Date.now()).toBe(2000);

  vi.advanceTimersByTime(2000);
  expect(expiresAt - Date.now()).toBe(0);
});`,
        tips: [
          'vi.setSystemTime() 设置系统时间',
          'Date.now() 会返回设定的时间',
          '可以配合 advanceTimersByTime',
          'setSystemTime(0) 重置为 1970'
        ]
      }
    ]
  },

  // ========== 第七章：Snapshot 测试 ==========
  {
    key: 'snapshot',
    title: '第七章：Snapshot 测试',
    description: '快照测试用于 UI 和数据验证',
    lessons: [
      {
        key: 'snapshot-basic',
        title: '7.1 基础快照',
        description: '创建和使用快照',
        code: `// 快照测试
test('snapshot basic', () => {
  const user = {
    id: 1,
    name: 'Alice',
    email: 'alice@example.com',
    createdAt: new Date('2024-01-01')
  };

  // 首次运行会创建快照
  expect(user).toMatchSnapshot();
});

// 内联快照
test('inline snapshot', () => {
  const user = { name: 'Bob', age: 25 };

  // 快照内容直接内联在断言处
  expect(user).toMatchInlineSnapshot(\`
    {
      "age": 25,
      "name": "Bob",
    }
  \`);
});
`,
        solution: `// 快照测试完整示例
test('toMatchSnapshot', () => {
  const component = {
    type: 'div',
    props: {
      className: 'container',
      children: [
        { type: 'h1', props: { children: 'Hello' } },
        { type: 'p', props: { children: 'World' } }
      ]
    }
  };

  // 首次运行会创建快照文件
  expect(component).toMatchSnapshot();
});

test('toMatchSnapshot with property matchers', () => {
  const user = {
    id: 1,
    name: 'Carol',
    createdAt: new Date('2024-01-01'),
    token: 'abc123'
  };

  // 对动态值使用 matcher，避免快照因时间/随机值频繁失效
  expect(user).toMatchSnapshot({
    id: expect.any(Number),
    createdAt: expect.any(Date),
    token: expect.any(String)
  });
});

test('toMatchInlineSnapshot', () => {
  const data = {
    items: ['a', 'b', 'c'],
    count: 3
  };

  // Vitest 会自动填充快照内容
  expect(data).toMatchInlineSnapshot(\`
    {
      "count": 3,
      "items": [
        "a",
        "b",
        "c",
      ],
    }
  \`);
});`,
        tips: [
          '首次运行会创建 .snap 文件',
          '代码变更后需要更新快照 (-u)',
          '快照记录数据/UI 的精确状态',
          '用 --updateSnapshot 更新'
        ]
      },
      {
        key: 'snapshot-update',
        title: '7.2 更新快照',
        description: '如何管理和更新快照',
        code: `// 更新快照
// 运行测试时添加 -u 或 --update 参数
// vitest run -u

// 在测试中更新单个快照
test('update specific snapshot', () => {
  const data = { version: '2.0.0', features: ['a', 'b'] };

  // 强制更新这个快照
  expect(data).toMatchSnapshot({
    version: '2.0.0',
    features: ['a', 'b']
  });
});
`,
        solution: `// 快照更新策略
describe('Snapshot Update', () => {
  test('add new fields - update snapshot', () => {
    const user = {
      id: 1,
      name: 'Alice',
      // 新增字段
      avatar: 'https://example.com/avatar.jpg',
      role: 'admin'
    };

    // 运行 vitest run -u 更新快照
    expect(user).toMatchSnapshot();
  });

  test('remove fields - update snapshot', () => {
    const config = {
      // 删除了 debug 字段
      production: true
    };

    expect(config).toMatchSnapshot();
  });

  test('property matchers for dynamic values', () => {
    const session = {
      id: 'session-123',
      createdAt: new Date('2024-01-01'),
      data: { key: 'value' }
    };

    // 动态值用 matchers，避免频繁更新
    expect(session).toMatchSnapshot({
      id: expect.any(String),
      createdAt: expect.any(Date)
    });
  });
});`,
        tips: [
          'vitest run -u 更新所有快照',
          '只更新失败测试的快照: vitest run -u -f pattern',
          'property matchers 处理动态值',
          '快照应该加入版本控制'
        ]
      }
    ]
  },

  // ========== 第八章：高级测试技巧 ==========
  {
    key: 'advanced',
    title: '第八章：高级测试技巧',
    description: '测试配置、重复测试和自定义匹配器',
    lessons: [
      {
        key: 'test-each',
        title: '8.1 参数化测试',
        description: '使用 test.each 运行多次相似测试',
        code: `// 参数化测试
describe('test.each', () => {
  // 数组参数
  test.each([
    [1, 1, 2],
    [2, 3, 5],
    [0, 0, 0]
  ])('add(%i, %i) should return %i', (a, b, expected) => {
    expect(a + b).toBe(expected);
  });

  // 对象参数
  test.each([
    { a: 1, b: 2, expected: 3 },
    { a: 0, b: 0, expected: 0 },
    { a: -1, b: 1, expected: 0 }
  ])('add object: $a + $b = $expected', ({ a, b, expected }) => {
    expect(a + b).toBe(expected);
  });
});
`,
        solution: `// 参数化测试完整示例
describe('Math Operations', () => {
  // 加法
  test.each([
    [1, 1, 2],
    [2, 3, 5],
    [0, 0, 0],
    [-1, 1, 0],
    [100, 200, 300]
  ])('add: %i + %i = %i', (a, b, expected) => {
    expect(a + b).toBe(expected);
  });

  // 乘法
  test.each([
    [2, 3, 6],
    [0, 5, 0],
    [-2, 3, -6],
    [4, 4, 16]
  ])('multiply: %i * %i = %i', (a, b, expected) => {
    expect(a * b).toBe(expected);
  });
});

describe('String Operations', () => {
  test.each([
    ['hello', 'HELLO'],
    ['WORLD', 'world'],
    ['Test', 'TEST'],
    ['', '']
  ])('toggleCase: "%s" -> "%s"', (input, expected) => {
    const toggleCase = (s) => s === s.toUpperCase()
      ? s.toLowerCase()
      : s.toUpperCase();
    expect(toggleCase(input)).toBe(expected);
  });
});

describe('Edge Cases', () => {
  test.each([
    { input: '', expected: true },
    { input: '   ', expected: true }, // 全空格 trim 后为空字符串
    { input: 'a', expected: false }
  ])('isEmpty: "$input" -> $expected', ({ input, expected }) => {
    expect(input.trim().length === 0).toBe(expected);
  });
});`,
        tips: [
          'test.each() 用法: (数组) 或 (模板字符串)',
          '$variable 语法访问对象属性',
          '%i, %s, %j 格式化输出',
          '大大减少重复代码'
        ]
      },
      {
        key: 'custom-matchers',
        title: '8.2 自定义匹配器',
        description: '创建可重用的自定义断言',
        code: `// 自定义匹配器（通过 expect.extend）
expect.extend({
  toBeDivisibleBy(received, divisor) {
    const pass = received % divisor === 0;
    return {
      pass,
      message: () =>
        pass
          ? \`\${received} is divisible by \${divisor}\`
          : \`\${received} is not divisible by \${divisor}\`
    };
  }
});

test('custom matchers', () => {
  expect(10).toBeDivisibleBy(5);
  expect(10).not.toBeDivisibleBy(3);
});
`,
        solution: `// 自定义匹配器完整示例
expect.extend({
  toBeWithinRange(received, min, max) {
    const pass = received >= min && received <= max;
    return {
      pass,
      message: () =>
        pass
          ? \`\${received} is within range \${min}-\${max}\`
          : \`\${received} is not within range \${min}-\${max}\`
    };
  },

  toBeValidEmail(received) {
    const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
    const pass = emailRegex.test(received);
    return {
      pass,
      message: () =>
        pass
          ? \`\${received} is a valid email\`
          : \`\${received} is not a valid email\`
    };
  },

  toContainAll(received, values) {
    const pass = values.every(v => received.includes(v));
    return {
      pass,
      message: () =>
        pass
          ? \`Array contains all required values\`
          : \`Array missing some values from \${JSON.stringify(values)}\`
    };
  }
});

test('custom matchers usage', () => {
  // toBeWithinRange
  expect(5).toBeWithinRange(1, 10);
  expect(15).not.toBeWithinRange(1, 10);

  // toBeValidEmail
  expect('test@example.com').toBeValidEmail();
  expect('invalid-email').not.toBeValidEmail();

  // toContainAll
  expect(['a', 'b', 'c']).toContainAll(['a', 'c']);
  expect(['a', 'b']).not.toContainAll(['a', 'd']);
});`,
        tips: [
          'expect.extend() 添加自定义匹配器',
          '返回 { pass, message } 对象',
          '自动与 .not 配合使用',
          '放在单独文件或 setup 中'
        ]
      },
      {
        key: 'setup-teardown',
        title: '8.3 测试配置和隔离',
        description: '全局设置和测试隔离策略',
        code: `// 测试配置和隔离
let globalState;

describe('isolated tests', () => {
  // 每个测试前重置状态
  beforeEach(() => {
    // 重置全局状态
    globalState = { count: 0 };
  });

  test('test 1', () => {
    globalState.count++;
    expect(globalState.count).toBe(1);
  });

  test('test 2 - isolated', () => {
    // 因为 beforeEach 重置，所以是 0
    expect(globalState.count).toBe(0);
    globalState.count = 100;
    expect(globalState.count).toBe(100);
  });
});
`,
        solution: `// 完整测试隔离示例
describe('Test Isolation', () => {
  // 使用 let 确保每个测试独立
  let database;
  let cache;

  beforeEach(() => {
    // 每个测试创建新实例
    database = {
      data: [],
      add(item) { this.data.push(item); },
      clear() { this.data = []; }
    };

    cache = new Map();
  });

  afterEach(() => {
    // 清理
    database = null;
    cache.clear();
  });

  test('adds items to database', () => {
    database.add({ id: 1 });
    expect(database.data).toHaveLength(1);
  });

  test('cache works independently', () => {
    cache.set('key', 'value');
    expect(cache.get('key')).toBe('value');
  });

  test('database is clean', () => {
    expect(database.data).toHaveLength(0);
  });
});

// 模拟隔离
describe('Mock isolation', () => {
  let mockFn;

  beforeEach(() => {
    mockFn = vi.fn();
  });

  test('first', () => {
    mockFn('call 1');
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  test('second - mock is fresh', () => {
    expect(mockFn).toHaveBeenCalledTimes(0);
  });
});`,
        tips: [
          'beforeEach 而不是 beforeAll',
          '每个测试用独立的数据',
          '用 let 而不是 const',
          'mock 也要在 beforeEach 中创建'
        ]
      }
    ]
  },

  // ========== 第九章：覆盖率与高级技巧 ==========
  {
    key: 'coverage-advanced',
    title: '第九章：覆盖率与高级技巧',
    description: '掌握测试覆盖率、标签筛选、并发/重试、测试组织与 mock 进阶',
    lessons: [
      {
        key: 'coverage-basics',
        title: '9.1 测试覆盖率',
        description: '运行测试后查看右下角「覆盖率（整体）」面板，了解哪些代码被测试覆盖。实现 isLeapYear 让所有断言通过。',
        code: `// 运行后查看右下角「覆盖率（整体）」面板
function isLeapYear(year: number): boolean {
  // TODO: 实现闰年判断
  // 规则：能被 4 整除但不能被 100 整除，或能被 400 整除
  return false;
}

test('闰年判断', () => {
  expect(isLeapYear(2000)).toBe(true);
  expect(isLeapYear(1900)).toBe(false);
  expect(isLeapYear(2024)).toBe(true);
  expect(isLeapYear(2023)).toBe(false);
});
`,
        solution: `function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

test('闰年判断', () => {
  expect(isLeapYear(2000)).toBe(true);
  expect(isLeapYear(1900)).toBe(false);
  expect(isLeapYear(2024)).toBe(true);
  expect(isLeapYear(2023)).toBe(false);
});
`,
        tips: [
          '覆盖率面板来自 Vitest 的 --coverage（@vitest/coverage-v8）',
          '提高覆盖率能发现未被测试触达的分支',
          '100% 覆盖率不等于没有 bug，但能减少回归风险'
        ],
      },
      {
        key: 'test-tags',
        title: '9.2 测试标签与筛选',
        description: '用 test.skip / test.only / test.todo 控制运行范围；命令行可用 --testNamePattern 按名称筛选。',
        code: `test('正常用例', () => {
  expect(1 + 1).toBe(2);
});

// 跳过该用例（不计入失败）
test.skip('暂时跳过', () => {
  expect(1).toBe(2);
});

// 标记待补，不运行但显示在报告中
test.todo('补充边界情况测试');

test.only('只运行我（其余被忽略）', () => {
  expect('vitest'.length).toBe(6);
});
`,
        tips: [
          'test.only 会忽略同文件其他用例，调试时很有用，提交前记得去掉',
          'test.skip 与 test.todo 都不会让套件失败',
          '运行器当前默认全量运行；only 由测试代码控制'
        ],
      },
      {
        key: 'concurrent',
        title: '9.3 并发测试',
        description: 'test.concurrent 让用例并行执行，加速 IO/异步密集型测试。用例之间必须互相独立。',
        code: `function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test.concurrent('任务 A', async () => {
  await delay(20);
  expect(1 + 1).toBe(2);
});

test.concurrent('任务 B', async () => {
  await delay(20);
  expect('ab'.length).toBe(2);
});

test.concurrent('任务 C', async () => {
  await delay(20);
  expect([1, 2, 3]).toHaveLength(3);
});
`,
        tips: [
          '并发用例共享状态会互相干扰，务必保持独立',
          '并发能显著缩短大量异步用例的总耗时',
          '可在 describe 上用 test.concurrent 影响整组'
        ],
      },
      {
        key: 'retry-flaky',
        title: '9.4 重试不稳定测试',
        description: 'test(name, { retry: n }, fn) 在偶发失败时自动重试，适合对抗 flaky（不稳定）用例。',
        code: `test('偶发失败，自动重试', { retry: 3 }, () => {
  // 模拟一个约 50% 概率失败的不稳定断言
  if (Math.random() > 0.5) {
    throw new Error('网络抖动');
  }
  expect(true).toBe(true);
});

test('稳定用例', () => {
  expect(Math.max(1, 2, 3)).toBe(3);
});
`,
        tips: [
          'retry 是权宜之计，根因仍是代码/环境不稳定，应优先修复',
          '重试会重复执行用例，可能拖慢套件',
          'Vitest 默认不重试，需在用例选项里显式开启'
        ],
      },
      {
        key: 'organization',
        title: '9.5 测试组织与钩子',
        description: '用嵌套 describe 与 beforeEach/afterEach 组织用例，让结构清晰、状态可控。',
        code: `describe('购物车', () => {
  let cart: string[];

  beforeEach(() => {
    cart = [];
  });

  afterEach(() => {
    cart = [];
  });

  describe('添加商品', () => {
    test('添加后长度为 1', () => {
      cart.push('apple');
      expect(cart).toHaveLength(1);
    });

    test('可添加多个', () => {
      cart.push('apple', 'banana');
      expect(cart).toHaveLength(2);
    });
  });

  describe('清空', () => {
    test('重置后为空', () => {
      cart.push('apple');
      cart = [];
      expect(cart).toHaveLength(0);
    });
  });
});
`,
        tips: [
          'beforeEach 保证每个用例拿到干净状态',
          '嵌套 describe 让报告层级清晰',
          '钩子执行顺序：外层 beforeEach → 内层 beforeEach → 用例'
        ],
      },
      {
        key: 'mock-advanced',
        title: '9.6 mock 进阶：依次返回与时间控制',
        description: 'mockImplementationOnce 让 mock 每次调用返回不同值；useFakeTimers/useRealTimers 控制时间流逝。',
        code: `import { vi } from 'vitest';

test('依次返回不同值', () => {
  const fn = vi.fn();
  fn.mockImplementationOnce(() => 1)
    .mockImplementationOnce(() => 2)
    .mockImplementationOnce(() => 3);

  expect(fn()).toBe(1);
  expect(fn()).toBe(2);
  expect(fn()).toBe(3);
});

test('控制时间流逝', () => {
  vi.useFakeTimers();
  const start = Date.now();
  vi.advanceTimersByTime(1500);
  expect(Date.now() - start).toBe(1500);
  vi.useRealTimers(); // 用完恢复真实时间
});
`,
        tips: [
          'mockImplementationOnce 用尽后回落到默认实现',
          'useFakeTimers 后定时器不会真的等待，用 advanceTimersByTime 推进',
          '务必在测试结束恢复真实时间（useRealTimers 或 afterEach）'
        ],
      },
      {
        key: 'benchmark',
        title: '9.7 性能基准测试',
        description: '用 bench() 测量函数耗时。开启基准模式后，vitest 以基准方式运行并报告均值与吞吐量。',
        benchmark: true,
        code: `import { bench, describe } from 'vitest';

function sum(n: number) {
  let s = 0;
  for (let i = 0; i < n; i++) s += i;
  return s;
}

describe('sum 性能', () => {
  bench('累加 1000', () => {
    sum(1000);
  });

  bench('累加 100000', () => {
    sum(100000);
  });
});
`,
        tips: [
          'bench 用于度量性能，不同于 test 的正确性断言',
          '报告中的 mean 是平均耗时（ms），hz 是每秒操作数',
          '基准结果会受机器负载影响，只作相对比较'
        ],
      },
    ]
  },

  // ========== 第十章：测试替身 ==========
  {
    key: 'test-doubles',
    title: '第十章：测试替身',
    description: '学习 Dummy、Stub、Spy、Fake 四种测试替身',
    lessons: [
      {
        key: 'dummy',
        title: '10.1 Dummy（虚设对象）',
        description: '只作为参数填充物，不使用其值',
        code: `// Dummy - 虚设对象
// 只作为参数传递，不关心其实际内容

function sendEmail(to, subject, user) {
  console.log('Sending email to ' + user.email);
}

// Dummy 使用示例
test('sendEmail with dummy', () => {
  const message = {
    to: 'test@example.com',
    subject: 'Welcome',
    body: 'Hello!'
  };

  // user 对象只是占位，不使用其属性
  const dummyUser = {};

  // 不会报错，因为不关心 user 的内容
  sendEmail(message.to, message.subject, dummyUser);
});

test('dummy as placeholder', () => {
  // Dummy 只填充参数，不使用
  function greet(name, config) {
    return 'Hello, ' + name;
  }

  const dummyConfig = {};
  expect(greet('World', dummyConfig)).toBe('Hello, World');
});
`,
        solution: `// Dummy 完整示例

function processUser(user, logger) {
  logger.log('Processing user: ' + user.name);
  // 业务逻辑...
}

// Dummy 示例
test('processUser with dummy logger', () => {
  const user = {
    id: 1,
    name: 'Alice',
    email: 'alice@example.com'
  };

  // Logger 只是占位，不关心实现
  const dummyLogger = {
    log: vi.fn()
  };

  processUser(user, dummyLogger);

  // 可以验证调用（此时 Dummy 变成了 Spy）
  expect(dummyLogger.log).toHaveBeenCalledWith('Processing user: Alice');
});

// 多个 Dummy 参数
test('dummy parameters', () => {
  // 第一个参数是 Dummy，第三个参数是 Dummy
  function process(dummy, value, anotherDummy) {
    return value * 2;
  }

  expect(process({}, 5, {})).toBe(10);
});`,
        tips: [
          'Dummy 只作为参数填充，不关心其内容',
          '通常使用空对象或 as 断言',
          '适合只需要满足接口签名的场景',
          '实际测试中 Dummy 很少单独使用'
        ]
      },
      {
        key: 'stub',
        title: '10.2 Stub（存根）',
        description: '提供固定返回值，替代真实依赖',
        code: `// Stub - 存根
// 提供预设的返回值，替代真实依赖

// 数据库模块
const db = {
  getUserEmail: vi.fn().mockReturnValue('test@example.com')
};

function sendWelcomeEmail(userId) {
  const email = db.getUserEmail(userId);
  return 'Welcome email sent to: ' + email;
}

test('Stub returns fixed value', () => {
  const result = sendWelcomeEmail(1);

  expect(result).toBe('Welcome email sent to: test@example.com');
  expect(db.getUserEmail).toHaveBeenCalledWith(1);
});
`,
        solution: `// Stub 完整示例
// API 模块
const api = {
  fetchUser: vi.fn(),
  fetchConfig: vi.fn()
};

function getUserName(id) {
  return api.fetchUser(id).then(user => user.name);
}

function getAppTitle() {
  return api.fetchConfig().title;
}

describe('Stub Examples', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('stub async function', async () => {
    // 设置固定返回值
    api.fetchUser.mockResolvedValue({ id: 1, name: 'Alice' });

    const name = await getUserName(1);

    expect(name).toBe('Alice');
    expect(api.fetchUser).toHaveBeenCalledWith(1);
  });

  test('stub with mockReturnValue', () => {
    api.fetchConfig.mockReturnValue({ title: 'My App', version: '1.0' });

    const title = getAppTitle();

    expect(title).toBe('My App');
  });

  test('stub throws error', () => {
    api.fetchUser.mockRejectedValue(new Error('User not found'));

    expect(getUserName(999)).rejects.toThrow('User not found');
  });

  test('stub with mockImplementation', () => {
    api.fetchUser.mockImplementation((id) => {
      if (id > 0) {
        return Promise.resolve({ id, name: 'User' + id });
      }
      return Promise.reject(new Error('Invalid id'));
    });

    expect(getUserName(5)).resolves.toBe('User5');
    expect(getUserName(-1)).rejects.toThrow('Invalid id');
  });
});`,
        tips: [
          'Stub 提供预设的返回值',
          '使用 mockReturnValue 设置固定值',
          '使用 mockResolvedValue 模拟 Promise 成功',
          '使用 mockRejectedValue 模拟 Promise 失败'
        ]
      },
      {
        key: 'spy',
        title: '10.3 Spy（监视器）',
        description: '监控函数调用，不改变原行为',
        code: `// Spy - 监视器
// 监控函数是否被调用，保留原实现

const calculator = {
  add: (a, b) => a + b,
  multiply: (a, b) => a * b
};

test('spy on method', () => {
  // 用 spyOn 监控方法
  const spy = vi.spyOn(calculator, 'add');

  // 调用原方法
  const result = calculator.add(2, 3);

  // 验证被调用
  expect(spy).toHaveBeenCalled();
  expect(spy).toHaveBeenCalledWith(2, 3);

  // 结果仍然是原始值
  expect(result).toBe(5);

  // 可以修改实现
  spy.mockReturnValue(100);
  expect(calculator.add(1, 1)).toBe(100);

  // 恢复原实现
  spy.mockRestore();
  expect(calculator.add(2, 3)).toBe(5);
});
`,
        solution: `// Spy 完整示例
class UserService {
  constructor(logger) {
    this.logger = logger;
  }

  createUser(name, email) {
    this.logger.log('Creating user: ' + name);
    return { id: Date.now(), name, email };
  }

  deleteUser(id) {
    this.logger.log('Deleting user: ' + id);
    return true;
  }
}

describe('Spy Examples', () => {
  let logger;
  let userService;

  beforeEach(() => {
    logger = { log: vi.fn() };
    userService = new UserService(logger);
  });

  test('spy verifies method was called', () => {
    userService.createUser('Alice', 'alice@example.com');

    expect(logger.log).toHaveBeenCalledWith('Creating user: Alice');
  });

  test('spy captures all calls', () => {
    userService.createUser('Alice', 'alice@example.com');
    userService.deleteUser(1);
    userService.createUser('Bob', 'bob@example.com');

    expect(logger.log).toHaveBeenCalledTimes(3);
    expect(logger.log).toHaveBeenNthCalledWith(1, 'Creating user: Alice');
    expect(logger.log).toHaveBeenNthCalledWith(2, 'Deleting user: 1');
  });

  test('spy with call args', () => {
    userService.createUser('Alice', 'alice@example.com');

    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining('Alice')
    );
  });

  test('spy can be temporarily mocked', () => {
    vi.spyOn(logger, 'log').mockImplementation((msg) => {
      console.log('MOCKED:', msg);
      return undefined;
    });

    userService.createUser('Test', 'test@example.com');

    // 可以验证 mock 被调用
    expect(logger.log).toHaveBeenCalled();
  });
});`,
        tips: [
          'Spy 监控函数调用，不改变原行为',
          'vi.spyOn() 创建监视器',
          'mockRestore() 恢复原始实现',
          '可以验证调用次数、参数、顺序'
        ]
      },
      {
        key: 'fake',
        title: '10.4 Fake（伪对象）',
        description: '有简化实现的真实对象',
        code: `// Fake - 伪对象
// 有简化实现的真实对象，用于需要状态或复杂交互的场景

// 真实的 Socket 连接（需要 TCP 服务器）
class RealSocket {
  connect() { /* 连接逻辑 */ }
  send(data) { /* 发送逻辑 */ }
  on(event, callback) { /* 监听逻辑 */ }
}

// Fake Socket（测试用，有完整实现但不连接真实服务器）
class FakeSocket {
  constructor() {
    this.listeners = new Map();
    this.messages = [];
  }

  connect() {
    console.log('Fake: connected');
  }

  send(data) {
    this.messages.push(data);
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  // 测试用的辅助方法
  trigger(event, data) {
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach(cb => cb(data));
  }

  getMessages() {
    return this.messages;
  }
}

test('FakeSocket for testing', () => {
  const socket = new FakeSocket();
  const receivedMessages = [];

  socket.on('message', (data) => {
    receivedMessages.push(data);
  });

  // 模拟接收消息
  socket.trigger('message', 'Hello from server');
  socket.trigger('message', 'Another message');

  expect(receivedMessages).toEqual(['Hello from server', 'Another message']);
  expect(socket.getMessages()).toEqual([]);
});
`,
        solution: `// Fake 完整示例 - Fake 计时器
class RealTimer {
  constructor() {
    this.callbacks = new Map();
    this.intervalId = 0;
  }

  setInterval(callback, ms) {
    const id = ++this.intervalId;
    this.callbacks.set(String(id), callback);
    return id;
  }

  clearInterval(id) {
    this.callbacks.delete(String(id));
  }
}

class FakeTimer {
  constructor() {
    this.currentTime = 0;
    this.timers = []; // { id, callback, delay, nextAt }
    this.nextId = 0;
  }

  setInterval(callback, delay) {
    const id = ++this.nextId;
    // nextAt 记录下一次触发时间，避免重复触发
    this.timers.push({ id, callback, delay, nextAt: delay });
    return id;
  }

  clearInterval(id) {
    this.timers = this.timers.filter(t => t.id !== id);
  }

  // 辅助方法：前进时间，仅触发到期的回调
  advance(ms) {
    this.currentTime += ms;
    this.timers.forEach(t => {
      while (t.nextAt <= this.currentTime) {
        t.callback();
        t.nextAt += t.delay;
      }
    });
  }

  getTime() {
    return this.currentTime;
  }
}

// 测试使用 FakeTimer
describe('Timer with Fake', () => {
  let timer;
  let eventCount;

  beforeEach(() => {
    timer = new FakeTimer();
    eventCount = 0;
  });

  test('timer fires at correct intervals', () => {
    timer.setInterval(() => eventCount++, 1000);

    timer.advance(1000);
    expect(eventCount).toBe(1);

    timer.advance(1000);
    expect(eventCount).toBe(2);

    timer.advance(2000);
    expect(eventCount).toBe(4);
  });

  test('can clear timer', () => {
    const id = timer.setInterval(() => eventCount++, 1000);

    timer.advance(1000);
    expect(eventCount).toBe(1);

    timer.clearInterval(id);

    timer.advance(1000);
    expect(eventCount).toBe(1); // 不再增加
  });
});`,
        tips: [
          'Fake 有完整实现，但不需要外部依赖',
          '适合需要状态或复杂交互的场景',
          '可以添加测试辅助方法（如 trigger）',
          '比 Stub 更接近真实对象'
        ]
      },
      {
        key: 'test-doubles-summary',
        title: '10.5 测试替身对比',
        description: '四种测试替身的适用场景总结',
        code: `// 四种测试替身对比

// 1. Dummy - 只作为参数
const dummyUser = {};

// 2. Stub - 提供固定返回值
const stubFn = vi.fn(() => 'fixed value');

// 3. Spy - 监控调用，保留原行为
const obj = {
  method: () => 'original'
};

// 4. Fake - 有简化实现的真实对象
class FakeDB {
  constructor() {
    this.data = new Map();
  }

  save(key, value) {
    this.data.set(key, value);
  }
  get(key) {
    return this.data.get(key);
  }
}

test('test doubles summary', () => {
  // Stub：返回固定值
  expect(stubFn()).toBe('fixed value');

  // Spy：监控调用，保留原行为
  const spy = vi.spyOn(obj, 'method');
  expect(obj.method()).toBe('original');
  expect(spy).toHaveBeenCalled();
  spy.mockRestore();

  // Fake：有状态的简化实现
  const db = new FakeDB();
  db.save('k', 'v');
  expect(db.get('k')).toBe('v');

  // Dummy：只是占位参数，不关心内容
  expect(dummyUser).toBeDefined();
});

// 选择原则
// - 只关心是否调用：Spy
// - 需要固定返回值：Stub
// - 需要状态或复杂交互：Fake
// - 只是填充参数：Dummy
`,
        solution: `// 测试替身完整对比示例
describe('Test Doubles Comparison', () => {
  // 场景1：发送通知，只关心是否发送
  test('Dummy vs Spy for notification', () => {
    const notifier = {
      send: vi.fn()  // mock 就是 Spy
    };

    function notifyUser(userId) {
      // 业务逻辑
      notifier.send(userId);
    }

    notifyUser(1);

    // 使用 Spy 验证调用
    expect(notifier.send).toHaveBeenCalledWith(1);
  });

  // 场景2：获取配置，需要固定值
  test('Stub for configuration', () => {
    const config = {
      get: vi.fn().mockReturnValue('production')
    };

    function getEnv() {
      return config.get('NODE_ENV');
    }

    expect(getEnv()).toBe('production');

    // 测试不同环境
    config.get.mockReturnValue('development');
    expect(getEnv()).toBe('development');
  });

  // 场景3：缓存，需要状态
  test('Fake for cache with state', () => {
    class FakeCache {
      constructor() {
        this.store = new Map();
      }

      set(key, value) {
        this.store.set(key, value);
      }

      get(key) {
        return this.store.get(key);
      }

      has(key) {
        return this.store.has(key);
      }

      clear() {
        this.store.clear();
      }
    }

    const cache = new FakeCache();

    cache.set('user', { name: 'Alice' });
    expect(cache.has('user')).toBe(true);
    expect(cache.get('user')).toEqual({ name: 'Alice' });

    cache.clear();
    expect(cache.has('user')).toBe(false);
  });
});

// 选择指南
/*
| 类型   | 用途                 | 状态 | 修改行为 | 验证调用 |
|--------|---------------------|------|----------|----------|
| Dummy  | 参数填充            | 无   | 否       | 否       |
| Stub   | 提供固定返回值       | 无   | 是       | 可选     |
| Spy    | 监控调用            | 无   | 可选     | 是       |
| Fake   | 复杂交互/有状态     | 有   | 是       | 可选     |
*/
`,
        tips: [
          'Dummy：参数填充，不需要实现',
          'Stub：替代依赖，提供固定值',
          'Spy：监控调用，保留原行为',
          'Fake：有完整实现但更简单（无外部依赖）',
          '实际开发中，vi.fn() 最常用'
        ]
      }
    ]
  },

  // ========== 第十一章：测试数据构建 ==========
  {
    key: 'fixture',
    title: '第十一章：测试数据构建',
    description: '学习如何构建可重用的测试数据',
    lessons: [
      {
        key: 'implicit-inline',
        title: '11.1 隐式 vs 内联 Fixture',
        description: '对比硬编码和内联数据的方式',
        code: `// 隐式 Fixture - 硬编码数据
// 问题：数据分散，难以维护
describe('Bad Fixture Examples', () => {
  it('test 1', () => {
    const user = { name: 'Alice', age: 25, email: 'alice@test.com' };
    // 使用 user...
  });

  it('test 2', () => {
    const user = { name: 'Bob', age: 30, email: 'bob@test.com' };
    // 使用 user...
  });

  // 问题：每个测试都定义一遍，数据不一致风险
});

// 内联 Fixture - 每个测试单独创建
describe('Inline Fixture', () => {
  it('adds active todo', () => {
    const todo = {
      title: 'Test todo',
      content: 'Test content',
      state: 'active'  // 每次都写一遍
    };
    // 使用 todo...
  });

  it('adds completed todo', () => {
    const todo = {
      title: 'Done todo',
      content: 'Done content',
      state: 'completed'  // 重复代码
    };
    // 使用 todo...
  });
});
`,
        solution: `// Fixture 演进示例

// 内联 Fixture
describe('Inline Fixture Pattern', () => {
  test('active todo', () => {
    const todo = {
      title: 'Buy milk',
      content: 'Get 2% milk',
      state: 'active'
    };
    expect(todo.state).toBe('active');
  });

  test('completed todo', () => {
    const todo = {
      title: 'Buy milk',
      content: 'Got the milk',
      state: 'completed'
    };
    expect(todo.state).toBe('completed');
  });

  test('nested objects', () => {
    const order = {
      id: 1,
      items: [
        { name: 'Apple', qty: 2 },
        { name: 'Bread', qty: 1 }
      ],
      total: 15.50
    };

    expect(order.items).toHaveLength(2);
    expect(order.total).toBeGreaterThan(0);
  });
});

// 减少重复：提取公共部分
describe('Shared Fixture', () => {
  const baseTodo = {
    content: 'Default content',
    state: 'active'
  };

  test('todo with custom title', () => {
    const todo = { ...baseTodo, title: 'Custom title' };
    expect(todo.title).toBe('Custom title');
    expect(todo.state).toBe('active');
  });

  test('todo with default values', () => {
    const todo = { ...baseTodo, title: 'Default todo' };
    expect(todo.title).toBe('Default todo');
  });
});`,
        tips: [
          '避免在每个测试中重复定义相似数据',
          '使用展开运算符合并基础数据',
          '内联适合数据差异大的情况',
          '共享基础数据减少重复'
        ]
      },
      {
        key: 'factory-function',
        title: '11.2 工厂函数',
        description: '使用工厂函数创建可配置的测试数据',
        code: `// 工厂函数 - 封装数据创建逻辑

// 简单工厂函数
function createUser(name) {
  return {
    id: Date.now(),
    name,
    email: name.toLowerCase() + '@example.com',
    role: 'user'
  };
}

// 带参数的工厂函数
function createUserWithRole(name, role) {
  return {
    id: Date.now(),
    name,
    email: name.toLowerCase() + '@example.com',
    role
  };
}

describe('Factory Function Pattern', () => {
  test('creates user with defaults', () => {
    const user = createUser('Alice');

    expect(user.name).toBe('Alice');
    expect(user.email).toBe('alice@example.com');
    expect(user.role).toBe('user');
  });

  test('creates user with custom role', () => {
    const admin = createUserWithRole('Bob', 'admin');
    const guest = createUserWithRole('Carol', 'guest');

    expect(admin.role).toBe('admin');
    expect(guest.role).toBe('guest');
  });
});
`,
        solution: `// 工厂函数完整示例

// 用户工厂
function createUser(overrides = {}) {
  const defaultUser = {
    id: 1,
    name: 'Test User',
    email: 'test@example.com',
    role: 'user',
    createdAt: new Date('2024-01-01')
  };
  return { ...defaultUser, ...overrides };
}

// 产品工厂
function createProduct(overrides = {}) {
  const defaultProduct = {
    id: 1,
    name: 'Test Product',
    price: 9.99,
    category: 'electronics'
  };
  return { ...defaultProduct, ...overrides };
}

describe('Factory Functions', () => {
  test('creates user with defaults', () => {
    const user = createUser();

    expect(user.name).toBe('Test User');
    expect(user.role).toBe('user');
  });

  test('creates user with overrides', () => {
    const admin = createUser({
      name: 'Admin',
      role: 'admin',
      email: 'admin@example.com'
    });

    expect(admin.name).toBe('Admin');
    expect(admin.role).toBe('admin');
    expect(admin.email).toBe('admin@example.com');
  });

  test('creates products with various categories', () => {
    const electronics = createProduct({ category: 'electronics' });
    const clothing = createProduct({ category: 'clothing', price: 29.99 });

    expect(electronics.category).toBe('electronics');
    expect(clothing.category).toBe('clothing');
    expect(clothing.price).toBe(29.99);
  });

  test('unique ids for each user', () => {
    const user1 = createUser({ id: 1 });
    const user2 = createUser({ id: 2 });

    expect(user1.id).not.toBe(user2.id);
  });
});

// 工厂函数组合
function createAdmin(name: string) {
  return createUser({ name, role: 'admin' });
}

function createGuest(email: string) {
  return createUser({ email, role: 'guest' });
}

describe('Specialized Factories', () => {
  test('createAdmin', () => {
    const admin = createAdmin('Super Admin');
    expect(admin.role).toBe('admin');
    expect(admin.name).toBe('Super Admin');
  });

  test('createGuest', () => {
    const guest = createGuest('guest@test.com');
    expect(guest.role).toBe('guest');
    expect(guest.email).toBe('guest@test.com');
  });
});`,
        tips: [
          '工厂函数封装数据创建逻辑',
          '使用默认参数减少重复',
          '支持部分覆盖（Partial）',
          '可以创建专门化工厂函数'
        ]
      },
      {
        key: 'factory-sequence',
        title: '11.3 序列工厂函数',
        description: '创建具有唯一标识的测试数据',
        code: `// 序列工厂 - 自动生成唯一 ID

let userIdCounter = 0;
let emailCounter = 0;

function createTestUser(overrides) {
  const id = ++userIdCounter;
  return {
    id,
    name: 'User' + id,
    email: 'user' + (++emailCounter) + '@test.com',
    role: 'user',
    ...overrides
  };
}

describe('Sequence Factory', () => {
  beforeEach(() => {
    userIdCounter = 0;
    emailCounter = 0;
  });

  test('generates unique ids', () => {
    const user1 = createTestUser();
    const user2 = createTestUser();
    const user3 = createTestUser();

    expect(user1.id).toBe(1);
    expect(user2.id).toBe(2);
    expect(user3.id).toBe(3);
  });

  test('generates unique emails', () => {
    const user1 = createTestUser();
    const user2 = createTestUser();

    expect(user1.email).toBe('user1@test.com');
    expect(user2.email).toBe('user2@test.com');
  });
});
`,
        solution: `// 序列工厂完整示例
class Factory {
  constructor() {
    this.counters = {};
  }

  next(type) {
    this.counters[type] = (this.counters[type] || 0) + 1;
    return this.counters[type];
  }

  reset() {
    this.counters = {};
  }

  createUser(overrides) {
    const id = this.next('user');
    return {
      id,
      name: 'User' + id,
      email: 'user' + id + '@test.com',
      role: 'user',
      createdAt: new Date(),
      ...overrides
    };
  }

  createProduct(overrides) {
    const id = this.next('product');
    return {
      id,
      name: 'Product' + id,
      price: 9.99 * id,
      category: 'default',
      ...overrides
    };
  }

  createOrder(overrides) {
    const id = this.next('order');
    return {
      id,
      userId: this.next('orderUser'),  // 独立计数器
      items: [],
      total: 0,
      status: 'pending',
      createdAt: new Date(),
      ...overrides
    };
  }
}

describe('Advanced Sequence Factory', () => {
  let factory;

  beforeEach(() => {
    factory = new Factory();
  });

  afterEach(() => {
    factory.reset();
  });

  test('creates multiple users with unique ids', () => {
    const user1 = factory.createUser();
    const user2 = factory.createUser({ name: 'Alice' });
    const user3 = factory.createUser({ role: 'admin' });

    expect(user1.id).toBe(1);
    expect(user2.id).toBe(2);
    expect(user3.id).toBe(3);
    expect(user2.name).toBe('Alice');
    expect(user3.role).toBe('admin');
  });

  test('creates related entities', () => {
    const user = factory.createUser();
    const order = factory.createOrder({ userId: user.id });

    expect(order.userId).toBe(user.id);
    expect(order.id).toBe(1);
  });

  test('reset clears all counters', () => {
    factory.createUser();
    factory.createUser();
    factory.reset();

    const user = factory.createUser();
    expect(user.id).toBe(1);
  });

  test('creates products with calculated values', () => {
    const p1 = factory.createProduct();
    const p2 = factory.createProduct();

    expect(p1.price).toBe(9.99);
    expect(p2.price).toBe(19.98);
  });
});`,
        tips: [
          '序列工厂自动生成唯一 ID',
          '使用 beforeEach 重置计数器',
          '可以创建关联实体（如 Order 引用 User）',
          'reset() 方法清理状态'
        ]
      }
    ]
  },

  // ========== 第十二章：Vitest vs Jest ==========
  {
    key: 'vitest-vs-jest',
    title: '第十二章：Vitest 与 Jest 对比',
    description: '了解 Vitest 与 Jest 的异同',
    lessons: [
      {
        key: 'syntax-comparison',
        title: '12.1 语法对比',
        description: 'Vitest 和 Jest 语法的相似之处',
        code: `// Vitest 和 Jest 语法几乎完全一致
// 以下代码在两者中都正常工作

// 基本测试
test('basic test', () => {
  expect(1 + 1).toBe(2);
});

// 使用 describe 分组
describe('Math', () => {
  it('adds numbers', () => {
    expect(1 + 2).toBe(3);
  });
});

// 生命周期钩子
beforeEach(() => {
  // 初始化
});

afterEach(() => {
  // 清理
});

// 常用匹配器
expect(value).toBe(expected);
expect(value).toEqual(expected);
expect(value).toContain(item);
expect(value).toThrow();
`,
        solution: `// Vitest vs Jest 完整对比
// ========================

// 1. 导入方式
// Jest: 全局函数，无需导入
// Vitest: 可全局使用，也可显式导入

// Jest (无需导入)
test('jest syntax', () => {
  expect(true).toBe(true);
});

// Vitest (显式导入)
import { test, expect, describe, it, beforeEach } from 'vitest';

test('vitest syntax', () => {
  expect(true).toBe(true);
});

// 2. 配置文件
// Jest: jest.config.js
// Vitest: vite.config.ts (复用 Vite 配置)

/*
// vite.config.ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'jsdom'
  }
});
*/

// 3. Mock 语法
// 两者几乎相同
describe('Mock Comparison', () => {
  test('jest mock', () => {
    // Jest 中写作 jest.fn(() => 'mocked')，语法与 vi.fn 完全一致
    const mockFn = vi.fn(() => 'mocked');
    mockFn();
    expect(mockFn).toHaveBeenCalled();
  });

  test('vitest mock', () => {
    const mockFn = vi.fn(() => 'mocked');
    mockFn();
    expect(mockFn).toHaveBeenCalled();
  });
});

// 4. 主要差异
/*
| 特性           | Jest              | Vitest              |
|----------------|-------------------|---------------------|
| 配置           | jest.config.js    | vite.config.ts      |
| Mock 函数      | jest.fn()         | vi.fn()             |
| 模块 Mock      | jest.mock()       | vi.mock()           |
| 速度           | 较慢              | 更快（基于 Vite）   |
| TypeScript     | 需要额外配置      | 原生支持            |
| 全局变量       | 默认开启          | 需要开启 globals    |
| ESM 支持       | 需要转换          | 原生支持            |
*/
`,
        tips: [
          'Vitest 兼容 Jest 的所有 API',
          'Vitest 使用 vi.fn() 而不是 jest.fn()',
          'Vitest 配置更简单，复用 Vite 配置',
          'Vitest 基于 Vite，启动和热更新更快'
        ]
      },
      {
        key: 'migration-guide',
        title: '12.2 Jest 迁移到 Vitest',
        description: '从 Jest 迁移到 Vitest 的指南',
        code: `// Jest 到 Vitest 迁移检查清单

// 1. Mock 函数
// Jest: jest.fn()  ->  Vitest: vi.fn()
// Jest: jest.spyOn() ->  Vitest: vi.spyOn()

// Vitest 写法
const mockFn = vi.fn();

// 2. Mock 模块
// Jest: jest.mock()  ->  Vitest: vi.mock()

// 3. 恢复 Mock
// Jest: jest.restoreAllMocks()  ->  Vitest: vi.restoreAllMocks()

// 4. 定时器
// Jest: jest.useFakeTimers()  ->  Vitest: vi.useFakeTimers()
// Jest: jest.runAllTimers()  ->  Vitest: vi.runAllTimers()

test('vitest 版 mock API', () => {
  mockFn('a');
  expect(mockFn).toHaveBeenCalledWith('a');

  const spy = vi.spyOn({ greet: () => 'hi' }, 'greet');
  expect(spy).not.toHaveBeenCalled();
  spy.mockRestore();
});
`,
        solution: `// 完整迁移示例
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';

// 模拟模块
// Jest: jest.mock('./database')
// Vitest: vi.mock('./database')
vi.mock('./database', () => ({
  query: vi.fn(),
  connect: vi.fn()
}));

import { query, connect } from './database';

describe('Migration Examples', () => {
  beforeEach(() => {
    // 清理 mock
    // Jest: jest.clearAllMocks()
    // Vitest: vi.clearAllMocks()
    vi.clearAllMocks();
  });

  afterEach(() => {
    // 恢复 mock
    // Jest: jest.restoreAllMocks()
    // Vitest: vi.restoreAllMocks()
    vi.restoreAllMocks();
  });

  test('mock implementation', () => {
    // Jest: mockReturnValue
    // Vitest: mockReturnValue
    query.mockReturnValue([{ id: 1, name: 'Test' }]);

    const result = query('SELECT * FROM users');

    expect(result).toEqual([{ id: 1, name: 'Test' }]);
    expect(query).toHaveBeenCalledWith('SELECT * FROM users');
  });

  test('mock async function', () => {
    // Jest: mockResolvedValue
    // Vitest: mockResolvedValue
    query.mockResolvedValue([{ id: 1 }]);

    return expect(query('SELECT 1')).resolves.toEqual([{ id: 1 }]);
  });

  test('spy on object method', () => {
    const obj = {
      getData: () => 'original'
    };

    // Jest: jest.spyOn(obj, 'getData')
    // Vitest: vi.spyOn(obj, 'getData')
    const spy = vi.spyOn(obj, 'getData');

    obj.getData();

    expect(spy).toHaveBeenCalled();
    expect(obj.getData()).toBe('original');

    // 修改实现
    spy.mockReturnValue('mocked');
    expect(obj.getData()).toBe('mocked');

    // 恢复
    spy.mockRestore();
    expect(obj.getData()).toBe('original');
  });
});

// 迁移命令
/*
# 安装 Vitest
npm install -D vitest

# 更新 package.json scripts
"test": "vitest",
"test:run": "vitest run"

# 或使用 vitest 替代 jest
npx vitest --config vite.config.ts
*/
`,
        // vi.mock 需要模块真实可解析，故额外提供一个 database 模块文件供 mock 替换
        extraFiles: {
          'database.ts': `// 真实数据库模块（测试中会被 vi.mock 替换）
export const query = (sql: string) => [{ id: 1, name: 'Real data' }];
export const connect = () => ({ connected: true });
`,
        },
        tips: [
          'Vitest 兼容 Jest 的大部分 API',
          '只需将 jest.fn() 改为 vi.fn()',
          'Vitest 配置更简单，集成度更高',
          '迁移成本低，大多数测试无需修改'
        ]
      },
      {
        key: 'why-vitest',
        title: '12.3 为什么选择 Vitest',
        description: 'Vitest 的优势和使用场景',
        code: `// Vitest 的优势

/*
1. 极速启动
   - 基于 Vite，按需编译
   - 冷启动比 Jest 快 10-20 倍

2. 优秀的开发体验
   - 热模块替换 (HMR)
   - 文件监视模式，开箱即用

3. 原生 TypeScript 支持
   - 无需额外配置
   - 类型检查自动完成

4. 兼容 Jest API
   - 迁移成本低
   - 社区资源丰富

5. 与 Vite 生态集成
   - 统一的配置体系
   - 共享插件系统
*/

// 使用场景
describe('When to Use Vitest', () => {
  test('Vite 项目首选', () => {
    // Vite 项目直接使用 Vitest
    expect(true).toBe(true);
  });

  test('需要快速反馈的 TDD', () => {
    // Vitest 的 watch 模式更快
    expect(true).toBe(true);
  });

  test('TypeScript 项目', () => {
    // 原生支持，无需额外配置
    expect(true).toBe(true);
  });
});
`,
        solution: `// Vitest 优势详解
describe('Vitest Advantages', () => {
  describe('性能对比', () => {
    test('Vitest 启动更快（基于 Vite）', () => {
      // Vite 利用 ES modules，按需编译
      // Jest 需要先转换整个项目
      expect(true).toBe(true);
    });

    test('HMR 热更新', () => {
      // 修改代码后立即看到结果
      // Jest 需要重新运行测试
      expect(true).toBe(true);
    });
  });

  describe('开发体验', () => {
    test('配置简单', () => {
      // 只需在 vite.config.ts 中添加 test 配置
      expect(true).toBe(true);
    });

    test('智能类型推断', () => {
      const mockFn = vi.fn();
      mockFn.mockReturnValue('test');

      // TypeScript 自动推断返回类型
      const result: string = mockFn();
      expect(result).toBe('test');
    });
  });

  describe('与 Jest 的兼容性', () => {
    test('相同的测试语法', () => {
      // test, describe, expect 等 API 相同
      expect('Vitest').toContain('Vitest');
    });

    test('相同的 Mock 语法', () => {
      const fn = vi.fn();
      fn.mockReturnValue(42);
      expect(fn()).toBe(42);
    });
  });
});

// 迁移决策树
/*
项目类型              推荐
-------------------|------------------
新 Vite 项目        | Vitest (强烈推荐)
现有 Vite 项目      | Vitest (推荐)
现有 Jest 项目      | Vitest (可选，迁移成本低)
非 Vite 项目        | Jest 或 Vitest
需要最快速度        | Vitest
追求稳定性          | Jest (更成熟)
*/
`,
        tips: [
          '新 Vite 项目强烈推荐使用 Vitest',
          'Vitest 在大型项目启动速度优势明显',
          'TypeScript 项目使用 Vitest 配置更简单',
          'Vitest 和 Jest 可以共存，逐步迁移'
        ]
      }
    ]
  },

  // ========== 第十三章：测试策略 ==========
  {
    key: 'test-strategy',
    title: '第十三章：测试策略',
    description: '状态验证、行为验证与测试风格',
    lessons: [
      {
        key: 'state-vs-behavior',
        title: '13.1 状态验证 vs 行为验证',
        description: '两种验证方式的选择',
        code: `// 状态验证 - 检查对象的最终状态
class Counter {
  constructor() {
    this.count = 0;
  }

  increment() {
    this.count++;
  }

  getCount() {
    return this.count;
  }
}

test('state verification', () => {
  const counter = new Counter();

  counter.increment();
  counter.increment();

  // 验证最终状态
  expect(counter.getCount()).toBe(2);
});

// 行为验证 - 检查方法是否被调用
class Service {
  constructor(notifier) {
    this.notifier = notifier;
  }

  notify(message) {
    this.notifier.send(message);
  }
}

test('behavior verification', () => {
  const notifier = { send: vi.fn() };
  const service = new Service(notifier);

  service.notify('hello');

  // 验证行为（方法调用）
  expect(notifier.send).toHaveBeenCalledWith('hello');
});
`,
        solution: `// 状态验证 vs 行为验证 完整示例
describe('State vs Behavior Verification', () => {
  // ===== 状态验证 =====
  describe('State Verification', () => {
    class ShoppingCart {
      constructor() {
        this.items = [];
      }

      addItem(item) {
        this.items.push(item);
      }

      removeItem(item) {
        this.items = this.items.filter(i => i !== item);
      }

      getItems() {
        return [...this.items];
      }

      getTotal() {
        return this.items.length;
      }
    }

    test('adds items - state verification', () => {
      const cart = new ShoppingCart();

      cart.addItem('Apple');
      cart.addItem('Banana');

      // 验证状态
      expect(cart.getItems()).toEqual(['Apple', 'Banana']);
      expect(cart.getTotal()).toBe(2);
    });

    test('removes items - state verification', () => {
      const cart = new ShoppingCart();

      cart.addItem('Apple');
      cart.addItem('Banana');
      cart.removeItem('Apple');

      expect(cart.getItems()).toEqual(['Banana']);
    });

    test('cart is empty initially - state verification', () => {
      const cart = new ShoppingCart();
      expect(cart.getTotal()).toBe(0);
      expect(cart.getItems()).toEqual([]);
    });
  });

  // ===== 行为验证 =====
  describe('Behavior Verification', () => {
    class UserService {
      constructor(logger) {
        this.logger = logger;
      }

      createUser(name) {
        this.logger.log('Creating user: ' + name);
        return { id: 1, name };
      }

      deleteUser(id) {
        this.logger.log('Deleting user: ' + id);
        return true;
      }
    }

    test('logs on create - behavior verification', () => {
      const logger = { log: vi.fn(), error: vi.fn() };
      const service = new UserService(logger);

      service.createUser('Alice');

      expect(logger.log).toHaveBeenCalledWith('Creating user: Alice');
      expect(logger.log).toHaveBeenCalledTimes(1);
    });

    test('logs on delete - behavior verification', () => {
      const logger = { log: vi.fn(), error: vi.fn() };
      const service = new UserService(logger);

      service.deleteUser(1);

      expect(logger.log).toHaveBeenCalledWith('Deleting user: 1');
    });

    test('logs errors - behavior verification', () => {
      const logger = { log: vi.fn(), error: vi.fn() };

      logger.error('Something went wrong');

      expect(logger.error).toHaveBeenCalledWith('Something went wrong');
    });
  });

  // ===== 选择原则 =====
  describe('When to Use Each', () => {
    test('preference: state over behavior', () => {
      // 优先使用状态验证
      // 因为：
      // 1. 更稳定（不依赖实现细节）
      // 2. 更容易理解
      // 3. 重构更安全
      const list = [];

      list.push(1);
      list.push(2);

      expect(list).toEqual([1, 2]);
    });

    test('use behavior when state is hard to check', () => {
      // 当状态难以获取时，使用行为验证
      // 例如：测试是否有调用第三方 API

      const apiClient = { fetch: vi.fn() };
      apiClient.fetch('endpoint');

      expect(apiClient.fetch).toHaveBeenCalledWith('endpoint');
    });
  });
});`,
        tips: [
          '优先使用状态验证，更稳定',
          '行为验证用于无法检查状态的场景',
          '行为验证检查"是否调用"，状态验证检查"结果是什么"',
          '过度使用行为验证会让测试脆弱'
        ]
      },
      {
        key: 'solitary-sociable',
        title: '13.2 独居测试 vs 群居测试',
        description: 'Mock 所有依赖 vs 使用真实依赖',
        code: `// ===== 待测试的业务类 =====
class RealInventoryService {
  checkStock(productId) {
    return productId > 0;
  }
}

class RealEmailService {
  sendEmail(to, subject) {
    return true;
  }
}

class OrderProcessor {
  constructor(inventory, email) {
    this.inventory = inventory;
    this.email = email;
    this.lastOrder = null;
  }

  processOrder(productId, quantity, email) {
    if (!this.inventory.checkStock(productId)) {
      throw new Error('Out of stock');
    }
    this.email.sendEmail(email, 'Order confirmed');
    this.lastOrder = { productId, quantity };
    return this.lastOrder;
  }

  getLastOrder() {
    return this.lastOrder;
  }
}

// 独居测试 (Solitary) - Mock 所有依赖
describe('Solitary Testing', () => {
  test('processes order with mocks', () => {
    // Mock 所有依赖
    const emailService = { sendEmail: vi.fn() };
    const inventoryService = { checkStock: vi.fn().mockReturnValue(true) };

    // 使用 Mock 的服务
    const processor = new OrderProcessor(inventoryService, emailService);

    processor.processOrder(1, 2, 'test@example.com');

    // 验证行为
    expect(emailService.sendEmail).toHaveBeenCalled();
    expect(inventoryService.checkStock).toHaveBeenCalledWith(1);
  });
});

// 群居测试 (Sociable) - 使用真实依赖
describe('Sociable Testing', () => {
  test('processes order with real services', () => {
    // 使用真实服务（无外部 I/O，运行快）
    const emailService = new RealEmailService();
    const inventoryService = new RealInventoryService();

    const processor = new OrderProcessor(inventoryService, emailService);

    processor.processOrder(1, 2, 'test@example.com');

    // 验证最终结果
    expect(processor.getLastOrder()).toBeDefined();
    expect(processor.getLastOrder().productId).toBe(1);
  });
});
`,
        solution: `// 独居测试 vs 群居测试 完整示例
describe('Solitary vs Sociable Testing', () => {
  // ===== 待测试的类 =====
  class InventoryService {
    checkStock(productId) {
      // 真实数据库查询
      return productId > 0;
    }

    reduceStock(productId, qty) {
      // 真实减库存
      console.log('Reducing stock: ' + productId + ' x ' + qty);
    }
  }

  class EmailService {
    sendEmail(to, subject) {
      console.log('Sending email to ' + to);
    }
  }

  class OrderProcessor {
    constructor(inventory, email) {
      this.orders = [];
      this.orderIdCounter = 0;
      this.inventory = inventory;
      this.email = email;
    }

    processOrder(productId, qty, email) {
      if (!this.inventory.checkStock(productId)) {
        throw new Error('Out of stock');
      }

      this.inventory.reduceStock(productId, qty);

      const order = {
        id: ++this.orderIdCounter,
        productId,
        qty
      };
      this.orders.push(order);

      this.email.sendEmail(email, 'Order #' + order.id + ' confirmed');

      return order;
    }

    getOrders() {
      return this.orders;
    }
  }

  // ===== 独居测试 =====
  describe('Solitary Testing (with Mocks)', () => {
    test('processes order with mocked dependencies', () => {
      // 使用 Mock
      const inventory = {
        checkStock: vi.fn().mockReturnValue(true),
        reduceStock: vi.fn()
      };
      const email = {
        sendEmail: vi.fn()
      };

      const processor = new OrderProcessor(inventory, email);

      const order = processor.processOrder(1, 2, 'test@example.com');

      expect(order.productId).toBe(1);
      expect(order.qty).toBe(2);

      // 验证依赖被正确调用
      expect(inventory.checkStock).toHaveBeenCalledWith(1);
      expect(inventory.reduceStock).toHaveBeenCalledWith(1, 2);
      expect(email.sendEmail).toHaveBeenCalledWith(
        'test@example.com',
        expect.stringContaining('Order')
      );
    });

    test('throws when out of stock', () => {
      const inventory = {
        checkStock: vi.fn().mockReturnValue(false),
        reduceStock: vi.fn()
      };
      const email = { sendEmail: vi.fn() };

      const processor = new OrderProcessor(inventory, email);

      expect(() => processor.processOrder(999, 1, 'test@example.com'))
        .toThrow('Out of stock');

      expect(email.sendEmail).not.toHaveBeenCalled();
    });
  });

  // ===== 群居测试 =====
  describe('Sociable Testing (with Real Dependencies)', () => {
    test('processes order with real services', () => {
      // 使用真实服务
      const inventory = new InventoryService();
      const email = new EmailService();

      const processor = new OrderProcessor(inventory, email);

      const order = processor.processOrder(1, 1, 'user@example.com');

      expect(order.productId).toBe(1);
      expect(order.qty).toBe(1);
      expect(order.id).toBe(1);
    });

    test('can verify final state', () => {
      const inventory = new InventoryService();
      const email = new EmailService();

      const processor = new OrderProcessor(inventory, email);

      processor.processOrder(1, 1, 'a@example.com');
      processor.processOrder(2, 3, 'b@example.com');

      expect(processor.getOrders()).toHaveLength(2);
    });
  });

  // ===== 选择指南 =====
  describe('Choosing Between Solitary and Sociable', () => {
    test('solitary: faster, more isolated', () => {
      const inventory = { checkStock: vi.fn().mockReturnValue(true) };
      const email = { sendEmail: vi.fn() };

      // 快，不需要真实数据库
      expect(inventory.checkStock(1)).toBe(true);
    });

    test('sociable: more realistic, tests integration', () => {
      const inventory = new InventoryService();
      const email = new EmailService();

      // 真实测试集成
      expect(inventory.checkStock(1)).toBe(true);
    });

    /*
    | 特性         | 独居测试           | 群居测试           |
    |-------------|-------------------|-------------------|
    | 速度        | 快（无 I/O）       | 慢（可能有 I/O）   |
    | 隔离性      | 高（Mock 所有依赖）| 低（依赖真实实现） |
    | 调试        | 容易（mock 可控）  | 困难（真实依赖）   |
    | 集成度      | 低                | 高                |
    | 适用场景    | 单元测试           | 集成测试           |
    */
  });
});`,
        tips: [
          '独居测试：Mock 所有依赖，快速隔离',
          '群居测试：使用真实依赖，更真实',
          '没有绝对的好坏，根据场景选择',
          '大多数单元测试适合独居风格'
        ]
      },
      {
        key: 'what-not-to-test',
        title: '13.3 不需要测试的代码',
        description: '识别不需要测试的代码',
        code: `// 不需要测试的代码类型

// 1. 简单的 Getter/Setter
class User {
  constructor(name) {
    this._name = name;
  }

  // 只是转发，没有逻辑
  get name() { return this._name; }
  set name(value) { this._name = value; }
}

// 2. 第三方库的简单包装
// 如果只是转发调用，不测试
// function isEqual(a, b) {
//   return _.isEqual(a, b);  // 测试 lodash 还是 isEqual？
// }

// 3. 明显不重要的代码
function log(message) {
  console.log(message);  // console 测试没有意义
}

// 4. 已经被其他测试覆盖
// 单元测试 + 集成测试覆盖同一功能

// 有实际逻辑的代码才需要测试
function isAdult(age) {
  return age >= 18;
}

test('只测试有逻辑的代码', () => {
  expect(isAdult(18)).toBe(true);
  expect(isAdult(17)).toBe(false);
});
`,
        solution: `// 不需要测试的代码 完整示例
describe('When NOT to Write Tests', () => {
  // 1. 简单数据类（只有属性，没有逻辑）
  class Point {
    constructor(x, y) {
      this.x = x;
      this.y = y;
    }
  }

  test('point class - no test needed', () => {
    // Point 只是数据结构，没有可测试的逻辑
    // 如果需要测试，应该测试使用 Point 的代码
    const point = new Point(1, 2);
    expect(point.x).toBe(1);
  });

  // 2. 直接委托给其他函数的包装
  describe('Delegation vs Logic', () => {
    const _ = {
      isEqual: vi.fn((a, b) => a === b)
    };

    function isEqual(a, b) {
      // 只是转发，没有自己的逻辑
      return _.isEqual(a, b);
    }

    // 测试被委托的对象，而不是委托者
    test('delegate target has logic', () => {
      // 假设 _.isEqual 有复杂逻辑需要测试
      expect(_.isEqual).toBeDefined();
    });

    // 不要测试 isEqual，它只是转发
    test('we test the consumer, not the wrapper', () => {
      function useEqual(a, b) {
        return isEqual(a, b) ? 'same' : 'different';
      }

      // 测试使用 isEqual 的函数
      expect(useEqual(1, 1)).toBe('same');
      expect(useEqual(1, 2)).toBe('different');
    });
  });

  // 3. 配置对象
  test('config is just data', () => {
    const config = {
      apiUrl: 'https://api.example.com',
      timeout: 5000,
      retries: 3
    };

    // 配置对象不需要测试
    // 测试使用配置的代码
    expect(config.apiUrl).toBeDefined();
  });

  // 4. 测试决策指南
  describe('Test Decision Matrix', () => {
    function shouldTest(code: string): boolean {
      const logicKeywords = ['if', 'for', 'while', 'map', 'filter', 'reduce'];
      const hasLogic = logicKeywords.some(k => code.includes(k));

      const thirdPartyPatterns = ['lodash', 'axios', 'fetch'];
      const isThirdPartyWrap = thirdPartyPatterns.some(p => code.includes(p));

      return hasLogic && !isThirdPartyWrap;
    }

    test('decision matrix', () => {
      // 有逻辑且非第三方包装 -> 测试
      expect(shouldTest('if (x > 0) { return x }')).toBe(true);

      // 只是转发 -> 不测试
      expect(shouldTest('return lodash.isEqual(a, b)')).toBe(false);
    });
  });

  /*
  需要测试：
  - 有条件逻辑 (if/else)
  - 有循环处理
  - 有计算逻辑
  - 有状态变化
  - 有错误处理

  不需要测试：
  - 简单属性访问
  - 委托转发
  - 配置文件
  - 第三方库包装（测消费者）
  */
});`,
        tips: [
          '简单 Getter/Setter 不需要测试',
          '只转发调用的包装函数不测试',
          '测试使用代码，而不是工具代码',
          '测试有逻辑判断的部分',
          '配置对象只是数据，不需要测试'
        ]
      }
    ]
  },
  {
    key: 'tdd-practice',
    title: '第十四章：TDD 实战演练',
    description: '红—绿—重构：先看会失败的测试，再写实现让它通过，并用隐藏校验验证你是否真的掌握',
    lessons: [
      {
        key: 'tdd-fizzbuzz',
        title: '14.1 TDD：实现 FizzBuzz',
        description: '经典 TDD 练习。先阅读下方给定的测试用例，然后在编辑器中实现 fizzBuzz，让它全部通过。',
        code: `// TDD 练习：实现 fizzBuzz
// 规则：
// - 能同时被 3 和 5 整除 -> 'FizzBuzz'
// - 能被 3 整除        -> 'Fizz'
// - 能被 5 整除        -> 'Buzz'
// - 否则返回数字本身（字符串形式）
export function fizzBuzz(n: number): string {
  // TODO: 实现你的逻辑
  return String(n);
}
`,
        solution: `export function fizzBuzz(n: number): string {
  if (n % 15 === 0) return 'FizzBuzz';
  if (n % 3 === 0) return 'Fizz';
  if (n % 5 === 0) return 'Buzz';
  return String(n);
}
`,
        grader: `import { fizzBuzz } from './lesson';

describe('fizzBuzz', () => {
  test('非 3/5 倍数返回数字本身', () => {
    expect(fizzBuzz(1)).toBe('1');
    expect(fizzBuzz(2)).toBe('2');
    expect(fizzBuzz(4)).toBe('4');
  });

  test('3 的倍数返回 Fizz', () => {
    expect(fizzBuzz(3)).toBe('Fizz');
    expect(fizzBuzz(6)).toBe('Fizz');
  });

  test('5 的倍数返回 Buzz', () => {
    expect(fizzBuzz(5)).toBe('Buzz');
    expect(fizzBuzz(10)).toBe('Buzz');
  });

  test('15 的倍数返回 FizzBuzz', () => {
    expect(fizzBuzz(15)).toBe('FizzBuzz');
    expect(fizzBuzz(30)).toBe('FizzBuzz');
  });
});
`,
        hiddenGrader: `import { fizzBuzz } from './lesson';

describe('fizzBuzz 隐藏校验', () => {
  test('覆盖更多边界', () => {
    expect(fizzBuzz(7)).toBe('7');
    expect(fizzBuzz(9)).toBe('Fizz');
    expect(fizzBuzz(20)).toBe('Buzz');
    expect(fizzBuzz(45)).toBe('FizzBuzz');
    expect(fizzBuzz(98)).toBe('98');
  });

  test('实现必须具有真实逻辑（不能用查表蒙混）', () => {
    for (let i = 1; i <= 100; i++) {
      const r = fizzBuzz(i);
      if (i % 15 === 0) expect(r).toBe('FizzBuzz');
      else if (i % 3 === 0) expect(r).toBe('Fizz');
      else if (i % 5 === 0) expect(r).toBe('Buzz');
      else expect(r).toBe(String(i));
    }
  });
});
`,
        tips: [
          'TDD 节奏：先让测试变红（失败），再写最小实现变绿',
          '先用最简单的方式通过，再考虑重构',
          '隐藏校验会检查 1~100 的全部情况，硬编码几组答案是行不通的'
        ],
        quiz: [
          {
            question: 'TDD 的经典三步节奏是？',
            options: ['红—绿—重构', '写—测—删', '设计—编码—发布', '分支—合并—部署'],
            answer: 0,
          },
          {
            question: '为什么需要“隐藏校验”？',
            options: ['让页面更美观', '防止只针对可见测试硬编码答案', '加快运行速度', '替代可见测试'],
            answer: 1,
          },
        ],
      },
      {
        key: 'tdd-anagram',
        title: '14.2 TDD：判断变位词',
        description: '实现 isAnagram(a, b)：判断两个字符串是否为变位词（组成字母与数量相同、顺序可不同）。忽略大小写与空格。',
        code: `// TDD 练习：实现 isAnagram
// 判断两个字符串是否为变位词（组成字母相同、数量相同，顺序可不同）
// 忽略大小写，忽略空格
export function isAnagram(a: string, b: string): boolean {
  // TODO: 实现你的逻辑
  return false;
}
`,
        solution: `export function isAnagram(a: string, b: string): boolean {
  const norm = (s: string) =>
    s.toLowerCase().replace(/\\s/g, '').split('').sort().join('');
  return norm(a) === norm(b);
}
`,
        grader: `import { isAnagram } from './lesson';

describe('isAnagram', () => {
  test('是变位词', () => {
    expect(isAnagram('listen', 'silent')).toBe(true);
    expect(isAnagram('rail safety', 'fairy tales')).toBe(true);
  });

  test('不是变位词', () => {
    expect(isAnagram('hello', 'world')).toBe(false);
    expect(isAnagram('a', 'aa')).toBe(false);
  });

  test('忽略大小写与空格', () => {
    expect(isAnagram('Tom Marvolo Riddle', 'I am Lord Voldemort')).toBe(true);
  });
});
`,
        hiddenGrader: `import { isAnagram } from './lesson';

describe('isAnagram 隐藏校验', () => {
  test('更多用例', () => {
    expect(isAnagram('', '')).toBe(true);
    expect(isAnagram('abc', 'cba')).toBe(true);
    expect(isAnagram('abc', 'cbb')).toBe(false);
    expect(isAnagram('aab', 'abb')).toBe(false);
  });

  test('不能靠固定返回蒙混', () => {
    expect(isAnagram('xyz', 'zyx')).toBe(true);
    expect(isAnagram('xyz', 'zzz')).toBe(false);
  });
});
`,
        tips: [
          '思路：把两个字符串归一化（转小写、去空格、排序）后比较',
          '空字符串互为变位词',
          '字母数量必须一致，多一个少一个都不行'
        ],
        quiz: [
          {
            question: '判断变位词的关键步骤是？',
            options: ['比较字符串长度', '归一化后比较字符构成', '比较首字母', '反转字符串'],
            answer: 1,
          },
        ],
      },
      {
        key: 'tdd-leapyear',
        title: '14.3 TDD：判断闰年',
        description: '实现 isLeapYear(year)：闰年规则——能被 400 整除，或能被 4 整除但不能被 100 整除。',
        code: `// TDD 练习：实现 isLeapYear
// 闰年规则：
// - 能被 400 整除           -> true
// - 能被 100 整除（但非400） -> false
// - 能被 4 整除              -> true
// - 其他                     -> false
export function isLeapYear(year: number): boolean {
  // TODO: 实现你的逻辑
  return false;
}
`,
        solution: `export function isLeapYear(year: number): boolean {
  if (year % 400 === 0) return true;
  if (year % 100 === 0) return false;
  return year % 4 === 0;
}
`,
        grader: `import { isLeapYear } from './lesson';

describe('isLeapYear', () => {
  test('能被 400 整除是闰年', () => {
    expect(isLeapYear(2000)).toBe(true);
    expect(isLeapYear(1600)).toBe(true);
  });

  test('能被 100 但不能被 400 整除不是闰年', () => {
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2100)).toBe(false);
  });

  test('能被 4 整除但不能被 100 整除是闰年', () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2020)).toBe(true);
  });

  test('不能被 4 整除不是闰年', () => {
    expect(isLeapYear(2023)).toBe(false);
    expect(isLeapYear(2021)).toBe(false);
  });
});
`,
        hiddenGrader: `import { isLeapYear } from './lesson';

describe('isLeapYear 隐藏校验', () => {
  test('更多边界', () => {
    expect(isLeapYear(2400)).toBe(true);
    expect(isLeapYear(1800)).toBe(false);
    expect(isLeapYear(1996)).toBe(true);
    expect(isLeapYear(1)).toBe(false);
  });

  test('不能靠固定返回蒙混', () => {
    expect(isLeapYear(2000)).toBe(true);
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2023)).toBe(false);
  });
});
`,
        tips: [
          '先判 400，再判 100，最后判 4，顺序很重要',
          '能被 100 整除的年份大多是“世纪年”，只有能被 400 整除才是闰年',
          '不要漏掉边界：如 1900 不是闰年，2000 是闰年'
        ],
        quiz: [
          {
            question: '下列关于闰年的说法正确的是？',
            options: ['能被 4 整除就是闰年', '能被 100 整除一定不是闰年', '能被 400 整除是闰年', '每 4 年一定有一个闰年'],
            answer: 2,
          },
        ],
      },
      {
        key: 'tdd-palindrome',
        title: '14.4 TDD：判断回文',
        description: '实现 isPalindrome(s)：判断字符串是否为回文（正读反读一致），忽略大小写与非字母数字字符。',
        code: `// TDD 练习：实现 isPalindrome
// 判断字符串是否为回文（正读反读一致）
// 忽略大小写，忽略非字母数字字符
export function isPalindrome(s: string): boolean {
  // TODO: 实现你的逻辑
  return false;
}
`,
        solution: `export function isPalindrome(s: string): boolean {
  const cleaned = s.toLowerCase().replace(/[^a-z0-9]/g, '');
  return cleaned === cleaned.split('').reverse().join('');
}
`,
        grader: `import { isPalindrome } from './lesson';

describe('isPalindrome', () => {
  test('是回文', () => {
    expect(isPalindrome('level')).toBe(true);
    expect(isPalindrome('racecar')).toBe(true);
    expect(isPalindrome('A man a plan a canal Panama')).toBe(true);
  });

  test('不是回文', () => {
    expect(isPalindrome('hello')).toBe(false);
    expect(isPalindrome('abc')).toBe(false);
  });

  test('忽略大小写与符号', () => {
    expect(isPalindrome('Noon')).toBe(true);
    expect(isPalindrome('Able was I ere I saw Elba')).toBe(true);
  });
});
`,
        hiddenGrader: `import { isPalindrome } from './lesson';

describe('isPalindrome 隐藏校验', () => {
  test('更多用例', () => {
    expect(isPalindrome('')).toBe(true);
    expect(isPalindrome('a')).toBe(true);
    expect(isPalindrome('ab')).toBe(false);
    expect(isPalindrome('abba')).toBe(true);
    expect(isPalindrome('12321')).toBe(true);
  });

  test('不能靠固定返回蒙混', () => {
    expect(isPalindrome('step on no pets')).toBe(true);
    expect(isPalindrome('hello world')).toBe(false);
  });
});
`,
        tips: [
          '先归一化：转小写、去掉非字母数字，再判断正反向是否相等',
          '空字符串视为回文',
          '可以用双指针从两端向中间比较，避免生成反转字符串'
        ],
        quiz: [
          {
            question: '判断回文时通常需要先做哪一步？',
            options: ['排序', '归一化（去符号/统一大小写）', '反转整个字符串再比较长度', '转大写即可'],
            answer: 1,
          },
        ],
      },
      {
        key: 'tdd-caesar',
        title: '14.5 TDD：凯撒密码',
        description: '实现 caesarCipher(str, shift)：把英文字母向前平移 shift 位。只平移字母、保留大小写、非字母字符原样保留；平移越过 z 回到 a；shift 可为负数。',
        code: `// TDD 练习：实现 caesarCipher
// 凯撒密码：把英文字母向前平移 shift 位
// 规则：只平移字母，保留大小写；非字母字符原样保留；
//       平移超过 z 回到 a；shift 可为负数（反向平移）
export function caesarCipher(str: string, shift: number): string {
  // TODO: 实现你的逻辑
  return str;
}
`,
        solution: `export function caesarCipher(str: string, shift: number): string {
  const shiftChar = (code: number, start: number) =>
    start + (((code - start + shift) % 26) + 26) % 26;
  return str
    .split('')
    .map((ch) => {
      const code = ch.charCodeAt(0);
      if (code >= 65 && code <= 90) return String.fromCharCode(shiftChar(code, 65));
      if (code >= 97 && code <= 122) return String.fromCharCode(shiftChar(code, 97));
      return ch;
    })
    .join('');
}
`,
        grader: `import { caesarCipher } from './lesson';

describe('caesarCipher', () => {
  test('向后平移', () => {
    expect(caesarCipher('abc', 1)).toBe('bcd');
    expect(caesarCipher('xyz', 1)).toBe('yza');
  });

  test('保留大小写', () => {
    expect(caesarCipher('ABC', 1)).toBe('BCD');
    expect(caesarCipher('AbC', 2)).toBe('CdE');
  });

  test('非字母字符原样保留', () => {
    expect(caesarCipher('a b!', 1)).toBe('b c!');
    expect(caesarCipher('Hello, World!', 3)).toBe('Khoor, Zruog!');
  });

  test('负数 shift 反向平移', () => {
    expect(caesarCipher('bcd', -1)).toBe('abc');
  });
});
`,
        hiddenGrader: `import { caesarCipher } from './lesson';

describe('caesarCipher 隐藏校验', () => {
  test('更多用例', () => {
    expect(caesarCipher('', 5)).toBe('');
    expect(caesarCipher('Z', 1)).toBe('A');
    expect(caesarCipher('m', 13)).toBe('z');
    expect(caesarCipher('Attack at dawn', 5)).toBe('Fyyfhp fy ifbs');
  });

  test('不能靠原样返回蒙混', () => {
    expect(caesarCipher('abc', 3)).toBe('def');
    expect(caesarCipher('abc', 3)).not.toBe('abc');
  });
});
`,
        tips: [
          '用取模运算处理“越过字母表末尾绕回”的情况',
          '只对字母做平移，先判断 ASCII 范围（A-Z / a-z）',
          '负数 shift 表示反向平移，取模时记得先 +26 再取模避免负数'
        ],
        quiz: [
          {
            question: '凯撒密码处理“越过 z 绕回 a”通常用？',
            options: ['if 判断分支', '取模运算', '字符串拼接', '递归'],
            answer: 1,
          },
        ],
      },
    ],
  },
  {
    key: 'react-testing',
    title: '第十五章：React 组件测试（jsdom）',
    description: '在 jsdom 环境中用 @testing-library/react 测试 React 组件：渲染、交互与受控输入。课时已给定测试，请你实现组件让它通过。',
    lessons: [
      {
        key: 'rt-greeting',
        title: '15.1 渲染组件',
        description: '实现 Greeting 组件：接收 name 属性，渲染 <h1>Hello, {name}!</h1>。用 render + getByText 验证。',
        environment: 'jsdom',
        code: `import { type FC } from 'react';

export const Greeting: FC<{ name: string }> = ({ name }) => {
  // TODO: 返回 <h1>Hello, {name}!</h1>
  return null;
};
`,
        solution: `import { type FC } from 'react';

export const Greeting: FC<{ name: string }> = ({ name }) => {
  return <h1>Hello, {name}!</h1>;
};
`,
        grader: `import { render, screen } from '@testing-library/react';
import { describe, test, expect } from 'vitest';
import { Greeting } from './lesson';

describe('Greeting', () => {
  test('渲染问候语', () => {
    render(<Greeting name="Vitest" />);
    expect(screen.getByText('Hello, Vitest!')).toBeTruthy();
  });
});
`,
        hiddenGrader: `import { render, screen } from '@testing-library/react';
import { describe, test, expect } from 'vitest';
import { Greeting } from './lesson';

describe('Greeting 隐藏校验', () => {
  test('不同名字', () => {
    render(<Greeting name="World" />);
    expect(screen.getByText('Hello, World!')).toBeTruthy();
  });

  test('空名字', () => {
    render(<Greeting name="" />);
    expect(screen.getByText('Hello, !')).toBeTruthy();
  });
});
`,
        tips: [
          '用 render(<Comp />) 把组件挂载到 jsdom 的文档中',
          'screen.getByText(...) 找不到文本会直接抛错，从而让测试失败',
          '组件名需与测试导入一致（这里导出 Greeting）'
        ],
        quiz: [
          {
            question: '在 @testing-library/react 中，把组件挂载到 DOM 通常用？',
            options: ['mount()', 'render()', 'attach()', 'display()'],
            answer: 1,
          },
        ],
      },
      {
        key: 'rt-counter',
        title: '15.2 状态与事件',
        description: '实现 Counter 组件：渲染一个按钮，文字为 "count is {n}"（n 初始 0），点击按钮 n+1。用 fireEvent 触发点击。',
        environment: 'jsdom',
        code: `import { useState, type FC } from 'react';

export const Counter: FC = () => {
  const [count, setCount] = useState(0);
  // TODO: 渲染 <button>，文字为 \`count is \${count}\`
  //       点击时 setCount(count + 1)
  return null;
};
`,
        solution: `import { useState, type FC } from 'react';

export const Counter: FC = () => {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>count is {count}</button>;
};
`,
        grader: `import { render, screen, fireEvent } from '@testing-library/react';
import { describe, test, expect } from 'vitest';
import { Counter } from './lesson';

describe('Counter', () => {
  test('初始为 0，点击后加 1', () => {
    render(<Counter />);
    const btn = screen.getByRole('button', { name: /count is 0/i });
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    expect(screen.getByRole('button', { name: /count is 1/i })).toBeTruthy();
  });
});
`,
        hiddenGrader: `import { render, screen, fireEvent } from '@testing-library/react';
import { describe, test, expect } from 'vitest';
import { Counter } from './lesson';

describe('Counter 隐藏校验', () => {
  test('连续点击三次', () => {
    render(<Counter />);
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(screen.getByText(/count is 3/i)).toBeTruthy();
  });

  test('不能靠常量蒙混', () => {
    render(<Counter />);
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    expect(screen.queryByText(/count is 0/i)).toBeNull();
  });
});
`,
        tips: [
          'useState 提供状态与更新函数',
          'fireEvent.click(btn) 模拟一次用户点击',
          '按钮的可访问名称（accessible name）包含其文本内容'
        ],
        quiz: [
          {
            question: '模拟一次按钮点击应优先使用？',
            options: ['btn.click()', 'fireEvent.click(btn)', 'dispatch(click)', 'trigger(btn)'],
            answer: 1,
          },
        ],
      },
      {
        key: 'rt-mirror',
        title: '15.3 受控输入',
        description: '实现 Mirror 组件：渲染一个 <input> 和一个 <p>，让 <p> 实时显示 input 的当前值（受控组件）。',
        environment: 'jsdom',
        code: `import { useState, type FC } from 'react';

export const Mirror: FC = () => {
  const [value, setValue] = useState('');
  // TODO: 渲染 <input>（受控）与 <p>，
  //       <p> 实时显示 input 的当前值
  return null;
};
`,
        solution: `import { useState, type FC } from 'react';

export const Mirror: FC = () => {
  const [value, setValue] = useState('');
  return (
    <>
      <input value={value} onChange={(e) => setValue(e.target.value)} />
      <p>{value}</p>
    </>
  );
};
`,
        grader: `import { render, screen, fireEvent } from '@testing-library/react';
import { describe, test, expect } from 'vitest';
import { Mirror } from './lesson';

describe('Mirror', () => {
  test('输入内容实时回显', () => {
    render(<Mirror />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Vitest' } });
    expect(screen.getByText('Vitest')).toBeTruthy();
  });
});
`,
        hiddenGrader: `import { render, screen, fireEvent } from '@testing-library/react';
import { describe, test, expect } from 'vitest';
import { Mirror } from './lesson';

describe('Mirror 隐藏校验', () => {
  test('更新输入内容', () => {
    render(<Mirror />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Hello' } });
    expect(screen.getByText('Hello')).toBeTruthy();
    fireEvent.change(input, { target: { value: 'World' } });
    expect(screen.getByText('World')).toBeTruthy();
  });

  test('不能固定显示常量', () => {
    render(<Mirror />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'abc' } });
    expect(screen.queryByText('xyz')).toBeNull();
  });
});
`,
        tips: [
          '受控组件：value 来自 state，onChange 把新值写回 state',
          "getByRole('textbox') 可定位 input",
          'fireEvent.change(input, { target: { value } }) 触发受控更新'
        ],
        quiz: [
          {
            question: '受控组件的 input 值应该来自？',
            options: ['DOM 自身', 'React state', '随机数', 'ref'],
            answer: 1,
          },
        ],
      },
    ],
  },

  // ========== 第十六章：TDD 进阶实战 ==========
  {
    key: 'tdd-advanced',
    title: '第十六章：TDD 进阶实战',
    description: '更多经典 TDD kata：罗马数字、有效括号。测试已给出，请实现让它们通过。',
    lessons: [
      {
        key: 'roman',
        title: '16.1 TDD：罗马数字',
        description: '实现 toRoman(n)，把阿拉伯数字（1-3999）转成罗马数字。测试已给出，请实现让它们通过。',
        code: `export function toRoman(n: number): string {
  // TODO: 实现阿拉伯数字 -> 罗马数字
  return '';
}
`,
        grader: `import { toRoman } from './lesson';

describe('toRoman', () => {
  test('基本符号', () => {
    expect(toRoman(1)).toBe('I');
    expect(toRoman(5)).toBe('V');
    expect(toRoman(10)).toBe('X');
    expect(toRoman(50)).toBe('L');
    expect(toRoman(100)).toBe('C');
    expect(toRoman(500)).toBe('D');
    expect(toRoman(1000)).toBe('M');
  });

  test('组合与减法', () => {
    expect(toRoman(4)).toBe('IV');
    expect(toRoman(9)).toBe('IX');
    expect(toRoman(40)).toBe('XL');
    expect(toRoman(90)).toBe('XC');
    expect(toRoman(400)).toBe('CD');
    expect(toRoman(900)).toBe('CM');
  });

  test('综合', () => {
    expect(toRoman(1994)).toBe('MCMXCIV');
    expect(toRoman(2024)).toBe('MMXXIV');
    expect(toRoman(3999)).toBe('MMMCMXCIX');
  });
});
`,
        hiddenGrader: `import { toRoman } from './lesson';

describe('toRoman 隐藏校验', () => {
  test('更多边界', () => {
    expect(toRoman(3)).toBe('III');
    expect(toRoman(58)).toBe('LVIII');
    expect(toRoman(944)).toBe('CMXLIV');
    expect(toRoman(16)).toBe('XVI');
  });

  test('不能靠常量蒙混', () => {
    expect(toRoman(1)).not.toBe('');
    expect(toRoman(2)).toBe('II');
    expect(toRoman(6)).toBe('VI');
  });
});
`,
        tips: [
          '用「值-符号」映射表（从大到小）配合贪心取法',
          '减法组合出现在 4/9/40/90/400/900',
          '循环减去能容纳的最大符号，直到 n 为 0'
        ],
      },
      {
        key: 'valid-parens',
        title: '16.2 TDD：有效括号',
        description: '实现 isValid(s)，判断括号串是否合法（(), [], {} 三种，且正确嵌套）。测试已给出。',
        code: `export function isValid(s: string): boolean {
  // TODO: 用栈判断括号是否匹配
  return false;
}
`,
        grader: `import { isValid } from './lesson';

describe('isValid', () => {
  test('有效', () => {
    expect(isValid('()')).toBe(true);
    expect(isValid('()[]{}')).toBe(true);
    expect(isValid('([])')).toBe(true);
    expect(isValid('{[]}')).toBe(true);
  });

  test('无效', () => {
    expect(isValid('(')).toBe(false);
    expect(isValid(')(')).toBe(false);
    expect(isValid('([)]')).toBe(false);
    expect(isValid('{')).toBe(false);
  });
});
`,
        hiddenGrader: `import { isValid } from './lesson';

describe('isValid 隐藏校验', () => {
  test('更多边界', () => {
    expect(isValid('')).toBe(true);
    expect(isValid('((()))')).toBe(true);
    expect(isValid('(]')).toBe(false);
    expect(isValid('([{}])')).toBe(true);
    expect(isValid('(((')).toBe(false);
  });

  test('不能靠长度奇偶蒙混', () => {
    expect(isValid('()()')).toBe(true);
    expect(isValid('))((')).toBe(false);
  });
});
`,
        tips: [
          '用栈：遇到左括号入栈，遇到右括号与栈顶匹配',
          '匹配不上或结束后栈非空都算无效',
          '空串视为有效'
        ],
      },
    ]
  },
];
