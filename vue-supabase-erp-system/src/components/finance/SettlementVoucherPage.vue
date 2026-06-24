<template>
  <div class="page-container">
    <SearchBar :model-value="table.query" :fields="searchFields" @update:model-value="updateQuery" @search="table.search" @reset="table.reset" />
    <DataTable :data="table.rows" :columns="columns" :loading="table.loading" :pagination="table.pagination" :show-export="true" @page-change="table.changePage" @page-size-change="table.changePageSize" @sort-change="table.changeSort" @export="handleExport">
      <template #toolbar><el-button v-permission="[createPermission]" type="primary" :icon="Plus" @click="openCreate">新增{{ title }}</el-button></template>
      <template #cell-party="{ row }"><div><b>{{ row[partyRelation]?.name || '-' }}</b><small>{{ row[partyRelation]?.code || '-' }}</small></div></template>
      <template #cell-amount="{ row }">{{ formatCurrency(row.amount) }}</template>
      <template #cell-allocated="{ row }">{{ formatCurrency(row.allocated_amount) }}</template>
      <template #cell-unallocated="{ row }">{{ formatCurrency(row.unallocated_amount) }}</template>
      <template #cell-status="{ row }"><el-tag :type="statusTagType(row.status)" size="small">{{ voucherStatusLabel(row.status) }}</el-tag></template>
      <template #cell-actions="{ row }"><el-button v-if="row.status !== 'posted' && canApprove" link type="success" @click="handlePost(row)">过账</el-button><el-button link type="primary" @click="showDetail(row)">详情</el-button></template>
    </DataTable>

    <el-dialog v-model="dialogVisible" :title="`新增${title}`" width="900px" destroy-on-close append-to-body @closed="resetForm">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="98px">
        <el-row :gutter="16">
          <el-col :span="12"><el-form-item :label="partyLabel" :prop="partyField"><el-select v-model="form[partyField]" filterable clearable placeholder="请选择" style="width:100%" @change="loadOpenDocuments"><el-option v-for="item in parties" :key="item.id" :label="`${item.code} · ${item.name}`" :value="item.id" /></el-select></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="单据日期" prop="date"><el-date-picker v-model="form.date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item :label="`${title}金额`" prop="amount"><el-input-number v-model="form.amount" :min="0.01" :precision="2" controls-position="right" style="width:100%" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="收付方式" prop="method"><el-select v-model="form.method" style="width:100%"><el-option v-for="item in methodOptions" :key="item.value" :label="item.label" :value="item.value" /></el-select></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="银行/账户"><el-input v-model="form.bank_account" placeholder="可选" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="交易流水号"><el-input v-model="form.transaction_ref_no" placeholder="可选" /></el-form-item></el-col>
          <el-col :span="24"><el-form-item label="备注"><el-input v-model="form.remark" type="textarea" :rows="2" /></el-form-item></el-col>
        </el-row>
      </el-form>
      <div class="settlement-header"><div><strong>待核销{{ balanceLabel }}</strong><span>已分配 {{ formatCurrency(allocatedAmount) }}，未分配 {{ formatCurrency(unallocatedAmount) }}</span></div><div><el-button :disabled="!form[partyField]" @click="autoAllocate">自动分配</el-button><el-button :disabled="!form[partyField]" @click="loadOpenDocuments">刷新</el-button></div></div>
      <el-table :data="openDocuments" border max-height="300" v-loading="openLoading">
        <el-table-column :prop="balanceNoField" label="单据编号" width="180" /><el-table-column prop="source_no" label="来源单据" width="160" /><el-table-column prop="bill_date" label="立账日期" width="120" /><el-table-column prop="due_date" label="到期日期" width="120" /><el-table-column prop="outstanding_amount" label="待核销" width="140" align="right"><template #default="{ row }">{{ formatCurrency(row.outstanding_amount) }}</template></el-table-column><el-table-column label="本次核销" min-width="160"><template #default="{ row }"><el-input-number v-model="row.allocate_amount" :min="0" :max="Number(row.outstanding_amount || 0)" :precision="2" controls-position="right" style="width:100%" /></template></el-table-column>
      </el-table>
      <template #footer><el-button @click="dialogVisible=false">取消</el-button><el-button :loading="saving" @click="save(false)">保存草稿</el-button><el-button v-if="canApprove" type="primary" :loading="saving" @click="save(true)">保存并过账</el-button></template>
    </el-dialog>

    <el-dialog v-model="detailVisible" :title="`${title}详情`" width="700px" append-to-body><el-descriptions v-if="current" :column="2" border><el-descriptions-item label="单据编号">{{ current[numberField] }}</el-descriptions-item><el-descriptions-item :label="partyLabel">{{ current[partyRelation]?.name || '-' }}</el-descriptions-item><el-descriptions-item label="单据日期">{{ current[dateField] }}</el-descriptions-item><el-descriptions-item label="状态"><el-tag :type="statusTagType(current.status)">{{ voucherStatusLabel(current.status) }}</el-tag></el-descriptions-item><el-descriptions-item label="金额">{{ formatCurrency(current.amount) }}</el-descriptions-item><el-descriptions-item label="已核销">{{ formatCurrency(current.allocated_amount) }}</el-descriptions-item><el-descriptions-item label="未分配">{{ formatCurrency(current.unallocated_amount) }}</el-descriptions-item><el-descriptions-item label="收付方式">{{ methodLabel(current[methodField]) }}</el-descriptions-item><el-descriptions-item label="备注" :span="2">{{ current.remark || '-' }}</el-descriptions-item></el-descriptions><el-divider>核销明细</el-divider><el-table :data="current?.allocations || []" border><el-table-column :prop="allocationIdField" label="账款ID" min-width="260" /><el-table-column prop="amount" label="核销金额" width="150" align="right"><template #default="{row}">{{ formatCurrency(row.amount) }}</template></el-table-column></el-table></el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import DataTable from '@/components/common/DataTable.vue'
