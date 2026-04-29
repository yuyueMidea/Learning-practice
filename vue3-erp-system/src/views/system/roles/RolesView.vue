<template>
  <div class="roles-page">
    <div class="page-header">
      <div>
        <div class="page-title">角色管理</div>
        <div class="page-subtitle">管理系统角色及对应的菜单、按钮权限</div>
      </div>
      <el-button type="primary" :icon="Plus" @click="openDialog()">新增角色</el-button>
    </div>

    <div class="roles-layout">
      <!-- Role list -->
      <el-card class="roles-list-card">
        <template #header>
          <span style="font-weight: 600">角色列表</span>
        </template>
        <div v-loading="loading" class="role-items">
          <div
            v-for="role in roleList"
            :key="role.id"
            class="role-item"
            :class="{ active: selectedRole?.id === role.id }"
            @click="selectRole(role)"
          >
            <div class="role-left">
              <div class="role-badge">{{ role.name.charAt(0) }}</div>
              <div>
                <div class="role-name">{{ role.name }}</div>
                <div class="role-code">{{ role.code }}</div>
              </div>
            </div>
            <div class="role-meta">
              <el-tag size="small" :type="role.status ? 'success' : 'info'">
                {{ role.status ? '启用' : '禁用' }}
              </el-tag>
              <span class="role-count">{{ role.userCount }}人</span>
            </div>
          </div>
        </div>
      </el-card>

      <!-- Permission tree -->
      <el-card class="permissions-card" v-if="selectedRole">
        <template #header>
          <div style="display:flex; justify-content:space-between; align-items:center">
            <div>
              <span style="font-weight:600">权限配置 - {{ selectedRole.name }}</span>
              <el-tag type="info" size="small" style="margin-left:8px">{{ selectedRole.code }}</el-tag>
            </div>
            <div style="display:flex; gap:8px">
              <el-button size="small" @click="openDialog(selectedRole)" :icon="Edit">编辑信息</el-button>
              <el-button size="small" type="danger" @click="deleteRole(selectedRole)" :icon="Delete" :disabled="selectedRole.id <= 3">删除</el-button>
            </div>
          </div>
        </template>
        
        <div class="permission-info">
          <div class="perm-meta">
            <span>描述：{{ selectedRole.description || '暂无描述' }}</span>
            <span>创建时间：{{ selectedRole.createTime }}</span>
            <span>使用人数：{{ selectedRole.userCount }}人</span>
          </div>
        </div>

        <div class="tree-header">
          <span style="font-weight:500; color: #334155">权限树</span>
          <div>
            <el-button link @click="checkAll">全选</el-button>
            <el-button link @click="clearAll">清空</el-button>
            <el-button type="primary" size="small" :loading="savingPerms" @click="savePermissions">保存权限</el-button>
          </div>
        </div>

        <el-tree
          ref="treeRef"
          :data="permTree"
          show-checkbox
          node-key="id"
          :default-checked-keys="currentPerms"
          :props="{ children: 'children', label: 'name' }"
          default-expand-all
          class="perm-tree"
        >
          <template #default="{ node, data }">
            <div class="tree-node">
              <el-icon v-if="data.type === 'menu'" style="color: #1a56db"><Menu /></el-icon>
              <el-icon v-else style="color: #f59e0b"><SetUp /></el-icon>
              <span>{{ data.name }}</span>
              <el-tag size="small" :type="data.type === 'menu' ? 'primary' : 'warning'" style="margin-left:6px; font-size:10px">
                {{ data.type === 'menu' ? '菜单' : '按钮' }}
              </el-tag>
            </div>
          </template>
        </el-tree>
      </el-card>

      <el-card class="permissions-card empty-state" v-else>
        <el-empty description="请选择左侧角色以查看权限配置" />
      </el-card>
    </div>

    <!-- Dialog -->
    <el-dialog
      v-model="dialogVisible"
      :title="editRow ? '编辑角色' : '新增角色'"
      width="480px"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="角色名称" prop="name">
          <el-input v-model="form.name" placeholder="如：仓库管理员" />
        </el-form-item>
        <el-form-item label="角色编码" prop="code">
          <el-input v-model="form.code" placeholder="如：WAREHOUSE（大写英文）" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="3" placeholder="角色描述" />
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
import { Plus, Edit, Delete, Menu, SetUp } from '@element-plus/icons-vue'
import { roleApi } from '@/api/index.js'

