# Organisation.jsx 使用指南

## 概览

`Organisation.jsx` 实现了「组织架构管理」页面，包含三个联动区域：

```
┌─────────────────────────────────────────────────────┐
│  左侧：可展开 / 收起的组织树        右侧：员工表      │
│  （点击节点 → 右侧标题联动）        （点击行 → 详情） │
│                                                     │
│                                   下方：员工详情抽屉  │
└─────────────────────────────────────────────────────┘
```

---

## 文件结构

```
Organisation.jsx
├── ORG_TREE          — 树形数据（嵌套对象数组）
├── TreeNode          — 递归树节点组件
└── Organisation      — 页面主组件
      ├── selectedNode     — 当前选中的树节点
      ├── selectedEmployee — 当前选中的员工
      └── search           — 搜索关键字
```

---

## 一、树形数据结构

树数据定义在文件顶部的 `ORG_TREE` 常量，每个节点格式如下：

```js
{
  id: 'appdev',                  // 唯一标识，用于高亮匹配
  label: 'Application Development', // 显示文本
  children: []                   // 子节点，叶节点传空数组
}
```

**完整示例：**

```js
const ORG_TREE = [
  {
    id: 'pccw',
    label: 'PCCW Group',
    children: [
      {
        id: 'tech',
        label: 'Technology',
        children: [
          {
            id: 'itd',
            label: 'IT Delivery',
            children: [
              { id: 'appdev',  label: 'Application Development', children: [] },
              { id: 'qa',      label: 'QA Team',                 children: [] },
              { id: 'support', label: 'Support',                 children: [] },
            ],
          },
        ],
      },
      { id: 'finance', label: 'Finance', children: [] },
      { id: 'hr',      label: 'HR',      children: [] },
    ],
  },
];
```

> **后续接 API 时**：把 `ORG_TREE` 改成 `useState([])` + `useEffect` 请求即可，`TreeNode` 组件完全不用改。

---

## 二、TreeNode 递归组件

### Props

| Prop          | 类型       | 必填 | 说明                                       |
|---------------|------------|------|--------------------------------------------|
| `node`        | `object`   | ✅   | 当前节点数据 `{ id, label, children }`      |
| `selectedId`  | `string`   | ✅   | 当前选中节点的 id，用于控制高亮              |
| `onSelect`    | `function` | ✅   | 点击节点时的回调，参数为完整 node 对象       |
| `defaultOpen` | `boolean`  | ❌   | 是否默认展开，默认 `false`                  |

### 行为逻辑

```
点击节点
  ├─ 有子节点 → 切换 open 状态（展开 / 收起）
  └─ 同时调用 onSelect(node)  ← 无论是否有子节点都触发
```

箭头图标规则：
- 有子节点 + 展开：`▾`
- 有子节点 + 收起：`▸`
- 无子节点（叶节点）：`·`

### 默认展开某层级

在渲染子节点时通过 `defaultOpen` prop 控制：

```jsx
// 当前写法：让 IT Delivery 默认展开
<TreeNode
  key={child.id}
  node={child}
  selectedId={selectedId}
  onSelect={onSelect}
  defaultOpen={child.id === 'itd'}
/>
```

如需让所有节点默认展开，改为 `defaultOpen={true}`；全部收起则省略该 prop。

---

## 三、页面主组件状态说明

```js
// 默认选中的节点（控制树高亮 + 右侧表头部门名）
const [selectedNode, setSelectedNode] = useState(
  { id: 'appdev', label: 'Application Development' }
);

// 当前在详情抽屉中展示的员工（点击员工行触发）
const [selectedEmployee, setSelectedEmployee] = useState(ORG_EMPLOYEES[0]);

// 搜索关键字（实时过滤员工表）
const [search, setSearch] = useState('');
```

---

## 四、三区域联动关系

```
用户点击树节点
  └─→ setSelectedNode(node)
        └─→ 右侧员工表头「Department: xxx」同步更新
              （后续可在此加 filter，按部门过滤员工列表）

用户在搜索框输入
  └─→ setSearch(value)
        └─→ filteredEmployees 实时计算（name / email 双字段匹配）

用户点击员工行
  └─→ setSelectedEmployee(e)
        └─→ 详情抽屉的 defaultValue / defaultChecked 通过 key 强制刷新
```

### 抽屉刷新机制说明

React 受控组件切换 `defaultValue` 不会自动重渲染，这里用 `key` 强制让组件重新挂载：

```jsx
<input
  className="input"
  defaultValue={selectedEmployee.name}
  key={selectedEmployee.name + '-name'}   // ← key 变化时整个 input 重新挂载
/>
```

> 如果后续改为受控组件（`value` + `onChange`），可以去掉 `key`，用 `useState` 管理表单字段。

---

## 五、样式说明

树节点的样式写在组件底部的 `<style>` 标签中，局部作用，不会影响全局：

```css
.tree-node               /* 节点容器：flex 布局，圆角，hover 效果 */
.tree-node[data-selected]  /* 选中态：蓝色背景 + 加粗字体 */
.tree-arrow              /* 展开箭头：固定宽度，灰色 */
.tree-root ul            /* 子层缩进：padding-left: 18px */
```

如需调整缩进层级宽度，修改 `.tree-root ul` 的 `padding-left` 值即可。

---

## 六、常见扩展场景

### 6.1 接入真实 API 数据

```js
const [treeData, setTreeData] = useState([]);

useEffect(() => {
  fetch('/api/org-tree')
    .then(r => r.json())
    .then(setTreeData);
}, []);

// 渲染时把 ORG_TREE 换成 treeData
```

### 6.2 点击树节点过滤员工表

目前树节点选中只更新了表头文字，如需真正过滤员工，在 `filteredEmployees` 加一层条件：

```js
const filteredEmployees = ORG_EMPLOYEES.filter((e) => {
  const matchSearch =
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.email.toLowerCase().includes(search.toLowerCase());

  // 假设员工数据有 deptId 字段
  const matchDept = !selectedNode || e.deptId === selectedNode.id;

  return matchSearch && matchDept;
});
```

### 6.3 多选树节点（批量操作）

把 `selectedId: string` 改为 `selectedIds: Set<string>`，高亮判断改为 `selectedIds.has(node.id)`，`onSelect` 改为切换集合元素即可。

### 6.4 将 TreeNode 提取为独立组件

如果多个页面都需要树形组件，把 `TreeNode` 移到：

```
src/components/OrgTree.jsx
```

导出时同时导出数据类型注释（JSDoc）便于复用：

```js
/**
 * @typedef {{ id: string, label: string, children: TreeNode[] }} TreeNode
 */
export function TreeNode({ node, selectedId, onSelect, defaultOpen }) { ... }
```
