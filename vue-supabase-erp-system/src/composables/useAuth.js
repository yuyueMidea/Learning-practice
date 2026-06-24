import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'

export function useAuth() {
  const authStore = useAuthStore()
  const { loading, profile, roles, permissions, menus, session, authorizationLoaded } = storeToRefs(authStore)

  return {
    loading,
    profile,
    roles,
    permissions,
    menus,
    session,
    authorizationLoaded,
    isAuthenticated: computed(() => authStore.isAuthenticated),
    isSuperAdmin: computed(() => authStore.isSuperAdmin),
    can: (permissionCode) => authStore.hasPermission(permissionCode),
    login: authStore.login,
    logout: authStore.logout,
    refreshAuthorization: authStore.refreshAuthorization
  }
}
