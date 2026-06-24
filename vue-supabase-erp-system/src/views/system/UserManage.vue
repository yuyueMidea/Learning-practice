<template>
  <div class="page-container">
    <SearchBar
      :model-value="table.query"
      :fields="searchFields"
      @update:model-value="updateQuery"
      @search="table.search"
      @reset="table.reset"
    />

    <DataTable
      :data="table.rows"
      :columns="columns"
      :loading="table.loading"
      :pagination="table.pagination"
      :show-export="true"
      @page-change="table.changePage"
      @page-size-change="table.changePageSize"
      @sort-change="table.changeSort"
      @export="handleExport"
    >
      <template #toolbar>
        <el-button v-permission="['system:user:create']" type="primary" :icon="Plus" @click="openCreate">
          新增用户
        </el-button>
        <span class="page-table-hint">用户账号由受保护的 Edge Function 创建，浏览器不会接触 service_role。</span>
      </template>

      <template #cell-user_name="{ row }">
        <div class="cell-user">
          <el-avatar :size="28">{{ (row.display_name || row.user_name || '?').slice(0, 1) }}</el-avatar>
          <div>
            <div class="cell-user__name">{{ row.display_name || row.user_name }}</div>
            <div class="cell-user__sub">{{ row.user_name }}</div>
          </div>
        </div>
      </template>

      <template #cell-roles="{ row }">
        <el-space wrap>
          <el-tag v-for="role in activeRoles(row)" :key="role.id" size="small" type="info">
            {{ role.name }}
          </el-tag>
          <span v-if="!activeRoles(row).length" class="muted-text">未分配</span>
        </el-space>
      </template>

      <template #cell-status="{ row }">
        <el-tag :type="statusTagType(row.status)">{{ statusLabel(row.status) }}</el-tag>
      </template>

      <template #cell-created_at="{ row }">{{ formatDateTime(row.created_at) }}</template>

      <template #cell-actions="{ row }">
        <el-button v-permission="['system:user:update']" link type="primary" @click="openEdit(row)">编辑</el-button>
        <el-button v-permission="['system:user:update']" link type="warning" @click="openResetPassword(row)">重置密码</el-button>
        <el-button
          v-permission="['system:user:update']"
          link
          :type="row.status === 'active' ? 'danger' : 'success'"
          @click="toggleStatus(row)"
        >
          {{ row.status === 'active' ? '禁用' : '启用' }}
        </el-button>
        <el-button v-permission="['system:user:delete']" link type="danger" @click="handleDelete(row)">删除</el-button>
      </template>
    </DataTable>

    <FormDialog
      v-model="dialog.visible"
      :title="dialog.isEdit ? '编辑用户' : '新增用户'"
      :form="form"
      :rules="rules"
      width="760px"
      :submit-loading="dialog.submitting"
      @cancel="closeDialog"
      @submit="submitForm"
    >
      <el-row :gutter="18">
        <el-col :span="12">
          <el-form-item label="用户名" prop="user_name">
            <el-input v-model="form.user_name" maxlength="80" show-word-limit placeholder="例如：zhangsan" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="显示名称" prop="display_name">
            <el-input v-model="form.display_name" maxlength="120" placeholder="例如：张三" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="邮箱" prop="email">
            <el-input v-model="form.email" :disabled="dialog.isEdit" placeholder="name@example.com" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item :label="dialog.isEdit ? '账号状态' : '初始密码'" :prop="dialog.isEdit ? 'status' : 'password'">
            <el-select v-if="dialog.isEdit" v-model="form.status" style="width: 100%">
              <el-option label="启用" value="active" />
              <el-option label="停用" value="inactive" />
              <el-option label="锁定" value="locked" />
            </el-select>
            <el-input v-else v-model="form.password" type="password" show-password placeholder="至少 8 位" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="手机号" prop="phone">
            <el-input v-model="form.phone" placeholder="选填" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="部门">
            <el-input v-model="form.department_name" placeholder="例如：销售部" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="岗位">
            <el-input v-model="form.job_title" placeholder="例如：销售专员" />
          </el-form-item>
        </el-col>
        <el-col :span="24">
          <el-form-item label="角色分配" prop="roleIds">
            <el-transfer
              v-model="form.roleIds"
              filterable
              filter-placeholder="搜索角色"
              :titles="['未分配角色', '已分配角色']"
              :data="roleTransferData"
              class="role-transfer"
            />
          </el-form-item>
        </el-col>
        <el-col :span="24">
          <el-form-item label="备注">
            <el-input v-model="form.remark" type="textarea" :rows="3" maxlength="500" show-word-limit />
          </el-form-item>
        </el-col>
      </el-row>
    </FormDialog>

    <el-dialog v-model="passwordDialog.visible" title="重置密码" width="440px" :close-on-click-modal="false">
      <el-alert title="重置后用户将使用新密码登录，请通过安全渠道告知对方。" type="warning" :closable="false" show-icon />
      <el-form ref="passwordFormRef" :model="passwordDialog" :rules="passwordRules" label-width="86px" style="margin-top: 18px">
        <el-form-item label="新密码" prop="password">
          <el-input v-model="passwordDialog.password" type="password" show-password autocomplete="new-password" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="passwordDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="passwordDialog.loading" @click="submitPasswordReset">确认重置</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import SearchBar from '@/components/common/SearchBar.vue'
