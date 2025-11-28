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
          hireDate: true,
          transportationRoutes: true,
          transportationCost: true,
          isActive: true,
        },
        orderBy: {
          employeeNumber: 'asc',
        },
      })
      console.log('[Employees] Found employees:', employees.length)
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
      transportationRoutes,
      transportationCost,
    } = body

    // バリデーション
    if (!employeeNumber || !name || !email || !password) {
      return NextResponse.json(
        { error: '必須項目が不足しています' },
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
        phone: phone || null,
        birthDate: birthDate ? new Date(birthDate) : null,
        address: address || null,
        transportationRoutes: transportationRoutes || null,
        transportationCost: transportationCost ? parseInt(transportationCost) : null,
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
