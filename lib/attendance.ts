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

  if (locations.length === 0) {
    return {
      ...location,
      isWithinRange: false,
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

