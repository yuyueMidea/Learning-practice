import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import 'element-plus/dist/index.css'
import '@/assets/styles/index.css'

import App from './App.vue'
import router from './router'
import { useAuthStore } from '@/stores/auth'
import { createPermissionDirective } from '@/utils/directives/permission'

const app = createApp(App)
const pinia = createPinia()

Object.entries(ElementPlusIconsVue).forEach(([name, component]) => {
  app.component(name, component)
})

app.use(pinia)
app.use(router)
app.use(ElementPlus, { locale: zhCn })
app.directive('permission', createPermissionDirective())

const authStore = useAuthStore(pinia)
authStore.bindAuthListener()
authStore.initialize().catch(() => {
  // 路由守卫会在真正访问受保护页面时统一处理登录状态。
})

app.mount('#app')
