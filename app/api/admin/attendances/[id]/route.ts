import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

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
      notes,
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

    // 修正を行った管理者のIDを取得
    const modifierId = parseInt(session.user.id)
    if (isNaN(modifierId)) {
      return NextResponse.json({ error: 'Invalid modifier ID' }, { status: 400 })
    }

    // 時刻データの変換
    const formatTime = (time: string | null) => {
      if (!time) return null
      const [hours, minutes] = time.split(':')
      const date = new Date(existingAttendance.date)
      date.setHours(parseInt(hours), parseInt(minutes), 0, 0)
      return date
    }

    // 時刻を文字列形式に変換（履歴保存用）
    const formatTimeForLog = (time: Date | null) => {
      if (!time) return null
      const hours = String(time.getHours()).padStart(2, '0')
      const minutes = String(time.getMinutes()).padStart(2, '0')
      return `${hours}:${minutes}`
    }

    // 変更前の値を保存
    const oldValues: any = {
      wakeUpTime: formatTimeForLog(existingAttendance.wakeUpTime),
      departureTime: formatTimeForLog(existingAttendance.departureTime),
      clockIn: formatTimeForLog(existingAttendance.clockIn),
      clockOut: formatTimeForLog(existingAttendance.clockOut),
      breakMinutes: existingAttendance.breakMinutes,
      clockInLocation: existingAttendance.clockInLocation,
      clockOutLocation: existingAttendance.clockOutLocation,
      notes: existingAttendance.notes,
    }

    const updateData: any = {
      breakMinutes: breakMinutes !== undefined ? (breakMinutes || 0) : existingAttendance.breakMinutes,
    }

    const changedFields: string[] = []

    if (wakeUpTime !== undefined) {
      updateData.wakeUpTime = formatTime(wakeUpTime)
      if (formatTimeForLog(existingAttendance.wakeUpTime) !== wakeUpTime) {
        changedFields.push('wakeUpTime')
      }
    }
    if (departureTime !== undefined) {
      updateData.departureTime = formatTime(departureTime)
      if (formatTimeForLog(existingAttendance.departureTime) !== departureTime) {
        changedFields.push('departureTime')
      }
    }
    if (clockIn !== undefined) {
      updateData.clockIn = formatTime(clockIn)
      if (formatTimeForLog(existingAttendance.clockIn) !== clockIn) {
        changedFields.push('clockIn')
      }
    }
    if (clockOut !== undefined) {
      updateData.clockOut = formatTime(clockOut)
      if (formatTimeForLog(existingAttendance.clockOut) !== clockOut) {
        changedFields.push('clockOut')
      }
    }
    if (clockInLocation !== undefined) {
      updateData.clockInLocation = clockInLocation
      if (JSON.stringify(existingAttendance.clockInLocation) !== JSON.stringify(clockInLocation)) {
        changedFields.push('clockInLocation')
      }
    }
    if (clockOutLocation !== undefined) {
      updateData.clockOutLocation = clockOutLocation
      if (JSON.stringify(existingAttendance.clockOutLocation) !== JSON.stringify(clockOutLocation)) {
        changedFields.push('clockOutLocation')
      }
    }
    if (breakMinutes !== undefined && existingAttendance.breakMinutes !== breakMinutes) {
      changedFields.push('breakMinutes')
    }
    if (notes !== undefined) {
      updateData.notes = notes || null
      if (existingAttendance.notes !== (notes || null)) {
        changedFields.push('notes')
      }
    }

    // 変更があった場合のみ更新と履歴記録を行う
    if (changedFields.length > 0) {
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

      // 変更後の値を保存
      const newValues: any = {
        wakeUpTime: formatTimeForLog(updatedAttendance.wakeUpTime),
        departureTime: formatTimeForLog(updatedAttendance.departureTime),
        clockIn: formatTimeForLog(updatedAttendance.clockIn),
        clockOut: formatTimeForLog(updatedAttendance.clockOut),
        breakMinutes: updatedAttendance.breakMinutes,
        clockInLocation: updatedAttendance.clockInLocation,
        clockOutLocation: updatedAttendance.clockOutLocation,
        notes: updatedAttendance.notes,
      }

      // 修正履歴を記録
      await prisma.attendanceModificationLog.create({
        data: {
          attendanceId: attendanceId,
          companyId: effectiveCompanyId,
          employeeId: existingAttendance.employeeId,
          modifiedBy: modifierId,
          action: 'update',
          oldValues: oldValues,
          newValues: newValues,
          changedFields: changedFields,
        },
      })

      return NextResponse.json({ success: true, attendance: updatedAttendance })
    } else {
      // 変更がない場合は既存のデータを返す
      const attendance = await prisma.attendance.findFirst({
        where: { id: attendanceId },
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
      return NextResponse.json({ success: true, attendance })
    }
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

    // 修正を行った管理者のIDを取得
    const modifierId = parseInt(session.user.id)
    if (isNaN(modifierId)) {
      return NextResponse.json({ error: 'Invalid modifier ID' }, { status: 400 })
    }

    // 時刻を文字列形式に変換（履歴保存用）
    const formatTimeForLog = (time: Date | null) => {
      if (!time) return null
      const hours = String(time.getHours()).padStart(2, '0')
      const minutes = String(time.getMinutes()).padStart(2, '0')
      return `${hours}:${minutes}`
    }

    // 削除前の値を保存
    const oldValues: any = {
      wakeUpTime: formatTimeForLog(existingAttendance.wakeUpTime),
      departureTime: formatTimeForLog(existingAttendance.departureTime),
      clockIn: formatTimeForLog(existingAttendance.clockIn),
      clockOut: formatTimeForLog(existingAttendance.clockOut),
      breakMinutes: existingAttendance.breakMinutes,
      clockInLocation: existingAttendance.clockInLocation,
      clockOutLocation: existingAttendance.clockOutLocation,
    }

    // 論理削除（isDeletedフラグをtrueにする）
    await prisma.attendance.update({
      where: { id: attendanceId },
      data: { isDeleted: true },
    })

    // 削除履歴を記録
    await prisma.attendanceModificationLog.create({
      data: {
        attendanceId: attendanceId,
        companyId: effectiveCompanyId,
        employeeId: existingAttendance.employeeId,
        modifiedBy: modifierId,
        action: 'delete',
        oldValues: oldValues,
        newValues: Prisma.JsonNull,
        changedFields: ['isDeleted'],
      },
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

