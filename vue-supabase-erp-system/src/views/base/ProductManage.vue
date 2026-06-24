<template>
  <div class="page-container">
    <SearchBar :model-value="table.query" :fields="searchFields" @update:model-value="updateQuery" @search="table.search" @reset="table.reset" />

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
        <el-button v-permission="['base:product:create']" type="primary" :icon="Plus" @click="openCreate">新增商品</el-button>
        <el-button v-permission="['base:product:export']" :icon="Download" @click="downloadTemplate">下载导入模板</el-button>
        <el-button v-permission="['base:product:create']" :icon="Upload" @click="importDialog.visible = true">批量导入</el-button>
      </template>
      <template #cell-product="{ row }">
        <div class="product-cell">
          <el-image v-if="row.image_url" :src="row.image_url" fit="cover" class="product-cell__image" :preview-src-list="[row.image_url]" preview-teleported />
          <div v-else class="product-cell__placeholder"><el-icon><Goods /></el-icon></div>
          <div><div class="product-cell__name">{{ row.name }}</div><div class="product-cell__sub">{{ row.code }} · {{ row.model || '无型号' }}</div></div>
        </div>
      </template>
      <template #cell-category="{ row }">{{ row.category?.name || '-' }}</template>
      <template #cell-unit="{ row }">{{ row.unit?.name || '-' }}</template>
      <template #cell-sale_price="{ row }">{{ formatCurrency(row.sale_price) }}</template>
      <template #cell-stock_rule="{ row }"><span>{{ row.safety_stock || 0 }}</span><small class="muted-text"> / 最低 {{ row.min_stock || 0 }}</small></template>
      <template #cell-status="{ row }"><el-tag :type="statusTagType(row.status)">{{ statusLabel(row.status) }}</el-tag></template>
      <template #cell-actions="{ row }"><el-button v-permission="['base:product:update']" link type="primary" @click="openEdit(row)">编辑</el-button><el-button v-permission="['base:product:delete']" link type="danger" @click="handleDelete(row)">删除</el-button></template>
    </DataTable>

    <el-dialog v-model="dialog.visible" :title="dialog.isEdit ? '编辑商品档案' : '新增商品档案'" width="1080px" top="5vh" :close-on-click-modal="false" destroy-on-close @closed="closeDialog">
      <el-form ref="productFormRef" :model="form" :rules="rules" label-width="100px" :validate-on-rule-change="false">
        <el-tabs v-model="dialog.tab" class="entity-form-tabs">
          <el-tab-pane label="基本信息" name="basic">
            <el-row :gutter="18">
              <el-col :span="12"><el-form-item label="商品编码" prop="code"><el-input v-model="form.code" placeholder="例如：PRD-001" /></el-form-item></el-col>
              <el-col :span="12"><el-form-item label="商品名称" prop="name"><el-input v-model="form.name" /></el-form-item></el-col>
              <el-col :span="12"><el-form-item label="商品简称"><el-input v-model="form.short_name" /></el-form-item></el-col>
              <el-col :span="12"><el-form-item label="商品分类"><el-tree-select v-model="form.category_id" :data="categoryTree" node-key="id" check-strictly clearable :props="{ value: 'id', label: 'name', children: 'children' }" placeholder="请选择分类" style="width:100%" /></el-form-item></el-col>
              <el-col :span="12"><el-form-item label="基本单位" prop="base_unit_id"><el-select v-model="form.base_unit_id" filterable style="width:100%"><el-option v-for="unit in units" :key="unit.id" :label="`${unit.name}（${unit.code}）`" :value="unit.id" /></el-select></el-form-item></el-col>
              <el-col :span="12"><el-form-item label="品牌"><el-input v-model="form.brand" /></el-form-item></el-col>
              <el-col :span="12"><el-form-item label="型号"><el-input v-model="form.model" /></el-form-item></el-col>
              <el-col :span="12"><el-form-item label="产地"><el-input v-model="form.origin" /></el-form-item></el-col>
              <el-col :span="12"><el-form-item label="保质期（天）"><el-input-number v-model="form.shelf_life_days" :min="0" controls-position="right" /></el-form-item></el-col>
              <el-col :span="12"><el-form-item label="状态"><el-radio-group v-model="form.status"><el-radio value="active">启用</el-radio><el-radio value="inactive">停用</el-radio></el-radio-group></el-form-item></el-col>
              <el-col :span="12"><el-form-item label="批次/序列号"><el-checkbox v-model="form.enable_batch">启用批次管理</el-checkbox><el-checkbox v-model="form.enable_serial_no">启用序列号管理</el-checkbox></el-form-item></el-col>
              <el-col :span="24"><el-form-item label="规格描述"><el-input v-model="form.specification" type="textarea" :rows="3" maxlength="1000" show-word-limit /></el-form-item></el-col>
              <el-col :span="24"><el-form-item label="备注"><el-input v-model="form.remark" type="textarea" :rows="2" maxlength="500" show-word-limit /></el-form-item></el-col>
            </el-row>
          </el-tab-pane>
          <el-tab-pane label="规格参数" name="specs">
            <el-alert title="扩展参数保存为 JSON，可用于颜色、尺寸、材质等 SKU 属性。" type="info" :closable="false" show-icon />
            <el-row :gutter="18" style="margin-top:18px">
              <el-col :span="12"><el-form-item label="净重"><el-input-number v-model="form.net_weight" :min="0" :precision="3" controls-position="right" /><span class="form-unit">kg</span></el-form-item></el-col>
              <el-col :span="12"><el-form-item label="毛重"><el-input-number v-model="form.gross_weight" :min="0" :precision="3" controls-position="right" /><span class="form-unit">kg</span></el-form-item></el-col>
              <el-col :span="24"><el-form-item label="SKU 参数 JSON"><el-input v-model="form.sku_attributes_text" type="textarea" :rows="12" placeholder='例如：{"颜色":["黑","白"],"尺寸":["S","M","L"]}' /></el-form-item></el-col>
            </el-row>
          </el-tab-pane>
          <el-tab-pane label="图片" name="image">
            <el-row :gutter="20">
              <el-col :span="12"><el-form-item label="商品图片"><el-upload accept="image/jpeg,image/png,image/webp" :auto-upload="false" :show-file-list="false" :on-change="handleImageChange"><el-button :icon="Upload">选择图片</el-button><template #tip><div class="el-upload__tip">支持 JPG、PNG、WEBP，大小不超过 10MB。保存商品时上传到私有 Storage。</div></template></el-upload></el-form-item></el-col>
              <el-col :span="12"><el-form-item label="预览"><div class="product-image-editor"><el-image v-if="imagePreview" :src="imagePreview" fit="cover" :preview-src-list="[imagePreview]" preview-teleported /><div v-else class="product-image-editor__empty"><el-icon><Picture /></el-icon><span>暂未设置图片</span></div><el-button v-if="imagePreview" link type="danger" @click="removeImage">移除图片</el-button></div></el-form-item></el-col>
            </el-row>
          </el-tab-pane>
          <el-tab-pane label="价格与库存" name="price">
            <el-row :gutter="18">
              <el-col :span="12"><el-form-item label="采购价"><el-input-number v-model="form.purchase_price" :min="0" :precision="4" controls-position="right" /></el-form-item></el-col>
              <el-col :span="12"><el-form-item label="销售价"><el-input-number v-model="form.sale_price" :min="0" :precision="4" controls-position="right" /></el-form-item></el-col>
              <el-col :span="12"><el-form-item label="最低售价"><el-input-number v-model="form.min_sale_price" :min="0" :precision="4" controls-position="right" /></el-form-item></el-col>
              <el-col :span="12"><el-form-item label="税率"><el-input-number v-model="form.tax_rate" :min="0" :max="100" :precision="4" controls-position="right" /><span class="form-unit">%</span></el-form-item></el-col>
              <el-col :span="12"><el-form-item label="安全库存"><el-input-number v-model="form.safety_stock" :min="0" :precision="3" controls-position="right" /></el-form-item></el-col>
              <el-col :span="12"><el-form-item label="最低库存"><el-input-number v-model="form.min_stock" :min="0" :precision="3" controls-position="right" /></el-form-item></el-col>
              <el-col :span="12"><el-form-item label="最高库存"><el-input-number v-model="form.max_stock" :min="0" :precision="3" controls-position="right" /></el-form-item></el-col>
            </el-row>
          </el-tab-pane>
          <el-tab-pane label="条码管理" name="barcode">
            <div class="barcode-toolbar"><span>主条码会同步写入商品档案。一个商品只能有一个主条码。</span><el-button type="primary" plain size="small" :icon="Plus" @click="addBarcode">新增条码</el-button></div>
            <el-table :data="form.barcodes" border size="small">
              <el-table-column label="条码" min-width="220"><template #default="{ row }"><el-input v-model="row.barcode" placeholder="请输入条码" /></template></el-table-column>
              <el-table-column label="单位" min-width="180"><template #default="{ row }"><el-select v-model="row.unit_id" clearable filterable placeholder="默认基本单位"><el-option v-for="unit in units" :key="unit.id" :label="unit.name" :value="unit.id" /></el-select></template></el-table-column>
              <el-table-column label="换算率" width="140"><template #default="{ row }"><el-input-number v-model="row.conversion_rate" :min="0.000001" :precision="6" controls-position="right" /></template></el-table-column>
              <el-table-column label="主条码" width="100" align="center"><template #default="{ row, $index }"><el-radio v-model="barcodePrimaryIndex" :value="$index" @change="setPrimaryBarcode($index)">主</el-radio></template></el-table-column>
              <el-table-column label="状态" width="130"><template #default="{ row }"><el-select v-model="row.status"><el-option label="启用" value="active" /><el-option label="停用" value="inactive" /></el-select></template></el-table-column>
              <el-table-column label="操作" width="80" fixed="right"><template #default="{ $index }"><el-button link type="danger" @click="removeBarcode($index)">删除</el-button></template></el-table-column>
            </el-table>
          </el-tab-pane>
        </el-tabs>
      </el-form>
      <template #footer><el-button @click="dialog.visible = false">取消</el-button><el-button type="primary" :loading="dialog.submitting" @click="submitProduct">保存商品</el-button></template>
    </el-dialog>

    <el-dialog v-model="importDialog.visible" title="批量导入商品" width="620px" :close-on-click-modal="false" @closed="resetImportDialog">
      <el-alert title="请先下载模板。模板第 2 行是字段说明，不会导入；单次最多导入 5,000 行。相同商品编码将更新已有商品。" type="info" :closable="false" show-icon />
      <el-upload drag accept=".xlsx,.xls,.csv" :auto-upload="false" :show-file-list="false" :on-change="handleImportFile" style="margin-top:18px"><el-icon class="el-icon--upload"><UploadFilled /></el-icon><div class="el-upload__text">拖入 Excel 文件，或 <em>点击选择</em></div><template #tip><div class="el-upload__tip">导入文件必须使用已存在的分类编码和单位编码。</div></template></el-upload>
      <el-alert v-if="importDialog.fileName" :title="`已解析：${importDialog.fileName}，共 ${importDialog.rows.length} 行待导入`" type="success" :closable="false" style="margin-top:16px" />
      <template #footer><el-button @click="importDialog.visible = false">取消</el-button><el-button type="primary" :disabled="!importDialog.rows.length" :loading="importDialog.loading" @click="submitImport">确认导入</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Download, Goods, Picture, Plus, Upload, UploadFilled } from '@element-plus/icons-vue'
