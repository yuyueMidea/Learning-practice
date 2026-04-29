<template>
  <div class="dashboard">
    <!-- Stat Cards -->
    <div class="stats-grid">
      <div v-for="stat in statCards" :key="stat.key" class="stat-card" :class="`stat-${stat.color}`">
        <div class="stat-icon">
          <el-icon><component :is="stat.icon" /></el-icon>
        </div>
        <div class="stat-body">
          <div class="stat-value">{{ stat.value }}</div>
          <div class="stat-label">{{ stat.label }}</div>
          <div class="stat-change" :class="stat.up ? 'up' : 'down'">
            <el-icon><component :is="stat.up ? 'ArrowUp' : 'ArrowDown'" /></el-icon>
            {{ stat.change }}
          </div>
        </div>
      </div>
    </div>

    <!-- Charts Row -->
    <div class="charts-row">
      <!-- Sales Trend -->
      <el-card class="chart-card chart-large">
        <template #header>
          <div class="card-header">
            <span class="card-title">销售趋势分析</span>
            <el-radio-group v-model="trendPeriod" size="small">
              <el-radio-button label="month">近12月</el-radio-button>
              <el-radio-button label="week">近7天</el-radio-button>
            </el-radio-group>
          </div>
        </template>
        <div ref="salesChartRef" class="chart-container"></div>
      </el-card>

      <!-- Category Pie -->
      <el-card class="chart-card chart-small">
        <template #header>
          <div class="card-header">
            <span class="card-title">商品分类分布</span>
          </div>
        </template>
        <div ref="categoryChartRef" class="chart-container"></div>
      </el-card>
    </div>

    <!-- Bottom Row -->
    <div class="bottom-row">
      <!-- Stock Warning -->
      <el-card class="bottom-card">
        <template #header>
          <div class="card-header">
            <span class="card-title">
              <el-icon color="#ef4444"><Warning /></el-icon>
              库存预警
            </span>
            <el-tag type="danger" size="small">{{ warningList.length }} 项</el-tag>
          </div>
        </template>
        <div class="warning-list">
          <div v-for="item in warningList" :key="item.id" class="warning-item">
            <div class="warning-info">
              <div class="warning-name">{{ item.name }}</div>
              <div class="warning-code">{{ item.code }}</div>
            </div>
            <div class="warning-stock">
              <el-progress
                :percentage="Math.round((item.stock / item.minStock) * 100)"
                :color="item.stock < item.minStock * 0.5 ? '#ef4444' : '#f59e0b'"
                :stroke-width="6"
                :show-text="false"
                style="width: 80px"
              />
              <span class="stock-text" :style="{ color: item.stock < item.minStock * 0.5 ? '#ef4444' : '#f59e0b' }">
                {{ item.stock }}/{{ item.minStock }}
              </span>
            </div>
          </div>
          <el-empty v-if="!warningList.length" description="暂无预警商品" :image-size="60" />
        </div>
      </el-card>

      <!-- Recent Activities -->
      <el-card class="bottom-card">
        <template #header>
          <div class="card-header">
            <span class="card-title">最近动态</span>
          </div>
        </template>
        <el-timeline class="activity-timeline">
          <el-timeline-item
            v-for="act in activities"
            :key="act.id"
            :timestamp="act.time"
            placement="top"
            :type="activityType(act.type)"
            :hollow="true"
            size="normal"
          >
            <div class="activity-desc">{{ act.description }}</div>
          </el-timeline-item>
        </el-timeline>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import * as echarts from 'echarts'
import { dashboardApi } from '@/api/index.js'
import { Warning } from '@element-plus/icons-vue'

const salesChartRef = ref()
const categoryChartRef = ref()
let salesChart = null
let categoryChart = null

const trendPeriod = ref('month')
const stats = ref({})
const warningList = ref([])
const activities = ref([])
const salesTrend = ref({})
const categoryData = ref([])

const statCards = computed(() => [
  { key: 'totalProducts', label: '商品总数', value: stats.value.totalProducts || 0, icon: 'Goods', color: 'blue', change: '较上月 +12', up: true },
  { key: 'lowStockCount', label: '库存预警', value: stats.value.lowStockCount || 0, icon: 'Warning', color: 'red', change: '需及时补货', up: false },
  { key: 'todayIn', label: '今日入库', value: stats.value.todayIn || 0, icon: 'Download', color: 'green', change: '较昨日 +8%', up: true },
  { key: 'todayOut', label: '今日出库', value: stats.value.todayOut || 0, icon: 'Upload', color: 'orange', change: '较昨日 -3%', up: false },
  { key: 'monthRevenue', label: '本月收入', value: stats.value.monthRevenue ? '¥' + (stats.value.monthRevenue / 10000).toFixed(1) + '万' : '¥0', icon: 'Money', color: 'purple', change: '较上月 +15%', up: true },
  { key: 'activeUsers', label: '在线用户', value: stats.value.activeUsers || 0, icon: 'User', color: 'teal', change: '实时数据', up: true }
])

const activityType = (type) => {
  const map = { in: 'success', out: 'warning', create: 'primary', edit: 'info' }
  return map[type] || 'info'
}

