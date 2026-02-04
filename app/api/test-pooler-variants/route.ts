import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

export const dynamic = 'force-dynamic'

// セキュリティ: 本番環境では無効化
export async function GET() {
  // 本番環境ではこのエンドポイントを無効化
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Not Found' },
      { status: 404 }
    )
  }

  const results: any = {
    timestamp: new Date().toISOString(),
    tests: [],
    recommendations: [],
  }

  // セキュリティ: ハードコードされたパスワードは使用しない
  // 環境変数から取得するか、このエンドポイントを削除することを推奨
  return NextResponse.json(
    { error: 'This endpoint is disabled for security reasons' },
    { status: 403 }
  )
}

