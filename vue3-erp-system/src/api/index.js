import request from '@/utils/request'

// Auth API
export const authApi = {
  login: (data) => request.post('/auth/login', data),
  logout: () => request.post('/auth/logout'),
  getUserInfo: () => request.get('/auth/userinfo')
}

// Users API
export const userApi = {
  getList: (params) => request.get('/users', { params }),
  create: (data) => request.post('/users', data),
  update: (id, data) => request.put(`/users/${id}`, data),
  delete: (id) => request.delete(`/users/${id}`),
  toggleStatus: (id, status) => request.patch(`/users/${id}/status`, { status })
}

// Roles API
export const roleApi = {
  getList: () => request.get('/roles'),
  getPermissions: () => request.get('/roles/permissions'),
  create: (data) => request.post('/roles', data),
  update: (id, data) => request.put(`/roles/${id}`, data),
  delete: (id) => request.delete(`/roles/${id}`)
}

// Products API
export const productApi = {
  getList: (params) => request.get('/products', { params }),
  create: (data) => request.post('/products', data),
  update: (id, data) => request.put(`/products/${id}`, data),
  delete: (id) => request.delete(`/products/${id}`)
}

// Stock API
export const stockApi = {
  getList: (params) => request.get('/stock', { params }),
  create: (data) => request.post('/stock', data),
  getStats: () => request.get('/stock/stats')
}

// Dashboard API
export const dashboardApi = {
  getStats: () => request.get('/dashboard/stats'),
  getSalesTrend: () => request.get('/dashboard/sales-trend'),
  getStockWarning: () => request.get('/dashboard/stock-warning'),
  getCategoryStats: () => request.get('/dashboard/category-stats'),
  getRecentActivities: () => request.get('/dashboard/recent-activities')
}
