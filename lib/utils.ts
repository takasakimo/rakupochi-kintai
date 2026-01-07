import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// GPS位置情報の距離計算（Haversine formula）
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000 // 地球の半径（メートル）
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180)
}

// 時刻フォーマット
export function formatTime(time: Date | string | null | undefined): string {
  if (!time) return '未打刻'
  const date = typeof time === 'string' ? new Date(`2000-01-01T${time}`) : time
  return date.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

// 日付フォーマット
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '未設定'
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '無効な日付'
  return d.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

