<template>
  <section class="page-container dashboard-page">
    <div class="dashboard-page__hero">
      <div>
        <p class="dashboard-page__eyebrow">经营驾驶舱</p>
        <h1>你好，{{ displayName }}。</h1>
        <p>数据范围受当前账号权限控制，销售指标按已过账发货单统计。</p>
      </div>
      <el-button :icon="Refresh" :loading="loading" @click="loadDashboard">刷新数据</el-button>
    </div>

    <el-alert v-if="errorMessage" :title="errorMessage" type="warning" show-icon :closable="false" class="dashboard-page__alert" />

    <div class="dashboard-page__metrics">
      <article v-for="card in metricCards" :key="card.label" class="metric-card">
        <div class="metric-card__icon" :class="`metric-card__icon--${card.type}`"><el-icon><component :is="card.icon" /></el-icon></div>
        <div><p>{{ card.label }}</p><strong>{{ card.value }}</strong><small>{{ card.description }}</small></div>
      </article>
    </div>

    <div class="dashboard-page__charts">
      <ReportChartCard title="近 30 天销售趋势" description="按已过账发货单的含税金额汇总" :option="salesTrendOption" :loading="loading" filename="近30天销售趋势.png" class="dashboard-page__chart--wide" />
      <ReportChartCard title="商品销售 TOP10" description="点击柱状图可跳转销售报表并查看排行" :option="productTopOption" :loading="loading" filename="商品销售TOP10.png" @click="goSalesReport" />
    </div>

    <div class="dashboard-page__grid">
      <el-card shadow="never" class="dashboard-panel dashboard-panel--wide">
        <template #header><div class="dashboard-panel__header"><div><h3>待办事项</h3><p>采购与销售的待审核单据</p></div><el-icon><List /></el-icon></div></template>
        <el-empty v-if="!loading && !dashboard.todos.length" description="暂无待办事项" :image-size="76" />
        <div v-else class="todo-list"><button v-for="item in dashboard.todos" :key="item.label" class="todo-item" @click="goTo(item.path)"><span class="todo-item__dot"></span><span class="todo-item__label">{{ item.label }}</span><strong>{{ item.count }}</strong><el-icon><ArrowRight /></el-icon></button></div>
      </el-card>

      <el-card shadow="never" class="dashboard-panel">
        <template #header><div class="dashboard-panel__header"><div><h3>库存预警</h3><p>可用库存低于安全库存</p></div><el-tag type="danger" effect="light">{{ dashboard.stockAlerts.length }} 项</el-tag></div></template>
        <el-empty v-if="!loading && !dashboard.stockAlerts.length" description="暂无库存预警" :image-size="76" />
        <div v-else class="stock-alert-list"><button v-for="item in dashboard.stockAlerts" :key="item.id" class="stock-alert-item" @click="goTo('/inventory/stocks')"><div><strong>{{ item.product?.name || item.product_name || '-' }}</strong><span>{{ item.product?.code || item.product_code || '-' }} · {{ item.warehouse?.name || '-' }}</span></div><div class="stock-alert-item__qty"><b>{{ formatNumber(item.quantity_available ?? item.available_qty, { maximumFractionDigits: 3 }) }}</b><span>/ 安全 {{ formatNumber(item.product?.safety_stock ?? item.safety_stock, { maximumFractionDigits: 3 }) }}</span></div></button></div>
      </el-card>

      <el-card shadow="never" class="dashboard-panel dashboard-panel--wide">
        <template #header><div class="dashboard-panel__header"><div><h3>近期操作</h3><p>系统记录的最近业务行为</p></div><el-icon><Document /></el-icon></div></template>
        <el-table :data="dashboard.logs" size="small" stripe><el-table-column prop="module" label="模块" min-width="130" /><el-table-column prop="operation" label="操作" min-width="130" /><el-table-column label="状态" width="100"><template #default="{ row }"><el-tag :type="row.status === 'success' ? 'success' : 'danger'" size="small">{{ row.status === 'success' ? '成功' : '失败' }}</el-tag></template></el-table-column><el-table-column label="时间" min-width="180"><template #default="{ row }">{{ formatDateTime(row.created_at) }}</template></el-table-column></el-table>
      </el-card>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowRight, Document, List, Money, Refresh, ShoppingCart, WarningFilled } from '@element-plus/icons-vue'
import { getDashboardOverview } from '@/api/dashboard'
import ReportChartCard from '@/components/report/ReportChartCard.vue'
import { useAuthStore } from '@/stores/auth'
import { formatCurrency, formatDateTime, formatNumber } from '@/utils/format'
import { barOption, lineOption } from '@/utils/report'

const router = useRouter()
const authStore = useAuthStore()
const loading = ref(false)
const errorMessage = ref('')
const dashboard = reactive({
  metrics: { todaySalesAmount: 0, monthSalesAmount: 0, pendingOrderCount: 0, stockAlertCount: 0 },
  salesTrend: { labels: [], values: [] },
  productTop: [],
  stockAlerts: [],
  todos: [],
  logs: []
})

