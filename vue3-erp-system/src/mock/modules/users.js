import Mock from 'mockjs'

const { Random } = Mock

let userList = Mock.mock({
  'list|20': [{
    'id|+1': 1,
    name: () => Random.cname(),
    username: () => Random.word(5, 10),
    email: () => Random.email(),
    phone: /1[3-9]\d{9}/,
    'roleId|1': [1, 2, 3],
    'roleName|1': ['超级管理员', '普通员工', '仓库管理员'],
    dept: () => Random.pick(['信息技术部', '采购部', '销售部', '财务部', '运营部', '仓储部']),
    'status|1': [0, 1],
    createTime: () => Random.datetime('yyyy-MM-dd HH:mm:ss'),
    lastLogin: () => Random.datetime('yyyy-MM-dd HH:mm:ss')
  }]
}).list

// Add fixed admin
userList.unshift({
  id: 0,
  name: '系统管理员',
  username: 'admin',
  email: 'admin@erp.com',
  phone: '13800138000',
  roleId: 1,
  roleName: '超级管理员',
  dept: '信息技术部',
  status: 1,
  createTime: '2024-01-01 00:00:00',
  lastLogin: '2025-04-28 09:00:00'
})

// Get user list
Mock.mock(/\/api\/users(\?.*)?$/, 'get', (options) => {
  const url = new URL('http://x.com' + options.url)
  const page = parseInt(url.searchParams.get('page') || '1')
  const pageSize = parseInt(url.searchParams.get('pageSize') || '10')
  const keyword = url.searchParams.get('keyword') || ''
  const status = url.searchParams.get('status')

  let filtered = [...userList]
  if (keyword) {
    filtered = filtered.filter(u =>
      u.name.includes(keyword) || u.username.includes(keyword) || u.email.includes(keyword)
    )
  }
  if (status !== null && status !== '') {
    filtered = filtered.filter(u => u.status === parseInt(status))
  }

  const total = filtered.length
  const start = (page - 1) * pageSize
  const list = filtered.slice(start, start + pageSize)

  return { code: 200, data: { list, total, page, pageSize }, message: 'success' }
})

// Create user
Mock.mock('/api/users', 'post', (options) => {
  const body = JSON.parse(options.body)
  const newUser = {
    ...body,
    id: Date.now(),
    createTime: new Date().toLocaleString('zh-CN'),
    lastLogin: '-'
  }
  userList.push(newUser)
  return { code: 200, data: newUser, message: '创建成功' }
})

// Update user
Mock.mock(/\/api\/users\/\d+/, 'put', (options) => {
  const id = parseInt(options.url.split('/').pop())
  const body = JSON.parse(options.body)
  const idx = userList.findIndex(u => u.id === id)
  if (idx !== -1) {
    userList[idx] = { ...userList[idx], ...body }
    return { code: 200, data: userList[idx], message: '更新成功' }
  }
  return { code: 404, message: '用户不存在', data: null }
})

// Delete user
Mock.mock(/\/api\/users\/\d+/, 'delete', (options) => {
  const id = parseInt(options.url.split('/').pop())
  const idx = userList.findIndex(u => u.id === id)
  if (idx !== -1) {
    userList.splice(idx, 1)
    return { code: 200, data: null, message: '删除成功' }
  }
  return { code: 404, message: '用户不存在', data: null }
})

// Toggle status
Mock.mock(/\/api\/users\/\d+\/status/, 'patch', (options) => {
  const id = parseInt(options.url.split('/')[3])
  const body = JSON.parse(options.body)
  const user = userList.find(u => u.id === id)
  if (user) {
    user.status = body.status
    return { code: 200, data: user, message: '状态更新成功' }
  }
  return { code: 404, message: '用户不存在', data: null }
})
