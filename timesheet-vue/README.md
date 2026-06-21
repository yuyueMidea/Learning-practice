# Timesheet Management System — Vue 3 + TypeScript

原 React 版本完整重构为 Vue 3 + TypeScript + Vite。所有页面、功能、样式保持一致。

## 技术栈

| 层级 | React 原版 | Vue 重构版 |
|------|-----------|-----------|
| 框架 | React 18 | Vue 3.4 (Composition API) |
| 语言 | JavaScript (JSX) | TypeScript (.vue SFC) |
| 路由 | react-router-dom v6 | vue-router v4 |
| 构建 | react-scripts (CRA) | Vite 5 |
| 日期选择 | flatpickr | flatpickr（不变） |
| 样式 | global.css | global.css（不变） |

## 快速启动

```bash
# 1. 安装依赖
npm install

# 2. 启动开发服务器（默认 http://localhost:5173）
npm run dev

# 3. 构建生产包
npm run build

# 4. 预览生产构建
npm run preview
```

## 工程结构

```
timesheet-vue/
├── index.html                  # 入口 HTML
├── vite.config.ts              # Vite 配置（@vitejs/plugin-vue）
├── tsconfig.json               # TypeScript 配置
├── tsconfig.node.json          # Vite 构建的 TS 配置
├── package.json
└── src/
    ├── main.ts                 # 应用入口，挂载 Vue + Router
    ├── App.vue                 # 根组件（<RouterView />）
    ├── router/
    │   └── index.ts            # vue-router 路由表
    ├── data/
    │   └── mockData.ts         # 全部 Mock 数据 + TypeScript 接口定义
    ├── assets/
    │   └── global.css          # 全局样式（与原版完全一致）
    ├── components/
    │   ├── AppShell.vue        # 顶部导航 + 侧边栏 + 插槽布局
    │   ├── PageHead.vue        # 页面标题 + 操作按钮区（named slot: actions）
    │   ├── EntriesTable.vue    # 时间条目表格（复用于 Timesheet / ApprovalDetail）
    │   └── TreeNode.vue        # 递归组织树节点
    └── pages/
        ├── SignIn.vue           # 登录页
        ├── Timesheet.vue        # 我的工时表（周视图 + 日选择 + 条目列表）
        ├── AddEntry.vue         # 新增 / 编辑时间条目（含 Jira Ticket 搜索）
        ├── Submit.vue           # 提交工时表（日汇总 + 审批路由）
        ├── Approvals.vue        # 审批收件箱（flatpickr 日期范围 + 表格）
        ├── ApprovalDetail.vue   # 审批详情（进度步骤 + 审批操作）
        ├── Report.vue           # 项目工时报表（统计 + 条形图 + 明细）
        └── Organisation.vue     # 组织与用户管理（递归树 + 员工表 + 详情抽屉）

## Vue 3 关键迁移对照

| React 原版 | Vue 3 版本 |
|-----------|-----------|
| `useState` | `ref()` / `computed()` |
| `useEffect` + `useRef` | `onMounted` + `onBeforeUnmount` + `ref()` |
| `useNavigate` | `useRouter()` |
| `<NavLink className={…}>` | `<RouterLink>` + `.router-link-active` CSS |
| Props + children | `defineProps<T>()` + `<slot>` / named slot |
| JSX 条件渲染 | `v-if` / `v-show` |
| Array.map → JSX | `v-for` |
| 递归组件（自引用） | `<TreeNode>` 在自身模板中引用自身 |
| `defaultValue` (不受控) | `:value` 绑定（展示用） |
| `style={{ … }}` | `:style="{ … }"` |
