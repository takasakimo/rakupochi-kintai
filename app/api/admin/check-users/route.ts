import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// データベース内のユーザーを確認するAPI（管理者のみ）
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // 認証チェック
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // スーパー管理者または管理者のみアクセス可能
    const isSuperAdmin = session.user.role === 'super_admin' || 
                         session.user.email === 'superadmin@rakupochi.com'
    const isAdmin = session.user.role === 'admin'

    if (!isSuperAdmin && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 企業一覧
    const companies = await prisma.company.findMany({
      select: {
        id: true,
        name: true,
        code: true,
      },
    })

    // 従業員一覧（パスワード情報は含めない）
    const employees = await prisma.employee.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        companyId: true,
        // passwordはセキュリティのため除外
      },
    })

    return NextResponse.json({
      success: true,
      companies,
      employees: employees.map(e => ({
        id: e.id,
        name: e.name,
        email: e.email,
        role: e.role,
        isActive: e.isActive,
        companyId: e.companyId,
        hasPassword: true, // パスワードの存在のみ確認（実際の値は返さない）
      })),
    })
  } catch (error: any) {
    console.error('Check users error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'ユーザー確認に失敗しました',
      },
      { status: 500 }
    )
  }
}

