import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

// マイページ情報取得
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const employee = await prisma.employee.findUnique({
      where: { id: parseInt(session.user.id) },
      select: {
        id: true,
        employeeNumber: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        bankAccount: true,
        transportationRoutes: true,
        transportationCost: true,
      },
    })

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    return NextResponse.json({ employee })
  } catch (error) {
    console.error('Failed to fetch employee:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// マイページ情報更新
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { email, password, phone, address, bankAccount, transportationRoutes, transportationCost } = body

    // バリデーション
    if (!email || !phone || !address) {
      return NextResponse.json(
        { error: 'メールアドレス、電話番号、住所は必須です' },
        { status: 400 }
      )
    }

    const updateData: any = {
      email,
      phone,
      address,
      bankAccount: bankAccount || null,
      transportationRoutes: transportationRoutes || null,
      transportationCost: transportationCost ? parseInt(transportationCost) : null,
    }

    // パスワードが提供されている場合は更新
    if (password) {
      if (password.length < 8) {
        return NextResponse.json(
          { error: 'パスワードは8文字以上で入力してください' },
          { status: 400 }
        )
      }
      const hashedPassword = await bcrypt.hash(password, 10)
      updateData.password = hashedPassword
    }

    // メールアドレスの重複チェック（自分以外）
    const existingEmployee = await prisma.employee.findUnique({
      where: { email },
    })

    if (existingEmployee && existingEmployee.id !== parseInt(session.user.id)) {
      return NextResponse.json(
        { error: 'このメールアドレスは既に使用されています' },
        { status: 409 }
      )
    }

    const employee = await prisma.employee.update({
      where: { id: parseInt(session.user.id) },
      data: updateData,
      select: {
        id: true,
        employeeNumber: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        bankAccount: true,
        transportationRoutes: true,
        transportationCost: true,
      },
    })

    return NextResponse.json({
      success: true,
      employee,
    })
  } catch (error: any) {
    console.error('Failed to update employee:', error)
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

