import { supabase } from '@/utils/supabase'
import { assertError, cleanSearch, getRange, nextDocumentNo, toDateString } from '@/api/business'

function hasValue(value) {
  return value !== undefined && value !== null && value !== ''
}

function amount(value) {
  const number = Number(value)
  return Number.isFinite(number) ? Number(number.toFixed(2)) : 0
}

function financePageQuery(table, select, params = {}, config = {}) {
  return (async () => {
    const { page = 1, pageSize = 20, query = {}, sorter = {} } = params
    const [from, to] = getRange(page, pageSize)
    let request = supabase.from(table).select(select, { count: 'exact' })
    const keyword = cleanSearch(query.keyword)
    if (keyword && config.searchColumns?.length) {
      request = request.or(config.searchColumns.map((field) => `${field}.ilike.%${keyword}%`).join(','))
    }
    for (const field of config.filters || []) {
      if (hasValue(query[field])) request = request.eq(field, query[field])
    }
    if (Array.isArray(query.date_range) && query.date_range.length === 2 && config.dateField) {
      request = request.gte(config.dateField, query.date_range[0]).lte(config.dateField, query.date_range[1])
    }
    request = request
      .order(sorter.prop || config.defaultSort || 'created_at', { ascending: sorter.order === 'ascending' })
      .range(from, to)
    const { data, error, count } = await request
    assertError(error)
    return { rows: data || [], total: count || 0 }
  })()
}

export function fetchReceivables(params) {
  return financePageQuery(
    'fin_receivables',
    '*, customer:base_customers!fin_receivables_customer_id_fkey(id, code, name, customer_level)',
    params,
    { searchColumns: ['receivable_no', 'source_no', 'remark'], filters: ['customer_id', 'status'], dateField: 'bill_date', defaultSort: 'bill_date' }
  )
}

export function fetchPayables(params) {
  return financePageQuery(
    'fin_payables',
    '*, supplier:base_suppliers!fin_payables_supplier_id_fkey(id, code, name, supplier_level)',
    params,
    { searchColumns: ['payable_no', 'source_no', 'remark'], filters: ['supplier_id', 'status'], dateField: 'bill_date', defaultSort: 'bill_date' }
  )
}

export function fetchReceiptVouchers(params) {
  return financePageQuery(
    'fin_receipts',
    '*, customer:base_customers!fin_receipts_customer_id_fkey(id, code, name, customer_level)',
    params,
    { searchColumns: ['receipt_no', 'transaction_ref_no', 'remark'], filters: ['customer_id', 'status', 'receipt_method'], dateField: 'receipt_date', defaultSort: 'receipt_date' }
  )
}

export function fetchPaymentVouchers(params) {
  return financePageQuery(
    'fin_payments',
    '*, supplier:base_suppliers!fin_payments_supplier_id_fkey(id, code, name, supplier_level)',
    params,
    { searchColumns: ['payment_no', 'transaction_ref_no', 'remark'], filters: ['supplier_id', 'status', 'payment_method'], dateField: 'payment_date', defaultSort: 'payment_date' }
  )
}

export function fetchExpenses(params) {
  return financePageQuery(
    'fin_expenses',
    '*, applicant:sys_users!fin_expenses_applicant_user_id_fkey(id, user_name, display_name)',
    params,
    { searchColumns: ['expense_no', 'expense_category', 'payee_name', 'department_name', 'remark'], filters: ['status', 'expense_category', 'payment_method'], dateField: 'expense_date', defaultSort: 'expense_date' }
  )
}

export async function fetchOpenReceivables(customerId) {
  if (!customerId) return []
  const { data, error } = await supabase
    .from('fin_receivables')
    .select('id, receivable_no, source_no, bill_date, due_date, original_amount, received_amount, outstanding_amount, status, remark')
    .eq('customer_id', customerId)
    .in('status', ['open', 'partial', 'overdue'])
    .gt('outstanding_amount', 0)
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('bill_date', { ascending: true })
  assertError(error, '加载待核销应收失败')
  return data || []
}

export async function fetchOpenPayables(supplierId) {
  if (!supplierId) return []
  const { data, error } = await supabase
    .from('fin_payables')
    .select('id, payable_no, source_no, bill_date, due_date, original_amount, paid_amount, outstanding_amount, status, remark')
    .eq('supplier_id', supplierId)
    .in('status', ['open', 'partial', 'overdue'])
    .gt('outstanding_amount', 0)
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('bill_date', { ascending: true })
  assertError(error, '加载待核销应付失败')
  return data || []
}

function normalizeAllocations(rows = [], idKey) {
  return (rows || [])
    .map((row) => ({ [idKey]: row[idKey], amount: amount(row.amount ?? row.allocate_amount) }))
    .filter((row) => row[idKey] && row.amount > 0)
}

export async function saveReceiptVoucher(record) {
  if (!record.customer_id) throw new Error('请选择客户')
  const allocations = normalizeAllocations(record.allocations, 'receivable_id')
  const total = amount(record.amount)
  const allocated = amount(allocations.reduce((sum, item) => sum + item.amount, 0))
  if (total <= 0) throw new Error('收款金额必须大于 0')
  if (allocated > total) throw new Error('核销金额不能大于收款金额')

  const payload = {
    customer_id: record.customer_id,
    receipt_date: record.receipt_date || toDateString(),
    receipt_method: record.receipt_method || 'bank_transfer',
    bank_account: record.bank_account || null,
    transaction_ref_no: record.transaction_ref_no || null,
    amount: total,
    allocated_amount: allocated,
    unallocated_amount: amount(total - allocated),
    allocations,
    remark: record.remark || null,
    status: record.status || 'draft'
  }

  if (record.id) {
    const { error } = await supabase.from('fin_receipts').update(payload).eq('id', record.id)
    assertError(error, '更新收款单失败')
    return record.id
  }

  payload.receipt_no = record.receipt_no || await nextDocumentNo('SK', payload.receipt_date)
  const { data, error } = await supabase.from('fin_receipts').insert(payload).select('id').single()
  assertError(error, '创建收款单失败')
  return data.id
}

