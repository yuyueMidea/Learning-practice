<template>
  <el-popover placement="bottom-start" :width="420" trigger="click">
    <template #reference>
      <el-input :model-value="modelValue" readonly placeholder="请选择图标" class="icon-picker__input">
        <template #prefix>
          <el-icon v-if="modelValue"><component :is="modelValue" /></el-icon>
        </template>
      </el-input>
    </template>
    <div class="icon-picker">
      <button
        v-for="name in iconNames"
        :key="name"
        type="button"
        class="icon-picker__item"
        :class="{ 'is-active': name === modelValue }"
        :title="name"
        @click="$emit('update:modelValue', name)"
      >
        <el-icon><component :is="name" /></el-icon>
        <span>{{ name }}</span>
      </button>
    </div>
  </el-popover>
</template>

<script setup>
defineProps({
  modelValue: { type: String, default: '' }
})
defineEmits(['update:modelValue'])

const iconNames = [
  'Odometer', 'Setting', 'User', 'UserFilled', 'Menu', 'Document', 'Files', 'OfficeBuilding',
  'House', 'CollectionTag', 'Goods', 'ShoppingCart', 'Sell', 'Box', 'Money', 'DataAnalysis',
  'Tickets', 'Download', 'RefreshLeft', 'DataLine', 'Upload', 'RefreshRight', 'Search', 'Operation',
  'DocumentChecked', 'Connection', 'Histogram', 'Wallet', 'CreditCard', 'FolderOpened', 'Grid',
  'ShoppingBag', 'Van', 'Coin', 'Memo', 'Management', 'Compass', 'Box', 'Bell', 'Star'
]
</script>
