import { supabase } from '@/utils/supabase'

export function assertError(error, fallback = '请求失败，请稍后重试') {
  if (error) throw new Error(error.message || fallback)
}

export function cleanSearch(value) {
  return String(value || '').trim().replace(/[(),]/g, ' ')
}

export function getRange(page = 1, pageSize = 20) {
  const size = Number(pageSize) || 20
  const from = (Math.max(Number(page) || 1, 1) - 1) * size
  return [from, from + size - 1]
}

export function numberValue(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function toDateString(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10)
  return date.toISOString().slice(0, 10)
}

export async function nextDocumentNo(prefix, date = toDateString()) {
  const { data, error } = await supabase.rpc('erp_next_document_no', {
    p_prefix: prefix,
    p_document_date: date
  })
  assertError(error, '生成单据编号失败')
  return data
}

export async function postInventoryDocument(sourceType, sourceId) {
  const { data, error } = await supabase.rpc('erp_post_inventory', {
    p_source_type: sourceType,
    p_source_id: sourceId
  })
  assertError(error, '库存过账失败')
  return data
}

export async function fetchAllOptions() {
  const [customersResult, suppliersResult, warehousesResult, unitsResult] = await Promise.all([
    supabase.from('base_customers').select('id, code, name, customer_level, payment_term_days, credit_limit, credit_used, status').eq('status', 'active').order('code'),
    supabase.from('base_suppliers').select('id, code, name, supplier_level, payment_term_days, status').eq('status', 'active').order('code'),
    supabase.from('base_warehouses').select('id, code, name, allow_negative_stock, status').eq('status', 'active').order('code'),
    supabase.from('base_product_units').select('id, code, name, decimal_places, status').eq('status', 'active').order('code')
  ])
  assertError(customersResult.error)
  assertError(suppliersResult.error)
  assertError(warehousesResult.error)
  assertError(unitsResult.error)

  return {
    customers: customersResult.data || [],
    suppliers: suppliersResult.data || [],
    warehouses: warehousesResult.data || [],
    units: unitsResult.data || []
  }
}

export async function fetchWarehouseLocations(warehouseId) {
  if (!warehouseId) return []
  const { data, error } = await supabase
    .from('base_warehouse_locations')
    .select('id, warehouse_id, code, name, location_type, is_default, status')
    .eq('warehouse_id', warehouseId)
    .eq('status', 'active')
    .order('is_default', { ascending: false })
    .order('code')
  assertError(error)
  return data || []
}

export async function fetchProductRows({ keyword = '', page = 1, pageSize = 20 } = {}) {
  const [from, to] = getRange(page, pageSize)
  let request = supabase
    .from('base_products')
    .select('id, code, name, short_name, model, specification, base_unit_id, purchase_price, sale_price, min_sale_price, tax_rate, safety_stock, image_path, status, unit:base_product_units!base_products_base_unit_id_fkey(id, code, name)', { count: 'exact' })
    .eq('status', 'active')
    .order('code')
    .range(from, to)

  const text = cleanSearch(keyword)
  if (text) request = request.or(`code.ilike.%${text}%,name.ilike.%${text}%,short_name.ilike.%${text}%,primary_barcode.ilike.%${text}%`)
  const { data, error, count } = await request
  assertError(error)
  return { rows: data || [], total: count || 0 }
}

export async function getProductStockSummary(productId) {
  if (!productId) return []
  const { data, error } = await supabase.rpc('erp_product_stock_summary', { p_product_id: productId })
  assertError(error, '查询商品库存失败')
  return data || []
}

export async function createAttachmentPath(file, module = 'business') {
  const safeName = String(file?.name || 'attachment').replace(/[^a-zA-Z0-9._-]/g, '_')
  const extension = safeName.includes('.') ? safeName.slice(safeName.lastIndexOf('.')) : ''
  const name = `${crypto.randomUUID()}${extension}`
  return `${module}/${new Date().toISOString().slice(0, 10)}/${name}`
}

export async function uploadBusinessAttachment(file, module = 'business') {
  if (!file) throw new Error('请选择附件')
  const path = await createAttachmentPath(file, module)
  const { error } = await supabase.storage.from('erp-files').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined
  })
  assertError(error, '上传附件失败')
  return path
}

export async function createSignedAttachmentUrl(path, expiresIn = 900) {
  if (!path) return ''
  const { data, error } = await supabase.storage.from('erp-files').createSignedUrl(path, expiresIn)
  assertError(error, '读取附件失败')
  return data?.signedUrl || ''
}

export function normalizeItems(items = [], base = {}) {
  return (items || [])
    .filter((item) => item && item.product_id && numberValue(item.qty) > 0)
    .map((item, index) => ({
      ...base,
      ...item,
      line_no: index + 1,
      qty: numberValue(item.qty),
      unit_price: numberValue(item.unit_price),
      discount_rate: numberValue(item.discount_rate),
      discount_amount: numberValue(item.discount_amount),
      tax_rate: numberValue(item.tax_rate),
      tax_amount: numberValue(item.tax_amount),
      amount_excl_tax: numberValue(item.amount_excl_tax),
      amount_incl_tax: numberValue(item.amount_incl_tax),
      amount: numberValue(item.amount),
      received_qty: numberValue(item.received_qty),
      delivered_qty: numberValue(item.delivered_qty),
      adjustment_qty: numberValue(item.adjustment_qty),
      book_qty: numberValue(item.book_qty),
      actual_qty: item.actual_qty === '' || item.actual_qty === undefined ? null : numberValue(item.actual_qty),
      unit_cost: numberValue(item.unit_cost)
    }))
}

export async function deleteAndInsertItems({ table, foreignKey, documentId, items, payloadMapper }) {
  const { error: deleteError } = await supabase.from(table).delete().eq(foreignKey, documentId)
  assertError(deleteError, '清理旧明细失败')

  if (!items.length) return []
  const rows = items.map((item, index) => payloadMapper(item, index + 1, documentId))
  const { data, error } = await supabase.from(table).insert(rows).select()
  assertError(error, '保存单据明细失败')
  return data || []
}

export function computeOrderTotals(items = [], isTaxIncluded = true) {
  return (items || []).reduce(
    (summary, item) => {
      const qty = numberValue(item.qty)
      const price = numberValue(item.unit_price)
      const discountRate = numberValue(item.discount_rate)
      const taxRate = numberValue(item.tax_rate)
      const gross = qty * price
      const discount = Number((gross * discountRate / 100).toFixed(2))
      const afterDiscount = gross - discount
      const exclTax = isTaxIncluded
        ? Number((afterDiscount / (1 + taxRate / 100)).toFixed(2))
        : Number(afterDiscount.toFixed(2))
      const tax = Number((afterDiscount - exclTax).toFixed(2))
      const inclTax = Number((exclTax + tax).toFixed(2))
      summary.total_qty += qty
      summary.total_amount += inclTax
      summary.discount_amount += discount
      summary.tax_amount += tax
      summary.amount_excl_tax += exclTax
      return summary
    },
    { total_qty: 0, total_amount: 0, discount_amount: 0, tax_amount: 0, amount_excl_tax: 0 }
  )
}

export function withOrderAmounts(item, isTaxIncluded = true) {
  const totals = computeOrderTotals([item], isTaxIncluded)
  return {
    ...item,
    discount_amount: totals.discount_amount,
    tax_amount: totals.tax_amount,
    amount_excl_tax: totals.amount_excl_tax,
    amount_incl_tax: totals.total_amount
  }
}