import SearchBar from '@/components/common/SearchBar.vue'
import { useTable } from '@/composables/useTable'
import { formatCurrency, statusTagType } from '@/utils/format'
import { toDateString } from '@/utils/report'

const props = defineProps({
  title: { type: String, required: true },
  partyLabel: { type: String, required: true },
  partyField: { type: String, required: true },
  partyRelation: { type: String, required: true },
  dateField: { type: String, required: true },
  methodField: { type: String, required: true },
  numberField: { type: String, required: true },
  balanceLabel: { type: String, required: true },
  balanceNoField: { type: String, required: true },
  allocationIdField: { type: String, required: true },
  fetcher: { type: Function, required: true },
  fetchOpen: { type: Function, required: true },
  saveVoucher: { type: Function, required: true },
  postVoucher: { type: Function, required: true },
  parties: { type: Array, default: () => [] },
  createPermission: { type: String, required: true },
  approvePermission: { type: String, required: true },
  canApprove: Boolean
})

const table = useTable(props.fetcher, { initialQuery: { keyword: '', [props.partyField]: '', status: '', [props.methodField]: '', date_range: [] }, defaultSort: { prop: props.dateField, order: 'descending' } })
const dialogVisible = ref(false); const detailVisible = ref(false); const current = ref(null); const formRef = ref(null); const saving = ref(false); const openLoading = ref(false); const openDocuments = ref([])
const form = reactive({ [props.partyField]: '', date: toDateString(), amount: 0, method: 'bank_transfer', bank_account: '', transaction_ref_no: '', remark: '' })
const methodOptions = [{ label: '现金', value: 'cash' }, { label: '银行转账', value: 'bank_transfer' }, { label: '支票', value: 'cheque' }, { label: '微信', value: 'wechat' }, { label: '支付宝', value: 'alipay' }, { label: '其他', value: 'other' }]
const rules = computed(() => ({ [props.partyField]: [{ required: true, message: `请选择${props.partyLabel}`, trigger: 'change' }], date: [{ required: true, message: '请选择单据日期', trigger: 'change' }], amount: [{ required: true, validator: (_, value, callback) => Number(value) > 0 ? callback() : callback(new Error('金额必须大于 0')), trigger: 'change' }] }))
const searchFields = computed(() => [{ key: 'keyword', label: '关键字', placeholder: '编号、流水号或备注', width: '250px' }, { key: props.partyField, label: props.partyLabel, type: 'select', width: '190px', options: props.parties.map((item) => ({ label: `${item.code} · ${item.name}`, value: item.id })) }, { key: 'status', label: '状态', type: 'select', width: '130px', options: [{ label: '草稿', value: 'draft' }, { label: '已提交', value: 'submitted' }, { label: '已过账', value: 'posted' }, { label: '已取消', value: 'cancelled' }] }, { key: props.methodField, label: '收付方式', type: 'select', width: '150px', options: methodOptions }, { key: 'date_range', label: '单据日期', type: 'daterange', width: '260px' }])
const columns = computed(() => [{ prop: props.numberField, label: '单据编号', width: 175, sortable: 'custom' }, { prop: props.partyRelation, label: props.partyLabel, minWidth: 180, slot: 'cell-party' }, { prop: props.dateField, label: '单据日期', width: 120, sortable: 'custom' }, { prop: props.methodField, label: '收付方式', width: 120, formatter: (row) => methodLabel(row[props.methodField]) }, { prop: 'amount', label: '金额', width: 130, align: 'right', slot: 'cell-amount' }, { prop: 'allocated_amount', label: '已核销', width: 130, align: 'right', slot: 'cell-allocated' }, { prop: 'unallocated_amount', label: '未分配', width: 130, align: 'right', slot: 'cell-unallocated' }, { prop: 'status', label: '状态', width: 100, align: 'center', slot: 'cell-status' }, { prop: 'actions', label: '操作', width: 130, fixed: 'right', slot: 'cell-actions', exportable: false }])
const allocatedAmount = computed(() => Number(openDocuments.value.reduce((sum, row) => sum + Number(row.allocate_amount || 0), 0).toFixed(2)))
const unallocatedAmount = computed(() => Math.max(0, Number(form.amount || 0) - allocatedAmount.value))

