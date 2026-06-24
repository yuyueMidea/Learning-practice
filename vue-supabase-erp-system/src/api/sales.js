import { supabase } from '@/utils/supabase'
import {
  assertError,
  cleanSearch,
  computeOrderTotals,
  deleteAndInsertItems,
  getProductStockSummary,
  getRange,
  nextDocumentNo,
  normalizeItems,
  numberValue,
  postInventoryDocument,
  toDateString,
  withOrderAmounts
} from '@/api/business'

function pageQuery(table, select, params = {}, config = {}) {
  return (async () => {
    const { page = 1, pageSize = 20, query = {}, sorter = {} } = params
    const [from, to] = getRange(page, pageSize)
    let request = supabase.from(table).select(select, { count: 'exact' })
    const keyword = cleanSearch(query.keyword)
    if (keyword && config.searchColumns?.length) request = request.or(config.searchColumns.map((field) => `${field}.ilike.%${keyword}%`).join(','))
    for (const field of config.filters || []) {
      if (query[field] !== undefined && query[field] !== null && query[field] !== '') request = request.eq(field, query[field])
    }
    if (Array.isArray(query.date_range) && query.date_range.length === 2 && config.dateField) request = request.gte(config.dateField, query.date_range[0]).lte(config.dateField, query.date_range[1])
    request = request.order(sorter.prop || config.defaultSort || 'created_at', { ascending: sorter.order === 'ascending' }).range(from, to)
    const { data, error, count } = await request
    assertError(error)
    return { rows: data || [], total: count || 0 }
  })()
}

export function fetchSalesOrders(params) {
  return pageQuery(
    'sal_orders',
    '*, customer:base_customers!sal_orders_customer_id_fkey(id, code, name, customer_level), warehouse:base_warehouses!sal_orders_warehouse_id_fkey(id, code, name)',
    params,
    { searchColumns: ['order_no', 'source_ref_no', 'remark'], filters: ['status', 'customer_id', 'warehouse_id', 'source_type'], dateField: 'order_date', defaultSort: 'order_date' }
  )
}

export async function getSalesOrder(id) {
  const { data, error } = await supabase.from('sal_orders').select(`
    *,
    customer:base_customers!sal_orders_customer_id_fkey(id, code, name, customer_level, credit_limit, credit_used, payment_term_days),
    warehouse:base_warehouses!sal_orders_warehouse_id_fkey(id, code, name),
    items:sal_order_items(
      *, product:base_products!sal_order_items_product_id_fkey(id, code, name, model, specification, sale_price, min_sale_price, tax_rate),
      unit:base_product_units!sal_order_items_unit_id_fkey(id, code, name)
    )
  `).eq('id', id).single()
  assertError(error)
  data.items = (data.items || []).sort((a, b) => a.line_no - b.line_no)
  return data
}

export async function checkCustomerCredit(customerId, newAmount = 0) {
  if (!customerId) return { passed: true, level: 'not_checked', message: '' }
  const { data, error } = await supabase
    .from('base_customers')
    .select('id, name, credit_limit, credit_used')
    .eq('id', customerId)
    .single()
  assertError(error, '查询客户信用额度失败')
  const limit = numberValue(data.credit_limit)
  const used = numberValue(data.credit_used)
  const remaining = limit - used
  if (limit <= 0) return { passed: true, level: 'not_checked', limit, used, remaining, message: '该客户未设置信用额度' }
  if (used + numberValue(newAmount) > limit) return { passed: false, level: 'blocked', limit, used, remaining, message: `订单金额将超出信用额度，剩余额度 ${remaining.toFixed(2)}` }
  if (remaining - numberValue(newAmount) < limit * 0.1) return { passed: true, level: 'warning', limit, used, remaining, message: '订单接近客户信用额度上限' }
  return { passed: true, level: 'passed', limit, used, remaining, message: '客户信用额度校验通过' }
}

export async function fetchProductWarehouseStock(productId, warehouseId = '') {
  const rows = await getProductStockSummary(productId)
  return warehouseId ? rows.filter((item) => item.warehouse_id === warehouseId) : rows
}

function orderHeaderPayload(record, totals, credit) {
  return {
    customer_id: record.customer_id,
    warehouse_id: record.warehouse_id || null,
    salesperson_user_id: record.salesperson_user_id || null,
    order_date: record.order_date || toDateString(),
    delivery_date: record.delivery_date || null,
    currency_code: record.currency_code || 'CNY',
    exchange_rate: numberValue(record.exchange_rate, 1),
    is_tax_included: record.is_tax_included !== false,
    tax_rate: numberValue(record.tax_rate),
    total_qty: totals.total_qty,
    total_amount: totals.total_amount,
    discount_amount: totals.discount_amount,
    tax_amount: totals.tax_amount,
    receivable_amount: totals.total_amount,
    credit_check_status: credit.level || 'not_checked',
    status: record.status || 'draft',
    source_type: record.source_type || 'manual',
    source_ref_no: record.source_ref_no || null,
    attachment_paths: Array.isArray(record.attachment_paths) ? record.attachment_paths : [],
    remark: record.remark || null
  }
}

