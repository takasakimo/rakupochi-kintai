import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// 請求書一覧取得
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
    const status = searchParams.get('status')
    const billingClientId = searchParams.get('billingClientId')

    const where: any = {
      companyId: effectiveCompanyId,
    }

    if (status && status !== 'all') {
      where.status = status
    }

    if (billingClientId && billingClientId !== 'all') {
      where.billingClientId = parseInt(billingClientId)
    }

    const invoices = await prisma.invoice.findMany({
      where,
      select: {
        id: true,
        invoiceNumber: true,
        subject: true,
        periodStart: true,
        periodEnd: true,
        dueDate: true,
        subtotal: true,
        taxAmount: true,
        totalAmount: true,
        status: true,
        issuedAt: true,
        createdAt: true,
        billingClient: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            details: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({ invoices })
  } catch (error: any) {
    console.error('Failed to fetch invoices:', error)
    // セキュリティ: エラーの詳細を返さない
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// 請求書作成
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
      billingClientId,
      invoiceNumber,
      subject,
      periodStart,
      periodEnd,
      paymentTerms,
      dueDate,
      subtotal,
      taxAmount,
      totalAmount,
      transportationCost,
      adjustmentAmount,
      status,
      details,
    } = body

    // バリデーション
    if (!billingClientId) {
      return NextResponse.json(
        { error: '請求先企業は必須です' },
        { status: 400 }
      )
    }

    if (!invoiceNumber) {
      return NextResponse.json(
        { error: '請求書番号は必須です' },
        { status: 400 }
      )
    }

    if (!subject) {
      return NextResponse.json(
        { error: '件名は必須です' },
        { status: 400 }
      )
    }

    // 請求先企業が存在し、この企業に紐づいているか確認
    const billingClient = await prisma.billingClient.findFirst({
      where: {
        id: parseInt(billingClientId),
        companyId: effectiveCompanyId,
      },
    })

    if (!billingClient) {
      return NextResponse.json(
        { error: '請求先企業が見つかりません' },
        { status: 404 }
      )
    }

    // 請求書番号の重複チェック
    const existingInvoice = await prisma.invoice.findUnique({
      where: { invoiceNumber },
    })

    if (existingInvoice) {
      return NextResponse.json(
        { error: 'この請求書番号は既に使用されています' },
        { status: 409 }
      )
    }

    // 請求書を作成（明細も一緒に作成）
    const invoice = await prisma.invoice.create({
      data: {
        companyId: effectiveCompanyId,
        billingClientId: parseInt(billingClientId),
        invoiceNumber,
        subject,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        paymentTerms: paymentTerms || '月末締め翌月末払い',
        dueDate: new Date(dueDate),
        subtotal: parseInt(subtotal) || 0,
        taxAmount: parseInt(taxAmount) || 0,
        totalAmount: parseInt(totalAmount) || 0,
        transportationCost: transportationCost ? parseInt(transportationCost) : 0,
        adjustmentAmount: adjustmentAmount ? parseInt(adjustmentAmount) : 0,
        status: status || 'draft',
        details: details && Array.isArray(details) ? {
          create: details.map((detail: any) => ({
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
            notes: detail.notes || null,
          })),
        } : undefined,
      },
      include: {
        billingClient: {
          select: {
            id: true,
            name: true,
          },
        },
        details: true,
      },
    })

    return NextResponse.json({ success: true, invoice })
  } catch (error: any) {
    console.error('Failed to create invoice:', error)
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'この請求書番号は既に使用されています' },
        { status: 409 }
      )
    }
    // セキュリティ: エラーの詳細を返さない
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
