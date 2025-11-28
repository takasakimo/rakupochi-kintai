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
        companyId: session.user.companyId,
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

    return NextResponse.json({ attendances })
  } catch (error) {
    console.error('Get attendance history error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

