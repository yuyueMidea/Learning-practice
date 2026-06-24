import { supabase } from '@/utils/supabase'

function normalizeError(error) {
  if (!error) return null
  return new Error(error.message || error.error_description || '请求失败，请稍后重试')
}

function assertError(error) {
  if (error) throw normalizeError(error)
}

function textFilter(value) {
  return String(value || '').trim().replace(/[(),]/g, ' ')
}

function range(page, pageSize) {
  const from = (Math.max(Number(page) || 1, 1) - 1) * (Number(pageSize) || 20)
  return [from, from + (Number(pageSize) || 20) - 1]
}

async function logOperation(payload) {
  const { error } = await supabase.from('sys_operation_logs').insert({
    module: 'system',
    operation: payload.operation,
    resource_type: payload.resourceType,
    resource_id: payload.resourceId || null,
    request_method: payload.method || 'CLIENT',
    request_path: window.location.pathname,
    request_payload: payload.requestPayload || null,
    status: 'success'
  })

  // 审计日志写入失败不应打断原业务操作，例如当前角色只拥有资源维护权限时。
  if (error) console.warn('[ERP] 操作日志写入失败：', error.message)
}

export async function fetchUsers({ page = 1, pageSize = 20, query = {}, sorter = {} } = {}) {
  const [from, to] = range(page, pageSize)
  let request = supabase
    .from('sys_users')
    .select(
      `
        *,
        sys_user_roles (
          id,
          role_id,
          status,
          expires_at,
          sys_roles ( id, code, name, data_scope )
        )
      `,
      { count: 'exact' }
    )

  const keyword = textFilter(query.keyword)
  if (keyword) request = request.or(`user_name.ilike.%${keyword}%,email.ilike.%${keyword}%,display_name.ilike.%${keyword}%`)
  if (query.status) request = request.eq('status', query.status)

  const ascending = sorter.order !== 'descending'
  request = request.order(sorter.prop || 'created_at', { ascending }).range(from, to)

  const { data, error, count } = await request
  assertError(error)
  return { rows: data || [], total: count || 0 }
}

export async function fetchUserRoles(userId) {
  const { data, error } = await supabase
    .from('sys_user_roles')
    .select('id, role_id, status, expires_at')
    .eq('user_id', userId)
    .eq('status', 'active')
  assertError(error)
  return data || []
}

async function invokeUserManager(action, payload = {}) {
  const { data, error } = await supabase.functions.invoke('manage-system-users', {
    body: { action, ...payload }
  })
  assertError(error)
  if (!data?.success) throw new Error(data?.message || '用户管理操作失败')
  return data.data
}

export function createSystemUser(payload) {
  return invokeUserManager('create', payload)
}

export function updateSystemUser(payload) {
  return invokeUserManager('update', payload)
}

export function resetSystemUserPassword(payload) {
  return invokeUserManager('reset-password', payload)
}

export function updateSystemUserStatus(payload) {
  return invokeUserManager('update-status', payload)
}

export function deleteSystemUser(userId) {
  return invokeUserManager('delete', { userId })
}

export async function fetchRoles({ includeInactive = true } = {}) {
  let request = supabase.from('sys_roles').select('*').order('sort_order').order('code')
  if (!includeInactive) request = request.eq('status', 'active')
  const { data, error } = await request
  assertError(error)
  return data || []
}

export async function createRole(payload) {
  const { data, error } = await supabase.from('sys_roles').insert(payload).select().single()
  assertError(error)
  await logOperation({ operation: 'create', resourceType: 'sys_roles', resourceId: data.id, requestPayload: payload })
  return data
}

export async function updateRole(id, payload) {
  const { data, error } = await supabase.from('sys_roles').update(payload).eq('id', id).select().single()
  assertError(error)
  await logOperation({ operation: 'update', resourceType: 'sys_roles', resourceId: id, requestPayload: payload })
  return data
}

export async function deleteRole(id) {
  const { error } = await supabase.from('sys_roles').delete().eq('id', id)
  assertError(error)
  await logOperation({ operation: 'delete', resourceType: 'sys_roles', resourceId: id })
}

export async function fetchPermissions({ module = '', includeInactive = true } = {}) {
  let request = supabase.from('sys_permissions').select('*').order('module').order('resource').order('sort_order')
  if (module) request = request.eq('module', module)
  if (!includeInactive) request = request.eq('status', 'active')
  const { data, error } = await request
  assertError(error)
  return data || []
}

export async function createPermission(payload) {
  const { data, error } = await supabase.from('sys_permissions').insert(payload).select().single()
  assertError(error)
  await logOperation({ operation: 'create', resourceType: 'sys_permissions', resourceId: data.id, requestPayload: payload })
  return data
}

