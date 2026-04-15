import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const employeeId = parseInt(session.user.id, 10)
    if (isNaN(employeeId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    // 自分のデータ取得は常にDBのEmployee.companyIdを使用（スーパー管理者でもselectedCompanyIdに依存しない）
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { companyId: true },
    })
    const companyId = employee?.companyId ?? (session.user as { companyId?: number }).companyId
    if (!companyId) {
      return NextResponse.json({ error: '所属企業が取得できません' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const dateStr = searchParams.get('date')
    const monthStr = searchParams.get('month')

    const useMonth = !!monthStr && /^\d{4}-\d{2}$/.test(monthStr)
    const useDate = !!dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)

    if (!useMonth && !useDate) {
      return NextResponse.json(
        { error: 'date（YYYY-MM-DD）または month（YYYY-MM）のいずれかを指定してください' },
        { status: 400 }
      )
    }

    type RecordRow = {
      id: number
      company_id: number
      employee_id: number
      property_id: number
      work_date: Date
      check_in_at: Date | null
      check_out_at: Date | null
      check_in_photo_url: string | null
      impression: string | null
      dirty_areas: string | null
      handover_notes: string | null
      check_out_photo_urls: unknown
      handover_confirmed: boolean
      work_type: string | null
      work_type_other_comment: string | null
      duration_minutes: number | null
      created_at: Date
      updated_at: Date
    }

    let raw: RecordRow[]
    if (useMonth) {
      const [y, m] = monthStr!.split('-').map(Number)
      const startDate = `${monthStr}-01`
      const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
      raw = await prisma.$queryRaw<RecordRow[]>`
        SELECT * FROM cleaning_work_records
        WHERE company_id = ${companyId} AND employee_id = ${employeeId}
          AND work_date >= ${startDate}::date
          AND work_date < ${nextMonth}::date
        ORDER BY work_date ASC, id ASC
      `
    } else {
      raw = await prisma.$queryRaw<RecordRow[]>`
        SELECT * FROM cleaning_work_records
        WHERE company_id = ${companyId} AND employee_id = ${employeeId}
          AND work_date = ${dateStr}::date
      `
    }

    if (raw.length === 0) {
      return NextResponse.json({ records: [] })
    }

    const propertyIds = [...new Set(raw.map((r) => r.property_id))]
    const properties = await prisma.property.findMany({
      where: { id: { in: propertyIds } },
    })
    const propertyMap = Object.fromEntries(properties.map((p) => [p.id, p]))

    const records = raw.map((r) => ({
      id: r.id,
      companyId: r.company_id,
      employeeId: r.employee_id,
      propertyId: r.property_id,
      workDate: r.work_date,
      checkInAt: r.check_in_at,
      checkOutAt: r.check_out_at,
      checkInPhotoUrl: r.check_in_photo_url,
      impression: r.impression,
      dirtyAreas: r.dirty_areas,
      handoverNotes: r.handover_notes,
      checkOutPhotoUrls: r.check_out_photo_urls,
      handoverConfirmed: r.handover_confirmed,
      workType: r.work_type,
      workTypeOtherComment: r.work_type_other_comment,
      durationMinutes: r.duration_minutes,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      property: propertyMap[r.property_id],
    }))

    return NextResponse.json({ records })
  } catch (error) {
    console.error('Failed to fetch cleaning work records:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
