import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// 従業員用お知らせ一覧取得
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 従業員のみアクセス可能
    if (session.user.role !== 'employee') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const companyId = session.user.companyId
    if (!companyId) {
      return NextResponse.json({ error: 'Company ID not found' }, { status: 400 })
    }

    // 公開中のお知らせのみ取得
    const announcements = await prisma.announcement.findMany({
      where: {
        companyId,
        isActive: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10, // 最新10件
    })

    return NextResponse.json({ announcements })
  } catch (error: any) {
    console.error('[Employee Announcements] GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message },
      { status: 500 }
    )
  }
}
