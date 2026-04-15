import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// 申請（cleaning_check_omission）用に物件一覧（id, name）を返す
export async function GET() {
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

    // チェックイン機能が有効か確認
    const setting = await prisma.companySetting.findUnique({
      where: { companyId },
      select: { enableCleaningCheck: true },
    })
    if (!setting?.enableCleaningCheck) {
      return NextResponse.json({ properties: [] })
    }

    const properties = await prisma.property.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    })

    return NextResponse.json({ properties })
  } catch (error) {
    console.error('Failed to fetch properties:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
