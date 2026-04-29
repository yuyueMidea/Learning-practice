import Mock from 'mockjs'

let roleList = [
  {
    id: 1,
    name: '超级管理员',
    code: 'ADMIN',
    description: '拥有所有系统权限',
    status: 1,
    permissions: ['dashboard', 'system', 'system:user', 'system:user:create', 'system:user:edit', 'system:user:delete', 'system:role', 'system:role:create', 'system:role:edit', 'inventory', 'inventory:product', 'inventory:stock'],
    createTime: '2024-01-01 00:00:00',
    userCount: 3
  },
  {
    id: 2,
    name: '普通员工',
    code: 'EMPLOYEE',
    description: '基本业务操作权限',
    status: 1,
    permissions: ['dashboard', 'inventory', 'inventory:product', 'inventory:stock'],
    createTime: '2024-01-05 00:00:00',
    userCount: 15
  },
  {
    id: 3,
    name: '仓库管理员',
    code: 'WAREHOUSE',
    description: '仓库及库存管理权限',
    status: 1,
    permissions: ['dashboard', 'inventory', 'inventory:product', 'inventory:product:create', 'inventory:product:edit', 'inventory:stock', 'inventory:stock:in', 'inventory:stock:out'],
    createTime: '2024-01-10 00:00:00',
    userCount: 8
  }
]

const allPermissions = [
  {
    id: 'dashboard',
    name: '仪表盘',
    code: 'dashboard',
    type: 'menu',
    children: []
  },
  {
    id: 'system',
    name: '系统管理',
    code: 'system',
    type: 'menu',
    children: [
      {
        id: 'system:user',
        name: '用户管理',
        code: 'system:user',
        type: 'menu',
        children: [
          { id: 'system:user:create', name: '新增用户', code: 'system:user:create', type: 'btn' },
          { id: 'system:user:edit', name: '编辑用户', code: 'system:user:edit', type: 'btn' },
          { id: 'system:user:delete', name: '删除用户', code: 'system:user:delete', type: 'btn' }
        ]
      },
      {
        id: 'system:role',
        name: '角色管理',
        code: 'system:role',
        type: 'menu',
        children: [
          { id: 'system:role:create', name: '新增角色', code: 'system:role:create', type: 'btn' },
          { id: 'system:role:edit', name: '编辑角色', code: 'system:role:edit', type: 'btn' },
          { id: 'system:role:delete', name: '删除角色', code: 'system:role:delete', type: 'btn' }
        ]
      }
    ]
  },
  {
    id: 'inventory',
    name: '库存管理',
    code: 'inventory',
    type: 'menu',
    children: [
      {
        id: 'inventory:product',
        name: '商品管理',
        code: 'inventory:product',
        type: 'menu',
        children: [
          { id: 'inventory:product:create', name: '新增商品', code: 'inventory:product:create', type: 'btn' },
          { id: 'inventory:product:edit', name: '编辑商品', code: 'inventory:product:edit', type: 'btn' },
          { id: 'inventory:product:delete', name: '删除商品', code: 'inventory:product:delete', type: 'btn' }
        ]
      },
      {
        id: 'inventory:stock',
        name: '库存操作',
        code: 'inventory:stock',
        type: 'menu',
        children: [
          { id: 'inventory:stock:in', name: '入库操作', code: 'inventory:stock:in', type: 'btn' },
          { id: 'inventory:stock:out', name: '出库操作', code: 'inventory:stock:out', type: 'btn' },
          { id: 'inventory:stock:transfer', name: '调拨操作', code: 'inventory:stock:transfer', type: 'btn' }
        ]
      }
    ]
  }
]

Mock.mock('/api/roles', 'get', () => {
  return { code: 200, data: { list: roleList, total: roleList.length }, message: 'success' }
})

Mock.mock('/api/roles/permissions', 'get', () => {
  return { code: 200, data: allPermissions, message: 'success' }
})

Mock.mock('/api/roles', 'post', (options) => {
  const body = JSON.parse(options.body)
  const newRole = { ...body, id: Date.now(), createTime: new Date().toLocaleString('zh-CN'), userCount: 0 }
  roleList.push(newRole)
  return { code: 200, data: newRole, message: '创建成功' }
})

Mock.mock(/\/api\/roles\/\d+/, 'put', (options) => {
  const id = parseInt(options.url.split('/').pop())
  const body = JSON.parse(options.body)
  const idx = roleList.findIndex(r => r.id === id)
  if (idx !== -1) {
    roleList[idx] = { ...roleList[idx], ...body }
    return { code: 200, data: roleList[idx], message: '更新成功' }
  }
  return { code: 404, message: '角色不存在', data: null }
})

Mock.mock(/\/api\/roles\/\d+/, 'delete', (options) => {
  const id = parseInt(options.url.split('/').pop())
  const idx = roleList.findIndex(r => r.id === id)
  if (idx !== -1) {
    roleList.splice(idx, 1)
    return { code: 200, data: null, message: '删除成功' }
  }
  return { code: 404, message: '角色不存在', data: null }
})
