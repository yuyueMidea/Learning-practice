# ERP SQL Schema 全面分析报告

> 文件：`erp_phase_1_supabase_schema_final.sql`（2543 行）  
> 数据库：Supabase PostgreSQL（含 Auth / RLS / Storage / Realtime）

---

## 一、总体数字

| 项目 | 数量 |
|------|------|
| 数据表 | 40 张 |
| 索引 | 64 个 |
| 函数/触发器函数 | 9 个 |
| 动态触发器（DO 块批量注册） | 每张表 2 个（共 ~80 个） |
| CHECK 约束 | 60 个 |
| RLS 策略（动态生成） | 每张业务表 4 条 CRUD + sys_users 4 条定制 |
| 种子数据模块 | 11.1 ~ 11.9 共 9 段 |

---

## 二、模块结构

```
Section 0   公共函数与权限基元
Section 1   系统管理（sys_*）
Section 1.1 RBAC 辅助函数
Section 2   基础数据（base_*）
Section 3   采购管理（pur_*）
Section 4   销售管理（sal_*）
Section 5   库存管理（inv_*）
Section 6   财务管理（fin_*）
Section 7   Auth 同步 & 安全函数
Section 8   updated_at + created_by 保护触发器（DO 块批量注册）
Section 9   Row Level Security（DO 块批量生成）
Section 10  Storage Bucket & RLS
Section 11  种子数据
Section 12  初始超管说明（注释）
```

---

## 三、核心设计亮点

### 1. RBAC 三层权限模型

```
auth.users ─→ sys_users ─→ sys_user_roles ─→ sys_roles
                                               ↓
                                    sys_role_permissions ─→ sys_permissions
```

- `erp_is_super_admin()`：SECURITY DEFINER，绕开 RLS 递归
- `erp_has_permission(code)`：超管短路 + 权限码精确匹配
- `erp_can_access(table, action, created_by)`：支持 `data_scope = 'self'`（仅查自己创建的数据）
- RLS 动态生成：一个 DO 块对 40 张表统一生成 SELECT/INSERT/UPDATE/DELETE 四条策略

### 2. 财务约束完整

`fin_receivables` 强制平衡约束：
```sql
check (received_amount + writeoff_amount + outstanding_amount = original_amount)
```
`fin_payables`、`fin_receipts`、`fin_payments` 同理。  
这是数据库层的最后一道防线，即使前端绕过业务逻辑，数据库也会拒绝。

### 3. 库存维度唯一索引（四维）

```sql
create unique index uq_inv_stocks_dimension on inv_stocks (
  product_id,
  warehouse_id,
  coalesce(location_id, '00000000-0000-0000-0000-000000000000'),
  coalesce(batch_no, '')
);
```
用 `coalesce` 处理 NULL 参与唯一索引，是 PostgreSQL 的正确做法，避免 NULL ≠ NULL 导致的重复行。

### 4. 盘点差异用生成列

```sql
difference_qty  numeric generated always as (actual_qty - book_qty) stored,
difference_amount numeric generated always as (
    round((actual_qty - book_qty) * unit_cost, 2)
) stored
```
数据库自动维护，前端无需计算，且永远一致。

### 5. 新用户自动创建 profile

`trg_erp_auth_user_created` 触发 `erp_handle_new_auth_user()`，Supabase Auth 注册后立即在 `sys_users` 创建 `inactive` 状态的 profile，管理员手动激活后才能进入系统。防止新账号未经授权直接访问。

### 6. created_by 防篡改触发器

`erp_protect_created_by()` 在每张表的 BEFORE UPDATE 触发器中运行，非超管不得修改 `created_by`，保护审计链。

### 7. 版本号乐观锁

`inv_stocks.version_no bigint default 0`，为后续 CAS（Compare-And-Swap）并发更新提供基础。当前 Phase 1 未在 RPC 中使用，可在 Phase 2 过账函数中启用。

---

## 四、发现的问题

### 🔴 严重：关键 RPC 函数全部缺失

前端调用的 7 个 RPC 函数，SQL 文件中**一个都没有实现**：

