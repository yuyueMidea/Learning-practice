<template>
  <li>
    <div
      :class="['tree-node', isSelected ? 'selected' : '']"
      @click="handleClick"
    >
      <span class="tree-arrow">
        {{ hasChildren ? (open ? '▾' : '▸') : '·' }}
      </span>
      {{ node.label }}
    </div>

    <ul v-if="hasChildren && open">
      <TreeNode
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :selected-id="selectedId"
        :default-open="child.id === 'itd'"
        @select="emit('select', $event)"
      />
    </ul>
  </li>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

interface OrgNode {
  id: string
  label: string
  children: OrgNode[]
}

const props = defineProps<{
  node: OrgNode
  selectedId: string
  defaultOpen?: boolean
}>()

const emit = defineEmits<{
  (e: 'select', node: OrgNode): void
}>()

const open = ref(props.defaultOpen ?? false)
const hasChildren = computed(() => props.node.children && props.node.children.length > 0)
const isSelected = computed(() => props.node.id === props.selectedId)

function handleClick() {
  if (hasChildren.value) open.value = !open.value
  emit('select', props.node)
}
</script>
