import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

// 従業員一覧取得
export async function GET() {
  try {
    console.log('[Employees] GET /api/admin/employees - Starting')
    console.log('[Employees] DATABASE_URL exists:', !!process.env.DATABASE_URL)
    console.log('[Employees] DATABASE_URL (first 50 chars):', process.env.DATABASE_URL?.substring(0, 50))
    
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      console.log('[Employees] Unauthorized: no session or user')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'admin') {
      console.log('[Employees] Forbidden: not admin role')
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    console.log('[Employees] Company ID:', session.user.companyId)

    let employees
    try {
      console.log('[Employees] Attempting to query database...')
      employees = await prisma.employee.findMany({
        where: {
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
          bankAccount: true,
          hireDate: true,
          paidLeaveGrantDate: true,
          yearsOfService: true,
          paidLeaveBalance: true,
          transportationRoutes: true,
          transportationCost: true,
          isActive: true,
        },
        orderBy: {
          employeeNumber: 'asc',
        },
      })
      console.log('[Employees] Found employees:', employees.length)

      // 有給消滅ロジック（取得から2年経過した有給を自動消滅）
      const now = new Date()
      for (const employee of employees) {
        if (employee.paidLeaveGrantDate && employee.paidLeaveBalance > 0) {
          const grantDate = new Date(employee.paidLeaveGrantDate)
          const twoYearsLater = new Date(grantDate)
          twoYearsLater.setFullYear(twoYearsLater.getFullYear() + 2)
          
          // 2年経過している場合、有給残数を0にリセット
          if (now > twoYearsLater) {
            await prisma.employee.update({
              where: { id: employee.id },
              data: { paidLeaveBalance: 0 },
            })
            employee.paidLeaveBalance = 0
          }
        }
      }
    } catch (error: any) {
      console.error('[Employees] Database query error:', error)
      console.error('[Employees] Error name:', error?.name)
      console.error('[Employees] Error code:', error?.code)
      console.error('[Employees] Error message:', error?.message)
      if (error?.stack) {
        console.error('[Employees] Error stack (first 500 chars):', error.stack.substring(0, 500))
      }
      return NextResponse.json(
        { 
          error: 'Failed to fetch employees',
          details: error?.message || 'Unknown database error',
          code: error?.code || 'UNKNOWN',
          name: error?.name || 'Unknown',
        },
        { status: 500 }
      )
    }

    return NextResponse.json({ employees })
  } catch (error: any) {
    console.error('[Employees] Unexpected error:', error)
    console.error('[Employees] Error name:', error?.name)
    console.error('[Employees] Error message:', error?.message)
    console.error('[Employees] Error code:', error?.code)
    if (error?.stack) {
      console.error('[Employees] Error stack (first 500 chars):', error.stack.substring(0, 500))
    }
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error?.message || 'Unknown error',
        code: error?.code || 'UNKNOWN',
        name: error?.name || 'Unknown',
      },
      { status: 500 }
    )
  }
}

// 従業員作成
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const {
      employeeNumber,
      name,
      email,
      password,
      role,
      department,
      position,
      phone,
      birthDate,
      address,
      bankAccount,
      transportationRoutes,
      transportationCost,
      hireDate,
      paidLeaveGrantDate,
      yearsOfService,
      paidLeaveBalance,
    } = body

    // 勤続年数から有給付与日を自動計算
    let calculatedGrantDate = null
    if (hireDate && yearsOfService) {
      const hire = new Date(hireDate)
      const years = parseFloat(yearsOfService)
      const grantDate = new Date(hire)
      grantDate.setFullYear(grantDate.getFullYear() + Math.floor(years))
      grantDate.setMonth(grantDate.getMonth() + Math.floor((years % 1) * 12))
      calculatedGrantDate = grantDate
    } else if (hireDate && !paidLeaveGrantDate) {
      // 勤続年数が未設定でも入社日があれば、入社日を基準に計算
      const hire = new Date(hireDate)
      calculatedGrantDate = hire
    }

    // バリデーション
    if (!employeeNumber || !name || !email || !password || !phone || !address) {
      return NextResponse.json(
        { error: '必須項目が不足しています（社員番号、氏名、メールアドレス、パスワード、電話番号、住所は必須です）' },
        { status: 400 }
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

    // 社員番号の重複チェック
    const existingEmployeeNumber = await prisma.employee.findUnique({
      where: { employeeNumber },
    })

    if (existingEmployeeNumber) {
      return NextResponse.json(
        { error: 'この社員番号は既に使用されています' },
        { status: 409 }
      )
    }

    // パスワードのハッシュ化
    const hashedPassword = await bcrypt.hash(password, 10)

    const employee = await prisma.employee.create({
      data: {
        companyId: session.user.companyId,
        employeeNumber,
        name,
        email,
        password: hashedPassword,
        role: role || 'employee',
        department: department || null,
        position: position || null,
        phone: phone,
        birthDate: birthDate ? new Date(birthDate) : null,
        address: address,
        bankAccount: bankAccount || null,
        transportationRoutes: transportationRoutes || null,
        transportationCost: transportationCost ? parseInt(transportationCost) : null,
        hireDate: hireDate ? new Date(hireDate) : null,
        paidLeaveGrantDate: paidLeaveGrantDate ? new Date(paidLeaveGrantDate) : calculatedGrantDate,
        yearsOfService: yearsOfService ? parseFloat(yearsOfService) : null,
        paidLeaveBalance: paidLeaveBalance ? parseInt(paidLeaveBalance) : 0,
        isActive: true,
      },
    })

    return NextResponse.json({
      success: true,
      employee: {
        id: employee.id,
        employeeNumber: employee.employeeNumber,
        name: employee.name,
        email: employee.email,
        role: employee.role,
        department: employee.department,
        position: employee.position,
        phone: employee.phone,
        birthDate: employee.birthDate,
        address: employee.address,
        hireDate: employee.hireDate,
        transportationRoutes: employee.transportationRoutes,
        transportationCost: employee.transportationCost,
        hireDate: employee.hireDate,
        paidLeaveGrantDate: employee.paidLeaveGrantDate,
        yearsOfService: employee.yearsOfService,
        paidLeaveBalance: employee.paidLeaveBalance,
        isActive: employee.isActive,
      },
    })
  } catch (error: any) {
    console.error('Create employee error:', error)
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
