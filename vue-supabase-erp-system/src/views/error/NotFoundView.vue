<template>
  <main class="error-page">
    <el-result icon="error" title="404 页面不存在" sub-title="你访问的地址不存在，或菜单配置尚未生效。">
      <template #extra>
        <el-button type="primary" @click="router.push('/dashboard')">返回仪表盘</el-button>
      </template>
    </el-result>
  </main>
</template>

<script setup>
import { useRouter } from 'vue-router'
const router = useRouter()
</script>
