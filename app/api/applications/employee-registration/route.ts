import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

// 従業員登録申請を作成
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      companyCode,
      name,
      email,
      phone,
      address,
      transportationRoutes,
    } = body

    // バリデーション
    if (!companyCode || !name || !email || !phone || !address) {
      return NextResponse.json(
        { error: '必須項目が不足しています（企業コード、氏名、メールアドレス、電話番号、住所は必須です）' },
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

    // メールアドレスの重複チェック（既存の従業員）
    const existingEmployee = await prisma.employee.findUnique({
      where: { email },
    })

    if (existingEmployee) {
      return NextResponse.json(
        { error: 'このメールアドレスは既に使用されています' },
        { status: 409 }
      )
    }

    // 既に同じメールアドレスで申請が存在するかチェック（pending状態）
    const existingApplication = await prisma.application.findFirst({
      where: {
        companyId: company.id,
        type: 'employee_registration',
        status: 'pending',
        content: {
          contains: email,
        },
      },
    })

    if (existingApplication) {
      try {
        const content = JSON.parse(existingApplication.content)
        if (content.email === email) {
          return NextResponse.json(
            { error: 'このメールアドレスで既に申請が提出されています。承認をお待ちください。' },
            { status: 409 }
          )
        }
      } catch {
        // JSON解析エラーは無視
      }
    }

    // 申請内容を作成
    const applicationContent = {
      name,
      email,
      phone,
      address,
      transportationRoutes: transportationRoutes || null,
    }

    // 一時的な従業員レコードを作成（申請承認時に実際の従業員に置き換えられる）
    // 一時的なパスワードを生成
    const tempPassword = crypto.randomBytes(16).toString('hex')
    const hashedPassword = await bcrypt.hash(tempPassword, 10)

    // 一時的な従業員を作成（isActive=falseで作成し、承認時にisActive=trueに更新）
    const tempEmployee = await prisma.employee.create({
      data: {
        companyId: company.id,
        employeeNumber: `TEMP_${Date.now()}`, // 一時的な従業員番号
        name: `[申請中] ${name}`,
        email: `temp_${email}_${Date.now()}@temp.local`, // 一時的なメールアドレス
        password: hashedPassword,
        role: 'employee',
        isActive: false, // 承認されるまで無効
      },
    })

    // 申請を作成
    const application = await prisma.application.create({
      data: {
        companyId: company.id,
        employeeId: tempEmployee.id, // 一時的な従業員ID
        type: 'employee_registration',
        status: 'pending',
        title: `従業員登録申請: ${name}`,
        content: JSON.stringify(applicationContent),
        reason: `従業員登録申請（${name}）`,
      },
    })

    return NextResponse.json({
      success: true,
      application: {
        id: application.id,
        type: application.type,
        status: application.status,
      },
    })
  } catch (error) {
    console.error('Employee registration application error:', error)
    return NextResponse.json(
      { error: '申請の作成に失敗しました' },
      { status: 500 }
    )
  }
}

