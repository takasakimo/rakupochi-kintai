import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

// パスワードリセット実行
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, password } = body

    // バリデーション
    if (!token || !password) {
      return NextResponse.json(
        { error: 'トークンとパスワードが必要です' },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'パスワードは8文字以上で入力してください' },
        { status: 400 }
      )
    }

    // トークンを検証
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: {
        employee: {
          select: {
            id: true,
            email: true,
            isActive: true,
          },
        },
      },
    })

    if (!resetToken) {
      return NextResponse.json(
        { error: '無効なトークンです' },
        { status: 400 }
      )
    }

    if (resetToken.used) {
      return NextResponse.json(
        { error: 'このトークンは既に使用されています' },
        { status: 400 }
      )
    }

    if (resetToken.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'このトークンの有効期限が切れています' },
        { status: 400 }
      )
    }

    if (!resetToken.employee.isActive) {
      return NextResponse.json(
        { error: 'このアカウントは無効です' },
        { status: 403 }
      )
    }

    // パスワードをハッシュ化して更新
    const hashedPassword = await bcrypt.hash(password, 10)

    // トランザクションでパスワード更新とトークン無効化を実行
    await prisma.$transaction([
      prisma.employee.update({
        where: { id: resetToken.employee.id },
        data: {
          password: hashedPassword,
        },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: {
          used: true,
        },
      }),
    ])

    return NextResponse.json({
      success: true,
      message: 'パスワードが正常にリセットされました',
    })
  } catch (error: any) {
    console.error('Reset password error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

