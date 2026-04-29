<template>
  <div class="profile-page">
    <div class="page-header">
      <div>
        <div class="page-title">个人中心</div>
        <div class="page-subtitle">查看和编辑您的个人信息与账号安全设置</div>
      </div>
    </div>

    <div class="profile-layout">
      <!-- Left: Avatar Card -->
      <div class="profile-left">
        <el-card class="avatar-card">
          <div class="avatar-section">
            <div class="big-avatar">{{ authStore.userName.charAt(0) }}</div>
            <div class="avatar-name">{{ authStore.userName }}</div>
            <div class="avatar-role">
              <el-tag type="primary" size="small" round>{{ authStore.userRole }}</el-tag>
            </div>
            <div class="avatar-dept">{{ authStore.userDept }}</div>
          </div>

          <el-divider />

          <div class="info-list">
            <div class="info-item" v-for="item in profileMeta" :key="item.label">
              <div class="info-icon"><el-icon><component :is="item.icon" /></el-icon></div>
              <div class="info-content">
                <div class="info-label">{{ item.label }}</div>
                <div class="info-value">{{ item.value }}</div>
              </div>
            </div>
          </div>
        </el-card>

        <!-- Account Security -->
        <el-card class="security-card">
          <template #header>
            <span style="font-weight:600; font-size:14px">账号安全</span>
          </template>
          <div class="security-items">
            <div class="security-item" v-for="item in securityItems" :key="item.label">
              <div class="security-left">
                <div class="security-icon" :class="`si-${item.color}`">
                  <el-icon><component :is="item.icon" /></el-icon>
                </div>
                <div>
                  <div class="security-label">{{ item.label }}</div>
                  <div class="security-desc">{{ item.desc }}</div>
                </div>
              </div>
              <el-tag :type="item.done ? 'success' : 'warning'" size="small">
                {{ item.done ? '已设置' : '待完善' }}
              </el-tag>
            </div>
          </div>
        </el-card>
      </div>

      <!-- Right: Edit Form -->
      <div class="profile-right">
        <el-card>
          <template #header>
            <div style="display:flex; justify-content:space-between; align-items:center">
              <span style="font-weight:600">基本信息</span>
              <el-button v-if="!editing" type="primary" size="small" :icon="Edit" @click="startEdit">编辑</el-button>
              <div v-else style="display:flex; gap:8px">
                <el-button size="small" @click="cancelEdit">取消</el-button>
                <el-button type="primary" size="small" :loading="saving" @click="saveProfile">保存</el-button>
              </div>
            </div>
          </template>

          <el-form :model="form" label-width="100px" :disabled="!editing">
            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item label="真实姓名">
                  <el-input v-model="form.name" placeholder="真实姓名" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="用户名">
                  <el-input v-model="form.username" placeholder="登录用户名" disabled />
                </el-form-item>
              </el-col>
            </el-row>
            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item label="电子邮箱">
                  <el-input v-model="form.email" placeholder="电子邮箱" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="手机号码">
                  <el-input v-model="form.phone" placeholder="手机号码" />
                </el-form-item>
              </el-col>
            </el-row>
            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item label="所在部门">
                  <el-input v-model="form.dept" disabled />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="角色">
                  <el-input v-model="form.roleName" disabled />
                </el-form-item>
              </el-col>
            </el-row>
            <el-form-item label="个人简介">
              <el-input
                v-model="form.bio"
                type="textarea"
                :rows="3"
                placeholder="介绍一下自己..."
                :disabled="!editing"
              />
            </el-form-item>
          </el-form>
        </el-card>

        <!-- Change Password -->
        <el-card style="margin-top: 16px">
          <template #header>
            <div style="display:flex; justify-content:space-between; align-items:center">
              <span style="font-weight:600">修改密码</span>
              <el-button
                v-if="!showPwdForm"
                size="small"
                :icon="Lock"
                @click="showPwdForm = true"
              >修改密码</el-button>
            </div>
          </template>

          <div v-if="!showPwdForm" class="pwd-placeholder">
            <el-icon size="40" color="#cbd5e1"><Lock /></el-icon>
            <p>定期修改密码有助于保障账号安全</p>
            <el-button type="primary" plain @click="showPwdForm = true">立即修改</el-button>
          </div>

          <el-form
            v-else
            ref="pwdFormRef"
            :model="pwdForm"
            :rules="pwdRules"
            label-width="100px"
            style="max-width: 420px"
          >
            <el-form-item label="当前密码" prop="oldPwd">
              <el-input v-model="pwdForm.oldPwd" type="password" show-password placeholder="请输入当前密码" />
            </el-form-item>
            <el-form-item label="新密码" prop="newPwd">
              <el-input v-model="pwdForm.newPwd" type="password" show-password placeholder="至少8位，含字母和数字" />
            </el-form-item>
            <el-form-item label="确认新密码" prop="confirmPwd">
              <el-input v-model="pwdForm.confirmPwd" type="password" show-password placeholder="再次输入新密码" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="savingPwd" @click="changePassword">确认修改</el-button>
              <el-button @click="cancelPwd">取消</el-button>
            </el-form-item>
          </el-form>
        </el-card>

        <!-- Login History -->
        <el-card style="margin-top: 16px">
          <template #header>
            <span style="font-weight:600">最近登录记录</span>
          </template>
          <el-table :data="loginHistory" size="small" stripe>
            <el-table-column prop="time" label="登录时间" width="180" />
            <el-table-column prop="ip" label="IP地址" width="140" />
            <el-table-column prop="device" label="设备/浏览器" />
            <el-table-column prop="location" label="地点" width="120" />
            <el-table-column prop="status" label="状态" width="80" align="center">
              <template #default="{ row }">
                <el-tag :type="row.status === '成功' ? 'success' : 'danger'" size="small">{{ row.status }}</el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Edit, Lock, Message, Phone, OfficeBuilding, User, Calendar, Key, Iphone } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const editing = ref(false)
