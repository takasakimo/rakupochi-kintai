/**
 * 掃除チェックイン/チェックアウト用の写真をSupabase Storageにアップロード
 * バケット名: cleaning-photos（事前にSupabaseで作成し、パブリックに設定）
 * path: {prefix}/{timestamp}-{random}.jpg
 */
export async function uploadCleaningPhoto(
  base64DataUrl: string,
  prefix: string
): Promise<string | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) return null

  try {
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(supabaseUrl, serviceKey)

    const commaIndex = base64DataUrl.indexOf(',')
    const payload = commaIndex >= 0 ? base64DataUrl.slice(commaIndex + 1) : base64DataUrl
    const mimeMatch = base64DataUrl.match(/data:([^;]+);/)
    const mimeType = mimeMatch?.[1] || 'image/jpeg'

    const buffer = Buffer.from(payload, 'base64')
    const timestamp = Date.now()
    const random = Math.random().toString(36).slice(2)
    const path = `${prefix}/${timestamp}-${random}.jpg`

    const { data, error } = await supabase.storage
      .from('cleaning-photos')
      .upload(path, buffer, {
        contentType: 'image/jpeg',
        upsert: false,
      })

    if (error) {
      console.error('Cleaning photo upload error:', error)
      return null
    }

    const publicUrl = `${supabaseUrl}/storage/v1/object/public/cleaning-photos/${data.path}`
    return publicUrl
  } catch (err) {
    console.error('Cleaning photo upload:', err)
    return null
  }
}
