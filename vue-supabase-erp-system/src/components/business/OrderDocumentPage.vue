<template>
  <div class="page-container">
    <SearchBar :model-value="table.query" :fields="searchFields" @update:model-value="updateQuery" @search="table.search" @reset="table.reset" />

    <DataTable
      :data="table.rows" :columns="columns" :loading="table.loading" :pagination="table.pagination" :show-export="true"
      @page-change="table.changePage" @page-size-change="table.changePageSize" @sort-change="table.changeSort" @export="handleExport"
    >
      <template #toolbar>
        <el-button type="primary" :icon="Plus" @click="openCreate">新增{{ config.title }}</el-button>
      </template>
      <template #cell-counterpart="{ row }">{{ isPurchase ? row.supplier?.name : row.customer?.name || '-' }}</template>
      <template #cell-warehouse="{ row }">{{ row.warehouse?.name || '-' }}</template>
      <template #cell-total_amount="{ row }">{{ formatCurrency(row.total_amount) }}</template>
      <template #cell-credit="{ row }"><el-tag :type="creditType(row.credit_check_status)">{{ creditText(row.credit_check_status) }}</el-tag></template>
      <template #cell-status="{ row }"><el-tag :type="statusTagType(row.status)">{{ statusLabel(row.status) }}</el-tag></template>
      <template #cell-actions="{ row }">
        <el-button link type="primary" @click="openEdit(row, row.status !== 'draft' && row.status !== 'rejected')">{{ row.status === 'draft' || row.status === 'rejected' ? '编辑' : '详情' }}</el-button>
        <el-button v-if="row.status === 'draft' || row.status === 'rejected'" link type="warning" @click="changeStatus(row, 'submitted')">提交</el-button>
        <el-button v-if="row.status === 'submitted' || row.status === 'under_review'" link type="success" @click="approve(row)">审核</el-button>
        <el-button link @click="printOrder(row)">打印</el-button>
      </template>
    </DataTable>

    <el-dialog v-model="dialog.visible" :title="dialog.readonly ? `${config.title}详情` : (form.id ? `编辑${config.title}` : `新增${config.title}`)" width="1180px" top="4vh" :close-on-click-modal="false" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="108px" :disabled="dialog.readonly">
        <el-alert v-if="!isPurchase && credit.message" :title="credit.message" :type="credit.passed ? (credit.level === 'warning' ? 'warning' : 'success') : 'error'" :closable="false" show-icon class="order-alert" />
        <el-row :gutter="18">
          <el-col :span="8"><el-form-item :label="config.counterpartLabel" prop="counterpart_id"><el-select v-model="form.counterpart_id" filterable clearable style="width:100%" @change="onCounterpartChange"><el-option v-for="item in counterparts" :key="item.id" :label="`${item.code} · ${item.name}`" :value="item.id" /></el-select></el-form-item></el-col>
          <el-col :span="8"><el-form-item :label="isPurchase ? '收货仓库' : '发货仓库'" :prop="isPurchase ? 'warehouse_id' : ''"><el-select v-model="form.warehouse_id" filterable clearable style="width:100%"><el-option v-for="item in options.warehouses" :key="item.id" :label="`${item.code} · ${item.name}`" :value="item.id" /></el-select></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="单据日期" prop="order_date"><el-date-picker v-model="form.order_date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item :label="isPurchase ? '预计到货' : '预计交货'"><el-date-picker v-model="form.delivery_target_date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="含税方式"><el-switch v-model="form.is_tax_included" active-text="含税价" inactive-text="未税价" @change="recalculate" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="默认税率"><el-input-number v-model="form.tax_rate" :min="0" :max="100" :precision="2" controls-position="right" @change="recalculate" /></el-form-item></el-col>
          <el-col v-if="!isPurchase" :span="8"><el-form-item label="订单来源"><el-select v-model="form.source_type" style="width:100%"><el-option label="手工录入" value="manual" /><el-option label="线上商城" value="online" /><el-option label="电话/微信" value="phone" /><el-option label="线下门店" value="offline" /></el-select></el-form-item></el-col>
          <el-col :span="isPurchase ? 24 : 16"><el-form-item label="备注"><el-input v-model="form.remark" maxlength="500" show-word-limit /></el-form-item></el-col>
        </el-row>

        <el-divider content-position="left">商品明细</el-divider>
        <OrderLineEditor v-model="form.items" :warehouse-id="form.warehouse_id" :price-field="isPurchase ? 'purchase_price' : 'sale_price'" :default-tax-rate="Number(form.tax_rate || 0)" :is-tax-included="form.is_tax_included" :show-stock="!isPurchase" @change="onLinesChange" />

        <el-divider content-position="left">附件</el-divider>
        <AttachmentUploader v-model="form.attachment_paths" :module="isPurchase ? 'purchase-orders' : 'sales-orders'" />
      </el-form>
      <template #footer>
        <el-button @click="dialog.visible = false">{{ dialog.readonly ? '关闭' : '取消' }}</el-button>
        <el-button v-if="!dialog.readonly" type="primary" :loading="dialog.saving" @click="saveDraft">保存草稿</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="reviewDialog.visible" title="审核单据" width="480px" append-to-body>
      <el-form label-width="80px"><el-form-item label="审核结果"><el-radio-group v-model="reviewDialog.status"><el-radio value="approved">通过</el-radio><el-radio value="rejected">驳回</el-radio></el-radio-group></el-form-item><el-form-item label="审核意见"><el-input v-model="reviewDialog.comment" type="textarea" :rows="3" /></el-form-item></el-form>
      <template #footer><el-button @click="reviewDialog.visible=false">取消</el-button><el-button type="primary" @click="submitReview">确定</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import SearchBar from '@/components/common/SearchBar.vue'
