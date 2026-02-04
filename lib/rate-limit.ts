// レート制限用のシンプルなインメモリストア
// 本番環境ではRedisなどの外部ストレージを使用することを推奨

interface RateLimitEntry {
  count: number
  resetTime: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

// 古いエントリをクリーンアップ（メモリリーク防止）
const cleanupInterval = setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key)
    }
  }
}, 60 * 1000) // 1分ごとにクリーンアップ

// プロセス終了時にクリーンアップ
if (typeof process !== 'undefined') {
  process.on('SIGTERM', () => {
    clearInterval(cleanupInterval)
  })
  process.on('SIGINT', () => {
    clearInterval(cleanupInterval)
  })
}

export interface RateLimitResult {
  success: boolean
  remaining: number
  resetTime: number
}

/**
 * レート制限をチェック
 * @param identifier 識別子（IPアドレス、ユーザーIDなど）
 * @param maxRequests 最大リクエスト数
 * @param windowMs 時間窓（ミリ秒）
 * @returns レート制限の結果
 */
export function checkRateLimit(
  identifier: string,
  maxRequests: number = 5,
  windowMs: number = 15 * 60 * 1000 // デフォルト: 15分
): RateLimitResult {
  const now = Date.now()
  const entry = rateLimitStore.get(identifier)

  if (!entry || entry.resetTime < now) {
    // 新しいエントリまたは期限切れ
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime: now + windowMs,
    })
    return {
      success: true,
      remaining: maxRequests - 1,
      resetTime: now + windowMs,
    }
  }

  if (entry.count >= maxRequests) {
    return {
      success: false,
      remaining: 0,
      resetTime: entry.resetTime,
    }
  }

  // カウントを増やす
  entry.count++
  rateLimitStore.set(identifier, entry)

  return {
    success: true,
    remaining: maxRequests - entry.count,
    resetTime: entry.resetTime,
  }
}

/**
 * IPアドレスを取得（プロキシ経由の場合も考慮）
 */
export function getClientIP(request: Request): string {
  // Vercel環境ではx-forwarded-forヘッダーを使用
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  // フォールバック
  const realIP = request.headers.get('x-real-ip')
  if (realIP) {
    return realIP
  }

  // デフォルト（開発環境）
  return 'unknown'
}
