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
        <el-button v-permission="['base:customer:create']" type="primary" :icon="Plus" @click="openCreate">新增客户</el-button>
      </template>
      <template #cell-customer_level="{ row }"><el-tag :type="customerLevelType(row.customer_level)">{{ row.customer_level }}</el-tag></template>
      <template #cell-contact="{ row }"><div>{{ row.contact_name || '-' }}</div><small class="muted-text">{{ row.contact_phone || row.contact_email || '' }}</small></template>
      <template #cell-credit_limit="{ row }">{{ formatCurrency(row.credit_limit) }}</template>
      <template #cell-status="{ row }"><el-tag :type="statusTagType(row.status)">{{ statusLabel(row.status) }}</el-tag></template>
      <template #cell-actions="{ row }">
        <el-button v-permission="['base:customer:update']" link type="primary" @click="openEdit(row)">编辑</el-button>
        <el-button v-permission="['base:customer:delete']" link type="danger" @click="handleDelete(row)">删除</el-button>
      </template>
    </DataTable>

    <FormDialog
      v-model="dialog.visible"
      :title="dialog.isEdit ? '编辑客户' : '新增客户'"
      :form="form"
      :rules="rules"
      width="980px"
      label-width="100px"
      :submit-loading="dialog.submitting"
      @cancel="closeDialog"
      @submit="submitForm"
    >
      <el-tabs v-model="dialog.tab" class="entity-form-tabs">
        <el-tab-pane label="基本信息" name="basic">
          <el-row :gutter="18">
            <el-col :span="12"><el-form-item label="客户编码" prop="code"><el-input v-model="form.code" placeholder="例如：CUS-001" /></el-form-item></el-col>
            <el-col :span="12"><el-form-item label="客户名称" prop="name"><el-input v-model="form.name" /></el-form-item></el-col>
            <el-col :span="12"><el-form-item label="客户简称"><el-input v-model="form.short_name" /></el-form-item></el-col>
            <el-col :span="12"><el-form-item label="客户级别"><el-select v-model="form.customer_level" style="width:100%"><el-option v-for="item in customerLevels" :key="item" :label="item" :value="item" /></el-select></el-form-item></el-col>
            <el-col :span="12"><el-form-item label="客户类型"><el-select v-model="form.customer_type" style="width:100%"><el-option label="企业客户" value="company" /><el-option label="个人客户" value="individual" /><el-option label="内部客户" value="internal" /></el-select></el-form-item></el-col>
            <el-col :span="12"><el-form-item label="纳税人识别号"><el-input v-model="form.tax_no" /></el-form-item></el-col>
            <el-col :span="12"><el-form-item label="价格等级"><el-select v-model="form.price_level" style="width:100%"><el-option label="标准价" value="standard" /><el-option label="一级价" value="level_1" /><el-option label="二级价" value="level_2" /><el-option label="项目价" value="project" /></el-select></el-form-item></el-col>
            <el-col :span="12"><el-form-item label="状态"><el-radio-group v-model="form.status"><el-radio value="active">启用</el-radio><el-radio value="inactive">停用</el-radio></el-radio-group></el-form-item></el-col>
            <el-col :span="24"><el-form-item label="备注"><el-input v-model="form.remark" type="textarea" :rows="3" maxlength="500" show-word-limit /></el-form-item></el-col>
          </el-row>
        </el-tab-pane>
        <el-tab-pane label="联系人与地址" name="contact">
          <el-row :gutter="18">
            <el-col :span="12"><el-form-item label="联系人"><el-input v-model="form.contact_name" /></el-form-item></el-col>
            <el-col :span="12"><el-form-item label="联系电话"><el-input v-model="form.contact_phone" /></el-form-item></el-col>
            <el-col :span="12"><el-form-item label="联系邮箱"><el-input v-model="form.contact_email" /></el-form-item></el-col>
            <el-col :span="12"><el-form-item label="传真"><el-input v-model="form.fax" /></el-form-item></el-col>
            <el-col :span="8"><el-form-item label="省份"><el-input v-model="form.province" /></el-form-item></el-col>
            <el-col :span="8"><el-form-item label="城市"><el-input v-model="form.city" /></el-form-item></el-col>
            <el-col :span="8"><el-form-item label="区县"><el-input v-model="form.district" /></el-form-item></el-col>
            <el-col :span="12"><el-form-item label="详细地址"><el-input v-model="form.address" /></el-form-item></el-col>
            <el-col :span="12"><el-form-item label="邮政编码"><el-input v-model="form.postal_code" /></el-form-item></el-col>
          </el-row>
        </el-tab-pane>
        <el-tab-pane label="账期与账户" name="finance">
          <el-row :gutter="18">
            <el-col :span="12"><el-form-item label="账期（天）"><el-input-number v-model="form.payment_term_days" :min="0" :max="3650" controls-position="right" /></el-form-item></el-col>
            <el-col :span="12"><el-form-item label="信用额度"><el-input-number v-model="form.credit_limit" :min="0" :precision="2" controls-position="right" /></el-form-item></el-col>
            <el-col :span="12"><el-form-item label="已用额度"><el-input-number v-model="form.credit_used" :min="0" :precision="2" controls-position="right" /></el-form-item></el-col>
            <el-col :span="12"><el-form-item label="开户银行"><el-input v-model="form.bank_name" /></el-form-item></el-col>
            <el-col :span="12"><el-form-item label="账户名称"><el-input v-model="form.bank_account_name" /></el-form-item></el-col>
            <el-col :span="12"><el-form-item label="银行账号"><el-input v-model="form.bank_account_no" /></el-form-item></el-col>
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
import { deleteCustomer, fetchCustomers, saveCustomer } from '@/api/base'
import { useTable } from '@/composables/useTable'
import { formatCurrency, statusLabel, statusTagType } from '@/utils/format'
import { codeRule, emailRule, requiredRule } from '@/utils/validate'

