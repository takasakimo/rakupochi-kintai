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

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // 今日の訪問履歴を取得
    const visits = await prisma.salesVisit.findMany({
      where: {
        companyId: session.user.companyId!,
        employeeId: parseInt(session.user.id),
        date: today,
      },
      orderBy: {
        entryTime: 'desc',
      },
    })

    // 時刻データを文字列形式に変換（通常の打刻と同じロジック）
    const formattedVisits = visits.map((visit) => {
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

      return {
        ...visit,
        entryTime: formatTime(visit.entryTime),
        exitTime: formatTime(visit.exitTime),
      }
    })

    return NextResponse.json({
      success: true,
      visits: formattedVisits,
    })
  } catch (error: any) {
    console.error('Get today sales visits error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error?.message || 'Unknown error',
      },
      { status: 500 }
    )
  }
}
