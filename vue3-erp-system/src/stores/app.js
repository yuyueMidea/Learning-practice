import { defineStore } from 'pinia'

export const useAppStore = defineStore('app', {
  state: () => ({
    sidebarCollapsed: false,
    breadcrumbs: [],
    theme: 'light'
  }),

  actions: {
    toggleSidebar() {
      this.sidebarCollapsed = !this.sidebarCollapsed
    },
    setSidebar(val) {
      this.sidebarCollapsed = val
    },
    setBreadcrumbs(crumbs) {
      this.breadcrumbs = crumbs
    }
  },

  persist: true
})