const saving = ref(false)
const showPwdForm = ref(false)
const savingPwd = ref(false)
const pwdFormRef = ref()

const form = reactive({
  name: '',
  username: '',
  email: '',
  phone: '',
  dept: '',
  roleName: '',
  bio: ''
})

const pwdForm = reactive({ oldPwd: '', newPwd: '', confirmPwd: '' })

const pwdRules = {
  oldPwd: [{ required: true, message: '请输入当前密码', trigger: 'blur' }],
  newPwd: [{ required: true, message: '请输入新密码', trigger: 'blur' }, { min: 6, message: '密码至少6位', trigger: 'blur' }],
  confirmPwd: [
    { required: true, message: '请确认新密码', trigger: 'blur' },
    {
      validator: (rule, value, callback) => {
        if (value !== pwdForm.newPwd) callback(new Error('两次密码不一致'))
        else callback()
      },
      trigger: 'blur'
    }
  ]
}

const profileMeta = computed(() => [
  { label: '邮箱', value: form.email || '-', icon: 'Message' },
  { label: '手机', value: form.phone || '-', icon: 'Phone' },
  { label: '部门', value: form.dept || '-', icon: 'OfficeBuilding' },
  { label: '注册时间', value: '2024-01-01', icon: 'Calendar' }
])

const securityItems = [
  { label: '登录密码', desc: '已设置，建议定期更换', icon: 'Key', color: 'green', done: true },
  { label: '手机绑定', desc: '已绑定手机号码', icon: 'Iphone', color: 'green', done: true },
  { label: '邮箱验证', desc: '已验证，用于找回密码', icon: 'Message', color: 'green', done: true },
  { label: '两步验证', desc: '建议开启以提升安全性', icon: 'Lock', color: 'orange', done: false }
]

