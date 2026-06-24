<template>
  <div class="page-container">
    <SearchBar
      :model-value="filters"
      :fields="searchFields"
      @update:model-value="Object.assign(filters, $event)"
      @search="loadPermissions"
      @reset="resetFilters"
    />

    <DataTable :data="filteredPermissions" :columns="columns" :loading="loading" :show-column-setting="false">
      <template #toolbar>
        <el-button v-permission="['system:permission:create']" type="primary" :icon="Plus" @click="openCreate">新增权限</el-button>
      </template>
      <template #cell-action="{ row }">
        <el-tag size="small" :type="actionTagType(row.action)">{{ actionLabel(row.action) }}</el-tag>
      </template>
      <template #cell-status="{ row }">
        <el-tag :type="statusTagType(row.status)">{{ statusLabel(row.status) }}</el-tag>
      </template>
      <template #cell-actions="{ row }">
        <el-button v-permission="['system:permission:update']" link type="primary" @click="openEdit(row)">编辑</el-button>
        <el-button v-permission="['system:permission:delete']" link type="danger" @click="handleDelete(row)">删除</el-button>
      </template>
    </DataTable>

    <FormDialog
      v-model="dialog.visible"
      :title="dialog.isEdit ? '编辑权限' : '新增权限'"
      :form="form"
      :rules="rules"
      width="650px"
      :submit-loading="dialog.submitting"
      @cancel="closeDialog"
      @submit="submitForm"
    >
      <el-form-item label="权限名称" prop="name"><el-input v-model="form.name" placeholder="例如：客户档案-查看" /></el-form-item>
      <el-row :gutter="16">
        <el-col :span="12"><el-form-item label="所属模块" prop="module"><el-input v-model="form.module" placeholder="例如：base" /></el-form-item></el-col>
        <el-col :span="12"><el-form-item label="资源标识" prop="resource"><el-input v-model="form.resource" placeholder="例如：base:customer" /></el-form-item></el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="12"><el-form-item label="操作类型" prop="action"><el-select v-model="form.action" style="width:100%" @change="syncCode"><el-option v-for="item in actionOptions" :key="item.value" :label="item.label" :value="item.value" /></el-select></el-form-item></el-col>
        <el-col :span="12"><el-form-item label="权限编码" prop="code"><el-input v-model="form.code" placeholder="resource:action" /></el-form-item></el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="12"><el-form-item label="状态"><el-radio-group v-model="form.status"><el-radio value="active">启用</el-radio><el-radio value="inactive">停用</el-radio></el-radio-group></el-form-item></el-col>
        <el-col :span="12"><el-form-item label="排序"><el-input-number v-model="form.sort_order" :min="0" :max="9999" controls-position="right" /></el-form-item></el-col>
      </el-row>
      <el-form-item label="说明"><el-input v-model="form.description" type="textarea" :rows="3" maxlength="500" show-word-limit /></el-form-item>
    </FormDialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import SearchBar from '@/components/common/SearchBar.vue'
import DataTable from '@/components/common/DataTable.vue'
import FormDialog from '@/components/common/FormDialog.vue'
import { createPermission, deletePermission, fetchPermissions, updatePermission } from '@/api/system'
import { statusLabel, statusTagType } from '@/utils/format'
import { requiredRule } from '@/utils/validate'

const loading = ref(false)
const permissions = ref([])
const filters = reactive({ keyword: '', module: '', status: '' })
const dialog = reactive({ visible: false, isEdit: false, submitting: false })
const form = reactive(emptyForm())

const actionOptions = [
  { label: '查看', value: 'read' }, { label: '新增', value: 'create' }, { label: '编辑', value: 'update' },
  { label: '删除', value: 'delete' }, { label: '审核', value: 'approve' }, { label: '导出', value: 'export' }
]

