<template>
  <div class="login-page">
    <div class="login-bg">
      <div class="bg-shape shape-1"></div>
      <div class="bg-shape shape-2"></div>
      <div class="bg-shape shape-3"></div>
    </div>

    <div class="login-container">
      <!-- Left Panel -->
      <div class="login-left">
        <div class="brand">
          <div class="brand-icon">
            <el-icon size="36"><Grid /></el-icon>
          </div>
          <h1 class="brand-name">智云 ERP</h1>
          <p class="brand-desc">企业资源计划管理系统</p>
        </div>

        <div class="features">
          <div v-for="f in features" :key="f.icon" class="feature-item">
            <div class="feature-icon">
              <el-icon><component :is="f.icon" /></el-icon>
            </div>
            <div>
              <div class="feature-title">{{ f.title }}</div>
              <div class="feature-desc">{{ f.desc }}</div>
            </div>
          </div>
        </div>

        <div class="login-footer">
          © 2025 智云科技有限公司 · ERP v1.0.0
        </div>
      </div>

      <!-- Right Panel - Login Form -->
      <div class="login-right">
        <div class="login-card">
          <div class="login-header">
            <h2>欢迎登录</h2>
            <p>请输入您的账号和密码</p>
          </div>

          <el-form
            ref="formRef"
            :model="form"
            :rules="rules"
            size="large"
            @submit.prevent="handleLogin"
          >
            <el-form-item prop="username">
              <el-input
                v-model="form.username"
                placeholder="用户名"
                :prefix-icon="User"
                clearable
              />
            </el-form-item>

            <el-form-item prop="password">
              <el-input
                v-model="form.password"
                type="password"
                placeholder="密码"
                :prefix-icon="Lock"
                show-password
                @keyup.enter="handleLogin"
              />
            </el-form-item>

            <div class="form-options">
              <el-checkbox v-model="rememberMe">记住我</el-checkbox>
              <a class="forgot-link">忘记密码？</a>
            </div>

            <el-button
              type="primary"
              size="large"
              :loading="authStore.isLoading"
              class="login-btn"
              @click="handleLogin"
              native-type="submit"
            >
              {{ authStore.isLoading ? '登录中...' : '立即登录' }}
            </el-button>
          </el-form>

          <!-- Demo accounts -->
          <div class="demo-accounts">
            <div class="demo-title">演示账号</div>
            <div class="demo-list">
              <div
                v-for="acc in demoAccounts"
                :key="acc.username"
                class="demo-item"
                @click="fillDemo(acc)"
              >
                <div class="demo-role">{{ acc.role }}</div>
                <div class="demo-info">{{ acc.username }} / {{ acc.password }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Grid, User, Lock, TrendCharts, Box, Setting } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const formRef = ref()
const rememberMe = ref(true)

const form = reactive({ username: 'admin', password: '123456' })

const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }, { min: 6, message: '密码至少6位', trigger: 'blur' }]
}

const features = [
  { icon: 'TrendCharts', title: '实时数据分析', desc: '多维度可视化报表，助力业务决策' },
  { icon: 'Box', title: '智能库存管理', desc: '精准管控库存，自动预警补货提醒' },
  { icon: 'Setting', title: '灵活权限控制', desc: '角色化权限体系，数据安全有保障' }
]

const demoAccounts = [
  { role: '管理员', username: 'admin', password: '123456' },
  { role: '普通员工', username: 'employee', password: '123456' }
]

const fillDemo = (acc) => {
  form.username = acc.username
  form.password = acc.password
}

const handleLogin = async () => {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  const success = await authStore.login(form)
  if (success) {
    const redirect = route.query.redirect || '/dashboard'
    router.push(redirect)
  }
}
</script>

<style lang="scss" scoped>
.login-page {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%);
  position: relative;
  overflow: hidden;
}

