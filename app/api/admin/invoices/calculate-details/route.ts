import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// 請求書明細の自動計算
export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { employeeIds, periodStart, periodEnd, billingClientId } = body

    if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
      return NextResponse.json(
        { error: '従業員IDは必須です' },
        { status: 400 }
      )
    }

    if (!periodStart || !periodEnd) {
      return NextResponse.json(
        { error: '請求期間は必須です' },
        { status: 400 }
      )
    }

    // 請求先企業を取得（消費税率を取得するため）
    const billingClient = billingClientId 
      ? await prisma.billingClient.findFirst({
          where: {
            id: parseInt(billingClientId),
            companyId: effectiveCompanyId,
          },
        })
      : null

    const taxRate = billingClient?.taxRate || 0.1

    // 企業設定を取得
    const companySettings = await prisma.companySetting.findUnique({
      where: { companyId: effectiveCompanyId },
    })

    const allowPreOvertime = companySettings?.allowPreOvertime || false
    const standardBreakMinutes = companySettings?.standardBreakMinutes || 60
    const workStartTime = companySettings?.workStartTime
    const workEndTime = companySettings?.workEndTime

    // 請求期間の日付範囲を設定
    const startDate = new Date(periodStart)
    startDate.setHours(0, 0, 0, 0)
    const endDate = new Date(periodEnd)
    endDate.setHours(23, 59, 59, 999)

    // 従業員情報を取得
    const employees = await prisma.employee.findMany({
      where: {
        id: { in: employeeIds.map((id: any) => parseInt(id)) },
        companyId: effectiveCompanyId,
      },
      select: {
        id: true,
        name: true,
        employeeNumber: true,
        billingRate: true,
        billingRateType: true,
        overtimeRate: true,
        hasOvertime: true,
        baseWorkDays: true,
      },
    })

    // シフトデータを取得
    const shifts = await prisma.shift.findMany({
      where: {
        companyId: effectiveCompanyId,
        employeeId: { in: employeeIds.map((id: any) => parseInt(id)) },
        date: {
          gte: startDate,
          lte: endDate,
        },
        isPublicHoliday: false, // 公休は除外
      },
    })

    // シフトマップを作成（employeeId_date形式）
    const shiftMap = new Map<string, typeof shifts[0]>()
    shifts.forEach((shift) => {
      const dateStr = shift.date instanceof Date 
        ? shift.date.toISOString().split('T')[0]
        : new Date(shift.date).toISOString().split('T')[0]
      const key = `${shift.employeeId}_${dateStr}`
      shiftMap.set(key, shift)
    })

    // 打刻データを取得
    const attendances = await prisma.attendance.findMany({
      where: {
        companyId: effectiveCompanyId,
        employeeId: { in: employeeIds.map((id: any) => parseInt(id)) },
        date: {
          gte: startDate,
          lte: endDate,
        },
        isDeleted: false,
      },
    })

    // 明細を生成
    const details: any[] = []

    for (const employee of employees) {
      const employeeAttendances = attendances.filter(a => a.employeeId === employee.id)
      
      let workDays = 0
      let totalBasicMinutes = 0
      let totalOvertimeMinutes = 0
      let absenceDays = 0
      let totalLateEarlyMinutes = 0 // 遅刻・早退の合計時間（分）

      // 請求期間内の各日をチェック
      const currentDate = new Date(startDate)
      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0]
        const shiftKey = `${employee.id}_${dateStr}`
        const shift = shiftMap.get(shiftKey)
        const attendance = employeeAttendances.find(a => {
          const attDateStr = a.date instanceof Date
            ? a.date.toISOString().split('T')[0]
            : new Date(a.date).toISOString().split('T')[0]
          return attDateStr === dateStr
        })

        // シフトがある日のみカウント
        if (shift) {
          if (attendance && attendance.clockIn && attendance.clockOut) {
            // 打刻がある場合：勤務日としてカウント
            workDays++

            // 打刻時刻を取得
            let clockInTime: Date
            let clockOutTime: Date

            if (attendance.clockIn instanceof Date) {
              const timeStr = attendance.clockIn.toISOString().split('T')[1]?.split('.')[0] || ''
              const [hours, minutes] = timeStr.split(':').map(Number)
              clockInTime = new Date(`2000-01-01T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`)
            } else {
              const [hours, minutes] = (attendance.clockIn as string).split(':').map(Number)
              clockInTime = new Date(`2000-01-01T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`)
            }

            if (attendance.clockOut instanceof Date) {
              const timeStr = attendance.clockOut.toISOString().split('T')[1]?.split('.')[0] || ''
              const [hours, minutes] = timeStr.split(':').map(Number)
              clockOutTime = new Date(`2000-01-01T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`)
            } else {
              const [hours, minutes] = (attendance.clockOut as string).split(':').map(Number)
              clockOutTime = new Date(`2000-01-01T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`)
            }

            // 終了時刻が開始時刻より小さい場合は翌日とみなす
            if (clockOutTime.getTime() < clockInTime.getTime()) {
              clockOutTime = new Date(clockOutTime.getTime() + 24 * 60 * 60 * 1000)
            }

            // 総勤務時間を計算
            const totalWorkMinutes = Math.floor(
              (clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60)
            )

            // 休憩時間を計算
            let breakMinutes = attendance.breakMinutes || 0
            if (breakMinutes === 0 && totalWorkMinutes >= 6 * 60) {
              breakMinutes = standardBreakMinutes
            }

            // 実働時間を計算
            const netWorkMinutes = Math.max(0, totalWorkMinutes - breakMinutes)

            // シフト時間を取得
            let shiftStartTime: Date
            let shiftEndTime: Date

            if (!shift.startTime || !shift.endTime) {
              // シフト時間が設定されていない場合はスキップ
              continue
            }

            // startTimeの処理
            const startTimeValue = shift.startTime as Date | string | null
            if (startTimeValue instanceof Date) {
              const hours = startTimeValue.getUTCHours()
              const minutes = startTimeValue.getUTCMinutes()
              shiftStartTime = new Date(`2000-01-01T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`)
            } else if (typeof startTimeValue === 'string') {
              const [hours, minutes] = startTimeValue.split(':').map(Number)
              shiftStartTime = new Date(`2000-01-01T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`)
            } else {
              continue
            }

            // endTimeの処理
            const endTimeValue = shift.endTime as Date | string | null
            if (endTimeValue instanceof Date) {
              const hours = endTimeValue.getUTCHours()
              const minutes = endTimeValue.getUTCMinutes()
              shiftEndTime = new Date(`2000-01-01T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`)
            } else if (typeof endTimeValue === 'string') {
              const [hours, minutes] = endTimeValue.split(':').map(Number)
              shiftEndTime = new Date(`2000-01-01T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`)
            } else {
              continue
            }

            // シフト終了時刻が開始時刻より前の場合（翌日にまたがるシフト）は1日加算
            if (shiftEndTime.getTime() < shiftStartTime.getTime()) {
              shiftEndTime = new Date(shiftEndTime.getTime() + 24 * 60 * 60 * 1000)
            }

            // シフト勤務時間を計算
            const shiftBreakMinutes = shift.breakMinutes || standardBreakMinutes
            const shiftWorkMinutes = Math.floor(
              (shiftEndTime.getTime() - shiftStartTime.getTime()) / (1000 * 60)
            ) - shiftBreakMinutes

            // 基本時間と残業時間を計算
            let basicMinutes: number
            let overtimeMinutes: number

            if (allowPreOvertime) {
              // 前残業を認める場合：シフト勤務時間を超えた分が残業時間
              basicMinutes = Math.min(Math.max(0, netWorkMinutes), shiftWorkMinutes)
              overtimeMinutes = Math.max(0, netWorkMinutes - shiftWorkMinutes)
            } else {
              // 前残業を認めない場合：シフト開始時刻より前は前残業、シフト終了時刻より後は残業
              const clockInYear = clockInTime.getFullYear()
              const clockInMonth = clockInTime.getMonth()
              const clockInDate = clockInTime.getDate()
              const shiftStartTimeForCalc = new Date(clockInYear, clockInMonth, clockInDate, shiftStartTime.getHours(), shiftStartTime.getMinutes())
              const shiftEndTimeForPostCalc = new Date(clockInYear, clockInMonth, clockInDate, shiftEndTime.getHours(), shiftEndTime.getMinutes())
              
              if (shiftEndTimeForPostCalc.getTime() < shiftStartTimeForCalc.getTime()) {
                shiftEndTimeForPostCalc.setDate(shiftEndTimeForPostCalc.getDate() + 1)
              }

              const preWorkMinutes = Math.max(0, Math.floor((shiftStartTimeForCalc.getTime() - clockInTime.getTime()) / (1000 * 60)))
              const postWorkMinutes = Math.max(0, Math.floor((clockOutTime.getTime() - shiftEndTimeForPostCalc.getTime()) / (1000 * 60)))
              
              const adjustedNetWorkMinutes = Math.max(0, netWorkMinutes - preWorkMinutes)
              basicMinutes = Math.min(adjustedNetWorkMinutes, shiftWorkMinutes)
              overtimeMinutes = postWorkMinutes
            }

            totalBasicMinutes += basicMinutes
            if (employee.hasOvertime) {
              totalOvertimeMinutes += overtimeMinutes
            }

            // 遅刻・早退の判定（15分単位で計算）
            const lateMinutes = Math.max(0, Math.floor((clockInTime.getTime() - shiftStartTime.getTime()) / (1000 * 60)))
            const earlyLeaveMinutes = Math.max(0, Math.floor((shiftEndTime.getTime() - clockOutTime.getTime()) / (1000 * 60)))
            
            // 15分単位に切り上げ（15分未満は0、15分以上は15分単位で切り上げ）
            const lateMinutesRounded = lateMinutes >= 15 ? Math.ceil(lateMinutes / 15) * 15 : 0
            const earlyLeaveMinutesRounded = earlyLeaveMinutes >= 15 ? Math.ceil(earlyLeaveMinutes / 15) * 15 : 0
            
            // 遅刻・早退の合計時間（15分単位）を累積
            totalLateEarlyMinutes += lateMinutesRounded + earlyLeaveMinutesRounded
          } else {
            // シフトがあるが打刻がない場合：欠勤
            absenceDays++
          }
        }

        currentDate.setDate(currentDate.getDate() + 1)
      }

      // 従業員の請求単価を取得
      const billingRate = employee.billingRate || 0
      const billingRateType = employee.billingRateType || 'daily'
      const overtimeRate = employee.overtimeRate || 1.25

      // 基本金額を計算（請求単価タイプに応じて）
      let basicAmount = 0
      let dailyRate = 0 // 欠勤減算用の日額換算

      if (billingRateType === 'hourly') {
        // 時給の場合：基本時間（分）を時間に変換して計算
        basicAmount = Math.round((totalBasicMinutes / 60) * billingRate)
        // 欠勤減算用：1日8時間として日額を計算
        dailyRate = billingRate * 8
      } else if (billingRateType === 'daily') {
        // 日給の場合：勤務日数 × 単価
        basicAmount = Math.round(workDays * billingRate)
        dailyRate = billingRate
      } else if (billingRateType === 'monthly') {
        // 月給の場合：実際の勤務日数で按分（月間の標準稼働日数で割る）
        // baseWorkDaysが設定されている場合はそれを使用、なければ22日をデフォルトとする
        const standardWorkDays = employee.baseWorkDays || 22
        basicAmount = Math.round((billingRate / standardWorkDays) * workDays)
        // 欠勤減算用：月給を標準稼働日数で割った日額
        dailyRate = billingRate / standardWorkDays
      } else {
        // デフォルトは日給として計算
        basicAmount = Math.round(workDays * billingRate)
        dailyRate = billingRate
      }

      // 残業金額を計算（時給ベースで計算）
      const overtimeHours = employee.hasOvertime ? totalOvertimeMinutes / 60 : 0
      let overtimeAmount = 0
      if (employee.hasOvertime && overtimeHours > 0) {
        if (billingRateType === 'hourly') {
          // 時給の場合：残業時間 × 時給 × 倍率
          overtimeAmount = Math.round(overtimeHours * billingRate * overtimeRate)
        } else if (billingRateType === 'daily') {
          // 日給の場合：残業時間 × (日給 / 8時間) × 倍率
          overtimeAmount = Math.round(overtimeHours * (billingRate / 8) * overtimeRate)
        } else if (billingRateType === 'monthly') {
          // 月給の場合：残業時間 × (月給 / 標準稼働日数 / 8時間) × 倍率
          const standardWorkDays = employee.baseWorkDays || 22
          overtimeAmount = Math.round(overtimeHours * (billingRate / standardWorkDays / 8) * overtimeRate)
        }
      }

      // 欠勤減算額を計算（欠勤1日あたり日額換算を減算）
      const absenceDeduction = Math.round(absenceDays * dailyRate)

      // 遅刻・早退減算額を計算（15分単位、請求単価タイプに応じて）
      let lateEarlyDeduction = 0
      if (totalLateEarlyMinutes > 0) {
        // 15分単位の時間を時間に変換
        const lateEarlyHours = totalLateEarlyMinutes / 60
        
        if (billingRateType === 'hourly') {
          // 時給の場合：遅刻・早退時間 × 時給
          lateEarlyDeduction = Math.round(lateEarlyHours * billingRate)
        } else if (billingRateType === 'daily') {
          // 日給の場合：遅刻・早退時間 × (日給 / 8時間)
          lateEarlyDeduction = Math.round(lateEarlyHours * (billingRate / 8))
        } else if (billingRateType === 'monthly') {
          // 月給の場合：遅刻・早退時間 × (月給 / 標準稼働日数 / 8時間)
          const standardWorkDays = employee.baseWorkDays || 22
          lateEarlyDeduction = Math.round(lateEarlyHours * (billingRate / standardWorkDays / 8))
        } else {
          // デフォルトは日給として計算
          lateEarlyDeduction = Math.round(lateEarlyHours * (billingRate / 8))
        }
      }

      // 小計を計算
      const subtotal = basicAmount + overtimeAmount - absenceDeduction - lateEarlyDeduction

      details.push({
        employeeId: employee.id,
        workDays,
        basicRate: billingRate,
        basicAmount,
        overtimeHours: overtimeHours > 0 ? parseFloat(overtimeHours.toFixed(2)) : 0,
        overtimeRate: employee.hasOvertime ? overtimeRate : null,
        overtimeAmount: overtimeAmount > 0 ? overtimeAmount : 0,
        absenceDays,
        absenceDeduction: absenceDeduction > 0 ? absenceDeduction : 0,
        lateEarlyDeduction: lateEarlyDeduction > 0 ? lateEarlyDeduction : 0,
        subtotal: Math.max(0, subtotal), // マイナスにならないように
      })
    }

    // 合計金額を計算
    const subtotal = details.reduce((sum, detail) => sum + detail.subtotal, 0)
    const taxAmount = Math.round(subtotal * taxRate)
    const totalAmount = subtotal + taxAmount

    return NextResponse.json({
      success: true,
      details,
      subtotal,
      taxAmount,
      totalAmount,
    })
  } catch (error: any) {
    console.error('Failed to calculate invoice details:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message },
      { status: 500 }
    )
  }
}
