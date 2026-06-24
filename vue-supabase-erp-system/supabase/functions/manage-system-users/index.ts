import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

type Action = 'create' | 'update' | 'reset-password' | 'update-status' | 'delete'

type Payload = {
  action: Action
  userId?: string
  email?: string
  password?: string
  user_name?: string
  display_name?: string
  phone?: string
  department_name?: string
  job_title?: string
  status?: 'active' | 'inactive' | 'locked'
  remark?: string
  roleIds?: string[]
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
  })
}

function cleanProfile(payload: Payload) {
  return {
    user_name: String(payload.user_name || '').trim(),
    display_name: String(payload.display_name || '').trim() || null,
    phone: String(payload.phone || '').trim() || null,
    department_name: String(payload.department_name || '').trim() || null,
    job_title: String(payload.job_title || '').trim() || null,
    status: payload.status || 'active',
    remark: String(payload.remark || '').trim() || null
  }
}

async function writeAudit(
  serviceClient: ReturnType<typeof createClient>,
  actorAuthUserId: string,
  operation: string,
  resourceId: string | null,
  requestPayload: Record<string, unknown>
) {
  try {
    const { data: actor } = await serviceClient
      .from('sys_users')
      .select('id')
      .eq('auth_user_id', actorAuthUserId)
      .maybeSingle()

    await serviceClient.from('sys_operation_logs').insert({
      actor_user_id: actor?.id || null,
      actor_auth_user_id: actorAuthUserId,
      module: 'system',
      operation,
      resource_type: 'sys_users',
      resource_id: resourceId,
      request_method: 'EDGE_FUNCTION',
      request_path: '/functions/v1/manage-system-users',
      request_payload: requestPayload,
      status: 'success',
      created_by: actorAuthUserId
    })
  } catch (error) {
    console.warn('[manage-system-users] audit log failed', error)
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ success: false, message: '仅支持 POST 请求' }, 405)

  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return json({ success: false, message: '缺少登录凭证' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ success: false, message: 'Edge Function 缺少 Supabase 环境变量' }, 500)
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false }
  })
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  })

  const token = authHeader.replace('Bearer ', '')
  const { data: callerData, error: callerError } = await userClient.auth.getUser(token)
  if (callerError || !callerData.user) return json({ success: false, message: '登录状态已失效' }, 401)

  const { data: isSuperAdmin, error: permissionError } = await userClient.rpc('erp_is_super_admin')
  if (permissionError || !isSuperAdmin) return json({ success: false, message: '仅超级管理员可管理用户账号' }, 403)

  let payload: Payload
  try {
    payload = await request.json()
  } catch {
    return json({ success: false, message: '请求体必须为 JSON' }, 400)
  }

  const action = payload.action
  if (!['create', 'update', 'reset-password', 'update-status', 'delete'].includes(action)) {
    return json({ success: false, message: '不支持的用户管理操作' }, 400)
  }

  try {
    if (action === 'create') {
      const email = String(payload.email || '').trim().toLowerCase()
      const password = String(payload.password || '')
      const profile = cleanProfile(payload)
      if (!email || !password || !profile.user_name) {
        return json({ success: false, message: '邮箱、初始密码和用户名不能为空' }, 400)
      }
      if (password.length < 8) return json({ success: false, message: '初始密码至少需要 8 位' }, 400)

      const { data: created, error: createError } = await serviceClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          user_name: profile.user_name,
          display_name: profile.display_name || profile.user_name
        }
      })
      if (createError || !created.user) throw createError || new Error('账号创建失败')

      const { data: userProfile, error: profileError } = await serviceClient
        .from('sys_users')
        .update({ ...profile, email, auth_user_id: created.user.id, created_by: callerData.user.id })
        .eq('auth_user_id', created.user.id)
        .select()
        .single()
      if (profileError) throw profileError

      const roleIds = [...new Set(payload.roleIds || [])]
      if (roleIds.length) {
        const { error: roleError } = await serviceClient.from('sys_user_roles').insert(
          roleIds.map((role_id) => ({
            user_id: userProfile.id,
            role_id,
            status: 'active',
            created_by: callerData.user.id
          }))
        )
        if (roleError) throw roleError
      }

      await writeAudit(serviceClient, callerData.user.id, 'create_user', userProfile.id, {
        user_name: profile.user_name,
        email,
        roleIds
      })
      return json({ success: true, data: userProfile })
    }

    if (!payload.userId) return json({ success: false, message: '缺少用户 ID' }, 400)

    const { data: target, error: targetError } = await serviceClient
      .from('sys_users')
      .select('id, auth_user_id, user_name, email, status')
      .eq('id', payload.userId)
      .single()
    if (targetError || !target) return json({ success: false, message: '未找到用户记录' }, 404)

    if (action === 'update') {
      const profile = cleanProfile(payload)
      if (!profile.user_name) return json({ success: false, message: '用户名不能为空' }, 400)

      const { data: updated, error: updateError } = await serviceClient
        .from('sys_users')
        .update(profile)
        .eq('id', target.id)
        .select()
        .single()
      if (updateError) throw updateError

      const roleIds = [...new Set(payload.roleIds || [])]
      const { error: clearRolesError } = await serviceClient.from('sys_user_roles').delete().eq('user_id', target.id)
      if (clearRolesError) throw clearRolesError
      if (roleIds.length) {
        const { error: assignRolesError } = await serviceClient.from('sys_user_roles').insert(
          roleIds.map((role_id) => ({ user_id: target.id, role_id, status: 'active', created_by: callerData.user.id }))
        )
        if (assignRolesError) throw assignRolesError
      }
      await writeAudit(serviceClient, callerData.user.id, 'update_user', target.id, {
        user_name: profile.user_name,
        roleIds
      })
      return json({ success: true, data: updated })
    }

    if (action === 'reset-password') {
      const password = String(payload.password || '')
      if (password.length < 8) return json({ success: false, message: '新密码至少需要 8 位' }, 400)
      const { error } = await serviceClient.auth.admin.updateUserById(target.auth_user_id, { password })
      if (error) throw error
      await writeAudit(serviceClient, callerData.user.id, 'reset_password', target.id, { userId: target.id })
      return json({ success: true, data: { id: target.id } })
    }

    if (action === 'update-status') {
      const status = payload.status
      if (!['active', 'inactive', 'locked'].includes(String(status))) {
        return json({ success: false, message: '无效的用户状态' }, 400)
      }
      if (target.auth_user_id === callerData.user.id && status !== 'active') {
        return json({ success: false, message: '不能禁用当前登录的管理员账号' }, 400)
      }
      const { data, error } = await serviceClient.from('sys_users').update({ status }).eq('id', target.id).select().single()
      if (error) throw error
      await writeAudit(serviceClient, callerData.user.id, 'update_user_status', target.id, { userId: target.id, status })
      return json({ success: true, data })
    }

    if (target.auth_user_id === callerData.user.id) {
      return json({ success: false, message: '不能删除当前登录的管理员账号' }, 400)
    }
    const { error: deleteError } = await serviceClient.auth.admin.deleteUser(target.auth_user_id)
    if (deleteError) throw deleteError
    await writeAudit(serviceClient, callerData.user.id, 'delete_user', target.id, { userId: target.id, email: target.email })
    return json({ success: true, data: { id: target.id } })
  } catch (error) {
    console.error('[manage-system-users]', error)
    return json({ success: false, message: error instanceof Error ? error.message : '用户管理操作失败' }, 500)
  }
})
