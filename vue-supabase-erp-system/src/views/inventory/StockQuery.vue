<template>
  <div class="page-container">
    <SearchBar :model-value="table.query" :fields="searchFields" @update:model-value="updateQuery" @search="table.search" @reset="table.reset" />
    <DataTable :data="table.rows" :columns="columns" :loading="table.loading" :pagination="table.pagination" :show-export="true" @page-change="table.changePage" @page-size-change="table.changePageSize" @sort-change="table.changeSort" @export="handleExport">
      <template #toolbar><el-tag type="success" effect="plain">Realtime 已订阅库存变动，发生出入库后本页会自动刷新</el-tag></template>
      <template #cell-product="{ row }"><div><b>{{ row.product?.name || '-' }}</b><small class="stock-sub">{{ row.product?.code }}{{ row.product?.model ? ` · ${row.product.model}` : '' }}</small></div></template>
      <template #cell-warehouse="{ row }">{{ row.warehouse?.name || '-' }}</template>
      <template #cell-location="{ row }">{{ row.location?.name || '默认库位' }}</template>
      <template #cell-qty="{ row }"><span :class="{ 'stock-warning': isWarning(row) }">{{ formatNumber(row.quantity_on_hand, { maximumFractionDigits: 6 }) }}</span><small class="stock-sub">可用 {{ formatNumber(row.quantity_available, { maximumFractionDigits: 6 }) }}</small></template>
      <template #cell-cost="{ row }">{{ formatCurrency(row.total_cost) }}</template>
      <template #cell-warning="{ row }"><el-tag :type="isWarning(row) ? 'danger' : 'success'">{{ isWarning(row) ? '低于安全库存' : '正常' }}</el-tag></template>
    </DataTable>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import SearchBar from '@/components/common/SearchBar.vue'
import DataTable from '@/components/common/DataTable.vue'
import { fetchAllOptions, toDateString } from '@/api/business'
import { fetchStocks, subscribeStockChanges } from '@/api/inventory'
import { useTable } from '@/composables/useTable'
import { formatCurrency, formatNumber } from '@/utils/format'

const table = useTable(fetchStocks, { initialQuery: { product_id: '', warehouse_id: '', location_id: '', status: 'active' }, defaultSort: { prop: 'updated_at', order: 'descending' } })
const options = reactive({ warehouses: [] })
let unsubscribe = null
const searchFields = [
  { key: 'warehouse_id', label: '仓库', type: 'select', width: '220px', options: [] },
  { key: 'status', label: '库存状态', type: 'select', width: '140px', options: [{ label: '正常', value: 'active' }, { label: '停用', value: 'inactive' }] }
]
const columns = [
  { prop: 'product', label: '商品', minWidth: 230, slot: 'cell-product' }, { prop: 'warehouse', label: '仓库', minWidth: 150, slot: 'cell-warehouse' }, { prop: 'location', label: '库位', minWidth: 140, slot: 'cell-location' },
  { prop: 'batch_no', label: '批次', width: 140 }, { prop: 'qty', label: '库存数量', width: 160, align: 'right', slot: 'cell-qty' }, { prop: 'unit_cost', label: '单位成本', width: 130, align: 'right', formatter: (row) => formatCurrency(row.unit_cost) }, { prop: 'cost', label: '库存成本', width: 140, align: 'right', slot: 'cell-cost' }, { prop: 'warning', label: '预警', width: 125, align: 'center', slot: 'cell-warning' }
]
function updateQuery(value) { Object.assign(table.query, value) }
function isWarning(row) { return Number(row.quantity_available || 0) < Number(row.product?.safety_stock || 0) }
function handleExport({ columns }) { table.exportExcel({ filename: `库存查询_${toDateString()}.xlsx`, columns }) }
onMounted(async () => {
  try {
    const data = await fetchAllOptions()
    options.warehouses = data.warehouses
    searchFields[0].options = data.warehouses.map((item) => ({ label: `${item.code} · ${item.name}`, value: item.id }))
    await table.load()
    let timer = null
    unsubscribe = subscribeStockChanges(() => { clearTimeout(timer); timer = setTimeout(() => table.load().catch(() => {}), 400) })
  } catch (error) { ElMessage.error(error.message || '加载库存失败') }
})
onBeforeUnmount(() => unsubscribe?.())
</script>

<style scoped>
.stock-sub { display:block; color:var(--el-text-color-secondary); margin-top:3px; }
.stock-warning { color:var(--el-color-danger); font-weight:700; }
</style>
