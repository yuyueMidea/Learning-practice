<template>
  <div class="page-container report-page">
    <SearchBar :model-value="filters" :fields="searchFields" @update:model-value="updateFilters" @search="load" @reset="reset" />
    <div class="report-kpis">
      <el-card shadow="never"><span>销售金额</span><strong>{{ formatCurrency(report.overview.totalAmount) }}</strong></el-card>
      <el-card shadow="never"><span>销售数量</span><strong>{{ formatNumber(report.overview.totalQty, { maximumFractionDigits: 3 }) }}</strong></el-card>
      <el-card shadow="never"><span>发货单数</span><strong>{{ formatNumber(report.overview.documentCount) }}</strong></el-card>
      <el-card shadow="never"><span>服务客户数</span><strong>{{ formatNumber(report.overview.customerCount) }}</strong></el-card>
    </div>
    <el-alert v-if="drillText" :title="drillText" type="info" show-icon :closable="false" class="drill-alert"><template #default><el-button link type="primary" @click="clearDrill">清除下钻</el-button></template></el-alert>
    <div class="report-charts"><ReportChartCard title="销售趋势" description="按发货日期汇总" :option="trendOption" :loading="loading" filename="销售趋势.png" class="wide" /><ReportChartCard title="商品销售 TOP10" description="点击柱状图下钻到商品明细" :option="productOption" :loading="loading" filename="商品销售TOP10.png" @click="drillProduct" /><ReportChartCard title="客户销售排名" description="点击柱状图下钻到客户明细" :option="customerOption" :loading="loading" filename="客户销售排名.png" @click="drillCustomer" /></div>
    <DataTable :data="detailRows" :columns="columns" :loading="loading" :show-export="true" @export="handleExport">
      <template #toolbar><div class="table-title"><b>销售明细</b><span>已过账发货单明细行</span></div></template>
      <template #cell-customer="{ row }"><div><b>{{ row.customer?.name || '-' }}</b><small>{{ row.customer?.code || '-' }}</small></div></template>
      <template #cell-product="{ row }"><div><b>{{ row.product?.name || '-' }}</b><small>{{ row.product?.code || '-' }}</small></div></template>
      <template #cell-qty="{ row }">{{ formatNumber(row.qty, { maximumFractionDigits: 3 }) }}</template><template #cell-amount="{ row }"><b>{{ formatCurrency(row.amount) }}</b></template>
    </DataTable>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import DataTable from '@/components/common/DataTable.vue'
import SearchBar from '@/components/common/SearchBar.vue'
import ReportChartCard from '@/components/report/ReportChartCard.vue'
import { fetchReportOptions, fetchSalesReport } from '@/api/report'
import { exportRowsToExcel } from '@/utils/excel'
import { formatCurrency, formatNumber } from '@/utils/format'
import { barOption, lineOption, recentDateRange } from '@/utils/report'

