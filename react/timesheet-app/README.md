# Timesheet Management System — React App

Static prototype converted from single HTML file to a structured React project.

## 项目结构

```
timesheet-app/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   ├── AppShell.jsx      # 顶栏 + 侧边栏布局
│   │   ├── PageHead.jsx      # 页面标题区
│   │   └── EntriesTable.jsx  # 工时条目表格（共用）
│   ├── data/
│   │   └── mockData.js       # 所有 mock 数据
│   ├── pages/
│   │   ├── SignIn.jsx
│   │   ├── Timesheet.jsx
│   │   ├── AddEntry.jsx
│   │   ├── Submit.jsx
│   │   ├── Approvals.jsx
│   │   ├── ApprovalDetail.jsx
│   │   ├── Report.jsx
│   │   └── Organisation.jsx
│   ├── styles/
│   │   └── global.css        # 原 HTML 样式原样迁移
│   ├── App.js                # 路由配置
│   └── index.js              # 入口
├── package.json
└── README.md
```

## 安装 & 启动

```bash
# 安装依赖
npm install

# 启动开发服务器（默认 http://localhost:3000）
npm start
```

## 路由说明

| 路径                | 页面                     |
|---------------------|--------------------------|
| `/signin`           | 登录页                   |
| `/timesheet`        | 我的工时表               |
| `/add-entry`        | 新增/编辑工时条目        |
| `/submit`           | 提交工时表               |
| `/approvals`        | 审批收件箱               |
| `/approval-detail`  | 审批详情                 |
| `/report`           | 项目工时报表             |
| `/organisation`     | 组织架构 & 用户管理      |

## 依赖

- react / react-dom 18
- react-router-dom 6（Hash → BrowserRouter）
- flatpickr 4（Approvals 页日期范围选择器）
- react-scripts 5（CRA 工具链）
