import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // スーパー管理者または管理者のみアクセス可能
    const isSuperAdmin = session.user.role === 'super_admin' || 
                         session.user.email === 'superadmin@rakupochi.com'
    const isAdmin = session.user.role === 'admin'

    if (!isSuperAdmin && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // スーパー管理者の場合はselectedCompanyIdを使用、通常の管理者の場合はcompanyIdを使用
    const effectiveCompanyId = isSuperAdmin 
      ? session.user.selectedCompanyId 
      : session.user.companyId

    if (!effectiveCompanyId) {
      return NextResponse.json(
        { error: isSuperAdmin ? '企業が選択されていません' : 'Company ID not found' },
        { status: 400 }
      )
    }

    const attendanceId = parseInt(params.id)
    if (isNaN(attendanceId)) {
      return NextResponse.json({ error: 'Invalid attendance ID' }, { status: 400 })
    }

    const attendance = await prisma.attendance.findFirst({
      where: {
        id: attendanceId,
        companyId: effectiveCompanyId,
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
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // スーパー管理者または管理者のみアクセス可能
    const isSuperAdmin = session.user.role === 'super_admin' || 
                         session.user.email === 'superadmin@rakupochi.com'
    const isAdmin = session.user.role === 'admin'

    if (!isSuperAdmin && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // スーパー管理者の場合はselectedCompanyIdを使用、通常の管理者の場合はcompanyIdを使用
    const effectiveCompanyId = isSuperAdmin 
      ? session.user.selectedCompanyId 
      : session.user.companyId

    if (!effectiveCompanyId) {
      return NextResponse.json(
        { error: isSuperAdmin ? '企業が選択されていません' : 'Company ID not found' },
        { status: 400 }
      )
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
        companyId: effectiveCompanyId,
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

// 打刻データの削除
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // スーパー管理者または管理者のみアクセス可能
    const isSuperAdmin = session.user.role === 'super_admin' || 
                         session.user.email === 'superadmin@rakupochi.com'
    const isAdmin = session.user.role === 'admin'

    if (!isSuperAdmin && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // スーパー管理者の場合はselectedCompanyIdを使用、通常の管理者の場合はcompanyIdを使用
    const effectiveCompanyId = isSuperAdmin 
      ? session.user.selectedCompanyId 
      : session.user.companyId

    if (!effectiveCompanyId) {
      return NextResponse.json(
        { error: isSuperAdmin ? '企業が選択されていません' : 'Company ID not found' },
        { status: 400 }
      )
    }

    const attendanceId = parseInt(params.id)
    if (isNaN(attendanceId)) {
      return NextResponse.json({ error: 'Invalid attendance ID' }, { status: 400 })
    }

    // 打刻データが存在し、同じ会社のものか確認
    const existingAttendance = await prisma.attendance.findFirst({
      where: {
        id: attendanceId,
        companyId: effectiveCompanyId,
      },
    })

    if (!existingAttendance) {
      return NextResponse.json({ error: 'Attendance not found' }, { status: 404 })
    }

    // 論理削除（isDeletedフラグをtrueにする）
    await prisma.attendance.update({
      where: { id: attendanceId },
      data: { isDeleted: true },
    })

    return NextResponse.json({ 
      success: true,
      message: '打刻を削除しました',
    })
  } catch (error) {
    console.error('Failed to delete attendance:', error)
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