function updateQuery(value) { Object.assign(table.query, value) }
function voucherStatusLabel(status) { return ({ draft: '草稿', submitted: '已提交', approved: '已审核', posted: '已过账', cancelled: '已取消' })[status] || status || '-' }
function methodLabel(value) { return methodOptions.find((item) => item.value === value)?.label || value || '-' }
function openCreate() { dialogVisible.value = true; loadOpenDocuments() }
function resetForm() { Object.assign(form, { [props.partyField]: '', date: toDateString(), amount: 0, method: 'bank_transfer', bank_account: '', transaction_ref_no: '', remark: '' }); openDocuments.value = []; formRef.value?.clearValidate?.() }
async function loadOpenDocuments() { if (!form[props.partyField]) { openDocuments.value = []; return }; openLoading.value = true; try { openDocuments.value = (await props.fetchOpen(form[props.partyField])).map((row) => ({ ...row, allocate_amount: 0 })) } catch (error) { ElMessage.error(error.message || `加载待核销${props.balanceLabel}失败`) } finally { openLoading.value = false } }
function autoAllocate() { let remaining = Number(form.amount || 0); openDocuments.value.forEach((row) => { const allocated = Math.min(remaining, Number(row.outstanding_amount || 0)); row.allocate_amount = Number(allocated.toFixed(2)); remaining = Number((remaining - allocated).toFixed(2)) }) }
async function save(post) { const valid = await formRef.value?.validate?.().catch(() => false); if (!valid) return; if (allocatedAmount.value > Number(form.amount || 0)) { ElMessage.warning('核销金额不能超过单据金额'); return }; saving.value = true; try { const id = await props.saveVoucher({ [props.partyField]: form[props.partyField], [props.dateField]: form.date, [props.methodField]: form.method, bank_account: form.bank_account, transaction_ref_no: form.transaction_ref_no, amount: form.amount, allocations: openDocuments.value.map((row) => ({ [props.allocationIdField]: row.id, amount: row.allocate_amount })), remark: form.remark }); if (post) await props.postVoucher(id); ElMessage.success(post ? `${props.title}已过账` : `${props.title}已保存`); dialogVisible.value = false; await table.load() } catch (error) { ElMessage.error(error.message || `保存${props.title}失败`) } finally { saving.value = false } }
async function handlePost(row) { try { await ElMessageBox.confirm(`确认过账${row[props.numberField]}？过账后将自动核销对应账款。`, '确认过账', { type: 'warning' }); await props.postVoucher(row.id); ElMessage.success('过账成功'); await table.load() } catch (error) { if (error !== 'cancel') ElMessage.error(error.message || '过账失败') } }
function showDetail(row) { current.value = row; detailVisible.value = true }
function handleExport({ columns }) { table.exportExcel({ filename: `${props.title}_${toDateString()}.xlsx`, columns }) }
onMounted(() => table.load())
</script>

<style scoped>
.settlement-header { display:flex; align-items:center; justify-content:space-between; gap:16px; margin:6px 0 12px; }.settlement-header strong,.settlement-header span { display:block; }.settlement-header span { margin-top:4px; color:var(--el-text-color-secondary); font-size:12px; }.data-table-card small { display:block; margin-top:3px; color:var(--el-text-color-secondary); font-size:11px; }@media(max-width:680px){.settlement-header{align-items:flex-start;flex-direction:column;}}
</style>
