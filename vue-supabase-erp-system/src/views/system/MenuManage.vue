<template>
  <div class="page-container">
    <div class="page-toolbar">
      <div>
        <h2 class="page-title">菜单管理</h2>
        <p class="page-description">菜单为树形结构。可拖拽同级菜单调整顺序；按钮类型不产生路由，仅用于权限标识。</p>
      </div>
      <el-button v-permission="['system:menu:create']" type="primary" :icon="Plus" @click="openCreate">新增菜单</el-button>
    </div>

    <DataTable
      row-key="id"
      :tree-props="{ children: 'children' }"
      :data="menuTree"
      :columns="columns"
      :loading="loading"
      :show-column-setting="false"
    >
      <template #cell-name="{ row }">
        <span
          class="menu-drag-cell"
          draggable="true"
          @dragstart.stop="handleDragStart(row)"
          @dragover.prevent.stop
          @drop.prevent.stop="handleDrop(row)"
        >
          <el-icon class="menu-drag-cell__handle"><Rank /></el-icon>
          <el-icon v-if="row.icon"><component :is="row.icon" /></el-icon>
          <span>{{ row.name }}</span>
        </span>
      </template>
      <template #cell-menu_type="{ row }"><el-tag size="small" :type="menuTypeTag(row.menu_type)">{{ menuTypeLabel(row.menu_type) }}</el-tag></template>
      <template #cell-status="{ row }"><el-tag :type="statusTagType(row.status)">{{ statusLabel(row.status) }}</el-tag></template>
      <template #cell-is_visible="{ row }"><el-tag size="small" :type="row.is_visible ? 'success' : 'info'">{{ row.is_visible ? '显示' : '隐藏' }}</el-tag></template>
      <template #cell-actions="{ row }">
        <el-button v-permission="['system:menu:create']" link type="primary" @click="openCreate(row)">新增子项</el-button>
        <el-button v-permission="['system:menu:update']" link type="primary" @click="openEdit(row)">编辑</el-button>
        <el-button v-permission="['system:menu:delete']" link type="danger" @click="handleDelete(row)">删除</el-button>
      </template>
    </DataTable>

    <FormDialog
      v-model="dialog.visible"
      :title="dialog.isEdit ? '编辑菜单' : '新增菜单'"
      :form="form"
      :rules="rules"
      width="790px"
      :submit-loading="dialog.submitting"
      @cancel="closeDialog"
      @submit="submitForm"
    >
      <el-row :gutter="18">
        <el-col :span="12">
          <el-form-item label="上级菜单">
            <el-tree-select
              v-model="form.parent_id"
              :data="parentMenuTree"
              node-key="id"
              check-strictly
              clearable
              :props="{ value: 'id', label: 'name', children: 'children', disabled: 'disabled' }"
              placeholder="顶级菜单"
              style="width: 100%"
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="菜单类型" prop="menu_type">
            <el-select v-model="form.menu_type" style="width: 100%" @change="handleTypeChange">
              <el-option label="目录" value="directory" />
              <el-option label="菜单" value="menu" />
              <el-option label="按钮" value="button" />
              <el-option label="外链" value="external" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12"><el-form-item label="菜单编码" prop="code"><el-input v-model="form.code" placeholder="例如：base-products" /></el-form-item></el-col>
        <el-col :span="12"><el-form-item label="菜单名称" prop="name"><el-input v-model="form.name" maxlength="100" show-word-limit /></el-form-item></el-col>
        <el-col :span="12"><el-form-item label="路由路径" :prop="form.menu_type === 'button' ? '' : 'route_path'"><el-input v-model="form.route_path" :disabled="form.menu_type === 'button'" placeholder="例如：/base/products" /></el-form-item></el-col>
        <el-col :span="12"><el-form-item label="组件路径"><el-input v-model="form.component_path" :disabled="!['menu', 'external'].includes(form.menu_type)" placeholder="例如：base/ProductManage" /></el-form-item></el-col>
        <el-col :span="12"><el-form-item label="图标"><IconPicker v-model="form.icon" /></el-form-item></el-col>
        <el-col :span="12"><el-form-item label="权限标识"><el-select v-model="form.permission_code" filterable clearable placeholder="选择或输入权限编码" style="width:100%" allow-create default-first-option><el-option v-for="item in permissions" :key="item.id" :label="`${item.name}（${item.code}）`" :value="item.code" /></el-select></el-form-item></el-col>
        <el-col :span="8"><el-form-item label="排序"><el-input-number v-model="form.sort_order" :min="0" :max="9999" controls-position="right" /></el-form-item></el-col>
        <el-col :span="16"><el-form-item label="状态"><el-radio-group v-model="form.status"><el-radio value="active">启用</el-radio><el-radio value="inactive">停用</el-radio></el-radio-group><el-checkbox v-model="form.is_visible" style="margin-left:16px">菜单显示</el-checkbox></el-form-item></el-col>
        <el-col :span="24"><el-form-item label="展示选项"><el-checkbox v-model="form.is_cacheable">缓存页面</el-checkbox><el-checkbox v-model="form.is_affix">固定标签</el-checkbox></el-form-item></el-col>
        <el-col :span="24"><el-form-item label="重定向"><el-input v-model="form.redirect_path" placeholder="目录可选，例如：/base/customers" /></el-form-item></el-col>
        <el-col :span="24"><el-form-item label="扩展元数据"><el-input v-model="form.metaText" type="textarea" :rows="3" placeholder='JSON，例如：{"hidden": false}' /></el-form-item></el-col>
      </el-row>
    </FormDialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Rank } from '@element-plus/icons-vue'
