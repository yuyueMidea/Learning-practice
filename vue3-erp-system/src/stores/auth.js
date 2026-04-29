import { defineStore } from 'pinia'
import { authApi } from '@/api/index.js'
import { ElMessage } from 'element-plus'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('erp_token') || '',
    userInfo: JSON.parse(localStorage.getItem('erp_user') || 'null'),
    isLoading: false
  }),

  getters: {
    isLoggedIn: (state) => !!state.token,
    isAdmin: (state) => state.userInfo?.role === 'admin',
    userName: (state) => state.userInfo?.name || '未知用户',
    userRole: (state) => state.userInfo?.roleName || '',
    userDept: (state) => state.userInfo?.dept || ''
  },

  actions: {
    async login(credentials) {
      this.isLoading = true
      try {
        const data = await authApi.login(credentials)
        this.token = data.token
        this.userInfo = data.userInfo
        localStorage.setItem('erp_token', data.token)
        localStorage.setItem('erp_user', JSON.stringify(data.userInfo))
        ElMessage.success(`欢迎回来，${data.userInfo.name}！`)
        return true
      } catch (error) {
        return false
      } finally {
        this.isLoading = false
      }
    },

    async logout() {
      try {
        await authApi.logout()
      } catch {}
      this.token = ''
      this.userInfo = null
      localStorage.removeItem('erp_token')
      localStorage.removeItem('erp_user')
    },

    updateUserInfo(info) {
      this.userInfo = { ...this.userInfo, ...info }
      localStorage.setItem('erp_user', JSON.stringify(this.userInfo))
    }
  }
})
