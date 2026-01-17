import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// 承認者選択用の管理者リスト取得（従業員もアクセス可能）
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const companyId = session.user.companyId
    if (!companyId) {
      return NextResponse.json(
        { error: 'Company ID not found' },
        { status: 400 }
      )
    }

    // 管理者のみを取得
    const admins = await prisma.employee.findMany({
      where: {
        companyId,
        role: { in: ['admin', 'super_admin'] },
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        employeeNumber: true,
        role: true,
      },
      orderBy: {
        name: 'asc',
      },
    })

    return NextResponse.json({ admins })
  } catch (error) {
    console.error('Get admins error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

