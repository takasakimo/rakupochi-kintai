import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, getClientIP } from '@/lib/rate-limit'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

// パスワードリセット実行
export async function POST(request: NextRequest) {
  try {
    // レート制限チェック（15分間に5回まで）
    const clientIP = getClientIP(request)
    const rateLimitResult = checkRateLimit(`reset-password:${clientIP}`, 5, 15 * 60 * 1000)
    
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'リクエストが多すぎます。しばらく時間をおいてから再度お試しください。' },
        { 
          status: 429,
          headers: {
            'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
          },
        }
      )
    }

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

    // セキュリティ: 詳細なエラーメッセージを返さない
    if (!resetToken || resetToken.used || resetToken.expiresAt < new Date()) {
      return NextResponse.json(
        { error: '無効なトークンです' },
        { status: 400 }
      )
    }

    if (!resetToken.employee.isActive) {
      return NextResponse.json(
        { error: '無効なトークンです' },
        { status: 400 }
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

