import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// 通知を既読にする
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const id = parseInt(params.id)
    const body = await request.json()

    // 通知の所有者を確認
    const notification = await prisma.notification.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            companyId: true,
          },
        },
      },
    })

    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    }

    // 管理者は全従業員の通知を操作可能、従業員は自分のみ
    if (
      session.user.role !== 'admin' &&
      notification.employeeId !== parseInt(session.user.id)
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 企業IDの確認
    if (notification.employee.companyId !== session.user.companyId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const updatedNotification = await prisma.notification.update({
      where: { id },
      data: {
        isRead: body.isRead !== undefined ? body.isRead : true,
      },
    })

    return NextResponse.json({
      success: true,
      notification: updatedNotification,
    })
  } catch (error) {
    console.error('Update notification error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// 通知を削除
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const id = parseInt(params.id)

    // 通知の所有者を確認
    const notification = await prisma.notification.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            companyId: true,
          },
        },
      },
    })

    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    }

    // 管理者は全従業員の通知を削除可能、従業員は自分のみ
    if (
      session.user.role !== 'admin' &&
      notification.employeeId !== parseInt(session.user.id)
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 企業IDの確認
    if (notification.employee.companyId !== session.user.companyId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await prisma.notification.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error('Delete notification error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

