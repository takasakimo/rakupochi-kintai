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
    const month = searchParams.get('month') || new Date().toISOString().slice(0, 7)

    // 管理者は他の従業員のデータも閲覧可能
    if (
      session.user.role !== 'admin' &&
      employeeId !== parseInt(session.user.id)
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const [year, monthNum] = month.split('-').map(Number)
    const startDate = new Date(year, monthNum - 1, 1)
    const endDate = new Date(year, monthNum, 0)

    const attendances = await prisma.attendance.findMany({
      where: {
        companyId: session.user.companyId!,
        employeeId,
        date: {
          gte: startDate,
          lte: endDate,
        },
        isDeleted: { not: true },
      },
      orderBy: {
        date: 'desc',
      },
    })

    // 時刻データを文字列形式に変換（管理者側と同じロジック）
    const formattedAttendances = attendances.map((attendance) => {
      const formatTime = (time: Date | null): string | null => {
        if (!time) return null
        try {
          // Date型の場合
          if (time instanceof Date) {
            // 無効な日付（1970年1月1日以前）をチェック
            if (isNaN(time.getTime()) || time.getTime() < 0) {
              return null
            }
            // 1970-01-01T00:00:00.000Z のようなデフォルト値も無効とみなす
            const epochTime = new Date('1970-01-01T00:00:00.000Z').getTime()
            if (Math.abs(time.getTime() - epochTime) < 1000) {
              return null
            }
            const hours = time.getHours().toString().padStart(2, '0')
            const minutes = time.getMinutes().toString().padStart(2, '0')
            const seconds = time.getSeconds().toString().padStart(2, '0')
            return `${hours}:${minutes}:${seconds}`
          }
          return null
        } catch (e) {
          console.error('[Attendance History] Error formatting time:', e)
          return null
        }
      }

      return {
        ...attendance,
        wakeUpTime: formatTime(attendance.wakeUpTime),
        departureTime: formatTime(attendance.departureTime),
        clockIn: formatTime(attendance.clockIn),
        clockOut: formatTime(attendance.clockOut),
      }
    })

    return NextResponse.json({ attendances: formattedAttendances })
  } catch (error) {
    console.error('Get attendance history error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

