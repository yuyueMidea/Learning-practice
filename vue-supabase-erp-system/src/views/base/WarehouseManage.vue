<template>
  <div class="page-container">
    <SearchBar :model-value="table.query" :fields="searchFields" @update:model-value="updateQuery" @search="table.search" @reset="table.reset" />

    <section class="data-table-card">
      <div class="data-table-card__toolbar">
        <div><el-button v-permission="['base:warehouse:create']" type="primary" :icon="Plus" @click="openWarehouseCreate">新增仓库</el-button></div>
        <div class="page-table-hint">展开仓库行可维护库位；删除仓库会按数据库级联删除所属库位。</div>
      </div>
      <el-table :data="table.rows" :loading="table.loading" row-key="id" border stripe @expand-change="handleExpand">
        <el-table-column type="expand" width="54">
          <template #default="{ row }">
            <div class="warehouse-location-panel">
              <div class="warehouse-location-panel__header">
                <strong>库位列表 · {{ row.name }}</strong>
                <el-button v-permission="['base:warehouse:create']" type="primary" size="small" :icon="Plus" @click="openLocationCreate(row)">新增库位</el-button>
              </div>
              <el-table :data="locationRows[row.id] || []" size="small" border v-loading="locationLoading[row.id]">
                <el-table-column prop="code" label="库位编码" min-width="120" /><el-table-column prop="name" label="库位名称" min-width="140" />
                <el-table-column prop="location_type" label="类型" width="110"><template #default="{ row: location }">{{ locationTypeLabel(location.location_type) }}</template></el-table-column>
                <el-table-column label="区域/货架" min-width="170"><template #default="{ row: location }">{{ [location.zone_code, location.aisle_code, location.shelf_code, location.bin_code].filter(Boolean).join(' / ') || '-' }}</template></el-table-column>
                <el-table-column prop="capacity_qty" label="容量" width="100" align="right" /><el-table-column prop="is_default" label="默认" width="80" align="center"><template #default="{ row: location }"><el-tag size="small" :type="location.is_default ? 'success' : 'info'">{{ location.is_default ? '是' : '否' }}</el-tag></template></el-table-column>
                <el-table-column prop="status" label="状态" width="90" align="center"><template #default="{ row: location }"><el-tag size="small" :type="statusTagType(location.status)">{{ statusLabel(location.status) }}</el-tag></template></el-table-column>
                <el-table-column label="操作" width="140" fixed="right"><template #default="{ row: location }"><el-button v-permission="['base:warehouse:update']" link type="primary" @click="openLocationEdit(row, location)">编辑</el-button><el-button v-permission="['base:warehouse:delete']" link type="danger" @click="deleteLocation(row, location)">删除</el-button></template></el-table-column>
              </el-table>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="code" label="仓库编码" width="140" /><el-table-column prop="name" label="仓库名称" min-width="200" />
        <el-table-column prop="warehouse_type" label="仓库类型" width="120"><template #default="{ row }">{{ warehouseTypeLabel(row.warehouse_type) }}</template></el-table-column>
        <el-table-column label="联系人" min-width="150"><template #default="{ row }"><div>{{ row.contact_name || '-' }}</div><small class="muted-text">{{ row.contact_phone || '' }}</small></template></el-table-column>
        <el-table-column label="地址" min-width="220"><template #default="{ row }">{{ [row.province, row.city, row.district, row.address].filter(Boolean).join('') || '-' }}</template></el-table-column>
        <el-table-column prop="allow_negative_stock" label="负库存" width="100" align="center"><template #default="{ row }"><el-tag size="small" :type="row.allow_negative_stock ? 'warning' : 'success'">{{ row.allow_negative_stock ? '允许' : '禁止' }}</el-tag></template></el-table-column>
        <el-table-column prop="status" label="状态" width="90" align="center"><template #default="{ row }"><el-tag :type="statusTagType(row.status)">{{ statusLabel(row.status) }}</el-tag></template></el-table-column>
        <el-table-column label="操作" width="150" fixed="right"><template #default="{ row }"><el-button v-permission="['base:warehouse:update']" link type="primary" @click="openWarehouseEdit(row)">编辑</el-button><el-button v-permission="['base:warehouse:delete']" link type="danger" @click="handleDeleteWarehouse(row)">删除</el-button></template></el-table-column>
      </el-table>
      <div class="data-table-card__pagination"><el-pagination v-model:current-page="table.pagination.page" v-model:page-size="table.pagination.pageSize" :total="table.pagination.total" :page-sizes="[10,20,50,100]" layout="total, sizes, prev, pager, next, jumper" background @current-change="table.changePage" @size-change="table.changePageSize" /></div>
    </section>

    <FormDialog v-model="warehouseDialog.visible" :title="warehouseDialog.isEdit ? '编辑仓库' : '新增仓库'" :form="warehouseForm" :rules="warehouseRules" width="820px" :submit-loading="warehouseDialog.submitting" @cancel="closeWarehouseDialog" @submit="submitWarehouse">
      <el-row :gutter="16">
        <el-col :span="12"><el-form-item label="仓库编码" prop="code"><el-input v-model="warehouseForm.code" /></el-form-item></el-col><el-col :span="12"><el-form-item label="仓库名称" prop="name"><el-input v-model="warehouseForm.name" /></el-form-item></el-col>
        <el-col :span="12"><el-form-item label="仓库类型"><el-select v-model="warehouseForm.warehouse_type" style="width:100%"><el-option v-for="item in warehouseTypes" :key="item.value" :label="item.label" :value="item.value" /></el-select></el-form-item></el-col><el-col :span="12"><el-form-item label="状态"><el-radio-group v-model="warehouseForm.status"><el-radio value="active">启用</el-radio><el-radio value="inactive">停用</el-radio></el-radio-group><el-checkbox v-model="warehouseForm.allow_negative_stock" style="margin-left:16px">允许负库存</el-checkbox></el-form-item></el-col>
        <el-col :span="12"><el-form-item label="联系人"><el-input v-model="warehouseForm.contact_name" /></el-form-item></el-col><el-col :span="12"><el-form-item label="联系电话"><el-input v-model="warehouseForm.contact_phone" /></el-form-item></el-col>
        <el-col :span="8"><el-form-item label="省份"><el-input v-model="warehouseForm.province" /></el-form-item></el-col><el-col :span="8"><el-form-item label="城市"><el-input v-model="warehouseForm.city" /></el-form-item></el-col><el-col :span="8"><el-form-item label="区县"><el-input v-model="warehouseForm.district" /></el-form-item></el-col>
        <el-col :span="24"><el-form-item label="详细地址"><el-input v-model="warehouseForm.address" /></el-form-item></el-col><el-col :span="24"><el-form-item label="备注"><el-input v-model="warehouseForm.remark" type="textarea" :rows="3" /></el-form-item></el-col>
      </el-row>
    </FormDialog>

    <FormDialog v-model="locationDialog.visible" :title="locationDialog.isEdit ? '编辑库位' : '新增库位'" :form="locationForm" :rules="locationRules" width="760px" :submit-loading="locationDialog.submitting" @cancel="closeLocationDialog" @submit="submitLocation">
      <el-row :gutter="16">
        <el-col :span="12"><el-form-item label="库位编码" prop="code"><el-input v-model="locationForm.code" /></el-form-item></el-col><el-col :span="12"><el-form-item label="库位名称" prop="name"><el-input v-model="locationForm.name" /></el-form-item></el-col>
        <el-col :span="12"><el-form-item label="库位类型"><el-select v-model="locationForm.location_type" style="width:100%"><el-option v-for="item in locationTypes" :key="item.value" :label="item.label" :value="item.value" /></el-select></el-form-item></el-col><el-col :span="12"><el-form-item label="容量"><el-input-number v-model="locationForm.capacity_qty" :min="0" :precision="2" controls-position="right" /></el-form-item></el-col>
        <el-col :span="6"><el-form-item label="区域"><el-input v-model="locationForm.zone_code" /></el-form-item></el-col><el-col :span="6"><el-form-item label="巷道"><el-input v-model="locationForm.aisle_code" /></el-form-item></el-col><el-col :span="6"><el-form-item label="货架"><el-input v-model="locationForm.shelf_code" /></el-form-item></el-col><el-col :span="6"><el-form-item label="货位"><el-input v-model="locationForm.bin_code" /></el-form-item></el-col>
        <el-col :span="24"><el-form-item label="状态"><el-radio-group v-model="locationForm.status"><el-radio value="active">启用</el-radio><el-radio value="inactive">停用</el-radio></el-radio-group><el-checkbox v-model="locationForm.is_default" style="margin-left:16px">设为默认库位</el-checkbox></el-form-item></el-col>
        <el-col :span="24"><el-form-item label="备注"><el-input v-model="locationForm.remark" type="textarea" :rows="2" /></el-form-item></el-col>
      </el-row>
    </FormDialog>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import SearchBar from '@/components/common/SearchBar.vue'
