<template>
  <div class="page-container">
    <SearchBar :model-value="table.query" :fields="searchFields" @update:model-value="updateQuery" @search="table.search" @reset="table.reset" />
    <DataTable :data="table.rows" :columns="columns" :loading="table.loading" :pagination="table.pagination" :show-export="true" @page-change="table.changePage" @page-size-change="table.changePageSize" @sort-change="table.changeSort" @export="handleExport">
      <template #toolbar><el-button type="primary" :icon="Plus" @click="openCreate">新建{{ config.title }}</el-button></template>
      <template #cell-counterpart="{ row }">{{ isPurchase ? row.supplier?.name : row.customer?.name || '-' }}</template>
      <template #cell-warehouse="{ row }">{{ row.warehouse?.name || '-' }}</template>
      <template #cell-amount="{ row }">{{ formatCurrency(row.total_amount) }}</template>
      <template #cell-status="{ row }"><el-tag :type="statusTagType(row.status)">{{ statusLabel(row.status) }}</el-tag></template>
      <template #cell-actions="{ row }"><el-button link type="primary" @click="openEdit(row, row.status === 'posted')">{{ row.status === 'draft' ? '编辑' : '详情' }}</el-button><el-button v-if="row.status !== 'posted' && row.status !== 'cancelled'" link type="success" @click="post(row)">审核并过账</el-button></template>
    </DataTable>

    <el-dialog v-model="dialog.visible" :title="dialog.readonly ? `${config.title}详情` : (form.id ? `编辑${config.title}` : `新建${config.title}`)" width="1120px" top="5vh" :close-on-click-modal="false" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="108px" :disabled="dialog.readonly">
        <el-row :gutter="18">
          <el-col :span="8"><el-form-item :label="config.sourceLabel" prop="source_id"><el-select v-model="form.source_id" filterable clearable style="width:100%" @change="loadSource"><el-option v-for="item in sourceDocuments" :key="item.id" :label="item[config.sourceNoField]" :value="item.id" /></el-select></el-form-item></el-col>
          <el-col :span="8"><el-form-item :label="config.counterpartLabel"><el-input :model-value="form.counterpart_name" disabled /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="仓库"><el-select v-model="form.warehouse_id" filterable style="width:100%" @change="loadLocations"><el-option v-for="item in options.warehouses" :key="item.id" :label="`${item.code} · ${item.name}`" :value="item.id" /></el-select></el-form-item></el-col>
          <el-col :span="8"><el-form-item :label="config.dateLabel"><el-date-picker v-model="form.document_date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
          <template v-if="!isPurchase">
            <el-col :span="8"><el-form-item label="收货人"><el-input v-model="form.receiver_name" /></el-form-item></el-col>
            <el-col :span="8"><el-form-item label="联系电话"><el-input v-model="form.receiver_phone" /></el-form-item></el-col>
            <el-col :span="12"><el-form-item label="收货地址"><el-input v-model="form.receiver_address" /></el-form-item></el-col>
            <el-col :span="6"><el-form-item label="物流公司"><el-input v-model="form.logistics_company" /></el-form-item></el-col>
            <el-col :span="6"><el-form-item label="物流单号"><el-input v-model="form.tracking_no" /></el-form-item></el-col>
          </template>
          <el-col :span="24"><el-form-item label="备注"><el-input v-model="form.remark" /></el-form-item></el-col>
        </el-row>
        <el-divider content-position="left">{{ config.lineTitle }}</el-divider>
        <el-table :data="form.items" border stripe max-height="370">
          <el-table-column type="index" label="#" width="52" align="center" />
          <el-table-column label="商品" min-width="220"><template #default="{ row }"><b>{{ row.product_name }}</b><small class="doc-sub">{{ row.product_code }}{{ row.model ? ` · ${row.model}` : '' }}</small></template></el-table-column>
          <el-table-column label="单位" width="88"><template #default="{ row }">{{ row.unit_name }}</template></el-table-column>
          <el-table-column label="本次数量" width="145"><template #default="{ row }"><el-input-number v-model="row.qty" :min="0.000001" :max="row.max_qty || undefined" :precision="6" controls-position="right" @change="calc" /></template></el-table-column>
          <el-table-column label="库位" min-width="150"><template #default="{ row }"><el-select v-model="row.location_id" clearable filterable style="width:100%"><el-option v-for="item in locations" :key="item.id" :label="`${item.code} · ${item.name}`" :value="item.id" /></el-select></template></el-table-column>
          <el-table-column label="批次" width="145"><template #default="{ row }"><el-input v-model="row.batch_no" /></template></el-table-column>
          <el-table-column v-if="isPurchase" label="生产日期" width="142"><template #default="{ row }"><el-date-picker v-model="row.production_date" type="date" value-format="YYYY-MM-DD" /></template></el-table-column>
          <el-table-column v-if="isPurchase" label="失效日期" width="142"><template #default="{ row }"><el-date-picker v-model="row.expiry_date" type="date" value-format="YYYY-MM-DD" /></template></el-table-column>
          <el-table-column label="单价" width="130"><template #default="{ row }"><el-input-number v-model="row.unit_price" :min="0" :precision="4" controls-position="right" @change="calc" /></template></el-table-column>
          <el-table-column label="金额" width="125" align="right"><template #default="{ row }">{{ formatCurrency(row.amount) }}</template></el-table-column>
        </el-table>
        <div class="document-total">合计数量：{{ totalQty }}；合计金额：<b>{{ formatCurrency(totalAmount) }}</b></div>
        <el-divider content-position="left">附件</el-divider><AttachmentUploader v-model="form.attachment_paths" :module="isPurchase ? 'purchase-receipts' : 'sales-deliveries'" />
      </el-form>
      <template #footer><el-button @click="dialog.visible=false">{{ dialog.readonly ? '关闭' : '取消' }}</el-button><el-button v-if="!dialog.readonly" type="primary" :loading="dialog.saving" @click="save">保存草稿</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import SearchBar from '@/components/common/SearchBar.vue'
