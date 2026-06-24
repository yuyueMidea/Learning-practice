<template>
  <div class="search-bar">
    <el-form :model="form" inline @submit.prevent="handleSearch">
      <el-form-item v-for="field in visibleFields" :key="field.key" :label="field.label">
        <el-input
          v-if="!field.type || field.type === 'input'"
          v-model="form[field.key]"
          clearable
          :placeholder="field.placeholder || `请输入${field.label || ''}`"
          :style="field.width ? { width: field.width } : undefined"
          @keyup.enter="handleSearch"
        />

        <el-select
          v-else-if="field.type === 'select'"
          v-model="form[field.key]"
          clearable
          filterable
          :placeholder="field.placeholder || `请选择${field.label || ''}`"
          :style="field.width ? { width: field.width } : undefined"
        >
          <el-option
            v-for="option in field.options || []"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>

        <el-date-picker
          v-else-if="field.type === 'date'"
          v-model="form[field.key]"
          type="date"
          value-format="YYYY-MM-DD"
          :placeholder="field.placeholder || `请选择${field.label || ''}`"
          :style="field.width ? { width: field.width } : undefined"
        />

        <el-date-picker
          v-else-if="field.type === 'daterange'"
          v-model="form[field.key]"
          type="daterange"
          value-format="YYYY-MM-DD"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          range-separator="至"
          :style="field.width ? { width: field.width } : undefined"
        />

        <slot v-else :name="`field-${field.key}`" :field="field" :form="form" />
      </el-form-item>

      <el-form-item class="search-bar__actions">
        <el-button type="primary" :icon="Search" @click="handleSearch">查询</el-button>
        <el-button :icon="RefreshLeft" @click="handleReset">重置</el-button>
        <el-button
          v-if="fields.length > collapseCount"
          text
          type="primary"
          @click="expanded = !expanded"
        >
          {{ expanded ? '收起' : '展开' }}
          <el-icon class="search-bar__expand-icon" :class="{ 'is-expanded': expanded }">
            <ArrowDown />
          </el-icon>
        </el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { ArrowDown, RefreshLeft, Search } from '@element-plus/icons-vue'

const props = defineProps({
  modelValue: {
    type: Object,
    default: () => ({})
  },
  fields: {
    type: Array,
    default: () => []
  },
  collapseCount: {
    type: Number,
    default: 4
  }
})

const emit = defineEmits(['update:modelValue', 'search', 'reset'])
const form = reactive({})
const expanded = ref(false)
const syncing = ref(false)

const visibleFields = computed(() => (expanded.value ? props.fields : props.fields.slice(0, props.collapseCount)))

watch(
  () => props.modelValue,
  (value) => {
    syncing.value = true
    Object.keys(form).forEach((key) => delete form[key])
    Object.assign(form, value || {})
    nextTick(() => {
      syncing.value = false
    })
  },
  { immediate: true, deep: true }
)

watch(
  form,
  (value) => {
    if (!syncing.value) emit('update:modelValue', { ...value })
  },
  { deep: true }
)

function handleSearch() {
  emit('update:modelValue', { ...form })
  emit('search', { ...form })
}

function handleReset() {
  Object.keys(form).forEach((key) => {
    form[key] = Array.isArray(form[key]) ? [] : ''
  })
  emit('update:modelValue', { ...form })
  emit('reset', { ...form })
}
</script>
