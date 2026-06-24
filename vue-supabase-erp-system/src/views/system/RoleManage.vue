<template>
  <div class="page-container">
    <div class="page-toolbar">
      <div>
        <h2 class="page-title">角色管理</h2>
        <p class="page-description">角色决定功能权限与数据范围；系统内置角色仅允许调整状态和授权，不能删除。</p>
      </div>
      <el-button v-permission="['system:role:create']" type="primary" :icon="Plus" @click="openCreate">新增角色</el-button>
    </div>

    <DataTable
      :data="roles"
      :columns="columns"
      :loading="loading"
      :show-column-setting="false"
      @sort-change="loadRoles"
    >
      <template #cell-data_scope="{ row }">
        <el-tag :type="row.data_scope === 'all' ? 'success' : 'warning'">
          {{ row.data_scope === 'all' ? '全部数据' : '仅本人创建' }}
        </el-tag>
      </template>
      <template #cell-status="{ row }">
        <el-tag :type="statusTagType(row.status)">{{ statusLabel(row.status) }}</el-tag>
      </template>
      <template #cell-is_system="{ row }">
        <el-tag size="small" :type="row.is_system ? 'info' : 'success'">{{ row.is_system ? '系统内置' : '自定义' }}</el-tag>
      </template>
      <template #cell-actions="{ row }">
        <el-button v-permission="['system:role:update']" link type="primary" @click="openEdit(row)">编辑</el-button>
        <el-button v-permission="['system:role:update']" link type="primary" @click="openPermissionDialog(row)">分配权限</el-button>
        <el-button
          v-permission="['system:role:delete']"
          link
          type="danger"
          :disabled="row.is_system"
          @click="handleDelete(row)"
        >删除</el-button>
      </template>
    </DataTable>

    <FormDialog
      v-model="roleDialog.visible"
      :title="roleDialog.isEdit ? '编辑角色' : '新增角色'"
      :form="roleForm"
      :rules="roleRules"
      width="620px"
      :submit-loading="roleDialog.submitting"
      @cancel="closeRoleDialog"
      @submit="submitRole"
    >
      <el-form-item label="角色编码" prop="code">
        <el-input v-model="roleForm.code" :disabled="roleDialog.isEdit && roleForm.is_system" placeholder="例如：CUSTOMER_SERVICE" />
      </el-form-item>
      <el-form-item label="角色名称" prop="name">
        <el-input v-model="roleForm.name" maxlength="100" show-word-limit />
      </el-form-item>
      <el-form-item label="数据范围" prop="data_scope">
        <el-radio-group v-model="roleForm.data_scope" :disabled="roleForm.is_system && roleForm.code === 'SUPER_ADMIN'">
          <el-radio value="all">全部授权数据</el-radio>
          <el-radio value="self">仅自己创建的数据</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-radio-group v-model="roleForm.status">
          <el-radio value="active">启用</el-radio>
          <el-radio value="inactive">停用</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="排序" prop="sort_order">
        <el-input-number v-model="roleForm.sort_order" :min="0" :max="9999" controls-position="right" />
      </el-form-item>
      <el-form-item label="说明">
        <el-input v-model="roleForm.description" type="textarea" :rows="3" maxlength="500" show-word-limit />
      </el-form-item>
    </FormDialog>

    <el-dialog v-model="permissionDialog.visible" :title="`分配权限 · ${permissionDialog.role?.name || ''}`" width="760px" :close-on-click-modal="false">
      <el-alert title="勾选后立即决定该角色可以读取、创建、编辑、删除及审核的业务资源。" type="info" :closable="false" show-icon />
      <div class="permission-dialog__toolbar">
        <el-checkbox v-model="permissionDialog.checkAll" :indeterminate="permissionDialog.indeterminate" @change="toggleAllPermissions">
          全选全部权限
        </el-checkbox>
        <span>{{ permissionDialog.checkedCount }} / {{ permissionLeafIds.length }} 项已选择</span>
      </div>
      <el-scrollbar height="440px" class="permission-tree-wrap">
        <el-tree
          ref="permissionTreeRef"
          :data="permissionTree"
          node-key="id"
          :props="{ label: 'label', children: 'children', disabled: 'disabled' }"
          show-checkbox
          default-expand-all
          :check-strictly="false"
          @check="syncPermissionCheckState"
        >
          <template #default="{ data }">
            <span class="permission-tree-node" :class="{ 'is-group': data.group }">
              <span>{{ data.label }}</span>
              <small v-if="!data.group">{{ data.code }}</small>
            </span>
          </template>
        </el-tree>
      </el-scrollbar>
      <template #footer>
        <el-button @click="permissionDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="permissionDialog.submitting" @click="savePermissions">保存授权</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import DataTable from '@/components/common/DataTable.vue'
import FormDialog from '@/components/common/FormDialog.vue'
import {
  createRole,
  deleteRole,
  fetchPermissions,
  fetchRolePermissionIds,
  fetchRoles,
  replaceRolePermissions,
  updateRole
} from '@/api/system'
import { statusLabel, statusTagType } from '@/utils/format'
import { codeRule, requiredRule } from '@/utils/validate'

const loading = ref(false)
const roles = ref([])
const permissions = ref([])
const permissionTreeRef = ref()
const roleDialog = reactive({ visible: false, isEdit: false, submitting: false })
const permissionDialog = reactive({
  visible: false,
  role: null,
  submitting: false,
  checkAll: false,
  indeterminate: false,
  checkedCount: 0
})
const roleForm = reactive(createEmptyRole())

