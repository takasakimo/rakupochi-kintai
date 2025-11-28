import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    console.log('[Dashboard] Starting dashboard data fetch')
    const session = await getServerSession(authOptions)
    if (!session || !session.user || session.user.role !== 'admin') {
      console.log('[Dashboard] Unauthorized')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[Dashboard] Session valid, companyId:', session.user.companyId)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // 本日の出勤者数（重複を避けるため、従業員IDでユニークにカウント）
    const todayAttendances = await prisma.attendance.findMany({
      where: {
        companyId: session.user.companyId,
        date: today,
        clockIn: { not: null },
        isDeleted: { not: true },
      },
      select: {
        employeeId: true,
      },
      distinct: ['employeeId'],
    })
    const todayAttendanceCount = todayAttendances.length

    // 未打刻者数（シフトが登録されていて、シフト開始時間を過ぎているが打刻していない従業員）
    let missingAttendanceCount = 0
    try {
      const now = new Date()
      const currentTime = now.getHours() * 60 + now.getMinutes() // 現在時刻を分単位で取得（ローカル時間）
      
      // 本日のシフトを取得（UTC日付で比較）
      const todayStart = new Date(today)
      todayStart.setUTCHours(0, 0, 0, 0)
      const todayEnd = new Date(today)
      todayEnd.setUTCHours(23, 59, 59, 999)
      
      const todayShifts = await prisma.shift.findMany({
        where: {
          companyId: session.user.companyId,
          date: {
            gte: todayStart,
            lte: todayEnd,
          },
          isPublicHoliday: false, // 公休は除外
        },
        include: {
          employee: {
            select: {
              id: true,
              isActive: true,
            },
          },
        },
      })
      
      // 本日の打刻済み従業員IDを取得（重複を避ける）
      const clockedInEmployeeIds = await prisma.attendance.findMany({
        where: {
          companyId: session.user.companyId,
          date: {
            gte: todayStart,
            lte: todayEnd,
          },
          clockIn: { not: null },
          isDeleted: { not: true },
        },
        select: {
          employeeId: true,
        },
        distinct: ['employeeId'],
      })
      const clockedInIds = new Set(clockedInEmployeeIds.map(a => a.employeeId))
      
      // シフト開始時間を過ぎているが打刻していない従業員をカウント（重複を避ける）
      const missingEmployeeIds = new Set<number>()
      
      for (const shift of todayShifts) {
        // 従業員がアクティブでない場合はスキップ
        if (!shift.employee.isActive) continue
        
        // 既に打刻している場合はスキップ
        if (clockedInIds.has(shift.employeeId)) continue
        
        // 既にカウント済みの従業員はスキップ（同じ従業員が複数のシフトを持っている場合）
        if (missingEmployeeIds.has(shift.employeeId)) continue
        
        // シフト開始時間を分単位で取得
        const shiftStartTime = shift.startTime
        let shiftStartMinutes = 0
        if (shiftStartTime instanceof Date) {
          // Date型の場合、UTC時間から取得（PrismaのTime型はUTCとして解釈される）
          // ただし、実際のシフト開始時間はローカル時間として扱う必要がある
          // PrismaのTime型はUTCとして保存されるが、実際の時刻はローカル時間として扱う
          const utcHours = shiftStartTime.getUTCHours()
          const utcMinutes = shiftStartTime.getUTCMinutes()
          // UTCからJST（+9時間）に変換
          const jstHours = (utcHours + 9) % 24
          shiftStartMinutes = jstHours * 60 + utcMinutes
        } else if (typeof shiftStartTime === 'string') {
          // 文字列の場合（HH:MM:SS または HH:MM）
          const timeStr = (shiftStartTime as string).split(':')
          const hours = parseInt(timeStr[0], 10)
          const minutes = parseInt(timeStr[1] || '0', 10)
          shiftStartMinutes = hours * 60 + minutes
        }
        
        // シフト開始時間を過ぎている場合のみカウント
        if (currentTime >= shiftStartMinutes) {
          missingEmployeeIds.add(shift.employeeId)
        }
      }
      
      missingAttendanceCount = missingEmployeeIds.size
    } catch (shiftError) {
      console.error('[Dashboard] Error calculating missing attendance:', shiftError)
      console.error('[Dashboard] Shift error stack:', shiftError instanceof Error ? shiftError.stack : 'No stack')
      // エラーが発生しても0を返して続行
      missingAttendanceCount = 0
    }

    // 承認待ち申請数
    const pendingApplicationsCount = await prisma.application.count({
      where: {
        companyId: session.user.companyId,
        status: 'pending',
      },
    })
    
    console.log('[Dashboard] Pending applications count:', pendingApplicationsCount)
    console.log('[Dashboard] Company ID:', session.user.companyId)

    // 残業アラート数（今月の残業時間が40時間を超えている従業員）
    const currentMonth = new Date()
    const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
    const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)

    const attendances = await prisma.attendance.findMany({
      where: {
        companyId: session.user.companyId,
        date: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
        clockIn: { not: null },
        clockOut: { not: null },
        isDeleted: { not: true },
      },
    })

    // 従業員ごとの残業時間を計算
    const employeeOvertimeMap = new Map<number, number>()
    attendances.forEach((attendance) => {
      if (!attendance.clockIn || !attendance.clockOut) return
      const inTime = new Date(`2000-01-01T${attendance.clockIn}`)
      const outTime = new Date(`2000-01-01T${attendance.clockOut}`)
      const diffMs = outTime.getTime() - inTime.getTime()
      const diffMinutes = Math.floor(diffMs / (1000 * 60)) - (attendance.breakMinutes || 0)
      const workHours = diffMinutes / 60

      const current = employeeOvertimeMap.get(attendance.employeeId) || 0
      employeeOvertimeMap.set(attendance.employeeId, current + workHours)
    })

    const overtimeAlertsCount = Array.from(employeeOvertimeMap.values()).filter(
      (hours) => hours > 40
    ).length

    return NextResponse.json({
      todayAttendanceCount,
      missingAttendanceCount,
      pendingApplicationsCount,
      overtimeAlertsCount,
    })
  } catch (error: any) {
    console.error('[Dashboard] Get dashboard data error:', error)
    console.error('[Dashboard] Error name:', error?.name)
    console.error('[Dashboard] Error message:', error?.message)
    console.error('[Dashboard] Error stack:', error?.stack)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error?.message || 'Unknown error',
        name: error?.name || 'Unknown',
      },
      { status: 500 }
    )
  }
}

