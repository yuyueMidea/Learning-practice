<template><BalanceManagePage title="应付账款" party-label="供应商" party-relation="supplier" party-field="supplier_id" number-field="payable_no" settled-field="paid_amount" settled-label="已付金额" :fetcher="fetchPayables" :parties="options.suppliers" /></template>
<script setup>
import { onMounted, reactive } from 'vue'
import BalanceManagePage from '@/components/finance/BalanceManagePage.vue'
import { fetchPayables } from '@/api/finance'
import { fetchAllOptions } from '@/api/business'
const options=reactive({suppliers:[]});onMounted(async()=>{const data=await fetchAllOptions();options.suppliers=data.suppliers})
</script>
