import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const employees = await prisma.employee.findMany({
      where: {
        companyId: session.user.companyId!,
        isActive: true,
        department: {
          not: null,
        },
      },
      select: {
        department: true,
      },
      distinct: ['department'],
    })

    const departments = employees
      .map((emp) => emp.department)
      .filter((dept): dept is string => dept !== null)
      .sort()

    return NextResponse.json({ departments })
  } catch (error) {
    console.error('Failed to fetch departments:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

