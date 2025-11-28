import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  const results: any = {
    timestamp: new Date().toISOString(),
    tests: [],
  }

  // 現在の接続文字列を取得
  const currentUrl = process.env.DATABASE_URL
  results.currentUrl = currentUrl ? `${currentUrl.substring(0, 100)}...` : 'NOT SET'

  // 直接接続URLを構築（接続プールURLから変換）
  if (currentUrl) {
    try {
      const url = new URL(currentUrl)
      
      // 接続プールURLの場合、直接接続URLに変換
      // 例: aws-0-ap-northeast-1.pooler.supabase.com -> db.qhjefghdnsyordbdkqyf.supabase.co
      // ポート: 6543 -> 5432
      // ユーザー名: postgres.qhjefghdnsyordbdkqyf -> postgres
      // pgbouncerパラメータを削除
      
      const hostname = url.hostname
      let directHostname = hostname
      let directPort = '5432'
      let directUsername = 'postgres'
      
      // 接続プールURLを検出
      if (hostname.includes('.pooler.supabase.com')) {
        // プロジェクト参照IDを抽出（ユーザー名から）
        const usernameParts = url.username.split('.')
        if (usernameParts.length > 1) {
          const projectRef = usernameParts[1]
          directHostname = `db.${projectRef}.supabase.co`
        }
        directPort = '5432'
        directUsername = 'postgres'
      }
      
      // 直接接続URLを構築
      const directUrl = `postgresql://${directUsername}:${url.password}@${directHostname}:${directPort}${url.pathname}`
      
      results.directUrl = `${directUrl.substring(0, 100)}...`
      
      // 直接接続でテスト
      try {
        const testClient = new PrismaClient({
          datasources: {
            db: {
              url: directUrl,
            },
          },
          log: ['error'],
        })
        
        await testClient.$connect()
        const employeeCount = await testClient.employee.count()
        await testClient.$disconnect()
        
        results.tests.push({
          type: 'direct_connection',
          success: true,
          employeeCount,
          message: 'Direct connection successful! Use this URL in Vercel.',
          recommendedUrl: directUrl,
        })
      } catch (error: any) {
        results.tests.push({
          type: 'direct_connection',
          success: false,
          error: {
            name: error?.name,
            message: error?.message,
            code: error?.code,
          },
        })
      }
    } catch (e: any) {
      results.parseError = e.message
    }
  }

  return NextResponse.json(results, { status: 200 })
}

