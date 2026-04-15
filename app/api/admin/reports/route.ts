import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// 勤怠レポート生成
export async function GET(request: NextRequest) {
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

    const searchParams = request.nextUrl.searchParams
    const employeeId = searchParams.get('employee_id')
      ? parseInt(searchParams.get('employee_id')!)
      : undefined
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const month = searchParams.get('month') // YYYY-MM形式

    let start: Date
    let end: Date

    if (month) {
      // 月指定の場合
      const [year, monthNum] = month.split('-').map(Number)
      start = new Date(year, monthNum - 1, 1)
      end = new Date(year, monthNum, 0)
    } else if (startDate && endDate) {
      // 日付範囲指定の場合
      start = new Date(startDate)
      end = new Date(endDate)
    } else {
      // デフォルトで今月
      const now = new Date()
      start = new Date(now.getFullYear(), now.getMonth(), 1)
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    }

    const where: any = {
      companyId: effectiveCompanyId,
      date: {
        gte: start,
        lte: end,
      },
      isDeleted: { not: true },
    }

    if (employeeId) {
      where.employeeId = employeeId
    }

    // 勤怠データを取得
    let attendances
    try {
      attendances = await prisma.attendance.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              name: true,
              employeeNumber: true,
              department: true,
              position: true,
              workLocation: true, // 店舗名を追加
            },
          },
        },
        orderBy: {
          date: 'asc',
        },
      })
    } catch (error: any) {
      console.error('[Reports] Error fetching attendances:', error?.message)
      return NextResponse.json(
        { error: 'Failed to fetch attendances' },
        { status: 500 }
      )
    }

    // 従業員ごとに集計
    const employeeReports: Record<
      number,
      {
        employee: any
        totalWorkDays: number
        totalWorkMinutes: number
        totalOvertimeMinutes: number
        totalBreakMinutes: number
        attendances: any[]
        locationName: string | null // 最も多く使用された店舗名
      }
    > = {}

    // 企業設定を取得（残業時間の閾値など）
    let companySettings = null
    try {
      companySettings = await prisma.companySetting.findUnique({
        where: { companyId: effectiveCompanyId },
      })
    } catch (error: any) {
      console.error('Error fetching company settings:', error)
      // allowPreOvertimeカラムが存在しない場合のエラーをキャッチ
      if (error.code === 'P2022' || error.message?.includes('allowPreOvertime')) {
        console.warn('allowPreOvertime column does not exist, using default value')
        try {
          // カラムを除外して再取得
          const result = await prisma.$queryRaw`
            SELECT 
              id, "companyId", payday, "workStartTime", "workEndTime", 
              "standardBreakMinutes", "overtimeThreshold40", "overtimeThreshold60",
              "consecutiveWorkAlert", "leaveExpiryAlertDays", "createdAt", "updatedAt"
            FROM company_settings
            WHERE "companyId" = ${effectiveCompanyId}
            LIMIT 1
          ` as any
          if (result && Array.isArray(result) && result.length > 0) {
            companySettings = result[0]
          }
        } catch (rawError) {
          console.error('Error fetching company settings with raw query:', rawError)
          // デフォルト値を使用
          companySettings = null
        }
      } else {
        // その他のエラーはログに記録して続行（デフォルト値を使用）
        console.error('Unexpected error fetching company settings:', error)
        companySettings = null
      }
    }

    const overtimeThreshold40 = companySettings?.overtimeThreshold40 || 40
    const overtimeThreshold60 = companySettings?.overtimeThreshold60 || 60
    // 前残業を認める設定を取得（デフォルトはfalse）
    const allowPreOvertime = companySettings?.allowPreOvertime === true

    // 標準就業時間を取得（デフォルト: 9:00-18:00）
    const defaultWorkStart = new Date('2000-01-01T09:00:00')
    const defaultWorkEnd = new Date('2000-01-01T18:00:00')
    
    let workStartTime = defaultWorkStart
    let workEndTime = defaultWorkEnd
    
    if (companySettings?.workStartTime) {
      try {
        if (companySettings.workStartTime instanceof Date) {
          const hours = companySettings.workStartTime.getHours()
          const minutes = companySettings.workStartTime.getMinutes()
          workStartTime = new Date(`2000-01-01T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`)
        } else if (typeof companySettings.workStartTime === 'string') {
          workStartTime = new Date(`2000-01-01T${companySettings.workStartTime}`)
        }
      } catch (e) {
        console.error('Error parsing workStartTime:', e)
        workStartTime = defaultWorkStart
      }
    }
    
    if (companySettings?.workEndTime) {
      try {
        if (companySettings.workEndTime instanceof Date) {
          const hours = companySettings.workEndTime.getHours()
          const minutes = companySettings.workEndTime.getMinutes()
          workEndTime = new Date(`2000-01-01T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`)
        } else if (typeof companySettings.workEndTime === 'string') {
          workEndTime = new Date(`2000-01-01T${companySettings.workEndTime}`)
        }
      } catch (e) {
        console.error('Error parsing workEndTime:', e)
        workEndTime = defaultWorkEnd
      }
    }

    const standardWorkMinutes = Math.floor(
      (workEndTime.getTime() - workStartTime.getTime()) / (1000 * 60)
    ) - (companySettings?.standardBreakMinutes || 60)

    // シフト情報を取得（日付と従業員IDでマッチング用）
    // 全従業員のシフトを取得（employeeIdが指定されていない場合も含む）
    const shiftWhere: any = {
      companyId: effectiveCompanyId,
      date: {
        gte: start,
        lte: end,
      },
    }
    // employeeIdが指定されている場合はフィルタリング、指定されていない場合は全従業員のシフトを取得
    if (employeeId) {
      shiftWhere.employeeId = employeeId
    } else {
      // 全従業員のシフトを取得するため、employeeIdのフィルタは追加しない
      // ただし、attendancesに含まれる従業員のシフトのみを取得する
      const employeeIds = [...new Set(attendances.map(a => a.employeeId))]
      if (employeeIds.length > 0) {
        shiftWhere.employeeId = { in: employeeIds }
      }
    }
    
    const shifts = await prisma.shift.findMany({
      where: shiftWhere,
      select: {
        employeeId: true,
        date: true,
        startTime: true,
        endTime: true,
        breakMinutes: true,
      },
    })
    
    // シフト情報を日付と従業員IDでマップ
    const shiftMap: Map<string, any> = new Map()
    shifts.forEach((shift) => {
      // 日付を文字列に変換（タイムゾーンの問題を回避）
      let dateStr: string
      const shiftDate = shift.date as any
      if (shiftDate instanceof Date) {
        // UTC日付として扱う場合
        const year = shiftDate.getUTCFullYear()
        const month = String(shiftDate.getUTCMonth() + 1).padStart(2, '0')
        const day = String(shiftDate.getUTCDate()).padStart(2, '0')
        dateStr = `${year}-${month}-${day}`
      } else if (typeof shiftDate === 'string') {
        // 文字列の場合
        dateStr = shiftDate.split('T')[0]
      } else {
        // Dateオブジェクトとして扱う
        const dateObj = new Date(shiftDate)
        const year = dateObj.getUTCFullYear()
        const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0')
        const day = String(dateObj.getUTCDate()).padStart(2, '0')
        dateStr = `${year}-${month}-${day}`
      }
      const key = `${shift.employeeId}_${dateStr}`
      shiftMap.set(key, shift)
    })

    attendances.forEach((attendance) => {
      if (!attendance.clockIn || !attendance.clockOut) {
        return // 出勤・退勤が揃っていない場合はスキップ
      }

      const empId = attendance.employeeId
      if (!employeeReports[empId]) {
        employeeReports[empId] = {
          employee: attendance.employee,
          totalWorkDays: 0,
          totalWorkMinutes: 0,
          totalOvertimeMinutes: 0,
          totalBreakMinutes: 0,
          attendances: [],
          locationName: null,
        }
      }
      
      // 従業員のworkLocation（店舗名）を優先して使用
      // 従業員テーブルにworkLocationが設定されている場合はそれを使用
      if (attendance.employee.workLocation && !employeeReports[empId].locationName) {
        employeeReports[empId].locationName = attendance.employee.workLocation
      }

      const report = employeeReports[empId]

      // 打刻時刻を取得（PrismaのTime型はDateオブジェクトとして返される）
      let clockInTime: Date
      let clockOutTime: Date
      
      // 時刻を文字列として取得（UTC時間を考慮しない）
      let clockInStr: string
      let clockOutStr: string
      
      if (attendance.clockIn instanceof Date) {
        // Date型の場合、UTC時間ではなくローカル時間として扱う
        // PrismaのTime型は時刻のみを保持しているため、UTCとして解釈される可能性がある
        // 時刻文字列を直接取得
        const timeStr = attendance.clockIn.toISOString().split('T')[1]?.split('.')[0] || ''
        if (timeStr) {
          clockInStr = timeStr
        } else {
          // ISO形式で取得できない場合は、UTC時間からJSTに変換（+9時間）
          const utcHours = attendance.clockIn.getUTCHours()
          const utcMinutes = attendance.clockIn.getUTCMinutes()
          const utcSeconds = attendance.clockIn.getUTCSeconds()
          // JSTに変換（+9時間）
          const jstHours = (utcHours + 9) % 24
          clockInStr = `${String(jstHours).padStart(2, '0')}:${String(utcMinutes).padStart(2, '0')}:${String(utcSeconds).padStart(2, '0')}`
        }
      } else if (typeof attendance.clockIn === 'string') {
        clockInStr = attendance.clockIn
      } else {
        return // 無効なデータはスキップ
      }

      if (attendance.clockOut instanceof Date) {
        const timeStr = attendance.clockOut.toISOString().split('T')[1]?.split('.')[0] || ''
        if (timeStr) {
          clockOutStr = timeStr
        } else {
          const utcHours = attendance.clockOut.getUTCHours()
          const utcMinutes = attendance.clockOut.getUTCMinutes()
          const utcSeconds = attendance.clockOut.getUTCSeconds()
          const jstHours = (utcHours + 9) % 24
          clockOutStr = `${String(jstHours).padStart(2, '0')}:${String(utcMinutes).padStart(2, '0')}:${String(utcSeconds).padStart(2, '0')}`
        }
      } else if (typeof attendance.clockOut === 'string') {
        clockOutStr = attendance.clockOut
      } else {
        return // 無効なデータはスキップ
      }
      
      // 文字列から時刻を抽出してDateオブジェクトを作成
      const [inHours, inMinutes, inSeconds] = clockInStr.split(':').map(Number)
      const [outHours, outMinutes, outSeconds] = clockOutStr.split(':').map(Number)
      clockInTime = new Date(`2000-01-01T${String(inHours).padStart(2, '0')}:${String(inMinutes).padStart(2, '0')}:${String(inSeconds || 0).padStart(2, '0')}`)
      clockOutTime = new Date(`2000-01-01T${String(outHours).padStart(2, '0')}:${String(outMinutes).padStart(2, '0')}:${String(outSeconds || 0).padStart(2, '0')}`)
      
      // 終了時刻が開始時刻より小さい場合は翌日とみなす
      if (clockOutTime.getTime() < clockInTime.getTime()) {
        clockOutTime = new Date(`2000-01-02T${String(outHours).padStart(2, '0')}:${String(outMinutes).padStart(2, '0')}:${String(outSeconds || 0).padStart(2, '0')}`)
      }
      
      // 総勤務時間を計算
      const diffMs = clockOutTime.getTime() - clockInTime.getTime()
      const totalWorkMinutes = Math.floor(diffMs / (1000 * 60))
      
      // 休憩時間を計算（6時間以上は1時間休憩）
      let breakMinutes = attendance.breakMinutes || 0
      if (breakMinutes === 0 && totalWorkMinutes >= 6 * 60) {
        breakMinutes = 60 // 6時間以上の場合は自動的に60分の休憩
      }
      
      // 実働時間を計算（休憩時間を控除）
      const netWorkMinutes = Math.max(0, totalWorkMinutes - breakMinutes)
      
      // シフト情報を取得
      // 日付を文字列に変換（タイムゾーンの問題を回避）
      let attendanceDateStr: string
      const attendanceDate = attendance.date as any
      if (attendanceDate instanceof Date) {
        // UTC日付として扱う場合
        const year = attendanceDate.getUTCFullYear()
        const month = String(attendanceDate.getUTCMonth() + 1).padStart(2, '0')
        const day = String(attendanceDate.getUTCDate()).padStart(2, '0')
        attendanceDateStr = `${year}-${month}-${day}`
      } else if (typeof attendanceDate === 'string') {
        // 文字列の場合
        attendanceDateStr = attendanceDate.split('T')[0]
      } else {
        // Dateオブジェクトとして扱う
        const dateObj = new Date(attendanceDate)
        const year = dateObj.getUTCFullYear()
        const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0')
        const day = String(dateObj.getUTCDate()).padStart(2, '0')
        attendanceDateStr = `${year}-${month}-${day}`
      }
      const shiftKey = `${attendance.employeeId}_${attendanceDateStr}`
      const shift = shiftMap.get(shiftKey)

      // 残業時間の計算
      let basicMinutes: number
      let overtimeMinutes: number
      
      // シフトが登録されている場合のみシフト時間を使用
      if (shift?.startTime && shift?.endTime) {
        // シフト開始時間・終了時間を取得
        let shiftStartTime = workStartTime
        let shiftEndTime = workEndTime
        
        try {
          if (shift.startTime instanceof Date) {
            // UTC時間として取得（シフト登録時と同じ方法）
            const hours = shift.startTime.getUTCHours()
            const minutes = shift.startTime.getUTCMinutes()
            shiftStartTime = new Date(`2000-01-01T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`)
          } else if (typeof shift.startTime === 'string') {
            shiftStartTime = new Date(`2000-01-01T${shift.startTime}`)
          }
        } catch (e) {
          console.error('Error parsing shift startTime:', e)
        }
        
        try {
          if (shift.endTime instanceof Date) {
            // UTC時間として取得（シフト登録時と同じ方法）
            const hours = shift.endTime.getUTCHours()
            const minutes = shift.endTime.getUTCMinutes()
            shiftEndTime = new Date(`2000-01-01T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`)
          } else if (typeof shift.endTime === 'string') {
            shiftEndTime = new Date(`2000-01-01T${shift.endTime}`)
          }
        } catch (e) {
          console.error('Error parsing shift endTime:', e)
        }
        
        // clockInTimeとclockOutTimeの日付基準に合わせる
        const clockInDate = clockInTime.getDate()
        const clockInMonth = clockInTime.getMonth()
        const clockInYear = clockInTime.getFullYear()
        const clockOutDate = clockOutTime.getDate()
        const clockOutMonth = clockOutTime.getMonth()
        const clockOutYear = clockOutTime.getFullYear()
        
        // shiftStartTimeとshiftEndTimeをclockInTimeと同じ日付基準で作成
        const shiftStartHours = shiftStartTime.getHours()
        const shiftStartMinutes = shiftStartTime.getMinutes()
        const shiftEndHours = shiftEndTime.getHours()
        const shiftEndMinutes = shiftEndTime.getMinutes()
        
        let shiftStartTimeForCalc = new Date(clockInYear, clockInMonth, clockInDate, shiftStartHours, shiftStartMinutes)
        let shiftEndTimeForCalc = new Date(clockInYear, clockInMonth, clockInDate, shiftEndHours, shiftEndMinutes)
        
        // シフト終了時刻が開始時刻より前の場合（翌日にまたがるシフト）は1日加算
        if (shiftEndTimeForCalc.getTime() < shiftStartTimeForCalc.getTime()) {
          shiftEndTimeForCalc = new Date(shiftEndTimeForCalc.getTime() + 24 * 60 * 60 * 1000)
        }
        
        // シフト勤務時間を計算
        const shiftBreakMinutes = shift?.breakMinutes || companySettings?.standardBreakMinutes || 60
        const shiftWorkMinutes = Math.floor(
          (shiftEndTimeForCalc.getTime() - shiftStartTimeForCalc.getTime()) / (1000 * 60)
        ) - shiftBreakMinutes
        
        if (!allowPreOvertime) {
          // 前残業を認めない場合：シフト開始時刻より前の時間は残業としてカウントしない
          // シフト終了時刻より後の時間のみを残業としてカウント
          
          // shiftEndTimeForCalcの日付をclockOutTimeの日付に調整
          // shiftEndTimeForCalcは既にclockInTimeの日付基準で作成されているが、
          // postWorkMinutesを計算する際はclockOutTimeの日付基準で比較する必要がある
          
          // shiftEndTimeForCalcから時刻を取得
          const shiftEndTimeForCalcHours = shiftEndTimeForCalc.getHours()
          const shiftEndTimeForCalcMinutes = shiftEndTimeForCalc.getMinutes()
          
          // shiftEndTimeForCalcをclockOutTimeの日付基準で作成
          let shiftEndTimeForPostCalc = new Date(clockOutYear, clockOutMonth, clockOutDate, shiftEndTimeForCalcHours, shiftEndTimeForCalcMinutes)
          
          // shiftEndTimeForCalcが既に日をまたぐシフトとして1日加算されている場合、
          // shiftEndTimeForPostCalcもclockOutTime基準で1日加算する必要がある
          // shiftEndTimeとshiftStartTimeを比較して、シフトが日をまたぐかどうかを判断
          if (shiftEndTime.getTime() < shiftStartTime.getTime()) {
            // シフトが日をまたぐ場合、shiftEndTimeForPostCalcをclockOutTime基準で翌日に設定
            shiftEndTimeForPostCalc = new Date(clockOutYear, clockOutMonth, clockOutDate + 1, shiftEndTimeForCalcHours, shiftEndTimeForCalcMinutes)
          }
          
          // シフト開始時刻より前の時間を計算（clockInTimeと同じ日付基準で比較）
          const preWorkMinutes = Math.max(0, Math.floor((shiftStartTimeForCalc.getTime() - clockInTime.getTime()) / (1000 * 60)))
          
          // シフト終了時刻より後の時間を計算（clockOutTimeと同じ日付基準で比較）
          const postWorkMinutes = Math.max(0, Math.floor((clockOutTime.getTime() - shiftEndTimeForPostCalc.getTime()) / (1000 * 60)))
          
          // 実働時間から前残業分を除外
          const adjustedNetWorkMinutes = Math.max(0, netWorkMinutes - preWorkMinutes)
          
          // 基本時間はシフト勤務時間まで
          basicMinutes = Math.min(adjustedNetWorkMinutes, shiftWorkMinutes)
          
          // 残業時間はシフト終了時刻より後の時間のみ（前残業は含めない）
          overtimeMinutes = postWorkMinutes
        } else {
          // 前残業を認める場合：従来通り、シフト勤務時間を超えた分が残業時間
          basicMinutes = Math.min(Math.max(0, netWorkMinutes), shiftWorkMinutes)
          overtimeMinutes = Math.max(0, netWorkMinutes - shiftWorkMinutes)
        }
      } else {
        // シフトが登録されていない場合：標準時間（8時間）を使用
        const standardWorkMinutes = 8 * 60 // 8時間
        basicMinutes = Math.min(Math.max(0, netWorkMinutes), standardWorkMinutes)
        overtimeMinutes = Math.max(0, netWorkMinutes - standardWorkMinutes)
      }

      report.totalWorkDays++
      report.totalWorkMinutes += netWorkMinutes
      report.totalOvertimeMinutes += overtimeMinutes
      report.totalBreakMinutes += breakMinutes
      
      // 時刻を文字列形式で返すために変換（既に取得したclockInStrとclockOutStrを使用）
      const formatTimeForResponse = (time: Date | string | null, fallbackStr?: string): string | null => {
        if (!time && !fallbackStr) return null
        // 既に取得した文字列がある場合はそれを使用
        if (fallbackStr) return fallbackStr
        if (typeof time === 'string') {
          return time
        }
        if (time instanceof Date) {
          const timeStr = time.toISOString().split('T')[1]?.split('.')[0] || ''
          if (timeStr) {
            return timeStr
          }
          const utcHours = time.getUTCHours()
          const utcMinutes = time.getUTCMinutes()
          const utcSeconds = time.getUTCSeconds()
          const jstHours = (utcHours + 9) % 24
          return `${String(jstHours).padStart(2, '0')}:${String(utcMinutes).padStart(2, '0')}:${String(utcSeconds).padStart(2, '0')}`
        }
        return null
      }
      
      report.attendances.push({
        ...attendance,
        clockIn: formatTimeForResponse(attendance.clockIn, clockInStr),
        clockOut: formatTimeForResponse(attendance.clockOut, clockOutStr),
        wakeUpTime: formatTimeForResponse(attendance.wakeUpTime),
        departureTime: formatTimeForResponse(attendance.departureTime),
      })
    })

    // 配列形式に変換
    const reports = Object.values(employeeReports).map((report) => ({
      employee: {
        ...report.employee,
        locationName: report.locationName, // 店舗名を追加
      },
      totalWorkDays: report.totalWorkDays,
      totalWorkHours: Math.floor(report.totalWorkMinutes / 60),
      totalWorkMinutes: report.totalWorkMinutes % 60,
      totalOvertimeHours: Math.floor(report.totalOvertimeMinutes / 60),
      totalOvertimeMinutes: report.totalOvertimeMinutes % 60,
      totalBreakMinutes: report.totalBreakMinutes,
      overtime40Hours: Math.floor(
        Math.max(0, report.totalOvertimeMinutes - overtimeThreshold40 * 60) / 60
      ),
      overtime60Hours: Math.floor(
        Math.max(0, report.totalOvertimeMinutes - overtimeThreshold60 * 60) / 60
      ),
      attendances: report.attendances,
    }))

    return NextResponse.json({
      reports,
      period: {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
      },
    })
  } catch (error: any) {
    console.error('[Reports] Error:', error?.message)
    // セキュリティ: エラーの詳細を返さない
    return NextResponse.json(
      { 
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}

