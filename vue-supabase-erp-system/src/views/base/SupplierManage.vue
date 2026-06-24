<template>
  <div class="page-container">
    <SearchBar :model-value="table.query" :fields="searchFields" @update:model-value="updateQuery" @search="table.search" @reset="table.reset" />
    <DataTable :data="table.rows" :columns="columns" :loading="table.loading" :pagination="table.pagination" :show-export="true" @page-change="table.changePage" @page-size-change="table.changePageSize" @sort-change="table.changeSort" @export="handleExport">
      <template #toolbar><el-button v-permission="['base:supplier:create']" type="primary" :icon="Plus" @click="openCreate">新增供应商</el-button></template>
      <template #cell-supplier_level="{ row }"><el-rate :model-value="supplierScore[row.supplier_level]" disabled show-score :max="4" /></template>
      <template #cell-contact="{ row }"><div>{{ row.contact_name || '-' }}</div><small class="muted-text">{{ row.contact_phone || row.contact_email || '' }}</small></template>
      <template #cell-credit_limit="{ row }">{{ formatCurrency(row.credit_limit) }}</template>
      <template #cell-status="{ row }"><el-tag :type="statusTagType(row.status)">{{ statusLabel(row.status) }}</el-tag></template>
      <template #cell-actions="{ row }"><el-button v-permission="['base:supplier:update']" link type="primary" @click="openEdit(row)">编辑</el-button><el-button v-permission="['base:supplier:delete']" link type="danger" @click="handleDelete(row)">删除</el-button></template>
    </DataTable>

    <FormDialog v-model="dialog.visible" :title="dialog.isEdit ? '编辑供应商' : '新增供应商'" :form="form" :rules="rules" width="980px" label-width="100px" :submit-loading="dialog.submitting" @cancel="closeDialog" @submit="submitForm">
      <el-tabs v-model="dialog.tab" class="entity-form-tabs">
        <el-tab-pane label="基本信息" name="basic">
          <el-row :gutter="18">
            <el-col :span="12"><el-form-item label="供应商编码" prop="code"><el-input v-model="form.code" placeholder="例如：SUP-001" /></el-form-item></el-col>
            <el-col :span="12"><el-form-item label="供应商名称" prop="name"><el-input v-model="form.name" /></el-form-item></el-col>
            <el-col :span="12"><el-form-item label="供应商简称"><el-input v-model="form.short_name" /></el-form-item></el-col>
            <el-col :span="12"><el-form-item label="供应商评级"><el-select v-model="form.supplier_level" style="width:100%"><el-option label="A（优质）" value="A" /><el-option label="B（合格）" value="B" /><el-option label="C（观察）" value="C" /><el-option label="D（限制）" value="D" /></el-select></el-form-item></el-col>
            <el-col :span="12"><el-form-item label="供应商类型"><el-select v-model="form.supplier_type" style="width:100%"><el-option label="生产厂家" value="manufacturer" /><el-option label="经销商" value="distributor" /><el-option label="服务商" value="service" /></el-select></el-form-item></el-col>
            <el-col :span="12"><el-form-item label="纳税人识别号"><el-input v-model="form.tax_no" /></el-form-item></el-col>
            <el-col :span="12"><el-form-item label="状态"><el-radio-group v-model="form.status"><el-radio value="active">启用</el-radio><el-radio value="inactive">停用</el-radio></el-radio-group></el-form-item></el-col>
            <el-col :span="24"><el-form-item label="备注"><el-input v-model="form.remark" type="textarea" :rows="3" maxlength="500" show-word-limit /></el-form-item></el-col>
          </el-row>
        </el-tab-pane>
        <el-tab-pane label="联系人与地址" name="contact">
          <el-row :gutter="18">
            <el-col :span="12"><el-form-item label="联系人"><el-input v-model="form.contact_name" /></el-form-item></el-col><el-col :span="12"><el-form-item label="联系电话"><el-input v-model="form.contact_phone" /></el-form-item></el-col>
            <el-col :span="12"><el-form-item label="联系邮箱"><el-input v-model="form.contact_email" /></el-form-item></el-col><el-col :span="12"><el-form-item label="传真"><el-input v-model="form.fax" /></el-form-item></el-col>
            <el-col :span="8"><el-form-item label="省份"><el-input v-model="form.province" /></el-form-item></el-col><el-col :span="8"><el-form-item label="城市"><el-input v-model="form.city" /></el-form-item></el-col><el-col :span="8"><el-form-item label="区县"><el-input v-model="form.district" /></el-form-item></el-col>
            <el-col :span="12"><el-form-item label="详细地址"><el-input v-model="form.address" /></el-form-item></el-col><el-col :span="12"><el-form-item label="邮政编码"><el-input v-model="form.postal_code" /></el-form-item></el-col>
          </el-row>
        </el-tab-pane>
        <el-tab-pane label="结算账户" name="finance">
          <el-row :gutter="18">
            <el-col :span="12"><el-form-item label="账期（天）"><el-input-number v-model="form.payment_term_days" :min="0" :max="3650" controls-position="right" /></el-form-item></el-col><el-col :span="12"><el-form-item label="信用额度"><el-input-number v-model="form.credit_limit" :min="0" :precision="2" controls-position="right" /></el-form-item></el-col>
            <el-col :span="12"><el-form-item label="开户银行"><el-input v-model="form.bank_name" /></el-form-item></el-col><el-col :span="12"><el-form-item label="账户名称"><el-input v-model="form.bank_account_name" /></el-form-item></el-col><el-col :span="12"><el-form-item label="银行账号"><el-input v-model="form.bank_account_no" /></el-form-item></el-col>
          </el-row>
        </el-tab-pane>
      </el-tabs>
    </FormDialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import SearchBar from '@/components/common/SearchBar.vue'
