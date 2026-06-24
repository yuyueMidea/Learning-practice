import * as XLSX from 'xlsx'

function normalizeRows(rows = []) {
  return rows.map((row) =>
    Object.entries(row || {}).reduce((record, [key, value]) => {
      const normalizedKey = String(key || '').replace(/^\uFEFF/, '').trim()
      record[normalizedKey] = value === undefined || value === null ? '' : value
      return record
    }, {})
  )
}

export function exportRowsToExcel(rows = [], columns = [], filename = '导出数据.xlsx', sheetName = '数据') {
  const sourceRows = Array.isArray(rows) ? rows : []
  if (!sourceRows.length) return false

  const data = sourceRows.map((row) => {
    if (!columns.length) return row

    return columns.reduce((record, column) => {
      if (!column.prop || column.exportable === false) return record
      const rawValue = row?.[column.prop]
      record[column.label || column.prop] = typeof column.formatter === 'function'
        ? column.formatter(row, column, rawValue)
        : rawValue ?? ''
      return record
    }, {})
  })

  const worksheet = XLSX.utils.json_to_sheet(data)
  worksheet['!cols'] = Object.keys(data[0] || {}).map((key) => ({ wch: Math.max(12, String(key).length * 2 + 4) }))
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  XLSX.writeFile(workbook, filename)
  return true
}

export function downloadImportTemplate(columns = [], filename = '导入模板.xlsx', sheetName = '导入模板') {
  const headerRow = columns.reduce((record, column) => {
    if (column.key && column.label) record[column.label] = column.example ?? ''
    return record
  }, {})

  const noteRow = columns.reduce((record, column) => {
    if (column.key && column.label) record[column.label] = column.required ? '必填' : (column.note || '')
    return record
  }, {})

  const worksheet = XLSX.utils.json_to_sheet([headerRow, noteRow])
  worksheet['!cols'] = columns.map((column) => ({ wch: Math.max(12, String(column.label || '').length * 2 + 4) }))
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  XLSX.writeFile(workbook, filename)
}

export async function parseExcelFile(file, { sheetIndex = 0, maxRows = 5000, skipRows = 0 } = {}) {
  if (!(file instanceof File)) throw new Error('请选择有效的 Excel 文件')
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (!['xlsx', 'xls', 'csv'].includes(extension)) throw new Error('仅支持 .xlsx、.xls、.csv 文件')

  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const sheetName = workbook.SheetNames[sheetIndex]
  if (!sheetName) throw new Error('Excel 中没有可读取的工作表')

  const worksheet = workbook.Sheets[sheetName]
  const rows = normalizeRows(XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false })).slice(skipRows)
  if (rows.length > maxRows) throw new Error(`单次最多导入 ${maxRows} 行，请拆分文件后再试`)
  return rows
}