import FormDialog from '@/components/common/FormDialog.vue'
import { deleteWarehouse, deleteWarehouseLocation, fetchWarehouseLocations, fetchWarehouses, saveWarehouse, saveWarehouseLocation } from '@/api/base'
import { useTable } from '@/composables/useTable'
import { statusLabel, statusTagType } from '@/utils/format'
import { codeRule, requiredRule } from '@/utils/validate'

const table = useTable(fetchWarehouses, { initialQuery: { keyword: '', warehouse_type: '', status: '' }, defaultSort: { prop: 'created_at', order: 'descending' } })
const locationRows = reactive({}); const locationLoading = reactive({})
const warehouseDialog = reactive({ visible: false, isEdit: false, submitting: false }); const warehouseForm = reactive(emptyWarehouse())
const locationDialog = reactive({ visible: false, isEdit: false, submitting: false, warehouse: null }); const locationForm = reactive(emptyLocation())
const warehouseTypes = [{ label: '普通仓', value: 'normal' }, { label: '在途仓', value: 'transit' }, { label: '退货仓', value: 'returns' }, { label: '不良品仓', value: 'defective' }, { label: '虚拟仓', value: 'virtual' }]
const locationTypes = [{ label: '收货区', value: 'receiving' }, { label: '存储区', value: 'storage' }, { label: '拣货区', value: 'picking' }, { label: '发货区', value: 'shipping' }, { label: '退货区', value: 'returns' }, { label: '不良品区', value: 'defective' }]
const searchFields = [{ key: 'keyword', label: '名称/编码', placeholder: '仓库名称、编码或联系人', width: '250px' }, { key: 'warehouse_type', label: '仓库类型', type: 'select', width: '140px', options: warehouseTypes }, { key: 'status', label: '状态', type: 'select', width: '120px', options: [{ label: '启用', value: 'active' }, { label: '停用', value: 'inactive' }] }]
const warehouseRules = { code: [requiredRule('请输入仓库编码'), codeRule()], name: [requiredRule('请输入仓库名称')] }
const locationRules = { code: [requiredRule('请输入库位编码'), codeRule()], name: [requiredRule('请输入库位名称')] }
function emptyWarehouse() { return { id: '', code: '', name: '', warehouse_type: 'normal', contact_name: '', contact_phone: '', province: '', city: '', district: '', address: '', allow_negative_stock: false, status: 'active', remark: '' } }
function emptyLocation() { return { id: '', warehouse_id: '', code: '', name: '', zone_code: '', aisle_code: '', shelf_code: '', bin_code: '', location_type: 'storage', capacity_qty: null, is_default: false, status: 'active', remark: '' } }
function updateQuery(value) { Object.assign(table.query, value) }
function warehouseTypeLabel(value) { return warehouseTypes.find((item) => item.value === value)?.label || value }
function locationTypeLabel(value) { return locationTypes.find((item) => item.value === value)?.label || value }
async function loadLocations(warehouseId) { locationLoading[warehouseId] = true; try { locationRows[warehouseId] = await fetchWarehouseLocations(warehouseId) } catch (error) { ElMessage.error(error.message || '加载库位失败') } finally { locationLoading[warehouseId] = false } }
function handleExpand(row, expandedRows) { if (expandedRows.some((item) => item.id === row.id)) loadLocations(row.id) }
function resetWarehouse() { Object.assign(warehouseForm, emptyWarehouse()) }
function openWarehouseCreate() { resetWarehouse(); warehouseDialog.isEdit = false; warehouseDialog.visible = true }
function openWarehouseEdit(row) { Object.assign(warehouseForm, { ...emptyWarehouse(), ...row }); warehouseDialog.isEdit = true; warehouseDialog.visible = true }
function closeWarehouseDialog() { warehouseDialog.visible = false; resetWarehouse() }
async function submitWarehouse() { warehouseDialog.submitting = true; try { await saveWarehouse({ ...warehouseForm }); ElMessage.success(warehouseDialog.isEdit ? '仓库已更新' : '仓库已创建'); closeWarehouseDialog(); await table.load() } catch (error) { ElMessage.error(error.message || '保存仓库失败') } finally { warehouseDialog.submitting = false } }
async function handleDeleteWarehouse(row) { try { await ElMessageBox.confirm(`确认删除仓库「${row.name}」吗？`, '删除仓库', { type: 'warning' }); await deleteWarehouse(row.id); ElMessage.success('仓库已删除'); await table.load() } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(error.message || '删除仓库失败') } }
function resetLocation() { Object.assign(locationForm, emptyLocation()) }
function openLocationCreate(warehouse) { resetLocation(); locationForm.warehouse_id = warehouse.id; locationDialog.warehouse = warehouse; locationDialog.isEdit = false; locationDialog.visible = true }
function openLocationEdit(warehouse, location) { Object.assign(locationForm, { ...emptyLocation(), ...location }); locationDialog.warehouse = warehouse; locationDialog.isEdit = true; locationDialog.visible = true }
function closeLocationDialog() { locationDialog.visible = false; resetLocation() }
async function submitLocation() { locationDialog.submitting = true; try { await saveWarehouseLocation({ ...locationForm }); ElMessage.success(locationDialog.isEdit ? '库位已更新' : '库位已创建'); const id = locationForm.warehouse_id; closeLocationDialog(); await loadLocations(id) } catch (error) { ElMessage.error(error.message || '保存库位失败') } finally { locationDialog.submitting = false } }
async function deleteLocation(warehouse, location) { try { await ElMessageBox.confirm(`确认删除库位「${location.name}」吗？`, '删除库位', { type: 'warning' }); await deleteWarehouseLocation(location.id); ElMessage.success('库位已删除'); await loadLocations(warehouse.id) } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(error.message || '删除库位失败') } }
table.load().catch((error) => ElMessage.error(error.message || '加载仓库失败'))
</script>
