<template>
  <div class="main-layout" :class="{ 'sidebar-collapsed': appStore.sidebarCollapsed }">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="sidebar-logo">
        <div class="logo-icon">
          <el-icon><Grid /></el-icon>
        </div>
        <transition name="fade">
          <span v-if="!appStore.sidebarCollapsed" class="logo-text">智云ERP</span>
        </transition>
      </div>

      <el-scrollbar class="sidebar-scrollbar">
        <el-menu
          :default-active="activeMenu"
          :collapse="appStore.sidebarCollapsed"
          :collapse-transition="false"
          class="sidebar-menu"
          router
          background-color="transparent"
          text-color="#94a3b8"
          active-text-color="#ffffff"
        >
          <!-- Dashboard -->
          <el-menu-item index="/dashboard">
            <el-icon><Odometer /></el-icon>
            <template #title>仪表盘</template>
          </el-menu-item>

          <!-- System Management - Admin only -->
          <el-sub-menu v-if="authStore.isAdmin" index="system">
            <template #title>
              <el-icon><Setting /></el-icon>
              <span>系统管理</span>
            </template>
            <el-menu-item index="/system/users">
              <el-icon><User /></el-icon>
              <template #title>用户管理</template>
            </el-menu-item>
            <el-menu-item index="/system/roles">
              <el-icon><Lock /></el-icon>
              <template #title>角色管理</template>
            </el-menu-item>
          </el-sub-menu>

          <!-- Inventory -->
          <el-sub-menu index="inventory">
            <template #title>
              <el-icon><Box /></el-icon>
              <span>库存管理</span>
            </template>
            <el-menu-item index="/inventory/products">
              <el-icon><Goods /></el-icon>
              <template #title>商品管理</template>
            </el-menu-item>
            <el-menu-item index="/inventory/stock">
              <el-icon><DocumentCopy /></el-icon>
              <template #title>库存操作</template>
            </el-menu-item>
          </el-sub-menu>
        </el-menu>
      </el-scrollbar>

      <div class="sidebar-footer">
        <div class="user-avatar" @click="router.push('/profile')">
          <div class="avatar-circle">{{ authStore.userName.charAt(0) }}</div>
          <transition name="fade">
            <div v-if="!appStore.sidebarCollapsed" class="user-info">
              <div class="user-name">{{ authStore.userName }}</div>
              <div class="user-role">{{ authStore.userRole }}</div>
            </div>
          </transition>
        </div>
      </div>
    </aside>

    <!-- Main Content -->
    <div class="main-content">
      <!-- Header -->
      <header class="top-header">
        <div class="header-left">
          <el-button
            :icon="appStore.sidebarCollapsed ? Expand : Fold"
            circle
            text
            size="large"
            @click="appStore.toggleSidebar()"
            class="toggle-btn"
          />
          <el-breadcrumb separator="/">
            <el-breadcrumb-item
              v-for="(crumb, idx) in currentBreadcrumb"
              :key="idx"
            >{{ crumb }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>

        <div class="header-right">
          <el-tooltip content="刷新" placement="bottom">
            <el-button :icon="Refresh" circle text @click="refreshPage" />
          </el-tooltip>

          <el-dropdown @command="handleCommand" trigger="click">
            <div class="header-user">
              <div class="header-avatar">{{ authStore.userName.charAt(0) }}</div>
              <span class="header-username">{{ authStore.userName }}</span>
              <el-icon class="el-icon--right"><ArrowDown /></el-icon>
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="profile" :icon="UserFilled">个人中心</el-dropdown-item>
                <el-dropdown-item divided command="logout" :icon="SwitchButton">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>

      <!-- Page Content -->
      <main class="page-content">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" :key="route.path" />
          </transition>
        </router-view>
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessageBox, ElMessage } from 'element-plus'
import {
  Odometer, Setting, User, Lock, Box, Goods, DocumentCopy,
  Grid, Fold, Expand, Refresh, ArrowDown, UserFilled, SwitchButton
} from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const appStore = useAppStore()

const activeMenu = computed(() => route.path)
const currentBreadcrumb = computed(() => route.meta?.breadcrumb || [])

const refreshPage = () => {
  router.go(0)
}