import SearchBar from '@/components/common/SearchBar.vue'
import DataTable from '@/components/common/DataTable.vue'
import {
  deleteProduct,
  deleteProductBarcode,
  deleteStorageFile,
  fetchProduct,
  fetchProductCategories,
  fetchProducts,
  fetchProductUnits,
  getSignedFileUrl,
  importProducts,
  saveProduct,
  syncProductBarcodes,
  uploadProductImage
} from '@/api/base'
import { useTable } from '@/composables/useTable'
import { downloadImportTemplate, parseExcelFile } from '@/utils/excel'
import { formatCurrency, statusLabel, statusTagType } from '@/utils/format'
import { codeRule, requiredRule } from '@/utils/validate'

const categories = ref([])
const units = ref([])
const productFormRef = ref()
const pendingImageFile = ref(null)
const imagePreview = ref('')
const originalImagePath = ref('')
const originalBarcodeIds = ref([])
const removeExistingImage = ref(false)
const barcodePrimaryIndex = ref(0)
const dialog = reactive({ visible: false, isEdit: false, submitting: false, tab: 'basic' })
const importDialog = reactive({ visible: false, fileName: '', rows: [], loading: false })
const form = reactive(emptyForm())

async function fetchProductPage(params) {
  const result = await fetchProducts(params)
  result.rows = await Promise.all((result.rows || []).map(async (row) => ({ ...row, image_url: row.image_path ? await signedUrlOrEmpty(row.image_path) : '' })))
  return result
}
const table = useTable(fetchProductPage, { initialQuery: { keyword: '', category_id: '', status: '' }, defaultSort: { prop: 'created_at', order: 'descending' } })