| RPC 函数名 | 调用方 | 功能 |
|------------|--------|------|
| `erp_next_document_no(prefix, date)` | `business.js` | 生成单据编号（ADJ/ST/TR/SK/FK/FY/PO…） |
| `erp_post_inventory(source_type, source_id)` | `business.js` | 库存过账（收货/发货/退货/调整/盘点/调拨） |
| `erp_post_receipt(receipt_id)` | `finance.js` | 收款单过账 + 核销应收 |
| `erp_post_payment(payment_id)` | `finance.js` | 付款单过账 + 核销应付 |
| `erp_post_expense(expense_id)` | `finance.js` | 费用单过账 |
| `erp_prepare_stocktake_items(stocktake_id)` | `inventory.js` | 生成盘点明细（从 inv_stocks 快照） |
| `erp_product_stock_summary(product_id)` | `business.js` | 查询商品各仓库库存汇总 |

这 7 个函数是系统的**核心业务逻辑**。没有它们，以下功能完全无法使用：
- 所有单据的过账/确认操作
- 库存实时增减
- 应收/应付核销
- 盘点数据初始化
- 单据编号生成（每次新建单据都会失败）

**这是 Phase 2 的主要交付物。**

### 🔴 严重：`manage-system-users` Edge Function 未实现

`system.js` 中所有用户管理操作（创建/更新/重置密码/删除/修改状态）均通过：
```js
supabase.functions.invoke('manage-system-users', { body: { action, ... } })
```
调用，但 SQL 文件中没有 Edge Function 定义（也不应有，Edge Function 是独立部署的）。  
**需单独实现并部署该 Edge Function。**

### 🔴 严重：Storage 权限码与种子数据不匹配

Storage RLS 策略检查的权限码为 `storage:read`、`storage:create`、`storage:update`、`storage:delete`，但种子数据中 storage 资源的 action 包括 `read/create/update/delete/approve/export`（由 cross join 全量生成）。  

**实际问题**：`storage:approve` 和 `storage:export` 权限被生成了，但没有任何地方使用，属于冗余数据，影响不大。但如果 `erp_has_permission('storage:read')` 的 permission 记录未插入（例如种子数据执行失败），Storage 所有操作都会被拒绝。

### 🟡 设计问题：`allow_negative_stock` 字段无实际约束

`base_warehouses.allow_negative_stock` 字段定义了是否允许负库存，但：
1. SQL 中没有任何触发器或约束在库存减少时检查此标志
2. `erp_post_inventory` RPC 尚未实现，未来实现时需要在函数内读取此字段并判断

### 🟡 设计问题：`sys_operation_logs` 的 `actor` 字段前端无法填充

表结构有两个 actor 字段：
```sql
actor_user_id uuid references sys_users(id)     -- 应用层用户 ID
actor_auth_user_id uuid references auth.users(id) -- Supabase Auth UID
```

但前端 `logOperation()` 插入日志时**两个字段都没有传值**，仅依赖 `created_by = auth.uid()` 隐式赋值。  
- `actor_auth_user_id` 可通过 `default auth.uid()` 自动填入（但表定义中没有 default）
- `actor_user_id`（`sys_users.id`）前端无法直接获知，需要 `profile.id`

**建议**：给 `actor_auth_user_id` 加 `default auth.uid()`，并在 `system.js` 的 `logOperation` 中补传 `actor_auth_user_id`。

### 🟡 索引缺口

以下高频查询无专用索引：

| 缺失索引 | 对应查询场景 |
|---------|------------|
| `inv_transactions(direction, transaction_at)` | 报表按方向统计出入库 |
| `fin_receivables(bill_date)` | 财务报表日期范围查询 |
| `fin_payables(bill_date)` | 同上 |
| `sal_deliveries(status, delivery_date)` | Dashboard 今日/本月销售额 |
| `base_products(status, code)` | 商品选择器搜索 |
| `inv_stocks(status)` | 报表过滤 status = 'active' |

### 🟢 小问题：`pur_order_items.received_qty` 约束过强

```sql
received_qty numeric(18,6) not null default 0
  check (received_qty >= 0 and received_qty <= qty)
```

实际业务中可能出现**超收**（收货数量超过订单数量），此约束会直接阻止。建议改为：
```sql
check (received_qty >= 0)
```
并在应用层做软警告而非硬拦截。`sal_order_items.delivered_qty` 和 `inv_transfer_items` 的 `outbound_qty/inbound_qty` 存在同样问题。

