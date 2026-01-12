import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendPasswordResetEmail } from '@/lib/email'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

// パスワードリセットリクエスト
export async function POST(request: NextRequest) {
  try {
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
    try {
      await sendPasswordResetEmail(employee.email, employee.name, token)
    } catch (emailError) {
      console.error('Failed to send email:', emailError)
      // メール送信に失敗した場合でも、トークンは作成済みなので成功を返す
      // （実際の運用では、メール送信失敗時はトークンを削除する方が良い）
    }

    return NextResponse.json({
      success: true,
      message: 'メールアドレスが登録されている場合、パスワードリセットリンクを送信しました。',
    })
  } catch (error: any) {
    console.error('Forgot password error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

