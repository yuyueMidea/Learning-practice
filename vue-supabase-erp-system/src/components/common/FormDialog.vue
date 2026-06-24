<template>
  <el-dialog
    :model-value="modelValue"
    :title="title"
    :width="width"
    :fullscreen="fullscreen"
    :close-on-click-modal="closeOnClickModal"
    :destroy-on-close="destroyOnClose"
    @update:model-value="$emit('update:modelValue', $event)"
    @closed="$emit('closed')"
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      :label-width="labelWidth"
      :validate-on-rule-change="false"
    >
      <slot :form="form" :form-ref="formRef" />
    </el-form>

    <template #footer>
      <slot name="footer">
        <el-button @click="handleCancel">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleSubmit">
          {{ confirmText }}
        </el-button>
      </slot>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  modelValue: Boolean,
  title: {
    type: String,
    default: '编辑'
  },
  width: {
    type: [String, Number],
    default: 720
  },
  form: {
    type: Object,
    required: true
  },
  rules: {
    type: Object,
    default: () => ({})
  },
  labelWidth: {
    type: [String, Number],
    default: 100
  },
  confirmText: {
    type: String,
    default: '确定'
  },
  submitLoading: Boolean,
  fullscreen: Boolean,
  closeOnClickModal: {
    type: Boolean,
    default: false
  },
  destroyOnClose: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue', 'submit', 'cancel', 'closed'])
const formRef = ref(null)

async function validate() {
  if (!formRef.value) return true
  await formRef.value.validate()
  return true
}

function resetFields() {
  formRef.value?.resetFields()
}

async function handleSubmit() {
  try {
    await validate()
    emit('submit', props.form)
  } catch {
    // Element Plus 已在对应字段下展示验证错误。
  }
}

function handleCancel() {
  emit('cancel')
  emit('update:modelValue', false)
}

defineExpose({
  formRef,
  validate,
  resetFields
})
</script>
