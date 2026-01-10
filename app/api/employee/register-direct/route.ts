import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

// 従業員を直接登録（申請なし）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      companyCode,
      name,
      email,
      password,
      phone,
      address,
      transportationRoutes,
    } = body

    // バリデーション
    if (!companyCode || !name || !email || !password || !phone || !address) {
      return NextResponse.json(
        { error: '必須項目が不足しています（企業コード、氏名、メールアドレス、パスワード、電話番号、住所は必須です）' },
        { status: 400 }
      )
    }

    // パスワードの長さチェック
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'パスワードは8文字以上で入力してください' },
        { status: 400 }
      )
    }

    // 企業コードで企業を検索
    const company = await prisma.company.findUnique({
      where: { code: companyCode.toUpperCase() },
    })

    if (!company) {
      return NextResponse.json(
        { error: '企業コードが正しくありません' },
        { status: 404 }
      )
    }

    if (!company.isActive) {
      return NextResponse.json(
        { error: 'この企業は無効です' },
        { status: 403 }
      )
    }

    // メールアドレスの重複チェック
    const existingEmployee = await prisma.employee.findUnique({
      where: { email },
    })

    if (existingEmployee) {
      return NextResponse.json(
        { error: 'このメールアドレスは既に使用されています' },
        { status: 409 }
      )
    }

    // 従業員番号を自動生成（一時的な番号、管理者が後で変更可能）
    // 企業内でユニークな番号を生成
    let employeeNumber = `TEMP_${Date.now()}`
    let isUnique = false
    let attempts = 0
    while (!isUnique && attempts < 10) {
      const existing = await prisma.employee.findFirst({
        where: {
          employeeNumber,
          companyId: company.id,
        },
      })
      if (!existing) {
        isUnique = true
      } else {
        employeeNumber = `TEMP_${Date.now()}_${attempts}`
        attempts++
      }
    }

    // パスワードのハッシュ化
    const hashedPassword = await bcrypt.hash(password, 10)

    // 従業員を作成
    const employee = await prisma.employee.create({
      data: {
        companyId: company.id,
        employeeNumber,
        name,
        email,
        password: hashedPassword,
        role: 'employee',
        phone: phone || null,
        address: address || null,
        transportationRoutes: transportationRoutes || null,
        isActive: true,
      },
      select: {
        id: true,
        employeeNumber: true,
        name: true,
        email: true,
        role: true,
        companyId: true,
      },
    })

    return NextResponse.json({
      success: true,
      employee,
    })
  } catch (error: any) {
    console.error('Employee registration error:', error)
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: '既に登録されているデータがあります' },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: '登録に失敗しました' },
      { status: 500 }
    )
  }
}

