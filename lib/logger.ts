/**
 * セキュリティを考慮したロガー
 * 本番環境では詳細なログを出力しない
 */

const isDevelopment = process.env.NODE_ENV === 'development'

export const logger = {
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args)
    }
  },
  error: (...args: any[]) => {
    // エラーは常にログに出力（ただし詳細情報は制限）
    if (isDevelopment) {
      console.error(...args)
    } else {
      // 本番環境ではエラーの種類のみログ
      const firstArg = args[0]
      if (typeof firstArg === 'string') {
        console.error(firstArg)
      } else {
        console.error('Error occurred')
      }
    }
  },
  warn: (...args: any[]) => {
    if (isDevelopment) {
      console.warn(...args)
    }
  },
  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.log('[DEBUG]', ...args)
    }
  },
}
