import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// ユーザーの企業情報を取得
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // スーパー管理者または管理者の判定
    const isSuperAdmin = session.user.role === 'super_admin' || 
                         session.user.email === 'superadmin@rakupochi.com'
    
    // スーパー管理者の場合はselectedCompanyIdを使用、通常の管理者の場合はcompanyIdを使用
    const effectiveCompanyId = isSuperAdmin 
      ? session.user.selectedCompanyId 
      : session.user.companyId

    if (!effectiveCompanyId) {
      return NextResponse.json(
        { error: isSuperAdmin ? '企業が選択されていません' : 'Company ID not found' },
        { status: 404 }
      )
    }

    const company = await prisma.company.findUnique({
      where: { id: effectiveCompanyId },
      select: {
        id: true,
        code: true,
        name: true,
      },
    })

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    return NextResponse.json({ company })
  } catch (error) {
    console.error('Failed to fetch company:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

