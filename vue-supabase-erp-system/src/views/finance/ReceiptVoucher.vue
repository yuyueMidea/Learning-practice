<template><SettlementVoucherPage title="收款单" party-label="客户" party-field="customer_id" party-relation="customer" date-field="receipt_date" method-field="receipt_method" number-field="receipt_no" balance-label="应收账款" balance-no-field="receivable_no" allocation-id-field="receivable_id" :fetcher="fetchReceiptVouchers" :fetch-open="fetchOpenReceivables" :save-voucher="saveReceiptVoucher" :post-voucher="postReceiptVoucher" :parties="options.customers" create-permission="finance:receipt:create" approve-permission="finance:receipt:approve" :can-approve="canApprove" /></template>
<script setup>
import { computed, onMounted, reactive } from 'vue'
import SettlementVoucherPage from '@/components/finance/SettlementVoucherPage.vue'
import { fetchOpenReceivables, fetchReceiptVouchers, postReceiptVoucher, saveReceiptVoucher } from '@/api/finance'
import { fetchAllOptions } from '@/api/business'
import { useAuthStore } from '@/stores/auth'
const auth=useAuthStore();const canApprove=computed(()=>auth.hasPermission('finance:receipt:approve'));const options=reactive({customers:[]});onMounted(async()=>{const data=await fetchAllOptions();options.customers=data.customers})
</script>
