<template><BalanceManagePage title="应收账款" party-label="客户" party-relation="customer" party-field="customer_id" number-field="receivable_no" settled-field="received_amount" settled-label="已收金额" :fetcher="fetchReceivables" :parties="options.customers" /></template>
<script setup>
import { onMounted, reactive } from 'vue'
import BalanceManagePage from '@/components/finance/BalanceManagePage.vue'
import { fetchReceivables } from '@/api/finance'
import { fetchAllOptions } from '@/api/business'
const options=reactive({customers:[]});onMounted(async()=>{const data=await fetchAllOptions();options.customers=data.customers})
</script>
