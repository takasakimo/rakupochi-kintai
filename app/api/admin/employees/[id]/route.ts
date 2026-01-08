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
        workLocation: true,
        workLocationAddress: true,
        position: true,
        phone: true,
        birthDate: true,
        address: true,
        hireDate: true,
        paidLeaveGrantDate: true,
        yearsOfService: true,
        paidLeaveBalance: true,
        transportationRoutes: true,
        transportationCost: true,
        isActive: true,
      },
    })

    // 有給消滅ロジック（取得から2年経過した有給を自動消滅）
    if (employee && employee.paidLeaveGrantDate && employee.paidLeaveBalance > 0) {
      const grantDate = new Date(employee.paidLeaveGrantDate)
      const twoYearsLater = new Date(grantDate)
      twoYearsLater.setFullYear(twoYearsLater.getFullYear() + 2)
      const now = new Date()
      
      if (now > twoYearsLater) {
        await prisma.employee.update({
          where: { id: employee.id },
          data: { paidLeaveBalance: 0 },
        })
        employee.paidLeaveBalance = 0
      }
    }

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

    // バリデーション（必須項目チェック）
    if (body.email !== undefined && !body.email) {
      return NextResponse.json(
        { error: 'メールアドレスは必須です' },
        { status: 400 }
      )
    }
    if (body.phone !== undefined && !body.phone) {
      return NextResponse.json(
        { error: '電話番号は必須です' },
        { status: 400 }
      )
    }
    if (body.address !== undefined && !body.address) {
      return NextResponse.json(
        { error: '住所は必須です' },
        { status: 400 }
      )
    }

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

    // 勤続年数から有給付与日を自動計算
    let calculatedGrantDate = null
    const hireDateValue = body.hireDate ? (body.hireDate === '' ? null : new Date(body.hireDate)) : existingEmployee.hireDate
    const hireDate = hireDateValue && !isNaN(new Date(hireDateValue).getTime()) ? new Date(hireDateValue) : null
    const yearsOfService = body.yearsOfService !== undefined ? parseFloat(body.yearsOfService) : existingEmployee.yearsOfService
    
    if (hireDate && yearsOfService !== null && yearsOfService !== undefined && !isNaN(yearsOfService)) {
      const grantDate = new Date(hireDate)
      grantDate.setFullYear(grantDate.getFullYear() + Math.floor(yearsOfService))
      grantDate.setMonth(grantDate.getMonth() + Math.floor((yearsOfService % 1) * 12))
      // 計算結果が有効な日付か確認
      if (!isNaN(grantDate.getTime())) {
        calculatedGrantDate = grantDate
      }
    } else if (hireDate && !body.paidLeaveGrantDate && !existingEmployee.paidLeaveGrantDate) {
      // 勤続年数が未設定でも入社日があれば、入社日を基準に計算
      calculatedGrantDate = hireDate
    }

    // 有給消滅ロジック（取得から2年経過した有給を自動消滅）
    let paidLeaveBalance = body.paidLeaveBalance !== undefined 
      ? parseInt(body.paidLeaveBalance) 
      : existingEmployee.paidLeaveBalance
    
    if (existingEmployee.paidLeaveGrantDate) {
      const grantDate = new Date(existingEmployee.paidLeaveGrantDate)
      const twoYearsLater = new Date(grantDate)
      twoYearsLater.setFullYear(twoYearsLater.getFullYear() + 2)
      const now = new Date()
      
      // 2年経過している場合、有給残数を0にリセット（新規付与分のみ残す）
      if (now > twoYearsLater && paidLeaveBalance > 0) {
        // 新しい付与日がある場合は、その付与分のみ残す
        if (calculatedGrantDate && calculatedGrantDate > grantDate) {
          // 新しい付与分を計算（簡易的に勤続年数に応じた付与日数を計算）
          const newGrantDays = Math.floor((yearsOfService || 0) * 10) // 例: 1年で10日付与
          paidLeaveBalance = Math.max(0, newGrantDays)
        } else {
          paidLeaveBalance = 0
        }
      }
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
        ...(body.workLocation !== undefined && { workLocation: body.workLocation }),
        ...(body.workLocationAddress !== undefined && { workLocationAddress: body.workLocationAddress }),
        ...(body.position !== undefined && { position: body.position }),
        ...(body.phone !== undefined && { phone: body.phone }),
        ...(body.birthDate !== undefined && (() => {
          // 空文字列や無効な日付の場合はnullを設定
          if (!body.birthDate || body.birthDate === '') {
            return { birthDate: null }
          }
          const birthDate = new Date(body.birthDate)
          // 無効な日付の場合はnullを設定
          if (isNaN(birthDate.getTime())) {
            return { birthDate: null }
          }
          return { birthDate }
        })()),
        ...(body.address !== undefined && { address: body.address }),
        ...(body.bankAccount !== undefined && { bankAccount: body.bankAccount }),
        ...(body.hireDate !== undefined && (() => {
          // 空文字列や無効な日付の場合はnullを設定
          if (!body.hireDate || body.hireDate === '') {
            return { hireDate: null }
          }
          const hireDate = new Date(body.hireDate)
          // 無効な日付の場合はnullを設定
          if (isNaN(hireDate.getTime())) {
            return { hireDate: null }
          }
          return { hireDate }
        })()),
        ...(body.paidLeaveGrantDate !== undefined && (() => {
          // 空文字列や無効な日付の場合はnullを設定
          if (!body.paidLeaveGrantDate || body.paidLeaveGrantDate === '') {
            return { paidLeaveGrantDate: null }
          }
          const grantDate = new Date(body.paidLeaveGrantDate)
          // 無効な日付の場合はnullを設定
          if (isNaN(grantDate.getTime())) {
            return { paidLeaveGrantDate: null }
          }
          return { paidLeaveGrantDate: grantDate }
        })()),
        ...(calculatedGrantDate && !body.paidLeaveGrantDate && { paidLeaveGrantDate: calculatedGrantDate }),
        ...(body.yearsOfService !== undefined && { yearsOfService: body.yearsOfService ? parseFloat(body.yearsOfService) : null }),
        ...(body.paidLeaveBalance !== undefined && { paidLeaveBalance: parseInt(body.paidLeaveBalance) }),
        ...(paidLeaveBalance !== undefined && { paidLeaveBalance }),
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
        workLocation: true,
        workLocationAddress: true,
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
