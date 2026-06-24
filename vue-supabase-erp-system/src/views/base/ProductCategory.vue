<template>
  <div class="page-container category-page">
    <div class="page-toolbar">
      <div>
        <h2 class="page-title">商品分类</h2>
        <p class="page-description">支持树形分类、图标配置和拖拽排序。拖拽后会同时保存分类层级与同级排序。</p>
      </div>
      <el-button v-permission="['base:product_category:create']" type="primary" :icon="Plus" @click="openCreate()">新增顶级分类</el-button>
    </div>

    <section class="category-tree-card" v-loading="loading">
      <el-empty v-if="!categoryTree.length && !loading" description="暂无商品分类" />
      <el-tree
        v-else
        ref="treeRef"
        :data="categoryTree"
        node-key="id"
        :props="{ label: 'name', children: 'children' }"
        default-expand-all
        draggable
        :allow-drop="allowDrop"
        @node-drop="handleNodeDrop"
      >
        <template #default="{ data }">
          <div class="category-tree-node">
            <span class="category-tree-node__main">
              <el-icon v-if="data.icon"><component :is="data.icon" /></el-icon>
              <el-icon v-else><CollectionTag /></el-icon>
              <strong>{{ data.name }}</strong>
              <small>{{ data.code }}</small>
              <el-tag size="small" :type="data.status === 'active' ? 'success' : 'info'">{{ data.status === 'active' ? '启用' : '停用' }}</el-tag>
            </span>
            <span class="category-tree-node__actions">
              <el-button v-permission="['base:product_category:create']" link type="primary" @click.stop="openCreate(data)">新增子类</el-button>
              <el-button v-permission="['base:product_category:update']" link type="primary" @click.stop="openEdit(data)">编辑</el-button>
              <el-button v-permission="['base:product_category:delete']" link type="danger" @click.stop="handleDelete(data)">删除</el-button>
            </span>
          </div>
        </template>
      </el-tree>
    </section>

    <FormDialog v-model="dialog.visible" :title="dialog.isEdit ? '编辑商品分类' : '新增商品分类'" :form="form" :rules="rules" width="650px" :submit-loading="dialog.submitting" @cancel="closeDialog" @submit="submitForm">
      <el-form-item label="上级分类"><el-tree-select v-model="form.parent_id" :data="parentTree" node-key="id" check-strictly clearable :props="{ value: 'id', label: 'name', children: 'children', disabled: 'disabled' }" placeholder="顶级分类" style="width:100%" /></el-form-item>
      <el-form-item label="分类编码" prop="code"><el-input v-model="form.code" placeholder="例如：ELECTRONICS" /></el-form-item>
      <el-form-item label="分类名称" prop="name"><el-input v-model="form.name" /></el-form-item>
      <el-form-item label="分类图标"><IconPicker v-model="form.icon" /></el-form-item>
      <el-form-item label="排序"><el-input-number v-model="form.sort_order" :min="0" :max="9999" controls-position="right" /></el-form-item>
      <el-form-item label="状态"><el-radio-group v-model="form.status"><el-radio value="active">启用</el-radio><el-radio value="inactive">停用</el-radio></el-radio-group></el-form-item>
      <el-form-item label="备注"><el-input v-model="form.remark" type="textarea" :rows="3" maxlength="500" show-word-limit /></el-form-item>
    </FormDialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CollectionTag, Plus } from '@element-plus/icons-vue'
import FormDialog from '@/components/common/FormDialog.vue'
import IconPicker from '@/components/common/IconPicker.vue'
import { batchUpdateCategoryOrder, deleteProductCategory, fetchProductCategories, saveProductCategory } from '@/api/base'
import { codeRule, requiredRule } from '@/utils/validate'

const loading = ref(false)
const categories = ref([])
const treeRef = ref()
const dialog = reactive({ visible: false, isEdit: false, submitting: false })
const form = reactive(emptyForm())
const rules = { code: [requiredRule('请输入分类编码'), codeRule()], name: [requiredRule('请输入分类名称')] }

function buildTree(rows) {
  const copies = rows.map((item) => ({ ...item, children: [] }))
  const map = new Map(copies.map((item) => [item.id, item])); const roots = []
  copies.forEach((item) => { if (item.parent_id && map.has(item.parent_id)) map.get(item.parent_id).children.push(item); else roots.push(item) })
  const sort = (items) => { items.sort((a, b) => a.sort_order - b.sort_order || a.code.localeCompare(b.code)); items.forEach((item) => sort(item.children)) }; sort(roots)
  return roots
}
const categoryTree = computed(() => buildTree(categories.value))
const parentTree = computed(() => {
  const copy = JSON.parse(JSON.stringify(categoryTree.value))
  const mark = (items) => items.map((item) => ({ ...item, disabled: item.id === form.id, children: mark(item.children || []) }))
  return mark(copy)
})
function emptyForm() { return { id: '', parent_id: null, code: '', name: '', icon: '', sort_order: 0, status: 'active', remark: '' } }
async function loadCategories() { loading.value = true; try { categories.value = await fetchProductCategories() } catch (error) { ElMessage.error(error.message || '加载分类失败') } finally { loading.value = false } }
function resetForm() { Object.assign(form, emptyForm()) }
function openCreate(parent = null) { resetForm(); form.parent_id = parent?.id || null; form.sort_order = ((parent?.children?.length || 0) + 1) * 10; dialog.isEdit = false; dialog.visible = true }
function openEdit(row) { Object.assign(form, { ...emptyForm(), ...row, parent_id: row.parent_id || null }); dialog.isEdit = true; dialog.visible = true }
function closeDialog() { dialog.visible = false; resetForm() }
async function submitForm() { dialog.submitting = true; try { await saveProductCategory({ ...form, parent_id: form.parent_id || null }); ElMessage.success(dialog.isEdit ? '分类已更新' : '分类已创建'); closeDialog(); await loadCategories() } catch (error) { ElMessage.error(error.message || '保存分类失败') } finally { dialog.submitting = false } }
function allowDrop(draggingNode, dropNode, type) { if (draggingNode.data.id === dropNode.data.id) return false; return ['prev', 'next', 'inner'].includes(type) }
async function handleNodeDrop() {
  const records = []
  const walk = (items, parentId = null) => items.forEach((item, index) => { records.push({ id: item.id, parent_id: parentId, sort_order: (index + 1) * 10 }); if (item.children?.length) walk(item.children, item.id) })
  walk(categoryTree.value)
  try { await batchUpdateCategoryOrder(records); ElMessage.success('分类结构与排序已保存'); await loadCategories() } catch (error) { ElMessage.error(error.message || '保存分类排序失败'); await loadCategories() }
}
async function handleDelete(row) { try { await ElMessageBox.confirm(`确认删除分类「${row.name}」吗？有子分类或商品引用时数据库会阻止删除。`, '删除分类', { type: 'warning' }); await deleteProductCategory(row.id); ElMessage.success('分类已删除'); await loadCategories() } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(error.message || '删除分类失败') } }
onMounted(loadCategories)
</script>
