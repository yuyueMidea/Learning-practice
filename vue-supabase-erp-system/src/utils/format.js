export function formatNumber(value, options = {}) {
  const number = Number(value)
  if (!Number.isFinite(number)) return options.emptyText ?? '-'

  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: options.minimumFractionDigits ?? 0,
    maximumFractionDigits: options.maximumFractionDigits ?? 2
  }).format(number)
}

export function formatCurrency(value, currency = 'CNY') {
  const number = Number(value)
  if (!Number.isFinite(number)) return '-'

  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(number)
}

function toDate(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatDate(value, options = {}) {
  const date = toDate(value)
  if (!date) return options.emptyText ?? '-'

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...options
  }).format(date)
}

export function formatDateTime(value, options = {}) {
  const date = toDate(value)
  if (!date) return options.emptyText ?? '-'

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    ...options
  }).format(date)
}

export function formatFileSize(bytes) {
  const value = Number(bytes)
  if (!Number.isFinite(value) || value < 0) return '-'
  if (value === 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1)
  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 2)} ${units[index]}`
}

export function statusTagType(status) {
  const map = {
    active: 'success',
    inactive: 'info',
    locked: 'danger',
    draft: 'info',
    submitted: 'warning',
    under_review: 'warning',
    approved: 'success',
    partial_received: 'warning',
    partial_delivered: 'warning',
    completed: 'success',
    closed: 'info',
    rejected: 'danger',
    posted: 'success',
    cancelled: 'info'
  }
  return map[status] || 'info'
}

export function statusLabel(status) {
  const map = {
    active: '启用',
    inactive: '停用',
    locked: '锁定',
    draft: '草稿',
    submitted: '已提交',
    under_review: '审核中',
    approved: '已审核',
    partial_received: '部分收货',
    partial_delivered: '部分发货',
    completed: '已完成',
    closed: '已关闭',
    rejected: '已驳回',
    posted: '已过账',
    cancelled: '已取消'
  }
  return map[status] || status || '-'
}
