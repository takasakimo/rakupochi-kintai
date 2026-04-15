import crypto from 'crypto'

/**
 * CRON エンドポイントの認証チェック（タイミング攻撃対策のため定数時間比較を使用）
 * Vercel Cron は CRON_SECRET を Authorization: Bearer <secret> で自動送信する。
 * 注意: x-vercel-signature は Drains 用であり、Cron では署名検証されないため使用しない。
 */
export function validateCronRequest(request: Request): boolean {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || !authHeader || !authHeader.startsWith('Bearer ')) {
    return false
  }

  const expected = Buffer.from(`Bearer ${cronSecret}`, 'utf8')
  const actual = Buffer.from(authHeader, 'utf8')
  if (expected.length !== actual.length) {
    return false
  }
  return crypto.timingSafeEqual(expected, actual)
}

/**
 * 開発環境で CRON_SECRET 未設定時に認証をスキップするか
 * 注意: 本番デプロイでは NODE_ENV=production が設定されるため、
 * この関数は false を返し、認証スキップは行われません
 */
export function allowCronInDevelopment(): boolean {
  return process.env.NODE_ENV === 'development' && !process.env.CRON_SECRET
}
