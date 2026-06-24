<template>
  <div class="page-container">
    <SearchBar
      :model-value="table.query"
      :fields="searchFields"
      :collapse-count="4"
      @update:model-value="updateQuery"
      @search="table.search"
      @reset="table.reset"
    />

    <DataTable
      :data="table.rows"
      :columns="columns"
      :loading="table.loading"
      :pagination="table.pagination"
      @page-change="table.changePage"
      @page-size-change="table.changePageSize"
      @sort-change="table.changeSort"
    >
      <template #cell-actor="{ row }">{{ row.actor?.display_name || row.actor?.user_name || row.actor_auth_user_id || '-' }}</template>
      <template #cell-status="{ row }"><el-tag :type="row.status === 'success' ? 'success' : 'danger'">{{ row.status === 'success' ? '成功' : '失败' }}</el-tag></template>
      <template #cell-created_at="{ row }">{{ formatDateTime(row.created_at) }}</template>
      <template #cell-actions="{ row }"><el-button link type="primary" @click="openDetail(row)">查看详情</el-button></template>
    </DataTable>

    <el-dialog v-model="detailDialog.visible" title="操作日志详情" width="860px">
      <el-descriptions v-if="detailDialog.data" :column="2" border>
        <el-descriptions-item label="操作人">{{ detailDialog.data.actor?.display_name || detailDialog.data.actor?.user_name || detailDialog.data.actor_auth_user_id || '-' }}</el-descriptions-item>
        <el-descriptions-item label="发生时间">{{ formatDateTime(detailDialog.data.created_at) }}</el-descriptions-item>
        <el-descriptions-item label="模块">{{ detailDialog.data.module }}</el-descriptions-item>
        <el-descriptions-item label="操作">{{ detailDialog.data.operation }}</el-descriptions-item>
        <el-descriptions-item label="资源类型">{{ detailDialog.data.resource_type || '-' }}</el-descriptions-item>
        <el-descriptions-item label="资源 ID">{{ detailDialog.data.resource_id || '-' }}</el-descriptions-item>
        <el-descriptions-item label="请求方法">{{ detailDialog.data.request_method || '-' }}</el-descriptions-item>
        <el-descriptions-item label="耗时">{{ detailDialog.data.duration_ms === null ? '-' : `${detailDialog.data.duration_ms} ms` }}</el-descriptions-item>
        <el-descriptions-item label="请求路径" :span="2">{{ detailDialog.data.request_path || '-' }}</el-descriptions-item>
        <el-descriptions-item label="错误信息" :span="2">{{ detailDialog.data.error_message || '-' }}</el-descriptions-item>
      </el-descriptions>
      <div v-if="detailDialog.data" class="log-json-grid">
        <div><h4>请求载荷</h4><pre>{{ prettyJson(detailDialog.data.request_payload) }}</pre></div>
        <div><h4>响应载荷</h4><pre>{{ prettyJson(detailDialog.data.response_payload) }}</pre></div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { reactive } from 'vue'
import { ElMessage } from 'element-plus'
import SearchBar from '@/components/common/SearchBar.vue'
import DataTable from '@/components/common/DataTable.vue'
import { fetchOperationLog, fetchOperationLogs } from '@/api/system'
import { useTable } from '@/composables/useTable'
import { formatDateTime } from '@/utils/format'

const table = useTable(fetchOperationLogs, { initialQuery: { keyword: '', module: '', operation: '', status: '', created_at: [] }, defaultSort: { prop: 'created_at', order: 'descending' } })
const detailDialog = reactive({ visible: false, data: null })
const searchFields = [
  { key: 'keyword', label: '关键字', placeholder: '资源类型、路径或错误信息', width: '240px' },
  { key: 'module', label: '模块', type: 'select', width: '140px', options: [{ label: '系统管理', value: 'system' }, { label: '基础数据', value: 'base' }, { label: '采购', value: 'purchase' }, { label: '销售', value: 'sales' }, { label: '库存', value: 'inventory' }, { label: '财务', value: 'finance' }] },
  { key: 'status', label: '结果', type: 'select', width: '120px', options: [{ label: '成功', value: 'success' }, { label: '失败', value: 'failed' }] },
  { key: 'created_at', label: '时间范围', type: 'daterange', width: '270px' }
]
const columns = [
  { prop: 'created_at', label: '时间', width: 180, sortable: 'custom', slot: 'cell-created_at' }, { prop: 'actor', label: '操作人', minWidth: 130, slot: 'cell-actor' },
  { prop: 'module', label: '模块', width: 110 }, { prop: 'operation', label: '操作', minWidth: 130 }, { prop: 'resource_type', label: '资源类型', minWidth: 140 },
  { prop: 'request_path', label: '请求路径', minWidth: 220 }, { prop: 'status', label: '结果', width: 90, align: 'center', slot: 'cell-status' },
  { prop: 'actions', label: '操作', width: 100, fixed: 'right', slot: 'cell-actions', showOverflowTooltip: false, exportable: false }
]
function updateQuery(value) { Object.assign(table.query, value) }
function prettyJson(value) { return value ? JSON.stringify(value, null, 2) : '—' }
async function openDetail(row) {
  try { detailDialog.data = await fetchOperationLog(row.id); detailDialog.visible = true } catch (error) { ElMessage.error(error.message || '读取日志详情失败') }
}
table.load().catch((error) => ElMessage.error(error.message || '加载操作日志失败'))
</script>
