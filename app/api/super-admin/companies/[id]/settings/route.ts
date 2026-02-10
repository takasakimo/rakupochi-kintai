import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// スーパー管理者用：企業設定取得
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // スーパー管理者のみアクセス可能
    const isSuperAdmin = session.user.role === 'super_admin' || 
                         session.user.email === 'superadmin@rakupochi.com'

    if (!isSuperAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const companyId = parseInt(params.id)

    const settings = await prisma.companySetting.findUnique({
      where: { companyId },
    })

    if (!settings) {
      // 設定が存在しない場合はデフォルト値で作成
      const defaultSettings = await prisma.companySetting.create({
        data: {
          companyId,
          payday: 25,
          overtimeThreshold40: 40,
          overtimeThreshold60: 60,
          consecutiveWorkAlert: 6,
          leaveExpiryAlertDays: 30,
          standardBreakMinutes: 60,
          allowPreOvertime: false,
          enableSalesVisit: true,
          enableWakeUpDeparture: true,
          enableInvoice: false,
          paidLeaveFirstGrantMonths: 6,
          paidLeaveGrantDays: {
            year1: 10,
            year2: 11,
            year3: 12,
            year4: 14,
            year5: 16,
            year6: 18,
            year7: 20,
          },
          includePaidLeaveInInvoice: false,
        },
      })
      return NextResponse.json({ settings: defaultSettings })
    }

    return NextResponse.json({ settings })
  } catch (error) {
    console.error('Get company settings error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// スーパー管理者用：企業設定更新（前残業、営業先入退店、起床・出発報告のみ）
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // スーパー管理者のみアクセス可能
    const isSuperAdmin = session.user.role === 'super_admin' || 
                         session.user.email === 'superadmin@rakupochi.com'

    if (!isSuperAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const companyId = parseInt(params.id)
    const body = await request.json()

    // スーパー管理者が更新できるのは以下の5つの設定のみ
    const updateData: {
      allowPreOvertime?: boolean
      enableSalesVisit?: boolean
      enableWakeUpDeparture?: boolean
      enableInvoice?: boolean
      includePaidLeaveInInvoice?: boolean
    } = {}

    if (body.allowPreOvertime !== undefined) {
      updateData.allowPreOvertime = body.allowPreOvertime
    }
    if (body.enableSalesVisit !== undefined) {
      updateData.enableSalesVisit = body.enableSalesVisit
    }
    if (body.enableWakeUpDeparture !== undefined) {
      updateData.enableWakeUpDeparture = body.enableWakeUpDeparture
    }
    if (body.enableInvoice !== undefined) {
      updateData.enableInvoice = body.enableInvoice
    }
    if (body.includePaidLeaveInInvoice !== undefined) {
      updateData.includePaidLeaveInInvoice = body.includePaidLeaveInInvoice
    }

    const settings = await prisma.companySetting.upsert({
      where: { companyId },
      update: updateData,
      create: {
        companyId,
        payday: 25,
        overtimeThreshold40: 40,
        overtimeThreshold60: 60,
        consecutiveWorkAlert: 6,
        leaveExpiryAlertDays: 30,
        standardBreakMinutes: 60,
        allowPreOvertime: body.allowPreOvertime ?? false,
        enableSalesVisit: body.enableSalesVisit ?? true,
        enableWakeUpDeparture: body.enableWakeUpDeparture ?? true,
        enableInvoice: body.enableInvoice ?? false,
        paidLeaveFirstGrantMonths: 6,
        paidLeaveGrantDays: {
          year1: 10,
          year2: 11,
          year3: 12,
          year4: 14,
          year5: 16,
          year6: 18,
          year7: 20,
        },
        includePaidLeaveInInvoice: body.includePaidLeaveInInvoice ?? false,
      },
    })

    return NextResponse.json({
      success: true,
      settings,
    })
  } catch (error) {
    console.error('Update company settings error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