const categoryTree = computed(() => buildCategoryTree(categories.value))
const searchFields = computed(() => [
  { key: 'keyword', label: '名称/编码/条码', placeholder: '商品名称、编码、条码、品牌或型号', width: '270px' },
  { key: 'category_id', label: '商品分类', type: 'select', width: '180px', options: categories.value.filter((item) => item.status === 'active').map((item) => ({ label: item.name, value: item.id })) },
  { key: 'status', label: '状态', type: 'select', width: '120px', options: [{ label: '启用', value: 'active' }, { label: '停用', value: 'inactive' }] }
])
const columns = [
  { prop: 'product', label: '商品', minWidth: 270, slot: 'cell-product', showOverflowTooltip: false }, { prop: 'category', label: '分类', minWidth: 140, slot: 'cell-category' }, { prop: 'unit', label: '单位', width: 100, slot: 'cell-unit' },
  { prop: 'sale_price', label: '销售价', width: 130, align: 'right', slot: 'cell-sale_price' }, { prop: 'stock_rule', label: '安全/最低库存', width: 150, align: 'right', slot: 'cell-stock_rule' },
  { prop: 'primary_barcode', label: '主条码', minWidth: 150 }, { prop: 'status', label: '状态', width: 90, align: 'center', slot: 'cell-status' },
  { prop: 'actions', label: '操作', width: 140, fixed: 'right', slot: 'cell-actions', showOverflowTooltip: false, exportable: false }
]
const rules = { code: [requiredRule('请输入商品编码'), codeRule()], name: [requiredRule('请输入商品名称')], base_unit_id: [requiredRule('请选择基本单位')] }