import DataTable from '@/components/common/DataTable.vue'
import AttachmentUploader from '@/components/business/AttachmentUploader.vue'
import { useTable } from '@/composables/useTable'
import { fetchAllOptions, fetchWarehouseLocations, numberValue, toDateString } from '@/api/business'
import { fetchPurchaseReceipts, fetchReceivablePurchaseOrders, getPurchaseReceipt, postPurchaseReceipt, savePurchaseReceipt } from '@/api/purchase'
import { fetchDeliverableSalesOrders, fetchSalesDeliveries, getSalesDelivery, postSalesDelivery, saveSalesDelivery } from '@/api/sales'
import { formatCurrency, statusLabel, statusTagType } from '@/utils/format'

const props = defineProps({ type: { type: String, required: true } })
const isPurchase = computed(() => props.type === 'purchase')
const config = computed(() => isPurchase.value
  ? { title: '采购收货单', sourceLabel: '采购订单', sourceNoField: 'order_no', counterpartLabel: '供应商', lineTitle: '收货明细', dateLabel: '收货日期' }
  : { title: '销售发货单', sourceLabel: '销售订单', sourceNoField: 'order_no', counterpartLabel: '客户', lineTitle: '发货明细', dateLabel: '发货日期' })
const fetcher = computed(() => isPurchase.value ? fetchPurchaseReceipts : fetchSalesDeliveries)
const table = useTable((params) => fetcher.value(params), { initialQuery: { keyword: '', status: '', warehouse_id: '', date_range: [] }, defaultSort: { prop: isPurchase.value ? 'receipt_date' : 'delivery_date', order: 'descending' } })
const options = reactive({ warehouses: [] })
const sourceDocuments = ref([])
const locations = ref([])
const dialog = reactive({ visible: false, readonly: false, saving: false })
const formRef = ref(null)
const form = reactive(emptyForm())
const totalQty = computed(() => form.items.reduce((sum, item) => sum + numberValue(item.qty), 0))
const totalAmount = computed(() => form.items.reduce((sum, item) => sum + numberValue(item.amount), 0))
const searchFields = computed(() => [
  { key: 'keyword', label: '单据号', placeholder: '单据号、物流单号或备注', width: '250px' },
  { key: 'status', label: '状态', type: 'select', width: '130px', options: [{ label: '草稿', value: 'draft' }, { label: '已提交', value: 'submitted' }, { label: '已审核', value: 'approved' }, { label: '已过账', value: 'posted' }] },
  { key: 'warehouse_id', label: '仓库', type: 'select', width: '170px', options: options.warehouses.map((item) => ({ label: item.name, value: item.id })) },
  { key: 'date_range', label: '日期', type: 'daterange', width: '260px' }
])
const columns = computed(() => [
  { prop: isPurchase.value ? 'receipt_no' : 'delivery_no', label: '单据编号', width: 175 }, { prop: 'counterpart', label: config.value.counterpartLabel, minWidth: 190, slot: 'cell-counterpart' },
  { prop: 'warehouse', label: '仓库', minWidth: 150, slot: 'cell-warehouse' }, { prop: isPurchase.value ? 'receipt_date' : 'delivery_date', label: config.value.dateLabel, width: 120 },
  { prop: 'total_qty', label: '数量', width: 100, align: 'right' }, { prop: 'amount', label: '金额', width: 145, align: 'right', slot: 'cell-amount' },
  { prop: 'status', label: '状态', width: 100, align: 'center', slot: 'cell-status' }, { prop: 'actions', label: '操作', width: 170, fixed: 'right', slot: 'cell-actions', showOverflowTooltip: false, exportable: false }
])
const rules = computed(() => ({ source_id: [{ required: true, message: `请选择${config.value.sourceLabel}`, trigger: 'change' }] }))
function emptyForm() { return { id: '', source_id: '', order_id: '', counterpart_id: '', counterpart_name: '', warehouse_id: '', document_date: toDateString(), receiver_name: '', receiver_phone: '', receiver_address: '', logistics_company: '', tracking_no: '', remark: '', attachment_paths: [], items: [] } }
function updateQuery(value) { Object.assign(table.query, value) }
function calc() { form.items = form.items.map((item) => ({ ...item, amount: Number((numberValue(item.qty) * numberValue(item.unit_price)).toFixed(2)) })) }
async function loadOptions() { const data = await fetchAllOptions(); options.warehouses = data.warehouses }
async function loadSources() { sourceDocuments.value = isPurchase.value ? await fetchReceivablePurchaseOrders() : await fetchDeliverableSalesOrders() }
async function loadLocations() { locations.value = await fetchWarehouseLocations(form.warehouse_id) }
async function loadSource(id) {
  const source = sourceDocuments.value.find((item) => item.id === id)
  if (!source) return
  form.order_id = source.id
  form.counterpart_id = isPurchase.value ? source.supplier_id : source.customer_id
  form.counterpart_name = isPurchase.value ? source.supplier?.name || '' : source.customer?.name || ''
  form.warehouse_id = source.warehouse_id || ''
  await loadLocations()
  form.items = (source.items || []).filter((item) => numberValue(item.qty) > numberValue(isPurchase.value ? item.received_qty : item.delivered_qty)).map((item) => ({
    [isPurchase.value ? 'order_item_id' : 'order_item_id']: item.id, product_id: item.product_id, product_code: item.product?.code || '', product_name: item.product?.name || item.product_name || '', model: item.product?.model || '',
    unit_id: item.unit_id, unit_name: item.unit?.name || '', qty: numberValue(item.qty) - numberValue(isPurchase.value ? item.received_qty : item.delivered_qty),
    max_qty: numberValue(item.qty) - numberValue(isPurchase.value ? item.received_qty : item.delivered_qty), unit_price: numberValue(item.unit_price), amount: 0, batch_no: '', location_id: null,
    production_date: null, expiry_date: null
  }))
  calc()
}
function resetForm() { Object.assign(form, emptyForm()); locations.value = [] }
async function openCreate() { resetForm(); dialog.readonly = false; await loadSources(); dialog.visible = true }
async function openEdit(row, readonly = false) {
  try {
    const detail = isPurchase.value ? await getPurchaseReceipt(row.id) : await getSalesDelivery(row.id)
    resetForm()
    Object.assign(form, {
      id: detail.id, source_id: isPurchase.value ? detail.order_id : detail.order_id, order_id: detail.order_id,
      counterpart_id: isPurchase.value ? detail.supplier_id : detail.customer_id, counterpart_name: isPurchase.value ? detail.supplier?.name || '' : detail.customer?.name || '', warehouse_id: detail.warehouse_id,
      document_date: isPurchase.value ? detail.receipt_date : detail.delivery_date, receiver_name: detail.receiver_name || '', receiver_phone: detail.receiver_phone || '', receiver_address: detail.receiver_address || '', logistics_company: detail.logistics_company || '', tracking_no: detail.tracking_no || '', remark: detail.remark || '', attachment_paths: detail.attachment_paths || [],
      items: (detail.items || []).map((item) => ({ ...item, product_code: item.product?.code, product_name: item.product?.name, model: item.product?.model, unit_name: item.unit?.name }))
    })
    await loadLocations(); dialog.readonly = readonly; dialog.visible = true
  } catch (error) { ElMessage.error(error.message || '加载单据详情失败') }
}
async function save() {
  try {
    await formRef.value?.validate()
    if (!form.items.length) throw new Error('没有可保存的明细行')
    dialog.saving = true
    const payload = isPurchase.value
      ? { ...form, receipt_date: form.document_date, supplier_id: form.counterpart_id, order_id: form.order_id, items: form.items }
      : { ...form, delivery_date: form.document_date, customer_id: form.counterpart_id, order_id: form.order_id, items: form.items }
    if (isPurchase.value) await savePurchaseReceipt(payload); else await saveSalesDelivery(payload)
    ElMessage.success(`${config.value.title}已保存`); dialog.visible = false; await table.load(); await loadSources()
  } catch (error) { if (error?.message) ElMessage.error(error.message || '保存失败') } finally { dialog.saving = false }
}
async function post(row) {
  try {
    await ElMessageBox.confirm(`确认审核并过账 ${isPurchase.value ? row.receipt_no : row.delivery_no} 吗？库存和${isPurchase.value ? '应付' : '应收'}将同步更新。`, '库存过账', { type: 'warning' })
    if (isPurchase.value) await postPurchaseReceipt(row.id); else await postSalesDelivery(row.id)
    ElMessage.success('过账成功'); await table.load(); await loadSources()
  } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(error.message || '过账失败') }
}
function handleExport({ columns }) { table.exportExcel({ filename: `${config.value.title}_${toDateString()}.xlsx`, columns }) }
onMounted(async () => { try { await Promise.all([loadOptions(), loadSources()]); await table.load() } catch (error) { ElMessage.error(error.message || '加载页面失败') } })
</script>

<style scoped>
.document-total { text-align:right; padding:12px; background:#fafafa; color:var(--el-text-color-regular); }
.document-total b { color:var(--el-color-primary); font-size:16px; }
.doc-sub { display:block; color:var(--el-text-color-secondary); margin-top:3px; }
</style>
