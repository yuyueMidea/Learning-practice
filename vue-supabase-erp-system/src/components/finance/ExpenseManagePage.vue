<template>
  <div class="page-container">
    <SearchBar :model-value="table.query" :fields="searchFields" @update:model-value="updateQuery" @search="table.search" @reset="table.reset" />
    <DataTable :data="table.rows" :columns="columns" :loading="table.loading" :pagination="table.pagination" :show-export="true" @page-change="table.changePage" @page-size-change="table.changePageSize" @sort-change="table.changeSort" @export="handleExport">
      <template #toolbar><el-button v-permission="['finance:expense:create']" type="primary" :icon="Plus" @click="openCreate">新增费用单</el-button></template>
      <template #cell-amount="{ row }"><b>{{ formatCurrency(row.amount) }}</b><small>未税 {{ formatCurrency(row.amount_excl_tax) }}，税额 {{ formatCurrency(row.tax_amount) }}</small></template>
      <template #cell-status="{ row }"><el-tag :type="statusTagType(row.status)" size="small">{{ expenseStatusLabel(row.status) }}</el-tag></template>
      <template #cell-actions="{ row }"><el-button v-if="row.status !== 'posted' && canApprove" link type="success" @click="handlePost(row)">过账</el-button><el-button link type="primary" @click="edit(row)">查看</el-button></template>
    </DataTable>

    <el-dialog v-model="dialogVisible" :title="form.id ? '查看 / 编辑费用单' : '新增费用单'" width="700px" append-to-body destroy-on-close @closed="resetForm">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px" :disabled="form.status === 'posted'">
        <el-row :gutter="16">
          <el-col :span="12"><el-form-item label="费用日期" prop="expense_date"><el-date-picker v-model="form.expense_date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="费用类别" prop="expense_category"><el-select v-model="form.expense_category" filterable allow-create default-first-option style="width:100%"><el-option v-for="item in categoryOptions" :key="item" :label="item" :value="item" /></el-select></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="收款方" prop="payee_name"><el-input v-model="form.payee_name" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="部门"><el-input v-model="form.department_name" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="含税金额" prop="amount"><el-input-number v-model="form.amount" :min="0.01" :precision="2" controls-position="right" style="width:100%" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="税率(%)"><el-input-number v-model="form.tax_rate" :min="0" :max="100" :precision="2" controls-position="right" style="width:100%" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="未税金额"><el-input :model-value="formatCurrency(amountExclTax)" disabled /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="税额"><el-input :model-value="formatCurrency(taxAmount)" disabled /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="支付方式"><el-select v-model="form.payment_method" clearable style="width:100%"><el-option v-for="item in methodOptions" :key="item.value" :label="item.label" :value="item.value" /></el-select></el-form-item></el-col>
          <el-col :span="24"><el-form-item label="备注"><el-input v-model="form.remark" type="textarea" :rows="3" /></el-form-item></el-col>
        </el-row>
      </el-form>
      <template #footer><el-button @click="dialogVisible=false">关闭</el-button><template v-if="form.status !== 'posted'"><el-button :loading="saving" @click="save(false)">保存草稿</el-button><el-button v-if="canApprove" type="primary" :loading="saving" @click="save(true)">保存并过账</el-button></template></template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import DataTable from '@/components/common/DataTable.vue'
import SearchBar from '@/components/common/SearchBar.vue'
import { fetchExpenses, postExpense, saveExpense } from '@/api/finance'
import { useTable } from '@/composables/useTable'
import { formatCurrency, statusTagType } from '@/utils/format'
import { toDateString } from '@/utils/report'

