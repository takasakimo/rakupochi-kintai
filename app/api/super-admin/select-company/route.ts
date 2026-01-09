import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// スーパー管理者が企業を選択するAPI
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // スーパー管理者のみアクセス可能
    const isSuperAdmin = session.user.role === 'super_admin' || 
                         session.user.email === 'superadmin@rakupochi.com'

    if (!isSuperAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { companyId } = body

    if (!companyId) {
      return NextResponse.json(
        { error: '企業IDが指定されていません' },
        { status: 400 }
      )
    }

    // 企業が存在するか確認
    const company = await prisma.company.findUnique({
      where: { id: parseInt(companyId) },
    })

    if (!company) {
      return NextResponse.json(
        { error: '企業が見つかりません' },
        { status: 404 }
      )
    }

    // セッションにselectedCompanyIdを保存するため、JWTトークンを更新
    // 注意: NextAuthのセッション更新はクライアント側で行う必要があります
    // ここでは選択された企業IDを返すだけにします

    return NextResponse.json({
      success: true,
      companyId: parseInt(companyId),
      company: {
        id: company.id,
        name: company.name,
        code: company.code,
      },
    })
  } catch (error: any) {
    console.error('Select company error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