import DataTable from '@/components/common/DataTable.vue'
import FormDialog from '@/components/common/FormDialog.vue'
import { useTable } from '@/composables/useTable'
import {
  createSystemUser,
  deleteSystemUser,
  fetchRoles,
  fetchUserRoles,
  fetchUsers,
  resetSystemUserPassword,
  updateSystemUser,
  updateSystemUserStatus
} from '@/api/system'
import { formatDateTime, statusLabel, statusTagType } from '@/utils/format'
import { emailRule, requiredRule } from '@/utils/validate'

const table = useTable(fetchUsers, {
  initialQuery: { keyword: '', status: '' },
  defaultSort: { prop: 'created_at', order: 'descending' }
})

const roles = ref([])
const dialog = reactive({ visible: false, isEdit: false, submitting: false })
const form = reactive(createEmptyForm())
const passwordFormRef = ref()
const passwordDialog = reactive({ visible: false, loading: false, user: null, password: '' })

const searchFields = [
  { key: 'keyword', label: '用户名/邮箱', placeholder: '请输入用户名、显示名称或邮箱', width: '260px' },
  {
    key: 'status',
    label: '状态',
    type: 'select',
    width: '140px',
    options: [
      { label: '启用', value: 'active' },
      { label: '停用', value: 'inactive' },
      { label: '锁定', value: 'locked' }
    ]
  }
]

const columns = [
  { prop: 'user_name', label: '用户', minWidth: 180, slot: 'cell-user_name' },
  { prop: 'email', label: '邮箱', minWidth: 210 },
  { prop: 'department_name', label: '部门/岗位', minWidth: 160, formatter: (row) => [row.department_name, row.job_title].filter(Boolean).join(' / ') || '-' },
  { prop: 'roles', label: '角色', minWidth: 180, slot: 'cell-roles' },
  { prop: 'status', label: '状态', width: 95, align: 'center', slot: 'cell-status' },
  { prop: 'created_at', label: '创建时间', width: 180, sortable: 'custom', slot: 'cell-created_at' },
  { prop: 'actions', label: '操作', minWidth: 250, fixed: 'right', slot: 'cell-actions', showOverflowTooltip: false, exportable: false }
]

const rules = computed(() => ({
  user_name: [requiredRule('请输入用户名')],
  display_name: [requiredRule('请输入显示名称')],
  email: [requiredRule('请输入邮箱'), emailRule()],
  password: dialog.isEdit ? [] : [requiredRule('请输入初始密码'), { min: 8, message: '初始密码至少 8 位', trigger: 'blur' }]
}))

