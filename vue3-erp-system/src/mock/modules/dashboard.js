import Mock from 'mockjs'

const { Random } = Mock

Mock.mock('/api/dashboard/stats', 'get', () => {
  return {
    code: 200,
    data: {
      totalProducts: Random.integer(200, 500),
      lowStockCount: Random.integer(5, 20),
      todayIn: Random.integer(10, 100),
      todayOut: Random.integer(5, 80),
      monthRevenue: Random.float(100000, 999999, 2, 2),
      monthOrders: Random.integer(100, 500),
      activeUsers: Random.integer(10, 50),
      pendingTasks: Random.integer(1, 15)
    },
    message: 'success'
  }
})

Mock.mock('/api/dashboard/sales-trend', 'get', () => {
  const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
  const currentMonth = new Date().getMonth()
  const labels = []
  const salesData = []
  const costData = []

  for (let i = 11; i >= 0; i--) {
    const idx = (currentMonth - i + 12) % 12
    labels.push(months[idx])
    salesData.push(Random.integer(80000, 300000))
    costData.push(Random.integer(50000, 200000))
  }

  return {
    code: 200,
    data: { labels, salesData, costData },
    message: 'success'
  }
})

Mock.mock('/api/dashboard/stock-warning', 'get', () => {
  return {
    code: 200,
    data: Mock.mock({
      'list|8': [{
        'id|+1': 1,
        name: () => Mock.Random.pick(['复印纸A4', '墨盒HP803', '办公椅', '鼠标罗技', '键盘机械', 'U盘16G', '订书机', '剪刀']),
        code: () => 'SKU' + Mock.Random.string('0123456789', 6),
        'stock|1-30': 1,
        'minStock|31-50': 1,
        'category|1': ['办公用品', '电子产品', '耗材']
      }]
    }).list,
    message: 'success'
  }
})

Mock.mock('/api/dashboard/category-stats', 'get', () => {
  return {
    code: 200,
    data: [
      { name: '电子产品', value: Random.integer(50, 150) },
      { name: '办公用品', value: Random.integer(80, 200) },
      { name: '日用消耗品', value: Random.integer(30, 100) },
      { name: '工业原料', value: Random.integer(20, 80) },
      { name: '包装材料', value: Random.integer(15, 60) },
      { name: '机械零件', value: Random.integer(10, 50) }
    ],
    message: 'success'
  }
})

Mock.mock('/api/dashboard/recent-activities', 'get', () => {
  return {
    code: 200,
    data: Mock.mock({
      'list|10': [{
        'id|+1': 1,
        'type|1': ['in', 'out', 'create', 'edit'],
        description: () => Mock.Random.pick([
          '张晓明 执行了入库操作，商品：复印纸A4，数量：100箱',
          '李华 完成出库操作，商品：鼠标罗技，数量：50个',
          '系统管理员 新增用户：王芳',
          '仓管员小刘 调拨商品至B仓库',
          '王经理 修改了商品定价',
          '系统 检测到库存预警：墨盒库存不足'
        ]),
        time: () => Mock.Random.datetime('yyyy-MM-dd HH:mm:ss')
      }]
    }).list,
    message: 'success'
  }
})
