<template>
  <div class="not-found">
    <div class="nf-content">
      <div class="nf-code">404</div>
      <div class="nf-title">页面不存在</div>
      <div class="nf-desc">您访问的页面已被移除、更名或暂时不可用</div>
      <div class="nf-actions">
        <el-button type="primary" :icon="HomeFilled" @click="router.push('/')">返回首页</el-button>
        <el-button :icon="Back" @click="router.back()">返回上页</el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { HomeFilled, Back } from '@element-plus/icons-vue'
const router = useRouter()
</script>

<style lang="scss" scoped>
.not-found {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: $gray-50;
}

.nf-content {
  text-align: center;

  .nf-code {
    font-size: 120px;
    font-weight: 900;
    line-height: 1;
    background: linear-gradient(135deg, $primary, $secondary);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin-bottom: 16px;
  }

  .nf-title {
    font-size: 24px;
    font-weight: 600;
    color: $gray-800;
    margin-bottom: 10px;
  }

  .nf-desc {
    font-size: 14px;
    color: $gray-500;
    margin-bottom: 32px;
  }

  .nf-actions {
    display: flex;
    gap: 12px;
    justify-content: center;
  }
}
</style>
