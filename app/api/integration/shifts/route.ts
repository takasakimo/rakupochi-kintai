import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateIntegrationApiKey } from '@/lib/integration-auth'

export const dynamic = 'force-dynamic'

/**
 * 外部連携用シフト取得API（らくポチリザーブ等から呼び出し）
 * 認証: Authorization: Bearer <KINTAI_INTEGRATION_API_KEY> または X-API-Key: <key>
 * クエリ: start_date, end_date（必須）, company_code（必須・企業コード）
 */
export async function GET(request: NextRequest) {
  try {
    if (!validateIntegrationApiKey(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const companyCode = searchParams.get('company_code')?.trim()
    const startDate = searchParams.get('start_date')?.trim()
    const endDate = searchParams.get('end_date')?.trim()

    if (!companyCode) {
      return NextResponse.json(
        { error: 'company_code is required' },
        { status: 400 }
      )
    }
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'start_date and end_date are required (YYYY-MM-DD)' },
        { status: 400 }
      )
    }

    const [startY, startM, startD] = startDate.split('-').map(Number)
    const [endY, endM, endD] = endDate.split('-').map(Number)
    if (
      [startY, startM, startD, endY, endM, endD].some((n) => isNaN(n))
    ) {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD' },
        { status: 400 }
      )
    }

    const company = await prisma.company.findUnique({
      where: { code: companyCode.toUpperCase(), isActive: true },
      select: { id: true, code: true, name: true },
    })

    if (!company) {
      return NextResponse.json(
        { error: 'Company not found or inactive' },
        { status: 404 }
      )
    }

    const dateGte = new Date(Date.UTC(startY, startM - 1, startD, 0, 0, 0, 0))
    const dateLte = new Date(Date.UTC(endY, endM - 1, endD, 23, 59, 59, 999))

    const shifts = await prisma.shift.findMany({
      where: {
        companyId: company.id,
        date: { gte: dateGte, lte: dateLte },
      },
      include: {
        employee: {
          select: {
            id: true,
            email: true,
            employeeNumber: true,
            name: true,
          },
        },
      },
      orderBy: [{ date: 'asc' }, { employeeId: 'asc' }],
    })

    const formattedShifts = shifts.map((shift) => {
      let startTimeStr: string | null = null
      let endTimeStr: string | null = null
      if (shift.startTime) {
        const t = shift.startTime as Date
        startTimeStr = `${String(t.getUTCHours()).padStart(2, '0')}:${String(t.getUTCMinutes()).padStart(2, '0')}`
      }
      if (shift.endTime) {
        const t = shift.endTime as Date
        endTimeStr = `${String(t.getUTCHours()).padStart(2, '0')}:${String(t.getUTCMinutes()).padStart(2, '0')}`
      }
      const shiftDate = shift.date as Date
      const dateStr = `${shiftDate.getUTCFullYear()}-${String(shiftDate.getUTCMonth() + 1).padStart(2, '0')}-${String(shiftDate.getUTCDate()).padStart(2, '0')}`

      return {
        shiftId: shift.id,
        date: dateStr,
        employeeId: shift.employeeId,
        employeeEmail: shift.employee.email,
        employeeNumber: shift.employee.employeeNumber,
        employeeName: shift.employee.name,
        startTime: startTimeStr,
        endTime: endTimeStr,
        breakMinutes: shift.breakMinutes,
        isOff: shift.isPublicHoliday || (!startTimeStr && !endTimeStr),
        workLocation: shift.workLocation ?? null,
      }
    })

    return NextResponse.json({
      companyCode: company.code,
      companyId: company.id,
      companyName: company.name,
      startDate,
      endDate,
      shifts: formattedShifts,
    })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[Integration Shifts]', error)
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