.login-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
  
  .bg-shape {
    position: absolute;
    border-radius: 50%;
    filter: blur(80px);
    opacity: 0.15;
  }
  
  .shape-1 {
    width: 600px; height: 600px;
    background: $primary;
    top: -200px; left: -100px;
  }
  .shape-2 {
    width: 400px; height: 400px;
    background: $secondary;
    bottom: -100px; right: 200px;
  }
  .shape-3 {
    width: 300px; height: 300px;
    background: $info;
    top: 50%; right: -50px;
  }
}

.login-container {
  display: flex;
  width: 920px;
  max-width: calc(100vw - 40px);
  min-height: 560px;
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 25px 50px rgba(0,0,0,0.5);
  position: relative;
  z-index: 1;
}

// Left
.login-left {
  flex: 1;
  background: linear-gradient(160deg, rgba($primary-dark, 0.9), rgba($primary, 0.7));
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255,255,255,0.1);
  border-right: none;
  padding: 48px 40px;
  display: flex;
  flex-direction: column;
  color: #fff;

  @media (max-width: 640px) { display: none; }
}

.brand {
  margin-bottom: 40px;
  
  .brand-icon {
    width: 56px; height: 56px;
    background: rgba(255,255,255,0.15);
    border-radius: 14px;
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 16px;
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255,255,255,0.2);
  }
  
  .brand-name {
    font-size: 28px;
    font-weight: 700;
    letter-spacing: 2px;
    margin-bottom: 6px;
  }
  
  .brand-desc {
    font-size: 14px;
    color: rgba(255,255,255,0.6);
  }
}

.features {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
  
  .feature-item {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    
    .feature-icon {
      width: 38px; height: 38px;
      background: rgba(255,255,255,0.12);
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      border: 1px solid rgba(255,255,255,0.15);
      font-size: 16px;
    }
    
    .feature-title {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 3px;
    }
    
    .feature-desc {
      font-size: 12px;
      color: rgba(255,255,255,0.55);
      line-height: 1.5;
    }
  }
}

.login-footer {
  font-size: 12px;
  color: rgba(255,255,255,0.35);
  margin-top: 32px;
}

// Right
.login-right {
  width: 420px;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;

  @media (max-width: 640px) {
    width: 100%;
    border-radius: 20px;
  }
}

.login-card {
  width: 100%;
  
  .login-header {
    margin-bottom: 32px;
    
    h2 {
      font-size: 26px;
      font-weight: 700;
      color: $gray-900;
      margin-bottom: 6px;
    }
    
    p {
      font-size: 14px;
      color: $gray-500;
    }
  }
}

.form-options {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: -4px 0 20px;
  
  .forgot-link {
    font-size: 13px;
    color: $primary;
    cursor: pointer;
    &:hover { text-decoration: underline; }
  }
}

.login-btn {
  width: 100%;
  height: 46px;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 1px;
  background: linear-gradient(135deg, $primary, $primary-light) !important;
  border: none !important;
  box-shadow: 0 4px 14px rgba($primary, 0.4) !important;
  transition: all $transition !important;
  
  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba($primary, 0.5) !important;
  }
}

.demo-accounts {
  margin-top: 28px;
  padding-top: 20px;
  border-top: 1px solid $gray-100;
  
  .demo-title {
    font-size: 12px;
    color: $gray-400;
    text-align: center;
    margin-bottom: 12px;
  }
  
  .demo-list {
    display: flex;
    gap: 10px;
  }
  
  .demo-item {
    flex: 1;
    padding: 10px 12px;
    background: $gray-50;
    border: 1px solid $gray-200;
    border-radius: $radius;
    cursor: pointer;
    transition: all $transition-fast;
    text-align: center;
    
    &:hover {
      border-color: $primary;
      background: rgba($primary, 0.04);
    }
    
    .demo-role {
      font-size: 12px;
      font-weight: 600;
      color: $primary;
      margin-bottom: 4px;
    }
    
    .demo-info {
      font-size: 11px;
      color: $gray-400;
    }
  }
}
</style>
