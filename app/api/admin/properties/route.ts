import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function getEffectiveCompanyId(session: { user?: { role?: string; email?: string; selectedCompanyId?: number | null; companyId?: number } } | null) {
  if (!session?.user) return null
  const isSuperAdmin = session.user.role === 'super_admin' || session.user.email === 'superadmin@rakupochi.com'
  const isAdmin = session.user?.role === 'admin'
  if (!isSuperAdmin && !isAdmin) return null
  return isSuperAdmin ? session.user?.selectedCompanyId : session.user?.companyId
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const effectiveCompanyId = getEffectiveCompanyId(session as Parameters<typeof getEffectiveCompanyId>[0])
    if (!effectiveCompanyId) {
      return NextResponse.json(
        { error: session.user?.role === 'super_admin' ? '企業が選択されていません' : 'Forbidden' },
        { status: 400 }
      )
    }

    const properties = await prisma.property.findMany({
      where: { companyId: effectiveCompanyId },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ properties })
  } catch (error) {
    console.error('Failed to fetch properties:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isSuperAdmin = session.user.role === 'super_admin' || session.user.email === 'superadmin@rakupochi.com'
    const isAdmin = session.user.role === 'admin'
    if (!isSuperAdmin && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const effectiveCompanyId = isSuperAdmin ? session.user.selectedCompanyId : (session.user as { companyId?: number }).companyId
    if (!effectiveCompanyId) {
      return NextResponse.json(
        { error: isSuperAdmin ? '企業が選択されていません' : 'Company ID not found' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const {
      name,
      address,
      latitude,
      longitude,
      lockInfo,
      hasManager,
      parkingInfo,
      keyAccessInfo,
      contactInfo,
      workRangeNotes,
      buildingAccessInfo,
    } = body

    if (!name || !address || latitude == null || longitude == null || lockInfo == null || hasManager == null || parkingInfo == null) {
      return NextResponse.json(
        { error: '物件名・住所・緯度・経度・施錠有無・管理人有無・駐車情報は必須です' },
        { status: 400 }
      )
    }

    const property = await prisma.property.create({
      data: {
        companyId: effectiveCompanyId,
        name,
        address,
        latitude: Number(latitude),
        longitude: Number(longitude),
        lockInfo: String(lockInfo),
        hasManager: Boolean(hasManager),
        parkingInfo: String(parkingInfo),
        keyAccessInfo: keyAccessInfo ?? null,
        contactInfo: contactInfo ?? null,
        workRangeNotes: workRangeNotes ?? null,
        buildingAccessInfo: buildingAccessInfo ?? null,
      },
    })

    return NextResponse.json({ success: true, property })
  } catch (error) {
    console.error('Failed to create property:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
