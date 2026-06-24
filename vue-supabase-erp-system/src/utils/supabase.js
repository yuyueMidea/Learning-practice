import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    '缺少 Supabase 环境变量。请复制 .env.example 为 .env，并配置 VITE_SUPABASE_URL 与 VITE_SUPABASE_PUBLISHABLE_KEY。'
  )
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  db: {
    schema: 'public'
  },
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storageKey: 'erp-supabase-auth'
  },
  global: {
    headers: {
      'x-client-info': 'erp-vue-phase-2'
    }
  }
})
