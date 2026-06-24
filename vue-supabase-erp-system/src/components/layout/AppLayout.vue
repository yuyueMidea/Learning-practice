<template>
  <el-container class="app-shell">
    <AppSidebar />
    <el-container direction="vertical" class="app-shell__main">
      <AppHeader />
      <el-main class="app-shell__content">
        <el-progress
          v-if="appStore.pageLoading"
          class="app-shell__loading"
          :percentage="100"
          :show-text="false"
          :stroke-width="2"
          status="success"
          :indeterminate="true"
        />
        <router-view v-slot="{ Component }">
          <transition name="fade-slide" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAppStore } from '@/stores/app'
import AppSidebar from './AppSidebar.vue'
import AppHeader from './AppHeader.vue'

const route = useRoute()
const appStore = useAppStore()

watch(
  () => route.fullPath,
  () => appStore.setPageLoading(false),
  { immediate: true }
)
</script>
