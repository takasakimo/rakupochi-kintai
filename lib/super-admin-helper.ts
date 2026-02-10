/**
 * スーパー管理者の判定を統一するヘルパー関数
 * 環境変数 SUPER_ADMIN_EMAIL が設定されている場合はそれを使用、
 * 設定されていない場合はデフォルト値を使用
 */

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'superadmin@rakupochi.com'

/**
 * 指定されたメールアドレスがスーパー管理者かどうかを判定
 */
export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return email === SUPER_ADMIN_EMAIL
}

/**
 * スーパー管理者のメールアドレスを取得（環境変数から）
 */
export function getSuperAdminEmail(): string {
  return SUPER_ADMIN_EMAIL
}
