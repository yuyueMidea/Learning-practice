<template>
  <section class="data-table-card">
    <div v-if="$slots.toolbar || showColumnSetting || showExport" class="data-table-card__toolbar">
      <slot name="toolbar" />
      <div class="data-table-card__toolbar-right">
        <el-button v-if="showExport" :icon="Download" @click="handleExport">导出</el-button>
        <el-popover v-if="showColumnSetting" placement="bottom-end" :width="220" trigger="click">
          <template #reference>
            <el-button :icon="Setting">列设置</el-button>
          </template>
          <el-checkbox-group v-model="checkedColumns" class="data-table-card__column-setting">
            <el-checkbox v-for="column in normalColumns" :key="column.prop" :value="column.prop">
              {{ column.label }}
            </el-checkbox>
          </el-checkbox-group>
        </el-popover>
      </div>
    </div>

    <el-table
      v-bind="$attrs"
      :data="data"
      :loading="loading"
      border
      stripe
      height="100%"
      @sort-change="$emit('sort-change', $event)"
      @selection-change="$emit('selection-change', $event)"
    >
      <el-table-column v-if="selection" type="selection" width="48" align="center" />
      <el-table-column v-if="index" type="index" label="序号" width="64" align="center" />

      <el-table-column
        v-for="column in activeColumns"
        :key="column.prop || column.label"
        :prop="column.prop"
        :label="column.label"
        :width="column.width"
        :min-width="column.minWidth || 120"
        :align="column.align || 'left'"
        :fixed="column.fixed"
        :sortable="column.sortable || false"
        :show-overflow-tooltip="column.showOverflowTooltip !== false"
      >
        <template #default="scope">
          <slot
            :name="column.slot || `cell-${column.prop}`"
            :row="scope.row"
            :column="column"
            :index="scope.$index"
          >
            {{ getCellValue(scope.row, column, scope.$index) }}
          </slot>
        </template>
      </el-table-column>

      <slot />

      <template #empty>
        <slot name="empty">
          <el-empty description="暂无数据" :image-size="92" />
        </slot>
      </template>
    </el-table>

    <div v-if="pagination" class="data-table-card__pagination">
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :total="pagination.total"
        :page-sizes="pageSizes"
        :layout="paginationLayout"
        background
        @current-change="$emit('page-change', $event)"
        @size-change="$emit('page-size-change', $event)"
      />
    </div>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { Download, Setting } from '@element-plus/icons-vue'

const props = defineProps({
  data: {
    type: Array,
    default: () => []
  },
  columns: {
    type: Array,
    default: () => []
  },
  loading: Boolean,
  selection: Boolean,
  index: Boolean,
  pagination: {
    type: Object,
    default: null
  },
  pageSizes: {
    type: Array,
    default: () => [10, 20, 50, 100]
  },
  paginationLayout: {
    type: String,
    default: 'total, sizes, prev, pager, next, jumper'
  },
  showColumnSetting: {
    type: Boolean,
    default: true
  },
  showExport: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['sort-change', 'selection-change', 'page-change', 'page-size-change', 'export'])

const checkedColumns = ref([])
const normalColumns = computed(() => props.columns.filter((column) => column.prop && column.hidden !== true))
const activeColumns = computed(() =>
  props.columns.filter((column) => {
    if (!column.prop || column.hidden === true) return true
    return checkedColumns.value.includes(column.prop)
  })
)

watch(
  normalColumns,
  (columns) => {
    const validProps = columns.map((item) => item.prop)
    const defaultVisible = columns.filter((item) => item.visible !== false).map((item) => item.prop)
    checkedColumns.value = checkedColumns.value.filter((prop) => validProps.includes(prop))
    defaultVisible.forEach((prop) => {
      if (!checkedColumns.value.includes(prop)) checkedColumns.value.push(prop)
    })
  },
  { immediate: true }
)

function getCellValue(row, column, index) {
  const value = row?.[column.prop]
  return typeof column.formatter === 'function' ? column.formatter(row, column, value, index) : value ?? '-'
}

function handleExport() {
  emit('export', { columns: activeColumns.value, rows: props.data })
}
</script>
