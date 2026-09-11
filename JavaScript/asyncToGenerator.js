// asyncToGenerator.js
// 演示 async/await 的底层本质：Generator 函数 + 自动执行器
// 这基本就是 Babel 把 `async function` 编译成 ES5 时所做的事情
// （真实的 regenerator-runtime 更复杂，这里是精简教学版）

function asyncToGenerator(generatorFn) {
  return function (...args) {
    const generator = generatorFn.apply(this, args);

    // 每个 async 函数调用后，必须返回一个 Promise —— 这个 Promise 就在这里手动构造
    return new Promise((resolve, reject) => {
      // step 负责「驱动生成器往下走一步」，并处理它 yield 出来的值
      function step(key, arg) {
        let result;
        try {
          result = generator[key](arg); // key 是 'next' 或 'throw'
        } catch (error) {
          return reject(error); // 生成器内部同步抛出的错误（对应 try/catch 不住的异常）
        }
        const { value, done } = result;
        if (done) {
          return resolve(value); // 生成器跑完了，用最后的 return 值 resolve 外层 Promise
        }
        // value 就是 `await 表达式` 右边的东西：可能是 Promise，也可能是普通值
        // 统一用 Promise.resolve 包一层，屏蔽两者的差异
        Promise.resolve(value).then(
          (val) => step('next', val),   // await 成功 -> 把结果喂回 generator，恢复执行
          (err) => step('throw', err)   // await 失败 -> 在 generator 内部 throw，可以被 try/catch 捕获
        );
      }
      step('next', undefined); // 第一次启动
    });
  };
}

// ------------------- 对比：你写的代码 vs 编译后的代码 -------------------

// 【你写的】
// async function getData() {
//   try {
//     const a = await fetchA();      // 暂停点 1
//     const b = await fetchB(a);     // 暂停点 2
//     return b;
//   } catch (e) {
//     console.log('caught:', e);
//   }
// }

// 【Babel 编译后，大致等价于】
function* getDataGenerator() {
  try {
    const a = yield fetchA();   // await -> yield
    const b = yield fetchB(a);
    return b;
  } catch (e) {
    console.log('caught:', e);
  }
}
const getData = asyncToGenerator(getDataGenerator);

// 关键结论：
// - await 只是 yield 的语法糖，真正「暂停 - 恢复」的能力来自 Generator
// - 「恢复执行」这件事本身是通过 Promise.then 回调完成的，
//   所以每一次 await 恢复，都至少要经过一次微任务队列
// - try/catch 能捕获 await 的失败，是因为 step('throw', err) 是在
//   generator 内部执行 .throw()，恰好落在你写的 try 块里

module.exports = { asyncToGenerator };
