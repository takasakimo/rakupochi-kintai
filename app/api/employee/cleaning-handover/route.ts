import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * 対象物件の前回作業者からの引き継ぎ事項を取得
 * 自分のアサインメント取得時は必ずEmployeeのcompanyIdを使用（スーパー管理者でもselectedCompanyIdに依存しない）
 */
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

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { companyId: true },
    })
    const companyId = employee?.companyId
    if (!companyId) {
      return NextResponse.json({ error: '所属企業が設定されていません' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const propertyIdStr = searchParams.get('propertyId')
    const propertyId = propertyIdStr ? parseInt(propertyIdStr, 10) : null
    if (!propertyId || isNaN(propertyId)) {
      return NextResponse.json({ error: 'propertyId は必須です' }, { status: 400 })
    }

    const prev = await prisma.cleaningWorkRecord.findFirst({
      where: {
        companyId,
        propertyId,
        checkOutAt: { not: null },
        handoverNotes: { not: null },
      },
      orderBy: { checkOutAt: 'desc' },
      select: { handoverNotes: true },
    })

    return NextResponse.json({
      handoverNotes: prev?.handoverNotes ?? null,
    })
  } catch (error) {
    console.error('Failed to fetch handover:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
