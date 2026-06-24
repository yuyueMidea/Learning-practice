<template>
  <div class="attachment-uploader">
    <el-upload
      :auto-upload="false"
      :show-file-list="false"
      :on-change="handleSelect"
      :disabled="uploading"
    >
      <el-button :icon="Paperclip" :loading="uploading">上传附件</el-button>
    </el-upload>
    <div v-if="paths.length" class="attachment-uploader__list">
      <el-tag v-for="path in paths" :key="path" closable @close="remove(path)">
        <el-link type="primary" :underline="false" @click.prevent="openFile(path)">{{ fileName(path) }}</el-link>
      </el-tag>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Paperclip } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { createSignedAttachmentUrl, uploadBusinessAttachment } from '@/api/business'

const props = defineProps({ modelValue: { type: Array, default: () => [] }, module: { type: String, default: 'business' } })
const emit = defineEmits(['update:modelValue'])
const paths = computed(() => Array.isArray(props.modelValue) ? props.modelValue : [])
const uploading = ref(false)

function fileName(path) { return String(path || '').split('/').pop() || '附件' }
async function handleSelect(uploadFile) {
  const file = uploadFile?.raw
  if (!file) return
  if (file.size > 15 * 1024 * 1024) return ElMessage.warning('单个附件不能超过 15MB')
  uploading.value = true
  try {
    const path = await uploadBusinessAttachment(file, props.module)
    emit('update:modelValue', [...paths.value, path])
    ElMessage.success('附件上传成功')
  } catch (error) {
    ElMessage.error(error.message || '附件上传失败')
  } finally { uploading.value = false }
}
function remove(path) { emit('update:modelValue', paths.value.filter((item) => item !== path)) }
async function openFile(path) {
  try {
    const url = await createSignedAttachmentUrl(path)
    window.open(url, '_blank', 'noopener,noreferrer')
  } catch (error) { ElMessage.error(error.message || '打开附件失败') }
}
</script>

<style scoped>
.attachment-uploader { display:flex; align-items:flex-start; gap:12px; flex-wrap:wrap; }
.attachment-uploader__list { display:flex; flex-wrap:wrap; gap:8px; }
</style>
