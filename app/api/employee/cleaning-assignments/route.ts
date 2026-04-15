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

    // 自分のアサインメント取得時は必ずEmployeeのcompanyIdを使用（スーパー管理者でもselectedCompanyIdに依存しない）
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { companyId: true },
    })
    const companyId = employee?.companyId
    if (!companyId) {
      return NextResponse.json(
        { error: '所属企業が設定されていません' },
        { status: 403 }
      )
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

    type AssignRow = { id: number; property_id: number; sort_order: number; assignment_date: Date }
    let raw: AssignRow[]

    if (useMonth) {
      const [y, m] = monthStr!.split('-').map(Number)
      const startDate = `${monthStr}-01`
      const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
      raw = await prisma.$queryRaw<AssignRow[]>`
        SELECT id, property_id, sort_order, assignment_date FROM cleaning_assignments
        WHERE company_id = ${companyId} AND employee_id = ${employeeId}
          AND assignment_date >= ${startDate}::date
          AND assignment_date < ${nextMonth}::date
        ORDER BY assignment_date ASC, sort_order ASC
      `
    } else {
      raw = await prisma.$queryRaw<AssignRow[]>`
        SELECT id, property_id, sort_order, assignment_date FROM cleaning_assignments
        WHERE company_id = ${companyId} AND employee_id = ${employeeId}
          AND assignment_date = ${dateStr}::date
        ORDER BY sort_order ASC
      `
    }

    if (raw.length === 0) {
      return NextResponse.json({ assignments: [] })
    }

    const propertyIds = [...new Set(raw.map((r) => r.property_id))]
    const properties = await prisma.property.findMany({
      where: { id: { in: propertyIds } },
    })
    const propertyMap = Object.fromEntries(properties.map((p) => [p.id, p]))

    const assignments = raw.map((r) => ({
      id: r.id,
      propertyId: r.property_id,
      sortOrder: r.sort_order,
      assignmentDate: r.assignment_date,
      property: propertyMap[r.property_id],
    })).filter((a) => a.property)

    return NextResponse.json({ assignments })
  } catch (error) {
    console.error('Failed to fetch cleaning assignments:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
