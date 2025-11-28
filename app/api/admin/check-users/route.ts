import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// データベース内のユーザーを確認するAPI
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // 企業一覧
    const companies = await prisma.company.findMany({
      select: {
        id: true,
        name: true,
        code: true,
      },
    })

    // 従業員一覧
    const employees = await prisma.employee.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        companyId: true,
        password: true, // デバッグ用（本番環境では削除推奨）
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
        hasPassword: !!e.password,
        passwordLength: e.password?.length || 0,
      })),
    })
  } catch (error: any) {
    console.error('Check users error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'ユーザー確認に失敗しました',
      },
      { status: 500 }
    )
  }
}

