<template><ExpenseManagePage :can-approve="canApprove" /></template>
<script setup>
import { computed } from 'vue'
import ExpenseManagePage from '@/components/finance/ExpenseManagePage.vue'
import { useAuthStore } from '@/stores/auth'
const auth=useAuthStore();const canApprove=computed(()=>auth.hasPermission('finance:expense:approve'))
</script>