### 🟢 小问题：`inv_adjustment_items.adjustment_qty > 0`

调整单有 `adjustment_type in ('gain', 'loss')` 区分盈亏方向，明细的 `adjustment_qty` 强制 `> 0`（正数），方向由 type 字段决定。这是正确的设计，但注释中应说明，否则看起来像 loss 时数量应为负数。

---

## 五、前端 ↔ 数据库 对照表

### 表名对照（全部匹配 ✅）

前端使用的 30 张表，全部在 schema 中存在，无遗漏。

### RPC 对照

| RPC | Schema 中存在 | 状态 |
|-----|--------------|------|
| `erp_get_my_authorization` | ✅ L1356 | 已实现 |
| `erp_next_document_no` | ❌ | **缺失** |
| `erp_post_inventory` | ❌ | **缺失** |
| `erp_post_receipt` | ❌ | **缺失** |
| `erp_post_payment` | ❌ | **缺失** |
| `erp_post_expense` | ❌ | **缺失** |
| `erp_prepare_stocktake_items` | ❌ | **缺失** |
| `erp_product_stock_summary` | ❌ | **缺失** |

### FK 别名对照（前端 Supabase 关联查询）

前端大量使用 `!fk_name` 语法指定 FK 别名，例如：
```js
'customer:base_customers!sal_deliveries_customer_id_fkey(id, code, name)'
```
这些 FK 名称均由 PostgreSQL 自动生成，格式为 `{table}_{column}_fkey`，与 schema 定义完全吻合。✅

---

## 六、Phase 2 待实现清单（优先级排序）

### P0 — 系统不可用，必须先实现

1. **`erp_next_document_no(p_prefix, p_document_date)`**
   - 建议用 `sys_document_sequences` 表 + `FOR UPDATE` 锁实现序列号
   - 格式：`{PREFIX}{YYYYMM}{四位流水}` 例如 `PO2406230001`

2. **`erp_post_inventory(p_source_type, p_source_id)`**
   - 核心逻辑：读取来源单据明细 → upsert `inv_stocks`（含 version_no CAS）→ insert `inv_transactions` → 更新来源单据 status = 'posted'
   - 需要处理：purchase_receipt / purchase_return / sales_delivery / sales_return / adjustment / stocktake / transfer

3. **`manage-system-users` Edge Function**
   - 操作 `auth.users`（只有 service_role 才有权限）
   - actions：create / update / reset-password / update-status / delete

### P1 — 功能不完整，尽快实现

4. **`erp_post_receipt(p_receipt_id)`** — 收款单过账 + 更新 `fin_receivables.received_amount/outstanding_amount`
5. **`erp_post_payment(p_payment_id)`** — 付款单过账 + 更新 `fin_payables.paid_amount/outstanding_amount`
6. **`erp_post_expense(p_expense_id)`** — 费用单过账
7. **`erp_prepare_stocktake_items(p_stocktake_id)`** — 从 `inv_stocks` 快照生成 `inv_stocktake_items`
8. **`erp_product_stock_summary(p_product_id)`** — 聚合查询各仓库可用库存

### P2 — 质量提升

9. 给 `sys_operation_logs.actor_auth_user_id` 加 `default auth.uid()`
10. 补充缺失的 6 个索引（见上文索引缺口）
11. 前端 `logOperation()` 补传 `actor_auth_user_id`
12. 决策：是否放开 `received_qty <= qty` 约束支持超收场景

---

---

## 补充分析：Phase 3 & Phase 5-7 迁移文件

> `20260623_phase3_system_management.sql` + `20260624_phase5_7_inventory_workflows.sql`

---

### Phase 3（系统管理补丁）

**内容**：仅 32 行，修复两处遗漏：

| 修复内容 | 说明 |
|---------|------|
| `idx_sys_users_email_status` 索引 | 补充按 email+status 查询的复合索引（登录/用户搜索） |
| `idx_sys_permissions_module_resource` 索引 | 补充权限管理列表的模块+资源+排序索引 |
| `system-permissions` 菜单 | Phase 1 种子数据中遗漏了「权限管理」菜单，此处补插，`sort_order=25`（介于角色管理20和菜单管理30之间） |