const searchFields = [
  { key: 'keyword', label: '关键字', placeholder: '权限名称、编码或资源', width: '260px' },
  { key: 'module', label: '模块', type: 'select', width: '160px', options: [
    { label: '系统管理', value: 'system' }, { label: '基础数据', value: 'base' }, { label: '采购', value: 'purchase' },
    { label: '销售', value: 'sales' }, { label: '库存', value: 'inventory' }, { label: '财务', value: 'finance' }, { label: '存储', value: 'storage' }
  ] },
  { key: 'status', label: '状态', type: 'select', width: '140px', options: [{ label: '启用', value: 'active' }, { label: '停用', value: 'inactive' }] }
]

const columns = [
  { prop: 'name', label: '权限名称', minWidth: 180 }, { prop: 'code', label: '权限编码', minWidth: 230 },
  { prop: 'module', label: '模块', width: 120 }, { prop: 'resource', label: '资源', minWidth: 160 },
  { prop: 'action', label: '操作', width: 100, align: 'center', slot: 'cell-action' },
  { prop: 'status', label: '状态', width: 90, align: 'center', slot: 'cell-status' },
  { prop: 'sort_order', label: '排序', width: 80, align: 'center' },
  { prop: 'actions', label: '操作', width: 150, fixed: 'right', slot: 'cell-actions', showOverflowTooltip: false, exportable: false }
]

const rules = {
  name: [requiredRule('请输入权限名称')], module: [requiredRule('请输入模块')], resource: [requiredRule('请输入资源标识')],
  action: [requiredRule('请选择操作类型')], code: [requiredRule('请输入权限编码')]
}

const filteredPermissions = computed(() => {
  const keyword = String(filters.keyword || '').trim().toLowerCase()
  return permissions.value.filter((item) => {
    const matchedKeyword = !keyword || [item.name, item.code, item.resource].some((value) => String(value || '').toLowerCase().includes(keyword))
    return matchedKeyword && (!filters.module || item.module === filters.module) && (!filters.status || item.status === filters.status)
  })
})

function emptyForm() { return { id: '', name: '', code: '', module: '', resource: '', action: 'read', description: '', status: 'active', sort_order: 0 } }
function actionLabel(value) { return actionOptions.find((item) => item.value === value)?.label || value }
function actionTagType(value) { return ({ read: 'info', create: 'success', update: 'warning', delete: 'danger', approve: 'primary', export: '' })[value] || 'info' }
function syncCode() { if (form.resource && form.action) form.code = `${form.resource}:${form.action}` }

async function loadPermissions() {
  loading.value = true
  try { permissions.value = await fetchPermissions() } catch (error) { ElMessage.error(error.message || '加载权限失败') } finally { loading.value = false }
}
function resetFilters() { Object.assign(filters, { keyword: '', module: '', status: '' }); loadPermissions() }
function resetForm() { Object.assign(form, emptyForm()) }
function openCreate() { resetForm(); dialog.isEdit = false; dialog.visible = true }
function openEdit(row) { Object.assign(form, row); dialog.isEdit = true; dialog.visible = true }
function closeDialog() { dialog.visible = false; resetForm() }

async function submitForm() {
  dialog.submitting = true
  try {
    const payload = { ...form, code: form.code.trim(), name: form.name.trim(), module: form.module.trim(), resource: form.resource.trim(), description: form.description || null, sort_order: Number(form.sort_order || 0) }
    if (dialog.isEdit) await updatePermission(form.id, payload)
    else { delete payload.id; await createPermission(payload) }
    ElMessage.success(dialog.isEdit ? '权限已更新' : '权限已创建')
    closeDialog(); await loadPermissions()
  } catch (error) { ElMessage.error(error.message || '保存权限失败') } finally { dialog.submitting = false }
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(`确认删除权限「${row.name}」吗？角色关联将同时解除。`, '删除权限', { type: 'warning' })
    await deletePermission(row.id); ElMessage.success('权限已删除'); await loadPermissions()
  } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(error.message || '删除权限失败') }
}

onMounted(loadPermissions)
</script>
