# 智云ERP 企业资源管理系统

基于 Vue 3 + Vite + Element Plus 构建的完整ERP前端系统。

## 技术栈

| 技术 | 版本 | 说明 |
|------|------|------|
| Vue 3 | ^3.4.0 | Composition API + `<script setup>` |
| Vite | ^5.0.0 | 构建工具 |
| Element Plus | ^2.4.4 | UI组件库 |
| Pinia | ^2.1.7 | 状态管理 |
| Vue Router | ^4.2.5 | 路由管理 |
| Axios | ^1.6.2 | HTTP请求（含拦截器） |
| ECharts | ^5.4.3 | 数据可视化 |
| Mock.js | ^1.1.0 | 模拟API数据 |
| SCSS | - | 样式方案 |

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 启动开发服务器
npm run dev

# 3. 构建生产包
npm run build
```

访问 http://localhost:5173

## 演示账号

| 角色 | 用户名 | 密码 | 权限 |
|------|--------|------|------|
| 超级管理员 | admin | 123456 | 全部功能 |
| 普通员工 | employee | 123456 | 仪表盘 + 库存模块 |

## 功能模块

### 🔐 权限与认证
- JWT Token 模拟登录/登出
- 动态路由（基于用户角色）
- 路由守卫 + 权限拦截

### 👥 系统管理（管理员专属）
- **用户管理**：列表/新增/编辑/删除/状态切换/角色分配
- **角色管理**：角色 CRUD + 权限树配置（节点级别勾选）

### 📦 库存管理
- **商品管理**：列表/新增/编辑/删除/SKU多规格/图片上传预览/状态切换
- **库存操作**：入库 / 出库 / 调拨，完整表单 + 历史记录

### 📊 数据可视化（仪表盘）
- 6 项核心统计卡片
- 销售趋势折线图（ECharts）
- 商品分类环形图（ECharts）
- 库存预警列表（进度条可视化）
- 系统操作动态时间线

### 👤 个人中心
- 个人信息查看 / 编辑
- 修改密码
- 账号安全状态展示
- 登录历史记录

## 项目结构

```
src/
├── api/            # API接口封装
├── assets/
│   └── styles/     # SCSS全局样式 + 变量
├── layouts/        # 主布局（侧边栏+顶栏）
├── mock/           # Mock.js模拟接口数据
│   └── modules/    # auth / users / roles / products / stock / dashboard
├── router/         # Vue Router（含路由守卫）
├── stores/         # Pinia状态（auth + app）
├── utils/          # Axios封装（请求/响应拦截器）
└── views/
    ├── auth/       # 登录页
    ├── dashboard/  # 仪表盘
    ├── inventory/  # 商品管理 + 库存操作
    ├── profile/    # 个人中心
    └── system/     # 用户管理 + 角色管理
```
