import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { findNearestLocation, LocationData } from '@/lib/attendance'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { time, date, location } = body

    if (!time || !date) {
      return NextResponse.json(
        { error: 'Time and date are required' },
        { status: 400 }
      )
    }

    if (!location || !location.latitude || !location.longitude) {
      return NextResponse.json(
        { error: 'Location is required for clock-in' },
        { status: 400 }
      )
    }

    // 最寄りの店舗・事業所を検索
    const locationData = await findNearestLocation(
      session.user.companyId!,
      location as LocationData
    )

    const attendance = await prisma.attendance.upsert({
      where: {
        companyId_employeeId_date: {
          companyId: session.user.companyId!
          employeeId: parseInt(session.user.id),
          date: new Date(date),
        },
      },
      update: {
        clockIn: new Date(`2000-01-01T${time}`),
        clockInLocation: locationData as any,
      },
      create: {
        companyId: session.user.companyId!
        employeeId: parseInt(session.user.id),
        date: new Date(date),
        clockIn: new Date(`2000-01-01T${time}`),
        clockInLocation: locationData as any,
      },
    })

    return NextResponse.json({
      success: true,
      attendance,
      location: locationData,
    })
  } catch (error) {
    console.error('Clock-in attendance error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

