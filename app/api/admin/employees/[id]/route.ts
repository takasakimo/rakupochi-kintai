import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { processPaidLeaveOnGrantDate, calculatePaidLeaveDays, calculateFirstGrantDate, calculateTotalPaidLeaveBalance } from '@/lib/paid-leave'

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

    // スーパー管理者または管理者のみアクセス可能
    const isSuperAdmin = session.user.role === 'super_admin' || 
                         session.user.email === 'superadmin@rakupochi.com'
    const isAdmin = session.user.role === 'admin'

    if (!isSuperAdmin && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // スーパー管理者の場合はselectedCompanyIdを使用、通常の管理者の場合はcompanyIdを使用
    const effectiveCompanyId = isSuperAdmin 
      ? session.user.selectedCompanyId 
      : session.user.companyId

    if (!effectiveCompanyId) {
      return NextResponse.json(
        { error: isSuperAdmin ? '企業が選択されていません' : 'Company ID not found' },
        { status: 400 }
      )
    }

    const id = parseInt(params.id)

    const employee = await prisma.employee.findFirst({
      where: {
        id,
        companyId: effectiveCompanyId,
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

    // 会社設定を取得
    const companySettings = await prisma.companySetting.findUnique({
      where: { companyId: effectiveCompanyId },
      select: {
        paidLeaveFirstGrantMonths: true,
        paidLeaveGrantDays: true,
      },
    })

    // 有給の起算日処理（起算日になった際に消滅分を減らして新規付与分を追加）
    if (employee && employee.paidLeaveGrantDate) {
      const grantDate = new Date(employee.paidLeaveGrantDate)
      const grantDaysConfig = companySettings?.paidLeaveGrantDays as { year1?: number; year2?: number; year3?: number; year4?: number; year5?: number; year6?: number; year7?: number } | null
      const firstGrantMonths = companySettings?.paidLeaveFirstGrantMonths ?? 6
      
      const result = processPaidLeaveOnGrantDate(
        employee.paidLeaveBalance,
        grantDate,
        employee.yearsOfService,
        grantDaysConfig,
        firstGrantMonths
      )

      if (result.shouldUpdate) {
        await prisma.employee.update({
          where: { id: employee.id },
          data: { 
            paidLeaveBalance: result.newBalance,
            // 付与日を1年進める（次の起算日）
            paidLeaveGrantDate: new Date(grantDate.getFullYear() + 1, grantDate.getMonth(), grantDate.getDate())
          },
        })
        employee.paidLeaveBalance = result.newBalance
        console.log(`[Employee] Processed paid leave on grant date for employee ${employee.id}: expired ${result.expiredDays} days, granted ${result.grantedDays} days, new balance: ${result.newBalance}`)
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

    // スーパー管理者または管理者のみアクセス可能
    const isSuperAdmin = session.user.role === 'super_admin' || 
                         session.user.email === 'superadmin@rakupochi.com'
    const isAdmin = session.user.role === 'admin'

    if (!isSuperAdmin && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // スーパー管理者の場合はselectedCompanyIdを使用、通常の管理者の場合はcompanyIdを使用
    const effectiveCompanyId = isSuperAdmin 
      ? session.user.selectedCompanyId 
      : session.user.companyId

    if (!effectiveCompanyId) {
      return NextResponse.json(
        { error: isSuperAdmin ? '企業が選択されていません' : 'Company ID not found' },
        { status: 400 }
      )
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
        companyId: effectiveCompanyId,
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

    // 会社設定を取得
    const companySettings = await prisma.companySetting.findUnique({
      where: { companyId: effectiveCompanyId },
      select: {
        paidLeaveFirstGrantMonths: true,
        paidLeaveGrantDays: true,
      },
    })

    const firstGrantMonths = companySettings?.paidLeaveFirstGrantMonths ?? 6

    // 入社日から有給付与日を自動計算（設定に基づく）
    let calculatedGrantDate = null
    const hireDateValue = body.hireDate ? (body.hireDate === '' ? null : new Date(body.hireDate)) : existingEmployee.hireDate
    const hireDate = hireDateValue && !isNaN(new Date(hireDateValue).getTime()) ? new Date(hireDateValue) : null
    const yearsOfService = body.yearsOfService !== undefined ? parseFloat(body.yearsOfService) : existingEmployee.yearsOfService
    
    if (hireDate && !body.paidLeaveGrantDate && !existingEmployee.paidLeaveGrantDate) {
      // 入社日から初回付与日を計算（設定の初回付与月数を使用）
      calculatedGrantDate = calculateFirstGrantDate(hireDate, firstGrantMonths)
    }

    // 有給残数の処理
    // 勤続年数が変更された場合、有給残数を自動計算
    const finalGrantDate = calculatedGrantDate || 
      (body.paidLeaveGrantDate ? new Date(body.paidLeaveGrantDate) : existingEmployee.paidLeaveGrantDate)
    
    let paidLeaveBalance = body.paidLeaveBalance !== undefined 
      ? parseInt(body.paidLeaveBalance) 
      : existingEmployee.paidLeaveBalance

    // 勤続年数が変更された場合、有給残数を自動計算
    const yearsOfServiceChanged = body.yearsOfService !== undefined && 
      body.yearsOfService !== existingEmployee.yearsOfService?.toString()
    
    if (yearsOfServiceChanged && yearsOfService && finalGrantDate) {
      const grantDaysConfig = companySettings?.paidLeaveGrantDays as { year1?: number; year2?: number; year3?: number; year4?: number; year5?: number; year6?: number; year7?: number } | null
      paidLeaveBalance = calculateTotalPaidLeaveBalance(
        yearsOfService,
        grantDaysConfig,
        firstGrantMonths
      )
      console.log(`[Employee Update] Recalculated paid leave balance: ${paidLeaveBalance} days for yearsOfService: ${yearsOfService}`)
    }
    
    // 有給付与日が設定されている場合、起算日処理を実行
    if (finalGrantDate) {
      const grantDate = finalGrantDate instanceof Date ? finalGrantDate : new Date(finalGrantDate)
      const grantDaysConfig = companySettings?.paidLeaveGrantDays as { year1?: number; year2?: number; year3?: number; year4?: number; year5?: number; year6?: number; year7?: number } | null
      
      const result = processPaidLeaveOnGrantDate(
        paidLeaveBalance,
        grantDate,
        yearsOfService,
        grantDaysConfig,
        firstGrantMonths
      )

      if (result.shouldUpdate) {
        paidLeaveBalance = result.newBalance
        // 付与日を1年進める（次の起算日）
        calculatedGrantDate = new Date(grantDate.getFullYear() + 1, grantDate.getMonth(), grantDate.getDate())
        console.log(`[Employee Update] Processed paid leave on grant date for employee ${id}: expired ${result.expiredDays} days, granted ${result.grantedDays} days, new balance: ${result.newBalance}`)
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
        ...(body.billingClientId !== undefined && { billingClientId: body.billingClientId ? parseInt(body.billingClientId) : null }),
        ...(body.billingRate !== undefined && { billingRate: body.billingRate ? parseInt(body.billingRate) : null }),
        ...(body.billingRateType !== undefined && { billingRateType: body.billingRateType }),
        ...(body.overtimeRate !== undefined && { overtimeRate: body.overtimeRate ? parseFloat(body.overtimeRate) : null }),
        ...(body.hasOvertime !== undefined && { hasOvertime: body.hasOvertime }),
        ...(body.baseWorkDays !== undefined && { baseWorkDays: body.baseWorkDays ? parseInt(body.baseWorkDays) : null }),
        ...(body.invoiceItemName !== undefined && { invoiceItemName: body.invoiceItemName || null }),
        ...(body.businessName !== undefined && { businessName: body.businessName || null }),
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
        billingClientId: true,
        billingRate: true,
        billingRateType: true,
        overtimeRate: true,
        hasOvertime: true,
        baseWorkDays: true,
        invoiceItemName: true,
        businessName: true,
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

    // スーパー管理者または管理者のみアクセス可能
    const isSuperAdmin = session.user.role === 'super_admin' || 
                         session.user.email === 'superadmin@rakupochi.com'
    const isAdmin = session.user.role === 'admin'

    if (!isSuperAdmin && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // スーパー管理者の場合はselectedCompanyIdを使用、通常の管理者の場合はcompanyIdを使用
    const effectiveCompanyId = isSuperAdmin 
      ? session.user.selectedCompanyId 
      : session.user.companyId

    if (!effectiveCompanyId) {
      return NextResponse.json(
        { error: isSuperAdmin ? '企業が選択されていません' : 'Company ID not found' },
        { status: 400 }
      )
    }

    const id = parseInt(params.id)

    // 従業員が存在し、同じ企業に属しているか確認
    const employee = await prisma.employee.findFirst({
      where: {
        id,
        companyId: effectiveCompanyId,
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
