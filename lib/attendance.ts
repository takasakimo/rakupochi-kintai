import { prisma } from './prisma'
import { calculateDistance } from './utils'

export interface LocationData {
  latitude: number
  longitude: number
  accuracy: number
}

export interface AttendanceLocation extends LocationData {
  locationName?: string
  distance?: number
  isWithinRange?: boolean
  address?: string // 都道府県・市区町村の住所
}

// 逆ジオコーディングで住所を取得（都道府県・市区町村）
async function getAddressFromCoordinates(
  latitude: number,
  longitude: number
): Promise<string | null> {
  try {
    // OpenStreetMap Nominatim APIを使用（無料、1秒に1リクエスト制限あり）
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'Rakupochi-Kintai/1.0', // 必須：User-Agentを設定
        },
      }
    )

    if (!response.ok) {
      console.error('Reverse geocoding failed:', response.status)
      return null
    }

    const data = await response.json()
    if (!data.address) {
      return null
    }

    // 日本の住所形式で取得
    const address = data.address
    const parts: string[] = []

    // 都道府県
    if (address.state || address.prefecture) {
      parts.push(address.state || address.prefecture)
    }

    // 市区町村
    if (address.city || address.town || address.village) {
      parts.push(address.city || address.town || address.village)
    } else if (address.municipality) {
      parts.push(address.municipality)
    }

    // 町名（オプション）
    if (address.neighbourhood || address.suburb) {
      parts.push(address.neighbourhood || address.suburb)
    }

    return parts.length > 0 ? parts.join('') : null
  } catch (error) {
    console.error('Reverse geocoding error:', error)
    return null
  }
}

// 最寄りの店舗・事業所を検索し、距離を計算
export async function findNearestLocation(
  companyId: number,
  location: LocationData
): Promise<AttendanceLocation> {
  const locations = await prisma.location.findMany({
    where: {
      companyId,
      isActive: true,
    },
  })

  // 逆ジオコーディングで住所を取得
  const address = await getAddressFromCoordinates(
    location.latitude,
    location.longitude
  )

  if (locations.length === 0) {
    return {
      ...location,
      isWithinRange: false,
      address: address || undefined,
    }
  }

  let nearestLocation = locations[0]
  let minDistance = calculateDistance(
    location.latitude,
    location.longitude,
    nearestLocation.latitude,
    nearestLocation.longitude
  )

  for (const loc of locations) {
    const distance = calculateDistance(
      location.latitude,
      location.longitude,
      loc.latitude,
      loc.longitude
    )
    if (distance < minDistance) {
      minDistance = distance
      nearestLocation = loc
    }
  }

  const isWithinRange = minDistance <= nearestLocation.radius

  return {
    ...location,
    locationName: nearestLocation.name,
    distance: Math.round(minDistance),
    isWithinRange,
    address: address || undefined,
  }
}

// 勤務時間計算（分）
export function calculateWorkMinutes(
  clockIn: Date | string | null,
  clockOut: Date | string | null,
  breakMinutes: number = 0
): number {
  if (!clockIn || !clockOut) return 0

  const inTime = typeof clockIn === 'string' 
    ? new Date(`2000-01-01T${clockIn}`)
    : clockIn
  const outTime = typeof clockOut === 'string'
    ? new Date(`2000-01-01T${clockOut}`)
    : clockOut

  const diffMs = outTime.getTime() - inTime.getTime()
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  
  return Math.max(0, diffMinutes - breakMinutes)
}

