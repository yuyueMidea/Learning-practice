import { supabase } from '@/utils/supabase'
import {
  assertError,
  cleanSearch,
  computeOrderTotals,
  deleteAndInsertItems,
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
    if (Array.isArray(query.date_range) && query.date_range.length === 2 && config.dateField) {
      request = request.gte(config.dateField, query.date_range[0]).lte(config.dateField, query.date_range[1])
    }
    const ascending = sorter.order === 'ascending'
    request = request.order(sorter.prop || config.defaultSort || 'created_at', { ascending }).range(from, to)
    const { data, error, count } = await request
    assertError(error)
    return { rows: data || [], total: count || 0 }
  })()
}

export function fetchPurchaseOrders(params) {
  return pageQuery(
    'pur_orders',
    '*, supplier:base_suppliers!pur_orders_supplier_id_fkey(id, code, name), warehouse:base_warehouses!pur_orders_warehouse_id_fkey(id, code, name)',
    params,
    { searchColumns: ['order_no', 'source_ref_no', 'remark'], filters: ['status', 'supplier_id', 'warehouse_id'], dateField: 'order_date', defaultSort: 'order_date' }
  )
}

export async function getPurchaseOrder(id) {
  const { data, error } = await supabase
    .from('pur_orders')
    .select(`
      *,
      supplier:base_suppliers!pur_orders_supplier_id_fkey(id, code, name, payment_term_days),
      warehouse:base_warehouses!pur_orders_warehouse_id_fkey(id, code, name),
      items:pur_order_items(
        *,
        product:base_products!pur_order_items_product_id_fkey(id, code, name, model, specification, purchase_price, tax_rate),
        unit:base_product_units!pur_order_items_unit_id_fkey(id, code, name)
      )
    `)
    .eq('id', id)
    .single()
  assertError(error)
  data.items = (data.items || []).sort((a, b) => a.line_no - b.line_no)
  return data
}

function orderHeaderPayload(record, totals) {
  return {
    supplier_id: record.supplier_id,
    warehouse_id: record.warehouse_id,
    purchaser_user_id: record.purchaser_user_id || null,
    order_date: record.order_date || toDateString(),
    expected_arrival_date: record.expected_arrival_date || null,
    currency_code: record.currency_code || 'CNY',
    exchange_rate: numberValue(record.exchange_rate, 1),
    is_tax_included: record.is_tax_included !== false,
    tax_rate: numberValue(record.tax_rate),
    total_qty: totals.total_qty,
    total_amount: totals.total_amount,
    discount_amount: totals.discount_amount,
    tax_amount: totals.tax_amount,
    payable_amount: totals.total_amount,
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
    received_qty: numberValue(value.received_qty),
    unit_price: numberValue(value.unit_price),
    discount_rate: numberValue(value.discount_rate),
    discount_amount: numberValue(value.discount_amount),
    tax_rate: numberValue(value.tax_rate),
    tax_amount: numberValue(value.tax_amount),
    amount_excl_tax: numberValue(value.amount_excl_tax),
    amount_incl_tax: numberValue(value.amount_incl_tax),
    expected_arrival_date: value.expected_arrival_date || null,
    remark: value.remark || null
  }
}

export async function savePurchaseOrder(record) {
  const items = normalizeItems(record.items).map((item) => withOrderAmounts(item, record.is_tax_included !== false))
  if (!record.supplier_id || !record.warehouse_id) throw new Error('请选择供应商和收货仓库')
  if (!items.length) throw new Error('请至少添加一行采购明细')
  const totals = computeOrderTotals(items, record.is_tax_included !== false)
  const payload = orderHeaderPayload(record, totals)
  let orderId = record.id
  let created = false

  if (orderId) {
    const { error } = await supabase.from('pur_orders').update(payload).eq('id', orderId)
    assertError(error, '更新采购订单失败')
  } else {
    payload.order_no = record.order_no || await nextDocumentNo('PO', payload.order_date)
    const { data, error } = await supabase.from('pur_orders').insert(payload).select('id, order_no').single()
    assertError(error, '创建采购订单失败')
    orderId = data.id
    created = true
  }

  try {
    await deleteAndInsertItems({
      table: 'pur_order_items',
      foreignKey: 'order_id',
      documentId: orderId,
      items,
      payloadMapper: (item, lineNo) => orderItemPayload(item, lineNo, orderId, payload.is_tax_included)
    })
  } catch (error) {
    if (created) await supabase.from('pur_orders').delete().eq('id', orderId)
    throw error
  }

  return getPurchaseOrder(orderId)
}

