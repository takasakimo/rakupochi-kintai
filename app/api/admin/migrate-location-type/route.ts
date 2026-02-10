import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Locationテーブルにtypeカラムを追加するマイグレーション
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // スーパー管理者または管理者のみアクセス可能
    const isSuperAdmin = session.user.role === 'super_admin' || 
                         session.user.email === 'superadmin@rakupochi.com'
    const isAdmin = session.user.role === 'admin'

    if (!isSuperAdmin && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // SQLを直接実行してマイグレーションを実行
    try {
      // typeカラムが存在しない場合は追加
      await prisma.$executeRaw`
        ALTER TABLE locations ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'store';
      `
      
      // 既存のレコードでtypeがNULLまたは空の場合は'store'に設定
      await prisma.$executeRaw`
        UPDATE locations SET type = 'store' WHERE type IS NULL OR type = '';
      `

      return NextResponse.json({ 
        success: true, 
        message: 'Migration completed successfully'
      })
    } catch (error: any) {
      // カラムが既に存在する場合は無視
      if (error.message && (
        error.message.includes('already exists') || 
        error.message.includes('duplicate column')
      )) {
        // 既存のレコードを更新
        await prisma.$executeRaw`
          UPDATE locations SET type = 'store' WHERE type IS NULL OR type = '';
        `
        return NextResponse.json({ 
          success: true, 
          message: 'Column already exists, updated existing records'
        })
      }
      throw error
    }
  } catch (error: any) {
    console.error('Failed to migrate location type:', error)
    
    // エラーが「カラムが既に存在する」という場合は成功として扱う
    if (error.message && error.message.includes('already exists')) {
      return NextResponse.json({ 
        success: true, 
        message: 'Column already exists, migration skipped' 
      })
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