import DataTable from '@/components/common/DataTable.vue'
import FormDialog from '@/components/common/FormDialog.vue'
import IconPicker from '@/components/common/IconPicker.vue'
import { batchUpdateMenuOrder, createMenu, deleteMenu, fetchMenus, fetchPermissions, updateMenu } from '@/api/system'
import { statusLabel, statusTagType } from '@/utils/format'
import { codeRule, requiredRule } from '@/utils/validate'

const loading = ref(false)
const menus = ref([])
const permissions = ref([])
const draggingRow = ref(null)
const dialog = reactive({ visible: false, isEdit: false, submitting: false })
const form = reactive(emptyForm())

const columns = [
  { prop: 'name', label: '菜单名称', minWidth: 230, slot: 'cell-name' }, { prop: 'code', label: '编码', minWidth: 160 },
  { prop: 'menu_type', label: '类型', width: 100, align: 'center', slot: 'cell-menu_type' },
  { prop: 'route_path', label: '路由路径', minWidth: 190 }, { prop: 'component_path', label: '组件路径', minWidth: 190 },
  { prop: 'permission_code', label: '权限标识', minWidth: 180 }, { prop: 'sort_order', label: '排序', width: 80, align: 'center' },
  { prop: 'is_visible', label: '显示', width: 80, align: 'center', slot: 'cell-is_visible' }, { prop: 'status', label: '状态', width: 90, align: 'center', slot: 'cell-status' },
  { prop: 'actions', label: '操作', width: 230, fixed: 'right', slot: 'cell-actions', showOverflowTooltip: false, exportable: false }
]

const rules = computed(() => ({
  code: [requiredRule('请输入菜单编码'), codeRule()], name: [requiredRule('请输入菜单名称')], menu_type: [requiredRule('请选择菜单类型')],
  route_path: form.menu_type === 'button' ? [] : [requiredRule('请输入路由路径')]
}))

function treeFromRows(rows) {
  const copies = rows.map((item) => ({ ...item, children: [] }))
  const map = new Map(copies.map((item) => [item.id, item]))
  const roots = []
  copies.forEach((item) => {
    if (item.parent_id && map.has(item.parent_id)) map.get(item.parent_id).children.push(item)
    else roots.push(item)
  })
  const sort = (items) => {
    items.sort((a, b) => a.sort_order - b.sort_order || a.code.localeCompare(b.code))
    items.forEach((item) => sort(item.children))
  }
  sort(roots)
  return roots
}

const menuTree = computed(() => treeFromRows(menus.value))
const parentMenuTree = computed(() => {
  const copy = JSON.parse(JSON.stringify(menuTree.value))
  const disableSelf = (items) => items.map((item) => ({ ...item, disabled: item.id === form.id, children: disableSelf(item.children || []) }))
  return disableSelf(copy)
})

