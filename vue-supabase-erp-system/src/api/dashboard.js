import { supabase } from '@/utils/supabase'
import { assertError } from '@/api/business'
import { fetchDashboardAnalytics } from '@/api/report'
import { number, recentDateRange, sum, toDateString } from '@/utils/report'

export async function getDashboardOverview() {
  const today = toDateString()
  const monthStart = `${today.slice(0, 7)}-01`
  const dateRange = recentDateRange(30)

  const [todaySalesResult, monthSalesResult, pendingPurchaseResult, pendingSalesResult, logsResult, analytics] = await Promise.all([
    supabase
      .from('sal_deliveries')
      .select('total_amount')
      .eq('status', 'posted')
      .eq('delivery_date', today)
      .limit(5000),
    supabase
      .from('sal_deliveries')
      .select('total_amount')
      .eq('status', 'posted')
      .gte('delivery_date', monthStart)
      .lte('delivery_date', today)
      .limit(10000),
    supabase.from('pur_orders').select('id', { count: 'exact', head: true }).in('status', ['submitted', 'under_review']),
    supabase.from('sal_orders').select('id', { count: 'exact', head: true }).in('status', ['submitted', 'under_review']),
    supabase
      .from('sys_operation_logs')
      .select('id, module, operation, status, created_at, actor_auth_user_id')
      .order('created_at', { ascending: false })
      .limit(8),
    fetchDashboardAnalytics({ date_range: dateRange })
  ])

  assertError(todaySalesResult.error, '加载今日销售额失败')
  assertError(monthSalesResult.error, '加载本月销售额失败')
  assertError(pendingPurchaseResult.error, '加载待审核采购单失败')
  assertError(pendingSalesResult.error, '加载待审核销售单失败')
  assertError(logsResult.error, '加载近期操作日志失败')

  return {
    metrics: {
      todaySalesAmount: sum(todaySalesResult.data || [], 'total_amount'),
      monthSalesAmount: sum(monthSalesResult.data || [], 'total_amount'),
      pendingOrderCount: number(pendingPurchaseResult.count) + number(pendingSalesResult.count),
      stockAlertCount: analytics.stockAlerts.length
    },
    salesTrend: analytics.salesTrend,
    productTop: analytics.productTop,
    stockAlerts: analytics.stockAlerts,
    todos: [
      { label: '待审核采购订单', count: number(pendingPurchaseResult.count), path: '/purchase/orders' },
      { label: '待审核销售订单', count: number(pendingSalesResult.count), path: '/sales/orders' }
    ],
    logs: logsResult.data || []
  }
}
