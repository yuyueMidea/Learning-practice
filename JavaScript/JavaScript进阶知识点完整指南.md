<img width="1440" height="1344" alt="image" src="https://github.com/user-attachments/assets/49f34f18-dc0e-408f-a6ca-4751c13c9542" />


上面是交互式知识导览，可以按分类筛选、搜索关键词、点击展开各章节。下面是完整的 Markdown 版本，直接可以复制收藏：

---

# JavaScript 进阶知识点全览

## 一、作用域、闭包与执行上下文

### 执行上下文（EC）与调用栈
每次函数调用都会创建新的执行上下文，包含 `variableEnvironment`、`lexicalEnvironment` 和 `this` 绑定。执行上下文压入调用栈，返回后弹出。

### 词法作用域
JS 采用词法作用域：函数的作用域在**定义时**确定，而非调用时。属性查找沿 `[[Environment]]` 逐层向上。

### 闭包（Closure）
函数 + 其外部词法环境的引用。核心用途：
- 封装私有变量（模块模式）
- 柯里化 / 偏应用函数
- 记忆化（memoize）
- 循环中用 `let` 或 IIFE 保存正确的状态

### 变量提升（Hoisting）
- `var`：声明提升，值为 `undefined`
- `function`：整体提升
- `let/const`：存在**暂时性死区（TDZ）**，访问会抛 `ReferenceError`

---

## 二、异步编程与事件循环

### 事件循环（Event Loop）
执行顺序：**同步代码** → **微任务队列**（`Promise.then`、`queueMicrotask`、`MutationObserver`）→ **宏任务队列**（`setTimeout`、`setInterval`、I/O）。每轮宏任务执行前，先清空全部微任务。

### Promise 深入
- 三种状态：`pending` → `fulfilled` / `rejected`（不可逆）
- `Promise.all`（全成功才成功）vs `allSettled`（全部落定）vs `race`（最快的）vs `any`（最快成功的）
- Promise 构造函数的执行器是**同步执行**的

### async / await
`async` 函数始终返回 Promise；`await` 暂停当前微任务。关键性能点：循环中的 `await` 是**串行**的，需要并行时用 `Promise.all`。

### Generator 与迭代器协议
`function*` 返回迭代器，`yield` 暂停执行。实现 `[Symbol.iterator]` 使自定义对象支持 `for...of`。`yield*` 可委托给另一个可迭代对象。

### 任务调度 API
- `requestAnimationFrame`：每帧渲染前执行，适合动画
- `requestIdleCallback`：浏览器空闲时执行，适合低优先级任务
- `MessageChannel`：创建低优先级宏任务

---

## 三、原型、继承与类

### 原型链
每个对象有 `[[Prototype]]`，属性查找沿链向上，终点为 `Object.prototype`（其 `[[Prototype]]` 为 `null`）。

### new 操作符原理（四步）
1. 创建空对象
2. 设置 `[[Prototype]]` 为 `Fn.prototype`
3. 以新对象为 `this` 执行构造函数
4. 若构造函数返回对象则用它，否则返回新对象

### 寄生组合式继承（ES5 最优方案）
```js
function Child(...args) {
  Parent.call(this, ...args); // 借用构造函数
}
Child.prototype = Object.create(Parent.prototype);
Child.prototype.constructor = Child;
```

### ES6 Class 语法糖
- 本质仍基于原型，`extends` 自动处理原型链
- 子类构造函数必须调用 `super()`
- `static` 方法属于类本身，不在实例上
- 私有字段 `#field`（ES2022）真正的私有

### Mixin 模式
JS 不支持多继承，用 `Object.assign(Target.prototype, MixinA, MixinB)` 或高阶函数组合行为。

---

## 四、this 绑定与函数机制

### this 的四种绑定规则（优先级从低到高）
| 规则 | 示例 | this 指向 |
|---|---|---|
| 默认绑定 | `fn()` | 全局对象 / `undefined`（严格模式）|
| 隐式绑定 | `obj.fn()` | `obj` |
| 显式绑定 | `fn.call(ctx)` | `ctx` |
| new 绑定 | `new Fn()` | 新创建的实例 |

箭头函数无自身 `this`，捕获外层词法 `this`，不可被 `call/apply/bind` 改变。

### 柯里化（Currying）
```js
const curry = fn => {
  const arity = fn.length;
  return function curried(...args) {
    return args.length >= arity
      ? fn(...args)
      : (...more) => curried(...args, ...more);
  };
};
```

### 函数组合（Compose / Pipe）
```js
const compose = (...fns) => x => fns.reduceRight((v, f) => f(v), x);
const pipe    = (...fns) => x => fns.reduce((v, f) => f(v), x);
```

---

## 五、内存管理与垃圾回收

### V8 堆内存结构
- **新生代**：存活时间短的对象，Scavenge（复制）算法，速度快
- **老生代**：存活时间长的对象，标记清除 + 标记整理

### 内存泄漏常见场景
- 意外全局变量（忘写 `var/let/const`）
- 被遗忘的定时器或事件监听器
- 闭包意外持有大对象引用
- 变量持有已从文档移除的 DOM 节点（游离节点）

### WeakRef 与 FinalizationRegistry（ES2021）
- `WeakRef`：持有弱引用，不阻止 GC
- `FinalizationRegistry`：对象被回收后执行清理回调（时机不确定）

---

## 六、DOM 操作与事件系统

