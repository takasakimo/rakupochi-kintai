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
      
      // 本日の日付をYYYY-MM-DD形式で取得（ローカル時間）
      const todayYear = today.getFullYear()
      const todayMonth = today.getMonth()
      const todayDay = today.getDate()
      
      // Prismaのdateフィールドは@db.Date型なので、UTC日付として扱う
      // ローカル日付をUTC日付に変換（正午を基準にすることでタイムゾーン問題を回避）
      const todayStartUTC = new Date(Date.UTC(todayYear, todayMonth, todayDay, 0, 0, 0, 0))
      const todayEndUTC = new Date(Date.UTC(todayYear, todayMonth, todayDay, 23, 59, 59, 999))
      
      console.log('[Dashboard] Today date range:', {
        local: `${todayYear}-${todayMonth + 1}-${todayDay}`,
        utcStart: todayStartUTC.toISOString(),
        utcEnd: todayEndUTC.toISOString(),
        currentTime: `${Math.floor(currentTime / 60)}:${currentTime % 60}`,
      })
      
      const todayShifts = await prisma.shift.findMany({
        where: {
          companyId: session.user.companyId,
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
          companyId: session.user.companyId,
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
        const shiftStartTime = shift.startTime
        let shiftStartMinutes = 0
        
        if (shiftStartTime instanceof Date) {
          // Date型の場合、Prismaの@db.Time型は時刻のみを保存
          // Prismaが返すDateオブジェクトは、基準日（2000-01-01）を使用して時刻を表現
          // サーバーがUTCタイムゾーンで動作している場合、getUTCHours()とgetUTCMinutes()を使用
          // サーバーがJSTタイムゾーンで動作している場合、getHours()とgetMinutes()を使用
          
          // VercelのサーバーはUTCタイムゾーンで動作しているため、
          // データベースに保存されている時刻（JST）を取得するには、UTC時間を取得してJSTに変換する必要がある
          // しかし、Prismaの@db.Time型は、保存時にローカル時間として保存されるが、
          // 取得時はUTCとして解釈される可能性がある
          
          // 実際の動作を確認するため、両方の値を取得
          const utcHours = shiftStartTime.getUTCHours()
          const utcMinutes = shiftStartTime.getUTCMinutes()
          const localHours = shiftStartTime.getHours()
          const localMinutes = shiftStartTime.getMinutes()
          
          // データベースに保存されている時刻がJST（UTC+9）の場合、
          // Prismaが返すUTC時間は、実際のJST時刻から9時間引いた値になる
          // そのため、UTC時間に9時間を足してJSTに変換する必要がある
          // ただし、これはデータベースの保存形式に依存する
          
          // 試行錯誤：UTC時間をそのまま使用（保存時にUTCとして保存されている場合）
          // または、UTC時間に9時間を足してJSTに変換（保存時にJSTとして保存されている場合）
          // または、ローカル時間を使用（サーバーがJSTタイムゾーンで動作している場合）
          
          // まず、UTC時間を取得
          let hours = utcHours
          let minutes = utcMinutes
          
          // データベースに保存されている時刻がJSTの場合、UTC時間に9時間を足す
          // ただし、これはデータベースの保存形式に依存する
          // 実際の動作を確認するため、デバッグログを出力
          
          // 試行：UTC時間をそのまま使用してみる
          // もし正しく動作しない場合は、UTC時間に9時間を足すか、ローカル時間を使用する
          shiftStartMinutes = hours * 60 + minutes
          
          console.log('[Dashboard] Shift time (Date):', {
            utc: `${utcHours}:${utcMinutes}`,
            local: `${localHours}:${localMinutes}`,
            using: `${hours}:${minutes}`,
            minutes: shiftStartMinutes,
          })
        } else if (typeof shiftStartTime === 'string') {
          // 文字列の場合（HH:MM:SS または HH:MM）
          const timeStr = (shiftStartTime as string).split(':')
          const hours = parseInt(timeStr[0], 10)
          const minutes = parseInt(timeStr[1] || '0', 10)
          shiftStartMinutes = hours * 60 + minutes
          console.log('[Dashboard] Shift time (String):', {
            original: shiftStartTime,
            parsed: `${hours}:${minutes}`,
            minutes: shiftStartMinutes,
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

