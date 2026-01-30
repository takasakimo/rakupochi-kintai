import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { time, date, visitId, meetingNotes, location } = body

    if (!time || !date) {
      return NextResponse.json(
        { error: 'Time and date are required' },
        { status: 400 }
      )
    }

    if (!visitId) {
      return NextResponse.json(
        { error: 'Visit ID is required' },
        { status: 400 }
      )
    }

    if (meetingNotes && meetingNotes.length > 1000) {
      return NextResponse.json(
        { error: 'Meeting notes must be 1000 characters or less' },
        { status: 400 }
      )
    }

    if (!location || !location.latitude || !location.longitude) {
      return NextResponse.json(
        { error: 'Location is required for exit' },
        { status: 400 }
      )
    }

    // 訪問レコードが存在し、入店済みで退店未済みか確認
    const existingVisit = await prisma.salesVisit.findFirst({
      where: {
        id: parseInt(visitId),
        companyId: session.user.companyId!,
        employeeId: parseInt(session.user.id),
        entryTime: { not: null },
        exitTime: null,
      },
    })

    if (!existingVisit) {
      return NextResponse.json(
        { error: 'Visit not found or already exited' },
        { status: 404 }
      )
    }

    const exitTime = new Date(`2000-01-01T${time}`)

    // 位置情報を保存
    const locationData = {
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy || null,
    }

    // 退店情報を更新
    const salesVisit = await prisma.salesVisit.update({
      where: { id: parseInt(visitId) },
      data: {
        exitTime,
        exitLocation: locationData as any,
        meetingNotes: meetingNotes?.trim() || null,
      },
    })

    return NextResponse.json({
      success: true,
      salesVisit,
      location: locationData,
    })
  } catch (error) {
    console.error('Sales visit exit error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
