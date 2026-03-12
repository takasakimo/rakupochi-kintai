import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function getEffectiveCompanyId(session: { user?: { role?: string; email?: string; selectedCompanyId?: number | null; companyId?: number } } | null) {
  if (!session?.user) return null
  const isSuperAdmin = session.user.role === 'super_admin' || session.user.email === 'superadmin@rakupochi.com'
  const isAdmin = session.user.role === 'admin'
  if (!isSuperAdmin && !isAdmin) return null
  return isSuperAdmin ? session.user.selectedCompanyId ?? undefined : session.user.companyId
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const effectiveCompanyId = getEffectiveCompanyId(session as Parameters<typeof getEffectiveCompanyId>[0])
    if (!effectiveCompanyId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const id = parseInt(params.id)
    const property = await prisma.property.findFirst({
      where: { id, companyId: effectiveCompanyId },
    })

    if (!property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 })
    }

    return NextResponse.json({ property })
  } catch (error) {
    console.error('Failed to fetch property:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const effectiveCompanyId = getEffectiveCompanyId(session as Parameters<typeof getEffectiveCompanyId>[0])
    if (!effectiveCompanyId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const id = parseInt(params.id)
    const existing = await prisma.property.findFirst({
      where: { id, companyId: effectiveCompanyId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 })
    }

    const body = await request.json()
    const updateData: Record<string, unknown> = {}
    const fields = ['name', 'address', 'latitude', 'longitude', 'lockInfo', 'hasManager', 'parkingInfo', 'keyAccessInfo', 'contactInfo', 'workRangeNotes', 'buildingAccessInfo']
    for (const f of fields) {
      if (body[f] !== undefined) updateData[f] = body[f]
    }
    if (updateData.latitude !== undefined) updateData.latitude = Number(updateData.latitude)
    if (updateData.longitude !== undefined) updateData.longitude = Number(updateData.longitude)

    const property = await prisma.property.update({
      where: { id },
      data: updateData as Parameters<typeof prisma.property.update>[0]['data'],
    })

    return NextResponse.json({ success: true, property })
  } catch (error) {
    console.error('Failed to update property:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const effectiveCompanyId = getEffectiveCompanyId(session as Parameters<typeof getEffectiveCompanyId>[0])
    if (!effectiveCompanyId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const id = parseInt(params.id)
    const existing = await prisma.property.findFirst({
      where: { id, companyId: effectiveCompanyId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 })
    }

    await prisma.property.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete property:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