function emptyForm() {
  return { id: '', parent_id: null, code: '', name: '', menu_type: 'menu', route_path: '', component_path: '', redirect_path: '', icon: '', permission_code: '', sort_order: 0, is_visible: true, is_cacheable: false, is_affix: false, status: 'active', metaText: '{}' }
}
function menuTypeLabel(type) { return ({ directory: '目录', menu: '菜单', button: '按钮', external: '外链' })[type] || type }
function menuTypeTag(type) { return ({ directory: 'warning', menu: 'success', button: 'info', external: 'primary' })[type] || 'info' }

async function loadMenus() {
  loading.value = true
  try { menus.value = await fetchMenus() } catch (error) { ElMessage.error(error.message || '加载菜单失败') } finally { loading.value = false }
}
function resetForm() { Object.assign(form, emptyForm()) }
function openCreate(parent = null) { resetForm(); form.parent_id = parent?.id || null; form.sort_order = (parent?.children?.length || 0) * 10 + 10; dialog.isEdit = false; dialog.visible = true }
function openEdit(row) { Object.assign(form, { ...row, parent_id: row.parent_id || null, metaText: JSON.stringify(row.meta || {}, null, 2) }); dialog.isEdit = true; dialog.visible = true }
function closeDialog() { dialog.visible = false; resetForm() }
function handleTypeChange(type) { if (type === 'button') { form.route_path = ''; form.component_path = ''; form.redirect_path = '' } }

async function submitForm() {
  let meta = {}
  try { meta = form.metaText?.trim() ? JSON.parse(form.metaText) : {} } catch { ElMessage.error('扩展元数据必须是有效的 JSON'); return }
  dialog.submitting = true
  try {
    const payload = {
      parent_id: form.parent_id || null, code: form.code.trim(), name: form.name.trim(), menu_type: form.menu_type,
      route_path: form.menu_type === 'button' ? null : (form.route_path.trim() || null),
      component_path: ['menu', 'external'].includes(form.menu_type) ? (form.component_path.trim() || null) : null,
      redirect_path: form.redirect_path.trim() || null, icon: form.icon || null, permission_code: form.permission_code || null,
      sort_order: Number(form.sort_order || 0), is_visible: Boolean(form.is_visible), is_cacheable: Boolean(form.is_cacheable),
      is_affix: Boolean(form.is_affix), status: form.status, meta
    }
    if (dialog.isEdit) await updateMenu(form.id, payload)
    else await createMenu(payload)
    ElMessage.success(dialog.isEdit ? '菜单已更新' : '菜单已创建')
    closeDialog(); await loadMenus()
  } catch (error) { ElMessage.error(error.message || '保存菜单失败') } finally { dialog.submitting = false }
}

function handleDragStart(row) { draggingRow.value = row }
async function handleDrop(target) {
  const source = draggingRow.value
  draggingRow.value = null
  if (!source || source.id === target.id) return
  if ((source.parent_id || null) !== (target.parent_id || null)) { ElMessage.warning('当前仅支持同级菜单排序；请使用编辑功能调整上级菜单。'); return }
  const siblings = menus.value.filter((item) => (item.parent_id || null) === (target.parent_id || null)).sort((a, b) => a.sort_order - b.sort_order || a.code.localeCompare(b.code))
  const sourceIndex = siblings.findIndex((item) => item.id === source.id)
  const targetIndex = siblings.findIndex((item) => item.id === target.id)
  if (sourceIndex < 0 || targetIndex < 0) return
  siblings.splice(sourceIndex, 1)
  siblings.splice(targetIndex, 0, source)
  const records = siblings.map((item, index) => ({ id: item.id, parent_id: item.parent_id, sort_order: (index + 1) * 10 }))
  try { await batchUpdateMenuOrder(records); ElMessage.success('排序已保存'); await loadMenus() } catch (error) { ElMessage.error(error.message || '保存排序失败') }
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(`确认删除菜单「${row.name}」吗？其子菜单将根据数据库级联规则一并删除。`, '删除菜单', { type: 'warning' })
    await deleteMenu(row.id); ElMessage.success('菜单已删除'); await loadMenus()
  } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(error.message || '删除菜单失败') }
}

onMounted(async () => { await Promise.all([loadMenus(), fetchPermissions().then((data) => { permissions.value = data })]) })
</script>
