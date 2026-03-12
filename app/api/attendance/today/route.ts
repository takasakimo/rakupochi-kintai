import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const employeeId = searchParams.get('employee_id')
      ? parseInt(searchParams.get('employee_id')!)
      : parseInt(session.user.id)

    // 管理者は他の従業員のデータも閲覧可能
    if (
      session.user.role !== 'admin' &&
      employeeId !== parseInt(session.user.id)
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // クライアントから日付が渡されればそれを使用（JSTの「今日」）、なければサーバー日付
    const dateStr = searchParams.get('date')
    let todayStartUTC: Date
    let todayEndUTC: Date
    if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      todayStartUTC = new Date(`${dateStr}T00:00:00.000Z`)
      todayEndUTC = new Date(`${dateStr}T23:59:59.999Z`)
    } else {
      const now = new Date()
      const todayYear = now.getFullYear()
      const todayMonth = now.getMonth()
      const todayDay = now.getDate()
      todayStartUTC = new Date(Date.UTC(todayYear, todayMonth, todayDay, 0, 0, 0, 0))
      todayEndUTC = new Date(Date.UTC(todayYear, todayMonth, todayDay, 23, 59, 59, 999))
    }

    // 削除されていない打刻データを取得
    const attendance = await prisma.attendance.findFirst({
      where: {
        companyId: session.user.companyId!,
        employeeId,
        date: {
          gte: todayStartUTC,
          lte: todayEndUTC,
        },
        isDeleted: { not: true },
      },
    })

    // 時間フィールドを文字列形式に変換
    if (attendance) {
      const formatTime = (time: Date | null): string | null => {
        if (!time) return null
        if (time instanceof Date) {
          const hours = String(time.getUTCHours()).padStart(2, '0')
          const minutes = String(time.getUTCMinutes()).padStart(2, '0')
          const seconds = String(time.getUTCSeconds()).padStart(2, '0')
          return `${hours}:${minutes}:${seconds}`
        }
        return null
      }

      return NextResponse.json({
        attendance: {
          ...attendance,
          wakeUpTime: formatTime(attendance.wakeUpTime),
          departureTime: formatTime(attendance.departureTime),
          clockIn: formatTime(attendance.clockIn),
          clockOut: formatTime(attendance.clockOut),
        },
      })
    }

    return NextResponse.json({ attendance })
  } catch (error) {
    console.error('Get today attendance error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

