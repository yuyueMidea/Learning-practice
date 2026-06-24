<template>
  <v-chart
    ref="chartRef"
    :option="option"
    :autoresize="true"
    :loading="loading"
    :theme="theme"
    :init-options="initOptions"
    class="e-chart"
    @click="$emit('click', $event)"
  />
</template>

<script setup>
import { ref } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart, LineChart, PieChart } from 'echarts/charts'
import {
  AriaComponent,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  ToolboxComponent,
  TooltipComponent
} from 'echarts/components'

use([
  CanvasRenderer,
  BarChart,
  LineChart,
  PieChart,
  AriaComponent,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  ToolboxComponent,
  TooltipComponent
])

const props = defineProps({
  option: {
    type: Object,
    required: true
  },
  loading: Boolean,
  theme: {
    type: [String, Object],
    default: null
  },
  initOptions: {
    type: Object,
    default: () => ({ renderer: 'canvas' })
  }
})

defineEmits(['click'])

const chartRef = ref(null)

function exportImage(filename = 'chart.png') {
  const chart = chartRef.value?.getInstance?.()
  if (!chart) return false

  const dataUrl = chart.getDataURL({
    type: 'png',
    pixelRatio: 2,
    backgroundColor: '#ffffff'
  })
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = filename
  link.click()
  return true
}

function getInstance() {
  return chartRef.value?.getInstance?.() || null
}

defineExpose({ exportImage, getInstance, option: props.option })
</script>

<style scoped>
.e-chart {
  width: 100%;
  height: 100%;
  min-height: 280px;
}
</style>
