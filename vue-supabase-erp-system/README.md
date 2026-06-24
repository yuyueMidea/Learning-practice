# ERP 管理系统（Phase 2）

本目录是 Phase 2 的可运行 Vue 3 前端工程骨架，后端使用上一阶段的 Supabase SQL Schema。

## 启动

```bash
npm install
cp .env.example .env
# 编辑 .env，填入 VITE_SUPABASE_URL 与 VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev
```

浏览器打开 `http://localhost:5173`。

## 首次账号准备

1. 执行 Phase 1 SQL。
2. 在 Supabase Authentication 创建邮箱密码用户。
3. 在 SQL Editor 为这个 auth.users 用户分配角色：

```sql
select public.erp_assign_role_to_auth_user(
  '你的-auth.users-id'::uuid,
  'SUPER_ADMIN',
  true
);
```

4. 用该邮箱和密码登录。

> 不要把 Supabase `service_role` key 写进 `.env` 或浏览器端代码。新增用户、重置密码等管理能力将在后续 Phase 通过 Edge Function 或受控服务端实现。

---

## Phase 3–4 已实现

系统管理与基础数据模块已完成。详细部署步骤、数据库补充迁移和 Edge Function 说明见：[PHASE_3_4_README.md](./PHASE_3_4_README.md)。

执行顺序：

```bash
# 1. 先执行 Phase 1 数据库迁移
# 2. 再执行 supabase/migrations/20260623_phase3_system_management.sql
# 3. 部署用户管理函数
supabase functions deploy manage-system-users
# 4. 启动前端
npm install
npm run dev
```
