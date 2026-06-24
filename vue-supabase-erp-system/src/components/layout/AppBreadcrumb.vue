<template>
  <el-breadcrumb separator="/" class="app-breadcrumb">
    <el-breadcrumb-item :to="{ path: '/dashboard' }">
      <el-icon><House /></el-icon>
      首页
    </el-breadcrumb-item>
    <el-breadcrumb-item v-for="item in filteredBreadcrumb" :key="item.title">
      {{ item.title }}
    </el-breadcrumb-item>
  </el-breadcrumb>
</template>

<script setup>
import { computed } from 'vue'
import { House } from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'

const appStore = useAppStore()
const filteredBreadcrumb = computed(() => appStore.breadcrumb.filter((item) => item.title !== '仪表盘'))
</script>
