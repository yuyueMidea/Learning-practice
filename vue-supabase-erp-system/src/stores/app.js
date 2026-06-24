import { defineStore } from 'pinia'
import { buildMenuTree } from '@/utils/menu'

const SIDEBAR_STORAGE_KEY = 'erp-sidebar-collapsed'

export const useAppStore = defineStore('app', {
  state: () => ({
    title: import.meta.env.VITE_APP_TITLE || 'ERP 管理系统',
    sidebarCollapsed: localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true',
    pageLoading: false,
    menus: [],
    menuTree: [],
    breadcrumb: []
  }),

  getters: {
    visibleMenuTree: (state) => state.menuTree.filter((item) => item.menu_type !== 'button'),
    activeMenuPaths: (state) => state.menus.map((item) => item.route_path).filter(Boolean)
  },

  actions: {
    setMenus(menus = []) {
      this.menus = Array.isArray(menus) ? menus : []
      this.menuTree = buildMenuTree(this.menus)
    },

    setBreadcrumb(items = []) {
      this.breadcrumb = Array.isArray(items) ? items : []
    },

    setPageLoading(value) {
      this.pageLoading = Boolean(value)
    },

    toggleSidebar() {
      this.sidebarCollapsed = !this.sidebarCollapsed
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(this.sidebarCollapsed))
    },

    setSidebarCollapsed(value) {
      this.sidebarCollapsed = Boolean(value)
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(this.sidebarCollapsed))
    },

    reset() {
      this.menus = []
      this.menuTree = []
      this.breadcrumb = []
      this.pageLoading = false
    }
  }
})
