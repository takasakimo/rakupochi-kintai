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

    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return NextResponse.json({ error: 'date は必須です（YYYY-MM-DD形式）' }, { status: 400 })
    }

    // PostgreSQL DATE型で確実に検索（PrismaのDateTime範囲ではDATE比較が不安定なため生SQL使用）
    type RawRow = { id: number; company_id: number; employee_id: number; property_id: number; assignment_date: Date; sort_order: number }
    let raw: RawRow[] = []
    if (employeeIdParam) {
      const employeeId = parseInt(employeeIdParam, 10)
      if (!isNaN(employeeId)) {
        raw = await prisma.$queryRaw<RawRow[]>`
          SELECT id, company_id, employee_id, property_id, assignment_date, sort_order
          FROM cleaning_assignments
          WHERE company_id = ${effectiveCompanyId} AND employee_id = ${employeeId}
            AND assignment_date = ${dateStr}::date
          ORDER BY employee_id ASC, sort_order ASC
        `
      }
    } else {
      raw = await prisma.$queryRaw<RawRow[]>`
        SELECT id, company_id, employee_id, property_id, assignment_date, sort_order
        FROM cleaning_assignments
        WHERE company_id = ${effectiveCompanyId}
          AND assignment_date = ${dateStr}::date
        ORDER BY employee_id ASC, sort_order ASC
      `
    }

    if (raw.length === 0) {
      return NextResponse.json({ assignments: [] })
    }

    const propertyIds = [...new Set(raw.map((r) => r.property_id))]
    const employeeIds = [...new Set(raw.map((r) => r.employee_id))]
    const [properties, employees] = await Promise.all([
      prisma.property.findMany({ where: { id: { in: propertyIds } } }),
      prisma.employee.findMany({ where: { id: { in: employeeIds } }, select: { id: true, name: true } }),
    ])
    const propertyMap = Object.fromEntries(properties.map((p) => [p.id, p]))
    const employeeMap = Object.fromEntries(employees.map((e) => [e.id, e]))

    const assignments = raw.map((r) => ({
      id: r.id,
      companyId: r.company_id,
      employeeId: r.employee_id,
      propertyId: r.property_id,
      assignmentDate: r.assignment_date,
      sortOrder: r.sort_order,
      property: propertyMap[r.property_id],
      employee: employeeMap[r.employee_id],
    }))

    return NextResponse.json({ assignments })
  } catch (error) {
    console.error('Failed to fetch cleaning assignments:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { date, assignments } = body as { date: string; assignments: { employeeId: number; propertyId: number; sortOrder: number }[] }

    if (!date || !Array.isArray(assignments)) {
      return NextResponse.json(
        { error: 'date と assignments（配列）は必須です' },
        { status: 400 }
      )
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: '無効な日付形式です（YYYY-MM-DD）' }, { status: 400 })
    }

    // PostgreSQL DATE型で確実に削除・登録（dateは検証済みYYYY-MM-DDのため$executeRawUnsafeで安全に実行）
    await prisma.$executeRawUnsafe(
      'DELETE FROM cleaning_assignments WHERE company_id = $1 AND assignment_date = $2::date',
      effectiveCompanyId,
      date
    )

    if (assignments.length > 0) {
      for (const a of assignments as { employeeId: number; propertyId: number; sortOrder: number }[]) {
        await prisma.$executeRawUnsafe(
          'INSERT INTO cleaning_assignments (company_id, employee_id, property_id, assignment_date, sort_order, created_at, updated_at) VALUES ($1, $2, $3, $4::date, $5, NOW(), NOW())',
          effectiveCompanyId,
          a.employeeId,
          a.propertyId,
          date,
          a.sortOrder
        )
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to save cleaning assignments:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
