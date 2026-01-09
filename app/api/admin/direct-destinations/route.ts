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

    const shifts = await prisma.shift.findMany({
      where: {
        companyId: session.user.companyId!,
        directDestination: {
          not: null,
        },
      },
      select: {
        directDestination: true,
      },
      distinct: ['directDestination'],
    })

    const directDestinations = shifts
      .map((shift) => shift.directDestination)
      .filter((dest): dest is string => dest !== null && dest.trim() !== '')
      .sort()

    return NextResponse.json({ directDestinations })
  } catch (error) {
    console.error('Failed to fetch direct destinations:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

