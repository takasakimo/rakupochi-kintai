import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { findNearestLocation, LocationData } from '@/lib/attendance'

export const dynamic = 'force-dynamic'

// 打刻更新
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const attendanceId = parseInt(params.id)
    const body = await request.json()

    // 既存の打刻を確認
    const existingAttendance = await prisma.attendance.findUnique({
      where: { id: attendanceId },
    })

    if (!existingAttendance || existingAttendance.companyId !== session.user.companyId) {
      return NextResponse.json(
        { error: 'Attendance not found or unauthorized' },
        { status: 404 }
      )
    }

    const updateData: any = {}

    // 各時刻フィールドを更新
    if (body.wakeUpTime !== undefined) {
      updateData.wakeUpTime = body.wakeUpTime
        ? new Date(`2000-01-01T${body.wakeUpTime}`)
        : null
    }
    if (body.departureTime !== undefined) {
      updateData.departureTime = body.departureTime
        ? new Date(`2000-01-01T${body.departureTime}`)
        : null
    }
    if (body.clockIn !== undefined) {
      updateData.clockIn = body.clockIn
        ? new Date(`2000-01-01T${body.clockIn}`)
        : null
    }
    if (body.clockOut !== undefined) {
      updateData.clockOut = body.clockOut
        ? new Date(`2000-01-01T${body.clockOut}`)
        : null
    }

    // 位置情報の更新
    if (body.clockInLocation) {
      if (body.clockInLocation.latitude && body.clockInLocation.longitude) {
        const locationData = await findNearestLocation(
          session.user.companyId,
          {
            latitude: body.clockInLocation.latitude,
            longitude: body.clockInLocation.longitude,
          } as LocationData
        )
        updateData.clockInLocation = locationData as any
      } else if (body.clockInLocation.locationName) {
        updateData.clockInLocation = {
          locationName: body.clockInLocation.locationName,
          isManual: true,
        } as any
      }
    }
    if (body.clockOutLocation) {
      if (body.clockOutLocation.latitude && body.clockOutLocation.longitude) {
        const locationData = await findNearestLocation(
          session.user.companyId,
          {
            latitude: body.clockOutLocation.latitude,
            longitude: body.clockOutLocation.longitude,
          } as LocationData
        )
        updateData.clockOutLocation = locationData as any
      } else if (body.clockOutLocation.locationName) {
        updateData.clockOutLocation = {
          locationName: body.clockOutLocation.locationName,
          isManual: true,
        } as any
      }
    }

    if (body.breakMinutes !== undefined) {
      updateData.breakMinutes = body.breakMinutes
    }
    if (body.notes !== undefined) {
      updateData.notes = body.notes
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
  } catch (error: any) {
    console.error('Update attendance error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message },
      { status: 500 }
    )
  }
}

// 打刻削除
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const attendanceId = parseInt(params.id)

    // 既存の打刻を確認
    const existingAttendance = await prisma.attendance.findUnique({
      where: { id: attendanceId },
    })

    if (!existingAttendance || existingAttendance.companyId !== session.user.companyId) {
      return NextResponse.json(
        { error: 'Attendance not found or unauthorized' },
        { status: 404 }
      )
    }

    await prisma.attendance.delete({
      where: { id: attendanceId },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete attendance error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message },
      { status: 500 }
    )
  }
}

