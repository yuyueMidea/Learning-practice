import { supabase } from '@/utils/supabase'

function assertError(error) {
  if (error) throw new Error(error.message || '请求失败，请稍后重试')
}

function cleanSearch(value) {
  return String(value || '').trim().replace(/[(),]/g, ' ')
}

function pageRange(page, pageSize) {
  const size = Number(pageSize) || 20
  const from = (Math.max(Number(page) || 1, 1) - 1) * size
  return [from, from + size - 1]
}

function normalizeNumeric(payload, fields = []) {
  const cloned = { ...payload }
  fields.forEach((field) => {
    if (cloned[field] === '' || cloned[field] === undefined) cloned[field] = null
    else if (cloned[field] !== null) cloned[field] = Number(cloned[field])
  })
  return cloned
}

function stripEmpty(payload, fields = []) {
  const result = { ...payload }
  fields.forEach((field) => {
    if (result[field] === '') result[field] = null
  })
  return result
}

async function basicPagedQuery(table, { page = 1, pageSize = 20, query = {}, sorter = {} }, config = {}) {
  const [from, to] = pageRange(page, pageSize)
  let request = supabase.from(table).select(config.select || '*', { count: 'exact' })
  const keyword = cleanSearch(query.keyword)

  if (keyword && config.searchColumns?.length) {
    request = request.or(config.searchColumns.map((column) => `${column}.ilike.%${keyword}%`).join(','))
  }

  ;(config.equalFilters || []).forEach((field) => {
    if (query[field] !== undefined && query[field] !== null && query[field] !== '') request = request.eq(field, query[field])
  })

  if (typeof config.extend === 'function') request = config.extend(request, query)

  request = request
    .order(sorter.prop || config.defaultSort || 'created_at', { ascending: sorter.order === 'ascending' })
    .range(from, to)

  const { data, error, count } = await request
  assertError(error)
  return { rows: data || [], total: count || 0 }
}

export function fetchCustomers(params) {
  return basicPagedQuery('base_customers', params, {
    searchColumns: ['code', 'name', 'short_name', 'contact_name', 'contact_phone'],
    equalFilters: ['customer_level', 'status'],
    defaultSort: 'created_at'
  })
}

export async function saveCustomer(record) {
  const payload = stripEmpty(normalizeNumeric(record, ['payment_term_days', 'credit_limit', 'credit_used']), [
    'short_name', 'tax_no', 'contact_name', 'contact_phone', 'contact_email', 'fax', 'province', 'city', 'district', 'address', 'postal_code',
    'bank_name', 'bank_account_name', 'bank_account_no', 'salesperson_user_id', 'remark'
  ])
  delete payload.id
  const request = record.id
    ? supabase.from('base_customers').update(payload).eq('id', record.id)
    : supabase.from('base_customers').insert(payload)
  const { data, error } = await request.select().single()
  assertError(error)
  return data
}

export async function deleteCustomer(id) {
  const { error } = await supabase.from('base_customers').delete().eq('id', id)
  assertError(error)
}

export function fetchSuppliers(params) {
  return basicPagedQuery('base_suppliers', params, {
    searchColumns: ['code', 'name', 'short_name', 'contact_name', 'contact_phone'],
    equalFilters: ['supplier_level', 'status'],
    defaultSort: 'created_at'
  })
}

export async function saveSupplier(record) {
  const payload = stripEmpty(normalizeNumeric(record, ['payment_term_days', 'credit_limit']), [
    'short_name', 'tax_no', 'contact_name', 'contact_phone', 'contact_email', 'fax', 'province', 'city', 'district', 'address', 'postal_code',
    'bank_name', 'bank_account_name', 'bank_account_no', 'purchaser_user_id', 'remark'
  ])
  delete payload.id
  const request = record.id
    ? supabase.from('base_suppliers').update(payload).eq('id', record.id)
    : supabase.from('base_suppliers').insert(payload)
  const { data, error } = await request.select().single()
  assertError(error)
  return data
}

export async function deleteSupplier(id) {
  const { error } = await supabase.from('base_suppliers').delete().eq('id', id)
  assertError(error)
}

export function fetchWarehouses(params) {
  return basicPagedQuery('base_warehouses', params, {
    searchColumns: ['code', 'name', 'contact_name', 'contact_phone'],
    equalFilters: ['warehouse_type', 'status'],
    defaultSort: 'created_at'
  })
}

export async function fetchAllWarehouses({ activeOnly = false } = {}) {
  let request = supabase.from('base_warehouses').select('*').order('code')
  if (activeOnly) request = request.eq('status', 'active')
  const { data, error } = await request
  assertError(error)
  return data || []
}

export async function saveWarehouse(record) {
  const payload = stripEmpty(record, ['manager_user_id', 'contact_name', 'contact_phone', 'province', 'city', 'district', 'address', 'remark'])
  delete payload.id
  const request = record.id
    ? supabase.from('base_warehouses').update(payload).eq('id', record.id)
    : supabase.from('base_warehouses').insert(payload)
  const { data, error } = await request.select().single()
  assertError(error)
  return data
}

