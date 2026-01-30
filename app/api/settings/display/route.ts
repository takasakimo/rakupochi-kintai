import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// 表示設定のみを取得（従業員もアクセス可能）
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // スーパー管理者の場合はselectedCompanyIdを使用、通常のユーザーの場合はcompanyIdを使用
    const isSuperAdmin = session.user.role === 'super_admin' || 
                         session.user.email === 'superadmin@rakupochi.com'
    const effectiveCompanyId = isSuperAdmin 
      ? session.user.selectedCompanyId 
      : session.user.companyId

    if (!effectiveCompanyId) {
      return NextResponse.json(
        { error: isSuperAdmin ? '企業が選択されていません' : 'Company ID not found' },
        { status: 400 }
      )
    }

    const settings = await prisma.companySetting.findUnique({
      where: { companyId: effectiveCompanyId },
      select: {
        enableSalesVisit: true,
        enableWakeUpDeparture: true,
      },
    })

    // 設定が存在しない場合はデフォルト値を返す
    if (!settings) {
      return NextResponse.json({
        enableSalesVisit: true,
        enableWakeUpDeparture: true,
      })
    }

    return NextResponse.json({
      enableSalesVisit: settings.enableSalesVisit ?? true,
      enableWakeUpDeparture: settings.enableWakeUpDeparture ?? true,
    })
  } catch (error) {
    console.error('Get display settings error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