const displayName = computed(() => authStore.profile?.display_name || authStore.profile?.user_name || '同事')
const metricCards = computed(() => [
  { label: '今日销售额', value: formatCurrency(dashboard.metrics.todaySalesAmount), description: '已过账发货单', icon: Money, type: 'primary' },
  { label: '本月销售额', value: formatCurrency(dashboard.metrics.monthSalesAmount), description: '本月累计已发货金额', icon: ShoppingCart, type: 'success' },
  { label: '待处理订单', value: formatNumber(dashboard.metrics.pendingOrderCount), description: '采购与销售待审核合计', icon: List, type: 'warning' },
  { label: '库存预警', value: formatNumber(dashboard.metrics.stockAlertCount), description: '低于安全库存的商品', icon: WarningFilled, type: 'danger' }
])
const salesTrendOption = computed(() => lineOption({ labels: dashboard.salesTrend.labels, series: [{ name: '销售额', data: dashboard.salesTrend.values, areaStyle: {} }], valueFormatter: (value) => formatCurrency(value) }))
const productTopOption = computed(() => barOption({ labels: dashboard.productTop.map((item) => item.name), values: dashboard.productTop.map((item) => item.amount), seriesName: '销售额', horizontal: true, valueFormatter: (value) => formatCurrency(value) }))

async function loadDashboard() {
  loading.value = true
  errorMessage.value = ''
  try {
    const data = await getDashboardOverview()
    Object.assign(dashboard.metrics, data.metrics)
    dashboard.salesTrend = data.salesTrend
    dashboard.productTop = data.productTop
    dashboard.stockAlerts = data.stockAlerts
    dashboard.todos = data.todos
    dashboard.logs = data.logs
  } catch (error) {
    errorMessage.value = `仪表盘数据加载失败：${error.message || '请检查数据权限与 Supabase 配置。'}`
  } finally {
    loading.value = false
  }
}
function goTo(path) { router.push(path) }
function goSalesReport() { router.push('/report/sales') }
onMounted(loadDashboard)
</script>

<style scoped>
.dashboard-page__hero { display:flex; align-items:center; justify-content:space-between; gap:20px; margin-bottom:18px; }
.dashboard-page__eyebrow { margin:0 0 6px; color:var(--el-color-primary); font-size:13px; font-weight:700; letter-spacing:.08em; }
.dashboard-page__hero h1 { margin:0; font-size:28px; }
.dashboard-page__hero p:not(.dashboard-page__eyebrow) { margin:8px 0 0; color:var(--el-text-color-secondary); }
.dashboard-page__alert { margin-bottom:16px; }
.dashboard-page__metrics { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:14px; margin-bottom:16px; }
.metric-card { display:flex; gap:13px; padding:18px; border:1px solid var(--el-border-color-lighter); border-radius:12px; background:var(--el-bg-color); }
.metric-card__icon { display:grid; width:44px; height:44px; place-items:center; border-radius:12px; font-size:21px; }
.metric-card__icon--primary { color:var(--el-color-primary); background:var(--el-color-primary-light-9); }.metric-card__icon--success { color:var(--el-color-success); background:var(--el-color-success-light-9); }.metric-card__icon--warning { color:var(--el-color-warning); background:var(--el-color-warning-light-9); }.metric-card__icon--danger { color:var(--el-color-danger); background:var(--el-color-danger-light-9); }
.metric-card p { margin:0; color:var(--el-text-color-secondary); font-size:13px; }.metric-card strong { display:block; margin:5px 0 3px; font-size:22px; }.metric-card small { color:var(--el-text-color-secondary); }
.dashboard-page__charts { display:grid; grid-template-columns:1.5fr 1fr; gap:16px; margin-bottom:16px; }.dashboard-page__chart--wide { min-width:0; }
.dashboard-page__grid { display:grid; grid-template-columns:1.5fr 1fr; gap:16px; }.dashboard-panel--wide { min-width:0; }.dashboard-panel__header { display:flex; align-items:center; justify-content:space-between; }.dashboard-panel__header h3 { margin:0; font-size:15px; }.dashboard-panel__header p { margin:4px 0 0; color:var(--el-text-color-secondary); font-size:12px; }
.todo-list,.stock-alert-list { display:flex; flex-direction:column; }.todo-item,.stock-alert-item { width:100%; display:flex; align-items:center; border:0; background:transparent; text-align:left; cursor:pointer; padding:12px 4px; border-bottom:1px solid var(--el-border-color-lighter); }.todo-item:last-child,.stock-alert-item:last-child { border-bottom:0; }.todo-item__dot { width:8px; height:8px; border-radius:50%; background:var(--el-color-warning); margin-right:10px; }.todo-item__label { flex:1; }.todo-item strong { margin-right:10px; }.stock-alert-item { justify-content:space-between; gap:12px; }.stock-alert-item strong,.stock-alert-item span { display:block; }.stock-alert-item span { margin-top:4px; color:var(--el-text-color-secondary); font-size:12px; }.stock-alert-item__qty { text-align:right; white-space:nowrap; }.stock-alert-item__qty b { color:var(--el-color-danger); }
@media (max-width:1100px) { .dashboard-page__metrics { grid-template-columns:repeat(2,minmax(0,1fr)); }.dashboard-page__charts,.dashboard-page__grid { grid-template-columns:1fr; } }@media (max-width:640px) { .dashboard-page__hero { align-items:flex-start; flex-direction:column; }.dashboard-page__metrics { grid-template-columns:1fr; } }
</style>
