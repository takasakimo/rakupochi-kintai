/**
 * ローカル日付を YYYY-MM-DD で返す
 * toISOString() は UTC のため、JST の 0〜8時台で1日ずれる問題を回避
 */
export function getLocalDateString(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
