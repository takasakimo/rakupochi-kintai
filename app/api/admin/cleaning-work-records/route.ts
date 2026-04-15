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

    const searchParams = request.nextUrl.searchParams
    const dateStr = searchParams.get('date')
    const employeeIdParam = searchParams.get('employeeId')
    const propertyIdParam = searchParams.get('propertyId')

    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return NextResponse.json({ error: 'date は必須です（YYYY-MM-DD形式）' }, { status: 400 })
    }

    type RawRow = {
      id: number
      company_id: number
      employee_id: number
      property_id: number
      work_date: Date
      check_in_at: Date | null
      check_out_at: Date | null
      check_in_location: unknown
      check_out_location: unknown
      check_in_photo_url: string | null
      check_out_photo_urls: unknown
      handover_confirmed: boolean
      work_type: string | null
      work_type_other_comment: string | null
      impression: string | null
      dirty_areas: string | null
      handover_notes: string | null
      duration_minutes: number | null
    }

    const employeeId = employeeIdParam ? parseInt(employeeIdParam, 10) : null
    const propertyId = propertyIdParam ? parseInt(propertyIdParam, 10) : null

    let raw: RawRow[]
    if (employeeId && !isNaN(employeeId) && propertyId && !isNaN(propertyId)) {
      raw = await prisma.$queryRaw<RawRow[]>`
        SELECT id, company_id, employee_id, property_id, work_date, check_in_at, check_out_at,
          check_in_location, check_out_location, check_in_photo_url, check_out_photo_urls,
          handover_confirmed, work_type, work_type_other_comment, impression, dirty_areas, handover_notes, duration_minutes
        FROM cleaning_work_records
        WHERE company_id = ${effectiveCompanyId} AND employee_id = ${employeeId} AND property_id = ${propertyId}
          AND work_date = ${dateStr}::date
        ORDER BY check_in_at ASC
      `
    } else if (employeeId && !isNaN(employeeId)) {
      raw = await prisma.$queryRaw<RawRow[]>`
        SELECT id, company_id, employee_id, property_id, work_date, check_in_at, check_out_at,
          check_in_location, check_out_location, check_in_photo_url, check_out_photo_urls,
          handover_confirmed, work_type, work_type_other_comment, impression, dirty_areas, handover_notes, duration_minutes
        FROM cleaning_work_records
        WHERE company_id = ${effectiveCompanyId} AND employee_id = ${employeeId}
          AND work_date = ${dateStr}::date
        ORDER BY check_in_at ASC
      `
    } else if (propertyId && !isNaN(propertyId)) {
      raw = await prisma.$queryRaw<RawRow[]>`
        SELECT id, company_id, employee_id, property_id, work_date, check_in_at, check_out_at,
          check_in_location, check_out_location, check_in_photo_url, check_out_photo_urls,
          handover_confirmed, work_type, work_type_other_comment, impression, dirty_areas, handover_notes, duration_minutes
        FROM cleaning_work_records
        WHERE company_id = ${effectiveCompanyId} AND property_id = ${propertyId}
          AND work_date = ${dateStr}::date
        ORDER BY employee_id ASC, check_in_at ASC
      `
    } else {
      raw = await prisma.$queryRaw<RawRow[]>`
        SELECT id, company_id, employee_id, property_id, work_date, check_in_at, check_out_at,
          check_in_location, check_out_location, check_in_photo_url, check_out_photo_urls,
          handover_confirmed, work_type, work_type_other_comment, impression, dirty_areas, handover_notes, duration_minutes
        FROM cleaning_work_records
        WHERE company_id = ${effectiveCompanyId} AND work_date = ${dateStr}::date
        ORDER BY employee_id ASC, check_in_at ASC
      `
    }

    if (raw.length === 0) {
      return NextResponse.json({ records: [] })
    }

    const propertyIds = [...new Set(raw.map((r) => r.property_id))]
    const employeeIds = [...new Set(raw.map((r) => r.employee_id))]
    const [properties, employees] = await Promise.all([
      prisma.property.findMany({ where: { id: { in: propertyIds } } }),
      prisma.employee.findMany({ where: { id: { in: employeeIds } }, select: { id: true, name: true } }),
    ])
    const propertyMap = Object.fromEntries(properties.map((p) => [p.id, p]))
    const employeeMap = Object.fromEntries(employees.map((e) => [e.id, e]))

    const records = raw.map((r) => ({
      id: r.id,
      companyId: r.company_id,
      employeeId: r.employee_id,
      propertyId: r.property_id,
      workDate: r.work_date,
      checkInAt: r.check_in_at,
      checkOutAt: r.check_out_at,
      checkInLocation: r.check_in_location,
      checkOutLocation: r.check_out_location,
      checkInPhotoUrl: r.check_in_photo_url,
      checkOutPhotoUrls: r.check_out_photo_urls,
      handoverConfirmed: r.handover_confirmed,
      workType: r.work_type,
      workTypeOtherComment: r.work_type_other_comment,
      impression: r.impression,
      dirtyAreas: r.dirty_areas,
      handoverNotes: r.handover_notes,
      durationMinutes: r.duration_minutes,
      property: propertyMap[r.property_id],
      employee: employeeMap[r.employee_id],
    }))

    return NextResponse.json({ records })
  } catch (error) {
    console.error('Failed to fetch admin cleaning work records:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
