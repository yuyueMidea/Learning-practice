<template>
  <div class="page-container">
    <SearchBar :model-value="table.query" :fields="searchFields" @update:model-value="updateQuery" @search="table.search" @reset="table.reset" />
    <div class="balance-summary">
      <el-card shadow="never"><span>本页未核销余额</span><strong>{{ formatCurrency(pageOutstanding) }}</strong></el-card>
      <el-card shadow="never"><span>本页逾期余额</span><strong class="danger">{{ formatCurrency(pageOverdue) }}</strong></el-card>
      <el-card shadow="never"><span>本页单据数</span><strong>{{ formatNumber(table.total) }}</strong></el-card>
    </div>
    <DataTable :data="table.rows" :columns="columns" :loading="table.loading" :pagination="table.pagination" :show-export="true" @page-change="table.changePage" @page-size-change="table.changePageSize" @sort-change="table.changeSort" @export="handleExport">
      <template #cell-party="{ row }"><div><b>{{ row[partyRelation]?.name || '-' }}</b><small>{{ row[partyRelation]?.code || '-' }}</small></div></template>
      <template #cell-status="{ row }"><el-tag :type="statusTagType(displayStatus(row))" size="small">{{ financeStatusLabel(displayStatus(row)) }}</el-tag></template>
      <template #cell-amount="{ row }">{{ formatCurrency(row.original_amount) }}</template>
      <template #cell-settled="{ row }">{{ formatCurrency(row[settledField]) }}</template>
      <template #cell-outstanding="{ row }"><span :class="Number(row.outstanding_amount) > 0 ? 'amount-outstanding' : ''">{{ formatCurrency(row.outstanding_amount) }}</span></template>
      <template #cell-due="{ row }"><span :class="ageInfo(row).overdue ? 'due-overdue' : ''">{{ row.due_date || '-' }}<small v-if="ageInfo(row).text">{{ ageInfo(row).text }}</small></span></template>
      <template #cell-actions="{ row }"><el-button link type="primary" @click="showDetail(row)">详情</el-button></template>
    </DataTable>

    <el-dialog v-model="detailVisible" :title="`${title}详情`" width="680px" append-to-body>
      <el-descriptions v-if="current" :column="2" border>
        <el-descriptions-item label="单据编号">{{ current[numberField] }}</el-descriptions-item>
        <el-descriptions-item :label="partyLabel">{{ current[partyRelation]?.name || '-' }}</el-descriptions-item>
        <el-descriptions-item label="来源单据">{{ current.source_no || '-' }}</el-descriptions-item>
        <el-descriptions-item label="状态"><el-tag :type="statusTagType(displayStatus(current))">{{ financeStatusLabel(displayStatus(current)) }}</el-tag></el-descriptions-item>
        <el-descriptions-item label="立账日期">{{ current.bill_date || '-' }}</el-descriptions-item>
        <el-descriptions-item label="到期日期">{{ current.due_date || '-' }}</el-descriptions-item>
        <el-descriptions-item label="原始金额">{{ formatCurrency(current.original_amount) }}</el-descriptions-item>
        <el-descriptions-item :label="settledLabel">{{ formatCurrency(current[settledField]) }}</el-descriptions-item>
        <el-descriptions-item label="未核销余额">{{ formatCurrency(current.outstanding_amount) }}</el-descriptions-item>
        <el-descriptions-item label="备注">{{ current.remark || '-' }}</el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import DataTable from '@/components/common/DataTable.vue'
import SearchBar from '@/components/common/SearchBar.vue'
import { useTable } from '@/composables/useTable'
import { formatCurrency, formatNumber, statusTagType } from '@/utils/format'
import { toDateString } from '@/utils/report'

const props = defineProps({
  title: { type: String, required: true },
  partyLabel: { type: String, required: true },
  partyRelation: { type: String, required: true },
  partyField: { type: String, required: true },
  numberField: { type: String, required: true },
  settledField: { type: String, required: true },
  settledLabel: { type: String, required: true },
  fetcher: { type: Function, required: true },
  parties: { type: Array, default: () => [] }
})