function orderItemPayload(item, lineNo, orderId, isTaxIncluded) {
  const value = withOrderAmounts(item, isTaxIncluded)
  return {
    order_id: orderId,
    line_no: lineNo,
    product_id: value.product_id,
    unit_id: value.unit_id,
    specification_snapshot: value.specification_snapshot || value.product?.specification || null,
    qty: numberValue(value.qty),
    delivered_qty: numberValue(value.delivered_qty),
    unit_price: numberValue(value.unit_price),
    discount_rate: numberValue(value.discount_rate),
    discount_amount: numberValue(value.discount_amount),
    tax_rate: numberValue(value.tax_rate),
    tax_amount: numberValue(value.tax_amount),
    amount_excl_tax: numberValue(value.amount_excl_tax),
    amount_incl_tax: numberValue(value.amount_incl_tax),
    remark: value.remark || null
  }
}

export async function saveSalesOrder(record) {
  const items = normalizeItems(record.items).map((item) => withOrderAmounts(item, record.is_tax_included !== false))
  if (!record.customer_id) throw new Error('请选择客户')
  if (!items.length) throw new Error('请至少添加一行销售明细')
  const totals = computeOrderTotals(items, record.is_tax_included !== false)
  const credit = await checkCustomerCredit(record.customer_id, totals.total_amount)
  const payload = orderHeaderPayload(record, totals, credit)
  let id = record.id
  let created = false
  if (id) {
    const { error } = await supabase.from('sal_orders').update(payload).eq('id', id)
    assertError(error, '更新销售订单失败')
  } else {
    payload.order_no = record.order_no || await nextDocumentNo('SO', payload.order_date)
    const { data, error } = await supabase.from('sal_orders').insert(payload).select('id').single()
    assertError(error, '创建销售订单失败')
    id = data.id; created = true
  }
  try {
    await deleteAndInsertItems({
      table: 'sal_order_items', foreignKey: 'order_id', documentId: id, items,
      payloadMapper: (item, lineNo) => orderItemPayload(item, lineNo, id, payload.is_tax_included)
    })
  } catch (error) {
    if (created) await supabase.from('sal_orders').delete().eq('id', id)
    throw error
  }
  return getSalesOrder(id)
}

export async function updateSalesOrderStatus(id, status, reviewComment = '') {
  const patch = { status }
  if (['approved', 'rejected'].includes(status)) {
    patch.reviewed_at = new Date().toISOString()
    patch.review_comment = reviewComment || null
  }
  const { error } = await supabase.from('sal_orders').update(patch).eq('id', id)
  assertError(error, '更新销售订单状态失败')
}

export function fetchSalesDeliveries(params) {
  return pageQuery(
    'sal_deliveries',
    '*, customer:base_customers!sal_deliveries_customer_id_fkey(id, code, name), warehouse:base_warehouses!sal_deliveries_warehouse_id_fkey(id, code, name), order:sal_orders!sal_deliveries_order_id_fkey(id, order_no)',
    params,
    { searchColumns: ['delivery_no', 'tracking_no', 'receiver_name', 'remark'], filters: ['status', 'customer_id', 'warehouse_id'], dateField: 'delivery_date', defaultSort: 'delivery_date' }
  )
}

export async function getSalesDelivery(id) {
  const { data, error } = await supabase.from('sal_deliveries').select(`
    *, customer:base_customers!sal_deliveries_customer_id_fkey(id, code, name), warehouse:base_warehouses!sal_deliveries_warehouse_id_fkey(id, code, name),
    order:sal_orders!sal_deliveries_order_id_fkey(id, order_no),
    items:sal_delivery_items(
      *, product:base_products!sal_delivery_items_product_id_fkey(id, code, name, model),
      unit:base_product_units!sal_delivery_items_unit_id_fkey(id, code, name),
      location:base_warehouse_locations!sal_delivery_items_location_id_fkey(id, code, name)
    )
  `).eq('id', id).single()
  assertError(error)
  data.items = (data.items || []).sort((a, b) => a.line_no - b.line_no)
  return data
}

