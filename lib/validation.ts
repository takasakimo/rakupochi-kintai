/**
 * 入力値のサニタイズとバリデーション
 */

/**
 * HTMLタグをエスケープ
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }
  return text.replace(/[&<>"']/g, (m) => map[m])
}

/**
 * SQLインジェクション対策（Prismaを使用しているため基本的には不要だが、追加の検証）
 */
export function sanitizeSqlInput(input: string): string {
  // 危険なSQL文字を削除
  return input.replace(/['";\\]/g, '')
}

/**
 * メールアドレスの検証
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email) && email.length <= 255
}

/**
 * パスワードの強度チェック
 */
export function isStrongPassword(password: string): { valid: boolean; message?: string } {
  if (password.length < 8) {
    return { valid: false, message: 'パスワードは8文字以上で入力してください' }
  }
  if (password.length > 128) {
    return { valid: false, message: 'パスワードは128文字以内で入力してください' }
  }
  // オプション: より厳しいパスワードポリシーを追加可能
  // if (!/[A-Z]/.test(password)) {
  //   return { valid: false, message: 'パスワードには大文字を含めてください' }
  // }
  // if (!/[a-z]/.test(password)) {
  //   return { valid: false, message: 'パスワードには小文字を含めてください' }
  // }
  // if (!/[0-9]/.test(password)) {
  //   return { valid: false, message: 'パスワードには数字を含めてください' }
  // }
  return { valid: true }
}

/**
 * 文字列の長さチェック
 */
export function validateLength(
  input: string,
  min: number,
  max: number,
  fieldName: string = '入力値'
): { valid: boolean; message?: string } {
  if (input.length < min) {
    return { valid: false, message: `${fieldName}は${min}文字以上で入力してください` }
  }
  if (input.length > max) {
    return { valid: false, message: `${fieldName}は${max}文字以内で入力してください` }
  }
  return { valid: true }
}

/**
 * 数値の検証
 */
export function isValidNumber(value: any, min?: number, max?: number): boolean {
  if (typeof value !== 'number' && typeof value !== 'string') {
    return false
  }
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num) || !isFinite(num)) {
    return false
  }
  if (min !== undefined && num < min) {
    return false
  }
  if (max !== undefined && num > max) {
    return false
  }
  return true
}

/**
 * URLの検証
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url)
    return ['http:', 'https:'].includes(parsedUrl.protocol)
  } catch {
    return false
  }
}

/**
 * 日付の検証
 */
export function isValidDate(date: any): boolean {
  if (!(date instanceof Date)) {
    return false
  }
  return !isNaN(date.getTime())
}

/**
 * 文字列から危険な文字を削除
 */
export function sanitizeString(input: string): string {
  // 制御文字を削除
  return input.replace(/[\x00-\x1F\x7F]/g, '').trim()
}
