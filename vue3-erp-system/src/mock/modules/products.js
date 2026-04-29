import Mock from 'mockjs'

const { Random } = Mock

const categories = ['电子产品', '办公用品', '日用消耗品', '工业原料', '包装材料', '机械零件']
const units = ['个', '箱', '件', '套', '吨', '千克', 'L', 'm²']
const warehouses = ['A仓库', 'B仓库', 'C仓库', '中心仓']

let productList = Mock.mock({
  'list|30': [{
    'id|+1': 1,
    name: () => Random.pick(['笔记本电脑', '办公椅', '复印纸', '墨盒', '鼠标', '键盘', '显示器', '工业润滑油', '包装箱', '螺丝刀套装', '电缆线', '安全帽', '防护手套', '存储硬盘', '网络交换机']) + Random.word(3, 6),
    code: () => 'SKU' + Random.string('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 8),
    'category|1': categories,
    'unit|1': units,
    'price|10-9999.2': 1,
    'costPrice|5-5000.2': 1,
    'stock|0-500': 1,
    'minStock|5-50': 1,
    'maxStock|100-1000': 1,
    'warehouse|1': warehouses,
    description: () => Random.cparagraph(1, 2),
    'status|1': [0, 1],
    createTime: () => Random.datetime('yyyy-MM-dd HH:mm:ss'),
    images: [],
    skus: () => {
      return Mock.mock({
        'list|2-4': [{
          'id|+1': Math.floor(Math.random() * 10000),
          specName: () => Random.pick(['颜色', '尺寸', '规格']) + ':' + Random.pick(['红色', '蓝色', 'S码', 'M码', 'L码', '标准版', '专业版']),
          code: () => 'SKU' + Random.string('0123456789', 6),
          'price|10-9999.2': 1,
          'stock|0-200': 1
        }]
      }).list
    }
  }]
}).list

Mock.mock(/\/api\/products(\?.*)?$/, 'get', (options) => {
  const url = new URL('http://x.com' + options.url)
  const page = parseInt(url.searchParams.get('page') || '1')
  const pageSize = parseInt(url.searchParams.get('pageSize') || '10')
  const keyword = url.searchParams.get('keyword') || ''
  const category = url.searchParams.get('category') || ''
  const status = url.searchParams.get('status')

  let filtered = [...productList]
  if (keyword) filtered = filtered.filter(p => p.name.includes(keyword) || p.code.includes(keyword))
  if (category) filtered = filtered.filter(p => p.category === category)
  if (status !== null && status !== '') filtered = filtered.filter(p => p.status === parseInt(status))

  const total = filtered.length
  const list = filtered.slice((page - 1) * pageSize, page * pageSize)
  return { code: 200, data: { list, total, page, pageSize, categories }, message: 'success' }
})

Mock.mock('/api/products', 'post', (options) => {
  const body = JSON.parse(options.body)
  const newProduct = {
    ...body,
    id: Date.now(),
    code: 'SKU' + Math.random().toString(36).substring(2, 10).toUpperCase(),
    stock: 0,
    createTime: new Date().toLocaleString('zh-CN')
  }
  productList.unshift(newProduct)
  return { code: 200, data: newProduct, message: '创建成功' }
})

Mock.mock(/\/api\/products\/\d+/, 'put', (options) => {
  const id = parseInt(options.url.split('/').pop())
  const body = JSON.parse(options.body)
  const idx = productList.findIndex(p => p.id === id)
  if (idx !== -1) {
    productList[idx] = { ...productList[idx], ...body }
    return { code: 200, data: productList[idx], message: '更新成功' }
  }
  return { code: 404, message: '商品不存在', data: null }
})

Mock.mock(/\/api\/products\/\d+/, 'delete', (options) => {
  const id = parseInt(options.url.split('/').pop())
  const idx = productList.findIndex(p => p.id === id)
  if (idx !== -1) {
    productList.splice(idx, 1)
    return { code: 200, data: null, message: '删除成功' }
  }
  return { code: 404, message: '商品不存在', data: null }
})

export { productList }