const columns = [
  { prop: 'code', label: '角色编码', minWidth: 180 },
  { prop: 'name', label: '角色名称', minWidth: 150 },
  { prop: 'description', label: '角色说明', minWidth: 240 },
  { prop: 'data_scope', label: '数据范围', width: 130, align: 'center', slot: 'cell-data_scope' },
  { prop: 'is_system', label: '类型', width: 110, align: 'center', slot: 'cell-is_system' },
  { prop: 'status', label: '状态', width: 95, align: 'center', slot: 'cell-status' },
  { prop: 'sort_order', label: '排序', width: 90, align: 'center' },
  { prop: 'actions', label: '操作', width: 220, fixed: 'right', slot: 'cell-actions', showOverflowTooltip: false, exportable: false }
]

const roleRules = {
  code: [requiredRule('请输入角色编码'), codeRule()],
  name: [requiredRule('请输入角色名称')],
  data_scope: [requiredRule('请选择数据范围')],
  status: [requiredRule('请选择状态')]
}

const permissionTree = computed(() => {
  const moduleLabels = {
    system: '系统管理', base: '基础数据', purchase: '采购管理', sales: '销售管理',
    inventory: '库存管理', finance: '财务管理', storage: '文件存储'
  }
  const groups = new Map()
  permissions.value.forEach((permission) => {
    const key = permission.module || 'other'
    if (!groups.has(key)) {
      groups.set(key, { id: `module-${key}`, label: moduleLabels[key] || key, group: true, disabled: false, children: [] })
    }
    groups.get(key).children.push({
      id: permission.id,
      label: permission.name,
      code: permission.code,
      group: false
    })
  })
  return [...groups.values()]
})

const permissionLeafIds = computed(() => permissions.value.map((item) => item.id))

function createEmptyRole() {
  return { id: '', code: '', name: '', description: '', data_scope: 'all', is_system: false, status: 'active', sort_order: 0 }
}

async function loadRoles() {
  loading.value = true
  try {
    roles.value = await fetchRoles()
  } finally {
    loading.value = false
  }
}

async function loadPermissions() {
  permissions.value = await fetchPermissions({ includeInactive: false })
}

function resetRoleForm() {
  Object.assign(roleForm, createEmptyRole())
}

function openCreate() {
  resetRoleForm()
  roleDialog.isEdit = false
  roleDialog.visible = true
}

function openEdit(row) {
  Object.assign(roleForm, {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description || '',
    data_scope: row.data_scope,
    is_system: row.is_system,
    status: row.status,
    sort_order: row.sort_order
  })
  roleDialog.isEdit = true
  roleDialog.visible = true
}

function closeRoleDialog() {
  roleDialog.visible = false
  resetRoleForm()
}

async function submitRole() {
  roleDialog.submitting = true
  try {
    const payload = {
      code: roleForm.code.trim(),
      name: roleForm.name.trim(),
      description: roleForm.description || null,
      data_scope: roleForm.data_scope,
      status: roleForm.status,
      sort_order: Number(roleForm.sort_order || 0)
    }
    if (roleDialog.isEdit) {
      if (roleForm.is_system) delete payload.code
      await updateRole(roleForm.id, payload)
      ElMessage.success('角色已更新')
    } else {
      await createRole({ ...payload, is_system: false })
      ElMessage.success('角色已创建')
    }
    closeRoleDialog()
    await loadRoles()
  } catch (error) {
    ElMessage.error(error.message || '保存角色失败')
  } finally {
    roleDialog.submitting = false
  }
}

async function openPermissionDialog(role) {
  try {
    permissionDialog.role = role
    permissionDialog.visible = true
    const selectedIds = await fetchRolePermissionIds(role.id)
    await nextTick()
    permissionTreeRef.value?.setCheckedKeys(selectedIds)
    syncPermissionCheckState()
  } catch (error) {
    ElMessage.error(error.message || '加载角色权限失败')
  }
}

function selectedPermissionIds() {
  return (permissionTreeRef.value?.getCheckedKeys(false) || []).filter((id) => permissionLeafIds.value.includes(id))
}

function syncPermissionCheckState() {
  const checked = selectedPermissionIds()
  permissionDialog.checkedCount = checked.length
  permissionDialog.checkAll = checked.length > 0 && checked.length === permissionLeafIds.value.length
  permissionDialog.indeterminate = checked.length > 0 && checked.length < permissionLeafIds.value.length
}

function toggleAllPermissions(value) {
  permissionTreeRef.value?.setCheckedKeys(value ? permissionLeafIds.value : [])
  syncPermissionCheckState()
}

async function savePermissions() {
  if (!permissionDialog.role) return
  permissionDialog.submitting = true
  try {
    await replaceRolePermissions(permissionDialog.role.id, selectedPermissionIds())
    ElMessage.success('权限已保存；相关用户下次刷新授权后生效')
    permissionDialog.visible = false
  } catch (error) {
    ElMessage.error(error.message || '保存权限失败')
  } finally {
    permissionDialog.submitting = false
  }
}

async function handleDelete(row) {
  if (row.is_system) return
  try {
    await ElMessageBox.confirm(`确认删除自定义角色「${row.name}」吗？已分配该角色的用户需先解除关联。`, '删除角色', { type: 'warning' })
    await deleteRole(row.id)
    ElMessage.success('角色已删除')
    await loadRoles()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error.message || '删除角色失败')
  }
}

onMounted(async () => {
  try {
    await Promise.all([loadRoles(), loadPermissions()])
  } catch (error) {
    ElMessage.error(error.message || '加载角色数据失败')
  }
})
</script>
