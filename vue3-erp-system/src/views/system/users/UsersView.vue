<template>
  <div class="users-page">
    <div class="page-header">
      <div>
        <div class="page-title">用户管理</div>
        <div class="page-subtitle">管理系统用户账号、角色分配和权限控制</div>
      </div>
      <el-button type="primary" :icon="Plus" @click="openDialog()">新增用户</el-button>
    </div>

    <!-- Filters -->
    <el-card class="filter-card">
      <el-form :model="query" inline>
        <el-form-item label="关键词">
          <el-input v-model="query.keyword" placeholder="姓名/用户名/邮箱" clearable style="width: 220px" :prefix-icon="Search" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="query.status" placeholder="全部状态" clearable style="width: 120px">
            <el-option label="启用" :value="1" />
            <el-option label="禁用" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="fetchData">查询</el-button>
          <el-button :icon="Refresh" @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- Table -->
    <el-card>
      <el-table
        :data="tableData"
        v-loading="loading"
        stripe
        class="erp-table"
        row-key="id"
      >
        <el-table-column type="index" label="#" width="55" />
        <el-table-column label="用户信息" min-width="180">
          <template #default="{ row }">
            <div class="user-cell">
              <div class="user-avatar">{{ row.name?.charAt(0) }}</div>
              <div>
                <div class="user-name">{{ row.name }}</div>
                <div class="user-email">{{ row.email }}</div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="username" label="用户名" width="130" />
        <el-table-column prop="phone" label="手机号" width="130" />
        <el-table-column prop="roleName" label="角色" width="130">
          <template #default="{ row }">
            <el-tag :type="roleTagType(row.roleId)" size="small" round>{{ row.roleName }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="dept" label="部门" width="110" />
        <el-table-column prop="status" label="状态" width="90" align="center">
          <template #default="{ row }">
            <el-switch
              :model-value="row.status === 1"
              @change="(val) => toggleStatus(row, val)"
              :disabled="row.id === 0"
              size="small"
            />
          </template>
        </el-table-column>
        <el-table-column prop="lastLogin" label="最后登录" width="160" />
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button text type="primary" size="small" :icon="Edit" @click="openDialog(row)">编辑</el-button>
            <el-button text type="danger" size="small" :icon="Delete" @click="deleteUser(row)" :disabled="row.id === 0">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrap">
        <el-pagination
          v-model:current-page="query.page"
          v-model:page-size="query.pageSize"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          @change="fetchData"
        />
      </div>
    </el-card>

    <!-- Create/Edit Dialog -->
    <el-dialog
      v-model="dialogVisible"
      :title="editRow ? '编辑用户' : '新增用户'"
      width="520px"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="姓名" prop="name">
          <el-input v-model="form.name" placeholder="请输入真实姓名" />
        </el-form-item>
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" placeholder="登录用户名" :disabled="!!editRow" />
        </el-form-item>
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="form.email" placeholder="电子邮箱" />
        </el-form-item>
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="form.phone" placeholder="手机号码" />
        </el-form-item>
        <el-form-item label="角色" prop="roleId">
          <el-select v-model="form.roleId" placeholder="选择角色" style="width:100%" @change="onRoleChange">
            <el-option v-for="r in roleOptions" :key="r.id" :label="r.name" :value="r.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="部门" prop="dept">
          <el-select v-model="form.dept" placeholder="选择部门" style="width:100%">
            <el-option v-for="d in deptOptions" :key="d" :label="d" :value="d" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="!editRow" label="密码" prop="password">
          <el-input v-model="form.password" type="password" placeholder="初始密码" show-password />
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="form.status" :active-value="1" :inactive-value="0" active-text="启用" inactive-text="禁用" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitForm">确认保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search, Refresh, Edit, Delete } from '@element-plus/icons-vue'
import { userApi, roleApi } from '@/api/index.js'

const loading = ref(false)
const submitting = ref(false)
const tableData = ref([])
const total = ref(0)
const dialogVisible = ref(false)
const editRow = ref(null)
const formRef = ref()
const roleOptions = ref([])

const query = reactive({ keyword: '', status: '', page: 1, pageSize: 10 })

const deptOptions = ['信息技术部', '采购部', '销售部', '财务部', '运营部', '仓储部', '人力资源部']

const form = reactive({
  name: '', username: '', email: '', phone: '',
  roleId: null, roleName: '', dept: '', password: '123456', status: 1
})

const rules = {
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  email: [{ required: true, message: '请输入邮箱', trigger: 'blur' }, { type: 'email', message: '邮箱格式不正确', trigger: 'blur' }],
  roleId: [{ required: true, message: '请选择角色', trigger: 'change' }],
  password: [{ min: 6, message: '密码至少6位', trigger: 'blur' }]
}

const roleTagType = (roleId) => {
  const map = { 1: 'danger', 2: '', 3: 'warning' }
  return map[roleId] || 'info'
}

const fetchData = async () => {
  loading.value = true
  try {
    const res = await userApi.getList(query)
    tableData.value = res.list
    total.value = res.total
  } finally {
    loading.value = false
  }
}

const resetQuery = () => {
  query.keyword = ''
  query.status = ''
  query.page = 1
  fetchData()
}

const onRoleChange = (id) => {
  const role = roleOptions.value.find(r => r.id === id)
  form.roleName = role?.name || ''
}

const openDialog = (row = null) => {
  editRow.value = row
  if (row) {
    Object.assign(form, { ...row })
  } else {
    Object.assign(form, { name: '', username: '', email: '', phone: '', roleId: null, roleName: '', dept: '', password: '123456', status: 1 })
  }
  dialogVisible.value = true
}

const submitForm = async () => {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  submitting.value = true
  try {
    if (editRow.value) {
      await userApi.update(editRow.value.id, form)
      ElMessage.success('用户信息已更新')
    } else {
      await userApi.create(form)
      ElMessage.success('用户创建成功')
    }
    dialogVisible.value = false
    fetchData()
  } finally {
    submitting.value = false
  }
}

const deleteUser = async (row) => {
  await ElMessageBox.confirm(`确认删除用户「${row.name}」？此操作不可恢复。`, '确认删除', {
    confirmButtonText: '确认删除',
    cancelButtonText: '取消',
    type: 'warning',
    confirmButtonClass: 'el-button--danger'
  })
  await userApi.delete(row.id)
  ElMessage.success('用户已删除')
  fetchData()
}

const toggleStatus = async (row, val) => {
  const status = val ? 1 : 0
  await userApi.toggleStatus(row.id, status)
  row.status = status
  ElMessage.success(val ? '用户已启用' : '用户已禁用')
}

onMounted(async () => {
  const rolesData = await roleApi.getList()
  roleOptions.value = rolesData.list || rolesData
  fetchData()
})
</script>

<style lang="scss" scoped>
.users-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.filter-card {
  :deep(.el-card__body) { padding: 16px 20px 0; }
}

.user-cell {
  display: flex;
  align-items: center;
  gap: 10px;
  
  .user-avatar {
    width: 34px; height: 34px;
    border-radius: 50%;
    background: linear-gradient(135deg, $primary, $secondary);
    color: #fff;
    display: flex; align-items: center; justify-content: center;
    font-weight: 600;
    font-size: 13px;
    flex-shrink: 0;
  }
  
  .user-name { font-size: 13px; font-weight: 500; color: $gray-800; }
  .user-email { font-size: 11px; color: $gray-400; margin-top: 1px; }
}

.pagination-wrap {
  display: flex;
  justify-content: flex-end;
  padding-top: 16px;
}
</style>