import DataTable from '@/components/common/DataTable.vue'
import OrderLineEditor from '@/components/business/OrderLineEditor.vue'
import AttachmentUploader from '@/components/business/AttachmentUploader.vue'
import { useTable } from '@/composables/useTable'
import { fetchAllOptions, computeOrderTotals, toDateString } from '@/api/business'
import { fetchPurchaseOrders, getPurchaseOrder, savePurchaseOrder, updatePurchaseOrderStatus } from '@/api/purchase'
import { checkCustomerCredit, fetchSalesOrders, getSalesOrder, saveSalesOrder, updateSalesOrderStatus } from '@/api/sales'
import { formatCurrency, statusLabel, statusTagType } from '@/utils/format'

const props = defineProps({ type: { type: String, required: true } })
const isPurchase = computed(() => props.type === 'purchase')
const config = computed(() => isPurchase.value
  ? { title: '采购订单', counterpartLabel: '供应商', dateLabel: '采购日期' }
  : { title: '销售订单', counterpartLabel: '客户', dateLabel: '订单日期' })
const fetcher = computed(() => isPurchase.value ? fetchPurchaseOrders : fetchSalesOrders)
const table = useTable((params) => fetcher.value(params), { initialQuery: { keyword: '', status: '', counterpart_id: '', warehouse_id: '', source_type: '', date_range: [] }, defaultSort: { prop: 'order_date', order: 'descending' } })
const options = reactive({ customers: [], suppliers: [], warehouses: [] })
const dialog = reactive({ visible: false, readonly: false, saving: false })
const reviewDialog = reactive({ visible: false, row: null, status: 'approved', comment: '' })
const formRef = ref(null)
const form = reactive(emptyForm())
const credit = reactive({ passed: true, level: 'not_checked', message: '' })

