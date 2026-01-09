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

    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const settings = await prisma.companySetting.findUnique({
        where: { companyId: session.user.companyId! },
    })

    if (!settings) {
      // 設定が存在しない場合はデフォルト値で作成
      const defaultSettings = await prisma.companySetting.create({
        data: {
          companyId: session.user.companyId!,
          payday: 25,
          overtimeThreshold40: 40,
          overtimeThreshold60: 60,
          consecutiveWorkAlert: 6,
          leaveExpiryAlertDays: 30,
          standardBreakMinutes: 60,
          allowPreOvertime: false,
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

    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()

    // バリデーション
    if (body.payday !== undefined && (body.payday < 1 || body.payday > 31)) {
      return NextResponse.json(
        { error: 'Payday must be between 1 and 31' },
        { status: 400 }
      )
    }

    const settings = await prisma.companySetting.upsert({
        where: { companyId: session.user.companyId! },
      update: {
        ...(body.payday !== undefined && { payday: body.payday }),
        ...(body.workStartTime !== undefined && {
          workStartTime: body.workStartTime
            ? new Date(`2000-01-01T${body.workStartTime}`)
            : null,
        }),
        ...(body.workEndTime !== undefined && {
          workEndTime: body.workEndTime
            ? new Date(`2000-01-01T${body.workEndTime}`)
            : null,
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
        ...(body.allowPreOvertime !== undefined && {
          allowPreOvertime: body.allowPreOvertime,
        }),
      },
      create: {
        companyId: session.user.companyId!,
        payday: body.payday || 25,
        workStartTime: body.workStartTime
          ? new Date(`2000-01-01T${body.workStartTime}`)
          : null,
        workEndTime: body.workEndTime
          ? new Date(`2000-01-01T${body.workEndTime}`)
          : null,
        standardBreakMinutes: body.standardBreakMinutes || 60,
        overtimeThreshold40: body.overtimeThreshold40 || 40,
        overtimeThreshold60: body.overtimeThreshold60 || 60,
        consecutiveWorkAlert: body.consecutiveWorkAlert || 6,
        leaveExpiryAlertDays: body.leaveExpiryAlertDays || 30,
        allowPreOvertime: body.allowPreOvertime ?? false,
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

