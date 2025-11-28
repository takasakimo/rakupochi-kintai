import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// スーパー管理者用：企業情報更新
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

    const id = parseInt(params.id)
    const body = await request.json()

    const company = await prisma.company.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.code && { code: body.code }),
        ...(body.email !== undefined && { email: body.email }),
        ...(body.phone !== undefined && { phone: body.phone }),
        ...(body.address !== undefined && { address: body.address }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      },
    })

    return NextResponse.json({
      success: true,
      company,
    })
  } catch (error: any) {
    console.error('Update company error:', error)
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: '企業コードまたはメールアドレスが重複しています' },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: '企業情報の更新に失敗しました' },
      { status: 500 }
    )
  }
}

// スーパー管理者用：企業削除
export async function DELETE(
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

    const id = parseInt(params.id)

    // 企業を削除（Cascadeで関連データも削除される）
    await prisma.company.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      message: '企業を削除しました',
    })
  } catch (error) {
    console.error('Delete company error:', error)
    return NextResponse.json(
      { error: '企業の削除に失敗しました' },
      { status: 500 }
    )
  }
}