export async function fetchDeliverableSalesOrders() {
  const { data, error } = await supabase
    .from('sal_orders')
    .select('id, order_no, customer_id, warehouse_id, order_date, status, customer:base_customers!sal_orders_customer_id_fkey(id, code, name), warehouse:base_warehouses!sal_orders_warehouse_id_fkey(id, code, name), items:sal_order_items(*, product:base_products!sal_order_items_product_id_fkey(id, code, name, model), unit:base_product_units!sal_order_items_unit_id_fkey(id, code, name))')
    .in('status', ['approved', 'partial_delivered'])
    .order('order_date', { ascending: false })
  assertError(error)
  return (data || []).filter((order) => (order.items || []).some((item) => numberValue(item.qty) > numberValue(item.delivered_qty)))
}

export async function saveSalesDelivery(record) {
  const items = normalizeItems(record.items).map((item) => ({ ...item, amount: numberValue(item.qty) * numberValue(item.unit_price) }))
  if (!record.customer_id || !record.warehouse_id) throw new Error('销售发货需要客户和仓库')
  if (!items.length) throw new Error('请至少添加一行发货明细')
  const payload = {
    order_id: record.order_id || null, customer_id: record.customer_id, warehouse_id: record.warehouse_id,
    delivery_user_id: record.delivery_user_id || null, delivery_date: record.delivery_date || toDateString(),
    receiver_name: record.receiver_name || null, receiver_phone: record.receiver_phone || null, receiver_address: record.receiver_address || null,
    logistics_company: record.logistics_company || null, tracking_no: record.tracking_no || null,
    total_qty: items.reduce((sum, item) => sum + numberValue(item.qty), 0), total_amount: items.reduce((sum, item) => sum + numberValue(item.amount), 0),
    status: record.status || 'draft', attachment_paths: Array.isArray(record.attachment_paths) ? record.attachment_paths : [], remark: record.remark || null
  }
  let id = record.id
  let created = false
  if (id) {
    const { error } = await supabase.from('sal_deliveries').update(payload).eq('id', id)
    assertError(error, '更新销售发货单失败')
  } else {
    payload.delivery_no = record.delivery_no || await nextDocumentNo('SD', payload.delivery_date)
    const { data, error } = await supabase.from('sal_deliveries').insert(payload).select('id').single()
    assertError(error, '创建销售发货单失败')
    id = data.id; created = true
  }
  try {
    await deleteAndInsertItems({
      table: 'sal_delivery_items', foreignKey: 'delivery_id', documentId: id, items,
      payloadMapper: (item, lineNo) => ({
        delivery_id: id, line_no: lineNo, order_item_id: item.order_item_id || null,
        product_id: item.product_id, unit_id: item.unit_id, location_id: item.location_id || null, batch_no: item.batch_no || null,
        qty: numberValue(item.qty), unit_price: numberValue(item.unit_price), amount: numberValue(item.amount), remark: item.remark || null
      })
    })
  } catch (error) {
    if (created) await supabase.from('sal_deliveries').delete().eq('id', id)
    throw error
  }
  return getSalesDelivery(id)
}

export async function postSalesDelivery(id) { return postInventoryDocument('sales_delivery', id) }

export function fetchSalesReturns(params) {
  return pageQuery(
    'sal_returns',
    '*, customer:base_customers!sal_returns_customer_id_fkey(id, code, name), warehouse:base_warehouses!sal_returns_warehouse_id_fkey(id, code, name), delivery:sal_deliveries!sal_returns_delivery_id_fkey(id, delivery_no)',
    params,
    { searchColumns: ['return_no', 'reason', 'remark'], filters: ['status', 'customer_id', 'warehouse_id'], dateField: 'return_date', defaultSort: 'return_date' }
  )
}

export async function getSalesReturn(id) {
  const { data, error } = await supabase.from('sal_returns').select(`
    *, customer:base_customers!sal_returns_customer_id_fkey(id, code, name), warehouse:base_warehouses!sal_returns_warehouse_id_fkey(id, code, name),
    delivery:sal_deliveries!sal_returns_delivery_id_fkey(id, delivery_no),
    items:sal_return_items(
      *, product:base_products!sal_return_items_product_id_fkey(id, code, name, model),
      unit:base_product_units!sal_return_items_unit_id_fkey(id, code, name),
      location:base_warehouse_locations!sal_return_items_location_id_fkey(id, code, name)
    )
  `).eq('id', id).single()
  assertError(error)
  data.items = (data.items || []).sort((a, b) => a.line_no - b.line_no)
  return data
}

export async function fetchPostedSalesDeliveries() {
  const { data, error } = await supabase
    .from('sal_deliveries')
    .select('id, delivery_no, customer_id, warehouse_id, delivery_date, customer:base_customers!sal_deliveries_customer_id_fkey(id, code, name), warehouse:base_warehouses!sal_deliveries_warehouse_id_fkey(id, code, name), items:sal_delivery_items(*, product:base_products!sal_delivery_items_product_id_fkey(id, code, name, model), unit:base_product_units!sal_delivery_items_unit_id_fkey(id, code, name))')
    .eq('status', 'posted').order('delivery_date', { ascending: false })
  assertError(error)
  return data || []
}

