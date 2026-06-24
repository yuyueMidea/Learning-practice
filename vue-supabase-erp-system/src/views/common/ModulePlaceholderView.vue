<template>
  <section class="module-placeholder page-container">
    <el-result icon="info" :title="`${route.meta.title || '该模块'}正在建设`">
      <template #sub-title>
        当前阶段已经完成动态路由、菜单权限校验和布局接入；该功能页面将在对应业务 Phase 中以真实 CRUD 页面替换。
      </template>
      <template #extra>
        <el-button type="primary" @click="router.push('/dashboard')">返回仪表盘</el-button>
      </template>
    </el-result>
  </section>
</template>

<script setup>
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
</script>