export async function postReceiptVoucher(id) {
  const { data, error } = await supabase.rpc('erp_post_receipt', { p_receipt_id: id })
  assertError(error, '收款单过账失败')
  return data
}

export async function savePaymentVoucher(record) {
  if (!record.supplier_id) throw new Error('请选择供应商')
  const allocations = normalizeAllocations(record.allocations, 'payable_id')
  const total = amount(record.amount)
  const allocated = amount(allocations.reduce((sum, item) => sum + item.amount, 0))
  if (total <= 0) throw new Error('付款金额必须大于 0')
  if (allocated > total) throw new Error('核销金额不能大于付款金额')

  const payload = {
    supplier_id: record.supplier_id,
    payment_date: record.payment_date || toDateString(),
    payment_method: record.payment_method || 'bank_transfer',
    bank_account: record.bank_account || null,
    transaction_ref_no: record.transaction_ref_no || null,
    amount: total,
    allocated_amount: allocated,
    unallocated_amount: amount(total - allocated),
    allocations,
    remark: record.remark || null,
    status: record.status || 'draft'
  }

  if (record.id) {
    const { error } = await supabase.from('fin_payments').update(payload).eq('id', record.id)
    assertError(error, '更新付款单失败')
    return record.id
  }

  payload.payment_no = record.payment_no || await nextDocumentNo('FK', payload.payment_date)
  const { data, error } = await supabase.from('fin_payments').insert(payload).select('id').single()
  assertError(error, '创建付款单失败')
  return data.id
}

export async function postPaymentVoucher(id) {
  const { data, error } = await supabase.rpc('erp_post_payment', { p_payment_id: id })
  assertError(error, '付款单过账失败')
  return data
}

export async function saveExpense(record) {
  const total = amount(record.amount)
  const taxRate = Number(record.tax_rate || 0)
  if (!record.expense_category) throw new Error('请选择或填写费用类别')
  if (!record.payee_name) throw new Error('请填写收款方')
  if (total <= 0) throw new Error('费用金额必须大于 0')
  if (taxRate < 0 || taxRate > 100) throw new Error('税率必须在 0 到 100 之间')

  const amountExclTax = amount(total / (1 + taxRate / 100))
  const taxAmount = amount(total - amountExclTax)
  const payload = {
    expense_date: record.expense_date || toDateString(),
    expense_category: record.expense_category,
    department_name: record.department_name || null,
    payee_name: record.payee_name,
    amount: total,
    tax_rate: taxRate,
    tax_amount: taxAmount,
    amount_excl_tax: amountExclTax,
    payment_method: record.payment_method || null,
    remark: record.remark || null,
    status: record.status || 'draft'
  }

  if (record.id) {
    const { error } = await supabase.from('fin_expenses').update(payload).eq('id', record.id)
    assertError(error, '更新费用单失败')
    return record.id
  }

  payload.expense_no = record.expense_no || await nextDocumentNo('FY', payload.expense_date)
  const { data, error } = await supabase.from('fin_expenses').insert(payload).select('id').single()
  assertError(error, '创建费用单失败')
  return data.id
}

export async function postExpense(id) {
  const { data, error } = await supabase.rpc('erp_post_expense', { p_expense_id: id })
  assertError(error, '费用单过账失败')
  return data
}

export async function getFinanceOverview({ dateRange = [] } = {}) {
  let receiptRequest = supabase.from('fin_receipts').select('amount, allocated_amount, receipt_date, status').eq('status', 'posted')
  let paymentRequest = supabase.from('fin_payments').select('amount, allocated_amount, payment_date, status').eq('status', 'posted')
  let expenseRequest = supabase.from('fin_expenses').select('amount, expense_date, status').eq('status', 'posted')
  if (Array.isArray(dateRange) && dateRange.length === 2) {
    receiptRequest = receiptRequest.gte('receipt_date', dateRange[0]).lte('receipt_date', dateRange[1])
    paymentRequest = paymentRequest.gte('payment_date', dateRange[0]).lte('payment_date', dateRange[1])
    expenseRequest = expenseRequest.gte('expense_date', dateRange[0]).lte('expense_date', dateRange[1])
  }
  const [receipts, payments, expenses, receivables, payables] = await Promise.all([
    receiptRequest,
    paymentRequest,
    expenseRequest,
    supabase.from('fin_receivables').select('outstanding_amount, status'),
    supabase.from('fin_payables').select('outstanding_amount, status')
  ])
  assertError(receipts.error); assertError(payments.error); assertError(expenses.error); assertError(receivables.error); assertError(payables.error)
  return {
    receivedAmount: (receipts.data || []).reduce((sum, row) => sum + amount(row.amount), 0),
    paidAmount: (payments.data || []).reduce((sum, row) => sum + amount(row.amount), 0),
    expenseAmount: (expenses.data || []).reduce((sum, row) => sum + amount(row.amount), 0),
    receivableBalance: (receivables.data || []).reduce((sum, row) => sum + amount(row.outstanding_amount), 0),
    payableBalance: (payables.data || []).reduce((sum, row) => sum + amount(row.outstanding_amount), 0)
  }
}
