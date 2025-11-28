import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// お知らせ一覧取得
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const announcements = await prisma.announcement.findMany({
      where: {
        companyId: session.user.companyId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({ announcements })
  } catch (error: any) {
    console.error('[Announcements] GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message },
      { status: 500 }
    )
  }
}

// お知らせ作成
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { title, content, attachments, isActive } = body

    if (!title || !content) {
      return NextResponse.json(
        { error: 'Title and content are required' },
        { status: 400 }
      )
    }

    const announcement = await prisma.announcement.create({
      data: {
        companyId: session.user.companyId,
        title,
        content,
        attachments: attachments || null,
        isActive: isActive !== undefined ? isActive : true,
      },
    })

    return NextResponse.json({ success: true, announcement })
  } catch (error: any) {
    console.error('[Announcements] POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message },
      { status: 500 }
    )
  }
}

