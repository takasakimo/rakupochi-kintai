import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// 請求書番号自動生成
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
    const billingClientId = searchParams.get('billingClientId')
    const periodStart = searchParams.get('periodStart')
    const periodEnd = searchParams.get('periodEnd')

    if (!billingClientId) {
      return NextResponse.json(
        { error: '請求先企業IDは必須です' },
        { status: 400 }
      )
    }

    // 請求先企業を取得
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

    // 請求期間から年を取得
    const year = periodStart 
      ? new Date(periodStart).getFullYear()
      : new Date().getFullYear()

    // プレフィックスを取得（なければデフォルト）
    const prefix = billingClient.invoiceNumberPrefix || 'INV'

    // 同じプレフィックスと年の請求書を検索して、最大の連番を取得
    const existingInvoices = await prisma.invoice.findMany({
      where: {
        billingClientId: parseInt(billingClientId),
        invoiceNumber: {
          startsWith: `${prefix}-${year}-`,
        },
      },
      orderBy: {
        invoiceNumber: 'desc',
      },
      take: 1,
    })

    let nextNumber = 1
    if (existingInvoices.length > 0) {
      // 既存の請求書番号から連番を抽出
      const lastInvoiceNumber = existingInvoices[0].invoiceNumber
      const match = lastInvoiceNumber.match(/-(\d+)$/)
      if (match) {
        nextNumber = parseInt(match[1]) + 1
      }
    }

    // 請求書番号を生成（例: INV-2026-001）
    const invoiceNumber = `${prefix}-${year}-${String(nextNumber).padStart(3, '0')}`

    return NextResponse.json({ invoiceNumber })
  } catch (error) {
    console.error('Failed to generate invoice number:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