function emptyForm() { return { id: '', code: '', name: '', short_name: '', category_id: null, base_unit_id: '', brand: '', model: '', specification: '', origin: '', enable_batch: false, enable_serial_no: false, shelf_life_days: null, purchase_price: 0, sale_price: 0, min_sale_price: 0, tax_rate: 0, safety_stock: 0, min_stock: 0, max_stock: null, net_weight: null, gross_weight: null, image_path: '', status: 'active', remark: '', sku_attributes_text: '{}', barcodes: [] } }
function buildCategoryTree(rows) { const copies = rows.map((item) => ({ ...item, children: [] })); const map = new Map(copies.map((item) => [item.id, item])); const roots = []; copies.forEach((item) => { if (item.parent_id && map.has(item.parent_id)) map.get(item.parent_id).children.push(item); else roots.push(item) }); const sort = (items) => { items.sort((a,b)=>a.sort_order-b.sort_order || a.code.localeCompare(b.code)); items.forEach((item)=>sort(item.children)) }; sort(roots); return roots }
async function signedUrlOrEmpty(path) { try { return await getSignedFileUrl(path) } catch { return '' } }
function updateQuery(value) { Object.assign(table.query, value) }
function resetForm() { Object.assign(form, emptyForm()); pendingImageFile.value = null; imagePreview.value = ''; originalImagePath.value = ''; originalBarcodeIds.value = []; removeExistingImage.value = false; barcodePrimaryIndex.value = 0 }
function openCreate() { resetForm(); dialog.isEdit = false; dialog.tab = 'basic'; dialog.visible = true }
async function openEdit(row) { try { const detail = await fetchProduct(row.id); resetForm(); Object.assign(form, { ...emptyForm(), ...detail, sku_attributes_text: JSON.stringify(detail.sku_attributes || {}, null, 2), barcodes: (detail.product_barcodes || []).map((item) => ({ ...item, conversion_rate: Number(item.conversion_rate || 1) })) }); originalImagePath.value = detail.image_path || ''; imagePreview.value = detail.image_path ? await signedUrlOrEmpty(detail.image_path) : ''; originalBarcodeIds.value = form.barcodes.map((item) => item.id).filter(Boolean); const primary = form.barcodes.findIndex((item) => item.is_primary); barcodePrimaryIndex.value = primary >= 0 ? primary : 0; dialog.isEdit = true; dialog.tab = 'basic'; dialog.visible = true } catch (error) { ElMessage.error(error.message || '读取商品详情失败') } }
function closeDialog() { dialog.visible = false; resetForm() }
function handleImageChange(uploadFile) { const file = uploadFile.raw; if (!file) return; const allowed = ['image/jpeg', 'image/png', 'image/webp']; if (!allowed.includes(file.type)) { ElMessage.error('仅支持 JPG、PNG、WEBP 图片'); return } if (file.size > 10 * 1024 * 1024) { ElMessage.error('图片不能超过 10MB'); return } pendingImageFile.value = file; imagePreview.value = URL.createObjectURL(file); removeExistingImage.value = false }
function removeImage() { pendingImageFile.value = null; imagePreview.value = ''; removeExistingImage.value = Boolean(originalImagePath.value); form.image_path = '' }
function addBarcode() { form.barcodes.push({ id: '', unit_id: form.base_unit_id || null, barcode: '', conversion_rate: 1, is_primary: form.barcodes.length === 0, status: 'active', remark: '' }); barcodePrimaryIndex.value = form.barcodes.length - 1 }
function removeBarcode(index) { form.barcodes.splice(index, 1); if (!form.barcodes.length) barcodePrimaryIndex.value = 0; else if (barcodePrimaryIndex.value >= form.barcodes.length) barcodePrimaryIndex.value = 0; setPrimaryBarcode(barcodePrimaryIndex.value) }
function setPrimaryBarcode(index) { barcodePrimaryIndex.value = index; form.barcodes.forEach((item, itemIndex) => { item.is_primary = itemIndex === index }) }
function validateBarcodes() { const activeRows = form.barcodes.filter((item) => String(item.barcode || '').trim()); const duplicate = activeRows.find((item, index) => activeRows.findIndex((candidate) => candidate.barcode === item.barcode) !== index); if (duplicate) throw new Error(`条码「${duplicate.barcode}」重复`); if (activeRows.length) setPrimaryBarcode(Math.min(barcodePrimaryIndex.value, activeRows.length - 1)); return activeRows }

