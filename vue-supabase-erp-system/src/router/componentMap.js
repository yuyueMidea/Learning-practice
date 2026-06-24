const placeholder = () => import('@/views/common/ModulePlaceholderView.vue')

export const componentMap = {
  'dashboard/DashboardView': () => import('@/views/dashboard/DashboardView.vue'),

  'system/UserManage': () => import('@/views/system/UserManage.vue'),
  'system/RoleManage': () => import('@/views/system/RoleManage.vue'),
  'system/PermissionManage': () => import('@/views/system/PermissionManage.vue'),
  'system/MenuManage': () => import('@/views/system/MenuManage.vue'),
  'system/OperationLog': () => import('@/views/system/OperationLog.vue'),

  'base/CustomerManage': () => import('@/views/base/CustomerManage.vue'),
  'base/SupplierManage': () => import('@/views/base/SupplierManage.vue'),
  'base/WarehouseManage': () => import('@/views/base/WarehouseManage.vue'),
  'base/ProductCategory': () => import('@/views/base/ProductCategory.vue'),
  'base/ProductManage': () => import('@/views/base/ProductManage.vue'),

  'purchase/PurchaseOrder': () => import('@/views/purchase/PurchaseOrder.vue'),
  'purchase/PurchaseReceipt': () => import('@/views/purchase/PurchaseReceipt.vue'),
  'purchase/PurchaseReturn': () => import('@/views/purchase/PurchaseReturn.vue'),
  'purchase/PurchaseStatement': () => import('@/views/purchase/PurchaseStatement.vue'),

  'sales/SalesOrder': () => import('@/views/sales/SalesOrder.vue'),
  'sales/SalesDelivery': () => import('@/views/sales/SalesDelivery.vue'),
  'sales/SalesReturn': () => import('@/views/sales/SalesReturn.vue'),
  'sales/SalesStatement': () => import('@/views/sales/SalesStatement.vue'),

  'inventory/StockQuery': () => import('@/views/inventory/StockQuery.vue'),
  'inventory/StockAdjust': () => import('@/views/inventory/StockAdjust.vue'),
  'inventory/StockTake': () => import('@/views/inventory/StockTake.vue'),
  'inventory/StockTransfer': () => import('@/views/inventory/StockTransfer.vue'),
  'inventory/StockFlow': () => import('@/views/inventory/StockFlow.vue'),

  'finance/Receivable': () => import('@/views/finance/Receivable.vue'),
  'finance/Payable': () => import('@/views/finance/Payable.vue'),
  'finance/ReceiptVoucher': () => import('@/views/finance/ReceiptVoucher.vue'),
  'finance/PaymentVoucher': () => import('@/views/finance/PaymentVoucher.vue'),
  'finance/Expense': () => import('@/views/finance/Expense.vue'),

  'report/SalesReport': () => import('@/views/report/SalesReport.vue'),
  'report/PurchaseReport': () => import('@/views/report/PurchaseReport.vue'),
  'report/InventoryReport': () => import('@/views/report/InventoryReport.vue'),
  'report/FinanceReport': () => import('@/views/report/FinanceReport.vue')
}

export function resolveMenuComponent(componentPath) {
  return componentMap[componentPath] || placeholder
}
