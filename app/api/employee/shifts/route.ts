import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// 従業員のシフト一覧取得
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    const where: any = {
      companyId: session.user.companyId,
      employeeId: parseInt(session.user.id),
    }

    if (startDate || endDate) {
      where.date = {}
      if (startDate) {
        where.date.gte = new Date(startDate)
      }
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        where.date.lte = end
      }
    }
    // 日付範囲が指定されていない場合は全期間を取得（過去履歴も含む）

    const shifts = await prisma.shift.findMany({
      where,
      orderBy: {
        date: 'asc',
      },
    })

    // startTimeとendTimeをHH:mm形式の文字列に変換
    // 日付も文字列形式に変換（タイムゾーンの問題を回避）
    const formattedShifts = shifts.map((shift) => {
      let startTimeStr = ''
      let endTimeStr = ''
      
      // startTimeの処理
      if (shift.startTime) {
        const startTime = shift.startTime as any
        if (startTime instanceof Date) {
          const hours = startTime.getUTCHours()
          const minutes = startTime.getUTCMinutes()
          startTimeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
        } else if (typeof startTime === 'string') {
          startTimeStr = startTime.slice(0, 5)
        }
      }
      
      // endTimeの処理
      if (shift.endTime) {
        const endTime = shift.endTime as any
        if (endTime instanceof Date) {
          const hours = endTime.getUTCHours()
          const minutes = endTime.getUTCMinutes()
          endTimeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
        } else if (typeof endTime === 'string') {
          endTimeStr = endTime.slice(0, 5)
        }
      }

      // 日付を文字列形式に変換
      // 重要: PostgreSQLのDATE型はタイムゾーン情報を持たない
      // PrismaはDateTimeとして扱うが、実際の値はDATE型なので、UTCの00:00:00として解釈される
      // しかし、toISOString()を使うとUTC時間で変換されるため、JSTで見ると1日前になる可能性がある
      // 解決策: データベースから取得したDateオブジェクトのUTC日付をそのまま使用
      let dateStr = ''
      const shiftDate = shift.date as any
      if (shiftDate instanceof Date) {
        const date = shiftDate
        // UTC時間で日付を取得（データベースのDATE型はUTCの00:00:00として保存される）
        const year = date.getUTCFullYear()
        const month = date.getUTCMonth() + 1
        const day = date.getUTCDate()
        dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      } else if (typeof shiftDate === 'string') {
        dateStr = shiftDate.split('T')[0]
      }

      return {
        ...shift,
        date: dateStr,
        startTime: startTimeStr,
        endTime: endTimeStr,
        directDestination: shift.directDestination || null,
      }
    })

    return NextResponse.json({ shifts: formattedShifts })
  } catch (error) {
    console.error('Get employee shifts error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

