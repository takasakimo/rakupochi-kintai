import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendPasswordResetEmail } from '@/lib/email'
import { checkRateLimit, getClientIP } from '@/lib/rate-limit'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

// パスワードリセットリクエスト
export async function POST(request: NextRequest) {
  try {
    // レート制限チェック（15分間に3回まで）
    const clientIP = getClientIP(request)
    const rateLimitResult = checkRateLimit(`forgot-password:${clientIP}`, 3, 15 * 60 * 1000)
    
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
    const { email } = body

    // バリデーション
    if (!email) {
      return NextResponse.json(
        { error: 'メールアドレスが必要です' },
        { status: 400 }
      )
    }

    // メールアドレスで従業員を検索
    const employee = await prisma.employee.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
      },
    })

    // セキュリティのため、存在しないメールアドレスでも成功メッセージを返す
    if (!employee || !employee.isActive) {
      return NextResponse.json({
        success: true,
        message: 'メールアドレスが登録されている場合、パスワードリセットリンクを送信しました。',
      })
    }

    // 既存の未使用トークンを無効化
    await prisma.passwordResetToken.updateMany({
      where: {
        employeeId: employee.id,
        used: false,
        expiresAt: {
          gt: new Date(),
        },
      },
      data: {
        used: true,
      },
    })

    // 新しいリセットトークンを生成
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 24) // 24時間有効

    // トークンをデータベースに保存
    await prisma.passwordResetToken.create({
      data: {
        employeeId: employee.id,
        token,
        expiresAt,
      },
    })

    // メール送信
    let resetUrl: string | undefined
    try {
      const emailResult = await sendPasswordResetEmail(employee.email, employee.name, token)
      resetUrl = emailResult.resetUrl
    } catch (emailError) {
      console.error('Failed to send email:', emailError)
      // メール送信に失敗した場合でも、URLを生成して返す
      resetUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/auth/reset-password?token=${token}`
    }

    // メール送信が無効な場合や失敗した場合は、URLをレスポンスに含める
    return NextResponse.json({
      success: true,
      message: resetUrl 
        ? 'パスワードリセットリンクを生成しました。以下のリンクをクリックしてください。'
        : 'メールアドレスが登録されている場合、パスワードリセットリンクを送信しました。',
      resetUrl, // 開発・テスト用にURLを含める
    })
  } catch (error: any) {
    console.error('Forgot password error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

