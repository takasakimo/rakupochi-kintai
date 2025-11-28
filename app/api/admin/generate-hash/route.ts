import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

// パスワードのハッシュを生成するAPI
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const password = searchParams.get('password') || 'admin123'

  try {
    const hash = await bcrypt.hash(password, 10)
    return NextResponse.json({
      password,
      hash,
      message: 'パスワードのハッシュを生成しました',
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'ハッシュ生成に失敗しました' },
      { status: 500 }
    )
  }
}

