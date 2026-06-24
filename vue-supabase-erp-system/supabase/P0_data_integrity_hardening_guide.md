# ERP P0 数据完整性加固：部署与验证

适用前提：已执行 Phase 1 最终版、Phase 3、Phase 5-7、Phase 8-9 SQL。

## 此迁移解决什么

1. 销售发货、采购退货等出库流水不再用售价/采购价作为库存成本；后续 `inv_transactions.unit_cost` / `amount` 记录的是实际库存成本。
2. 已过账/已完成业务单据和其明细不允许通过前端 REST 直接修改或删除。
3. `inv_stocks`、`inv_transactions`、`fin_receivables`、`fin_payables` 改为浏览器只读，只能由数据库过账函数写入。
4. 销售退货自动生成客户贷项，并自动冲减原发货应收可冲部分；采购退货对应供应商借项和应付冲减。
5. 数据库内校验客户信用额度、退货不得超过来源数量、库位与仓库归属、表头/明细合计一致性。

## 执行方式

1. 先在 Supabase Dashboard 创建数据库 Branch，或至少导出备份。
2. SQL Editor 中新建 Query。
3. 完整执行 `20260626_p0_data_integrity_hardening.sql`。
4. 浏览器退出 ERP 后重新登录，避免旧会话/页面缓存干扰。

该迁移无前端文件替换要求；保持你当前 Phase 8-9 前端即可。

## 回归测试顺序

### 采购收货

- 新建采购订单、采购收货单并“审核并过账”。
- 检查 `inv_stocks.quantity_on_hand` 增加。
- 检查 `inv_transactions.transaction_type = 'purchase_receipt'`，`unit_cost` 等于收货单价。
- 检查自动生成 `fin_payables`。

### 销售发货与成本

- 对刚才入库的商品建销售订单/发货单并过账。
- 检查 `inv_transactions.transaction_type = 'sales_delivery'`。
- 核对该流水 `unit_cost` 等于入库后的库存成本，而不是销售单价。
- 检查自动生成 `fin_receivables`。

### 销售退货

- 选择刚才的已过账发货单创建销售退货并过账。
- 检查库存回增；退货入库流水成本应等于原发货流水成本。
- 检查 `fin_customer_credit_notes` 产生一条记录。
- 检查原 `fin_receivables.credit_amount` 增加、`outstanding_amount` 降低。

### 采购退货

- 选择已过账采购收货单创建采购退货并过账。
- 检查库存扣减。
- 检查 `fin_supplier_debit_notes` 产生一条记录。
- 检查原 `fin_payables.debit_amount` 增加、`outstanding_amount` 降低。

### 篡改防护

可用 SQL Editor 以项目管理员身份做结构验证（SQL Editor 的高权限不受 RLS 限制）；实际浏览器端则应被拒绝：

```js
await supabase.from('inv_stocks').update({ quantity_on_hand: 999 }).eq('id', stockId)
// 预期：permission denied / 没有 update 权限
```

```js
await supabase.from('sal_deliveries').update({ remark: 'tamper' }).eq('id', postedDeliveryId)
// 预期：Immutable business document ...
```

## 历史数据说明

迁移只修复以后产生的过账记录。此前已经过账的销售发货、采购退货，可能已把售价/采购价写进 `inv_transactions.amount`；不能安全地靠一条通用 SQL 自动重算。

当前若仍是测试数据，建议在单独测试项目中清空测试业务单据后重新走一遍“收货 → 发货 → 退货”链路。若已有真实历史数据，应先导出并按库存流水时序审计，再单独制定成本重算/红冲方案。

## 后续仍需开发的功能

本迁移会保留“已收款后发生退货”形成的未核销客户贷项，或“已付款后采购退货”形成的未核销供应商借项。下一阶段应增加：

- 客户贷项 / 供应商借项列表页；
- 手工应用到后续应收应付；
- 退款、退回供应商款流程；
- 报表中展示未核销贷项/借项余额。