const table = useTable(fetchCustomers, { initialQuery: { keyword: '', customer_level: '', status: '' }, defaultSort: { prop: 'created_at', order: 'descending' } })
const dialog = reactive({ visible: false, isEdit: false, submitting: false, tab: 'basic' })
const form = reactive(emptyForm())
const customerLevels = ['VIP', 'A', 'B', 'C', 'D']
const searchFields = [
  { key: 'keyword', label: '名称/编码', placeholder: '客户名称、编码、联系人或电话', width: '260px' },
  { key: 'customer_level', label: '客户级别', type: 'select', width: '130px', options: customerLevels.map((value) => ({ label: value, value })) },
  { key: 'status', label: '状态', type: 'select', width: '120px', options: [{ label: '启用', value: 'active' }, { label: '停用', value: 'inactive' }] }
]
const columns = [
  { prop: 'code', label: '客户编码', width: 130 }, { prop: 'name', label: '客户名称', minWidth: 210 }, { prop: 'customer_level', label: '级别', width: 90, align: 'center', slot: 'cell-customer_level' },
  { prop: 'contact', label: '联系人', minWidth: 155, slot: 'cell-contact' }, { prop: 'payment_term_days', label: '账期', width: 95, align: 'center', formatter: (row) => `${row.payment_term_days || 0} 天` },
  { prop: 'credit_limit', label: '信用额度', width: 150, align: 'right', slot: 'cell-credit_limit' }, { prop: 'status', label: '状态', width: 90, align: 'center', slot: 'cell-status' },
  { prop: 'actions', label: '操作', width: 140, fixed: 'right', slot: 'cell-actions', showOverflowTooltip: false, exportable: false }
]
const rules = computed(() => ({ code: [requiredRule('请输入客户编码'), codeRule()], name: [requiredRule('请输入客户名称')], contact_email: form.contact_email ? [emailRule()] : [] }))
function emptyForm() { return { id: '', code: '', name: '', short_name: '', customer_level: 'C', customer_type: 'company', tax_no: '', contact_name: '', contact_phone: '', contact_email: '', fax: '', province: '', city: '', district: '', address: '', postal_code: '', payment_term_days: 0, credit_limit: 0, credit_used: 0, price_level: 'standard', bank_name: '', bank_account_name: '', bank_account_no: '', status: 'active', remark: '' } }
function updateQuery(value) { Object.assign(table.query, value) }
function customerLevelType(level) { return ({ VIP: 'danger', A: 'success', B: 'primary', C: 'info', D: 'warning' })[level] || 'info' }
function resetForm() { Object.assign(form, emptyForm()) }
function openCreate() { resetForm(); dialog.tab = 'basic'; dialog.isEdit = false; dialog.visible = true }
function openEdit(row) { Object.assign(form, { ...emptyForm(), ...row }); dialog.tab = 'basic'; dialog.isEdit = true; dialog.visible = true }
function closeDialog() { dialog.visible = false; resetForm() }
async function submitForm() { dialog.submitting = true; try { await saveCustomer({ ...form }); ElMessage.success(dialog.isEdit ? '客户已更新' : '客户已创建'); closeDialog(); await table.load() } catch (error) { ElMessage.error(error.message || '保存客户失败') } finally { dialog.submitting = false } }
async function handleDelete(row) { try { await ElMessageBox.confirm(`确认删除客户「${row.name}」吗？已关联业务单据时数据库会阻止删除。`, '删除客户', { type: 'warning' }); await deleteCustomer(row.id); ElMessage.success('客户已删除'); await table.load() } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(error.message || '删除客户失败') } }
function handleExport({ columns: exportColumns }) { table.exportExcel({ filename: `客户档案_${new Date().toISOString().slice(0, 10)}.xlsx`, columns: exportColumns }) }
onMounted(() => table.load().catch((error) => ElMessage.error(error.message || '加载客户失败')))
</script>
