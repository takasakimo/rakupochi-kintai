import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'

export function createClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    // ビルド時や環境変数が設定されていない場合は、ダミークライアントを返す
    // 実際の使用時にはエラーが発生するが、ビルドは通る
    return createSupabaseClient(
      'https://placeholder.supabase.co',
      'placeholder-key'
    )
  }

  return createSupabaseClient(supabaseUrl, supabaseAnonKey)
}


