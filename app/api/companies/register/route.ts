import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

// 一般ユーザー向け企業登録
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      companyName,
      companyCode,
      companyEmail,
      companyPhone,
      companyAddress,
      adminName,
      adminEmail,
      adminPassword,
      adminEmployeeNumber,
    } = body

    // バリデーション
    if (
      !companyName ||
      !companyCode ||
      !adminName ||
      !adminEmail ||
      !adminPassword ||
      !adminEmployeeNumber
    ) {
      return NextResponse.json(
        { error: '必須項目が不足しています' },
        { status: 400 }
      )
    }

    // 企業コードの重複チェック
    const existingCompany = await prisma.company.findUnique({
      where: { code: companyCode },
    })

    if (existingCompany) {
      return NextResponse.json(
        { error: 'この企業コードは既に使用されています' },
        { status: 409 }
      )
    }

    // メールアドレスの重複チェック
    const existingEmployee = await prisma.employee.findUnique({
      where: { email: adminEmail },
    })

    if (existingEmployee) {
      return NextResponse.json(
        { error: 'このメールアドレスは既に使用されています' },
        { status: 409 }
      )
    }

    // パスワードのハッシュ化
    const hashedPassword = await bcrypt.hash(adminPassword, 10)

    // トランザクションで企業と管理者を作成
    const result = await prisma.$transaction(async (tx) => {
      // 企業の作成
      const company = await tx.company.create({
        data: {
          name: companyName,
          code: companyCode,
          email: companyEmail || null,
          phone: companyPhone || null,
          address: companyAddress || null,
          isActive: true,
        },
      })

      // 管理者アカウントの作成
      const admin = await tx.employee.create({
        data: {
          companyId: company.id,
          employeeNumber: adminEmployeeNumber,
          name: adminName,
          email: adminEmail,
          password: hashedPassword,
          role: 'admin',
          isActive: true,
        },
      })

      // 企業設定の作成（デフォルト値）
      await tx.companySetting.create({
        data: {
          companyId: company.id,
          payday: 25,
          overtimeThreshold40: 40,
          overtimeThreshold60: 60,
          consecutiveWorkAlert: 6,
          leaveExpiryAlertDays: 30,
          standardBreakMinutes: 60,
        },
      })

      return { company, admin }
    })

    return NextResponse.json({
      success: true,
      message: '企業登録が完了しました',
      company: {
        id: result.company.id,
        name: result.company.name,
        code: result.company.code,
      },
      admin: {
        id: result.admin.id,
        email: result.admin.email,
      },
    })
  } catch (error: any) {
    console.error('Company registration error:', error)
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: '既に登録されているデータがあります' },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: '企業登録に失敗しました' },
      { status: 500 }
    )
  }
}

