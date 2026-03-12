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
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return NextResponse.json({ error: '無効な日付です（YYYY-MM-DD形式）' }, { status: 400 })
    }

    // PostgreSQL DATE型を確実に比較するため生SQLを使用（タイムゾーン問題を完全に回避）
    const raw = await prisma.$queryRaw<Array<{ id: number; property_id: number; sort_order: number }>>`
      SELECT id, property_id, sort_order FROM cleaning_assignments
      WHERE company_id = ${companyId} AND employee_id = ${employeeId}
        AND assignment_date = ${dateStr}::date
      ORDER BY sort_order ASC
    `

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
      property: propertyMap[r.property_id],
    })).filter((a) => a.property)

    return NextResponse.json({ assignments })
  } catch (error) {
    console.error('Failed to fetch cleaning assignments:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
