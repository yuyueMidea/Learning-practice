<template>
  <div class="page-container">
    <el-card shadow="never" class="profile-card">
      <template #header>
        <div class="card-header">
          <span>个人资料</span>
        </div>
      </template>

      <el-row :gutter="32">
        <el-col :xs="24" :md="8">
          <div class="profile-avatar-panel">
            <el-avatar :size="96" :src="form.avatar_url">
              {{ avatarText }}
            </el-avatar>

            <div class="profile-email">{{ authStore.userInfo?.email || '-' }}</div>

            <el-tag type="success" effect="light">
              {{ authStore.userInfo?.status === 'active' ? '账号正常' : '账号已停用' }}
            </el-tag>
          </div>
        </el-col>

        <el-col :xs="24" :md="16">
          <el-form
            ref="formRef"
            :model="form"
            :rules="rules"
            label-width="90px"
            style="max-width: 560px"
          >
            <el-form-item label="登录邮箱">
              <el-input :model-value="authStore.userInfo?.email || ''" disabled />
            </el-form-item>

            <el-form-item label="用户名" prop="user_name">
              <el-input v-model="form.user_name" maxlength="50" show-word-limit />
            </el-form-item>

            <el-form-item label="真实姓名" prop="real_name">
              <el-input v-model="form.real_name" maxlength="50" />
            </el-form-item>

            <el-form-item label="手机号" prop="phone">
              <el-input v-model="form.phone" maxlength="30" />
            </el-form-item>

            <el-form-item label="角色">
              <el-tag
                v-for="role in authStore.roles"
                :key="role.code || role.id"
                style="margin-right: 8px"
              >
                {{ role.name || role.code }}
              </el-tag>
            </el-form-item>

            <el-form-item>
              <el-button type="primary" :loading="saving" @click="handleSave">
                保存资料
              </el-button>
            </el-form-item>
          </el-form>
        </el-col>
      </el-row>
    </el-card>

    <el-card shadow="never" class="profile-card">
      <template #header>
        <span>安全设置</span>
      </template>

      <el-alert
        title="密码修改请使用“忘记密码”流程，通过邮箱自助重置。"
        type="info"
        :closable="false"
        show-icon
      />
    </el-card>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { supabase } from '@/utils/supabase'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const formRef = ref()
const saving = ref(false)

const form = reactive({
  user_name: '',
  real_name: '',
  phone: '',
  avatar_url: ''
})

const rules = {
  user_name: [
    { required: true, message: '请输入用户名', trigger: 'blur' }
  ]
}

const avatarText = computed(() => {
  const text = form.real_name || form.user_name || authStore.userInfo?.email || 'U'
  return text.slice(0, 1).toUpperCase()
})

function fillForm() {
  const user = authStore.userInfo || {}

  form.user_name = user.user_name || ''
  form.real_name = user.real_name || ''
  form.phone = user.phone || ''
  form.avatar_url = user.avatar_url || ''
}

async function handleSave() {
  await formRef.value.validate()

  if (!authStore.userInfo?.id) {
    ElMessage.error('未获取到当前用户信息')
    return
  }

  saving.value = true

  try {
    const { error } = await supabase
      .from('sys_users')
      .update({
        user_name: form.user_name,
        real_name: form.real_name || null,
        phone: form.phone || null,
        avatar_url: form.avatar_url || null
      })
      .eq('id', authStore.userInfo.id)

    if (error) throw error

    authStore.userInfo = {
      ...authStore.userInfo,
      ...form
    }

    ElMessage.success('个人资料已保存')
  } catch (error) {
    ElMessage.error(error.message || '保存失败')
  } finally {
    saving.value = false
  }
}

onMounted(fillForm)
</script>

<style scoped>
.profile-card {
  margin-bottom: 16px;
}

.profile-avatar-panel {
  min-height: 260px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  border-right: 1px solid #ebeef5;
}

.profile-email {
  color: #606266;
  word-break: break-all;
}

@media (max-width: 768px) {
  .profile-avatar-panel {
    min-height: auto;
    padding-bottom: 24px;
    margin-bottom: 24px;
    border-right: 0;
    border-bottom: 1px solid #ebeef5;
  }
}
</style>