export async function updatePurchaseOrderStatus(id, status, reviewComment = '') {
  const patch = { status }
  if (['approved', 'rejected'].includes(status)) {
    patch.reviewed_at = new Date().toISOString()
    patch.review_comment = reviewComment || null
  }
  const { error } = await supabase.from('pur_orders').update(patch).eq('id', id)
  assertError(error, '更新采购订单状态失败')
}

export function fetchPurchaseReceipts(params) {
  return pageQuery(
    'pur_receipts',
    '*, supplier:base_suppliers!pur_receipts_supplier_id_fkey(id, code, name), warehouse:base_warehouses!pur_receipts_warehouse_id_fkey(id, code, name), order:pur_orders!pur_receipts_order_id_fkey(id, order_no)',
    params,
    { searchColumns: ['receipt_no', 'remark'], filters: ['status', 'supplier_id', 'warehouse_id'], dateField: 'receipt_date', defaultSort: 'receipt_date' }
  )
}

export async function getPurchaseReceipt(id) {
  const { data, error } = await supabase
    .from('pur_receipts')
    .select(`
      *, supplier:base_suppliers!pur_receipts_supplier_id_fkey(id, code, name),
      warehouse:base_warehouses!pur_receipts_warehouse_id_fkey(id, code, name),
      order:pur_orders!pur_receipts_order_id_fkey(id, order_no),
      items:pur_receipt_items(
        *, product:base_products!pur_receipt_items_product_id_fkey(id, code, name, model),
        unit:base_product_units!pur_receipt_items_unit_id_fkey(id, code, name),
        location:base_warehouse_locations!pur_receipt_items_location_id_fkey(id, code, name)
      )
    `)
    .eq('id', id)
    .single()
  assertError(error)
  data.items = (data.items || []).sort((a, b) => a.line_no - b.line_no)
  return data
}

export async function fetchReceivablePurchaseOrders() {
  const { data, error } = await supabase
    .from('pur_orders')
    .select('id, order_no, supplier_id, warehouse_id, order_date, status, supplier:base_suppliers!pur_orders_supplier_id_fkey(id, code, name), warehouse:base_warehouses!pur_orders_warehouse_id_fkey(id, code, name), items:pur_order_items(*, product:base_products!pur_order_items_product_id_fkey(id, code, name, model), unit:base_product_units!pur_order_items_unit_id_fkey(id, code, name))')
    .in('status', ['approved', 'partial_received'])
    .order('order_date', { ascending: false })
  assertError(error)
  return (data || []).filter((order) => (order.items || []).some((item) => numberValue(item.qty) > numberValue(item.received_qty)))
}