const handleCommand = async (cmd) => {
  if (cmd === 'profile') {
    router.push('/profile')
  } else if (cmd === 'logout') {
    await ElMessageBox.confirm('确认退出登录？', '提示', {
      confirmButtonText: '确认退出',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await authStore.logout()
    ElMessage.success('已安全退出')
    router.push('/login')
  }
}
</script>

<style lang="scss" scoped>
.main-layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

// Sidebar
.sidebar {
  width: $sidebar-width;
  min-width: $sidebar-width;
  height: 100vh;
  background: linear-gradient(180deg, #0f172a 0%, #1e293b 100%);
  display: flex;
  flex-direction: column;
  transition: width $transition, min-width $transition;
  overflow: hidden;
  position: relative;
  z-index: 100;
  box-shadow: 4px 0 20px rgba(0,0,0,0.15);
}

.sidebar-collapsed .sidebar {
  width: $sidebar-collapsed-width;
  min-width: $sidebar-collapsed-width;
}

.sidebar-logo {
  height: $header-height;
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 10px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  flex-shrink: 0;
  
  .logo-icon {
    width: 34px;
    height: 34px;
    background: linear-gradient(135deg, $primary, $secondary);
    border-radius: $radius;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-size: 18px;
    color: #fff;
    box-shadow: 0 4px 12px rgba($primary, 0.4);
  }
  
  .logo-text {
    font-size: 16px;
    font-weight: 700;
    color: #fff;
    white-space: nowrap;
    letter-spacing: 1px;
  }
}

.sidebar-scrollbar {
  flex: 1;
  overflow: hidden;
}

.sidebar-menu {
  background: transparent !important;
  border: none !important;
  padding: 8px 8px;
  
  :deep(.el-menu-item),
  :deep(.el-sub-menu__title) {
    border-radius: $radius !important;
    margin-bottom: 2px;
    height: 42px;
    line-height: 42px;
    padding: 0 12px !important;
    transition: all $transition-fast !important;
    
    &:hover {
      background-color: rgba(255,255,255,0.08) !important;
      color: #fff !important;
    }
    
    .el-icon {
      color: inherit;
    }
  }
  
  :deep(.el-menu-item.is-active) {
    background: linear-gradient(135deg, $primary, $primary-light) !important;
    color: #fff !important;
    box-shadow: 0 4px 12px rgba($primary, 0.35);
    
    .el-icon { color: #fff !important; }
  }
  
  :deep(.el-sub-menu .el-menu) {
    background: transparent !important;
    .el-menu-item {
      padding-left: 36px !important;
    }
  }
  
  :deep(.el-sub-menu.is-opened .el-sub-menu__title) {
    color: #e2e8f0 !important;
  }
}

.sidebar-footer {
  padding: 12px;
  border-top: 1px solid rgba(255,255,255,0.06);
  flex-shrink: 0;
  
  .user-avatar {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    padding: 8px;
    border-radius: $radius;
    transition: background $transition-fast;
    
    &:hover { background: rgba(255,255,255,0.08); }
  }
  
  .avatar-circle {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: linear-gradient(135deg, $primary, $secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-weight: 600;
    font-size: 14px;
    flex-shrink: 0;
  }
  
  .user-info {
    overflow: hidden;
    .user-name {
      color: #e2e8f0;
      font-size: 13px;
      font-weight: 500;
      white-space: nowrap;
    }
    .user-role {
      color: #64748b;
      font-size: 11px;
      white-space: nowrap;
    }
  }
}

// Main content
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: $gray-50;
}

// Header
.top-header {
  height: $header-height;
  background: #fff;
  border-bottom: 1px solid $gray-200;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  flex-shrink: 0;
  box-shadow: $shadow-sm;
  
  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;
    
    .toggle-btn {
      color: $gray-500;
      &:hover { color: $primary; }
    }
  }
  
  .header-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .header-user {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    padding: 6px 12px;
    border-radius: 8px;
    transition: background $transition-fast;
    
    &:hover { background: $gray-100; }
    
    .header-avatar {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      background: linear-gradient(135deg, $primary, $secondary);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-weight: 600;
      font-size: 13px;
    }
    
    .header-username {
      font-size: 13px;
      color: $gray-700;
      font-weight: 500;
    }
  }
}

// Page content
.page-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}
</style>