const loading = ref(false)
const options = reactive({ customers: [], warehouses: [] })
const filters = reactive({ date_range: recentDateRange(30), customer_id: '', warehouse_id: '' })
const selectedProductId = ref(''), selectedCustomerId = ref('')
const report = reactive({ overview: { totalAmount: 0, totalQty: 0, documentCount: 0, customerCount: 0 }, trend: { labels: [], values: [] }, customers: [], products: [], details: [] })
const searchFields = computed(() => [{ key: 'date_range', label: '发货日期', type: 'daterange', width: '260px' }, { key: 'customer_id', label: '客户', type: 'select', width: '190px', options: options.customers.map((row) => ({ label: `${row.code} · ${row.name}`, value: row.id })) }, { key: 'warehouse_id', label: '仓库', type: 'select', width: '180px', options: options.warehouses.map((row) => ({ label: `${row.code} · ${row.name}`, value: row.id })) }])
const flatRows = computed(() => report.details.flatMap((delivery) => (delivery.items || []).map((item) => ({ ...item, delivery_no: delivery.delivery_no, delivery_date: delivery.delivery_date, customer: delivery.customer, warehouse: delivery.warehouse }))))
const detailRows = computed(() => flatRows.value.filter((row) => (!selectedProductId.value || row.product_id === selectedProductId.value) && (!selectedCustomerId.value || row.customer?.id === selectedCustomerId.value)))
const drillText = computed(() => { const product = report.products.find((row) => row.id === selectedProductId.value); const customer = report.customers.find((row) => row.id === selectedCustomerId.value); return product ? `已下钻：商品「${product.name}」` : customer ? `已下钻：客户「${customer.name}」` : '' })
const trendOption = computed(() => lineOption({ labels: report.trend.labels, series: [{ name: '销售额', data: report.trend.values, areaStyle: {} }], valueFormatter: (value) => formatCurrency(value) }))
const productOption = computed(() => barOption({ labels: report.products.slice(0, 10).map((row) => row.name), values: report.products.slice(0, 10).map((row) => row.amount), seriesName: '销售额', horizontal: true, valueFormatter: (value) => formatCurrency(value) }))
const customerOption = computed(() => barOption({ labels: report.customers.slice(0, 10).map((row) => row.name), values: report.customers.slice(0, 10).map((row) => row.amount), seriesName: '销售额', horizontal: true, valueFormatter: (value) => formatCurrency(value) }))
const columns = [{ prop: 'delivery_no', label: '发货单号', width: 175 }, { prop: 'delivery_date', label: '发货日期', width: 120 }, { prop: 'customer', label: '客户', minWidth: 170, slot: 'cell-customer' }, { prop: 'product', label: '商品', minWidth: 180, slot: 'cell-product' }, { prop: 'qty', label: '数量', width: 110, align: 'right', slot: 'cell-qty' }, { prop: 'unit_price', label: '单价', width: 120, align: 'right', formatter: (row) => formatCurrency(row.unit_price) }, { prop: 'amount', label: '金额', width: 130, align: 'right', slot: 'cell-amount' }, { prop: 'warehouse', label: '仓库', width: 150, formatter: (row) => row.warehouse?.name || '-' }]
function updateFilters(value) { Object.assign(filters, value) }
async function load() { loading.value = true; try { Object.assign(report, await fetchSalesReport(filters)) } catch (error) { ElMessage.error(error.message || '加载销售报表失败') } finally { loading.value = false } }
async function reset() { Object.assign(filters, { date_range: recentDateRange(30), customer_id: '', warehouse_id: '' }); clearDrill(); await load() }
function drillProduct(event) { const row = report.products.find((item) => item.name === event?.name); if (row) { selectedProductId.value = row.id; selectedCustomerId.value = '' } }
function drillCustomer(event) { const row = report.customers.find((item) => item.name === event?.name); if (row) { selectedCustomerId.value = row.id; selectedProductId.value = '' } }
function clearDrill() { selectedProductId.value = ''; selectedCustomerId.value = '' }
function handleExport() { const rows = detailRows.value.map((row) => ({ 发货单号: row.delivery_no, 发货日期: row.delivery_date, 客户: row.customer?.name || '', 商品编码: row.product?.code || '', 商品名称: row.product?.name || '', 数量: Number(row.qty || 0), 单价: Number(row.unit_price || 0), 金额: Number(row.amount || 0), 仓库: row.warehouse?.name || '' })); if (!exportRowsToExcel(rows, [], `销售明细_${filters.date_range.join('_')}.xlsx`, '销售明细')) ElMessage.warning('暂无可导出数据') }
onMounted(async () => { try { Object.assign(options, await fetchReportOptions()); await load() } catch (error) { ElMessage.error(error.message || '初始化销售报表失败') } })
</script>

<style scoped>
.report-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:16px}.report-kpis .el-card :deep(.el-card__body){padding:14px 16px}.report-kpis span,.report-kpis strong{display:block}.report-kpis span{font-size:13px;color:var(--el-text-color-secondary)}.report-kpis strong{margin-top:7px;font-size:21px}.report-charts{display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:16px;margin-bottom:16px}.wide{min-width:0}.drill-alert{margin-bottom:14px}.table-title b,.table-title span{display:block}.table-title span,.data-table-card small{font-size:12px;color:var(--el-text-color-secondary);margin-top:3px}@media(max-width:1120px){.report-charts{grid-template-columns:1fr 1fr}.report-charts .wide{grid-column:span 2}}@media(max-width:720px){.report-kpis,.report-charts{grid-template-columns:1fr}.report-charts .wide{grid-column:auto}}
</style>
