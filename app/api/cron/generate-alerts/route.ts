import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Cron用のアラート生成（全企業に対して自動実行）
export async function GET(request: NextRequest) {
  try {
    // Vercel Cronからのリクエストか確認
    // Vercel Cron Jobsは自動的に認証ヘッダーを付与しますが、
    // セキュリティのために環境変数での認証も可能にしています
    const authHeader = request.headers.get('authorization')
    const vercelSignature = request.headers.get('x-vercel-signature')
    const cronSecret = process.env.CRON_SECRET

    // Vercel Cronからのリクエストか、または正しい認証トークンがあるか確認
    const isVercelCron = vercelSignature !== null
    const hasValidAuth = cronSecret && authHeader === `Bearer ${cronSecret}`

    if (!isVercelCron && !hasValidAuth) {
      // 開発環境では認証をスキップ（オプション）
      if (process.env.NODE_ENV === 'development' && !cronSecret) {
        console.warn('Running in development mode without authentication')
      } else {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    // 全企業を取得
    const companies = await prisma.company.findMany({
      where: {
        isActive: true,
      },
    })

    const results = []
    const now = new Date()
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    for (const company of companies) {
      try {
        const companySettings = await prisma.companySetting.findUnique({
          where: { companyId: company.id },
        })

        if (!companySettings) {
          continue
        }

        const employees = await prisma.employee.findMany({
          where: {
            companyId: company.id,
            isActive: true,
          },
        })

        // 今月の勤怠データを取得
        const attendances = await prisma.attendance.findMany({
          where: {
            companyId: company.id,
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

        let generatedCount = 0

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
              await prisma.notification.create({
                data: {
                  employeeId: employee.id,
                  type: 'overtime_alert',
                  title: '残業時間アラート（60時間超）',
                  message: `今月の残業時間が${Math.floor(overtimeHours)}時間を超えています。労働基準法に注意してください。`,
                },
              })
              generatedCount++
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
              await prisma.notification.create({
                data: {
                  employeeId: employee.id,
                  type: 'overtime_alert',
                  title: '残業時間アラート（40時間超）',
                  message: `今月の残業時間が${Math.floor(overtimeHours)}時間を超えています。`,
                },
              })
              generatedCount++
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
              companyId: company.id,
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
                  await prisma.notification.create({
                    data: {
                      employeeId: employee.id,
                      type: 'attendance_missing',
                      title: '打刻忘れアラート',
                      message: `本日のシフト開始時刻（${shiftStartTimeStr}）を過ぎていますが、出勤打刻が記録されていません。`,
                    },
                  })
                  generatedCount++
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
              await prisma.notification.create({
                data: {
                  employeeId: employee.id,
                  type: 'consecutive_work',
                  title: '連続勤務アラート',
                  message: `${consecutiveDays}日連続で勤務しています。適切な休息を取るようにしてください。`,
                },
              })
              generatedCount++
            }
          }

          // 4. 有給失効アラート（実装予定）
          // TODO: 有給失効日の計算と通知
        }

        results.push({
          companyId: company.id,
          companyName: company.name,
          generatedCount,
        })
      } catch (error) {
        console.error(`Error processing company ${company.id}:`, error)
        results.push({
          companyId: company.id,
          companyName: company.name,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    const totalGenerated = results.reduce((sum, r) => sum + (r.generatedCount || 0), 0)

    return NextResponse.json({
      success: true,
      message: 'アラート生成が完了しました',
      totalGenerated,
      results,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Cron generate alerts error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
