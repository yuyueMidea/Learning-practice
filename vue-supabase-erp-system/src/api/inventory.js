import { supabase } from '@/utils/supabase'
import {
  assertError,
  cleanSearch,
  deleteAndInsertItems,
  getRange,
  nextDocumentNo,
  normalizeItems,
  numberValue,
  postInventoryDocument,
  toDateString
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

export function fetchStocks(params) {
  return pageQuery(
    'inv_stocks',
    '*, product:base_products!inv_stocks_product_id_fkey(id, code, name, model, safety_stock, min_stock, category_id, base_unit_id, unit:base_product_units!base_products_base_unit_id_fkey(id, code, name), category:base_product_categories!base_products_category_id_fkey(id, code, name)), warehouse:base_warehouses!inv_stocks_warehouse_id_fkey(id, code, name), location:base_warehouse_locations!inv_stocks_location_id_fkey(id, code, name)',
    params,
    { filters: ['product_id', 'warehouse_id', 'location_id', 'status'], defaultSort: 'updated_at' }
  )
}

export async function fetchStockRowsForWarehouse(warehouseId, categoryId = '') {
  if (!warehouseId) return []
  let request = supabase
    .from('inv_stocks')
    .select('*, product:base_products!inv_stocks_product_id_fkey(id, code, name, category_id, base_unit_id, unit:base_product_units!base_products_base_unit_id_fkey(id, code, name)), location:base_warehouse_locations!inv_stocks_location_id_fkey(id, code, name)')
    .eq('warehouse_id', warehouseId)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
  const { data, error } = await request
  assertError(error)
  return (data || []).filter((item) => !categoryId || item.product?.category_id === categoryId)
}

export function fetchAdjustments(params) {
  return pageQuery(
    'inv_adjustments',
    '*, warehouse:base_warehouses!inv_adjustments_warehouse_id_fkey(id, code, name)',
    params,
    { searchColumns: ['adjustment_no', 'reason', 'remark'], filters: ['status', 'warehouse_id', 'adjustment_type'], dateField: 'adjustment_date', defaultSort: 'adjustment_date' }
  )
}

export async function getAdjustment(id) {
  const { data, error } = await supabase.from('inv_adjustments').select(`
    *, warehouse:base_warehouses!inv_adjustments_warehouse_id_fkey(id, code, name),
    items:inv_adjustment_items(*, product:base_products!inv_adjustment_items_product_id_fkey(id, code, name, model), unit:base_product_units!inv_adjustment_items_unit_id_fkey(id, code, name), location:base_warehouse_locations!inv_adjustment_items_location_id_fkey(id, code, name))
  `).eq('id', id).single()
  assertError(error)
  data.items = (data.items || []).sort((a, b) => a.line_no - b.line_no)
  return data
}

export async function saveAdjustment(record) {
  const items = normalizeItems(record.items).map((item) => ({ ...item, amount: numberValue(item.adjustment_qty) * numberValue(item.unit_cost) }))
  if (!record.warehouse_id) throw new Error('请选择仓库')
  if (!items.length) throw new Error('请至少添加一行调整明细')
  if (!record.reason) throw new Error('请填写调整原因')
  const payload = {
    warehouse_id: record.warehouse_id, adjustment_date: record.adjustment_date || toDateString(), adjustment_type: record.adjustment_type || 'gain', reason: record.reason,
    total_qty: items.reduce((sum, item) => sum + numberValue(item.adjustment_qty), 0), total_amount: items.reduce((sum, item) => sum + numberValue(item.amount), 0),
    status: record.status || 'draft', remark: record.remark || null
  }
  let id = record.id
  let created = false
  if (id) {
    const { error } = await supabase.from('inv_adjustments').update(payload).eq('id', id)
    assertError(error, '更新库存调整单失败')
  } else {
    payload.adjustment_no = record.adjustment_no || await nextDocumentNo('ADJ', payload.adjustment_date)
    const { data, error } = await supabase.from('inv_adjustments').insert(payload).select('id').single()
    assertError(error, '创建库存调整单失败')
    id = data.id; created = true
  }
  try {
    await deleteAndInsertItems({
      table: 'inv_adjustment_items', foreignKey: 'adjustment_id', documentId: id, items,
      payloadMapper: (item, lineNo) => ({
        adjustment_id: id, line_no: lineNo, product_id: item.product_id, unit_id: item.unit_id, location_id: item.location_id || null, batch_no: item.batch_no || null,
        book_qty: numberValue(item.book_qty), adjustment_qty: numberValue(item.adjustment_qty), unit_cost: numberValue(item.unit_cost), amount: numberValue(item.amount),
        reason: item.reason || null, remark: item.remark || null
      })
    })
  } catch (error) {
    if (created) await supabase.from('inv_adjustments').delete().eq('id', id)
    throw error
  }
  return getAdjustment(id)
}

export async function postAdjustment(id) { return postInventoryDocument('adjustment', id) }

export function fetchStocktakes(params) {
  return pageQuery(
    'inv_stocktakes',
    '*, warehouse:base_warehouses!inv_stocktakes_warehouse_id_fkey(id, code, name), category:base_product_categories!inv_stocktakes_category_id_fkey(id, code, name)',
    params,
    { searchColumns: ['stocktake_no', 'remark'], filters: ['status', 'warehouse_id', 'category_id'], dateField: 'stocktake_date', defaultSort: 'stocktake_date' }
  )
}

export async function getStocktake(id) {
  const { data, error } = await supabase.from('inv_stocktakes').select(`
    *, warehouse:base_warehouses!inv_stocktakes_warehouse_id_fkey(id, code, name), category:base_product_categories!inv_stocktakes_category_id_fkey(id, code, name),
    items:inv_stocktake_items(*, product:base_products!inv_stocktake_items_product_id_fkey(id, code, name, model), unit:base_product_units!inv_stocktake_items_unit_id_fkey(id, code, name), location:base_warehouse_locations!inv_stocktake_items_location_id_fkey(id, code, name))
  `).eq('id', id).single()
  assertError(error)
  data.items = (data.items || []).sort((a, b) => a.line_no - b.line_no)
  return data
}

export async function saveStocktakeHeader(record) {
  if (!record.warehouse_id) throw new Error('请选择盘点仓库')
  const payload = {
    warehouse_id: record.warehouse_id, category_id: record.category_id || null, stocktake_date: record.stocktake_date || toDateString(),
    scope_type: record.scope_type || (record.category_id ? 'category' : 'warehouse'), status: record.status || 'draft', remark: record.remark || null
  }
  let id = record.id
  if (id) {
    const { error } = await supabase.from('inv_stocktakes').update(payload).eq('id', id)
    assertError(error, '更新盘点单失败')
  } else {
    payload.stocktake_no = record.stocktake_no || await nextDocumentNo('ST', payload.stocktake_date)
    const { data, error } = await supabase.from('inv_stocktakes').insert(payload).select('id').single()
    assertError(error, '创建盘点单失败')
    id = data.id
  }
  return getStocktake(id)
}

export async function prepareStocktakeItems(id) {
  const { data, error } = await supabase.rpc('erp_prepare_stocktake_items', { p_stocktake_id: id })
  assertError(error, '生成盘点明细失败')
  return data || 0
}

export async function saveStocktakeItems(id, items) {
  const rows = (items || []).map((item, index) => ({
    stocktake_id: id, line_no: item.line_no || index + 1, product_id: item.product_id, unit_id: item.unit_id,
    location_id: item.location_id || null, batch_no: item.batch_no || null, book_qty: numberValue(item.book_qty),
    actual_qty: item.actual_qty === '' || item.actual_qty === undefined || item.actual_qty === null ? null : numberValue(item.actual_qty),
    unit_cost: numberValue(item.unit_cost), status: item.actual_qty === '' || item.actual_qty === undefined || item.actual_qty === null ? 'pending' : 'counted', remark: item.remark || null
  }))
  const { error: deleteError } = await supabase.from('inv_stocktake_items').delete().eq('stocktake_id', id)
  assertError(deleteError, '保存盘点明细失败')
  if (rows.length) {
    const { error } = await supabase.from('inv_stocktake_items').insert(rows)
    assertError(error, '保存盘点明细失败')
  }
  const { error: updateError } = await supabase.from('inv_stocktakes').update({ status: 'submitted', counted_at: new Date().toISOString() }).eq('id', id)
  assertError(updateError, '提交盘点单失败')
  return getStocktake(id)
}

export async function postStocktake(id) { return postInventoryDocument('stocktake', id) }

export function fetchTransfers(params) {
  return pageQuery(
    'inv_transfers',
    '*, from_warehouse:base_warehouses!inv_transfers_from_warehouse_id_fkey(id, code, name), to_warehouse:base_warehouses!inv_transfers_to_warehouse_id_fkey(id, code, name)',
    params,
    { searchColumns: ['transfer_no', 'remark'], filters: ['status', 'from_warehouse_id', 'to_warehouse_id'], dateField: 'transfer_date', defaultSort: 'transfer_date' }
  )
}

export async function getTransfer(id) {
  const { data, error } = await supabase.from('inv_transfers').select(`
    *, from_warehouse:base_warehouses!inv_transfers_from_warehouse_id_fkey(id, code, name), to_warehouse:base_warehouses!inv_transfers_to_warehouse_id_fkey(id, code, name),
    items:inv_transfer_items(*, product:base_products!inv_transfer_items_product_id_fkey(id, code, name, model), unit:base_product_units!inv_transfer_items_unit_id_fkey(id, code, name), from_location:base_warehouse_locations!inv_transfer_items_from_location_id_fkey(id, code, name), to_location:base_warehouse_locations!inv_transfer_items_to_location_id_fkey(id, code, name))
  `).eq('id', id).single()
  assertError(error)
  data.items = (data.items || []).sort((a, b) => a.line_no - b.line_no)
  return data
}

export async function saveTransfer(record) {
  const items = normalizeItems(record.items)
  if (!record.from_warehouse_id || !record.to_warehouse_id) throw new Error('请选择调出与调入仓库')
  if (record.from_warehouse_id === record.to_warehouse_id) throw new Error('调出仓库和调入仓库不能相同')
  if (!items.length) throw new Error('请至少添加一行调拨明细')
  const payload = {
    from_warehouse_id: record.from_warehouse_id, to_warehouse_id: record.to_warehouse_id, transfer_date: record.transfer_date || toDateString(),
    status: record.status || 'draft', remark: record.remark || null
  }
  let id = record.id
  let created = false
  if (id) {
    const { error } = await supabase.from('inv_transfers').update(payload).eq('id', id)
    assertError(error, '更新调拨单失败')
  } else {
    payload.transfer_no = record.transfer_no || await nextDocumentNo('TR', payload.transfer_date)
    const { data, error } = await supabase.from('inv_transfers').insert(payload).select('id').single()
    assertError(error, '创建调拨单失败')
    id = data.id; created = true
  }
  try {
    await deleteAndInsertItems({
      table: 'inv_transfer_items', foreignKey: 'transfer_id', documentId: id, items,
      payloadMapper: (item, lineNo) => ({
        transfer_id: id, line_no: lineNo, product_id: item.product_id, unit_id: item.unit_id,
        from_location_id: item.from_location_id || item.location_id || null, to_location_id: item.to_location_id || null, batch_no: item.batch_no || null,
        qty: numberValue(item.qty), outbound_qty: numberValue(item.outbound_qty), inbound_qty: numberValue(item.inbound_qty), unit_cost: numberValue(item.unit_cost), remark: item.remark || null
      })
    })
  } catch (error) {
    if (created) await supabase.from('inv_transfers').delete().eq('id', id)
    throw error
  }
  return getTransfer(id)
}

export async function postTransfer(id) { return postInventoryDocument('transfer', id) }

export function fetchStockFlows(params) {
  return pageQuery(
    'inv_transactions',
    '*, product:base_products!inv_transactions_product_id_fkey(id, code, name, model), warehouse:base_warehouses!inv_transactions_warehouse_id_fkey(id, code, name), location:base_warehouse_locations!inv_transactions_location_id_fkey(id, code, name)',
    params,
    { searchColumns: ['transaction_no', 'source_no', 'source_type', 'remark'], filters: ['transaction_type', 'warehouse_id', 'product_id', 'direction'], dateField: 'transaction_at', defaultSort: 'transaction_at' }
  )
}

export function subscribeStockChanges(callback) {
  const channel = supabase
    .channel(`erp-stocks-${crypto.randomUUID()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'inv_stocks' }, (payload) => callback?.(payload))
    .subscribe()
  return () => supabase.removeChannel(channel)
}
