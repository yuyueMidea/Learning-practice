<template>
  <header class="app-header">
    <div class="app-header__left">
      <el-button text :icon="appStore.sidebarCollapsed ? Expand : Fold" @click="appStore.toggleSidebar" />
      <AppBreadcrumb />
    </div>

    <div class="app-header__right">
      <el-tooltip content="全屏" placement="bottom">
        <el-button text :icon="FullScreen" @click="toggleFullscreen" />
      </el-tooltip>
      <el-badge :value="0" :hidden="true" class="app-header__notification">
        <el-button text :icon="Bell" @click="showNotifications" />
      </el-badge>
      <el-dropdown @command="handleCommand">
        <span class="app-header__user">
          <el-avatar :size="32" :src="avatarUrl">{{ userInitial }}</el-avatar>
          <span class="app-header__user-name">{{ displayName }}</span>
          <el-icon><ArrowDown /></el-icon>
        </span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="profile" :icon="User">个人资料</el-dropdown-item>
            <el-dropdown-item divided command="logout" :icon="SwitchButton">退出登录</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowDown, Bell, Expand, Fold, FullScreen, SwitchButton, User } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import AppBreadcrumb from './AppBreadcrumb.vue'

const router = useRouter()
const authStore = useAuthStore()
const appStore = useAppStore()

const displayName = computed(() => authStore.profile?.display_name || authStore.profile?.user_name || authStore.authUser?.email || '用户')
const userInitial = computed(() => displayName.value.slice(0, 1).toUpperCase())
const avatarUrl = computed(() => authStore.profile?.avatar_path || '')

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
    } else {
      await document.documentElement.requestFullscreen()
    }
  } catch {
    ElMessage.warning('当前浏览器不支持全屏操作')
  }
}

function showNotifications() {
  ElMessage.info('通知中心将在后续阶段接入系统通知与实时消息。')
}

async function handleCommand(command) {
  if (command === 'profile') {
    router.push('/profile')
    return
  }

  if (command === 'logout') {
    try {
      await ElMessageBox.confirm('确认退出当前账号吗？', '退出登录', {
        type: 'warning',
        confirmButtonText: '退出',
        cancelButtonText: '取消'
      })
      await authStore.logout()
      appStore.reset()
      router.replace('/login')
    } catch {
      // 用户取消时无需提示。
    }
  }
}
</script>
