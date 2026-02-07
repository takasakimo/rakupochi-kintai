import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    console.log('[Dashboard] Starting dashboard data fetch')
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      console.log('[Dashboard] Unauthorized')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // スーパー管理者または管理者のみアクセス可能
    const isSuperAdmin = session.user.role === 'super_admin' || 
                         session.user.email === 'superadmin@rakupochi.com'
    const isAdmin = session.user.role === 'admin'

    if (!isSuperAdmin && !isAdmin) {
      console.log('[Dashboard] Forbidden')
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

    console.log('[Dashboard] Session valid, companyId:', effectiveCompanyId)
    
    // ローカル時間で今日の日付を取得
    const now = new Date()
    const todayYear = now.getFullYear()
    const todayMonth = now.getMonth()
    const todayDay = now.getDate()
    
    // UTC日付として今日の開始と終了を設定
    const todayStartUTC = new Date(Date.UTC(todayYear, todayMonth, todayDay, 0, 0, 0, 0))
    const todayEndUTC = new Date(Date.UTC(todayYear, todayMonth, todayDay, 23, 59, 59, 999))

    // 本日の出勤者数（重複を避けるため、従業員IDでユニークにカウント）
    const todayAttendances = await prisma.attendance.findMany({
      where: {
        companyId: effectiveCompanyId,
        date: {
          gte: todayStartUTC,
          lte: todayEndUTC,
        },
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
      const currentTime = now.getHours() * 60 + now.getMinutes() // 現在時刻を分単位で取得（ローカル時間）
      
      console.log('[Dashboard] Today date range:', {
        local: `${todayYear}-${todayMonth + 1}-${todayDay}`,
        utcStart: todayStartUTC.toISOString(),
        utcEnd: todayEndUTC.toISOString(),
        currentTime: `${Math.floor(currentTime / 60)}:${currentTime % 60}`,
      })
      
      const todayShifts = await prisma.shift.findMany({
        where: {
          companyId: effectiveCompanyId,
          date: {
            gte: todayStartUTC,
            lte: todayEndUTC,
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
      
      console.log('[Dashboard] Found shifts:', todayShifts.length)
      
      // 本日の打刻済み従業員IDを取得（重複を避ける）
      const clockedInEmployeeIds = await prisma.attendance.findMany({
        where: {
          companyId: effectiveCompanyId,
          date: {
            gte: todayStartUTC,
            lte: todayEndUTC,
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
      
      console.log('[Dashboard] Clocked in employees:', clockedInIds.size, Array.from(clockedInIds))
      
      // シフト開始時間を過ぎているが打刻していない従業員をカウント（重複を避ける）
      const missingEmployeeIds = new Set<number>()
      
      for (const shift of todayShifts) {
        // 従業員がアクティブでない場合はスキップ
        if (!shift.employee.isActive) {
          console.log('[Dashboard] Skipping inactive employee:', shift.employeeId)
          continue
        }
        
        // 既に打刻している場合はスキップ
        if (clockedInIds.has(shift.employeeId)) {
          console.log('[Dashboard] Employee already clocked in:', shift.employeeId)
          continue
        }
        
        // 既にカウント済みの従業員はスキップ（同じ従業員が複数のシフトを持っている場合）
        if (missingEmployeeIds.has(shift.employeeId)) {
          continue
        }
        
        // シフト開始時間を分単位で取得
        // シフト登録時と同じ方法で時刻を取得（getUTCHours()とgetUTCMinutes()を使用）
        // これにより、保存時と取得時で同じ方法を使用することで、タイムゾーンの問題を回避
        
        const shiftStartTime = shift.startTime
        let shiftStartMinutes = 0
        
        if (shiftStartTime instanceof Date) {
          // Date型の場合、UTC時間から取得（シフト登録時と同じ方法）
          // シフト登録時: `new Date(\`2000-01-01T${shift.startTime}\`)`で保存
          // VercelのサーバーはUTCタイムゾーンで動作しているため、
          // `new Date('2000-01-01T08:00:00')`はUTC時間として解釈される
          // そのため、getUTCHours()とgetUTCMinutes()を使用してUTC時間を取得
          const utcHours = shiftStartTime.getUTCHours()
          const utcMinutes = shiftStartTime.getUTCMinutes()
          shiftStartMinutes = utcHours * 60 + utcMinutes
          
          console.log('[Dashboard] Shift time (Date):', {
            utcHours,
            utcMinutes,
            shiftStartMinutes,
            formatted: `${String(utcHours).padStart(2, '0')}:${String(utcMinutes).padStart(2, '0')}`,
          })
        } else if (typeof shiftStartTime === 'string') {
          // 文字列の場合（HH:MM:SS または HH:MM）
          const timeParts = (shiftStartTime as string).split(':')
          const hours = parseInt(timeParts[0], 10)
          const minutes = parseInt(timeParts[1] || '0', 10)
          shiftStartMinutes = hours * 60 + minutes
          
          console.log('[Dashboard] Shift time (String):', {
            original: shiftStartTime,
            hours,
            minutes,
            shiftStartMinutes,
          })
        } else {
          console.warn('[Dashboard] Unknown shiftStartTime type:', typeof shiftStartTime, shiftStartTime)
          continue
        }
        
        console.log('[Dashboard] Checking shift:', {
          employeeId: shift.employeeId,
          shiftStartTime: shiftStartTime,
          shiftStartMinutes,
          currentTime,
          currentTimeFormatted: `${Math.floor(currentTime / 60)}:${currentTime % 60}`,
          shiftStartFormatted: `${Math.floor(shiftStartMinutes / 60)}:${shiftStartMinutes % 60}`,
          shouldCount: currentTime >= shiftStartMinutes,
        })
        
        // シフト開始時間を過ぎている場合のみカウント
        if (currentTime >= shiftStartMinutes) {
          missingEmployeeIds.add(shift.employeeId)
          console.log('[Dashboard] Added missing employee:', shift.employeeId)
        } else {
          console.log('[Dashboard] Shift not started yet for employee:', shift.employeeId)
        }
      }
      
      missingAttendanceCount = missingEmployeeIds.size
      console.log('[Dashboard] Missing attendance count:', missingAttendanceCount, Array.from(missingEmployeeIds))
    } catch (shiftError) {
      console.error('[Dashboard] Error calculating missing attendance:', shiftError)
      console.error('[Dashboard] Shift error stack:', shiftError instanceof Error ? shiftError.stack : 'No stack')
      // エラーが発生しても0を返して続行
      missingAttendanceCount = 0
    }

    // 承認待ち申請数
    const pendingApplicationsCount = await prisma.application.count({
      where: {
        companyId: effectiveCompanyId,
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
        companyId: effectiveCompanyId,
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

