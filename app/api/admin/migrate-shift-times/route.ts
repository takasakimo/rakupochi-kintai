import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// マイグレーション状態を確認
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // マイグレーション状態を確認
    const result = await prisma.$queryRawUnsafe<Array<{
      column_name: string
      is_nullable: string
    }>>(`
      SELECT column_name, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'shifts'
      AND column_name IN ('startTime', 'endTime')
      ORDER BY column_name;
    `)

    const status = {
      startTime: result.find(r => r.column_name === 'startTime')?.is_nullable === 'YES',
      endTime: result.find(r => r.column_name === 'endTime')?.is_nullable === 'YES',
    }

    return NextResponse.json({
      migrationNeeded: !status.startTime || !status.endTime,
      status,
    })
  } catch (error: any) {
    console.error('Migration status check error:', error)
    return NextResponse.json(
      {
        error: 'Failed to check migration status',
        details: error?.message || 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// 一時的なマイグレーション実行エンドポイント
// 本番環境でマイグレーションを実行するために使用
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // マイグレーションSQLを実行（既に実行済みかチェック）
    await prisma.$executeRawUnsafe(`
      DO $$ 
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'shifts' 
          AND column_name = 'startTime' 
          AND is_nullable = 'NO'
        ) THEN
          ALTER TABLE shifts ALTER COLUMN "startTime" DROP NOT NULL;
        END IF;
        
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'shifts' 
          AND column_name = 'endTime' 
          AND is_nullable = 'NO'
        ) THEN
          ALTER TABLE shifts ALTER COLUMN "endTime" DROP NOT NULL;
        END IF;
      END $$;
    `)

    return NextResponse.json({
      success: true,
      message: 'Migration completed successfully',
    })
  } catch (error: any) {
    console.error('Migration error:', error)
    return NextResponse.json(
      {
        error: 'Migration failed',
        details: error?.message || 'Unknown error',
      },
      { status: 500 }
    )
  }
}

