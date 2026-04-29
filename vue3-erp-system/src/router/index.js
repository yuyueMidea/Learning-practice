import { createRouter, createWebHistory } from 'vue-router'
import NProgress from 'nprogress'
import { useAuthStore } from '@/stores/auth'

// Route definitions
const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/auth/LoginView.vue'),
    meta: { public: true, title: '登录' }
  },
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/dashboard/DashboardView.vue'),
        meta: { title: '仪表盘', icon: 'Odometer', breadcrumb: ['仪表盘'] }
      },
      // System Management
      {
        path: 'system/users',
        name: 'Users',
        component: () => import('@/views/system/users/UsersView.vue'),
        meta: { title: '用户管理', icon: 'User', roles: ['admin'], breadcrumb: ['系统管理', '用户管理'] }
      },
      {
        path: 'system/roles',
        name: 'Roles',
        component: () => import('@/views/system/roles/RolesView.vue'),
        meta: { title: '角色管理', icon: 'Lock', roles: ['admin'], breadcrumb: ['系统管理', '角色管理'] }
      },
      // Inventory
      {
        path: 'inventory/products',
        name: 'Products',
        component: () => import('@/views/inventory/products/ProductsView.vue'),
        meta: { title: '商品管理', icon: 'Goods', breadcrumb: ['库存管理', '商品管理'] }
      },
      {
        path: 'inventory/stock',
        name: 'Stock',
        component: () => import('@/views/inventory/stock/StockView.vue'),
        meta: { title: '库存操作', icon: 'Box', breadcrumb: ['库存管理', '库存操作'] }
      },
      // Profile
      {
        path: 'profile',
        name: 'Profile',
        component: () => import('@/views/profile/ProfileView.vue'),
        meta: { title: '个人中心', breadcrumb: ['个人中心'] }
      }
    ]
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/NotFoundView.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 })
})

// Navigation guard
router.beforeEach((to, from, next) => {
  NProgress.start()
  const authStore = useAuthStore()

  if (to.meta.public) {
    if (authStore.isLoggedIn && to.name === 'Login') {
      next('/')
    } else {
      next()
    }
    return
  }

  if (!authStore.isLoggedIn) {
    next({ path: '/login', query: { redirect: to.fullPath } })
    return
  }

  // Role-based access
  if (to.meta.roles && !to.meta.roles.includes(authStore.userInfo?.role)) {
    next('/dashboard')
    return
  }

  next()
})

router.afterEach(() => {
  NProgress.done()
})

export default router
