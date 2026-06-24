<template>
  <section class="order-line-editor">
    <div class="order-line-editor__toolbar">
      <div>
        <el-button type="primary" plain :icon="Plus" @click="selectorVisible = true">添加商品</el-button>
        <el-button :icon="Delete" :disabled="!selectedRows.length" @click="removeSelected">删除选中</el-button>
        <span class="order-line-editor__hint">支持双击商品添加；表格内按 Tab 可连续录入。</span>
      </div>
      <div v-if="showStock" class="order-line-editor__stock-hint">库存不足的数量会高亮提示</div>
    </div>

    <el-table :data="lines" border stripe max-height="390" @selection-change="selectedRows = $event">
      <el-table-column type="selection" width="48" />
      <el-table-column type="index" label="#" width="52" align="center" />
      <el-table-column label="商品" min-width="210">
        <template #default="{ row }">
          <div class="line-product"><b>{{ row.product_name }}</b><span>{{ row.product_code }}{{ row.model ? ` · ${row.model}` : '' }}</span></div>
        </template>
      </el-table-column>
      <el-table-column label="单位" width="94" align="center"><template #default="{ row }">{{ row.unit_name || '-' }}</template></el-table-column>
      <el-table-column label="数量" width="132" align="right">
        <template #default="{ row }"><el-input-number v-model="row.qty" :min="0.000001" :precision="6" controls-position="right" @change="refresh" /></template>
      </el-table-column>
      <el-table-column label="单价" width="138" align="right">
        <template #default="{ row }"><el-input-number v-model="row.unit_price" :min="0" :precision="4" controls-position="right" @change="refresh" /></template>
      </el-table-column>
      <el-table-column label="折扣%" width="112" align="right">
        <template #default="{ row }"><el-input-number v-model="row.discount_rate" :min="0" :max="100" :precision="2" controls-position="right" @change="refresh" /></template>
      </el-table-column>
      <el-table-column label="税率%" width="108" align="right">
        <template #default="{ row }"><el-input-number v-model="row.tax_rate" :min="0" :max="100" :precision="2" controls-position="right" @change="refresh" /></template>
      </el-table-column>
      <el-table-column label="含税金额" width="135" align="right"><template #default="{ row }">{{ formatCurrency(row.amount_incl_tax) }}</template></el-table-column>
      <el-table-column v-if="showStock" label="可用库存" width="130" align="right">
        <template #default="{ row }"><span :class="{ 'stock-shortage': Number(row.qty) > Number(row.available_stock || 0) }">{{ formatQty(row.available_stock) }}</span></template>
      </el-table-column>
      <el-table-column label="备注" min-width="150"><template #default="{ row }"><el-input v-model="row.remark" maxlength="200" /></template></el-table-column>
    </el-table>

    <div class="order-line-editor__summary">
      <span>合计数量：<b>{{ formatQty(totals.total_qty) }}</b></span>
      <span>折扣：<b>{{ formatCurrency(totals.discount_amount) }}</b></span>
      <span>税额：<b>{{ formatCurrency(totals.tax_amount) }}</b></span>
      <span class="order-line-editor__amount">订单含税金额：<b>{{ formatCurrency(totals.total_amount) }}</b></span>
    </div>

    <ProductSelector v-model="selectorVisible" :warehouse-id="warehouseId" @select="appendProduct" />
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { Delete, Plus } from '@element-plus/icons-vue'
import ProductSelector from '@/components/business/ProductSelector.vue'
import { computeOrderTotals, withOrderAmounts } from '@/api/business'
import { formatCurrency, formatNumber } from '@/utils/format'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  warehouseId: { type: String, default: '' },
  priceField: { type: String, default: 'sale_price' },
  defaultTaxRate: { type: Number, default: 0 },
  isTaxIncluded: { type: Boolean, default: true },
  showStock: Boolean
})
const emit = defineEmits(['update:modelValue', 'change'])
const selectorVisible = ref(false)
const selectedRows = ref([])
const lines = ref([])

const totals = computed(() => computeOrderTotals(lines.value, props.isTaxIncluded))
function formatQty(value) { return formatNumber(value || 0, 6) }
function cloneLines(value) { return (value || []).map((item) => ({ ...item })) }
function refresh() {
  lines.value = lines.value.map((item) => withOrderAmounts({ ...item }, props.isTaxIncluded))
  emit('update:modelValue', cloneLines(lines.value))
  emit('change', totals.value)
}
function appendProduct(product) {
  const existed = lines.value.find((item) => item.product_id === product.id)
  if (existed) {
    existed.qty = Number(existed.qty || 0) + 1
  } else {
    lines.value.push({
      product_id: product.id,
      product_code: product.code,
      product_name: product.name,
      model: product.model || '',
      unit_id: product.base_unit_id,
      unit_name: product.unit?.name || '',
      specification_snapshot: product.specification || '',
      qty: 1,
      unit_price: Number(product[props.priceField] || 0),
      discount_rate: 0,
      tax_rate: Number(product.tax_rate ?? props.defaultTaxRate ?? 0),
      available_stock: product.available_stock || 0,
      remark: ''
    })
  }
  refresh()
}
function removeSelected() {
  const ids = new Set(selectedRows.value.map((item) => item.product_id))
  lines.value = lines.value.filter((item) => !ids.has(item.product_id))
  selectedRows.value = []
  refresh()
}

watch(() => props.modelValue, (value) => { lines.value = cloneLines(value) }, { immediate: true, deep: true })
watch(() => props.isTaxIncluded, refresh)
</script>

<style scoped>
.order-line-editor { border: 1px solid var(--el-border-color-lighter); border-radius: 8px; overflow: hidden; }
.order-line-editor__toolbar { display:flex; justify-content:space-between; gap:12px; padding:12px; background:#fafafa; }
.order-line-editor__hint, .order-line-editor__stock-hint { color:var(--el-text-color-secondary); font-size:12px; margin-left:10px; }
.order-line-editor__summary { display:flex; justify-content:flex-end; gap:20px; align-items:center; padding:12px 16px; background:#fafafa; font-size:13px; }
.order-line-editor__amount { color:var(--el-color-primary); font-size:14px; }
.line-product { display:flex; flex-direction:column; gap:2px; }
.line-product span { color:var(--el-text-color-secondary); font-size:12px; }
.stock-shortage { color:var(--el-color-danger); font-weight:700; }
</style>
