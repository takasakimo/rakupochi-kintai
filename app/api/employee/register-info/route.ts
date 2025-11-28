import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

// ステップ1: 従業員情報を登録（パスワードは一時的なものを設定）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      companyCode,
      employeeNumber,
      name,
      email,
      phone,
      birthDate,
      address,
    } = body

    // バリデーション
    if (!companyCode || !employeeNumber || !name || !email) {
      return NextResponse.json(
        { error: '必須項目が不足しています' },
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

    // 社員番号の重複チェック（同じ企業内）
    const existingEmployeeNumber = await prisma.employee.findFirst({
      where: {
        employeeNumber,
        companyId: company.id,
      },
    })

    if (existingEmployeeNumber) {
      return NextResponse.json(
        { error: 'この社員番号は既に使用されています' },
        { status: 409 }
      )
    }

    // 一時的なパスワードを生成（ランダムな文字列）
    const tempPassword = crypto.randomBytes(16).toString('hex')
    const hashedPassword = await bcrypt.hash(tempPassword, 10)

    // 従業員を作成（パスワードは一時的なもの）
    const employee = await prisma.employee.create({
      data: {
        companyId: company.id,
        employeeNumber,
        name,
        email,
        password: hashedPassword, // 一時的なパスワード
        role: 'employee',
        phone: phone || null,
        birthDate: birthDate ? new Date(birthDate) : null,
        address: address || null,
        isActive: true,
      },
      select: {
        id: true,
        employeeNumber: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        birthDate: true,
        address: true,
        isActive: true,
      },
    })

    return NextResponse.json({
      success: true,
      employee,
      tempPassword, // デバッグ用（本番では削除推奨）
    })
  } catch (error: any) {
    console.error('Employee info registration error:', error)
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: '既に登録されているデータがあります' },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

