<template>
  <div class="page-container">
    <SearchBar :model-value="query" :fields="fields" @update:model-value="updateQuery" @search="load" @reset="reset" />
    <DataTable :data="rows" :columns="columns" :loading="loading" :show-export="true" @export="handleExport">
      <template #cell-receipt_amount="{ row }">{{ formatCurrency(row.receipt_amount || row.delivery_amount) }}</template>
      <template #cell-return_amount="{ row }">{{ formatCurrency(row.return_amount) }}</template>
      <template #cell-net_amount="{ row }">{{ formatCurrency(row.net_amount) }}</template>
      <template #cell-outstanding="{ row }">{{ formatCurrency(row.payable_outstanding || row.receivable_outstanding) }}</template>
    </DataTable>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import SearchBar from '@/components/common/SearchBar.vue'
import DataTable from '@/components/common/DataTable.vue'
import { fetchAllOptions, toDateString } from '@/api/business'
import { fetchPurchaseStatement } from '@/api/purchase'
import { fetchSalesStatement } from '@/api/sales'
import { exportRowsToExcel } from '@/utils/excel'
import { formatCurrency } from '@/utils/format'

const props = defineProps({ type: { type: String, required: true } })
const isPurchase = computed(() => props.type === 'purchase')
const query = reactive({ counterpart_id: '', date_range: [] })
const options = reactive({ customers: [], suppliers: [] })
const rows = ref([])
const loading = ref(false)
const fields = computed(() => [
  { key: 'counterpart_id', label: isPurchase.value ? '供应商' : '客户', type: 'select', width: '230px', options: (isPurchase.value ? options.suppliers : options.customers).map((item) => ({ label: `${item.code} · ${item.name}`, value: item.id })) },
  { key: 'date_range', label: '业务日期', type: 'daterange', width: '280px' }
])
const columns = computed(() => isPurchase.value ? [
  { prop: 'supplier_name', label: '供应商', minWidth: 220 }, { prop: 'receipt_amount', label: '收货金额', minWidth: 150, align: 'right', slot: 'cell-receipt_amount' }, { prop: 'return_amount', label: '退货金额', minWidth: 150, align: 'right', slot: 'cell-return_amount' }, { prop: 'net_amount', label: '净采购金额', minWidth: 160, align: 'right', slot: 'cell-net_amount' }, { prop: 'payable_outstanding', label: '应付余额', minWidth: 160, align: 'right', slot: 'cell-outstanding' }
] : [
  { prop: 'customer_name', label: '客户', minWidth: 220 }, { prop: 'delivery_amount', label: '发货金额', minWidth: 150, align: 'right', slot: 'cell-receipt_amount' }, { prop: 'return_amount', label: '退货金额', minWidth: 150, align: 'right', slot: 'cell-return_amount' }, { prop: 'net_amount', label: '净销售金额', minWidth: 160, align: 'right', slot: 'cell-net_amount' }, { prop: 'receivable_outstanding', label: '应收余额', minWidth: 160, align: 'right', slot: 'cell-outstanding' }
])
function updateQuery(value) { Object.assign(query, value) }
async function load() {
  loading.value = true
  try {
    const [startDate, endDate] = query.date_range || []
    rows.value = isPurchase.value ? await fetchPurchaseStatement({ startDate, endDate, supplierId: query.counterpart_id }) : await fetchSalesStatement({ startDate, endDate, customerId: query.counterpart_id })
  } catch (error) { ElMessage.error(error.message || '加载对账数据失败') } finally { loading.value = false }
}
function reset() { Object.assign(query, { counterpart_id: '', date_range: [] }); load() }
function handleExport() { exportRowsToExcel(rows.value.map((row) => ({ ...row, ...(isPurchase.value ? { 收货金额: row.receipt_amount, 退货金额: row.return_amount, 净采购金额: row.net_amount, 应付余额: row.payable_outstanding } : { 发货金额: row.delivery_amount, 退货金额: row.return_amount, 净销售金额: row.net_amount, 应收余额: row.receivable_outstanding }) })), [], `${isPurchase.value ? '采购' : '销售'}对账_${toDateString()}.xlsx`, '对账') }
onMounted(async () => { try { Object.assign(options, await fetchAllOptions()); await load() } catch (error) { ElMessage.error(error.message || '加载页面失败') } })
</script>