**评价**：简洁、幂等（`on conflict do update`），执行顺序无要求，随时可补跑。

---

### Phase 5-7（采购/销售/库存业务工作流）

这是系统的**核心业务引擎**，共 627 行，实现了 Phase 1 缺失的 7 个 RPC 中的 5 个。

#### 新增函数一览

| 函数 | 类型 | 对外暴露 | 功能 |
|------|------|---------|------|
| `erp_current_sys_user_id()` | 辅助 | ❌ 内部 | 获取当前登录用户的 sys_users.id |
| `erp_next_document_no(prefix, date)` | 业务 | ✅ | 并发安全单据编号生成器 |
| `erp_require_permission(code)` | 安全 | ❌ 内部 | 权限校验，不满足直接 raise |
| `erp_apply_stock_change(...)` | 核心 | ❌ 内部 | 库存变动原子操作（加锁+更新+写流水） |
| `erp_post_inventory(type, id)` | 业务 | ✅ | 过账入口，分发 7 种业务类型 |
| `erp_prepare_stocktake_items(id)` | 业务 | ✅ | 从 inv_stocks 快照生成盘点明细 |
| `erp_product_stock_summary(id)` | 查询 | ✅ | 商品各仓库库存汇总 |

执行完 Phase 1 + Phase 3 + Phase 5-7 后，原先缺失的 7 个 RPC：

| RPC | 状态 |
|-----|------|
| `erp_next_document_no` | ✅ Phase 5-7 实现 |
| `erp_post_inventory` | ✅ Phase 5-7 实现 |
| `erp_prepare_stocktake_items` | ✅ Phase 5-7 实现 |
| `erp_product_stock_summary` | ✅ Phase 5-7 实现 |
| `erp_post_receipt` | ❌ **仍缺失** |
| `erp_post_payment` | ❌ **仍缺失** |
| `erp_post_expense` | ❌ **仍缺失** |

---

### Phase 5-7 亮点设计

**1. 双层锁防并发**

`erp_apply_stock_change` 对同一库存维度（product+warehouse+location+batch）加 `pg_advisory_xact_lock`，配合 `SELECT ... FOR UPDATE` 行锁，确保高并发过账时不出现幻读或超卖。

**2. 移动加权平均成本（WAC）**

入库时自动计算新的单位成本：
```sql
v_new_cost = (old_qty * old_cost + new_qty * new_cost) / total_qty
```
出库时保持原成本不变（先进先出的近似处理）。这是 ERP 最常见的成本核算方法，实现正确。

**3. 幂等过账**

所有过账函数检测到单据已 `posted` 时直接返回成功，不重复执行，前端重试安全。

**4. 销售退货质检过滤**

`quality_status = 'rejected'` 的退货明细不入库，仅记录退货单，符合实际业务。

**5. 应收/应付自动生成**

- 采购收货过账 → 自动生成 `fin_payables`（含到期日 = 收货日 + 供应商账期）
- 销售发货过账 → 自动生成 `fin_receivables` + 更新 `credit_used`

**6. 订单履行状态自动推进**

- 收货/发货过账后按行检查 `received_qty/delivered_qty`，自动将关联订单推进为 `partial_received` / `completed`

---

### 发现的问题

#### 🔴 严重：`inv_transactions` 出库成本记录错误（COGS 问题）

`erp_post_inventory` 在处理销售发货和采购退货时，将 **商品售价/采购单价**（`v_item.unit_price`）作为 `p_unit_cost` 传入 `erp_apply_stock_change`：

```sql
-- 销售发货（L353-357）
perform public.erp_apply_stock_change(
  'sales_delivery', 'out', v_item.product_id, ...
  v_item.qty, v_item.unit_price,   -- ← 传的是售价，不是成本
  ...
);
```

在 `erp_apply_stock_change` 出库分支中：
```sql
-- out 方向
v_new_cost = case when v_old_cost > 0 then v_old_cost else p_unit_cost end
-- inv_stocks.unit_cost 保持 v_old_cost（正确）
-- 但 v_amount = p_qty * coalesce(nullif(p_unit_cost, 0), v_new_cost)
-- 若 p_unit_cost（售价）不为 0，则 amount = 数量 × 售价（错误！）
```

