<template>
  <main class="error-page">
    <el-result icon="warning" title="403 无访问权限" sub-title="当前账号没有访问该功能的权限。">
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
