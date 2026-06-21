<template>
  <div class="page-head">
    <div>
      <h1>{{ title }}</h1>
      <p>{{ desc }}</p>
    </div>
    <div v-if="$slots.actions" class="head-actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  desc: string
}>()
</script>
