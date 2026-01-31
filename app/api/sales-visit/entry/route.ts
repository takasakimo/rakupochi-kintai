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
    const { time, date, companyName, contactPersonName, purpose, location } = body

    if (!time || !date) {
      return NextResponse.json(
        { error: 'Time and date are required' },
        { status: 400 }
      )
    }

    if (!companyName || companyName.trim() === '') {
      return NextResponse.json(
        { error: 'Company name is required' },
        { status: 400 }
      )
    }

    if (!purpose) {
      return NextResponse.json(
        { error: 'Purpose is required' },
        { status: 400 }
      )
    }

    const validPurposes = ['商談', '見積', 'アフターサービス', 'その他']
    if (!validPurposes.includes(purpose)) {
      return NextResponse.json(
        { error: 'Invalid purpose' },
        { status: 400 }
      )
    }

    if (!location || !location.latitude || !location.longitude) {
      return NextResponse.json(
        { error: 'Location is required for entry' },
        { status: 400 }
      )
    }

    const visitDate = new Date(date)
    const entryTime = new Date(`2000-01-01T${time}`)

    // 位置情報を保存
    const locationData = {
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy || null,
    }

    // 営業先訪問レコードを作成
    // 注意: 同一日に同一営業先への複数回の入店が可能です（退店後に再度入店可能）
    const salesVisit = await prisma.salesVisit.create({
      data: {
        companyId: session.user.companyId!,
        employeeId: parseInt(session.user.id),
        date: visitDate,
        companyName: companyName.trim(),
        contactPersonName: contactPersonName?.trim() || null,
        purpose,
        entryTime,
        entryLocation: locationData as any,
      },
    })

    return NextResponse.json({
      success: true,
      salesVisit,
      location: locationData,
    })
  } catch (error) {
    console.error('Sales visit entry error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
