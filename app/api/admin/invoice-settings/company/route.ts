import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// 自社情報取得
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

    const company = await prisma.company.findUnique({
      where: { id: effectiveCompanyId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        issuerName: true,
        taxId: true,
        bankName: true,
        bankBranch: true,
        accountNumber: true,
        accountHolder: true,
        invoiceItemNameTemplate: true,
      },
    })

    if (!company) {
      return NextResponse.json(
        { error: '企業が見つかりません' },
        { status: 404 }
      )
    }

    return NextResponse.json({ company })
  } catch (error) {
    console.error('Failed to fetch company info:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// 自社情報更新
export async function PUT(request: NextRequest) {
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
      email,
      phone,
      address,
      issuerName,
      taxId,
      bankName,
      bankBranch,
      accountNumber,
      accountHolder,
      invoiceItemNameTemplate,
    } = body

    // 企業名は必須
    if (name === undefined || name === null || name.trim() === '') {
      return NextResponse.json(
        { error: '企業名は必須です' },
        { status: 400 }
      )
    }

    const company = await prisma.company.update({
      where: { id: effectiveCompanyId },
      data: {
        name: name.trim(),
        email: email && email.trim() !== '' ? email.trim() : null,
        phone: phone && phone.trim() !== '' ? phone.trim() : null,
        address: address && address.trim() !== '' ? address.trim() : null,
        issuerName: issuerName && issuerName.trim() !== '' ? issuerName.trim() : null,
        taxId: taxId && taxId.trim() !== '' ? taxId.trim() : null,
        bankName: bankName && bankName.trim() !== '' ? bankName.trim() : null,
        bankBranch: bankBranch && bankBranch.trim() !== '' ? bankBranch.trim() : null,
        accountNumber: accountNumber && accountNumber.trim() !== '' ? accountNumber.trim() : null,
        accountHolder: accountHolder && accountHolder.trim() !== '' ? accountHolder.trim() : null,
        invoiceItemNameTemplate: invoiceItemNameTemplate && invoiceItemNameTemplate.trim() !== '' ? invoiceItemNameTemplate.trim() : null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        issuerName: true,
        taxId: true,
        bankName: true,
        bankBranch: true,
        accountNumber: true,
        accountHolder: true,
        invoiceItemNameTemplate: true,
      },
    })

    return NextResponse.json({ company })
  } catch (error) {
    console.error('Failed to update company info:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