const counterparts = computed(() => isPurchase.value ? options.suppliers : options.customers)
const searchFields = computed(() => [
  { key: 'keyword', label: '单据号', placeholder: '单据号、来源单号或备注', width: '240px' },
  { key: 'status', label: '状态', type: 'select', width: '145px', options: statuses() },
  { key: 'warehouse_id', label: '仓库', type: 'select', width: '180px', options: options.warehouses.map((item) => ({ label: item.name, value: item.id })) },
  { key: 'date_range', label: '日期', type: 'daterange', width: '260px' }
])
const columns = computed(() => [
  { prop: 'order_no', label: '单据编号', width: 170 },
  { prop: 'counterpart', label: config.value.counterpartLabel, minWidth: 180, slot: 'cell-counterpart' },
  { prop: 'warehouse', label: '仓库', minWidth: 150, slot: 'cell-warehouse' },
  { prop: 'order_date', label: config.value.dateLabel, width: 120 },
  { prop: 'total_qty', label: '数量', width: 105, align: 'right' },
  { prop: 'total_amount', label: '含税金额', width: 145, align: 'right', slot: 'cell-total_amount' },
  ...(!isPurchase.value ? [{ prop: 'credit', label: '信用', width: 110, slot: 'cell-credit' }] : []),
  { prop: 'status', label: '状态', width: 110, align: 'center', slot: 'cell-status' },
  { prop: 'actions', label: '操作', width: 235, fixed: 'right', slot: 'cell-actions', showOverflowTooltip: false, exportable: false }
])
const rules = computed(() => ({ counterpart_id: [{ required: true, message: `请选择${config.value.counterpartLabel}`, trigger: 'change' }], order_date: [{ required: true, message: '请选择单据日期', trigger: 'change' }], ...(isPurchase.value ? { warehouse_id: [{ required: true, message: '请选择仓库', trigger: 'change' }] } : {}) }))

