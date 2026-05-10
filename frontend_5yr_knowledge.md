# 五年前端工程师核心知识体系

> 整理范围：JS 深度 · 框架原理 · 工程化 · 网络 & 浏览器 · 安全 · 性能优化 · 工具链 · Node & 全栈

---

## 目录

1. [JavaScript 深度](#一javascript-深度)
2. [框架原理](#二框架原理)
3. [工程化](#三工程化)
4. [网络 & 浏览器](#四网络--浏览器)
5. [安全](#五安全)
6. [性能优化](#六性能优化)
7. [工具链 & 协作](#七工具链--协作)
8. [Node.js & 全栈](#八nodejs--全栈)

---

## 一、JavaScript 深度

### 1.1 原型链 & 继承

**核心概念**

- 每个对象都有 `__proto__` 指向其构造函数的 `prototype`，形成原型链，终点为 `null`
- `Object.create(proto)` 创建以 `proto` 为原型的对象；`Object.create(null)` 创建无原型对象
- `instanceof` 原理：沿 `__proto__` 链向上查找，是否存在目标的 `prototype`

**继承方案对比**

| 方案 | 原理 | 缺点 |
|------|------|------|
| 原型链继承 | 子类 prototype = new 父类() | 引用类型属性共享 |
| 构造函数继承 | 子类构造函数中 call 父类 | 无法继承原型方法 |
| 组合继承 | 原型链 + 构造函数 | 父类构造函数调用两次 |
| 寄生组合继承 | Object.create 复制原型 | 最优，ES6 class 的本质 |
| ES6 class | 语法糖，本质寄生组合 | 需 Babel 降级 |

**核心考点**
- 手写 `new` 操作符（创建对象 → 原型绑定 → 执行构造函数 → 返回值判断）
- 手写 `instanceof`（循环 `__proto__` 链比较）
- `class` 语法糖与 ES5 写法的等价关系
- `Object.create(null)` 的使用场景（纯净 Map）

---

### 1.2 作用域 & 闭包

**作用域规则**

- JavaScript 采用**词法作用域**（静态作用域），函数定义时确定作用域，而非调用时
- 变量查找沿**作用域链**向上，直到全局作用域
- `var` 声明提升到函数顶部；`let/const` 存在**暂时性死区（TDZ）**，声明前访问报 ReferenceError

**闭包**

闭包 = 函数 + 其词法环境的引用。内层函数访问外层作用域变量，外层执行完毕后变量仍被持有。

```js
// 经典应用：模块化
function createCounter() {
  let count = 0;
  return {
    inc: () => ++count,
    get: () => count,
  };
}

// 防抖（immediate 版）
function debounce(fn, delay, immediate = false) {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    if (immediate && !timer) fn.apply(this, args);
    timer = setTimeout(() => {
      if (!immediate) fn.apply(this, args);
      timer = null;
    }, delay);
  };
}

// 节流（时间戳版）
function throttle(fn, interval) {
  let last = 0;
  return function (...args) {
    const now = Date.now();
    if (now - last >= interval) {
      last = now;
      fn.apply(this, args);
    }
  };
}
```

**核心考点**
- 写出含闭包的输出结果题（for 循环 + var vs let）
- 防抖 / 节流手写（含 cancel 方法）
- 内存泄漏场景：闭包持有大对象未释放

---

### 1.3 事件循环

**浏览器事件循环**

```
同步代码 → 微任务队列清空 → 渲染 → 宏任务（一个）→ 微任务队列清空 → ...
```

| 类型 | 代表 API |
|------|---------|
| 宏任务 | setTimeout、setInterval、MessageChannel、I/O |
| 微任务 | Promise.then、queueMicrotask、MutationObserver |
| 渲染帧 | requestAnimationFrame（在微任务后、渲染前） |

**async/await 拆解**

```js
async function foo() {
  console.log(1);
  await bar();       // 相当于 Promise.resolve(bar()).then(...)
  console.log(3);    // 在微任务中执行
}
// await 之后的代码 = .then() 回调，放入微任务队列
```

**Node.js 事件循环差异**

Node.js 基于 libuv，多出 `process.nextTick`（优先级高于 Promise.then）和 `setImmediate`（check 阶段）。

**核心考点**
- 给出混合代码写出执行顺序（高频面试题）
- Node.js 中 `process.nextTick` vs `Promise.then` 的顺序
- `queueMicrotask` 与 `Promise.resolve().then` 等价

---

### 1.4 this 绑定

**四种绑定规则**（优先级从高到低）

| 规则 | 触发方式 | this 值 |
|------|---------|---------|
| new 绑定 | `new Fn()` | 新创建的对象 |
| 显式绑定 | `call/apply/bind` | 指定对象 |
| 隐式绑定 | `obj.fn()` | obj |
| 默认绑定 | 普通调用 | undefined（严格）/ global |
| 箭头函数 | — | 继承外层词法 this，无法修改 |

```js
// 手写 bind
Function.prototype.myBind = function (ctx, ...args) {
  const fn = this;
  const bound = function (...rest) {
    // new 调用时忽略绑定的 ctx
    return fn.apply(this instanceof bound ? this : ctx, [...args, ...rest]);
  };
  bound.prototype = Object.create(fn.prototype);
  return bound;
};
```

---

### 1.5 异步编程

**Promise 核心**

```js
// 手写 Promise（简化版）
class MyPromise {
  constructor(executor) {
    this.state = 'pending';
    this.value = undefined;
    this.callbacks = [];
    const resolve = (val) => {
      if (this.state !== 'pending') return;
      this.state = 'fulfilled';
      this.value = val;
      this.callbacks.forEach(cb => cb.onFulfilled(val));
    };
    const reject = (reason) => {
      if (this.state !== 'pending') return;
      this.state = 'rejected';
      this.value = reason;
      this.callbacks.forEach(cb => cb.onRejected(reason));
    };
    try { executor(resolve, reject); } catch (e) { reject(e); }
  }
  then(onFulfilled, onRejected) {
    onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : v => v;
    onRejected = typeof onRejected === 'function' ? onRejected : e => { throw e; };
    return new MyPromise((resolve, reject) => {
      const handle = (fn, val) => {
        try {
          const result = fn(val);
          result instanceof MyPromise ? result.then(resolve, reject) : resolve(result);
        } catch (e) { reject(e); }
      };
      if (this.state === 'fulfilled') handle(onFulfilled, this.value);
      else if (this.state === 'rejected') handle(onRejected, this.value);
      else this.callbacks.push({
        onFulfilled: val => handle(onFulfilled, val),
        onRejected: reason => handle(onRejected, reason),
      });
    });
  }
}
```

**并发控制**

```js
// 限制并发数的 Promise 调度器
class Scheduler {
  constructor(limit) {
    this.limit = limit;
    this.running = 0;
    this.queue = [];
  }
  add(task) {
    return new Promise((resolve) => {
      this.queue.push({ task, resolve });
      this.run();
    });
  }
  run() {
    while (this.running < this.limit && this.queue.length) {
      const { task, resolve } = this.queue.shift();
      this.running++;
      task().then((val) => { resolve(val); this.running--; this.run(); });
    }
  }
}
```

**Promise 静态方法对比**

| 方法 | 行为 |
|------|------|
| `Promise.all` | 全部成功才 resolve，任一 reject 即 reject |
| `Promise.race` | 第一个完成（无论成败）即触发 |
| `Promise.allSettled` | 全部完成，返回每个结果状态 |
| `Promise.any` | 第一个成功即 resolve，全部 reject 才 reject |

---

### 1.6 内存管理

**垃圾回收算法**

- **标记清除**（主流）：从 GC Root 出发标记可达对象，清除未标记对象
- **引用计数**（辅助）：引用数为 0 时回收，无法处理循环引用

**常见内存泄漏场景**

```js
// 1. 意外全局变量
function leak() { leakVar = 'I am global'; }

// 2. 定时器未清除
const timer = setInterval(() => { /* 持有闭包引用 */ }, 1000);
// 正确：组件卸载时 clearInterval(timer)

// 3. 事件监听未移除
element.addEventListener('click', handler);
// 正确：element.removeEventListener('click', handler)

// 4. 闭包持有大对象
function outer() {
  const bigData = new Array(1000000);
  return function inner() { return bigData[0]; }
  // bigData 无法被回收
}
```

**WeakMap / WeakRef**

```js
// WeakMap key 为弱引用，不阻止 GC
const cache = new WeakMap();
function process(obj) {
  if (!cache.has(obj)) cache.set(obj, heavyCompute(obj));
  return cache.get(obj);
}
// obj 被 GC 回收后，cache 中对应条目自动消失
```

---

### 1.7 ES6+ 关键特性

**迭代协议**

```js
// 自定义可迭代对象
const range = {
  from: 1, to: 5,
  [Symbol.iterator]() {
    let cur = this.from;
    return {
      next: () => cur <= this.to
        ? { value: cur++, done: false }
        : { value: undefined, done: true }
    };
  }
};
for (const n of range) console.log(n); // 1 2 3 4 5
```

**Generator 实现 async/await**

```js
function run(gen) {
  const g = gen();
  function step(val) {
    const { value, done } = g.next(val);
    if (done) return Promise.resolve(value);
    return Promise.resolve(value).then(step);
  }
  return step();
}
```

**Proxy 实现响应式**

```js
function reactive(obj) {
  return new Proxy(obj, {
    get(target, key, receiver) {
      track(target, key); // 收集依赖
      return Reflect.get(target, key, receiver);
    },
    set(target, key, value, receiver) {
      const result = Reflect.set(target, key, value, receiver);
      trigger(target, key); // 触发更新
      return result;
    }
  });
}
```

**ESM vs CJS 核心差异**

| 特性 | ESM | CommonJS |
|------|-----|---------|
| 加载时机 | 静态（编译时） | 动态（运行时） |
| 导出值 | 实时绑定（引用） | 值的拷贝 |
| Tree-shaking | 支持 | 不支持 |
| 顶层 await | 支持 | 不支持 |

---

## 二、框架原理

### 2.1 Vue 响应式原理

**Vue 2：Object.defineProperty**

```
data 初始化 → Observer 递归遍历 → defineProperty 劫持 getter/setter
getter 触发 → Dep.depend() → 将当前 Watcher 加入 dep.subs
setter 触发 → dep.notify() → 遍历 subs 调用 watcher.update()
```

局限性：
- 无法检测对象属性的新增 / 删除（需 `Vue.set`）
- 无法检测数组下标直接赋值（重写了 7 个变异方法）
- 初始化时需递归遍历所有属性，性能消耗大

**Vue 3：Proxy + effect**

```js
// 核心流程
effect(() => {             // 1. 创建副作用，立即执行
  const val = state.count; // 2. 触发 get → track(state, 'count')
  render(val);
});

state.count++;             // 3. 触发 set → trigger(state, 'count') → 重新执行 effect
```

优势：
- 惰性（Lazy）追踪，只有被访问的属性才建立依赖
- 原生支持数组下标、对象动态属性、Map/Set
- `ref` 通过 `.value` 的 getter/setter 包装原始值

---

### 2.2 Virtual DOM & Diff 算法

**Diff 核心策略**（Vue2/React 均采用同层比较）

```
同层比较 → O(n)（放弃跨层移动的精确追踪）
新旧节点类型不同 → 直接销毁重建
类型相同 → 复用 DOM，更新属性
有 key → 建立 key-index 映射，最大化复用
```

**key 的本质作用**
- 给 Diff 算法提供稳定的节点身份标识
- 无 key：按位置比较，可能产生大量错误复用（输入框内容错乱）
- 不要用 index 作 key（列表增删时位置变化，等同无 key）

**Vue 3 编译优化**

```
静态提升：纯静态节点提升到渲染函数外，不参与 Diff
Patch Flag：动态节点标记（CLASS=2, TEXT=8...），只对标记部分做比较
Block Tree：收集动态节点，跳过静态子树
```

**React Fiber**

- 将 VNode 树拆分为 Fiber 链表（child/sibling/return 指针）
- 工作循环可中断：每处理一个 Fiber 节点检查时间片（5ms）
- 双缓冲树：current tree（已渲染）与 workInProgress tree 交替

---

### 2.3 React Hooks 原理

**Hooks 链表存储**

```js
// 组件的 Fiber 节点上挂载 memoizedState 链表
// useState(0) → useState('') → useEffect(...)
//   ↓              ↓               ↓
// hook1         hook2           hook3

// 规则：不能在条件/循环中调用 Hooks
// 原因：链表顺序必须每次渲染保持一致
```

**useState 闭包陷阱**

```js
function Counter() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      console.log(count); // 永远是 0（闭包捕获了初始值）
      setCount(count + 1); // 错误写法
      setCount(c => c + 1); // 正确：函数式更新，获取最新值
    }, 1000);
    return () => clearInterval(timer);
  }, []); // 空依赖数组 → effect 只执行一次
}
```

**自定义 Hook 规范**

```js
// 抽象接口请求逻辑
function useFetch(url) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then(r => r.json())
      .then(d => { if (!cancelled) setData(d); })
      .catch(e => { if (!cancelled) setError(e); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; }; // 清理：防止组件卸载后 setState
  }, [url]);
  return { data, loading, error };
}
```

---

### 2.4 状态管理

**Vuex / Pinia 对比**

| 特性 | Vuex 4 | Pinia |
|------|--------|-------|
| 模块化 | 嵌套 modules | 多 store 扁平化 |
| Mutation | 必须，同步 | 无，直接修改 |
| TypeScript | 类型推断弱 | 完整类型推断 |
| DevTools | 支持 | 支持 |
| Bundle Size | 较大 | 更小 |

**Redux 核心原则**

```
单一数据源（Single Store）→ state 只读（Pure Reducer）→ 纯函数变更
middleware 洋葱模型：action → middleware1 → middleware2 → reducer
redux-thunk：dispatch 一个函数，函数内可异步操作后再 dispatch action
```

**Context 的性能问题**

Context value 变化 → 所有消费该 Context 的组件强制重渲染（无论 value 的哪个字段变化）。解决：拆分 Context 或用 `useMemo` 稳定 value 引用。

---

### 2.5 服务端渲染 SSR

**渲染模式对比**

| 模式 | 优点 | 缺点 | 适用场景 |
|------|------|------|---------|
| CSR（客户端渲染）| 前后端分离、交互丰富 | 首屏慢、SEO 差 | 后台管理、SaaS |
| SSR（服务端渲染）| 首屏快、SEO 好 | 服务器压力大 | 内容网站、电商 |
| SSG（静态生成）| 极快、CDN 全缓存 | 无法实时数据 | 博客、文档 |
| ISR（增量再生成）| SSG + 定时重建 | 短暂数据不一致 | 新闻、商品页 |

**Hydration 注水过程**

```
服务端 → 生成 HTML 字符串（含 data-* 快照）→ 发送给客户端
客户端 → 加载 JS → React/Vue 对比服务端 HTML → 绑定事件监听
```

不匹配（Hydration Mismatch）原因：时间戳、随机数、浏览器专有 API 在 SSR 阶段执行。

---

## 三、工程化

### 3.1 Webpack 核心

**构建流程**

```
初始化（读取配置）
→ 编译（从 entry 出发，调用 Loader 转换每个模块）
→ 输出（chunk 分组 → 模板生成 → 写入文件）
```

核心概念：
- **Loader**：转换单个文件内容（处理 .vue、.ts、.css），同步或异步函数
- **Plugin**：基于 Tapable 事件钩子，介入整个编译生命周期
- **Chunk**：逻辑上的代码分组；**Bundle**：最终输出的文件

**手写简单 Plugin**

```js
class MyPlugin {
  apply(compiler) {
    compiler.hooks.emit.tapAsync('MyPlugin', (compilation, callback) => {
      // compilation.assets 包含所有输出文件
      const content = Object.keys(compilation.assets).join('\n');
      compilation.assets['filelist.txt'] = {
        source: () => content,
        size: () => content.length,
      };
      callback();
    });
  }
}
```

**splitChunks 策略**

```js
optimization: {
  splitChunks: {
    chunks: 'all',
    cacheGroups: {
      vendors: {
        test: /[\\/]node_modules[\\/]/,
        priority: -10,
        name: 'vendors',
      },
      common: {
        minChunks: 2, // 被至少 2 个 chunk 引用
        priority: -20,
        reuseExistingChunk: true,
      },
    },
  },
}
```

**HMR 原理**

```
文件变化 → Webpack 增量编译 → WebSocket 推送 hash
→ 浏览器拉取 update.json（变更模块列表）
→ 拉取变更模块代码 → module.hot.accept 回调更新
```

---

### 3.2 Vite 原理

**开发阶段（no-bundle）**

```
浏览器请求 /src/main.ts
→ Vite Dev Server 拦截
→ esbuild 实时编译为 ESM
→ 返回 JS（含 import 路径重写）
→ 浏览器解析 import，发起新请求
```

优势：只编译实际请求的模块，启动时间 = 常数（不受项目规模影响）

**依赖预构建**

```
node_modules 中的 CJS 包 → esbuild 转为 ESM → 缓存至 .vite/deps/
目的：① 统一模块格式 ② 将多文件包合并为单文件（减少 HTTP 请求）
```

**生产构建**

使用 Rollup（非 esbuild）构建，原因：Rollup Tree-shaking 更精准，输出产物更优化。

---

### 3.3 Babel 编译

**编译三阶段**

```
源码
→ 词法分析（tokenizer）→ token 数组
→ 语法分析（parser）→ AST
→ 遍历转换（@babel/traverse + 插件）→ 新 AST
→ 代码生成（@babel/generator）→ 目标代码
```

**手写 AST 插件（变量重命名）**

```js
module.exports = function ({ types: t }) {
  return {
    visitor: {
      Identifier(path) {
        if (path.node.name === 'oldName') {
          path.node.name = 'newName';
        }
      }
    }
  };
};
```

**Polyfill 策略**

```js
// babel.config.js
{
  presets: [
    ['@babel/preset-env', {
      useBuiltIns: 'usage', // 按实际使用自动注入 polyfill
      corejs: 3,
      targets: '> 0.25%, not dead',
    }]
  ]
}
```

---

### 3.4 模块化演进

| 阶段 | 方案 | 解决问题 |
|------|------|---------|
| 全局变量 | `window.xxx` | — |
| IIFE | 立即执行函数 | 避免全局污染 |
| AMD | RequireJS | 异步按需加载（浏览器） |
| CJS | Node.js require | 同步加载（服务端） |
| UMD | 兼容 AMD+CJS | 通用库发布 |
| ESM | import/export | 静态分析、Tree-shaking |

**循环引用处理差异**

```js
// CJS：导出值的拷贝，循环引用时得到未完成初始化的 undefined
// ESM：导出实时绑定（引用），循环引用时访问到的是动态值（但初始化顺序需注意）
```

---

### 3.5 Monorepo

**pnpm workspace 优势**

```
传统 npm：每个包独立 node_modules → 大量重复文件
pnpm：全局 content-addressable store + 硬链接 → 节省磁盘
幽灵依赖问题：pnpm 严格隔离，子包无法访问未声明的依赖
```

**Turborepo 构建缓存**

```json
// turbo.json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],  // 先构建依赖包
      "outputs": ["dist/**"],    // 缓存输出目录
      "inputs": ["src/**"]       // 输入变化才重新构建
    }
  }
}
```

---

### 3.6 CI/CD 与代码质量

**GitHub Actions 示例**

```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm test --coverage
      - run: pnpm build
```

**Git Hooks（Husky + lint-staged）**

```json
// package.json
{
  "lint-staged": {
    "*.{ts,tsx,vue}": ["eslint --fix", "prettier --write"],
    "*.{css,scss}": ["stylelint --fix"]
  }
}
```

---

## 四、网络 & 浏览器

### 4.1 HTTP / HTTPS

**HTTP 版本对比**

| 特性 | HTTP/1.1 | HTTP/2 | HTTP/3 |
|------|---------|--------|--------|
| 多路复用 | 否（队头阻塞） | 是（流） | 是（QUIC 流） |
| 头部压缩 | 否 | HPACK | QPACK |
| 传输层 | TCP | TCP | UDP（QUIC） |
| 服务器推送 | 否 | 是 | 是 |
| 连接建立 | 1 RTT | 1 RTT | 0-1 RTT |

**TLS 1.3 握手**

```
Client → ServerHello（含密钥参数）        } 1 RTT
Server → Certificate + CertVerify + Finished
Client → Finished → 开始加密通信
```

**HTTP 缓存流程**

```
请求资源
→ 强缓存：检查 Cache-Control: max-age / Expires
  → 未过期：直接返回 200（from cache）
  → 已过期：进入协商缓存
    → 发送 If-None-Match（ETag）或 If-Modified-Since
    → 服务器比较：未变化 → 304 Not Modified
                  已变化 → 200 + 新资源
```

---

### 4.2 浏览器渲染流程

```
HTML 解析 → DOM Tree
CSS 解析 → CSSOM Tree
          ↓（合并）
       Render Tree（只含可见元素）
          ↓
       Layout（计算每个节点的几何位置）
          ↓
       Paint（绘制各层像素）
          ↓
       Composite（GPU 合成各图层 → 屏幕）
```

**回流（Reflow）vs 重绘（Repaint）**

| 操作 | 触发回流 | 触发重绘 |
|------|---------|---------|
| 修改尺寸 / 位置 | ✅ | ✅ |
| 修改颜色 / 透明度 | ❌ | ✅ |
| transform / opacity | ❌ | ❌（合成层） |

**减少回流的实践**

```js
// 批量读写：避免强制同步布局（Forced Synchronous Layout）
// 错误：读写交替，每次读都触发回流
element.style.left = element.offsetLeft + 1 + 'px';

// 正确：先统一读，再统一写
const left = element.offsetLeft;
const top = element.offsetTop;
element.style.cssText = `left: ${left + 1}px; top: ${top + 1}px`;
```

---

### 4.3 跨域解决方案

**CORS 预检请求**

```
满足以下任一条件触发预检（OPTIONS 请求）：
- 方法不是 GET/HEAD/POST
- Content-Type 不是 text/plain、multipart/form-data、application/x-www-form-urlencoded
- 包含自定义请求头

服务端响应头：
Access-Control-Allow-Origin: https://example.com
Access-Control-Allow-Methods: GET, POST, PUT
Access-Control-Allow-Headers: Authorization, Content-Type
Access-Control-Max-Age: 86400  // 预检结果缓存时长
```

**Nginx 反向代理**

```nginx
location /api/ {
  proxy_pass http://backend:3000/;
  add_header Access-Control-Allow-Origin $http_origin always;
  add_header Access-Control-Allow-Credentials true always;
}
```

---

### 4.4 WebSocket & SSE

**WebSocket 握手**

```http
GET /chat HTTP/1.1
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==

HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=
```

**心跳机制**

```js
const ws = new WebSocket('wss://example.com');
let heartbeatTimer;
ws.onopen = () => {
  heartbeatTimer = setInterval(() => ws.send('ping'), 30000);
};
ws.onclose = () => {
  clearInterval(heartbeatTimer);
  // 断线重连（指数退避）
  setTimeout(connect, Math.min(30000, retryDelay *= 2));
};
```

**SSE vs WebSocket**

| 特性 | SSE | WebSocket |
|------|-----|----------|
| 方向 | 服务端 → 客户端 | 全双工 |
| 协议 | HTTP | WS |
| 断线重连 | 内置 | 需手动 |
| 适用场景 | 消息推送、实时日志 | 聊天、游戏 |

---

### 4.5 Service Worker & PWA

**生命周期**

```
install（首次注册）→ activate（旧 SW 退出）→ fetch（拦截请求）
```

**缓存策略（Workbox）**

| 策略 | 适用场景 |
|------|---------|
| CacheFirst | 静态资源（图片、字体） |
| NetworkFirst | API 数据（需要最新） |
| StaleWhileRevalidate | 允许短暂旧数据（新闻列表） |
| NetworkOnly | 实时性强（支付） |

---

## 五、安全

### 5.1 XSS（跨站脚本攻击）

**三种类型**

| 类型 | 注入位置 | 持久性 |
|------|---------|-------|
| 存储型 | 数据库 | 持久 |
| 反射型 | URL 参数 | 非持久 |
| DOM 型 | 客户端 JS | 非持久 |

**防御措施**

```js
// 1. 输出转义（React 默认做了，innerHTML 需手动）
import DOMPurify from 'dompurify';
element.innerHTML = DOMPurify.sanitize(userInput);

// 2. CSP（Content Security Policy）
// HTTP 响应头
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-{random}';

// 3. Cookie 安全属性
Set-Cookie: session=abc; HttpOnly; Secure; SameSite=Strict
```

---

### 5.2 CSRF（跨站请求伪造）

**攻击原理**：恶意网站诱导用户发起携带 Cookie 的请求

**防御方案**

```js
// 1. SameSite Cookie（推荐）
// Strict：任何跨站请求都不带 Cookie
// Lax：GET 等安全方法允许，POST 不允许
Set-Cookie: token=xxx; SameSite=Lax

// 2. CSRF Token
// 服务端生成随机 token → 前端随每个请求发送 → 服务端验证
axios.defaults.headers['X-CSRF-Token'] = getCsrfToken();

// 3. 验证 Referer / Origin
// Origin 比 Referer 更可靠（不含路径，隐私更友好）
```

---

### 5.3 OAuth2 & JWT

**授权码模式流程**

```
用户 → 点击"用 GitHub 登录"
→ 重定向到 GitHub 授权页（带 client_id, redirect_uri, state）
→ 用户同意 → GitHub 重定向回 redirect_uri（带 code）
→ 后端用 code + client_secret 换取 access_token（server-to-server）
→ 用 access_token 获取用户信息
→ 生成自己的 JWT 返回给前端
```

**JWT 安全要点**

```
不要存 localStorage（XSS 可读取）
推荐：httpOnly Cookie 存 refresh_token，内存存 access_token
签名算法：RS256（非对称）比 HS256（对称）更安全（公钥可公开验证）
设置合理过期时间：access_token 15min，refresh_token 7d
```

---

## 六、性能优化

### 6.1 Core Web Vitals

| 指标 | 含义 | 良好阈值 |
|------|------|---------|
| LCP（最大内容绘制）| 视口内最大元素渲染完成时间 | ≤ 2.5s |
| INP（交互到下一次绘制）| 用户交互的最大响应延迟 | ≤ 200ms |
| CLS（累积布局偏移）| 页面元素意外移动的总量 | ≤ 0.1 |

**LCP 优化**

```html
<!-- preload 关键图片 -->
<link rel="preload" as="image" href="/hero.webp" fetchpriority="high">
<!-- 图片指定尺寸，防止 CLS -->
<img src="/hero.webp" width="800" height="600" alt="...">
```

**INP 优化**

```js
// 长任务分片（Scheduler API）
async function processLargeList(items) {
  for (let i = 0; i < items.length; i++) {
    process(items[i]);
    if (i % 100 === 0) {
      await new Promise(r => setTimeout(r, 0)); // 让出主线程
    }
  }
}
```

---

### 6.2 加载性能

**资源提示**

```html
<!-- DNS 预解析 -->
<link rel="dns-prefetch" href="//cdn.example.com">
<!-- 预连接（含 TLS）-->
<link rel="preconnect" href="https://fonts.googleapis.com">
<!-- 预加载当前页关键资源 -->
<link rel="preload" as="script" href="/critical.js">
<!-- 预获取下一页资源 -->
<link rel="prefetch" href="/next-page.js">
```

**图片优化**

```html
<!-- 现代格式 + 懒加载 -->
<picture>
  <source type="image/avif" srcset="img.avif">
  <source type="image/webp" srcset="img.webp">
  <img src="img.jpg" loading="lazy" decoding="async" width="800" height="600">
</picture>
```

**代码分割**

```js
// 路由级懒加载（Vue Router）
const routes = [
  { path: '/dashboard', component: () => import('./views/Dashboard.vue') },
];

// React.lazy
const Dashboard = React.lazy(() => import('./Dashboard'));
```

---

### 6.3 虚拟列表

```js
// 核心原理：只渲染可视区域 + 缓冲区
class VirtualList {
  constructor({ itemHeight, containerHeight, total }) {
    this.itemHeight = itemHeight;
    this.containerHeight = containerHeight;
    this.total = total;
    this.bufferSize = 5; // 上下各缓冲 5 条
  }
  getVisibleRange(scrollTop) {
    const start = Math.max(0, Math.floor(scrollTop / this.itemHeight) - this.bufferSize);
    const visibleCount = Math.ceil(this.containerHeight / this.itemHeight);
    const end = Math.min(this.total, start + visibleCount + this.bufferSize * 2);
    return { start, end, offsetY: start * this.itemHeight };
  }
}
```

---

### 6.4 性能监控

```js
// PerformanceObserver 监听 Core Web Vitals
new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.log('LCP:', entry.startTime);
    // 上报
    navigator.sendBeacon('/analytics', JSON.stringify({ lcp: entry.startTime }));
  }
}).observe({ entryTypes: ['largest-contentful-paint'] });

// 错误监控
window.addEventListener('error', (e) => {
  report({ type: 'error', message: e.message, filename: e.filename, line: e.lineno });
});
window.addEventListener('unhandledrejection', (e) => {
  report({ type: 'promise', reason: String(e.reason) });
});
```

---

## 七、工具链 & 协作

### 7.1 TypeScript 进阶

**实用工具类型手写**

```ts
// DeepPartial
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// ReturnType
type MyReturnType<T extends (...args: any) => any> =
  T extends (...args: any) => infer R ? R : never;

// 条件分发类型
type ToArray<T> = T extends any ? T[] : never;
type Res = ToArray<string | number>; // string[] | number[]

// 模板字面量类型
type EventName<T extends string> = `on${Capitalize<T>}`;
type Events = EventName<'click' | 'focus'>; // 'onClick' | 'onFocus'
```

**strict 模式关键约束**

```
strictNullChecks：null/undefined 不可赋值给其他类型
noImplicitAny：禁止隐式 any
strictFunctionTypes：函数参数逆变检查
useUnknownInCatchVariables：catch 变量类型为 unknown（非 any）
```

---

### 7.2 微前端

**qiankun JS 沙箱原理**

```js
// Proxy 沙箱（ProxySandbox）
class ProxySandbox {
  constructor() {
    this.fakeWindow = {};
    this.proxy = new Proxy(this.fakeWindow, {
      set(target, key, value) {
        target[key] = value; // 写入子应用的假 window
        return true;
      },
      get(target, key) {
        return key in target ? target[key] : window[key]; // 读：先沙箱后真 window
      }
    });
  }
}
```

**Module Federation（Webpack 5）**

```js
// 宿主应用 webpack.config.js
new ModuleFederationPlugin({
  name: 'host',
  remotes: {
    app1: 'app1@http://localhost:3001/remoteEntry.js',
  },
  shared: { react: { singleton: true }, 'react-dom': { singleton: true } },
});

// 子应用
new ModuleFederationPlugin({
  name: 'app1',
  filename: 'remoteEntry.js',
  exposes: { './Button': './src/Button' },
});
```

---

### 7.3 测试体系

**测试金字塔**

```
         E2E（少）
        Playwright / Cypress
       集成测试（适量）
      Testing Library
     单元测试（多）
    Vitest / Jest
```

**Mock Service Worker（MSW）**

```js
// src/mocks/handlers.js
import { http, HttpResponse } from 'msw';
export const handlers = [
  http.get('/api/users', () => {
    return HttpResponse.json([{ id: 1, name: 'Alice' }]);
  }),
];
// 优势：在 network 层拦截，测试代码与实际代码完全一致
```

---

## 八、Node.js & 全栈

### 8.1 Node.js 核心

**事件循环阶段**

```
timers（setTimeout/setInterval）
→ I/O callbacks（I/O 错误回调）
→ idle/prepare（内部）
→ poll（等待新的 I/O 事件，执行 I/O 回调）
→ check（setImmediate）
→ close callbacks（socket.on('close')）

process.nextTick → 当前阶段末尾（优先级最高）
Promise.then   → 同上（nextTick 之后）
```

**Stream 背压控制**

```js
const readable = fs.createReadStream('big.file');
const writable = fs.createWriteStream('output.file');

readable.on('data', (chunk) => {
  const canContinue = writable.write(chunk);
  if (!canContinue) {
    readable.pause(); // 背压：暂停读取
    writable.once('drain', () => readable.resume()); // 缓冲清空后恢复
  }
});
```

---

### 8.2 API 设计

**REST vs GraphQL vs tRPC**

| 特性 | REST | GraphQL | tRPC |
|------|------|---------|------|
| 类型安全 | 手动 | 代码生成 | 全自动（TypeScript） |
| 过获取 | 常见 | 无 | 无 |
| 学习成本 | 低 | 中 | 低（全 TS 栈） |
| 缓存 | HTTP 层 | 需手动 | 需手动 |
| 适用 | 公开 API | 复杂查询 | 全栈 TS 项目 |

**限流算法**

```js
// 令牌桶（允许突发流量）
class TokenBucket {
  constructor(capacity, refillRate) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.refillRate = refillRate; // tokens/sec
    this.lastRefill = Date.now();
  }
  consume(tokens = 1) {
    this.refill();
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }
    return false; // 拒绝请求
  }
  refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }
}
```

---

### 8.3 Redis 缓存三问

| 问题 | 场景 | 解决方案 |
|------|------|---------|
| 缓存穿透 | 查询不存在的 key，每次打库 | 布隆过滤器 / 缓存空值（TTL 短） |
| 缓存击穿 | 热点 key 过期瞬间大量并发 | 互斥锁 / 不设过期时间 / 异步更新 |
| 缓存雪崩 | 大量 key 同时过期 | 随机 TTL / 多级缓存 / 熔断降级 |

---

### 8.4 部署 & 容器

**Nginx SPA 配置**

```nginx
server {
  listen 80;
  root /app/dist;
  gzip on;
  gzip_types text/css application/javascript image/svg+xml;

  location / {
    try_files $uri $uri/ /index.html; # SPA 路由兜底
  }

  location ~* \.(js|css|png|jpg|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable"; # 带 hash 的静态资源长缓存
  }
}
```

**Docker 多阶段构建**

```dockerfile
# 构建阶段
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# 运行阶段（仅包含 nginx + 构建产物）
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

---

## 附录：高频面试题索引

| 题目 | 所属模块 |
|------|---------|
| 手写 Promise（链式 + 值穿透） | JS 深度 - 异步编程 |
| 手写防抖 / 节流 | JS 深度 - 闭包 |
| 手写 bind | JS 深度 - this 绑定 |
| 事件循环代码题（含 async/await） | JS 深度 - 事件循环 |
| Vue2 vs Vue3 响应式区别 | 框架原理 |
| React Hooks 为何不能在条件中调用 | 框架原理 |
| Webpack Loader vs Plugin | 工程化 |
| Vite 开发快的原因 | 工程化 |
| HTTP 缓存流程 | 网络 |
| 浏览器回流 vs 重绘 | 网络 & 浏览器 |
| XSS / CSRF 防御 | 安全 |
| Core Web Vitals 优化 | 性能优化 |
| 虚拟列表实现 | 性能优化 |
| TypeScript 条件类型 / infer | 工具链 |
| Redis 缓存三问 | Node & 全栈 |
