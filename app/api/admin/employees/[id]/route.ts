import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

// 従業員情報取得
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const id = parseInt(params.id)

    const employee = await prisma.employee.findFirst({
      where: {
        id,
        companyId: session.user.companyId,
      },
      select: {
        id: true,
        employeeNumber: true,
        name: true,
        email: true,
        role: true,
        department: true,
        position: true,
        phone: true,
        birthDate: true,
        address: true,
        hireDate: true,
        transportationRoutes: true,
        transportationCost: true,
        isActive: true,
      },
    })

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    return NextResponse.json({ employee })
  } catch (error) {
    console.error('Get employee error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// 従業員情報更新
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const id = parseInt(params.id)
    const body = await request.json()

    // 従業員が存在し、同じ企業に属しているか確認
    const existingEmployee = await prisma.employee.findFirst({
      where: {
        id,
        companyId: session.user.companyId,
      },
    })

    if (!existingEmployee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    // メールアドレスの重複チェック（自分以外）
    if (body.email && body.email !== existingEmployee.email) {
      const emailExists = await prisma.employee.findUnique({
        where: { email: body.email },
      })

      if (emailExists) {
        return NextResponse.json(
          { error: 'このメールアドレスは既に使用されています' },
          { status: 409 }
        )
      }
    }

    // パスワードのハッシュ化（パスワードが提供されている場合）
    let hashedPassword = existingEmployee.password
    if (body.password && body.password.length > 0) {
      hashedPassword = await bcrypt.hash(body.password, 10)
    }

    const updatedEmployee = await prisma.employee.update({
      where: { id },
      data: {
        ...(body.employeeNumber && { employeeNumber: body.employeeNumber }),
        ...(body.name && { name: body.name }),
        ...(body.email && { email: body.email }),
        ...(body.password && body.password.length > 0 && { password: hashedPassword }),
        ...(body.role && { role: body.role }),
        ...(body.department !== undefined && { department: body.department }),
        ...(body.position !== undefined && { position: body.position }),
        ...(body.phone !== undefined && { phone: body.phone }),
        ...(body.birthDate && { birthDate: new Date(body.birthDate) }),
        ...(body.birthDate === null && { birthDate: null }),
        ...(body.address !== undefined && { address: body.address }),
        ...(body.hireDate && { hireDate: new Date(body.hireDate) }),
        ...(body.transportationRoutes !== undefined && { transportationRoutes: body.transportationRoutes }),
        ...(body.transportationCost !== undefined && { transportationCost: body.transportationCost ? parseInt(body.transportationCost) : null }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      },
      select: {
        id: true,
        employeeNumber: true,
        name: true,
        email: true,
        role: true,
        department: true,
        position: true,
        phone: true,
        birthDate: true,
        address: true,
        hireDate: true,
        transportationRoutes: true,
        transportationCost: true,
        isActive: true,
      },
    })

    return NextResponse.json({
      success: true,
      employee: updatedEmployee,
    })
  } catch (error: any) {
    console.error('Update employee error:', error)
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: '社員番号またはメールアドレスが重複しています' },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// 従業員削除
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const id = parseInt(params.id)

    // 従業員が存在し、同じ企業に属しているか確認
    const employee = await prisma.employee.findFirst({
      where: {
        id,
        companyId: session.user.companyId,
      },
    })

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    // 自分自身は削除できない
    if (employee.id === parseInt(session.user.id)) {
      return NextResponse.json(
        { error: '自分自身を削除することはできません' },
        { status: 400 }
      )
    }

    // 従業員を削除（Cascadeで関連データも削除される）
    await prisma.employee.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      message: '従業員を削除しました',
    })
  } catch (error) {
    console.error('Delete employee error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
