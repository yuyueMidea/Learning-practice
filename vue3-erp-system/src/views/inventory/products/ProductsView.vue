<template>
  <div class="products-page">
    <div class="page-header">
      <div>
        <div class="page-title">商品管理</div>
        <div class="page-subtitle">管理商品信息、规格（SKU）及库存设置</div>
      </div>
      <el-button type="primary" :icon="Plus" @click="openDialog()">新增商品</el-button>
    </div>

    <!-- Filters -->
    <el-card class="filter-card">
      <el-form :model="query" inline>
        <el-form-item label="关键词">
          <el-input v-model="query.keyword" placeholder="商品名称/编码" clearable style="width:200px" :prefix-icon="Search" />
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="query.category" placeholder="全部分类" clearable style="width:130px">
            <el-option v-for="c in categories" :key="c" :label="c" :value="c" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="query.status" placeholder="全部" clearable style="width:110px">
            <el-option label="上架" :value="1" />
            <el-option label="下架" :value="0" />
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
      <el-table :data="tableData" v-loading="loading" stripe class="erp-table">
        <el-table-column type="expand">
          <template #default="{ row }">
            <div class="sku-expand" v-if="row.skus && row.skus.length">
              <div class="sku-title">SKU 规格列表</div>
              <el-table :data="row.skus" size="small" border style="width:600px">
                <el-table-column prop="specName" label="规格" />
                <el-table-column prop="code" label="SKU编码" />
                <el-table-column prop="price" label="价格">
                  <template #default="{ row }">¥{{ row.price?.toFixed(2) }}</template>
                </el-table-column>
                <el-table-column prop="stock" label="库存" />
              </el-table>
            </div>
            <div v-else class="sku-expand">
              <el-text type="info">该商品无多规格信息</el-text>
            </div>
          </template>
        </el-table-column>
        <el-table-column type="index" label="#" width="50" />
        <el-table-column label="商品信息" min-width="200">
          <template #default="{ row }">
            <div class="product-cell">
              <div class="product-thumb">
                <el-icon><Goods /></el-icon>
              </div>
              <div>
                <div class="product-name">{{ row.name }}</div>
                <div class="product-code">{{ row.code }}</div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="category" label="分类" width="110">
          <template #default="{ row }">
            <el-tag type="info" size="small">{{ row.category }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="售价" width="100">
          <template #default="{ row }">
            <span style="color: #1a56db; font-weight: 600">¥{{ row.price?.toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="成本价" width="100">
          <template #default="{ row }">¥{{ row.costPrice?.toFixed(2) }}</template>
        </el-table-column>
        <el-table-column prop="stock" label="当前库存" width="100" align="center">
          <template #default="{ row }">
            <el-tag
              :type="row.stock <= row.minStock ? 'danger' : row.stock <= row.minStock * 1.5 ? 'warning' : 'success'"
              size="small"
            >{{ row.stock }} {{ row.unit }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="warehouse" label="仓库" width="100" />
        <el-table-column prop="status" label="状态" width="80" align="center">
          <template #default="{ row }">
            <el-switch :model-value="row.status === 1" @change="(v) => toggleStatus(row, v)" size="small" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="130" fixed="right">
          <template #default="{ row }">
            <el-button text type="primary" size="small" :icon="Edit" @click="openDialog(row)">编辑</el-button>
            <el-button text type="danger" size="small" :icon="Delete" @click="deleteProduct(row)">删除</el-button>
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

    <!-- Product Dialog -->
    <el-dialog
      v-model="dialogVisible"
      :title="editRow ? '编辑商品' : '新增商品'"
      width="680px"
      destroy-on-close
    >
      <el-tabs v-model="activeTab">
        <!-- Basic Info -->
        <el-tab-pane label="基本信息" name="basic">
          <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
            <el-row :gutter="16">
              <el-col :span="12">
                <el-form-item label="商品名称" prop="name">
                  <el-input v-model="form.name" placeholder="商品名称" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="商品分类" prop="category">
                  <el-select v-model="form.category" style="width:100%">
                    <el-option v-for="c in categories" :key="c" :label="c" :value="c" />
                  </el-select>
                </el-form-item>
              </el-col>
            </el-row>
            <el-row :gutter="16">
              <el-col :span="12">
                <el-form-item label="售价" prop="price">
                  <el-input-number v-model="form.price" :min="0" :precision="2" style="width:100%" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="成本价" prop="costPrice">
                  <el-input-number v-model="form.costPrice" :min="0" :precision="2" style="width:100%" />
                </el-form-item>
              </el-col>
            </el-row>
            <el-row :gutter="16">
              <el-col :span="8">
                <el-form-item label="单位">
                  <el-select v-model="form.unit" style="width:100%">
                    <el-option v-for="u in units" :key="u" :label="u" :value="u" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="预警库存">
                  <el-input-number v-model="form.minStock" :min="0" style="width:100%" />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="存储仓库">
                  <el-select v-model="form.warehouse" style="width:100%">
                    <el-option v-for="w in warehouses" :key="w" :label="w" :value="w" />
                  </el-select>
                </el-form-item>
              </el-col>
            </el-row>
            <el-form-item label="商品描述">
              <el-input v-model="form.description" type="textarea" :rows="3" placeholder="商品详细描述" />
            </el-form-item>
            <el-form-item label="商品图片">
              <div class="image-upload-area">
                <div
                  v-for="(img, idx) in form.images"
                  :key="idx"
                  class="image-preview-item"
                >
                  <img :src="img" alt="" />
                  <div class="image-remove" @click="form.images.splice(idx, 1)">
                    <el-icon><Close /></el-icon>
                  </div>
                </div>
                <div class="image-upload-btn" @click="addMockImage">
                  <el-icon size="24"><Plus /></el-icon>
                  <span>上传图片</span>
                </div>
              </div>
              <div style="font-size:12px; color: #94a3b8; margin-top: 4px">点击上传按钮模拟图片上传（演示）</div>
            </el-form-item>
            <el-form-item label="上架状态">
              <el-switch v-model="form.status" :active-value="1" :inactive-value="0" active-text="上架" inactive-text="下架" />
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <!-- SKU Management -->
        <el-tab-pane label="规格管理 (SKU)" name="sku">
          <div class="sku-manager">
            <div class="sku-header">
              <span>规格列表</span>
              <el-button type="primary" size="small" :icon="Plus" @click="addSku">添加规格</el-button>
            </div>
            <el-table :data="form.skus" border size="small">
              <el-table-column label="规格名称" min-width="160">
                <template #default="{ row }">
                  <el-input v-model="row.specName" placeholder="如：颜色:红色" size="small" />
                </template>
              </el-table-column>
              <el-table-column label="SKU编码" width="140">
                <template #default="{ row }">
                  <el-input v-model="row.code" placeholder="SKU编码" size="small" />
                </template>
              </el-table-column>
              <el-table-column label="价格" width="130">
                <template #default="{ row }">
                  <el-input-number v-model="row.price" :min="0" :precision="2" size="small" style="width:100%" />
                </template>
              </el-table-column>
              <el-table-column label="库存" width="110">
                <template #default="{ row }">
                  <el-input-number v-model="row.stock" :min="0" size="small" style="width:100%" />
                </template>
              </el-table-column>
              <el-table-column label="操作" width="70" align="center">
                <template #default="{ $index }">
                  <el-button text type="danger" size="small" :icon="Delete" @click="form.skus.splice($index, 1)" />
                </template>
              </el-table-column>
            </el-table>
            <el-empty v-if="!form.skus.length" description="暂无规格，点击上方按钮添加" :image-size="60" />
          </div>
        </el-tab-pane>
      </el-tabs>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitForm">保存商品</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search, Refresh, Edit, Delete, Close, Goods } from '@element-plus/icons-vue'
import { productApi } from '@/api/index.js'

const loading = ref(false)
const submitting = ref(false)
const tableData = ref([])
const total = ref(0)
const dialogVisible = ref(false)
const editRow = ref(null)
const formRef = ref()
const activeTab = ref('basic')
const categories = ref([])

const query = reactive({ keyword: '', category: '', status: '', page: 1, pageSize: 10 })

const units = ['个', '箱', '件', '套', '吨', '千克', 'L', 'm²', '卷', '张']
const warehouses = ['A仓库', 'B仓库', 'C仓库', '中心仓']

const mockImages = [
  'https://via.placeholder.com/80x80/1a56db/ffffff?text=IMG',
  'https://via.placeholder.com/80x80/0ea5e9/ffffff?text=IMG',
  'https://via.placeholder.com/80x80/10b981/ffffff?text=IMG'
]

const defaultForm = () => ({
  name: '', category: '', price: 0, costPrice: 0, unit: '个',
  minStock: 10, maxStock: 500, warehouse: 'A仓库',
  description: '', status: 1, images: [], skus: []
})

const form = reactive(defaultForm())

const rules = {
  name: [{ required: true, message: '请输入商品名称', trigger: 'blur' }],
  category: [{ required: true, message: '请选择分类', trigger: 'change' }],
  price: [{ required: true, message: '请输入售价', trigger: 'blur' }]
}

const fetchData = async () => {
  loading.value = true
  try {
    const res = await productApi.getList(query)
    tableData.value = res.list
    total.value = res.total
    if (res.categories) categories.value = res.categories
  } finally {
    loading.value = false
  }
}

const resetQuery = () => {
  query.keyword = ''
  query.category = ''
  query.status = ''
  query.page = 1
  fetchData()
}

const openDialog = (row = null) => {
  editRow.value = row
  activeTab.value = 'basic'
  if (row) {
    Object.assign(form, { ...defaultForm(), ...row, images: [...(row.images || [])], skus: [...(row.skus || [])] })
  } else {
    Object.assign(form, defaultForm())
  }
  dialogVisible.value = true
}

const addMockImage = () => {
  if (form.images.length >= 5) { ElMessage.warning('最多上传5张图片'); return }
  form.images.push(mockImages[form.images.length % mockImages.length])
}

const addSku = () => {
  form.skus.push({ id: Date.now(), specName: '', code: 'SKU' + Math.random().toString(36).substring(2, 8).toUpperCase(), price: form.price || 0, stock: 0 })
}

const submitForm = async () => {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) { activeTab.value = 'basic'; return }
  submitting.value = true
  try {
    if (editRow.value) {
      await productApi.update(editRow.value.id, form)
      ElMessage.success('商品信息已更新')
    } else {
      await productApi.create(form)
      ElMessage.success('商品创建成功')
    }
    dialogVisible.value = false
    fetchData()
  } finally {
    submitting.value = false
  }
}

const deleteProduct = async (row) => {
  await ElMessageBox.confirm(`确认删除商品「${row.name}」？`, '确认删除', { type: 'warning' })
  await productApi.delete(row.id)
  ElMessage.success('商品已删除')
  fetchData()
}

const toggleStatus = async (row, val) => {
  await productApi.update(row.id, { ...row, status: val ? 1 : 0 })
  row.status = val ? 1 : 0
}

onMounted(fetchData)
</script>

<style lang="scss" scoped>
.products-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.filter-card { :deep(.el-card__body) { padding: 16px 20px 0; } }

.product-cell {
  display: flex;
  align-items: center;
  gap: 10px;
  
  .product-thumb {
    width: 36px; height: 36px;
    background: linear-gradient(135deg, rgba($primary, 0.1), rgba($secondary, 0.1));
    border-radius: $radius;
    display: flex; align-items: center; justify-content: center;
    color: $primary;
    font-size: 18px;
    flex-shrink: 0;
  }
  
  .product-name { font-size: 13px; font-weight: 500; color: $gray-800; }
  .product-code { font-size: 11px; color: $gray-400; margin-top: 2px; font-family: monospace; }
}

.sku-expand {
  padding: 16px 20px;
  background: $gray-50;
  
  .sku-title {
    font-size: 13px;
    font-weight: 600;
    color: $gray-700;
    margin-bottom: 10px;
  }
}

.pagination-wrap {
  display: flex;
  justify-content: flex-end;
  padding-top: 16px;
}

// Image upload
.image-upload-area {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  
  .image-preview-item {
    width: 80px; height: 80px;
    border-radius: $radius;
    overflow: hidden;
    position: relative;
    border: 1px solid $gray-200;
    
    img { width: 100%; height: 100%; object-fit: cover; }
    
    .image-remove {
      position: absolute;
      top: 2px; right: 2px;
      width: 20px; height: 20px;
      background: rgba(0,0,0,0.6);
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
      color: #fff;
      font-size: 11px;
      opacity: 0;
      transition: opacity $transition-fast;
    }
    
    &:hover .image-remove { opacity: 1; }
  }
  
  .image-upload-btn {
    width: 80px; height: 80px;
    border: 2px dashed $gray-300;
    border-radius: $radius;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: $gray-400;
    font-size: 11px;
    gap: 4px;
    transition: all $transition-fast;
    
    &:hover { border-color: $primary; color: $primary; background: rgba($primary, 0.04); }
  }
}

.sku-manager {
  .sku-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    font-size: 13px;
    font-weight: 600;
    color: $gray-700;
  }
}
</style>