export async function savePurchaseReceipt(record) {
  const items = normalizeItems(record.items).map((item) => ({ ...item, amount: numberValue(item.qty) * numberValue(item.unit_price) }))
  if (!record.supplier_id || !record.warehouse_id) throw new Error('采购收货需要供应商和仓库')
  if (!items.length) throw new Error('请至少添加一行收货明细')
  const totalQty = items.reduce((sum, item) => sum + numberValue(item.qty), 0)
  const totalAmount = items.reduce((sum, item) => sum + numberValue(item.amount), 0)
  const payload = {
    order_id: record.order_id || null,
    supplier_id: record.supplier_id,
    warehouse_id: record.warehouse_id,
    receiver_user_id: record.receiver_user_id || null,
    receipt_date: record.receipt_date || toDateString(),
    total_qty: totalQty,
    total_amount: totalAmount,
    status: record.status || 'draft',
    attachment_paths: Array.isArray(record.attachment_paths) ? record.attachment_paths : [],
    remark: record.remark || null
  }
  let id = record.id
  let created = false
  if (id) {
    const { error } = await supabase.from('pur_receipts').update(payload).eq('id', id)
    assertError(error, '更新采购收货单失败')
  } else {
    payload.receipt_no = record.receipt_no || await nextDocumentNo('PR', payload.receipt_date)
    const { data, error } = await supabase.from('pur_receipts').insert(payload).select('id').single()
    assertError(error, '创建采购收货单失败')
    id = data.id
    created = true
  }
  try {
    await deleteAndInsertItems({
      table: 'pur_receipt_items', foreignKey: 'receipt_id', documentId: id, items,
      payloadMapper: (item, lineNo) => ({
        receipt_id: id, line_no: lineNo, order_item_id: item.order_item_id || null,
        product_id: item.product_id, unit_id: item.unit_id, location_id: item.location_id || null,
        batch_no: item.batch_no || null, production_date: item.production_date || null, expiry_date: item.expiry_date || null,
        qty: numberValue(item.qty), unit_price: numberValue(item.unit_price), amount: numberValue(item.amount),
        quality_status: item.quality_status || 'qualified', remark: item.remark || null
      })
    })
  } catch (error) {
    if (created) await supabase.from('pur_receipts').delete().eq('id', id)
    throw error
  }
  return getPurchaseReceipt(id)
}

export async function postPurchaseReceipt(id) {
  return postInventoryDocument('purchase_receipt', id)
}

export function fetchPurchaseReturns(params) {
  return pageQuery(
    'pur_returns',
    '*, supplier:base_suppliers!pur_returns_supplier_id_fkey(id, code, name), warehouse:base_warehouses!pur_returns_warehouse_id_fkey(id, code, name), receipt:pur_receipts!pur_returns_receipt_id_fkey(id, receipt_no)',
    params,
    { searchColumns: ['return_no', 'reason', 'remark'], filters: ['status', 'supplier_id', 'warehouse_id'], dateField: 'return_date', defaultSort: 'return_date' }
  )
}

export async function getPurchaseReturn(id) {
  const { data, error } = await supabase
    .from('pur_returns')
    .select(`
      *, supplier:base_suppliers!pur_returns_supplier_id_fkey(id, code, name), warehouse:base_warehouses!pur_returns_warehouse_id_fkey(id, code, name),
      receipt:pur_receipts!pur_returns_receipt_id_fkey(id, receipt_no),
      items:pur_return_items(
        *, product:base_products!pur_return_items_product_id_fkey(id, code, name, model),
        unit:base_product_units!pur_return_items_unit_id_fkey(id, code, name),
        location:base_warehouse_locations!pur_return_items_location_id_fkey(id, code, name)
      )
    `).eq('id', id).single()
  assertError(error)
  data.items = (data.items || []).sort((a, b) => a.line_no - b.line_no)
  return data
}

export async function fetchPostedPurchaseReceipts() {
  const { data, error } = await supabase
    .from('pur_receipts')
    .select('id, receipt_no, supplier_id, warehouse_id, receipt_date, supplier:base_suppliers!pur_receipts_supplier_id_fkey(id, code, name), warehouse:base_warehouses!pur_receipts_warehouse_id_fkey(id, code, name), items:pur_receipt_items(*, product:base_products!pur_receipt_items_product_id_fkey(id, code, name, model), unit:base_product_units!pur_receipt_items_unit_id_fkey(id, code, name))')
    .eq('status', 'posted')
    .order('receipt_date', { ascending: false })
  assertError(error)
  return data || []
}

