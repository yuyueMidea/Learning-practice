// MyPromise.js
// 一个符合 Promise/A+ 规范（https://promisesaplus.com/）的手写 Promise 实现
// 重点还原三件事：
//   1. 状态机（pending -> fulfilled / rejected，且不可逆）
//   2. then 的链式调用 + resolvePromise 对返回值 x 的递归展开
//   3. onFulfilled / onRejected 必须以「微任务」方式异步执行

const PENDING = 'pending';
const FULFILLED = 'fulfilled';
const REJECTED = 'rejected';

// ---- 用真正的微任务去调度回调，而不是 setTimeout（那是宏任务，会导致执行顺序不对）----
const runMicrotask = (() => {
  if (typeof queueMicrotask === 'function') {
    return queueMicrotask;
  }
  if (typeof process !== 'undefined' && typeof process.nextTick === 'function') {
    return process.nextTick; // Node 环境
  }
  if (typeof MutationObserver === 'function') {
    // 浏览器里没有 queueMicrotask 时的经典 hack：用 MutationObserver 制造微任务
    let callbacks = [];
    const observer = new MutationObserver(() => {
      const cbs = callbacks;
      callbacks = [];
      cbs.forEach((cb) => cb());
    });
    const node = document.createTextNode('');
    observer.observe(node, { characterData: true });
    let toggle = 0;
    return (cb) => {
      callbacks.push(cb);
      node.data = String((toggle = 1 - toggle));
    };
  }
  return (cb) => setTimeout(cb, 0); // 最后兜底，已经不完全符合规范
})();

class MyPromise {
  #state = PENDING;
  #value = undefined;
  #onFulfilledCallbacks = [];
  #onRejectedCallbacks = [];

  constructor(executor) {
    const resolve = (value) => {
      if (value === this) {
        return reject(new TypeError('Chaining cycle detected for promise'));
      }
      // resolve 的值本身是 thenable（比如另一个 Promise）时，要递归展开
      if ((typeof value === 'object' && value !== null) || typeof value === 'function') {
        let then;
        try {
          then = value.then;
        } catch (e) {
          return reject(e);
        }
        if (typeof then === 'function') {
          let called = false;
          try {
            then.call(
              value,
              (y) => { if (!called) { called = true; resolve(y); } },   // 继续递归解析
              (r) => { if (!called) { called = true; reject(r); } }
            );
          } catch (e) {
            if (!called) { called = true; reject(e); }
          }
          return;
        }
      }
      this.#settle(FULFILLED, value);
    };

    const reject = (reason) => this.#settle(REJECTED, reason);

    try {
      executor(resolve, reject);
    } catch (e) {
      reject(e);
    }
  }

  #settle(state, value) {
    if (this.#state !== PENDING) return; // 状态一旦确定，终身不变
    this.#state = state;
    this.#value = value;
    const callbacks = state === FULFILLED ? this.#onFulfilledCallbacks : this.#onRejectedCallbacks;
    callbacks.forEach((cb) => runMicrotask(cb));
    this.#onFulfilledCallbacks = [];
    this.#onRejectedCallbacks = [];
  }

  then(onFulfilled, onRejected) {
    // 值穿透：then() 不传函数时，让值/异常原样传给下一个 then
    onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : (v) => v;
    onRejected = typeof onRejected === 'function' ? onRejected : (r) => { throw r; };

    const promise2 = new MyPromise((resolve, reject) => {
      const handleFulfilled = () => {
        try {
          const x = onFulfilled(this.#value);
          resolvePromise(promise2, x, resolve, reject);
        } catch (e) {
          reject(e);
        }
      };
      const handleRejected = () => {
        try {
          const x = onRejected(this.#value);
          resolvePromise(promise2, x, resolve, reject);
        } catch (e) {
          reject(e);
        }
      };

      if (this.#state === FULFILLED) {
        runMicrotask(handleFulfilled);
      } else if (this.#state === REJECTED) {
        runMicrotask(handleRejected);
      } else {
        // 仍是 pending：先存起来，settle 时再各自调度成微任务
        this.#onFulfilledCallbacks.push(handleFulfilled);
        this.#onRejectedCallbacks.push(handleRejected);
      }
    });

    return promise2; // 关键：每次 then 都返回一个新 Promise，链式调用由此而来
  }

  catch(onRejected) {
    return this.then(null, onRejected);
  }

  finally(onFinally) {
    return this.then(
      (value) => MyPromise.resolve(onFinally && onFinally()).then(() => value),
      (reason) => MyPromise.resolve(onFinally && onFinally()).then(() => { throw reason; })
    );
  }

  static resolve(value) {
    if (value instanceof MyPromise) return value;
    return new MyPromise((resolve) => resolve(value));
  }

  static reject(reason) {
    return new MyPromise((_, reject) => reject(reason));
  }

  static all(promises) {
    return new MyPromise((resolve, reject) => {
      const list = [...promises];
      const results = new Array(list.length);
      let remaining = list.length;
      if (remaining === 0) return resolve(results);
      list.forEach((p, i) => {
        MyPromise.resolve(p).then((value) => {
          results[i] = value;
          if (--remaining === 0) resolve(results);
        }, reject); // 任意一个 reject，整体立刻 reject
      });
    });
  }

  static race(promises) {
    return new MyPromise((resolve, reject) => {
      for (const p of promises) {
        MyPromise.resolve(p).then(resolve, reject); // 谁先 settle 听谁的
      }
    });
  }

  static allSettled(promises) {
    return new MyPromise((resolve) => {
      const list = [...promises];
      const results = new Array(list.length);
      let remaining = list.length;
      if (remaining === 0) return resolve(results);
      list.forEach((p, i) => {
        MyPromise.resolve(p).then(
          (value) => { results[i] = { status: 'fulfilled', value }; if (--remaining === 0) resolve(results); },
          (reason) => { results[i] = { status: 'rejected', reason }; if (--remaining === 0) resolve(results); }
        );
      });
    });
  }
}

// resolvePromise：Promise/A+ 规范 2.3 节的核心 —— 处理 onFulfilled/onRejected 的返回值 x
// x 可能是：普通值 / 我们自己的 Promise / 别人实现的 thenable / 甚至 promise2 自身
function resolvePromise(promise2, x, resolve, reject) {
  if (x === promise2) {
    // then 回调里 return 了 promise2 自己 -> 会死循环，规范要求直接报错
    return reject(new TypeError('Chaining cycle detected for promise'));
  }
  if (x instanceof MyPromise) {
    x.then(resolve, reject); // 自家 Promise，直接递归展开
    return;
  }
  if ((typeof x === 'object' && x !== null) || typeof x === 'function') {
    let then;
    let called = false; // 防止 resolve/reject 被重复调用
    try {
      then = x.then;
    } catch (e) {
      return reject(e); // 取 .then 属性都可能抛错（比如是个 getter）
    }
    if (typeof then === 'function') {
      try {
        then.call(
          x,
          (y) => { if (!called) { called = true; resolvePromise(promise2, y, resolve, reject); } },
          (r) => { if (!called) { called = true; reject(r); } }
        );
      } catch (e) {
        if (!called) reject(e);
      }
    } else {
      resolve(x); // 只是个普通对象，没有 then 方法
    }
  } else {
    resolve(x); // 普通值（数字/字符串/布尔...）
  }
}

module.exports = MyPromise;
