import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// 請求書取得
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

    const invoiceId = parseInt(params.id)

    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        companyId: effectiveCompanyId,
      },
      include: {
        billingClient: true,
        details: {
          include: {
            employee: {
              select: {
                id: true,
                name: true,
                employeeNumber: true,
              },
            },
          },
        },
      },
    })

    if (!invoice) {
      return NextResponse.json(
        { error: '請求書が見つかりません' },
        { status: 404 }
      )
    }

    return NextResponse.json({ invoice })
  } catch (error) {
    console.error('Failed to fetch invoice:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// 請求書更新
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

    const invoiceId = parseInt(params.id)
    const body = await request.json()

    // 請求書が存在し、この企業に紐づいているか確認
    const existingInvoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        companyId: effectiveCompanyId,
      },
    })

    if (!existingInvoice) {
      return NextResponse.json(
        { error: '請求書が見つかりません' },
        { status: 404 }
      )
    }

    // 請求書番号の重複チェック（自分自身を除く）
    if (body.invoiceNumber && body.invoiceNumber !== existingInvoice.invoiceNumber) {
      const duplicateInvoice = await prisma.invoice.findUnique({
        where: { invoiceNumber: body.invoiceNumber },
      })

      if (duplicateInvoice) {
        return NextResponse.json(
          { error: 'この請求書番号は既に使用されています' },
          { status: 409 }
        )
      }
    }

    // 更新データの準備
    const updateData: any = {}
    if (body.subject !== undefined) updateData.subject = body.subject
    if (body.periodStart !== undefined) updateData.periodStart = new Date(body.periodStart)
    if (body.periodEnd !== undefined) updateData.periodEnd = new Date(body.periodEnd)
    if (body.paymentTerms !== undefined) updateData.paymentTerms = body.paymentTerms
    if (body.dueDate !== undefined) updateData.dueDate = new Date(body.dueDate)
    if (body.subtotal !== undefined) updateData.subtotal = parseInt(body.subtotal)
    if (body.taxAmount !== undefined) updateData.taxAmount = parseInt(body.taxAmount)
    if (body.totalAmount !== undefined) updateData.totalAmount = parseInt(body.totalAmount)
    if (body.transportationCost !== undefined) updateData.transportationCost = parseInt(body.transportationCost) || 0
    if (body.adjustmentAmount !== undefined) updateData.adjustmentAmount = parseInt(body.adjustmentAmount) || 0
    if (body.status !== undefined) {
      updateData.status = body.status
      // 発行済みに変更する場合は発行日を設定
      if (body.status === 'issued' && !existingInvoice.issuedAt) {
        updateData.issuedAt = new Date()
      }
    }
    if (body.invoiceNumber !== undefined) updateData.invoiceNumber = body.invoiceNumber
    if (body.billingClientId !== undefined) {
      // 請求先企業が存在し、この企業に紐づいているか確認
      const billingClient = await prisma.billingClient.findFirst({
        where: {
          id: parseInt(body.billingClientId),
          companyId: effectiveCompanyId,
        },
      })

      if (!billingClient) {
        return NextResponse.json(
          { error: '請求先企業が見つかりません' },
          { status: 404 }
        )
      }
      updateData.billingClientId = parseInt(body.billingClientId)
    }

    // 明細の更新処理
    if (body.details && Array.isArray(body.details)) {
      // 既存の明細を削除
      await prisma.invoiceDetail.deleteMany({
        where: { invoiceId },
      })

      // 新しい明細を作成
      updateData.details = {
        create: body.details.map((detail: any) => ({
          employeeId: detail.employeeId,
          workDays: detail.workDays || 0,
          basicRate: detail.basicRate || 0,
          basicAmount: detail.basicAmount || 0,
          overtimeHours: detail.overtimeHours || 0,
          overtimeRate: detail.overtimeRate || null,
          overtimeAmount: detail.overtimeAmount || 0,
          absenceDays: detail.absenceDays || 0,
          absenceDeduction: detail.absenceDeduction || 0,
          lateEarlyDeduction: detail.lateEarlyDeduction || 0,
          subtotal: detail.subtotal || 0,
        })),
      }
    }

    // 請求書を更新
    const invoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: updateData,
      include: {
        billingClient: {
          select: {
            id: true,
            name: true,
            taxRate: true,
          },
        },
        details: {
          include: {
            employee: {
              select: {
                id: true,
                name: true,
                employeeNumber: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json({ success: true, invoice })
  } catch (error: any) {
    console.error('Failed to update invoice:', error)
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'この請求書番号は既に使用されています' },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message },
      { status: 500 }
    )
  }
}

// 請求書削除
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

    const invoiceId = parseInt(params.id)

    // 請求書が存在し、この企業に紐づいているか確認
    const existingInvoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        companyId: effectiveCompanyId,
      },
    })

    if (!existingInvoice) {
      return NextResponse.json(
        { error: '請求書が見つかりません' },
        { status: 404 }
      )
    }

    // 請求書を削除（明細も自動的に削除される）
    await prisma.invoice.delete({
      where: { id: invoiceId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete invoice:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
