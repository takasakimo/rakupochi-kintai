import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// アラート生成（管理者が手動実行または定期実行）
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

    const companySettings = await prisma.companySetting.findUnique({
      where: { companyId: effectiveCompanyId },
    })

    if (!companySettings) {
      return NextResponse.json(
        { error: 'Company settings not found' },
        { status: 404 }
      )
    }

    const employees = await prisma.employee.findMany({
      where: {
        companyId: effectiveCompanyId,
        isActive: true,
      },
    })

    const generatedAlerts: any[] = []
    const now = new Date()
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    // 今月の勤怠データを取得
    const attendances = await prisma.attendance.findMany({
      where: {
        companyId: effectiveCompanyId,
        date: {
          gte: currentMonth,
          lte: endOfMonth,
        },
        isDeleted: { not: true },
      },
      orderBy: {
        date: 'asc',
      },
    })

    // 従業員ごとに処理
    for (const employee of employees) {
      const employeeAttendances = attendances.filter(
        (a) => a.employeeId === employee.id
      )

      // 1. 残業時間アラート
      let totalWorkMinutes = 0
      employeeAttendances.forEach((attendance) => {
        if (!attendance.clockIn || !attendance.clockOut) return
        const inTime = new Date(`2000-01-01T${attendance.clockIn}`)
        const outTime = new Date(`2000-01-01T${attendance.clockOut}`)
        const diffMs = outTime.getTime() - inTime.getTime()
        const diffMinutes = Math.floor(diffMs / (1000 * 60)) - (attendance.breakMinutes || 0)
        totalWorkMinutes += diffMinutes
      })

      const totalWorkHours = totalWorkMinutes / 60
      const standardMinutes = employeeAttendances.filter(
        (a) => a.clockIn && a.clockOut
      ).length * 8 * 60
      const overtimeMinutes = Math.max(0, totalWorkMinutes - standardMinutes)
      const overtimeHours = overtimeMinutes / 60

      // 60時間超残業アラート
      if (overtimeHours > companySettings.overtimeThreshold60) {
        const existingAlert = await prisma.notification.findFirst({
          where: {
            employeeId: employee.id,
            type: 'overtime_alert',
            isRead: false,
            createdAt: {
              gte: currentMonth,
            },
          },
        })

        if (!existingAlert) {
          const alert = await prisma.notification.create({
            data: {
              employeeId: employee.id,
              type: 'overtime_alert',
              title: '残業時間アラート（60時間超）',
              message: `今月の残業時間が${Math.floor(overtimeHours)}時間を超えています。労働基準法に注意してください。`,
            },
          })
          generatedAlerts.push(alert)
        }
      }
      // 40時間超残業アラート
      else if (overtimeHours > companySettings.overtimeThreshold40) {
        const existingAlert = await prisma.notification.findFirst({
          where: {
            employeeId: employee.id,
            type: 'overtime_alert',
            isRead: false,
            createdAt: {
              gte: currentMonth,
            },
          },
        })

        if (!existingAlert) {
          const alert = await prisma.notification.create({
            data: {
              employeeId: employee.id,
              type: 'overtime_alert',
              title: '残業時間アラート（40時間超）',
              message: `今月の残業時間が${Math.floor(overtimeHours)}時間を超えています。`,
            },
          })
          generatedAlerts.push(alert)
        }
      }

      // 2. 未打刻アラート（シフトが設定されているのに開始時刻を過ぎても打刻がない場合）
      const todayYear = now.getFullYear()
      const todayMonth = now.getMonth()
      const todayDay = now.getDate()
      const todayStartUTC = new Date(Date.UTC(todayYear, todayMonth, todayDay, 0, 0, 0, 0))
      const todayEndUTC = new Date(Date.UTC(todayYear, todayMonth, todayDay, 23, 59, 59, 999))
      
      // 今日のシフトを取得
      const todayShift = await prisma.shift.findFirst({
        where: {
          companyId: effectiveCompanyId,
          employeeId: employee.id,
          date: {
            gte: todayStartUTC,
            lte: todayEndUTC,
          },
          isPublicHoliday: false, // 公休は除外
        },
      })

      // シフトが存在し、開始時刻が設定されている場合
      if (todayShift && todayShift.startTime) {
        const todayAttendance = employeeAttendances.find(
          (a) => {
            const attendanceDate = new Date(a.date)
            return attendanceDate.getTime() >= todayStartUTC.getTime() &&
                   attendanceDate.getTime() <= todayEndUTC.getTime()
          }
        )

        // 打刻がない場合
        if (!todayAttendance || !todayAttendance.clockIn) {
          // シフトの開始時刻を取得（Time型はUTC時間として扱われる）
          const shiftStartTime = new Date(todayShift.startTime)
          // UTC時間からローカル時間に変換
          const shiftStartHours = shiftStartTime.getUTCHours()
          const shiftStartMinutes = shiftStartTime.getUTCMinutes()
          const shiftStartTotalMinutes = shiftStartHours * 60 + shiftStartMinutes
          
          // 現在時刻を分単位で取得（ローカル時間）
          const currentMinutes = now.getHours() * 60 + now.getMinutes()
          
          // シフト開始時刻を過ぎている場合（15分の余裕を持たせる）
          if (currentMinutes >= shiftStartTotalMinutes + 15) {
            const existingAlert = await prisma.notification.findFirst({
              where: {
                employeeId: employee.id,
                type: 'attendance_missing',
                isRead: false,
                createdAt: {
                  gte: todayStartUTC,
                },
              },
            })

            if (!existingAlert) {
              const shiftStartTimeStr = `${String(shiftStartHours).padStart(2, '0')}:${String(shiftStartMinutes).padStart(2, '0')}`
              const alert = await prisma.notification.create({
                data: {
                  employeeId: employee.id,
                  type: 'attendance_missing',
                  title: '打刻忘れアラート',
                  message: `本日のシフト開始時刻（${shiftStartTimeStr}）を過ぎていますが、出勤打刻が記録されていません。`,
                },
              })
              generatedAlerts.push(alert)
            }
          }
        }
      }

      // 3. 連続勤務アラート
      let consecutiveDays = 0
      let currentDate = new Date(endOfMonth)
      for (let i = 0; i < 14; i++) {
        const dateStr = currentDate.toISOString().split('T')[0]
        const attendance = employeeAttendances.find(
          (a) => a.date.toISOString().split('T')[0] === dateStr
        )
        if (attendance && attendance.clockIn && attendance.clockOut) {
          consecutiveDays++
        } else {
          break
        }
        currentDate.setDate(currentDate.getDate() - 1)
      }

      if (consecutiveDays >= companySettings.consecutiveWorkAlert) {
        const existingAlert = await prisma.notification.findFirst({
          where: {
            employeeId: employee.id,
            type: 'consecutive_work',
            isRead: false,
            createdAt: {
              gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // 過去7日以内
            },
          },
        })

        if (!existingAlert) {
          const alert = await prisma.notification.create({
            data: {
              employeeId: employee.id,
              type: 'consecutive_work',
              title: '連続勤務アラート',
              message: `${consecutiveDays}日連続で勤務しています。適切な休息を取るようにしてください。`,
            },
          })
          generatedAlerts.push(alert)
        }
      }
    }

    return NextResponse.json({
      success: true,
      generatedCount: generatedAlerts.length,
      alerts: generatedAlerts,
    })
  } catch (error) {
    console.error('Generate alerts error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

