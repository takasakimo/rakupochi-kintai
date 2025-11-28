import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { findNearestLocation, LocationData } from '@/lib/attendance'

export const dynamic = 'force-dynamic'

// 管理者による打刻代行
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const {
      employeeId,
      date,
      type, // 'wake_up', 'departure', 'clock_in', 'clock_out'
      time,
      location, // 出勤・退勤の場合のみ（オプション）
    } = body

    if (!employeeId || !date || !type || !time) {
      return NextResponse.json(
        { error: 'Employee ID, date, type, and time are required' },
        { status: 400 }
      )
    }

    // 従業員が自社のものであることを確認
    const employee = await prisma.employee.findUnique({
      where: { id: parseInt(employeeId) },
    })

    if (!employee || employee.companyId !== session.user.companyId) {
      return NextResponse.json(
        { error: 'Employee not found or unauthorized' },
        { status: 404 }
      )
    }

    // 出勤・退勤の場合は位置情報を処理
    let locationData = null
    if ((type === 'clock_in' || type === 'clock_out') && location) {
      if (location.latitude && location.longitude) {
        locationData = await findNearestLocation(
          session.user.companyId,
          location as LocationData
        )
      } else {
        // 位置情報が提供されていない場合は、手動入力として記録
        locationData = {
          latitude: location.latitude || null,
          longitude: location.longitude || null,
          accuracy: null,
          locationName: location.locationName || '手動入力',
          distance: null,
          isManual: true,
        }
      }
    }

    // 打刻データを更新または作成
    const updateData: any = {}
    if (type === 'wake_up') {
      updateData.wakeUpTime = new Date(`2000-01-01T${time}`)
    } else if (type === 'departure') {
      updateData.departureTime = new Date(`2000-01-01T${time}`)
    } else if (type === 'clock_in') {
      updateData.clockIn = new Date(`2000-01-01T${time}`)
      if (locationData) {
        updateData.clockInLocation = locationData as any
      }
    } else if (type === 'clock_out') {
      updateData.clockOut = new Date(`2000-01-01T${time}`)
      if (locationData) {
        updateData.clockOutLocation = locationData as any
      }
    }

    const attendance = await prisma.attendance.upsert({
      where: {
        companyId_employeeId_date: {
          companyId: session.user.companyId,
          employeeId: parseInt(employeeId),
          date: new Date(date),
        },
      },
      update: updateData,
      create: {
        companyId: session.user.companyId,
        employeeId: parseInt(employeeId),
        date: new Date(date),
        ...updateData,
      },
    })

    return NextResponse.json({
      success: true,
      attendance,
      location: locationData,
    })
  } catch (error) {
    console.error('Manual attendance error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