export async function updatePermission(id, payload) {
  const { data, error } = await supabase.from('sys_permissions').update(payload).eq('id', id).select().single()
  assertError(error)
  await logOperation({ operation: 'update', resourceType: 'sys_permissions', resourceId: id, requestPayload: payload })
  return data
}

export async function deletePermission(id) {
  const { error } = await supabase.from('sys_permissions').delete().eq('id', id)
  assertError(error)
  await logOperation({ operation: 'delete', resourceType: 'sys_permissions', resourceId: id })
}

export async function fetchRolePermissionIds(roleId) {
  const { data, error } = await supabase
    .from('sys_role_permissions')
    .select('permission_id')
    .eq('role_id', roleId)
  assertError(error)
  return (data || []).map((item) => item.permission_id)
}

export async function replaceRolePermissions(roleId, permissionIds = []) {
  const { error: deleteError } = await supabase.from('sys_role_permissions').delete().eq('role_id', roleId)
  assertError(deleteError)

  const records = [...new Set(permissionIds)].map((permissionId) => ({ role_id: roleId, permission_id: permissionId }))
  if (records.length) {
    const { error: insertError } = await supabase.from('sys_role_permissions').insert(records)
    assertError(insertError)
  }

  await logOperation({
    operation: 'assign_permissions',
    resourceType: 'sys_roles',
    resourceId: roleId,
    requestPayload: { permissionIds: records.map((item) => item.permission_id) }
  })
}

export async function fetchMenus() {
  const { data, error } = await supabase.from('sys_menus').select('*').order('sort_order').order('code')
  assertError(error)
  return data || []
}

export async function createMenu(payload) {
  const { data, error } = await supabase.from('sys_menus').insert(payload).select().single()
  assertError(error)
  await logOperation({ operation: 'create', resourceType: 'sys_menus', resourceId: data.id, requestPayload: payload })
  return data
}

export async function updateMenu(id, payload) {
  const { data, error } = await supabase.from('sys_menus').update(payload).eq('id', id).select().single()
  assertError(error)
  await logOperation({ operation: 'update', resourceType: 'sys_menus', resourceId: id, requestPayload: payload })
  return data
}

export async function deleteMenu(id) {
  const { error } = await supabase.from('sys_menus').delete().eq('id', id)
  assertError(error)
  await logOperation({ operation: 'delete', resourceType: 'sys_menus', resourceId: id })
}

export async function batchUpdateMenuOrder(records = []) {
  const jobs = records.map((item) =>
    supabase
      .from('sys_menus')
      .update({ parent_id: item.parent_id || null, sort_order: item.sort_order })
      .eq('id', item.id)
  )
  const results = await Promise.all(jobs)
  const failure = results.find((result) => result.error)
  assertError(failure?.error)
  await logOperation({ operation: 'sort', resourceType: 'sys_menus', requestPayload: records })
}

export async function fetchOperationLogs({ page = 1, pageSize = 20, query = {}, sorter = {} } = {}) {
  const [from, to] = range(page, pageSize)
  let request = supabase
    .from('sys_operation_logs')
    .select(
      `
        *,
        actor:sys_users!sys_operation_logs_actor_user_id_fkey (
          id,
          user_name,
          display_name,
          email
        )
      `,
      { count: 'exact' }
    )

  if (query.module) request = request.eq('module', query.module)
  if (query.operation) request = request.eq('operation', query.operation)
  if (query.status) request = request.eq('status', query.status)
  if (Array.isArray(query.created_at) && query.created_at.length === 2) {
    request = request.gte('created_at', `${query.created_at[0]}T00:00:00`).lte('created_at', `${query.created_at[1]}T23:59:59`)
  }

  const keyword = textFilter(query.keyword)
  if (keyword) request = request.or(`resource_type.ilike.%${keyword}%,request_path.ilike.%${keyword}%,error_message.ilike.%${keyword}%`)

  request = request.order(sorter.prop || 'created_at', { ascending: sorter.order === 'ascending' }).range(from, to)
  const { data, error, count } = await request
  assertError(error)
  return { rows: data || [], total: count || 0 }
}

export async function fetchOperationLog(id) {
  const { data, error } = await supabase
    .from('sys_operation_logs')
    .select(
      `
        *,
        actor:sys_users!sys_operation_logs_actor_user_id_fkey (
          id,
          user_name,
          display_name,
          email
        )
      `
    )
    .eq('id', id)
    .single()
  assertError(error)
  return data
}
