import { supabase } from '@/utils/supabase'
import { assertError, fetchAllOptions } from '@/api/business'
import { groupBy, number, recentDateRange, sortByValue, sum, toDateString } from '@/utils/report'

function applyDateRange(query, field, dateRange = []) {
  if (Array.isArray(dateRange) && dateRange.length === 2) {
    return query.gte(field, dateRange[0]).lte(field, dateRange[1])
  }
  return query
}

function rangeFromFilters(filters = {}) {
  return Array.isArray(filters.date_range) && filters.date_range.length === 2
    ? filters.date_range
    : recentDateRange(30)
}

function dailySeries(rows, dateField, amountField) {
  const [start, end] = rangeFromFilters({ date_range: [rows?.__start, rows?.__end] })
  const map = new Map()
  rows.forEach((row) => {
    const date = row[dateField]
    if (!date) return
    map.set(date, number(map.get(date)) + number(typeof amountField === 'function' ? amountField(row) : row[amountField]))
  })
  const labels = []
  const date = new Date(`${start}T00:00:00`)
  const endDate = new Date(`${end}T00:00:00`)
  while (date <= endDate) {
    labels.push(toDateString(date))
    date.setDate(date.getDate() + 1)
  }
  return { labels, values: labels.map((label) => number(map.get(label))) }
}