### 事件流三阶段
**捕获**（自顶向下）→ **目标** → **冒泡**（自底向上）

`addEventListener(type, fn, { capture: true })` 在捕获阶段触发。

### 事件委托
将监听器挂在父节点，通过 `e.target` 判断来源，大幅减少监听器数量，也支持动态添加的子元素。

### 重排（Reflow）vs 重绘（Repaint）
- 改变几何属性（宽高位置）→ 触发重排（代价最高）
- 只改变颜色 → 只触发重绘
- 优化：用 `DocumentFragment` 批量操作；读写分离；`transform` 开启 GPU 合成层

### 现代观察者 API
- `MutationObserver`：异步监听 DOM 变更（微任务回调）
- `IntersectionObserver`：监听元素与视口交叉，用于懒加载
- `ResizeObserver`：监听元素尺寸变化

---

## 七、ES6+ 核心新特性

### Proxy 与 Reflect
```js
const handler = {
  get(target, key, receiver) {
    console.log(`读取 ${key}`);
    return Reflect.get(target, key, receiver);
  }
};
const proxy = new Proxy(obj, handler);
```
`Proxy` 拦截 13 种操作，是 Vue 3 响应式原理的核心。`Reflect` 提供与陷阱对应的默认行为。

### Symbol 与 Well-known Symbols
| Symbol | 用途 |
|---|---|
| `Symbol.iterator` | 自定义迭代行为 |
| `Symbol.toPrimitive` | 自定义类型转换 |
| `Symbol.hasInstance` | 自定义 `instanceof` |
| `Symbol.asyncIterator` | 自定义异步迭代 |

### Map / Set / WeakMap / WeakSet
- `Map`：任意类型键，保持插入顺序，`.size` 属性
- `Set`：唯一值集合，可用于数组去重
- `WeakMap/WeakSet`：键为弱引用，不可枚举，适合存储私有数据或做缓存

### ES2020–2024 精选
```js
// 空值合并 + 可选链
const name = user?.profile?.name ?? 'anonymous';

// Promise.any（任一成功）
const fastest = await Promise.any([p1, p2, p3]);

// 深克隆
const clone = structuredClone(obj);

// 负索引
const last = arr.at(-1);

// Object.hasOwn（替代 hasOwnProperty）
Object.hasOwn(obj, 'key');

// Top-level await（ESM 中）
const data = await fetch('/api').then(r => r.json());

// 数组分组（ES2024）
const grouped = arr.group(item => item.type);
```

---

## 八、模块化与工程化

### ESM vs CJS 核心区别
| 特性 | ESM | CJS |
|---|---|---|
| 导入时机 | 静态（编译期） | 动态（运行时）|
| 绑定类型 | Live binding（实时） | 值拷贝 |
| Tree Shaking | 支持 | 不支持 |
| 顶层 `this` | `undefined` | `module.exports` |

### Tree Shaking
基于 ESM 静态分析，打包器标记未使用的导出，压缩时删除。在 `package.json` 中设置 `"sideEffects": false` 告知打包器此包无副作用。

### 动态导入
```js
// 路由懒加载示例
const route = {
  component: () => import('./views/Home.vue')
};
```

### 常用设计模式
- **观察者模式**：Subject 直接通知 Observer（如 EventEmitter）
- **发布订阅模式**：通过事件总线中介解耦（如 `$emit/$on`）
- **单例模式**：ES Module 的顶层 export 天然是单例
- **装饰器模式（AOP）**：不修改原函数，包裹添加前置/后置逻辑

---

## 九、性能优化

### 防抖与节流
```js
// 防抖：最后一次触发后 n ms 执行
function debounce(fn, delay) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// 节流：每 n ms 最多执行一次
function throttle(fn, interval) {
  let last = 0;
  return function(...args) {
    const now = Date.now();
    if (now - last >= interval) {
      last = now;
      fn.apply(this, args);
    }
  };
}
```

### V8 隐藏类与内联缓存优化
- **隐藏类**：对象属性顺序相同时共享隐藏类，访问更快
- **内联缓存（IC）**：单态（monomorphic）> 多态（polymorphic）> 超态（megamorphic）
- **避免去优化（deopt）**：不要动态改变对象结构、避免混合类型数组

### Web Worker
```js
// 主线程
const worker = new Worker('./heavy.js');
worker.postMessage({ data: largeArray });
worker.onmessage = e => console.log(e.data);

// heavy.js
self.onmessage = e => {
  const result = heavyCompute(e.data);
  self.postMessage(result);
};
```

---

## 十、TypeScript 进阶

### 条件类型与 infer
```ts
// 提取函数返回类型
type MyReturnType<T> = T extends (...args: any[]) => infer R ? R : never;

// 提取 Promise 内部类型
type Awaited<T> = T extends Promise<infer U> ? Awaited<U> : T;
```

### 映射类型 + 模板字面量
```ts
// 将所有属性变为可选的 getter
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K]
};
```

### 类型守卫
```ts
function isString(x: unknown): x is string {
  return typeof x === 'string';
}

// 断言函数（抛出则说明类型不符）
function assert(cond: unknown): asserts cond {
  if (!cond) throw new Error('Assertion failed');
}
```

---

> **建议学习路径**：作用域/闭包 → 原型链 → this 绑定 → 异步/事件循环 → ES6+ 特性 → Proxy/Reflect → 性能优化 → TypeScript
