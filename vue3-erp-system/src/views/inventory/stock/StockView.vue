<template>
  <div class="stock-page">
    <div class="page-header">
      <div>
        <div class="page-title">库存操作</div>
        <div class="page-subtitle">记录入库、出库、调拨等库存变动操作</div>
      </div>
      <div style="display:flex; gap:10px">
        <el-button type="success" :icon="Download" @click="openDialog('in')">入库</el-button>
        <el-button type="warning" :icon="Upload" @click="openDialog('out')">出库</el-button>
        <el-button type="info" :icon="Switch" @click="openDialog('transfer')">调拨</el-button>
      </div>
    </div>

    <!-- Stats -->
    <div class="stock-stats">
      <div class="stat-mini" v-for="s in miniStats" :key="s.label" :class="`mini-${s.color}`">
        <el-icon :size="20"><component :is="s.icon" /></el-icon>
        <div class="mini-body">
          <div class="mini-value">{{ s.value }}</div>
          <div class="mini-label">{{ s.label }}</div>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <el-card class="filter-card">
      <el-form :model="query" inline>
        <el-form-item label="操作类型">
          <el-radio-group v-model="query.type" @change="fetchData">
            <el-radio-button label="">全部</el-radio-button>
            <el-radio-button label="in">入库</el-radio-button>
            <el-radio-button label="out">出库</el-radio-button>
            <el-radio-button label="transfer">调拨</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="关键词">
          <el-input v-model="query.keyword" placeholder="商品名称/编码" clearable style="width:200px" :prefix-icon="Search" @keyup.enter="fetchData" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="fetchData">查询</el-button>
          <el-button :icon="Refresh" @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- Records Table -->
    <el-card>
      <el-table :data="tableData" v-loading="loading" stripe class="erp-table">
        <el-table-column prop="orderNo" label="操作单号" width="180" />
        <el-table-column prop="type" label="类型" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="typeTag(row.type)" size="small" round>{{ typeLabel(row.type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="商品信息" min-width="180">
          <template #default="{ row }">
            <div>
              <div style="font-size:13px; font-weight:500">{{ row.productName }}</div>
              <div style="font-size:11px; color:#94a3b8; font-family:monospace">{{ row.productCode }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="quantity" label="数量" width="80" align="center">
          <template #default="{ row }">
            <span :class="row.type === 'in' ? 'qty-in' : row.type === 'out' ? 'qty-out' : 'qty-transfer'">
              {{ row.type === 'in' ? '+' : row.type === 'out' ? '-' : '↔' }}{{ row.quantity }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="单价" width="100">
          <template #default="{ row }">¥{{ row.unitPrice?.toFixed(2) }}</template>
        </el-table-column>
        <el-table-column label="来源/目标仓库" width="200">
          <template #default="{ row }">
            <div v-if="row.type === 'transfer'" style="display:flex; align-items:center; gap:6px">
              <el-tag type="info" size="small">{{ row.fromWarehouse }}</el-tag>
              <el-icon><Right /></el-icon>
              <el-tag type="success" size="small">{{ row.toWarehouse }}</el-tag>
            </div>
            <span v-else>{{ row.type === 'in' ? row.toWarehouse : row.fromWarehouse }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="operator" label="操作人" width="100" />
        <el-table-column prop="remark" label="备注" min-width="150" show-overflow-tooltip />
        <el-table-column prop="createTime" label="操作时间" width="160" />
      </el-table>

      <div class="pagination-wrap">
        <el-pagination
          v-model:current-page="query.page"
          v-model:page-size="query.pageSize"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          @change="fetchData"
        />
      </div>
    </el-card>

    <!-- Operation Dialog -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="520px"
      destroy-on-close
    >
      <el-alert
        :type="opType === 'in' ? 'success' : opType === 'out' ? 'warning' : 'info'"
        :description="opDescriptions[opType]"
        show-icon
        :closable="false"
        style="margin-bottom: 20px"
      />

      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="商品名称" prop="productName">
          <el-input v-model="form.productName" placeholder="输入商品名称" />
        </el-form-item>
        <el-form-item label="商品编码" prop="productCode">
          <el-input v-model="form.productCode" placeholder="商品SKU编码" />
        </el-form-item>
        <el-form-item label="数量" prop="quantity">
          <el-input-number v-model="form.quantity" :min="1" style="width:100%" />
        </el-form-item>
        <el-form-item label="单价">
          <el-input-number v-model="form.unitPrice" :min="0" :precision="2" style="width:100%" />
        </el-form-item>
        <el-form-item v-if="opType !== 'in'" label="来源仓库" prop="fromWarehouse">
          <el-select v-model="form.fromWarehouse" style="width:100%">
            <el-option v-for="w in warehouses" :key="w" :label="w" :value="w" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="opType !== 'out'" label="目标仓库" prop="toWarehouse">
          <el-select v-model="form.toWarehouse" style="width:100%">
            <el-option v-for="w in warehouses" :key="w" :label="w" :value="w" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="操作备注（可选）" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button
          :type="opType === 'in' ? 'success' : opType === 'out' ? 'warning' : 'primary'"
          :loading="submitting"
          @click="submitForm"
        >确认{{ typeLabel(opType) }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Download, Upload, Switch, Search, Refresh, Right } from '@element-plus/icons-vue'
import { stockApi } from '@/api/index.js'

const loading = ref(false)
const submitting = ref(false)
const tableData = ref([])
const total = ref(0)
const dialogVisible = ref(false)
const opType = ref('in')
const formRef = ref()
const statsData = ref({})

const query = reactive({ type: '', keyword: '', page: 1, pageSize: 10 })
const warehouses = ['A仓库', 'B仓库', 'C仓库', '中心仓']

const form = reactive({
  productName: '', productCode: '', quantity: 1, unitPrice: 0,
  fromWarehouse: 'A仓库', toWarehouse: 'B仓库', remark: ''
})

const opDescriptions = {
  in: '将商品从外部采购或退货录入仓库，增加库存数量',
  out: '将商品从仓库发出用于销售、生产或报废，减少库存',
  transfer: '将商品在不同仓库之间转移，总库存不变'
}

const rules = {
  productName: [{ required: true, message: '请输入商品名称', trigger: 'blur' }],
  productCode: [{ required: true, message: '请输入商品编码', trigger: 'blur' }],
  quantity: [{ required: true, message: '请输入数量', trigger: 'blur' }]
}

const miniStats = computed(() => [
  { label: '本月入库量', value: statsData.value.totalIn || 0, icon: 'Download', color: 'green' },
  { label: '本月出库量', value: statsData.value.totalOut || 0, icon: 'Upload', color: 'orange' },
  { label: '调拨次数', value: statsData.value.totalTransfer || 0, icon: 'Switch', color: 'blue' }
])

const dialogTitle = computed(() => {
  const map = { in: '📦 入库操作', out: '🚚 出库操作', transfer: '🔄 调拨操作' }
  return map[opType.value]
})

const typeLabel = (type) => ({ in: '入库', out: '出库', transfer: '调拨' }[type] || '')
const typeTag = (type) => ({ in: 'success', out: 'warning', transfer: 'primary' }[type] || 'info')

const openDialog = (type) => {
  opType.value = type
  Object.assign(form, { productName: '', productCode: '', quantity: 1, unitPrice: 0, fromWarehouse: 'A仓库', toWarehouse: 'B仓库', remark: '' })
  dialogVisible.value = true
}

const fetchData = async () => {
  loading.value = true
  try {
    const res = await stockApi.getList(query)
    tableData.value = res.list
    total.value = res.total
  } finally {
    loading.value = false
  }
}

const resetQuery = () => {
  query.type = ''
  query.keyword = ''
  query.page = 1
  fetchData()
}

const submitForm = async () => {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  submitting.value = true
  try {
    await stockApi.create({ ...form, type: opType.value })
    ElMessage.success(`${typeLabel(opType.value)}操作成功`)
    dialogVisible.value = false
    fetchData()
    loadStats()
  } finally {
    submitting.value = false
  }
}

const loadStats = async () => {
  const res = await stockApi.getStats()
  statsData.value = res
}

onMounted(() => {
  fetchData()
  loadStats()
})
</script>

<style lang="scss" scoped>
.stock-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stock-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.stat-mini {
  background: #fff;
  border-radius: $radius-md;
  padding: 16px 20px;
  border: 1px solid $gray-200;
  display: flex;
  align-items: center;
  gap: 14px;
  
  .mini-body {
    .mini-value { font-size: 24px; font-weight: 700; color: $gray-800; }
    .mini-label { font-size: 12px; color: $gray-500; margin-top: 2px; }
  }
  
  &.mini-green { .el-icon { color: $success; } border-left: 3px solid $success; }
  &.mini-orange { .el-icon { color: $warning; } border-left: 3px solid $warning; }
  &.mini-blue { .el-icon { color: $primary; } border-left: 3px solid $primary; }
}

.filter-card { :deep(.el-card__body) { padding: 16px 20px 0; } }

.qty-in { color: $success; font-weight: 600; }
.qty-out { color: $danger; font-weight: 600; }
.qty-transfer { color: $info; font-weight: 600; }

.pagination-wrap {
  display: flex;
  justify-content: flex-end;
  padding-top: 16px;
}
</style>
