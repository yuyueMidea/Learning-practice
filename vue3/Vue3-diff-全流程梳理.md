# Vue 3 Diff 全流程梳理

> 源码参考：`packages/runtime-core/src/renderer.ts`。代码为便于阅读做了精简，不同小版本细节会有差异。

## 目录

1. [整体架构：三层优化](#一整体架构三层优化)
2. [第 1 层：编译期优化](#二第-1-层编译期优化)
3. [第 2 层：patch 入口](#三第-2-层patch-入口)
4. [第 3 层：patchChildren](#四第-3-层patchchildren)
5. [核心：patchKeyedChildren 五步法](#五核心patchkeyedchildren-五步法)
6. [完整示例推演](#六完整示例推演)
7. [LIS 与动态规划](#七lis-与动态规划)
8. [Vue 2 与 Vue 3 对比](#八vue-2-与-vue-3-对比)
9. [实践建议](#九实践建议)
10. [一页速查](#十一页速查)
11. [延伸方向](#十一延伸方向)

---

## 一、整体架构：三层优化

Vue 3 的更新优化由**编译期 + 运行时**配合完成，真正"全量 diff"的场景很少。

```
第 1 层：编译期标记（PatchFlags + Block Tree）
        └─ 只比较动态节点，静态内容直接跳过
第 2 层：patch 入口（同类型判断 + 按节点类型分发）
        └─ 决定是更新、替换还是挂载
第 3 层：子节点 diff（patchChildren）
        ├─ 无 key 子节点：patchUnkeyedChildren
        └─ 有 key 子节点：patchKeyedChildren（五步法 + 最长递增子序列）
```

很多文章只讲第 3 层，但理解前两层，才知道 Vue 3 为什么比 Vue 2 快。

---

## 二、第 1 层：编译期优化

### 2.1 PatchFlags：给动态内容打标记

模板：

```html
<div>
  <p>静态文字</p>
  <p :class="cls">{{ msg }}</p>
</div>
```

编译产物（简化）：

```js
createElementVNode("div", null, [
  _hoisted_1,   // 静态节点，提升到渲染函数外，只创建一次
  createElementVNode("p", { class: _normalizeClass(cls) }, _toDisplayString(msg), 3 /* TEXT, CLASS */)
])
```

`3` 是位运算组合：`TEXT = 1`，`CLASS = 2`。运行时更新这个 `<p>` 时，只检查 class 和文本，不遍历其他 props。

| Flag | 含义 |
|---|---|
| `TEXT` | 只有文本是动态的 |
| `CLASS` / `STYLE` | class / style 动态 |
| `PROPS` | 有动态 props（配合 `dynamicProps` 数组指明哪些） |
| `FULL_PROPS` | 有动态 key（如 `v-bind="obj"`），需要完整 diff props |
| `STABLE_FRAGMENT` | 子节点顺序稳定的 Fragment |
| `KEYED_FRAGMENT` | 带 key 的 Fragment（如带 key 的 `v-for`） |
| `UNKEYED_FRAGMENT` | 不带 key 的 Fragment |
| `HOISTED` | 静态提升节点，永远不需要 diff |
| `BAIL` | 退出优化模式，走完整 diff |

### 2.2 Block Tree：跳过静态层级

编译器把模板划分成"块（Block）"。每个块把内部所有动态后代**平铺**收集到 `dynamicChildren` 数组：

```js
{
  type: 'div',
  dynamicChildren: [ /* 只有动态节点，扁平的一维数组 */ ],
  children: [ /* 完整的树 */ ]
}
```

更新时，如果 `n2.dynamicChildren` 存在，就走 `patchBlockChildren`：只按顺序比较这个扁平数组，不再递归整棵树。复杂度从"与模板大小相关"降到"与动态节点数量相关"。

**块的边界**出现在结构会变化的地方：

- 根节点
- `v-if` / `v-else` 的每个分支
- `v-for` 的每一项

结构不稳定时，扁平数组的位置对应关系不可靠，所以这些节点各自成块。

> 这也是 `v-if` 的不同分支即使标签相同，也会被加上不同 key、被视为不同节点而不做复用 diff 的原因。

---

## 三、第 2 层：patch 入口

```ts
const patch = (n1, n2, container, anchor = null, parentComponent = null, ...) => {
  if (n1 === n2) return

  // 类型不同：卸载旧的，当作挂载新的
  if (n1 && !isSameVNodeType(n1, n2)) {
    anchor = getNextHostNode(n1)
    unmount(n1, parentComponent, parentSuspense, true)
    n1 = null
  }

  if (n2.patchFlag === PatchFlags.BAIL) {
    optimized = false
    n2.dynamicChildren = null
  }

  const { type, ref, shapeFlag } = n2
  switch (type) {
    case Text:     processText(...)        break
    case Comment:  processCommentNode(...) break
    case Static:   ...                     break
    case Fragment: processFragment(...)    break
    default:
      if (shapeFlag & ShapeFlags.ELEMENT)        processElement(...)
      else if (shapeFlag & ShapeFlags.COMPONENT) processComponent(...)
      else if (shapeFlag & ShapeFlags.TELEPORT)  type.process(...)
      else if (shapeFlag & ShapeFlags.SUSPENSE)  type.process(...)
  }
}
```

### 3.1 判断"是否同一个节点"

```ts
function isSameVNodeType(n1: VNode, n2: VNode): boolean {
  return n1.type === n2.type && n1.key === n2.key
}
```

只比较 `type` 和 `key`，这是整个 diff 的前提：

- `type` 和 `key` 都相同 → 复用 DOM，进入 patch 更新
- 任一不同 → 卸载旧节点，挂载新节点

### 3.2 元素更新：patchElement

```ts
const patchElement = (n1, n2, parentComponent, ...) => {
  const el = (n2.el = n1.el)!
  let { patchFlag, dynamicChildren } = n2

  // 1. 更新 props（按 patchFlag 精确更新）
  if (patchFlag > 0) {
    if (patchFlag & PatchFlags.FULL_PROPS) {
      patchProps(el, n2, oldProps, newProps, ...)       // 完整 diff
    } else {
      if (patchFlag & PatchFlags.CLASS) { /* 只比较 class */ }
      if (patchFlag & PatchFlags.STYLE) { /* 只比较 style */ }
      if (patchFlag & PatchFlags.PROPS) { /* 只比较 dynamicProps 里列出的 */ }
    }
    if (patchFlag & PatchFlags.TEXT) {
      if (n1.children !== n2.children) hostSetElementText(el, n2.children)
    }
  } else if (!optimized && dynamicChildren == null) {
    patchProps(el, n2, oldProps, newProps, ...)         // 手写 render，完整 diff
  }

  // 2. 更新子节点
  if (dynamicChildren) {
    patchBlockChildren(n1.dynamicChildren!, dynamicChildren, el, ...) // 快路径
  } else if (!optimized) {
    patchChildren(n1, n2, el, ...)                                    // 全量路径
  }
}
```

**关键分叉**：模板编译出的组件走快路径；手写 `render` 函数或 JSX（没有 patchFlag）走全量路径。

---

## 四、第 3 层：patchChildren

子节点有三种形态：文本、数组、空。按新旧组合分情况处理。

```ts
const patchChildren = (n1, n2, container, ...) => {
  const c1 = n1.children, c2 = n2.children
  const { patchFlag, shapeFlag } = n2
  const prevShapeFlag = n1.shapeFlag

  // Fragment 且有 patchFlag 的快路径
  if (patchFlag > 0) {
    if (patchFlag & PatchFlags.KEYED_FRAGMENT) {
      patchKeyedChildren(c1, c2, ...); return
    } else if (patchFlag & PatchFlags.UNKEYED_FRAGMENT) {
      patchUnkeyedChildren(c1, c2, ...); return
    }
  }

  if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
    // 新：文本。旧是数组则先卸载；文本不同则直接设置
    if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) unmountChildren(c1, ...)
    if (c2 !== c1) hostSetElementText(container, c2)
  } else {
    if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        patchKeyedChildren(c1, c2, ...)          // 新旧都是数组：核心 diff
      } else {
        unmountChildren(c1, ...)                 // 新：空
      }
    } else {
      if (prevShapeFlag & ShapeFlags.TEXT_CHILDREN) hostSetElementText(container, '')
      if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) mountChildren(c2, ...)
    }
  }
}
```

### 新旧子节点组合速查

| 旧 \ 新 | 文本 | 数组 | 空 |
|---|---|---|---|
| **文本** | 文本不同则更新 | 清空文本，挂载数组 | 清空文本 |
| **数组** | 卸载数组，设置文本 | **patchKeyedChildren（核心 diff）** | 卸载数组 |
| **空** | 设置文本 | 挂载数组 | 无操作 |

### 无 key：patchUnkeyedChildren

```ts
const commonLength = Math.min(oldLength, newLength)
for (i = 0; i < commonLength; i++) patch(c1[i], c2[i], ...)   // 按下标一一对应
if (oldLength > newLength) unmountChildren(c1, ..., commonLength)
else mountChildren(c2, ..., commonLength)
```

按下标对位，遇到插入、删除、重排会产生大量无谓更新，所以**列表务必加 key**。

---

## 五、核心：patchKeyedChildren 五步法

设 `c1` 为旧数组，`c2` 为新数组。

### 步骤 1：从头同步

```ts
let i = 0
let e1 = c1.length - 1
let e2 = c2.length - 1

while (i <= e1 && i <= e2) {
  if (isSameVNodeType(c1[i], c2[i])) patch(c1[i], c2[i], ...)
  else break
  i++
}
```

### 步骤 2：从尾同步

```ts
while (i <= e1 && i <= e2) {
  if (isSameVNodeType(c1[e1], c2[e2])) patch(c1[e1], c2[e2], ...)
  else break
  e1--; e2--
}
```

头尾预处理能解决大多数实际场景（尾部追加、头部插入、中间改某一项）。

### 步骤 3：新的比旧的多，挂载新增部分

```ts
if (i > e1) {
  if (i <= e2) {
    const nextPos = e2 + 1
    const anchor = nextPos < c2.length ? c2[nextPos].el : parentAnchor
    while (i <= e2) { patch(null, c2[i], container, anchor, ...); i++ }
  }
}
```

```
旧: a b
新: a b c d        →  i=2, e1=1, e2=3，挂载 c d
```

### 步骤 4：旧的比新的多，卸载多余部分

```ts
else if (i > e2) {
  while (i <= e1) { unmount(c1[i], ...); i++ }
}
```

### 步骤 5：中间乱序（真正的难点）

```
旧: a b [c d e] f g
新: a b [e c d h] f g
```

头尾处理完后，剩下 `c d e` 和 `e c d h` 需要真正 diff，分三小步。

#### 5.1 建立新节点 key → 新下标 的映射

```ts
const s1 = i, s2 = i
const keyToNewIndexMap = new Map()
for (i = s2; i <= e2; i++) {
  if (c2[i].key != null) keyToNewIndexMap.set(c2[i].key, i)
}
```

#### 5.2 遍历旧节点：更新可复用的、删除多余的、记录位置关系

```ts
const toBePatched = e2 - s2 + 1
const newIndexToOldIndexMap = new Array(toBePatched).fill(0) // 0 表示"旧列表里没有"
let moved = false
let maxNewIndexSoFar = 0
let patched = 0

for (i = s1; i <= e1; i++) {
  const prevChild = c1[i]
  if (patched >= toBePatched) { unmount(prevChild, ...); continue } // 新节点已配完，剩下的都删

  let newIndex
  if (prevChild.key != null) {
    newIndex = keyToNewIndexMap.get(prevChild.key)
  } else {
    // 无 key 的旧节点：线性查找同类型且未被占用的新节点
    for (let j = s2; j <= e2; j++) {
      if (newIndexToOldIndexMap[j - s2] === 0 && isSameVNodeType(prevChild, c2[j])) { newIndex = j; break }
    }
  }

  if (newIndex === undefined) {
    unmount(prevChild, ...)                      // 新列表里没有，删除
  } else {
    newIndexToOldIndexMap[newIndex - s2] = i + 1 // 存"旧下标 + 1"，避免与 0 混淆
    if (newIndex >= maxNewIndexSoFar) maxNewIndexSoFar = newIndex
    else moved = true                            // 出现逆序，说明需要移动
    patch(prevChild, c2[newIndex], ...)
    patched++
  }
}
```

两个细节：

- `newIndexToOldIndexMap` 存的是 **旧下标 + 1**，这样 `0` 可以专门表示"全新节点"。
- `moved` 判断很巧：旧节点按顺序遍历，若对应的新下标一直递增，说明相对顺序没变，无需移动；只要出现一次递减，就必须求最长递增子序列。

#### 5.3 倒序遍历新节点：挂载新增的，移动需要移动的

```ts
const increasingNewIndexSequence = moved ? getSequence(newIndexToOldIndexMap) : []
let j = increasingNewIndexSequence.length - 1

for (i = toBePatched - 1; i >= 0; i--) {
  const nextIndex = s2 + i
  const nextChild = c2[nextIndex]
  const anchor = nextIndex + 1 < c2.length ? c2[nextIndex + 1].el : parentAnchor

  if (newIndexToOldIndexMap[i] === 0) {
    patch(null, nextChild, container, anchor, ...)         // 全新节点，挂载
  } else if (moved) {
    if (j < 0 || i !== increasingNewIndexSequence[j]) {
      move(nextChild, container, anchor, MoveType.REORDER) // 不在 LIS 里，移动
    } else {
      j--                                                  // 在 LIS 里，原地不动
    }
  }
}
```

**为什么倒序？** DOM 的 `insertBefore(node, anchor)` 需要一个已就位的后继节点当锚点。倒着处理时，当前节点的"下一个兄弟"总是已经在正确位置，可以直接用它的 `el` 做锚点。

### 五步法总览

| 步骤 | 做什么 | 触发条件 |
|---|---|---|
| 1 | 从头同步 | 总是执行 |
| 2 | 从尾同步 | 总是执行 |
| 3 | 挂载新增 | `i > e1 && i <= e2` |
| 4 | 卸载多余 | `i > e2` |
| 5.1 | 建 key → 新下标 映射 | 中间有乱序 |
| 5.2 | 遍历旧节点，patch / 删除，记录 `newIndexToOldIndexMap` | 同上 |
| 5.3 | 倒序遍历新节点，挂载 / 按 LIS 移动 | 同上 |

---

## 六、完整示例推演

```
旧: a b c d e f g
新: a b e c d h f g
```

1. **头同步**：`a`、`b` 相同，`i = 2`。
2. **尾同步**：`g`、`f` 相同，`e1 = 4`，`e2 = 5`。
3. 剩余中间段：旧 `c d e`（下标 2~4），新 `e c d h`（下标 2~5）。
4. **5.1 映射**：`{ e: 2, c: 3, d: 4, h: 5 }`。
5. **5.2 遍历旧节点**：

   | 旧节点 | 新下标 | 写入 | maxNewIndexSoFar | moved |
   |---|---|---|---|---|
   | c | 3 | `map[1] = 3` | 3 | false |
   | d | 4 | `map[2] = 4` | 4 | false |
   | e | 2 | `map[0] = 5` | 4（2 < 4） | **true** |

   得到 `newIndexToOldIndexMap = [5, 3, 4, 0]`（`h` 是 0，表示全新）。
6. **LIS**：忽略 0，`[5, 3, 4, 0]` 的最长递增子序列是 `3, 4`，对应下标 `[1, 2]`，即 `c`、`d` 不用动。
7. **5.3 倒序处理**：
   - `i=3`（h）：`map` 为 0，**挂载**，锚点是 `f`
   - `i=2`（d）：在 LIS 中，`j--`
   - `i=1`（c）：在 LIS 中，`j--`
   - `i=0`（e）：不在 LIS 中，**移动**到 `c` 前面

整个过程只有 **1 次移动 + 1 次挂载**，是最少的 DOM 操作。

---

## 七、LIS 与动态规划

`getSequence` 的作用：在 `newIndexToOldIndexMap` 里找最长递增子序列。这些节点相对顺序没变，不用移动，其余节点移动即可。

Vue 的实现不是 O(n²) 的朴素 DP（`dp[i] = max(dp[j]) + 1`），而是**贪心 + 二分的 O(n log n) 版本**：

```ts
function getSequence(arr: number[]): number[] {
  const p = arr.slice()          // p[i]：arr[i] 在 LIS 中的前驱下标，用于回溯
  const result = [0]             // result[k]：长度为 k+1 的递增子序列的最小结尾元素下标
  let i, j, u, v, c
  const len = arr.length
  for (i = 0; i < len; i++) {
    const arrI = arr[i]
    if (arrI !== 0) {            // 0 是全新节点，不参与
      j = result[result.length - 1]
      if (arr[j] < arrI) {       // 比当前最长的结尾还大，直接追加
        p[i] = j
        result.push(i)
        continue
      }
      // 否则二分，找到第一个 >= arrI 的位置并替换（让结尾尽量小，给后面留空间）
      u = 0; v = result.length - 1
      while (u < v) {
        c = (u + v) >> 1
        if (arr[result[c]] < arrI) u = c + 1
        else v = c
      }
      if (arrI < arr[result[u]]) {
        if (u > 0) p[i] = result[u - 1]
        result[u] = i
      }
    }
  }
  // 回溯：result 只记录"各长度的最小结尾"，不一定是真正的序列，需沿 p 还原
  u = result.length
  v = result[u - 1]
  while (u-- > 0) {
    result[u] = v
    v = p[v]
  }
  return result
}
```

要点：

- `result` 本身**不是**最终 LIS，只是"每种长度的最小结尾"，最后必须通过前驱数组 `p` 回溯还原。
- 这是"耐心排序"思想：替换而不是追加，让每个长度的结尾尽可能小。
- 正确性源自 DP 的状态定义（以第 i 个元素结尾的最长长度），贪心 + 二分只是优化了转移。

---

## 八、Vue 2 与 Vue 3 对比

| 维度 | Vue 2 | Vue 3 |
|---|---|---|
| 子节点算法 | 双端比较（头头、尾尾、头尾、尾头四指针）+ 查表 | 头尾预处理 + key 映射 + LIS |
| 移动策略 | 逐个按需移动，不保证最少 | 通过 LIS 保证移动次数最少 |
| 静态内容 | 每次都递归比较（`v-once` 除外） | 静态提升 + PatchFlags，直接跳过 |
| 树遍历 | 递归遍历整棵树 | Block Tree，只遍历动态节点的扁平数组 |
| props 对比 | 完整对比 | 按 patchFlag 精确对比 |

Vue 2 的双端比较在简单场景够用，但对"中间打乱"不是最优；Vue 3 在最坏情况下也能给出最少移动次数。

---

## 九、实践建议

1. **`v-for` 一定要给稳定唯一的 key**
   - 用数据 id，不要用下标。用下标时，列表头部插入或删除会让后续节点 key 全变，触发大量无谓更新，还会让有状态子组件（输入框内容、局部状态）错位。
   - 不要用 `Math.random()` 当 key，每次渲染都是新 key，所有节点都会销毁重建。
2. **善用模板，少用手写 render / JSX**：模板才能享受 PatchFlags 和 Block Tree。JSX 需借助 `@vue/babel-plugin-jsx` 的优化选项才能获得部分类似优化，效果通常不及模板。
3. **大列表别指望 diff 兜底**：几万个节点的创建和布局成本仍在，应使用虚拟滚动或分页。
4. **控制组件拆分粒度**：组件是更新边界，父组件更新时若子组件 props 没变（浅比较）会跳过更新。把频繁变化的部分拆成独立组件，可缩小 diff 范围。
5. **`v-memo`（3.2+）**：对列表项指定依赖数组，依赖没变就整项跳过 diff，适合大列表中少数项变化的场景。
6. **用 key 强制重建**：想让组件在某个值变化时彻底重置内部状态，可把该值绑到 `key`，利用 `isSameVNodeType` 不同则重建的规则。

---

## 十、一页速查

```
patch(n1, n2)
├─ type/key 不同 → 卸载 n1，挂载 n2
└─ 相同 → 按类型分发
   └─ 元素 patchElement
      ├─ props：按 patchFlag 精确更新
      └─ children
         ├─ 有 dynamicChildren → patchBlockChildren（只比动态节点，扁平数组）
         └─ 否则 patchChildren
            ├─ 文本 / 空 / 数组 的组合处理
            └─ 数组 vs 数组
               ├─ 无 key → patchUnkeyedChildren（按下标对位）
               └─ 有 key → patchKeyedChildren
                  ① 头同步 → ② 尾同步
                  ③ 新多：挂载   ④ 旧多：卸载
                  ⑤ 乱序：建映射 → 遍历旧节点 → 求 LIS → 倒序挂载/移动
```

---

## 十一、延伸方向

- 手写一个迷你版 `patchKeyedChildren`，在浏览器中对比不同 key 策略的 DOM 操作次数
- 编译器如何产出 PatchFlags 和 Block Tree（`compiler-core` 的 transform 流程）
- React Fiber diff 与 Vue 的对比：为什么 React 没有用 LIS
