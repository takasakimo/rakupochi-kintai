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

    return NextResponse.json({
      success: true,
      visits,
    })
  } catch (error) {
    console.error('Get today sales visits error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
