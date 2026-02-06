import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// 請求先企業マスタ更新
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

    // 請求先企業が存在し、同じ企業に属しているか確認
    const existingBillingClient = await prisma.billingClient.findFirst({
      where: {
        id,
        companyId: effectiveCompanyId,
      },
    })

    if (!existingBillingClient) {
      return NextResponse.json({ error: '請求先企業が見つかりません' }, { status: 404 })
    }

    const billingClient = await prisma.billingClient.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.code !== undefined && { code: body.code || null }),
        ...(body.address !== undefined && { address: body.address || null }),
        ...(body.phone !== undefined && { phone: body.phone || null }),
        ...(body.fax !== undefined && { fax: body.fax || null }),
        ...(body.contactPerson !== undefined && { contactPerson: body.contactPerson || null }),
        ...(body.bankName !== undefined && { bankName: body.bankName || null }),
        ...(body.bankBranch !== undefined && { bankBranch: body.bankBranch || null }),
        ...(body.accountNumber !== undefined && { accountNumber: body.accountNumber || null }),
        ...(body.accountHolder !== undefined && { accountHolder: body.accountHolder || null }),
        ...(body.taxRate !== undefined && { taxRate: parseFloat(body.taxRate) }),
        ...(body.invoiceNumberPrefix !== undefined && { invoiceNumberPrefix: body.invoiceNumberPrefix || null }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      },
    })

    return NextResponse.json({ success: true, billingClient })
  } catch (error: any) {
    console.error('Failed to update billing client:', error)
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

// 請求先企業マスタ削除
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

    // 請求先企業が存在し、同じ企業に属しているか確認
    const existingBillingClient = await prisma.billingClient.findFirst({
      where: {
        id,
        companyId: effectiveCompanyId,
      },
      include: {
        _count: {
          select: {
            employees: true,
            invoices: true,
          },
        },
      },
    })

    if (!existingBillingClient) {
      return NextResponse.json({ error: '請求先企業が見つかりません' }, { status: 404 })
    }

    // 従業員や請求書に紐づいている場合は削除不可
    if (existingBillingClient._count.employees > 0 || existingBillingClient._count.invoices > 0) {
      return NextResponse.json(
        { error: '従業員や請求書に紐づいているため削除できません' },
        { status: 400 }
      )
    }

    // 物理削除
    await prisma.billingClient.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete billing client:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
