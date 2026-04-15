import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import bcrypt from 'bcryptjs'

// パスワードのハッシュを生成するAPI
// セキュリティ: 管理者のみアクセス可能
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    // 認証チェック
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 管理者またはスーパー管理者のみアクセス可能
    const isSuperAdmin = session.user.role === 'super_admin' || 
                         session.user.email === 'superadmin@rakupochi.com'
    const isAdmin = session.user.role === 'admin'

    if (!isSuperAdmin && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 本番環境では無効化
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Not Found' },
        { status: 404 }
      )
    }

    const { searchParams } = new URL(request.url)
    const password = searchParams.get('password')

    if (!password || password.trim() === '') {
      return NextResponse.json(
        { error: 'パスワードは必須です（?password=xxx で指定してください）' },
        { status: 400 }
      )
    }

    // パスワードの最小長チェック
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'パスワードは8文字以上で入力してください' },
        { status: 400 }
      )
    }

    const hash = await bcrypt.hash(password, 10)
    return NextResponse.json({
      hash,
      message: 'パスワードのハッシュを生成しました',
      // セキュリティ: パスワード自体は返さない
    })
  } catch (error: any) {
    console.error('Hash generation error:', error)
    return NextResponse.json(
      { error: 'ハッシュ生成に失敗しました' },
      { status: 500 }
    )
  }
}

