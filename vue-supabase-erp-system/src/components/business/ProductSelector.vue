<template>
  <el-dialog v-model="visible" title="选择商品" width="960px" :close-on-click-modal="false" append-to-body destroy-on-close>
    <div class="selector-toolbar">
      <el-input v-model="keyword" placeholder="商品编码、名称、简称或条码" clearable @keyup.enter="search" @clear="search">
        <template #append><el-button :icon="Search" @click="search">查询</el-button></template>
      </el-input>
      <div v-if="warehouseId" class="selector-toolbar__hint">已启用按仓库库存查看</div>
    </div>

    <el-table v-loading="loading" :data="rows" border stripe height="430" highlight-current-row @row-dblclick="pickOne">
      <el-table-column width="54" align="center">
        <template #default="{ row }"><el-radio v-model="selectedId" :value="row.id" /></template>
      </el-table-column>
      <el-table-column prop="code" label="商品编码" min-width="130" />
      <el-table-column prop="name" label="商品名称" min-width="180" />
      <el-table-column prop="model" label="型号" min-width="120" />
      <el-table-column label="单位" width="100"><template #default="{ row }">{{ row.unit?.name || '-' }}</template></el-table-column>
      <el-table-column label="采购价" width="120" align="right"><template #default="{ row }">{{ formatCurrency(row.purchase_price) }}</template></el-table-column>
      <el-table-column label="销售价" width="120" align="right"><template #default="{ row }">{{ formatCurrency(row.sale_price) }}</template></el-table-column>
      <el-table-column v-if="warehouseId" label="可用库存" width="125" align="right"><template #default="{ row }">{{ formatQty(stockMap[row.id]) }}</template></el-table-column>
    </el-table>

    <div class="selector-pagination">
      <el-pagination v-model:current-page="page" :page-size="pageSize" :total="total" layout="total, prev, pager, next" background @current-change="load" />
    </div>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :disabled="!selectedProduct" @click="confirm">确定选择</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { fetchProductRows, getProductStockSummary } from '@/api/business'
import { formatCurrency, formatNumber } from '@/utils/format'

const props = defineProps({
  modelValue: Boolean,
  warehouseId: { type: String, default: '' }
})
const emit = defineEmits(['update:modelValue', 'select'])

const visible = computed({ get: () => props.modelValue, set: (value) => emit('update:modelValue', value) })
const loading = ref(false)
const keyword = ref('')
const page = ref(1)
const pageSize = 10
const total = ref(0)
const rows = ref([])
const selectedId = ref('')
const stockMap = ref({})
const selectedProduct = computed(() => rows.value.find((item) => item.id === selectedId.value) || null)

function formatQty(value) { return formatNumber(value || 0, 6) }

async function load() {
  loading.value = true
  try {
    const result = await fetchProductRows({ keyword: keyword.value, page: page.value, pageSize })
    rows.value = result.rows
    total.value = result.total
    if (props.warehouseId) {
      const stockEntries = await Promise.all(rows.value.map(async (row) => {
        const summaries = await getProductStockSummary(row.id)
        const matched = summaries.find((item) => item.warehouse_id === props.warehouseId)
        return [row.id, matched?.quantity_available || 0]
      }))
      stockMap.value = Object.fromEntries(stockEntries)
    } else stockMap.value = {}
  } catch (error) {
    ElMessage.error(error.message || '加载商品失败')
  } finally {
    loading.value = false
  }
}

function search() { page.value = 1; load() }
function pickOne(row) { selectedId.value = row.id; confirm() }
function confirm() {
  if (!selectedProduct.value) return ElMessage.warning('请选择商品')
  emit('select', { ...selectedProduct.value, available_stock: stockMap.value[selectedProduct.value.id] || 0 })
  visible.value = false
}

watch(visible, (opened) => {
  if (opened) {
    selectedId.value = ''
    page.value = 1
    load()
  }
})
</script>

<style scoped>
.selector-toolbar { display:flex; align-items:center; gap:14px; margin-bottom:14px; }
.selector-toolbar :deep(.el-input) { max-width: 520px; }
.selector-toolbar__hint { color: var(--el-color-info); font-size: 13px; }
.selector-pagination { display:flex; justify-content:flex-end; padding-top:14px; }
</style>
