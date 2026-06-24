import { defineStore } from 'pinia'
import { supabase } from '@/utils/supabase'

function normalizeAuthorization(payload) {
  return {
    user: payload?.user && payload.user.id ? payload.user : null,
    roles: Array.isArray(payload?.roles) ? payload.roles : [],
    permissions: Array.isArray(payload?.permissions) ? payload.permissions : [],
    menus: Array.isArray(payload?.menus) ? payload.menus : []
  }
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    initialized: false,
    loading: false,
    authorizationLoaded: false,
    session: null,
    authUser: null,
    profile: null,
    roles: [],
    permissions: [],
    menus: [],
    authSubscription: null
  }),

  getters: {
    isAuthenticated: (state) => Boolean(state.session?.access_token && state.authUser),
    permissionCodes: (state) => state.permissions.map((item) => item.code),
    roleCodes: (state) => state.roles.map((item) => item.code),
    isSuperAdmin: (state) => state.roles.some((item) => item.code === 'SUPER_ADMIN'),
    hasPermission: (state) => (permissionCode) => {
      if (!permissionCode) return true
      if (state.roles.some((item) => item.code === 'SUPER_ADMIN')) return true
      return state.permissions.some((item) => item.code === permissionCode)
    }
  },

  actions: {
    applySession(session) {
      this.session = session || null
      this.authUser = session?.user || null
    },

    clearAuthorization() {
      this.authorizationLoaded = false
      this.profile = null
      this.roles = []
      this.permissions = []
      this.menus = []
    },

    clearAuth() {
      this.applySession(null)
      this.clearAuthorization()
    },

    async initialize() {
      if (this.initialized) return

      this.loading = true
      try {
        const { data, error } = await supabase.auth.getSession()
        if (error) throw error
        this.applySession(data.session)
      } finally {
        this.initialized = true
        this.loading = false
      }
    },

    bindAuthListener() {
      if (this.authSubscription) return

      const {
        data: { subscription }
      } = supabase.auth.onAuthStateChange((_event, session) => {
        this.applySession(session)
        if (!session) this.clearAuthorization()
      })

      this.authSubscription = subscription
    },

    async loadAuthorization() {
      if (!this.isAuthenticated) {
        this.clearAuthorization()
        return null
      }

      const { data, error } = await supabase.rpc('erp_get_my_authorization')
      if (error) throw error

      const authorization = normalizeAuthorization(data)
      if (!authorization.user) {
        throw new Error('当前账号未启用、未分配角色，或没有可访问的 ERP 权限。请联系超级管理员。')
      }

      this.profile = authorization.user
      this.roles = authorization.roles
      this.permissions = authorization.permissions
      this.menus = authorization.menus
      this.authorizationLoaded = true
      return authorization
    },

    async login({ email, password }) {
      this.loading = true
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password
        })
        if (error) throw error

        this.applySession(data.session)
        await this.loadAuthorization()
        return data
      } catch (error) {
        this.clearAuthorization()
        throw error
      } finally {
        this.loading = false
      }
    },

    async logout() {
      this.loading = true
      try {
        const { error } = await supabase.auth.signOut()
        if (error) throw error
      } finally {
        this.clearAuth()
        this.loading = false
      }
    },

    async refreshAuthorization() {
      return this.loadAuthorization()
    }
  }
})