export async function savePurchaseReturn(record) {
  const items = normalizeItems(record.items).map((item) => ({ ...item, amount: numberValue(item.qty) * numberValue(item.unit_price) }))
  if (!record.supplier_id || !record.warehouse_id) throw new Error('采购退货需要供应商和仓库')
  if (!items.length) throw new Error('请至少添加一行退货明细')
  const payload = {
    receipt_id: record.receipt_id || null, supplier_id: record.supplier_id, warehouse_id: record.warehouse_id,
    return_date: record.return_date || toDateString(), total_qty: items.reduce((sum, item) => sum + numberValue(item.qty), 0),
    total_amount: items.reduce((sum, item) => sum + numberValue(item.amount), 0), reason: record.reason || null,
    status: record.status || 'draft', attachment_paths: Array.isArray(record.attachment_paths) ? record.attachment_paths : [], remark: record.remark || null
  }
  let id = record.id
  let created = false
  if (id) {
    const { error } = await supabase.from('pur_returns').update(payload).eq('id', id)
    assertError(error, '更新采购退货单失败')
  } else {
    payload.return_no = record.return_no || await nextDocumentNo('PTR', payload.return_date)
    const { data, error } = await supabase.from('pur_returns').insert(payload).select('id').single()
    assertError(error, '创建采购退货单失败')
    id = data.id; created = true
  }
  try {
    await deleteAndInsertItems({
      table: 'pur_return_items', foreignKey: 'return_id', documentId: id, items,
      payloadMapper: (item, lineNo) => ({
        return_id: id, line_no: lineNo, receipt_item_id: item.receipt_item_id || null,
        product_id: item.product_id, unit_id: item.unit_id, location_id: item.location_id || null, batch_no: item.batch_no || null,
        qty: numberValue(item.qty), unit_price: numberValue(item.unit_price), amount: numberValue(item.amount), reason: item.reason || null, remark: item.remark || null
      })
    })
  } catch (error) {
    if (created) await supabase.from('pur_returns').delete().eq('id', id)
    throw error
  }
  return getPurchaseReturn(id)
}

export async function postPurchaseReturn(id) {
  return postInventoryDocument('purchase_return', id)
}

export async function fetchPurchaseStatement({ startDate = '', endDate = '', supplierId = '' } = {}) {
  let receipts = supabase.from('pur_receipts').select('id, supplier_id, receipt_date, total_amount, status, supplier:base_suppliers!pur_receipts_supplier_id_fkey(id, code, name)').eq('status', 'posted')
  let returns = supabase.from('pur_returns').select('id, supplier_id, return_date, total_amount, status, supplier:base_suppliers!pur_returns_supplier_id_fkey(id, code, name)').eq('status', 'posted')
  if (supplierId) { receipts = receipts.eq('supplier_id', supplierId); returns = returns.eq('supplier_id', supplierId) }
  if (startDate) { receipts = receipts.gte('receipt_date', startDate); returns = returns.gte('return_date', startDate) }
  if (endDate) { receipts = receipts.lte('receipt_date', endDate); returns = returns.lte('return_date', endDate) }
  const [receiptResult, returnResult, payableResult] = await Promise.all([receipts, returns, supabase.from('fin_payables').select('supplier_id, outstanding_amount, status').neq('status', 'cancelled')])
  assertError(receiptResult.error); assertError(returnResult.error); assertError(payableResult.error)
  const grouped = new Map()
  ;(receiptResult.data || []).forEach((item) => {
    const row = grouped.get(item.supplier_id) || { supplier_id: item.supplier_id, supplier_name: item.supplier?.name || '-', receipt_amount: 0, return_amount: 0, net_amount: 0, payable_outstanding: 0 }
    row.receipt_amount += numberValue(item.total_amount); grouped.set(item.supplier_id, row)
  })
  ;(returnResult.data || []).forEach((item) => {
    const row = grouped.get(item.supplier_id) || { supplier_id: item.supplier_id, supplier_name: item.supplier?.name || '-', receipt_amount: 0, return_amount: 0, net_amount: 0, payable_outstanding: 0 }
    row.return_amount += numberValue(item.total_amount); grouped.set(item.supplier_id, row)
  })
  ;(payableResult.data || []).forEach((item) => {
    const row = grouped.get(item.supplier_id) || { supplier_id: item.supplier_id, supplier_name: '-', receipt_amount: 0, return_amount: 0, net_amount: 0, payable_outstanding: 0 }
    row.payable_outstanding += numberValue(item.outstanding_amount); grouped.set(item.supplier_id, row)
  })
  return [...grouped.values()].map((row) => ({ ...row, net_amount: row.receipt_amount - row.return_amount })).sort((a, b) => b.net_amount - a.net_amount)
}
