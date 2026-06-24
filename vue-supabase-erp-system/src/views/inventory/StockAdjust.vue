<template>
  <div class="page-container">
    <SearchBar :model-value="table.query" :fields="searchFields" @update:model-value="updateQuery" @search="table.search" @reset="table.reset" />
    <DataTable :data="table.rows" :columns="columns" :loading="table.loading" :pagination="table.pagination" :show-export="true" @page-change="table.changePage" @page-size-change="table.changePageSize" @sort-change="table.changeSort" @export="handleExport">
      <template #toolbar><el-button type="primary" :icon="Plus" @click="openCreate">新建调整单</el-button></template>
      <template #cell-warehouse="{ row }">{{ row.warehouse?.name || '-' }}</template>
      <template #cell-type="{ row }"><el-tag :type="row.adjustment_type === 'gain' ? 'success' : 'danger'">{{ row.adjustment_type === 'gain' ? '调盈' : '调亏' }}</el-tag></template>
      <template #cell-amount="{ row }">{{ formatCurrency(row.total_amount) }}</template>
      <template #cell-status="{ row }"><el-tag :type="statusTagType(row.status)">{{ statusLabel(row.status) }}</el-tag></template>
      <template #cell-actions="{ row }"><el-button link type="primary" @click="openEdit(row, row.status === 'posted')">{{ row.status === 'draft' ? '编辑' : '详情' }}</el-button><el-button v-if="row.status !== 'posted' && row.status !== 'cancelled'" link type="success" @click="post(row)">审核并过账</el-button></template>
    </DataTable>

    <el-dialog v-model="dialog.visible" :title="dialog.readonly ? '库存调整单详情' : (form.id ? '编辑库存调整单' : '新建库存调整单')" width="1080px" top="5vh" :close-on-click-modal="false" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px" :disabled="dialog.readonly">
        <el-row :gutter="18"><el-col :span="8"><el-form-item label="调整仓库" prop="warehouse_id"><el-select v-model="form.warehouse_id" filterable style="width:100%" @change="loadLocations"><el-option v-for="item in options.warehouses" :key="item.id" :label="`${item.code} · ${item.name}`" :value="item.id" /></el-select></el-form-item></el-col><el-col :span="8"><el-form-item label="调整日期"><el-date-picker v-model="form.adjustment_date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col><el-col :span="8"><el-form-item label="调整类型"><el-radio-group v-model="form.adjustment_type"><el-radio value="gain">调盈</el-radio><el-radio value="loss">调亏</el-radio></el-radio-group></el-form-item></el-col><el-col :span="24"><el-form-item label="调整原因" prop="reason"><el-input v-model="form.reason" placeholder="例如：盘点差异、报损、入库修正" /></el-form-item></el-col><el-col :span="24"><el-form-item label="备注"><el-input v-model="form.remark" /></el-form-item></el-col></el-row>
        <el-divider content-position="left">调整明细</el-divider>
        <div class="line-toolbar"><el-button type="primary" plain :icon="Plus" @click="selectorVisible=true">添加商品</el-button><el-button :icon="Delete" :disabled="!selected.length" @click="removeSelected">删除选中</el-button></div>
        <el-table :data="form.items" border stripe max-height="370" @selection-change="selected = $event"><el-table-column type="selection" width="48" /><el-table-column type="index" label="#" width="52" /><el-table-column label="商品" min-width="220"><template #default="{row}"><b>{{row.product_name}}</b><small class="sub">{{row.product_code}}</small></template></el-table-column><el-table-column label="单位" width="90"><template #default="{row}">{{row.unit_name}}</template></el-table-column><el-table-column label="账面数量" width="130"><template #default="{row}"><el-input-number v-model="row.book_qty" :precision="6" controls-position="right" /></template></el-table-column><el-table-column label="调整数量" width="145"><template #default="{row}"><el-input-number v-model="row.adjustment_qty" :min="0.000001" :precision="6" controls-position="right" @change="calc" /></template></el-table-column><el-table-column label="库位" min-width="150"><template #default="{row}"><el-select v-model="row.location_id" clearable filterable style="width:100%"><el-option v-for="item in locations" :key="item.id" :label="`${item.code} · ${item.name}`" :value="item.id" /></el-select></template></el-table-column><el-table-column label="批次" width="130"><template #default="{row}"><el-input v-model="row.batch_no" /></template></el-table-column><el-table-column label="单位成本" width="135"><template #default="{row}"><el-input-number v-model="row.unit_cost" :min="0" :precision="4" controls-position="right" @change="calc" /></template></el-table-column><el-table-column label="金额" width="130" align="right"><template #default="{row}">{{formatCurrency(row.amount)}}</template></el-table-column></el-table>
        <div class="total">调整总数量：{{ totalQty }}；调整总金额：<b>{{formatCurrency(totalAmount)}}</b></div>
      </el-form>
      <template #footer><el-button @click="dialog.visible=false">{{dialog.readonly?'关闭':'取消'}}</el-button><el-button v-if="!dialog.readonly" type="primary" :loading="dialog.saving" @click="save">保存草稿</el-button></template>
    </el-dialog>
    <ProductSelector v-model="selectorVisible" :warehouse-id="form.warehouse_id" @select="appendProduct" />
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Plus } from '@element-plus/icons-vue'
import SearchBar from '@/components/common/SearchBar.vue'
import DataTable from '@/components/common/DataTable.vue'
import ProductSelector from '@/components/business/ProductSelector.vue'
import { useTable } from '@/composables/useTable'
import { fetchAllOptions, fetchWarehouseLocations, numberValue, toDateString } from '@/api/business'
import { fetchAdjustments, getAdjustment, postAdjustment, saveAdjustment } from '@/api/inventory'
import { formatCurrency, statusLabel, statusTagType } from '@/utils/format'

