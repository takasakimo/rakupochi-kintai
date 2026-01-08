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

    const searchParams = request.nextUrl.searchParams
    const all = searchParams.get('all') === 'true'

    const locations = await prisma.location.findMany({
      where: {
        companyId: session.user.companyId,
        ...(all ? {} : { isActive: true }),
      },
      select: {
        id: true,
        name: true,
        type: true,
        address: true,
        latitude: true,
        longitude: true,
        radius: true,
        isActive: true,
      },
      orderBy: {
        name: 'asc',
      },
    })

    return NextResponse.json({ locations })
  } catch (error) {
    console.error('Failed to fetch locations:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// 店舗・事業所の作成
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { name, type, address, latitude, longitude, radius } = body

    if (!name) {
      return NextResponse.json(
        { error: '店舗名は必須です' },
        { status: 400 }
      )
    }

    const location = await prisma.location.create({
      data: {
        companyId: session.user.companyId,
        name,
        type: type || 'store',
        address: address || null,
        latitude: latitude || 0,
        longitude: longitude || 0,
        radius: radius || 500,
        isActive: true,
      },
    })

    return NextResponse.json({ success: true, location })
  } catch (error) {
    console.error('Failed to create location:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

