import { formatCurrency, formatNumber } from '@/utils/format'

export function toDateString(value = new Date()) {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function recentDateRange(days = 30) {
  const end = new Date()
  const start = new Date(end)
  start.setDate(end.getDate() - Math.max(days - 1, 0))
  return [toDateString(start), toDateString(end)]
}

export function number(value) {
  const result = Number(value)
  return Number.isFinite(result) ? result : 0
}

export function groupBy(rows = [], keyGetter) {
  return rows.reduce((map, row) => {
    const key = keyGetter(row)
    const list = map.get(key) || []
    list.push(row)
    map.set(key, list)
    return map
  }, new Map())
}

export function sum(rows = [], field) {
  return rows.reduce((total, row) => total + number(typeof field === 'function' ? field(row) : row?.[field]), 0)
}

export function sortByValue(rows = [], field, descending = true) {
  return [...rows].sort((a, b) => {
    const left = number(typeof field === 'function' ? field(a) : a?.[field])
    const right = number(typeof field === 'function' ? field(b) : b?.[field])
    return descending ? right - left : left - right
  })
}

export function lineOption({ labels = [], series = [], valueFormatter = (value) => formatNumber(value), legend = true } = {}) {
  return {
    tooltip: {
      trigger: 'axis',
      valueFormatter
    },
    legend: { show: legend, top: 0 },
    grid: { left: 16, right: 20, top: legend ? 48 : 28, bottom: 36, containLabel: true },
    xAxis: { type: 'category', data: labels, boundaryGap: false, axisLabel: { hideOverlap: true } },
    yAxis: { type: 'value', axisLabel: { formatter: valueFormatter } },
    dataZoom: labels.length > 12 ? [{ type: 'inside' }, { type: 'slider', height: 18, bottom: 8 }] : [],
    series: series.map((item) => ({
      type: 'line',
      smooth: true,
      showSymbol: false,
      emphasis: { focus: 'series' },
      ...item
    }))
  }
}

export function barOption({ labels = [], values = [], seriesName = '金额', horizontal = false, valueFormatter = (value) => formatNumber(value) } = {}) {
  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      valueFormatter
    },
    grid: { left: 16, right: 22, top: 20, bottom: horizontal ? 18 : 44, containLabel: true },
    xAxis: horizontal
      ? { type: 'value', axisLabel: { formatter: valueFormatter } }
      : { type: 'category', data: labels, axisLabel: { rotate: labels.some((item) => String(item).length > 6) ? 28 : 0, hideOverlap: true } },
    yAxis: horizontal
      ? { type: 'category', data: labels, axisLabel: { width: 110, overflow: 'truncate' } }
      : { type: 'value', axisLabel: { formatter: valueFormatter } },
    dataZoom: labels.length > 12 ? [{ type: 'inside' }] : [],
    series: [{ name: seriesName, type: 'bar', data: values, barMaxWidth: 34, emphasis: { focus: 'series' } }]
  }
}

export function pieOption({ data = [], valueFormatter = (value) => formatCurrency(value) } = {}) {
  return {
    tooltip: { trigger: 'item', valueFormatter },
    legend: { type: 'scroll', bottom: 0 },
    series: [{
      type: 'pie',
      radius: ['42%', '72%'],
      center: ['50%', '45%'],
      avoidLabelOverlap: true,
      itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
      label: { formatter: '{b}\n{d}%' },
      data
    }]
  }
}
