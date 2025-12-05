import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const attendanceId = parseInt(params.id)
    if (isNaN(attendanceId)) {
      return NextResponse.json({ error: 'Invalid attendance ID' }, { status: 400 })
    }

    const attendance = await prisma.attendance.findFirst({
      where: {
        id: attendanceId,
        companyId: session.user.companyId,
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            employeeNumber: true,
            department: true,
          },
        },
      },
    })

    if (!attendance) {
      return NextResponse.json({ error: 'Attendance not found' }, { status: 404 })
    }

    return NextResponse.json({ attendance })
  } catch (error) {
    console.error('Failed to fetch attendance:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const attendanceId = parseInt(params.id)
    if (isNaN(attendanceId)) {
      return NextResponse.json({ error: 'Invalid attendance ID' }, { status: 400 })
    }

    const body = await request.json()
    const {
      wakeUpTime,
      departureTime,
      clockIn,
      clockOut,
      breakMinutes,
      clockInLocation,
      clockOutLocation,
    } = body

    // 打刻データが存在し、同じ会社のものか確認
    const existingAttendance = await prisma.attendance.findFirst({
      where: {
        id: attendanceId,
        companyId: session.user.companyId,
      },
    })

    if (!existingAttendance) {
      return NextResponse.json({ error: 'Attendance not found' }, { status: 404 })
    }

    // 時刻データの変換
    const formatTime = (time: string | null) => {
      if (!time) return null
      const [hours, minutes] = time.split(':')
      const date = new Date(existingAttendance.date)
      date.setHours(parseInt(hours), parseInt(minutes), 0, 0)
      return date
    }

    const updateData: any = {
      breakMinutes: breakMinutes || 0,
    }

    if (wakeUpTime !== undefined) {
      updateData.wakeUpTime = formatTime(wakeUpTime)
    }
    if (departureTime !== undefined) {
      updateData.departureTime = formatTime(departureTime)
    }
    if (clockIn !== undefined) {
      updateData.clockIn = formatTime(clockIn)
    }
    if (clockOut !== undefined) {
      updateData.clockOut = formatTime(clockOut)
    }
    if (clockInLocation !== undefined) {
      updateData.clockInLocation = clockInLocation
    }
    if (clockOutLocation !== undefined) {
      updateData.clockOutLocation = clockOutLocation
    }

    const updatedAttendance = await prisma.attendance.update({
      where: { id: attendanceId },
      data: updateData,
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            employeeNumber: true,
            department: true,
          },
        },
      },
    })

    return NextResponse.json({ success: true, attendance: updatedAttendance })
  } catch (error) {
    console.error('Failed to update attendance:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