async function submitProduct() {
  try {
    await productFormRef.value.validate()
    let skuAttributes = {}
    try { skuAttributes = form.sku_attributes_text?.trim() ? JSON.parse(form.sku_attributes_text) : {} } catch { dialog.tab = 'specs'; ElMessage.error('SKU 参数 JSON 格式不正确'); return }
    const activeBarcodes = validateBarcodes()
    dialog.submitting = true
    let product = await saveProduct({ ...form, sku_attributes: skuAttributes, image_path: removeExistingImage.value ? null : form.image_path })
    if (pendingImageFile.value) {
      const path = await uploadProductImage(product.id, pendingImageFile.value)
      product = await saveProduct({ ...product, image_path: path })
      if (originalImagePath.value && originalImagePath.value !== path) deleteStorageFile(originalImagePath.value).catch(() => {})
    } else if (removeExistingImage.value && originalImagePath.value) {
      deleteStorageFile(originalImagePath.value).catch(() => {})
    }
    const currentIds = new Set(activeBarcodes.map((item) => item.id).filter(Boolean))
    await Promise.all(originalBarcodeIds.value.filter((id) => !currentIds.has(id)).map((id) => deleteProductBarcode(id)))
    await syncProductBarcodes(product.id, activeBarcodes)
    ElMessage.success(dialog.isEdit ? '商品已更新' : '商品已创建')
    dialog.visible = false
    await table.load()
  } catch (error) {
    if (error?.message) ElMessage.error(error.message)
  } finally { dialog.submitting = false }
}

