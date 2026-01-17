import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { findNearestLocation, LocationData } from '@/lib/attendance'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { location } = body

    if (!location || !location.latitude || !location.longitude) {
      return NextResponse.json(
        { error: 'Location is required' },
        { status: 400 }
      )
    }

    // 最寄りの店舗・事業所を検索
    const locationData = await findNearestLocation(
      session.user.companyId!,
      location as LocationData
    )

    return NextResponse.json({
      success: true,
      location: locationData,
    })
  } catch (error) {
    console.error('Validate location error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