const passwordRules = {
  password: [requiredRule('请输入新密码'), { min: 8, message: '新密码至少 8 位', trigger: 'blur' }]
}

const roleTransferData = computed(() => roles.value.filter((role) => role.status === 'active').map((role) => ({
  key: role.id,
  label: `${role.name}（${role.code}）`,
  disabled: false
})))

function createEmptyForm() {
  return {
    id: '', user_name: '', display_name: '', email: '', password: '', phone: '',
    department_name: '', job_title: '', status: 'active', remark: '', roleIds: []
  }
}

function updateQuery(value) {
  Object.assign(table.query, value)
}

function activeRoles(row) {
  return (row.sys_user_roles || []).filter((item) => item.status === 'active').map((item) => item.sys_roles).filter(Boolean)
}

async function loadRoles() {
  roles.value = await fetchRoles()
}

function resetForm() {
  Object.assign(form, createEmptyForm())
}

function openCreate() {
  resetForm()
  dialog.isEdit = false
  dialog.visible = true
}

async function openEdit(row) {
  try {
    const assignments = await fetchUserRoles(row.id)
    Object.assign(form, {
      id: row.id,
      user_name: row.user_name,
      display_name: row.display_name || '',
      email: row.email,
      password: '',
      phone: row.phone || '',
      department_name: row.department_name || '',
      job_title: row.job_title || '',
      status: row.status,
      remark: row.remark || '',
      roleIds: assignments.map((item) => item.role_id)
    })
    dialog.isEdit = true
    dialog.visible = true
  } catch (error) {
    ElMessage.error(error.message || '读取用户角色失败')
  }
}

function closeDialog() {
  dialog.visible = false
  resetForm()
}

async function submitForm() {
  dialog.submitting = true
  try {
    const payload = { ...form }
    if (dialog.isEdit) {
      await updateSystemUser(payload)
      ElMessage.success('用户已更新')
    } else {
      await createSystemUser(payload)
      ElMessage.success('用户已创建并分配角色')
    }
    closeDialog()
    await table.load()
  } catch (error) {
    ElMessage.error(error.message || '保存用户失败')
  } finally {
    dialog.submitting = false
  }
}

function openResetPassword(row) {
  passwordDialog.user = row
  passwordDialog.password = ''
  passwordDialog.visible = true
}

async function submitPasswordReset() {
  try {
    await passwordFormRef.value.validate()
    passwordDialog.loading = true
    await resetSystemUserPassword({ userId: passwordDialog.user.id, password: passwordDialog.password })
    ElMessage.success('密码已重置')
    passwordDialog.visible = false
  } catch (error) {
    if (error?.message) ElMessage.error(error.message)
  } finally {
    passwordDialog.loading = false
  }
}

async function toggleStatus(row) {
  const targetStatus = row.status === 'active' ? 'inactive' : 'active'
  try {
    await ElMessageBox.confirm(`确认${targetStatus === 'active' ? '启用' : '禁用'}用户「${row.display_name || row.user_name}」吗？`, '状态确认', { type: 'warning' })
    await updateSystemUserStatus({ userId: row.id, status: targetStatus })
    ElMessage.success('状态已更新')
    await table.load()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error.message || '状态更新失败')
  }
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(
      `将永久删除 Auth 账号及 ERP 用户档案「${row.display_name || row.user_name}」。该操作不可恢复，是否继续？`,
      '高风险操作确认',
      { type: 'error', confirmButtonText: '永久删除', confirmButtonClass: 'el-button--danger' }
    )
    await deleteSystemUser(row.id)
    ElMessage.success('用户已删除')
    await table.load()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error.message || '删除用户失败')
  }
}

function handleExport({ columns }) {
  table.exportExcel({ filename: `用户列表_${new Date().toISOString().slice(0, 10)}.xlsx`, columns })
}

onMounted(async () => {
  try {
    await Promise.all([table.load(), loadRoles()])
  } catch (error) {
    ElMessage.error(error.message || '加载用户列表失败')
  }
})
</script>