结果：`inv_transactions.amount` 记录的是**销售收入金额**而非**库存成本金额（COGS）**，导致库存报表中「出库金额」统计严重偏高。

**修复方案**：出库时传入 `0` 或 `null` 作为 `p_unit_cost`，让函数自动使用 `v_old_cost`（库存账面成本）：
```sql
-- 改为传 0，由函数内部取 inv_stocks.unit_cost
perform public.erp_apply_stock_change(
  'sales_delivery', 'out', v_item.product_id, ...,
  v_item.qty, 0,   -- ← 改为 0，让函数用账面成本
  ...
);
```

#### 🟡 设计问题：`erp_next_document_no` 查全表性能风险

单据编号生成器用 `LIKE v_base || '%'` 扫描 12 张表，每次生成编号都要扫这些表。当前数据量小无影响，但随着数据增长（10万+单据），每天首单生成会越来越慢。

**建议**：新建一张 `sys_document_sequences` 表专门维护流水号：
```sql
create table sys_document_sequences (
  prefix_date text primary key,  -- e.g. 'PO20260624'
  last_no integer not null default 0
);
-- 用 FOR UPDATE 锁行，直接 UPDATE last_no = last_no + 1
```
彻底避免跨表扫描。

#### 🟡 逻辑隐患：`found` 变量语义混淆

在 `erp_apply_stock_change` 中：
```sql
select * into v_stock from inv_stocks ... for update;  -- 设置 FOUND

select allow_negative_stock into v_allow_negative
from base_warehouses where id = p_warehouse_id;        -- 覆盖 FOUND

if not found then raise exception 'Warehouse does not exist'; end if;  -- 检查仓库 ✅
if found and v_stock.id is not null then ...            -- FOUND=true（仓库存在），条件恒真！
```

`if found and v_stock.id is not null` 中 `found` 永远为 `true`（因为仓库已通过校验），条件退化为单纯的 `v_stock.id is not null`。当前逻辑结果正确，但代码意图不清晰，维护时容易出错。

**建议**：直接写 `if v_stock.id is not null then`，去掉 `found` 条件。

#### 🟡 业务逻辑缺口：采购退货不还原应付账款

采购收货过账时自动生成 `fin_payables`，但**采购退货过账不会减少对应的应付金额**。若发生退货，应付账款会虚高，财务数字失真。

Phase 5-7 的实现中退货只做库存出库，没有任何财务处理。需在后续版本中补充：
```sql
-- 采购退货过账后，按退货金额冲减对应的 fin_payables
update fin_payables set outstanding_amount = outstanding_amount - return_amount ...
```

同理，销售退货过账虽然更新了 `credit_used`，但没有减少 `fin_receivables` 的未收款金额。

#### 🟢 小问题：`Realtime` 异常静默处理过宽

```sql
exception
  when duplicate_object then null;
  when undefined_object then null;
  when insufficient_privilege then null;  -- ← 权限不足也静默
```
`insufficient_privilege` 静默可能掩盖真实配置问题，建议改为 `raise warning` 输出日志而非完全吞掉。

---

### 三文件整体覆盖度（执行全部后）

| 类别 | 覆盖状态 |
|------|---------|
| 表结构 | ✅ Phase 1 完整 |
| RLS 策略 | ✅ Phase 1 完整 |
| 触发器 | ✅ Phase 1 完整 |
| 权限管理菜单 | ✅ Phase 3 补充 |
| 库存过账 RPC | ✅ Phase 5-7 实现 |
| 财务过账 RPC（收款/付款/费用） | ❌ **仍缺失** |
| 用户管理 Edge Function | ❌ **仍缺失** |

---

## 七、总体评价

这份 Schema 的**结构设计质量很高**：

- 命名规范一致（模块前缀、snake_case、_at 时间戳、_id 外键）
- CHECK 约束覆盖全面，财务平衡约束是亮点
- RLS 设计安全，SECURITY DEFINER 函数职责清晰，防止递归
- 触发器批量注册优雅，避免遗漏
- 种子数据设计完整，幂等（全部用 `on conflict do update`）

**主要不足是 Phase 1 作为基础版本，7 个核心业务 RPC 函数尚未实现**，导致当前系统只能读取数据，无法执行任何过账操作。这是 Phase 2 的核心任务。