const props = defineProps({ canApprove: Boolean })
const table = useTable(fetchExpenses, { initialQuery: { keyword: '', status: '', expense_category: '', payment_method: '', date_range: [] }, defaultSort: { prop: 'expense_date', order: 'descending' } })
const dialogVisible = ref(false), saving = ref(false), formRef = ref(null)
const categoryOptions = ['办公费', '差旅费', '运输费', '房租水电', '营销推广', '维修费', '服务费', '其他']
const methodOptions = [{ label: '现金', value: 'cash' }, { label: '银行转账', value: 'bank_transfer' }, { label: '支票', value: 'cheque' }, { label: '微信', value: 'wechat' }, { label: '支付宝', value: 'alipay' }, { label: '其他', value: 'other' }]
const form = reactive({ id: '', expense_date: toDateString(), expense_category: '', payee_name: '', department_name: '', amount: 0, tax_rate: 0, payment_method: '', remark: '', status: 'draft' })
const rules = { expense_date: [{ required: true, message: '请选择费用日期', trigger: 'change' }], expense_category: [{ required: true, message: '请选择费用类别', trigger: 'change' }], payee_name: [{ required: true, message: '请输入收款方', trigger: 'blur' }], amount: [{ required: true, validator: (_, value, callback) => Number(value) > 0 ? callback() : callback(new Error('金额必须大于 0')), trigger: 'change' }] }
const searchFields = [{ key: 'keyword', label: '关键字', placeholder: '编号、类别、收款方或部门', width: '260px' }, { key: 'expense_category', label: '费用类别', type: 'select', width: '160px', options: categoryOptions.map((item) => ({ label: item, value: item })) }, { key: 'status', label: '状态', type: 'select', width: '130px', options: [{ label: '草稿', value: 'draft' }, { label: '已过账', value: 'posted' }, { label: '已驳回', value: 'rejected' }] }, { key: 'payment_method', label: '支付方式', type: 'select', width: '150px', options: methodOptions }, { key: 'date_range', label: '费用日期', type: 'daterange', width: '260px' }]
const columns = [{ prop: 'expense_no', label: '费用单号', width: 175, sortable: 'custom' }, { prop: 'expense_date', label: '费用日期', width: 120, sortable: 'custom' }, { prop: 'expense_category', label: '费用类别', width: 130 }, { prop: 'payee_name', label: '收款方', minWidth: 150 }, { prop: 'department_name', label: '部门', width: 120 }, { prop: 'amount', label: '金额', minWidth: 185, align: 'right', slot: 'cell-amount' }, { prop: 'payment_method', label: '支付方式', width: 120, formatter: (row) => methodOptions.find((item) => item.value === row.payment_method)?.label || '-' }, { prop: 'status', label: '状态', width: 100, align: 'center', slot: 'cell-status' }, { prop: 'actions', label: '操作', width: 130, fixed: 'right', slot: 'cell-actions', exportable: false }]
const amountExclTax = computed(() => Number((Number(form.amount || 0) / (1 + Number(form.tax_rate || 0) / 100)).toFixed(2)))
const taxAmount = computed(() => Number((Number(form.amount || 0) - amountExclTax.value).toFixed(2)))
function updateQuery(value) { Object.assign(table.query, value) }
function expenseStatusLabel(status) { return ({ draft: '草稿', submitted: '已提交', approved: '已审核', posted: '已过账', rejected: '已驳回', cancelled: '已取消' })[status] || status || '-' }
function resetForm() { Object.assign(form, { id: '', expense_date: toDateString(), expense_category: '', payee_name: '', department_name: '', amount: 0, tax_rate: 0, payment_method: '', remark: '', status: 'draft' }); formRef.value?.clearValidate?.() }
function openCreate() { dialogVisible.value = true }
function edit(row) { Object.assign(form, { ...row, amount: Number(row.amount || 0), tax_rate: Number(row.tax_rate || 0) }); dialogVisible.value = true }
async function save(post) { const valid = await formRef.value?.validate?.().catch(() => false); if (!valid) return; saving.value = true; try { const id = await saveExpense({ ...form }); if (post) await postExpense(id); ElMessage.success(post ? '费用单已过账' : '费用单已保存'); dialogVisible.value = false; await table.load() } catch (error) { ElMessage.error(error.message || '保存费用单失败') } finally { saving.value = false } }
async function handlePost(row) { try { await ElMessageBox.confirm(`确认过账费用单 ${row.expense_no}？`, '确认过账', { type: 'warning' }); await postExpense(row.id); ElMessage.success('过账成功'); await table.load() } catch (error) { if (error !== 'cancel') ElMessage.error(error.message || '过账失败') } }
function handleExport({ columns }) { table.exportExcel({ filename: `费用单_${toDateString()}.xlsx`, columns }) }
onMounted(() => table.load())
</script>

<style scoped>.data-table-card small { display:block; margin-top:3px; color:var(--el-text-color-secondary); font-size:11px; }</style>