function buildDateLabels(dateRange) {
  const [start, end] = dateRange
  const labels = []
  const cursor = new Date(`${start}T00:00:00`)
  const last = new Date(`${end}T00:00:00`)
  while (cursor <= last) {
    labels.push(toDateString(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return labels
}

function buildTrend(rows, dateField, valueGetter, dateRange) {
  const map = new Map()
  rows.forEach((row) => {
    const date = row[dateField]
    if (!date) return
    map.set(date, number(map.get(date)) + number(valueGetter(row)))
  })
  const labels = buildDateLabels(dateRange)
  return { labels, values: labels.map((label) => number(map.get(label))) }
}

export async function fetchReportOptions() {
  return fetchAllOptions()
}

export async function fetchSalesReport(filters = {}) {
  const dateRange = rangeFromFilters(filters)
  let request = supabase
    .from('sal_deliveries')
    .select(`
      id, delivery_no, delivery_date, customer_id, warehouse_id, total_qty, total_amount, status, created_at,
      customer:base_customers!sal_deliveries_customer_id_fkey(id, code, name, customer_level),
      warehouse:base_warehouses!sal_deliveries_warehouse_id_fkey(id, code, name),
      items:sal_delivery_items(
        id, product_id, qty, unit_price, amount,
        product:base_products!sal_delivery_items_product_id_fkey(id, code, name, category_id)
      )
    `)
    .eq('status', 'posted')
    .order('delivery_date', { ascending: true })
    .limit(10000)

  request = applyDateRange(request, 'delivery_date', dateRange)
  if (filters.customer_id) request = request.eq('customer_id', filters.customer_id)
  if (filters.warehouse_id) request = request.eq('warehouse_id', filters.warehouse_id)
  const { data, error } = await request
  assertError(error, '加载销售报表失败')
  const rows = data || []

  const products = new Map()
  const customers = new Map()
  rows.forEach((delivery) => {
    const customer = delivery.customer || {}
    const customerKey = delivery.customer_id
    const customerRow = customers.get(customerKey) || { id: customerKey, code: customer.code, name: customer.name || '未命名客户', amount: 0, qty: 0, order_count: 0 }
    customerRow.amount += number(delivery.total_amount)
    customerRow.qty += number(delivery.total_qty)
    customerRow.order_count += 1
    customers.set(customerKey, customerRow)

    ;(delivery.items || []).forEach((item) => {
      const product = item.product || {}
      const productRow = products.get(item.product_id) || { id: item.product_id, code: product.code, name: product.name || '未命名商品', amount: 0, qty: 0, delivery_count: 0 }
      productRow.amount += number(item.amount)
      productRow.qty += number(item.qty)
      productRow.delivery_count += 1
      products.set(item.product_id, productRow)
    })
  })

  return {
    filters: { ...filters, date_range: dateRange },
    overview: {
      totalAmount: sum(rows, 'total_amount'),
      totalQty: sum(rows, 'total_qty'),
      documentCount: rows.length,
      customerCount: customers.size
    },
    details: rows,
    trend: buildTrend(rows, 'delivery_date', (row) => row.total_amount, dateRange),
    customers: sortByValue([...customers.values()], 'amount'),
    products: sortByValue([...products.values()], 'amount')
  }
}

export async function fetchPurchaseReport(filters = {}) {
  const dateRange = rangeFromFilters(filters)
  let request = supabase
    .from('pur_receipts')
    .select(`
      id, receipt_no, receipt_date, supplier_id, warehouse_id, total_qty, total_amount, status, created_at,
      supplier:base_suppliers!pur_receipts_supplier_id_fkey(id, code, name, supplier_level),
      warehouse:base_warehouses!pur_receipts_warehouse_id_fkey(id, code, name),
      items:pur_receipt_items(
        id, product_id, qty, unit_price, amount,
        product:base_products!pur_receipt_items_product_id_fkey(id, code, name, category_id)
      )
    `)
    .eq('status', 'posted')
    .order('receipt_date', { ascending: true })
    .limit(10000)
  request = applyDateRange(request, 'receipt_date', dateRange)
  if (filters.supplier_id) request = request.eq('supplier_id', filters.supplier_id)
  if (filters.warehouse_id) request = request.eq('warehouse_id', filters.warehouse_id)
  const { data, error } = await request
  assertError(error, '加载采购报表失败')
  const rows = data || []

  const suppliers = new Map()
  const products = new Map()
  rows.forEach((receipt) => {
    const supplier = receipt.supplier || {}
    const supplierRow = suppliers.get(receipt.supplier_id) || { id: receipt.supplier_id, code: supplier.code, name: supplier.name || '未命名供应商', amount: 0, qty: 0, receipt_count: 0 }
    supplierRow.amount += number(receipt.total_amount)
    supplierRow.qty += number(receipt.total_qty)
    supplierRow.receipt_count += 1
    suppliers.set(receipt.supplier_id, supplierRow)

    ;(receipt.items || []).forEach((item) => {
      const product = item.product || {}
      const productRow = products.get(item.product_id) || { id: item.product_id, code: product.code, name: product.name || '未命名商品', amount: 0, qty: 0, avg_price: 0, receipt_count: 0 }
      productRow.amount += number(item.amount)
      productRow.qty += number(item.qty)
      productRow.receipt_count += 1
      productRow.avg_price = productRow.qty > 0 ? Number((productRow.amount / productRow.qty).toFixed(4)) : 0
      products.set(item.product_id, productRow)
    })
  })

  return {
    filters: { ...filters, date_range: dateRange },
    overview: {
      totalAmount: sum(rows, 'total_amount'),
      totalQty: sum(rows, 'total_qty'),
      documentCount: rows.length,
      supplierCount: suppliers.size
    },
    details: rows,
    trend: buildTrend(rows, 'receipt_date', (row) => row.total_amount, dateRange),
    suppliers: sortByValue([...suppliers.values()], 'amount'),
    products: sortByValue([...products.values()], 'amount')
  }
}

export async function fetchInventoryReport(filters = {}) {
  const dateRange = rangeFromFilters(filters)
  let stockRequest = supabase
    .from('inv_stocks')
    .select(`
      id, product_id, warehouse_id, location_id, batch_no, quantity_on_hand, quantity_available, unit_cost, total_cost, last_inbound_at, last_outbound_at, updated_at, status,
      product:base_products!inv_stocks_product_id_fkey(id, code, name, category_id, safety_stock, min_stock),
      warehouse:base_warehouses!inv_stocks_warehouse_id_fkey(id, code, name),
      location:base_warehouse_locations!inv_stocks_location_id_fkey(id, code, name)
    `)
    .eq('status', 'active')
    .order('total_cost', { ascending: false })
    .limit(10000)
  if (filters.warehouse_id) stockRequest = stockRequest.eq('warehouse_id', filters.warehouse_id)
  if (filters.product_id) stockRequest = stockRequest.eq('product_id', filters.product_id)

  let txRequest = supabase
    .from('inv_transactions')
    .select('id, transaction_type, direction, transaction_at, product_id, warehouse_id, qty, amount, unit_cost, source_no')
    .order('transaction_at', { ascending: true })
    .limit(20000)
  txRequest = txRequest.gte('transaction_at', `${dateRange[0]}T00:00:00`).lte('transaction_at', `${dateRange[1]}T23:59:59.999`)
  if (filters.warehouse_id) txRequest = txRequest.eq('warehouse_id', filters.warehouse_id)
  if (filters.product_id) txRequest = txRequest.eq('product_id', filters.product_id)

  const [stocksResult, txResult] = await Promise.all([stockRequest, txRequest])
  assertError(stocksResult.error, '加载库存汇总失败')
  assertError(txResult.error, '加载库存流水失败')
  const stocks = stocksResult.data || []
  const transactions = txResult.data || []

  const movement = new Map()
  transactions.forEach((transaction) => {
    const key = `${transaction.product_id}:${transaction.warehouse_id}`
    const record = movement.get(key) || { in_qty: 0, out_qty: 0, in_amount: 0, out_amount: 0 }
    if (transaction.direction === 'in') {
      record.in_qty += number(transaction.qty)
      record.in_amount += number(transaction.amount)
    } else if (transaction.direction === 'out') {
      record.out_qty += number(transaction.qty)
      record.out_amount += number(transaction.amount)
    }
    movement.set(key, record)
  })

  const details = stocks.map((stock) => {
    const moved = movement.get(`${stock.product_id}:${stock.warehouse_id}`) || { in_qty: 0, out_qty: 0, in_amount: 0, out_amount: 0 }
    return {
      ...stock,
      ...moved,
      stock_age_days: stock.last_outbound_at ? Math.max(0, Math.floor((Date.now() - new Date(stock.last_outbound_at).getTime()) / 86400000)) : null,
      warning: number(stock.product?.safety_stock) > 0 && number(stock.quantity_available) < number(stock.product?.safety_stock)
    }
  })
  const valueByWarehouse = groupBy(details, (row) => row.warehouse?.name || '未分配仓库')
  const warehouseRanking = sortByValue([...valueByWarehouse.entries()].map(([name, rows]) => ({ warehouse_id: rows[0]?.warehouse_id || null, name, value: sum(rows, 'total_cost'), qty: sum(rows, 'quantity_on_hand') })), 'value')
  const slowMoving = sortByValue(details.filter((row) => row.stock_age_days === null || row.stock_age_days >= 90), (row) => row.stock_age_days ?? 9999)

  return {
    filters: { ...filters, date_range: dateRange },
    overview: {
      stockValue: sum(details, 'total_cost'),
      onHandQty: sum(details, 'quantity_on_hand'),
      inboundQty: sum(transactions.filter((row) => row.direction === 'in'), 'qty'),
      outboundQty: sum(transactions.filter((row) => row.direction === 'out'), 'qty'),
      turnoverRate: sum(transactions.filter((row) => row.direction === 'out'), 'amount') / Math.max(sum(details, 'total_cost'), 1)
    },
    details,
    warehouseRanking,
    slowMoving,
    transactions
  }
}

function ageingBucket(row, dateField = 'due_date') {
  const base = row[dateField] || row.bill_date
  if (!base) return '未到期'
  const days = Math.floor((Date.now() - new Date(`${base}T00:00:00`).getTime()) / 86400000)
  if (days <= 0) return '未到期'
  if (days <= 30) return '1-30天'
  if (days <= 60) return '31-60天'
  if (days <= 90) return '61-90天'
  return '90天以上'
}

export async function fetchFinanceReport(filters = {}) {
  const dateRange = rangeFromFilters(filters)
  const receivableRequest = supabase.from('fin_receivables').select('id, receivable_no, customer_id, bill_date, due_date, original_amount, received_amount, outstanding_amount, status, customer:base_customers!fin_receivables_customer_id_fkey(id, code, name)')
  const payableRequest = supabase.from('fin_payables').select('id, payable_no, supplier_id, bill_date, due_date, original_amount, paid_amount, outstanding_amount, status, supplier:base_suppliers!fin_payables_supplier_id_fkey(id, code, name)')
  let receiptRequest = supabase.from('fin_receipts').select('id, receipt_no, receipt_date, amount, allocated_amount, customer_id, customer:base_customers!fin_receipts_customer_id_fkey(id, code, name)').eq('status', 'posted').order('receipt_date', { ascending: true }).limit(10000)
  let paymentRequest = supabase.from('fin_payments').select('id, payment_no, payment_date, amount, allocated_amount, supplier_id, supplier:base_suppliers!fin_payments_supplier_id_fkey(id, code, name)').eq('status', 'posted').order('payment_date', { ascending: true }).limit(10000)
  let expenseRequest = supabase.from('fin_expenses').select('id, expense_no, expense_date, expense_category, amount, amount_excl_tax, tax_amount, status').eq('status', 'posted').order('expense_date', { ascending: true }).limit(10000)
  let salesCostRequest = supabase.from('inv_transactions').select('transaction_at, amount').eq('transaction_type', 'sales_delivery').eq('direction', 'out').limit(20000)
  let salesRevenueRequest = supabase.from('sal_deliveries').select('delivery_date, total_amount').eq('status', 'posted').limit(10000)

  receiptRequest = applyDateRange(receiptRequest, 'receipt_date', dateRange)
  paymentRequest = applyDateRange(paymentRequest, 'payment_date', dateRange)
  expenseRequest = applyDateRange(expenseRequest, 'expense_date', dateRange)
  salesRevenueRequest = applyDateRange(salesRevenueRequest, 'delivery_date', dateRange)
  salesCostRequest = salesCostRequest.gte('transaction_at', `${dateRange[0]}T00:00:00`).lte('transaction_at', `${dateRange[1]}T23:59:59.999`)
  if (filters.customer_id) {
    receivableRequest.eq('customer_id', filters.customer_id)
    receiptRequest.eq('customer_id', filters.customer_id)
    salesRevenueRequest = salesRevenueRequest.eq('customer_id', filters.customer_id)
  }
  if (filters.supplier_id) {
    payableRequest.eq('supplier_id', filters.supplier_id)
    paymentRequest.eq('supplier_id', filters.supplier_id)
  }

  const [receivables, payables, receipts, payments, expenses, salesCost, salesRevenue] = await Promise.all([
    receivableRequest, payableRequest, receiptRequest, paymentRequest, expenseRequest, salesCostRequest, salesRevenueRequest
  ])
  ;[receivables, payables, receipts, payments, expenses, salesCost, salesRevenue].forEach((result) => assertError(result.error, '加载财务报表失败'))

  const ageingLabels = ['未到期', '1-30天', '31-60天', '61-90天', '90天以上']
  const receivableAgeing = ageingLabels.map((label) => ({ name: label, value: sum((receivables.data || []).filter((row) => ageingBucket(row) === label), 'outstanding_amount') }))
  const payableAgeing = ageingLabels.map((label) => ({ name: label, value: sum((payables.data || []).filter((row) => ageingBucket(row) === label), 'outstanding_amount') }))
  const expenseCategories = groupBy(expenses.data || [], (row) => row.expense_category || '未分类')
  const expenseByCategory = sortByValue([...expenseCategories.entries()].map(([name, rows]) => ({ name, value: sum(rows, 'amount') })), 'value')

  return {
    filters: { ...filters, date_range: dateRange },
    overview: {
      receivedAmount: sum(receipts.data, 'amount'),
      paidAmount: sum(payments.data, 'amount'),
      expenseAmount: sum(expenses.data, 'amount'),
      receivableBalance: sum(receivables.data, 'outstanding_amount'),
      payableBalance: sum(payables.data, 'outstanding_amount'),
      salesRevenue: sum(salesRevenue.data, 'total_amount'),
      salesCost: sum(salesCost.data, 'amount')
    },
    receivables: receivables.data || [],
    payables: payables.data || [],
    receipts: receipts.data || [],
    payments: payments.data || [],
    expenses: expenses.data || [],
    receivableAgeing,
    payableAgeing,
    expenseByCategory,
    cashTrend: {
      labels: buildDateLabels(dateRange),
      received: buildTrend(receipts.data || [], 'receipt_date', (row) => row.amount, dateRange).values,
      paid: buildTrend(payments.data || [], 'payment_date', (row) => row.amount, dateRange).values,
      expense: buildTrend(expenses.data || [], 'expense_date', (row) => row.amount, dateRange).values
    }
  }
}

export async function fetchDashboardAnalytics(filters = {}) {
  const dateRange = Array.isArray(filters.date_range) && filters.date_range.length === 2 ? filters.date_range : recentDateRange(30)
  const [salesReport, stockReport] = await Promise.all([
    fetchSalesReport({ date_range: dateRange }),
    fetchInventoryReport({ date_range: dateRange })
  ])
  return {
    dateRange,
    salesTrend: salesReport.trend,
    productTop: salesReport.products.slice(0, 10),
    stockAlerts: stockReport.details.filter((row) => row.warning).slice(0, 8)
  }
}
