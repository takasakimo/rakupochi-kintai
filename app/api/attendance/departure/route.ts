import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { time, date } = body

    if (!time || !date) {
      return NextResponse.json(
        { error: 'Time and date are required' },
        { status: 400 }
      )
    }

    const attendance = await prisma.attendance.upsert({
      where: {
        companyId_employeeId_date: {
          companyId: session.user.companyId,
          employeeId: parseInt(session.user.id),
          date: new Date(date),
        },
      },
      update: {
        departureTime: new Date(`2000-01-01T${time}`),
      },
      create: {
        companyId: session.user.companyId,
        employeeId: parseInt(session.user.id),
        date: new Date(date),
        departureTime: new Date(`2000-01-01T${time}`),
      },
    })

    return NextResponse.json({ success: true, attendance })
  } catch (error) {
    console.error('Departure attendance error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

