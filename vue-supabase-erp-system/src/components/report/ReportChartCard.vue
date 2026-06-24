<template>
  <el-card shadow="never" class="report-chart-card">
    <template #header>
      <div class="report-chart-card__header">
        <div>
          <h3>{{ title }}</h3>
          <p v-if="description">{{ description }}</p>
        </div>
        <el-button text :icon="Download" @click="exportImage">导出图片</el-button>
      </div>
    </template>
    <EChart ref="chart" :option="option" :loading="loading" @click="$emit('click', $event)" />
  </el-card>
</template>

<script setup>
import { ref } from 'vue'
import { Download } from '@element-plus/icons-vue'
import EChart from '@/components/common/EChart.vue'

const props = defineProps({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  option: { type: Object, required: true },
  loading: Boolean,
  filename: { type: String, default: '报表图表.png' }
})

defineEmits(['click'])

const chart = ref(null)
function exportImage() {
  chart.value?.exportImage(props.filename)
}

defineExpose({ exportImage })
</script>

<style scoped>
.report-chart-card { height: 100%; }
.report-chart-card__header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.report-chart-card__header h3 { margin: 0; font-size: 15px; }
.report-chart-card__header p { margin: 4px 0 0; color: var(--el-text-color-secondary); font-size: 12px; }
</style>
