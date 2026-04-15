import crypto from 'crypto'

const ENV_KEY = 'KINTAI_INTEGRATION_API_KEY'

/**
 * 連携用APIキーが環境変数に設定されているか
 */
export function isIntegrationApiKeyConfigured(): boolean {
  const key = process.env[ENV_KEY]
  return typeof key === 'string' && key.length > 0
}

/**
 * リクエストから連携用APIキーを検証する（タイミング攻撃対策で定数時間比較）
 * Authorization: Bearer <key> または X-API-Key: <key> をサポート
 */
export function validateIntegrationApiKey(request: Request): boolean {
  const expectedKey = process.env[ENV_KEY]
  if (!expectedKey || typeof expectedKey !== 'string') {
    return false
  }

  let providedKey: string | null = null
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    providedKey = authHeader.slice(7).trim()
  }
  if (!providedKey) {
    providedKey = request.headers.get('x-api-key')?.trim() ?? null
  }

  if (!providedKey) {
    return false
  }

  const expected = Buffer.from(expectedKey, 'utf8')
  const actual = Buffer.from(providedKey, 'utf8')
  if (expected.length !== actual.length) {
    return false
  }
  return crypto.timingSafeEqual(expected, actual)
}