const loading = ref(false)
const submitting = ref(false)
const savingPerms = ref(false)
const roleList = ref([])
const selectedRole = ref(null)
const permTree = ref([])
const currentPerms = ref([])
const dialogVisible = ref(false)
const editRow = ref(null)
const formRef = ref()
const treeRef = ref()

const form = reactive({ name: '', code: '', description: '', status: 1, permissions: [] })

const rules = {
  name: [{ required: true, message: '请输入角色名称', trigger: 'blur' }],
  code: [{ required: true, message: '请输入角色编码', trigger: 'blur' }]
}

const fetchRoles = async () => {
  loading.value = true
  try {
    const res = await roleApi.getList()
    roleList.value = res.list || res
  } finally {
    loading.value = false
  }
}

const fetchPermissions = async () => {
  const res = await roleApi.getPermissions()
  permTree.value = res
}

const selectRole = (role) => {
  selectedRole.value = role
  currentPerms.value = role.permissions || []
}

const checkAll = () => {
  const getAllIds = (nodes) => nodes.flatMap(n => [n.id, ...(n.children ? getAllIds(n.children) : [])])
  treeRef.value?.setCheckedKeys(getAllIds(permTree.value))
}

const clearAll = () => {
  treeRef.value?.setCheckedKeys([])
}

const savePermissions = async () => {
  if (!selectedRole.value) return
  savingPerms.value = true
  const checkedKeys = treeRef.value?.getCheckedKeys() || []
  const halfCheckedKeys = treeRef.value?.getHalfCheckedKeys() || []
  const allKeys = [...new Set([...checkedKeys, ...halfCheckedKeys])]
  try {
    await roleApi.update(selectedRole.value.id, {
      ...selectedRole.value,
      permissions: allKeys
    })
    selectedRole.value.permissions = allKeys
    currentPerms.value = allKeys
    ElMessage.success('权限配置已保存')
  } finally {
    savingPerms.value = false
  }
}

const openDialog = (row = null) => {
  editRow.value = row
  if (row) {
    Object.assign(form, { name: row.name, code: row.code, description: row.description, status: row.status })
  } else {
    Object.assign(form, { name: '', code: '', description: '', status: 1 })
  }
  dialogVisible.value = true
}

const submitForm = async () => {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  submitting.value = true
  try {
    if (editRow.value) {
      await roleApi.update(editRow.value.id, form)
      ElMessage.success('角色信息已更新')
    } else {
      await roleApi.create({ ...form, permissions: [] })
      ElMessage.success('角色创建成功')
    }
    dialogVisible.value = false
    fetchRoles()
  } finally {
    submitting.value = false
  }
}

const deleteRole = async (role) => {
  await ElMessageBox.confirm(`确认删除角色「${role.name}」？`, '确认删除', { type: 'warning' })
  await roleApi.delete(role.id)
  ElMessage.success('角色已删除')
  selectedRole.value = null
  fetchRoles()
}

onMounted(() => {
  fetchRoles()
  fetchPermissions()
})
</script>

<style lang="scss" scoped>
.roles-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.roles-layout {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 16px;
  align-items: start;
}

.roles-list-card {
  .role-items {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .role-item {
    padding: 12px 14px;
    border-radius: $radius;
    border: 1px solid $gray-200;
    cursor: pointer;
    transition: all $transition-fast;
    display: flex;
    align-items: center;
    justify-content: space-between;
    
    &:hover, &.active {
      border-color: $primary;
      background: rgba($primary, 0.04);
    }
    
    &.active { background: rgba($primary, 0.08); }
  }
  
  .role-left {
    display: flex;
    align-items: center;
    gap: 10px;
    
    .role-badge {
      width: 34px; height: 34px;
      border-radius: $radius;
      background: linear-gradient(135deg, $primary, $secondary);
      color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-weight: 700;
      font-size: 14px;
    }
    
    .role-name { font-size: 13px; font-weight: 600; color: $gray-800; }
    .role-code { font-size: 11px; color: $gray-400; margin-top: 2px; }
  }
  
  .role-meta {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
    .role-count { font-size: 11px; color: $gray-400; }
  }
}

.permissions-card {
  &.empty-state {
    min-height: 400px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}

.permission-info {
  margin-bottom: 16px;
  
  .perm-meta {
    display: flex;
    gap: 24px;
    font-size: 13px;
    color: $gray-500;
    padding: 12px 16px;
    background: $gray-50;
    border-radius: $radius;
    border: 1px solid $gray-100;
  }
}

.tree-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0 12px;
  border-bottom: 1px solid $gray-100;
  margin-bottom: 12px;
}

.perm-tree {
  .tree-node {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
  }
}
</style>
