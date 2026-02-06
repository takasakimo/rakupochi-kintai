import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// 請求先企業マスタ一覧取得
export async function GET(request: NextRequest) {
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

    const searchParams = request.nextUrl.searchParams
    const all = searchParams.get('all') === 'true'

    const billingClients = await prisma.billingClient.findMany({
      where: {
        companyId: effectiveCompanyId,
        ...(all ? {} : { isActive: true }),
      },
      include: {
        _count: {
          select: {
            employees: true,
            invoices: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    })

    return NextResponse.json({ billingClients })
  } catch (error) {
    console.error('Failed to fetch billing clients:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// 請求先企業マスタ作成
export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const {
      name,
      code,
      address,
      phone,
      fax,
      contactPerson,
      bankName,
      bankBranch,
      accountNumber,
      accountHolder,
      taxRate,
      invoiceNumberPrefix,
      isActive,
    } = body

    if (!name) {
      return NextResponse.json(
        { error: '請求先企業名は必須です' },
        { status: 400 }
      )
    }

    const billingClient = await prisma.billingClient.create({
      data: {
        companyId: effectiveCompanyId,
        name,
        code: code || null,
        address: address || null,
        phone: phone || null,
        fax: fax || null,
        contactPerson: contactPerson || null,
        bankName: bankName || null,
        bankBranch: bankBranch || null,
        accountNumber: accountNumber || null,
        accountHolder: accountHolder || null,
        taxRate: taxRate !== undefined ? parseFloat(taxRate) : 0.1,
        invoiceNumberPrefix: invoiceNumberPrefix || null,
        isActive: isActive !== undefined ? isActive : true,
      },
    })

    return NextResponse.json({ success: true, billingClient })
  } catch (error: any) {
    console.error('Failed to create billing client:', error)
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
