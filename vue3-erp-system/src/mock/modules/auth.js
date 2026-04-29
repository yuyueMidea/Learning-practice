import Mock from 'mockjs'

const users = [
  {
    id: 1,
    username: 'admin',
    password: '123456',
    name: '系统管理员',
    email: 'admin@erp.com',
    avatar: '',
    role: 'admin',
    roleId: 1,
    roleName: '超级管理员',
    dept: '信息技术部',
    status: 1
  },
  {
    id: 2,
    username: 'employee',
    password: '123456',
    name: '张晓明',
    email: 'zhangxm@erp.com',
    avatar: '',
    role: 'employee',
    roleId: 2,
    roleName: '普通员工',
    dept: '采购部',
    status: 1
  }
]

// Login
Mock.mock('/api/auth/login', 'post', (options) => {
  const { username, password } = JSON.parse(options.body)
  const user = users.find(u => u.username === username && u.password === password)
  if (user) {
    const { password: _, ...userInfo } = user
    const token = `mock_token_${user.role}_${Date.now()}`
    return {
      code: 200,
      data: { token, userInfo },
      message: '登录成功'
    }
  }
  return { code: 401, message: '用户名或密码错误', data: null }
})

// Get user info
Mock.mock('/api/auth/userinfo', 'get', () => {
  return {
    code: 200,
    data: {
      ...users[0],
      permissions: ['*'],
      menus: []
    },
    message: 'success'
  }
})

// Logout
Mock.mock('/api/auth/logout', 'post', () => {
  return { code: 200, data: null, message: '退出成功' }
})
