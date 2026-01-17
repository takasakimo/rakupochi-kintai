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
    const { time, date } = body

    if (!time || !date) {
      return NextResponse.json(
        { error: 'Time and date are required' },
        { status: 400 }
      )
    }

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
          wakeUpTime: new Date(`2000-01-01T${time}`),
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
        // 削除されたレコードを復元して更新
        attendance = await prisma.attendance.update({
          where: { id: deletedAttendance.id },
          data: {
            isDeleted: false,
            wakeUpTime: new Date(`2000-01-01T${time}`),
          },
        })
      } else {
        // 新規作成
        attendance = await prisma.attendance.create({
          data: {
            companyId: session.user.companyId!,
            employeeId: parseInt(session.user.id),
            date: attendanceDate,
            wakeUpTime: new Date(`2000-01-01T${time}`),
          },
        })
      }
    }

    return NextResponse.json({ success: true, attendance })
  } catch (error) {
    console.error('Wake-up attendance error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