export async function deleteWarehouse(id) {
  const { error } = await supabase.from('base_warehouses').delete().eq('id', id)
  assertError(error)
}

export async function fetchWarehouseLocations(warehouseId) {
  const { data, error } = await supabase
    .from('base_warehouse_locations')
    .select('*')
    .eq('warehouse_id', warehouseId)
    .order('code')
  assertError(error)
  return data || []
}

export async function saveWarehouseLocation(record) {
  const payload = stripEmpty(normalizeNumeric(record, ['capacity_qty']), [
    'zone_code', 'aisle_code', 'shelf_code', 'bin_code', 'capacity_qty', 'remark'
  ])
  delete payload.id
  const request = record.id
    ? supabase.from('base_warehouse_locations').update(payload).eq('id', record.id)
    : supabase.from('base_warehouse_locations').insert(payload)
  const { data, error } = await request.select().single()
  assertError(error)
  return data
}

export async function deleteWarehouseLocation(id) {
  const { error } = await supabase.from('base_warehouse_locations').delete().eq('id', id)
  assertError(error)
}

export async function fetchProductCategories({ activeOnly = false } = {}) {
  let request = supabase.from('base_product_categories').select('*').order('sort_order').order('code')
  if (activeOnly) request = request.eq('status', 'active')
  const { data, error } = await request
  assertError(error)
  return data || []
}

export async function saveProductCategory(record) {
  const payload = stripEmpty(record, ['parent_id', 'icon', 'remark'])
  delete payload.id
  const request = record.id
    ? supabase.from('base_product_categories').update(payload).eq('id', record.id)
    : supabase.from('base_product_categories').insert(payload)
  const { data, error } = await request.select().single()
  assertError(error)
  return data
}

export async function deleteProductCategory(id) {
  const { error } = await supabase.from('base_product_categories').delete().eq('id', id)
  assertError(error)
}

export async function batchUpdateCategoryOrder(records) {
  const results = await Promise.all(
    records.map((item) =>
      supabase
        .from('base_product_categories')
        .update({ parent_id: item.parent_id || null, sort_order: item.sort_order })
        .eq('id', item.id)
    )
  )
  const failure = results.find((item) => item.error)
  assertError(failure?.error)
}

export async function fetchProductUnits({ activeOnly = false } = {}) {
  let request = supabase.from('base_product_units').select('*').order('code')
  if (activeOnly) request = request.eq('status', 'active')
  const { data, error } = await request
  assertError(error)
  return data || []
}

export async function saveProductUnit(record) {
  const payload = normalizeNumeric(record, ['decimal_places'])
  delete payload.id
  const request = record.id
    ? supabase.from('base_product_units').update(payload).eq('id', record.id)
    : supabase.from('base_product_units').insert(payload)
  const { data, error } = await request.select().single()
  assertError(error)
  return data
}

export async function deleteProductUnit(id) {
  const { error } = await supabase.from('base_product_units').delete().eq('id', id)
  assertError(error)
}

export function fetchProducts(params) {
  return basicPagedQuery('base_products', params, {
    select: `
      *,
      category:base_product_categories!base_products_category_id_fkey ( id, code, name ),
      unit:base_product_units!base_products_base_unit_id_fkey ( id, code, name )
    `,
    searchColumns: ['code', 'name', 'short_name', 'primary_barcode', 'brand', 'model'],
    equalFilters: ['category_id', 'status'],
    defaultSort: 'created_at'
  })
}

export async function fetchProduct(id) {
  const { data, error } = await supabase
    .from('base_products')
    .select(`
      *,
      product_barcodes:base_product_barcodes (
        id, product_id, unit_id, barcode, conversion_rate, is_primary, status, remark,
        unit:base_product_units!base_product_barcodes_unit_id_fkey ( id, code, name )
      )
    `)
    .eq('id', id)
    .single()
  assertError(error)
  return data
}

function buildProductPayload(record) {
  const numericFields = [
    'shelf_life_days', 'purchase_price', 'sale_price', 'min_sale_price', 'tax_rate', 'safety_stock', 'min_stock', 'max_stock', 'net_weight', 'gross_weight'
  ]
  const payload = stripEmpty(normalizeNumeric(record, numericFields), [
    'short_name', 'category_id', 'brand', 'model', 'specification', 'origin', 'primary_barcode', 'image_path', 'remark'
  ])
  payload.sku_attributes = payload.sku_attributes || {}
  payload.extra = payload.extra || {}
  delete payload.id
  delete payload.product_barcodes
  delete payload.image_url
  return payload
}

export async function saveProduct(record) {
  const payload = buildProductPayload(record)
  const request = record.id
    ? supabase.from('base_products').update(payload).eq('id', record.id)
    : supabase.from('base_products').insert(payload)
  const { data, error } = await request.select().single()
  assertError(error)
  return data
}

