import Mock from 'mockjs'

const { Random } = Mock

const operationTypes = { in: '入库', out: '出库', transfer: '调拨' }
const warehouses = ['A仓库', 'B仓库', 'C仓库', '中心仓']

let stockRecords = Mock.mock({
  'list|50': [{
    'id|+1': 1,
    'type|1': ['in', 'out', 'transfer'],
    productName: () => Random.pick(['笔记本电脑', '办公椅', '复印纸', '墨盒', '鼠标', '键盘', '显示器']),
    productCode: () => 'SKU' + Random.string('0123456789ABCDEF', 8),
    'quantity|1-500': 1,
    'unitPrice|10-999.2': 1,
    'fromWarehouse|1': warehouses,
    'toWarehouse|1': warehouses,
    operator: () => Random.cname(),
    remark: () => Random.cparagraph(1),
    orderNo: () => 'OP' + Date.now() + Random.string('0123456789', 4),
    createTime: () => Random.datetime('yyyy-MM-dd HH:mm:ss')
  }]
}).list

Mock.mock(/\/api\/stock(\?.*)?$/, 'get', (options) => {
  const url = new URL('http://x.com' + options.url)
  const page = parseInt(url.searchParams.get('page') || '1')
  const pageSize = parseInt(url.searchParams.get('pageSize') || '10')
  const type = url.searchParams.get('type') || ''
  const keyword = url.searchParams.get('keyword') || ''

  let filtered = [...stockRecords]
  if (type) filtered = filtered.filter(r => r.type === type)
  if (keyword) filtered = filtered.filter(r => r.productName.includes(keyword) || r.productCode.includes(keyword))

  // Sort by createTime desc
  filtered.sort((a, b) => new Date(b.createTime) - new Date(a.createTime))

  const total = filtered.length
  const list = filtered.slice((page - 1) * pageSize, page * pageSize)
  return { code: 200, data: { list, total, page, pageSize }, message: 'success' }
})

Mock.mock('/api/stock', 'post', (options) => {
  const body = JSON.parse(options.body)
  const newRecord = {
    ...body,
    id: Date.now(),
    orderNo: 'OP' + Date.now(),
    operator: '当前用户',
    createTime: new Date().toLocaleString('zh-CN')
  }
  stockRecords.unshift(newRecord)
  return { code: 200, data: newRecord, message: `${operationTypes[body.type]}操作成功` }
})

// Stock stats
Mock.mock('/api/stock/stats', 'get', () => {
  return {
    code: 200,
    data: {
      totalIn: stockRecords.filter(r => r.type === 'in').reduce((s, r) => s + r.quantity, 0),
      totalOut: stockRecords.filter(r => r.type === 'out').reduce((s, r) => s + r.quantity, 0),
      totalTransfer: stockRecords.filter(r => r.type === 'transfer').length,
      recentRecords: stockRecords.slice(0, 5)
    },
    message: 'success'
  }
})
