import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { findNearestLocation, LocationData } from '@/lib/attendance'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
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
        { error: 'Location is required for clock-out' },
        { status: 400 }
      )
    }

    // 最寄りの店舗・事業所を検索
    const locationData = await findNearestLocation(
      session.user.companyId!,
      location as LocationData
    )

    const attendanceDate = new Date(date)
    
    // 削除されていない既存のレコードを確認
    const existingAttendance = await prisma.attendance.findFirst({
      where: {
        companyId: session.user.companyId!,
        employeeId: parseInt(session.user.id),
        date: attendanceDate,
        isDeleted: { not: true },
      },
    })

    let attendance
    if (existingAttendance) {
      // 既存のレコードを更新
      attendance = await prisma.attendance.update({
        where: { id: existingAttendance.id },
        data: {
          clockOut: new Date(`2000-01-01T${time}`),
          clockOutLocation: locationData as any,
        },
      })
    } else {
      // 削除されたレコードがある場合は復元、なければ新規作成
      const deletedAttendance = await prisma.attendance.findFirst({
        where: {
          companyId: session.user.companyId!,
          employeeId: parseInt(session.user.id),
          date: attendanceDate,
          isDeleted: true,
        },
      })

      if (deletedAttendance) {
        // 削除されたレコードを復元して更新（出勤データは保持）
        attendance = await prisma.attendance.update({
          where: { id: deletedAttendance.id },
          data: {
            isDeleted: false,
            clockOut: new Date(`2000-01-01T${time}`),
            clockOutLocation: locationData as any,
          },
        })
      } else {
        // 新規作成
        attendance = await prisma.attendance.create({
          data: {
            companyId: session.user.companyId!,
            employeeId: parseInt(session.user.id),
            date: attendanceDate,
            clockOut: new Date(`2000-01-01T${time}`),
            clockOutLocation: locationData as any,
          },
        })
      }
    }

    return NextResponse.json({
      success: true,
      attendance,
      location: locationData,
    })
  } catch (error) {
    console.error('Clock-out attendance error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

