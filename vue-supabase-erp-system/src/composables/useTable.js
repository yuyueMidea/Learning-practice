import { reactive, ref, toRaw } from 'vue'
import { ElMessage } from 'element-plus'
import { exportRowsToExcel } from '@/utils/excel'

function clone(value) {
  return JSON.parse(JSON.stringify(value || {}))
}

export function useTable(fetcher, options = {}) {
  if (typeof fetcher !== 'function') {
    throw new Error('useTable 的第一个参数必须是异步数据加载函数')
  }

  const loading = ref(false)
  const rows = ref([])
  const total = ref(0)
  const query = reactive(clone(options.initialQuery || {}))
  const initialQuery = clone(options.initialQuery || {})
  const pagination = reactive({
    page: 1,
    pageSize: options.pageSize || 20,
    total: 0
  })
  const sorter = reactive({
    prop: options.defaultSort?.prop || '',
    order: options.defaultSort?.order || ''
  })

  async function load(extraParams = {}) {
    loading.value = true
    try {
      const result = await fetcher({
        page: pagination.page,
        pageSize: pagination.pageSize,
        query: clone(toRaw(query)),
        sorter: clone(toRaw(sorter)),
        ...extraParams
      })

      rows.value = result?.rows || result?.data || []
      total.value = Number(result?.total ?? result?.count ?? rows.value.length)
      pagination.total = total.value
      return result
    } finally {
      loading.value = false
    }
  }

  async function search() {
    pagination.page = 1
    return load()
  }

  async function reset() {
    Object.keys(query).forEach((key) => delete query[key])
    Object.assign(query, clone(initialQuery))
    pagination.page = 1
    return load()
  }

  async function changePage(page) {
    pagination.page = page
    return load()
  }

  async function changePageSize(pageSize) {
    pagination.pageSize = pageSize
    pagination.page = 1
    return load()
  }

  async function changeSort({ prop, order }) {
    sorter.prop = prop || ''
    sorter.order = order || ''
    pagination.page = 1
    return load()
  }

  function exportExcel({ filename = '导出数据.xlsx', columns = [] } = {}) {
    const exportRows = rows.value.map((row) => {
      if (!columns.length) return row

      return columns.reduce((record, column) => {
        if (column.exportable === false) return record
        const value = column.formatter
          ? column.formatter(row, column, row[column.prop])
          : row[column.prop]
        record[column.label || column.prop] = value ?? ''
        return record
      }, {})
    })

    if (!exportRows.length) {
      ElMessage.warning('暂无可导出的数据')
      return
    }

    exportRowsToExcel(exportRows, [], filename, '数据')
  }

  return reactive({
    loading,
    rows,
    total,
    query,
    pagination,
    sorter,
    load,
    search,
    reset,
    changePage,
    changePageSize,
    changeSort,
    exportExcel
  })
}
