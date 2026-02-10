import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// 企業設定取得
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

    const settings = await prisma.companySetting.findUnique({
        where: { companyId: effectiveCompanyId },
    })

    if (!settings) {
      // 設定が存在しない場合はデフォルト値で作成
      const defaultSettings = await prisma.companySetting.create({
        data: {
          companyId: effectiveCompanyId,
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
    console.error('Get settings error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// 企業設定更新
export async function PATCH(request: NextRequest) {
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

    // バリデーション
    if (body.payday !== undefined && (body.payday < 1 || body.payday > 31)) {
      return NextResponse.json(
        { error: 'Payday must be between 1 and 31' },
        { status: 400 }
      )
    }

    // 時刻の処理（空文字列や無効な値の場合はnull）
    const parseTime = (time: string | null | undefined): Date | null => {
      if (!time || time.trim() === '') {
        return null
      }
      try {
        const date = new Date(`2000-01-01T${time}`)
        if (isNaN(date.getTime())) {
          return null
        }
        return date
      } catch {
        return null
      }
    }

    const settings = await prisma.companySetting.upsert({
        where: { companyId: effectiveCompanyId },
      update: {
        ...(body.payday !== undefined && { payday: body.payday }),
        ...(body.workStartTime !== undefined && {
          workStartTime: parseTime(body.workStartTime),
        }),
        ...(body.workEndTime !== undefined && {
          workEndTime: parseTime(body.workEndTime),
        }),
        ...(body.standardBreakMinutes !== undefined && {
          standardBreakMinutes: body.standardBreakMinutes,
        }),
        ...(body.overtimeThreshold40 !== undefined && {
          overtimeThreshold40: body.overtimeThreshold40,
        }),
        ...(body.overtimeThreshold60 !== undefined && {
          overtimeThreshold60: body.overtimeThreshold60,
        }),
        ...(body.consecutiveWorkAlert !== undefined && {
          consecutiveWorkAlert: body.consecutiveWorkAlert,
        }),
        ...(body.leaveExpiryAlertDays !== undefined && {
          leaveExpiryAlertDays: body.leaveExpiryAlertDays,
        }),
        ...(body.paidLeaveFirstGrantMonths !== undefined && {
          paidLeaveFirstGrantMonths: body.paidLeaveFirstGrantMonths,
        }),
        ...(body.paidLeaveGrantDays !== undefined && {
          paidLeaveGrantDays: body.paidLeaveGrantDays,
        }),
        ...(body.includePaidLeaveInInvoice !== undefined && {
          includePaidLeaveInInvoice: body.includePaidLeaveInInvoice,
        }),
      },
      create: {
        companyId: effectiveCompanyId,
        payday: body.payday || 25,
        workStartTime: parseTime(body.workStartTime),
        workEndTime: parseTime(body.workEndTime),
        standardBreakMinutes: body.standardBreakMinutes || 60,
        overtimeThreshold40: body.overtimeThreshold40 || 40,
        overtimeThreshold60: body.overtimeThreshold60 || 60,
        consecutiveWorkAlert: body.consecutiveWorkAlert || 6,
        leaveExpiryAlertDays: body.leaveExpiryAlertDays || 30,
        paidLeaveFirstGrantMonths: body.paidLeaveFirstGrantMonths ?? 6,
        paidLeaveGrantDays: body.paidLeaveGrantDays || {
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
    console.error('Update settings error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