import DataTable from '@/components/common/DataTable.vue'
import FormDialog from '@/components/common/FormDialog.vue'
import { deleteSupplier, fetchSuppliers, saveSupplier } from '@/api/base'
import { useTable } from '@/composables/useTable'
import { formatCurrency, statusLabel, statusTagType } from '@/utils/format'
import { codeRule, emailRule, requiredRule } from '@/utils/validate'

const table = useTable(fetchSuppliers, { initialQuery: { keyword: '', supplier_level: '', status: '' }, defaultSort: { prop: 'created_at', order: 'descending' } })
const dialog = reactive({ visible: false, isEdit: false, submitting: false, tab: 'basic' })
const form = reactive(emptyForm())
const supplierScore = { A: 4, B: 3, C: 2, D: 1 }
const searchFields = [{ key: 'keyword', label: '名称/编码', placeholder: '供应商名称、编码、联系人或电话', width: '260px' }, { key: 'supplier_level', label: '评级', type: 'select', width: '130px', options: ['A', 'B', 'C', 'D'].map((value) => ({ label: value, value })) }, { key: 'status', label: '状态', type: 'select', width: '120px', options: [{ label: '启用', value: 'active' }, { label: '停用', value: 'inactive' }] }]
const columns = [{ prop: 'code', label: '供应商编码', width: 140 }, { prop: 'name', label: '供应商名称', minWidth: 220 }, { prop: 'supplier_level', label: '评级', width: 150, slot: 'cell-supplier_level', showOverflowTooltip: false }, { prop: 'contact', label: '联系人', minWidth: 155, slot: 'cell-contact' }, { prop: 'payment_term_days', label: '账期', width: 95, align: 'center', formatter: (row) => `${row.payment_term_days || 0} 天` }, { prop: 'credit_limit', label: '信用额度', width: 150, align: 'right', slot: 'cell-credit_limit' }, { prop: 'status', label: '状态', width: 90, align: 'center', slot: 'cell-status' }, { prop: 'actions', label: '操作', width: 140, fixed: 'right', slot: 'cell-actions', showOverflowTooltip: false, exportable: false }]
const rules = computed(() => ({ code: [requiredRule('请输入供应商编码'), codeRule()], name: [requiredRule('请输入供应商名称')], contact_email: form.contact_email ? [emailRule()] : [] }))
function emptyForm() { return { id: '', code: '', name: '', short_name: '', supplier_level: 'C', supplier_type: 'manufacturer', tax_no: '', contact_name: '', contact_phone: '', contact_email: '', fax: '', province: '', city: '', district: '', address: '', postal_code: '', payment_term_days: 0, credit_limit: 0, bank_name: '', bank_account_name: '', bank_account_no: '', status: 'active', remark: '' } }
function updateQuery(value) { Object.assign(table.query, value) }
function resetForm() { Object.assign(form, emptyForm()) }
function openCreate() { resetForm(); dialog.tab = 'basic'; dialog.isEdit = false; dialog.visible = true }
function openEdit(row) { Object.assign(form, { ...emptyForm(), ...row }); dialog.tab = 'basic'; dialog.isEdit = true; dialog.visible = true }
function closeDialog() { dialog.visible = false; resetForm() }
async function submitForm() { dialog.submitting = true; try { await saveSupplier({ ...form }); ElMessage.success(dialog.isEdit ? '供应商已更新' : '供应商已创建'); closeDialog(); await table.load() } catch (error) { ElMessage.error(error.message || '保存供应商失败') } finally { dialog.submitting = false } }
async function handleDelete(row) { try { await ElMessageBox.confirm(`确认删除供应商「${row.name}」吗？已关联业务单据时数据库会阻止删除。`, '删除供应商', { type: 'warning' }); await deleteSupplier(row.id); ElMessage.success('供应商已删除'); await table.load() } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(error.message || '删除供应商失败') } }
function handleExport({ columns: exportColumns }) { table.exportExcel({ filename: `供应商档案_${new Date().toISOString().slice(0, 10)}.xlsx`, columns: exportColumns }) }
onMounted(() => table.load().catch((error) => ElMessage.error(error.message || '加载供应商失败')))
</script>
