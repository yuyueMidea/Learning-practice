<template><SettlementVoucherPage title="付款单" party-label="供应商" party-field="supplier_id" party-relation="supplier" date-field="payment_date" method-field="payment_method" number-field="payment_no" balance-label="应付账款" balance-no-field="payable_no" allocation-id-field="payable_id" :fetcher="fetchPaymentVouchers" :fetch-open="fetchOpenPayables" :save-voucher="savePaymentVoucher" :post-voucher="postPaymentVoucher" :parties="options.suppliers" create-permission="finance:payment:create" approve-permission="finance:payment:approve" :can-approve="canApprove" /></template>
<script setup>
import { computed, onMounted, reactive } from 'vue'
import SettlementVoucherPage from '@/components/finance/SettlementVoucherPage.vue'
import { fetchOpenPayables, fetchPaymentVouchers, postPaymentVoucher, savePaymentVoucher } from '@/api/finance'
import { fetchAllOptions } from '@/api/business'
import { useAuthStore } from '@/stores/auth'
const auth=useAuthStore();const canApprove=computed(()=>auth.hasPermission('finance:payment:approve'));const options=reactive({suppliers:[]});onMounted(async()=>{const data=await fetchAllOptions();options.suppliers=data.suppliers})
</script>