async function handleDelete(row) { try { await ElMessageBox.confirm(`确认删除商品「${row.name}」吗？存在库存或业务单据关联时数据库会阻止删除。`, '删除商品', { type: 'warning' }); if (row.image_path) deleteStorageFile(row.image_path).catch(() => {}); await deleteProduct(row.id); ElMessage.success('商品已删除'); await table.load() } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(error.message || '删除商品失败') } }
function downloadTemplate() { downloadImportTemplate([{ key: 'code', label: '商品编码', required: true, example: 'PRD-003' }, { key: 'name', label: '商品名称', required: true, example: '测试商品' }, { key: 'category', label: '分类编码', example: 'ELECTRONICS' }, { key: 'unit', label: '单位编码', required: true, example: 'PCS' }, { key: 'short_name', label: '商品简称', example: '测试' }, { key: 'brand', label: '品牌', example: 'ERP Demo' }, { key: 'model', label: '型号', example: 'MODEL-01' }, { key: 'specification', label: '规格', example: '标准规格' }, { key: 'barcode', label: '主条码', example: '6900000000003' }, { key: 'purchase', label: '采购价', example: 10 }, { key: 'sale', label: '销售价', example: 20 }, { key: 'min_sale', label: '最低售价', example: 15 }, { key: 'tax', label: '税率', example: 13 }, { key: 'safety', label: '安全库存', example: 10 }, { key: 'min_stock', label: '最低库存', example: 5 }, { key: 'max_stock', label: '最高库存', example: 100 }, { key: 'status', label: '状态', example: 'active' }, { key: 'remark', label: '备注', example: '导入测试数据' }], '商品批量导入模板.xlsx', '商品导入') }
async function handleImportFile(uploadFile) { try { importDialog.loading = true; importDialog.rows = await parseExcelFile(uploadFile.raw, { skipRows: 1 }); importDialog.fileName = uploadFile.name; ElMessage.success(`已读取 ${importDialog.rows.length} 行商品数据`) } catch (error) { ElMessage.error(error.message || '解析 Excel 失败'); resetImportDialog() } finally { importDialog.loading = false } }
async function submitImport() { importDialog.loading = true; try { const result = await importProducts(importDialog.rows, { categories: categories.value, units: units.value }); if (result.errors?.length) { ElMessage.error(`导入校验失败：${result.errors.slice(0, 3).join('；')}`); return } ElMessage.success(`已成功导入 ${result.success} 条商品`); importDialog.visible = false; await table.load() } catch (error) { ElMessage.error(error.message || '商品导入失败') } finally { importDialog.loading = false } }
function resetImportDialog() { importDialog.fileName = ''; importDialog.rows = []; importDialog.loading = false }
function handleExport({ columns: exportColumns }) { table.exportExcel({ filename: `商品档案_${new Date().toISOString().slice(0, 10)}.xlsx`, columns: exportColumns }) }

onMounted(async () => { try { const [categoryData, unitData] = await Promise.all([fetchProductCategories(), fetchProductUnits({ activeOnly: true })]); categories.value = categoryData; units.value = unitData; await table.load() } catch (error) { ElMessage.error(error.message || '加载商品档案失败') } })
</script>
