import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// お知らせ更新
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const id = parseInt(params.id)
    const body = await request.json()
    const { title, content, attachments, isActive } = body

    // お知らせが存在し、同じ企業のものか確認
    const existing = await prisma.announcement.findFirst({
      where: {
        id,
        companyId: session.user.companyId,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Announcement not found' }, { status: 404 })
    }

    const announcement = await prisma.announcement.update({
      where: { id },
      data: {
        title: title !== undefined ? title : existing.title,
        content: content !== undefined ? content : existing.content,
        attachments: attachments !== undefined ? attachments : existing.attachments,
        isActive: isActive !== undefined ? isActive : existing.isActive,
      },
    })

    return NextResponse.json({ success: true, announcement })
  } catch (error: any) {
    console.error('[Announcements] PATCH error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message },
      { status: 500 }
    )
  }
}

// お知らせ削除
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const id = parseInt(params.id)

    // お知らせが存在し、同じ企業のものか確認
    const existing = await prisma.announcement.findFirst({
      where: {
        id,
        companyId: session.user.companyId,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Announcement not found' }, { status: 404 })
    }

    await prisma.announcement.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Announcements] DELETE error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message },
      { status: 500 }
    )
  }
}