const table = useTable(fetchAdjustments, { initialQuery: { keyword: '', status: '', warehouse_id: '', adjustment_type: '', date_range: [] }, defaultSort: { prop: 'adjustment_date', order: 'descending' } })
const options = reactive({ warehouses: [] }); const locations = ref([]); const selected = ref([]); const selectorVisible = ref(false); const dialog = reactive({ visible:false, readonly:false, saving:false }); const formRef=ref(null); const form=reactive(emptyForm())
const totalQty = computed(()=>form.items.reduce((sum,item)=>sum+numberValue(item.adjustment_qty),0)); const totalAmount=computed(()=>form.items.reduce((sum,item)=>sum+numberValue(item.amount),0))
const searchFields=[{key:'keyword',label:'单据号',placeholder:'调整单号、原因或备注',width:'250px'},{key:'warehouse_id',label:'仓库',type:'select',width:'180px',options:[]},{key:'adjustment_type',label:'类型',type:'select',width:'120px',options:[{label:'调盈',value:'gain'},{label:'调亏',value:'loss'}]},{key:'status',label:'状态',type:'select',width:'120px',options:[{label:'草稿',value:'draft'},{label:'已过账',value:'posted'}]},{key:'date_range',label:'日期',type:'daterange',width:'260px'}]
const columns=[{prop:'adjustment_no',label:'调整单号',width:175},{prop:'warehouse',label:'仓库',minWidth:150,slot:'cell-warehouse'},{prop:'adjustment_date',label:'调整日期',width:120},{prop:'type',label:'类型',width:100,align:'center',slot:'cell-type'},{prop:'reason',label:'调整原因',minWidth:200},{prop:'total_qty',label:'数量',width:100,align:'right'},{prop:'amount',label:'金额',width:140,align:'right',slot:'cell-amount'},{prop:'status',label:'状态',width:100,align:'center',slot:'cell-status'},{prop:'actions',label:'操作',width:170,fixed:'right',slot:'cell-actions',showOverflowTooltip:false,exportable:false}]
const rules={warehouse_id:[{required:true,message:'请选择调整仓库',trigger:'change'}],reason:[{required:true,message:'请输入调整原因',trigger:'blur'}]}
function emptyForm(){return{id:'',warehouse_id:'',adjustment_date:toDateString(),adjustment_type:'gain',reason:'',remark:'',items:[]}}
function updateQuery(v){Object.assign(table.query,v)}; function calc(){form.items=form.items.map(item=>({...item,amount:Number((numberValue(item.adjustment_qty)*numberValue(item.unit_cost)).toFixed(2))}))}
async function loadLocations(){locations.value=await fetchWarehouseLocations(form.warehouse_id)}
function appendProduct(product){const has=form.items.find(x=>x.product_id===product.id); if(has){has.adjustment_qty=Number(has.adjustment_qty||0)+1}else{form.items.push({product_id:product.id,product_code:product.code,product_name:product.name,unit_id:product.base_unit_id,unit_name:product.unit?.name||'',book_qty:product.available_stock||0,adjustment_qty:1,location_id:null,batch_no:'',unit_cost:Number(product.purchase_price||0),amount:0})};calc()}
function removeSelected(){const ids=new Set(selected.value.map(x=>x.product_id));form.items=form.items.filter(x=>!ids.has(x.product_id));selected.value=[];calc()}
function resetForm(){Object.assign(form,emptyForm());locations.value=[]}
function openCreate(){resetForm();dialog.readonly=false;dialog.visible=true}
async function openEdit(row,readonly=false){try{const detail=await getAdjustment(row.id);resetForm();Object.assign(form,{...detail,items:(detail.items||[]).map(i=>({...i,product_code:i.product?.code,product_name:i.product?.name,unit_name:i.unit?.name}))});await loadLocations();dialog.readonly=readonly;dialog.visible=true}catch(e){ElMessage.error(e.message||'加载调整单失败')}}
async function save(){try{await formRef.value?.validate();if(!form.items.length)throw new Error('请至少添加一行调整明细');dialog.saving=true;await saveAdjustment(form);ElMessage.success('库存调整单已保存');dialog.visible=false;await table.load()}catch(e){if(e?.message)ElMessage.error(e.message||'保存失败')}finally{dialog.saving=false}}
async function post(row){try{await ElMessageBox.confirm(`确认审核并过账 ${row.adjustment_no} 吗？库存将立即变动。`,'库存过账',{type:'warning'});await postAdjustment(row.id);ElMessage.success('过账成功');await table.load()}catch(e){if(e!=='cancel'&&e!=='close')ElMessage.error(e.message||'过账失败')}}
function handleExport({columns}){table.exportExcel({filename:`库存调整_${toDateString()}.xlsx`,columns})}
onMounted(async()=>{try{const data=await fetchAllOptions();options.warehouses=data.warehouses;searchFields[1].options=data.warehouses.map(i=>({label:`${i.code} · ${i.name}`,value:i.id}));await table.load()}catch(e){ElMessage.error(e.message||'加载页面失败')}})
</script>
<style scoped>.line-toolbar{display:flex;gap:10px;margin-bottom:12px}.total{text-align:right;padding:12px;background:#fafafa}.total b{color:var(--el-color-primary);font-size:16px}.sub{display:block;color:var(--el-text-color-secondary);margin-top:3px}</style>
