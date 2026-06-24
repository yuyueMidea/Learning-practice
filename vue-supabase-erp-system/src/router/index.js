import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import { resolveMenuComponent } from './componentMap'

const dynamicRouteNames = new Set()

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior() {
    return { top: 0 }
  },
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: () => import('@/views/login/LoginView.vue'),
      meta: {
        public: true,
        title: '登录'
      }
    },
    {
      path: '/',
      name: 'RootLayout',
      component: () => import('@/components/layout/AppLayout.vue'),
      redirect: '/dashboard',
      meta: {
        requiresAuth: true
      },
      children: [
        {
          path: 'dashboard',
          name: 'Dashboard',
          component: () => import('@/views/dashboard/DashboardView.vue'),
          meta: {
            title: '仪表盘',
            icon: 'Odometer',
            permission: null,
            menuCode: 'dashboard'
          }
        },
        {
          path: '/profile',
          name: 'Profile',
          component: () => import('@/views/profile/ProfileView.vue'),
          meta: {
            title: '个人资料',
            hidden: true,
            requiresAuth: true
          }
        }
      ]
    },
    {
      path: '/403',
      name: 'Forbidden',
      component: () => import('@/views/error/ForbiddenView.vue'),
      meta: {
        title: '无访问权限'
      }
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'NotFound',
      component: () => import('@/views/error/NotFoundView.vue'),
      meta: {
        title: '页面不存在'
      }
    }
  ]
})

function toRouteName(code) {
  return `Dynamic_${String(code).replace(/[^A-Za-z0-9_]/g, '_')}`
}

function createRouteFromMenu(menu) {
  return {
    path: menu.route_path,
    name: toRouteName(menu.code),
    component: resolveMenuComponent(menu.component_path),
    meta: {
      title: menu.name,
      icon: menu.icon,
      permission: menu.permission_code || null,
      menuCode: menu.code,
      componentPath: menu.component_path,
      cacheable: Boolean(menu.is_cacheable),
      affix: Boolean(menu.is_affix),
      menuMeta: menu.meta || {}
    }
  }
}

export function installDynamicRoutes(menus = []) {
  const routeMenus = menus.filter(
    (menu) => menu.menu_type === 'menu' && menu.route_path && menu.code !== 'dashboard'
  )

  routeMenus.forEach((menu) => {
    const routeName = toRouteName(menu.code)
    if (router.hasRoute(routeName)) return

    router.addRoute('RootLayout', createRouteFromMenu(menu))
    dynamicRouteNames.add(routeName)
  })
}

export function clearDynamicRoutes() {
  dynamicRouteNames.forEach((routeName) => {
    if (router.hasRoute(routeName)) router.removeRoute(routeName)
  })
  dynamicRouteNames.clear()
}

function buildBreadcrumb(route) {
  return route.matched
    .filter((record) => record.meta?.title)
    .map((record) => ({
      title: record.meta.title,
      path: record.path
    }))
}

router.beforeEach(async (to) => {
  const authStore = useAuthStore()
  const appStore = useAppStore()

  if (!authStore.initialized) {
    try {
      await authStore.initialize()
    } catch {
      authStore.clearAuth()
    }
  }

  if (to.meta.public) {
    if (to.name === 'Login' && authStore.isAuthenticated && authStore.authorizationLoaded) {
      return { path: '/dashboard', replace: true }
    }
    return true
  }

  if (!authStore.isAuthenticated) {
    return {
      name: 'Login',
      query: {
        redirect: to.fullPath
      }
    }
  }

  if (!authStore.authorizationLoaded) {
    try {
      await authStore.loadAuthorization()
    } catch (error) {
      await authStore.logout().catch(() => {})
      return {
        name: 'Login',
        query: {
          redirect: to.fullPath,
          reason: error.message || '账号没有 ERP 访问权限'
        }
      }
    }
  }

  // 登录动作可能已经加载授权信息；这里仍统一把菜单同步到应用状态并注册动态路由。
  if (!appStore.menus.length && authStore.menus.length) {
    appStore.setMenus(authStore.menus)
  }
  installDynamicRoutes(authStore.menus)

  // 访问动态菜单的首个请求需要在注册路由后重新解析一次。
  if (to.name === 'NotFound' && authStore.menus.some((menu) => menu.route_path === to.path)) {
    return { path: to.fullPath, replace: true }
  }

  if (to.meta.permission && !authStore.hasPermission(to.meta.permission)) {
    return { name: 'Forbidden', replace: true }
  }

  return true
})

router.afterEach((to) => {
  const appStore = useAppStore()
  appStore.setBreadcrumb(buildBreadcrumb(to))
  appStore.setPageLoading(false)
  document.title = to.meta?.title ? `${to.meta.title} - ${appStore.title}` : appStore.title
})

router.onError(() => {
  const appStore = useAppStore()
  appStore.setPageLoading(false)
})

export default router