function statuses() { return [{ label: '草稿', value: 'draft' }, { label: '已提交', value: 'submitted' }, { label: '审核中', value: 'under_review' }, { label: '已审核', value: 'approved' }, { label: '部分完成', value: isPurchase.value ? 'partial_received' : 'partial_delivered' }, { label: '已完成', value: 'completed' }, { label: '已驳回', value: 'rejected' }] }
function emptyForm() { return { id: '', order_no: '', counterpart_id: '', warehouse_id: '', order_date: toDateString(), delivery_target_date: '', is_tax_included: true, tax_rate: 0, source_type: 'manual', status: 'draft', remark: '', attachment_paths: [], items: [] } }
function updateQuery(value) { Object.assign(table.query, value); table.query.supplier_id = isPurchase.value ? value.counterpart_id : ''; table.query.customer_id = isPurchase.value ? '' : value.counterpart_id }
function resetForm() { Object.assign(form, emptyForm()); Object.assign(credit, { passed: true, level: 'not_checked', message: '' }) }
async function loadOptions() { Object.assign(options, await fetchAllOptions()) }
function openCreate() { resetForm(); dialog.readonly = false; dialog.visible = true }
async function openEdit(row, readonly = false) {
  try {
    const detail = isPurchase.value ? await getPurchaseOrder(row.id) : await getSalesOrder(row.id)
    resetForm()
    Object.assign(form, {
      id: detail.id, order_no: detail.order_no, counterpart_id: isPurchase.value ? detail.supplier_id : detail.customer_id,
      warehouse_id: detail.warehouse_id || '', order_date: detail.order_date, delivery_target_date: isPurchase.value ? detail.expected_arrival_date : detail.delivery_date,
      is_tax_included: detail.is_tax_included, tax_rate: detail.tax_rate, source_type: detail.source_type || 'manual', status: detail.status,
      remark: detail.remark || '', attachment_paths: detail.attachment_paths || [], items: (detail.items || []).map((item) => ({
        ...item, product_code: item.product?.code, product_name: item.product?.name, model: item.product?.model, unit_name: item.unit?.name,
        available_stock: 0
      }))
    })
    dialog.readonly = readonly
    dialog.visible = true
    if (!isPurchase.value) await onLinesChange()
  } catch (error) { ElMessage.error(error.message || '读取单据详情失败') }
}
async function onCounterpartChange() { if (!isPurchase.value) await onLinesChange() }
async function onLinesChange() {
  if (isPurchase.value || !form.counterpart_id) return
  const totals = computeOrderTotals(form.items, form.is_tax_included)
  try { Object.assign(credit, await checkCustomerCredit(form.counterpart_id, totals.total_amount)) } catch (error) { Object.assign(credit, { passed: false, level: 'blocked', message: error.message || '信用校验失败' }) }
}
function recalculate() { form.items = (form.items || []).map((item) => ({ ...item })) ; onLinesChange() }
async function saveDraft() {
  try {
    await formRef.value?.validate()
    dialog.saving = true
    const payload = {
      ...form,
      supplier_id: isPurchase.value ? form.counterpart_id : undefined,
      customer_id: !isPurchase.value ? form.counterpart_id : undefined,
      expected_arrival_date: isPurchase.value ? form.delivery_target_date || null : undefined,
      delivery_date: !isPurchase.value ? form.delivery_target_date || null : undefined
    }
    const result = isPurchase.value ? await savePurchaseOrder(payload) : await saveSalesOrder(payload)
    ElMessage.success(`${config.value.title}已保存`)
    dialog.visible = false
    await table.load()
    return result
  } catch (error) { if (error?.message) ElMessage.error(error.message || '保存失败') } finally { dialog.saving = false }
}
async function changeStatus(row, status) {
  try {
    await ElMessageBox.confirm(`确认将 ${row.order_no} 提交审核吗？`, '提交审核', { type: 'warning' })
    if (isPurchase.value) await updatePurchaseOrderStatus(row.id, status)
    else await updateSalesOrderStatus(row.id, status)
    ElMessage.success('已提交审核'); await table.load()
  } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(error.message || '提交失败') }
}
function approve(row) { Object.assign(reviewDialog, { visible: true, row, status: 'approved', comment: '' }) }
async function submitReview() {
  try {
    if (isPurchase.value) await updatePurchaseOrderStatus(reviewDialog.row.id, reviewDialog.status, reviewDialog.comment)
    else await updateSalesOrderStatus(reviewDialog.row.id, reviewDialog.status, reviewDialog.comment)
    ElMessage.success('审核结果已保存'); reviewDialog.visible = false; await table.load()
  } catch (error) { ElMessage.error(error.message || '审核失败') }
}
function creditType(value) { return ({ passed: 'success', warning: 'warning', blocked: 'danger' })[value] || 'info' }
function creditText(value) { return ({ passed: '通过', warning: '预警', blocked: '拦截', not_checked: '未校验' })[value] || '-' }
function printOrder(row) {
  const counterpart = isPurchase.value ? row.supplier?.name : row.customer?.name
  const page = window.open('', '_blank')
  if (!page) return ElMessage.warning('浏览器拦截了打印窗口，请允许弹窗后重试')
  page.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${row.order_no}</title><style>body{font-family:Arial,"Microsoft YaHei";padding:36px;color:#222}h1{font-size:22px}table{width:100%;border-collapse:collapse;margin-top:18px}td,th{border:1px solid #333;padding:8px;text-align:left}.right{text-align:right}</style></head><body><h1>${config.value.title}</h1><p>单据编号：${row.order_no}</p><p>${config.value.counterpartLabel}：${counterpart || '-'}</p><p>日期：${row.order_date || '-'}</p><table><tr><th>数量</th><th>含税金额</th><th>状态</th></tr><tr><td>${row.total_qty || 0}</td><td>${formatCurrency(row.total_amount)}</td><td>${statusLabel(row.status)}</td></tr></table><scr' + 'ipt>window.onload=()=>window.print()</scr' + 'ipt></body></html>`)
  page.document.close()
}
function handleExport({ columns }) { table.exportExcel({ filename: `${config.value.title}_${toDateString()}.xlsx`, columns }) }
onMounted(async () => { try { await loadOptions(); await table.load() } catch (error) { ElMessage.error(error.message || '加载页面数据失败') } })
</script>

<style scoped>
.order-alert { margin-bottom: 16px; }
</style>