const loginHistory = [
  { time: '2025-04-29 09:12:00', ip: '192.168.1.100', device: 'Chrome 124 / Windows 11', location: '上海市', status: '成功' },
  { time: '2025-04-28 17:43:22', ip: '192.168.1.100', device: 'Chrome 124 / Windows 11', location: '上海市', status: '成功' },
  { time: '2025-04-27 08:55:10', ip: '10.0.0.45', device: 'Safari / macOS', location: '北京市', status: '成功' },
  { time: '2025-04-26 22:10:05', ip: '203.86.11.22', device: 'Firefox / Ubuntu', location: '广州市', status: '失败' },
  { time: '2025-04-25 14:30:00', ip: '192.168.1.100', device: 'Chrome 124 / Windows 11', location: '上海市', status: '成功' }
]

const startEdit = () => {
  editing.value = true
}

const cancelEdit = () => {
  editing.value = false
  initForm()
}

const initForm = () => {
  const user = authStore.userInfo || {}
  Object.assign(form, {
    name: user.name || '',
    username: user.username || '',
    email: user.email || '',
    phone: user.phone || '',
    dept: user.dept || '',
    roleName: user.roleName || '',
    bio: user.bio || ''
  })
}

const saveProfile = async () => {
  saving.value = true
  try {
    await new Promise(r => setTimeout(r, 600))
    authStore.updateUserInfo({ name: form.name, email: form.email, phone: form.phone })
    ElMessage.success('个人信息已保存')
    editing.value = false
  } finally {
    saving.value = false
  }
}

const cancelPwd = () => {
  showPwdForm.value = false
  Object.assign(pwdForm, { oldPwd: '', newPwd: '', confirmPwd: '' })
}

const changePassword = async () => {
  const valid = await pwdFormRef.value?.validate().catch(() => false)
  if (!valid) return
  savingPwd.value = true
  try {
    await new Promise(r => setTimeout(r, 800))
    ElMessage.success('密码修改成功，请重新登录')
    cancelPwd()
  } finally {
    savingPwd.value = false
  }
}

onMounted(initForm)
</script>

<style lang="scss" scoped>
.profile-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.profile-layout {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 16px;
  align-items: start;

  @media (max-width: 900px) { grid-template-columns: 1fr; }
}

.profile-left {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.avatar-card {
  .avatar-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 12px 0 4px;
    gap: 8px;

    .big-avatar {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: linear-gradient(135deg, $primary, $secondary);
      color: #fff;
      font-size: 32px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 8px 24px rgba($primary, 0.35);
    }

    .avatar-name { font-size: 18px; font-weight: 700; color: $gray-800; }
    .avatar-dept { font-size: 12px; color: $gray-400; }
  }

  .info-list {
    display: flex;
    flex-direction: column;
    gap: 12px;

    .info-item {
      display: flex;
      align-items: center;
      gap: 10px;

      .info-icon {
        width: 32px; height: 32px;
        border-radius: 8px;
        background: $gray-100;
        display: flex; align-items: center; justify-content: center;
        color: $gray-500;
        flex-shrink: 0;
      }

      .info-label { font-size: 11px; color: $gray-400; }
      .info-value { font-size: 13px; color: $gray-700; font-weight: 500; }
    }
  }
}

.security-card {
  .security-items {
    display: flex;
    flex-direction: column;
    gap: 12px;

    .security-item {
      display: flex;
      align-items: center;
      justify-content: space-between;

      .security-left {
        display: flex;
        align-items: center;
        gap: 10px;

        .security-icon {
          width: 34px; height: 34px;
          border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          font-size: 15px;

          &.si-green { background: rgba($success, 0.1); color: $success; }
          &.si-orange { background: rgba($warning, 0.1); color: $warning; }
        }

        .security-label { font-size: 13px; font-weight: 500; color: $gray-700; }
        .security-desc { font-size: 11px; color: $gray-400; margin-top: 1px; }
      }
    }
  }
}

.pwd-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 24px 0;
  color: $gray-400;
  font-size: 13px;
}
</style>
