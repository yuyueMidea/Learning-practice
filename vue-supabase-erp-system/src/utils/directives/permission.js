import { useAuthStore } from '@/stores/auth'

function normalizePermissions(value) {
  if (Array.isArray(value)) return value.filter(Boolean)
  if (typeof value === 'string' && value) return [value]
  return []
}

function canDisplay(value, modifiers = {}) {
  const authStore = useAuthStore()
  const permissions = normalizePermissions(value)
  if (!permissions.length) return true
  if (authStore.isSuperAdmin) return true
  return modifiers.all
    ? permissions.every((permission) => authStore.hasPermission(permission))
    : permissions.some((permission) => authStore.hasPermission(permission))
}

function updateElementVisibility(el, binding) {
  const allowed = canDisplay(binding.value, binding.modifiers)
  if (!Object.prototype.hasOwnProperty.call(el, '__erpDisplay')) {
    el.__erpDisplay = el.style.display
  }
  el.style.display = allowed ? el.__erpDisplay : 'none'
  el.setAttribute('aria-hidden', String(!allowed))
}

export function createPermissionDirective() {
  return {
    mounted(el, binding) {
      updateElementVisibility(el, binding)
    },
    updated(el, binding) {
      updateElementVisibility(el, binding)
    },
    unmounted(el) {
      delete el.__erpDisplay
    }
  }
}