export async function deleteProduct(id) {
  const { error } = await supabase.from('base_products').delete().eq('id', id)
  assertError(error)
}

export async function saveProductBarcode(record) {
  const payload = normalizeNumeric(record, ['conversion_rate'])
  delete payload.id
  const request = record.id
    ? supabase.from('base_product_barcodes').update(payload).eq('id', record.id)
    : supabase.from('base_product_barcodes').insert(payload)
  const { data, error } = await request.select().single()
  assertError(error)
  return data
}

export async function deleteProductBarcode(id) {
  const { error } = await supabase.from('base_product_barcodes').delete().eq('id', id)
  assertError(error)
}

export async function syncProductBarcodes(productId, rows = []) {
  const jobs = []
  const normalized = rows
    .filter((item) => item.barcode)
    .map((item) => ({
      ...item,
      product_id: productId,
      conversion_rate: Number(item.conversion_rate || 1),
      is_primary: Boolean(item.is_primary),
      status: item.status || 'active'
    }))

  const preferredPrimaryIndex = normalized.findIndex((item) => item.is_primary)
  normalized.forEach((item, index) => {
    item.is_primary = normalized.length > 0 && index === (preferredPrimaryIndex >= 0 ? preferredPrimaryIndex : 0)
  })

  for (const item of normalized) {
    if (item.id) jobs.push(saveProductBarcode(item))
    else jobs.push(saveProductBarcode(item))
  }
  await Promise.all(jobs)

  const primary = normalized.find((item) => item.is_primary) || normalized[0]
  const { error } = await supabase
    .from('base_products')
    .update({ primary_barcode: primary?.barcode || null })
    .eq('id', productId)
  assertError(error)
}

export async function uploadProductImage(productId, file) {
  const extension = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const fileName = `${Date.now()}-${crypto.randomUUID()}.${extension}`
  const path = `products/${productId}/${fileName}`
  const { error } = await supabase.storage.from('erp-files').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type
  })
  assertError(error)
  return path
}

export async function getSignedFileUrl(path, expiresIn = 3600) {
  if (!path) return ''
  const { data, error } = await supabase.storage.from('erp-files').createSignedUrl(path, expiresIn)
  assertError(error)
  return data?.signedUrl || ''
}

export async function deleteStorageFile(path) {
  if (!path) return
  const { error } = await supabase.storage.from('erp-files').remove([path])
  assertError(error)
}

export async function importProducts(rows, { categories = [], units = [] } = {}) {
  const categoryByCode = new Map(categories.map((item) => [item.code, item.id]))
  const unitByCode = new Map(units.map((item) => [item.code, item.id]))
  const errors = []
  const records = []

  rows.forEach((row, index) => {
    const line = index + 2
    const code = String(row['商品编码'] || row.code || '').trim()
    const name = String(row['商品名称'] || row.name || '').trim()
    const unitCode = String(row['单位编码'] || row.unit_code || '').trim()
    const categoryCode = String(row['分类编码'] || row.category_code || '').trim()

    if (!code || !name || !unitCode) {
      errors.push(`第 ${line} 行：商品编码、商品名称、单位编码为必填项`)
      return
    }
    if (!unitByCode.has(unitCode)) {
      errors.push(`第 ${line} 行：未找到单位编码「${unitCode}」`)
      return
    }
    if (categoryCode && !categoryByCode.has(categoryCode)) {
      errors.push(`第 ${line} 行：未找到分类编码「${categoryCode}」`)
      return
    }

    records.push({
      code,
      name,
      short_name: String(row['商品简称'] || '').trim() || null,
      category_id: categoryCode ? categoryByCode.get(categoryCode) : null,
      base_unit_id: unitByCode.get(unitCode),
      brand: String(row['品牌'] || '').trim() || null,
      model: String(row['型号'] || '').trim() || null,
      specification: String(row['规格'] || '').trim() || null,
      primary_barcode: String(row['主条码'] || '').trim() || null,
      purchase_price: Number(row['采购价'] || 0),
      sale_price: Number(row['销售价'] || 0),
      min_sale_price: Number(row['最低售价'] || 0),
      tax_rate: Number(row['税率'] || 0),
      safety_stock: Number(row['安全库存'] || 0),
      min_stock: Number(row['最低库存'] || 0),
      max_stock: row['最高库存'] === '' || row['最高库存'] === undefined ? null : Number(row['最高库存']),
      status: String(row['状态'] || 'active').trim() || 'active',
      remark: String(row['备注'] || '').trim() || null
    })
  })

  if (errors.length) return { success: 0, errors }
  if (!records.length) return { success: 0, errors: ['Excel 中没有可导入的有效商品'] }

  const { data, error } = await supabase.from('base_products').upsert(records, { onConflict: 'code' }).select('id, code')
  assertError(error)
  return { success: data?.length || 0, errors: [] }
}
