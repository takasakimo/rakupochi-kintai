import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// 通知一覧取得
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const isRead = searchParams.get('is_read')
    const employeeId = searchParams.get('employee_id')

    const where: any = {}

    // 管理者は全従業員の通知を取得可能、従業員は自分のみ
    if (session.user.role === 'admin') {
      if (employeeId) {
        where.employeeId = parseInt(employeeId)
      } else {
        // 全従業員の通知を取得
        const employees = await prisma.employee.findMany({
          where: { companyId: session.user.companyId! },
          select: { id: true },
        })
        where.employeeId = {
          in: employees.map((e) => e.id),
        }
      }
    } else {
      where.employeeId = parseInt(session.user.id)
    }

    if (isRead !== null) {
      where.isRead = isRead === 'true'
    }

    const notifications = await prisma.notification.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            employeeNumber: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100, // 最新100件
    })

    return NextResponse.json({ notifications })
  } catch (error) {
    console.error('Get notifications error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