const table = useTable(props.fetcher, { initialQuery: { keyword: '', [props.partyField]: '', status: '', date_range: [] }, defaultSort: { prop: 'bill_date', order: 'descending' } })
const detailVisible = ref(false)
const current = ref(null)
const searchFields = computed(() => [
  { key: 'keyword', label: '关键字', placeholder: '编号、来源单据或备注', width: '260px' },
  { key: props.partyField, label: props.partyLabel, type: 'select', width: '190px', options: props.parties.map((item) => ({ label: `${item.code} · ${item.name}`, value: item.id })) },
  { key: 'status', label: '状态', type: 'select', width: '150px', options: [{ label: '未结清', value: 'open' }, { label: '部分核销', value: 'partial' }, { label: '已结清', value: 'settled' }, { label: '已逾期', value: 'overdue' }] },
  { key: 'date_range', label: '立账日期', type: 'daterange', width: '260px' }
])
const columns = computed(() => [
  { prop: props.numberField, label: '单据编号', width: 180, sortable: 'custom' },
  { prop: props.partyRelation, label: props.partyLabel, minWidth: 180, slot: 'cell-party' },
  { prop: 'source_no', label: '来源单据', width: 170 },
  { prop: 'bill_date', label: '立账日期', width: 120, sortable: 'custom' },
  { prop: 'due_date', label: '到期情况', width: 135, slot: 'cell-due' },
  { prop: 'original_amount', label: '原始金额', width: 130, align: 'right', slot: 'cell-amount' },
  { prop: props.settledField, label: props.settledLabel, width: 130, align: 'right', slot: 'cell-settled' },
  { prop: 'outstanding_amount', label: '未核销', width: 130, align: 'right', slot: 'cell-outstanding' },
  { prop: 'status', label: '状态', width: 100, align: 'center', slot: 'cell-status' },
  { prop: 'actions', label: '操作', width: 85, fixed: 'right', slot: 'cell-actions', exportable: false }
])
const pageOutstanding = computed(() => table.rows.reduce((sum, row) => sum + Number(row.outstanding_amount || 0), 0))
const pageOverdue = computed(() => table.rows.filter((row) => ageInfo(row).overdue).reduce((sum, row) => sum + Number(row.outstanding_amount || 0), 0))

function updateQuery(value) { Object.assign(table.query, value) }
function displayStatus(row) { return ageInfo(row).overdue && ['open', 'partial'].includes(row.status) ? 'overdue' : row.status }
function ageInfo(row) {
  if (!row?.due_date || !Number(row.outstanding_amount)) return { overdue: false, text: '' }
  const due = new Date(`${row.due_date}T00:00:00`)
  const today = new Date(`${toDateString()}T00:00:00`)
  const days = Math.floor((today - due) / 86400000)
  return days > 0 ? { overdue: true, text: `逾期 ${days} 天` } : { overdue: false, text: '' }
}
function financeStatusLabel(status) { return ({ open: '未结清', partial: '部分核销', settled: '已结清', overdue: '已逾期', written_off: '已核销', cancelled: '已取消' })[status] || status || '-' }
function showDetail(row) { current.value = row; detailVisible.value = true }
function handleExport({ columns }) { table.exportExcel({ filename: `${props.title}_${toDateString()}.xlsx`, columns }) }
onMounted(() => table.load())
</script>

<style scoped>
.balance-summary { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; margin:0 0 14px; }.balance-summary .el-card :deep(.el-card__body) { display:flex; align-items:baseline; justify-content:space-between; gap:10px; padding:14px 16px; }.balance-summary span { color:var(--el-text-color-secondary); font-size:13px; }.balance-summary strong { font-size:18px; }.danger,.amount-outstanding,.due-overdue { color:var(--el-color-danger); }.due-overdue small,.data-table-card small { display:block; margin-top:3px; color:var(--el-text-color-secondary); font-size:11px; }@media(max-width:760px){.balance-summary{grid-template-columns:1fr;}}
</style>