const initSalesChart = () => {
  if (!salesChartRef.value) return
  salesChart = echarts.init(salesChartRef.value)
  const { labels = [], salesData = [], costData = [] } = salesTrend.value
  
  salesChart.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
    legend: { data: ['销售额', '成本'], top: 0, right: 0 },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '40px', containLabel: true },
    xAxis: { type: 'category', data: labels, axisLine: { lineStyle: { color: '#e2e8f0' } }, axisLabel: { color: '#94a3b8' } },
    yAxis: { type: 'value', axisLabel: { color: '#94a3b8', formatter: v => '¥' + (v/1000).toFixed(0) + 'K' }, splitLine: { lineStyle: { color: '#f1f5f9' } } },
    series: [
      {
        name: '销售额',
        type: 'line',
        data: salesData,
        smooth: true,
        lineStyle: { width: 3, color: '#1a56db' },
        itemStyle: { color: '#1a56db' },
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(26,86,219,0.25)' }, { offset: 1, color: 'rgba(26,86,219,0)' }] } }
      },
      {
        name: '成本',
        type: 'line',
        data: costData,
        smooth: true,
        lineStyle: { width: 2, color: '#f59e0b', type: 'dashed' },
        itemStyle: { color: '#f59e0b' }
      }
    ]
  })
}

const initCategoryChart = () => {
  if (!categoryChartRef.value) return
  categoryChart = echarts.init(categoryChartRef.value)
  
  const colors = ['#1a56db', '#0ea5e9', '#10b981', '#f59e0b', '#6366f1', '#ef4444']
  categoryChart.setOption({
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { orient: 'vertical', right: 10, top: 'center', textStyle: { fontSize: 12, color: '#64748b' } },
    series: [{
      type: 'pie',
      radius: ['45%', '70%'],
      center: ['35%', '50%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
      label: { show: false },
      emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' } },
      data: categoryData.value.map((d, i) => ({ ...d, itemStyle: { color: colors[i % colors.length] } }))
    }]
  })
}

const handleResize = () => {
  salesChart?.resize()
  categoryChart?.resize()
}

onMounted(async () => {
  const [statsData, trend, warning, cats, acts] = await Promise.all([
    dashboardApi.getStats(),
    dashboardApi.getSalesTrend(),
    dashboardApi.getStockWarning(),
    dashboardApi.getCategoryStats(),
    dashboardApi.getRecentActivities()
  ])
  
  stats.value = statsData
  salesTrend.value = trend
  warningList.value = warning.list || warning
  categoryData.value = cats
  activities.value = acts.list || acts
  
  setTimeout(() => {
    initSalesChart()
    initCategoryChart()
  }, 100)
  
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  salesChart?.dispose()
  categoryChart?.dispose()
  window.removeEventListener('resize', handleResize)
})
</script>

<style lang="scss" scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

// Stats Grid
.stats-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 16px;
  
  @media (max-width: 1400px) { grid-template-columns: repeat(3, 1fr); }
  @media (max-width: 768px) { grid-template-columns: repeat(2, 1fr); }
}

.stat-card {
  background: #fff;
  border-radius: $radius-md;
  padding: 20px;
  display: flex;
  align-items: flex-start;
  gap: 14px;
  border: 1px solid $gray-200;
  box-shadow: $shadow-sm;
  transition: all $transition;
  
  &:hover { transform: translateY(-2px); box-shadow: $shadow-md; }
  
  .stat-icon {
    width: 44px; height: 44px;
    border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    font-size: 20px;
    flex-shrink: 0;
  }
  
  .stat-value {
    font-size: 22px;
    font-weight: 700;
    color: $gray-800;
    line-height: 1.2;
  }
  
  .stat-label {
    font-size: 12px;
    color: $gray-500;
    margin: 3px 0;
  }
  
  .stat-change {
    font-size: 11px;
    display: flex;
    align-items: center;
    gap: 2px;
    
    &.up { color: $success; }
    &.down { color: $danger; }
  }
  
  &.stat-blue .stat-icon { background: rgba($primary, 0.1); color: $primary; }
  &.stat-red .stat-icon { background: rgba($danger, 0.1); color: $danger; }
  &.stat-green .stat-icon { background: rgba($success, 0.1); color: $success; }
  &.stat-orange .stat-icon { background: rgba($warning, 0.1); color: $warning; }
  &.stat-purple .stat-icon { background: rgba($info, 0.1); color: $info; }
  &.stat-teal .stat-icon { background: rgba($secondary, 0.1); color: $secondary; }
}

// Charts
.charts-row {
  display: grid;
  grid-template-columns: 1fr 360px;
  gap: 20px;
  
  @media (max-width: 1100px) { grid-template-columns: 1fr; }
}

.chart-card {
  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    
    .card-title {
      font-size: 15px;
      font-weight: 600;
      color: $gray-800;
      display: flex;
      align-items: center;
      gap: 6px;
    }
  }
  
  .chart-container {
    height: 280px;
  }
}

// Bottom row
.bottom-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  
  @media (max-width: 900px) { grid-template-columns: 1fr; }
}

.bottom-card {
  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    
    .card-title {
      font-size: 15px;
      font-weight: 600;
      color: $gray-800;
      display: flex;
      align-items: center;
      gap: 6px;
    }
  }
}

.warning-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 280px;
  overflow-y: auto;
  
  .warning-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    background: $gray-50;
    border-radius: $radius;
    border: 1px solid $gray-100;
    
    .warning-name {
      font-size: 13px;
      font-weight: 500;
      color: $gray-700;
    }
    .warning-code { font-size: 11px; color: $gray-400; margin-top: 2px; }
    
    .warning-stock {
      display: flex;
      align-items: center;
      gap: 8px;
      
      .stock-text {
        font-size: 12px;
        font-weight: 600;
        white-space: nowrap;
      }
    }
  }
}

.activity-timeline {
  max-height: 280px;
  overflow-y: auto;
  padding-right: 8px;
  
  .activity-desc {
    font-size: 12px;
    color: $gray-600;
    line-height: 1.5;
  }
}
</style>
