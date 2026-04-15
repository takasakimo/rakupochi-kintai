/**
 * ローカル日付を YYYY-MM-DD で返す
 * toISOString() は UTC のため、JST の 0〜8時台で1日ずれる問題を回避
 * ※ クライアント側専用（ブラウザのローカルタイムゾーンに依存）
 */
export function getLocalDateString(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * サーバーサイド（Vercel = UTC）でJSTの現在日時を取得する
 * new Date() は UTC を返すため +9h で JST に変換
 * 使用後は .getFullYear()/.getMonth()/.getDate()/.getHours() が JST 値になる
 */
export function getJSTNow(): Date {
  return new Date(Date.now() + 9 * 60 * 60 * 1000)
}