export async function saveSalesReturn(record) {
  const items = normalizeItems(record.items).map((item) => ({ ...item, amount: numberValue(item.qty) * numberValue(item.unit_price) }))
  if (!record.customer_id || !record.warehouse_id) throw new Error('销售退货需要客户和仓库')
  if (!items.length) throw new Error('请至少添加一行退货明细')
  const payload = {
    delivery_id: record.delivery_id || null, customer_id: record.customer_id, warehouse_id: record.warehouse_id,
    return_date: record.return_date || toDateString(), total_qty: items.reduce((sum, item) => sum + numberValue(item.qty), 0),
    total_amount: items.reduce((sum, item) => sum + numberValue(item.amount), 0), reason: record.reason || null,
    status: record.status || 'draft', attachment_paths: Array.isArray(record.attachment_paths) ? record.attachment_paths : [], remark: record.remark || null
  }
  let id = record.id
  let created = false
  if (id) {
    const { error } = await supabase.from('sal_returns').update(payload).eq('id', id)
    assertError(error, '更新销售退货单失败')
  } else {
    payload.return_no = record.return_no || await nextDocumentNo('SRT', payload.return_date)
    const { data, error } = await supabase.from('sal_returns').insert(payload).select('id').single()
    assertError(error, '创建销售退货单失败')
    id = data.id; created = true
  }
  try {
    await deleteAndInsertItems({
      table: 'sal_return_items', foreignKey: 'return_id', documentId: id, items,
      payloadMapper: (item, lineNo) => ({
        return_id: id, line_no: lineNo, delivery_item_id: item.delivery_item_id || null,
        product_id: item.product_id, unit_id: item.unit_id, location_id: item.location_id || null, batch_no: item.batch_no || null,
        qty: numberValue(item.qty), unit_price: numberValue(item.unit_price), amount: numberValue(item.amount),
        quality_status: item.quality_status || 'qualified', reason: item.reason || null, remark: item.remark || null
      })
    })
  } catch (error) {
    if (created) await supabase.from('sal_returns').delete().eq('id', id)
    throw error
  }
  return getSalesReturn(id)
}

export async function postSalesReturn(id) { return postInventoryDocument('sales_return', id) }

export async function fetchSalesStatement({ startDate = '', endDate = '', customerId = '' } = {}) {
  let deliveries = supabase.from('sal_deliveries').select('id, customer_id, delivery_date, total_amount, customer:base_customers!sal_deliveries_customer_id_fkey(id, code, name)').eq('status', 'posted')
  let returns = supabase.from('sal_returns').select('id, customer_id, return_date, total_amount, customer:base_customers!sal_returns_customer_id_fkey(id, code, name)').eq('status', 'posted')
  if (customerId) { deliveries = deliveries.eq('customer_id', customerId); returns = returns.eq('customer_id', customerId) }
  if (startDate) { deliveries = deliveries.gte('delivery_date', startDate); returns = returns.gte('return_date', startDate) }
  if (endDate) { deliveries = deliveries.lte('delivery_date', endDate); returns = returns.lte('return_date', endDate) }
  const [deliveryResult, returnResult, receivableResult] = await Promise.all([deliveries, returns, supabase.from('fin_receivables').select('customer_id, outstanding_amount, status').neq('status', 'cancelled')])
  assertError(deliveryResult.error); assertError(returnResult.error); assertError(receivableResult.error)
  const grouped = new Map()
  ;(deliveryResult.data || []).forEach((item) => {
    const row = grouped.get(item.customer_id) || { customer_id: item.customer_id, customer_name: item.customer?.name || '-', delivery_amount: 0, return_amount: 0, net_amount: 0, receivable_outstanding: 0 }
    row.delivery_amount += numberValue(item.total_amount); grouped.set(item.customer_id, row)
  })
  ;(returnResult.data || []).forEach((item) => {
    const row = grouped.get(item.customer_id) || { customer_id: item.customer_id, customer_name: item.customer?.name || '-', delivery_amount: 0, return_amount: 0, net_amount: 0, receivable_outstanding: 0 }
    row.return_amount += numberValue(item.total_amount); grouped.set(item.customer_id, row)
  })
  ;(receivableResult.data || []).forEach((item) => {
    const row = grouped.get(item.customer_id) || { customer_id: item.customer_id, customer_name: '-', delivery_amount: 0, return_amount: 0, net_amount: 0, receivable_outstanding: 0 }
    row.receivable_outstanding += numberValue(item.outstanding_amount); grouped.set(item.customer_id, row)
  })
  return [...grouped.values()].map((row) => ({ ...row, net_amount: row.delivery_amount - row.return_amount })).sort((a, b) => b.net_amount - a.net_amount)
}
