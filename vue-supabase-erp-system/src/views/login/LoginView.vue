<template>
  <main class="login-page">
    <section class="login-page__intro">
      <div class="login-page__intro-content">
        <div class="login-page__mark">E</div>
        <p class="login-page__eyebrow">ERP MANAGEMENT PLATFORM</p>
        <h1>用一套系统，连接采购、销售、库存与财务。</h1>
        <p class="login-page__description">
          基于 Vue 3、Supabase、PostgreSQL 和 RLS 构建的企业级 ERP 管理后台。
        </p>
        <div class="login-page__features">
          <span><el-icon><CircleCheckFilled /></el-icon> 角色权限</span>
          <span><el-icon><CircleCheckFilled /></el-icon> 数据隔离</span>
          <span><el-icon><CircleCheckFilled /></el-icon> 实时协作</span>
        </div>
      </div>
    </section>

    <section class="login-page__panel">
      <div class="login-card">
        <div class="login-card__heading">
          <h2>欢迎登录</h2>
          <p>请输入已由管理员启用的 ERP 账号。</p>
        </div>

        <el-alert v-if="reason" :title="reason" type="warning" :closable="false" show-icon class="login-card__alert" />

        <el-form ref="formRef" :model="form" :rules="rules" size="large" @keyup.enter="handleLogin">
          <el-form-item prop="email">
            <el-input v-model="form.email" placeholder="邮箱地址" autocomplete="email">
              <template #prefix><el-icon><Message /></el-icon></template>
            </el-input>
          </el-form-item>
          <el-form-item prop="password">
            <el-input
              v-model="form.password"
              type="password"
              placeholder="密码"
              autocomplete="current-password"
              show-password
            >
              <template #prefix><el-icon><Lock /></el-icon></template>
            </el-input>
          </el-form-item>
          <div class="login-card__helper">
            <span>系统账户由管理员创建和授权</span>
            <el-link type="primary" :underline="false" @click="showHelp">无法登录？</el-link>
          </div>
          <el-button class="login-card__submit" type="primary" :loading="authStore.loading" @click="handleLogin">
            登录系统
          </el-button>
        </el-form>
      </div>
    </section>
  </main>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { CircleCheckFilled, Lock, Message } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const formRef = ref(null)
const reason = route.query.reason ? String(route.query.reason) : ''

const form = reactive({
  email: '',
  password: ''
})

const rules = {
  email: [
    { required: true, message: '请输入邮箱地址', trigger: 'blur' },
    { type: 'email', message: '请输入正确的邮箱地址', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码至少需要 6 位', trigger: 'blur' }
  ]
}

async function handleLogin() {
  try {
    await formRef.value.validate()
    await authStore.login(form)
    ElMessage.success('登录成功')
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/dashboard'
    router.replace(redirect)
  } catch (error) {
    if (error?.message) ElMessage.error(error.message)
  }
}

function showHelp() {
  ElMessage.info('请确认邮箱密码正确，并请超级管理员执行角色分配和账号启用。')
}
</script>
