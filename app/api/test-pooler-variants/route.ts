import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  const results: any = {
    timestamp: new Date().toISOString(),
    tests: [],
    recommendations: [],
  }

  const password = 'Moto0625'
  const projectRef = 'qhjefghdnsyordbdkqyf'
  const region = 'ap-northeast-1'

  // テストする接続プールURLのバリエーション
  const variants = [
    {
      name: 'Supabase公式形式（Session mode）',
      url: `postgresql://postgres.${projectRef}:${password}@aws-0-${region}.pooler.supabase.com:6543/postgres?pgbouncer=true`,
    },
    {
      name: 'Supabase公式形式（Transaction mode）',
      url: `postgresql://postgres.${projectRef}:${password}@aws-0-${region}.pooler.supabase.com:6543/postgres?pgbouncer=true&transaction_mode=transaction`,
    },
    {
      name: 'シンプルなユーザー名（postgresのみ）',
      url: `postgresql://postgres:${password}@aws-0-${region}.pooler.supabase.com:6543/postgres?pgbouncer=true`,
    },
    {
      name: 'プロジェクト参照IDをホスト名に含める',
      url: `postgresql://postgres.${projectRef}:${password}@${projectRef}.pooler.supabase.com:6543/postgres?pgbouncer=true`,
    },
    {
      name: '接続文字列にsslmodeを追加',
      url: `postgresql://postgres.${projectRef}:${password}@aws-0-${region}.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require`,
    },
    {
      name: '接続文字列にsslmodeとtransaction_modeを追加',
      url: `postgresql://postgres.${projectRef}:${password}@aws-0-${region}.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require&transaction_mode=transaction`,
    },
  ]

  for (const variant of variants) {
    try {
      const testClient = new PrismaClient({
        datasources: {
          db: {
            url: variant.url,
          },
        },
        log: ['error'],
      })
      
      await testClient.$connect()
      const employeeCount = await testClient.employee.count()
      await testClient.$disconnect()
      
      results.tests.push({
        name: variant.name,
        success: true,
        employeeCount,
        url: variant.url,
      })
      
      results.recommendations.push({
        message: `✅ ${variant.name} が動作しました！この接続文字列を使用してください。`,
        url: variant.url,
      })
    } catch (error: any) {
      results.tests.push({
        name: variant.name,
        success: false,
        error: {
          name: error?.name,
          message: error?.message,
          code: error?.code,
        },
        url: variant.url,
      })
    }
  }

  // 成功した接続がない場合の推奨事項
  if (results.recommendations.length === 0) {
    results.recommendations.push({
      message: '⚠️ すべての接続プールURL形式でエラーが発生しました。Supabaseダッシュボードから正しい接続文字列を取得してください。',
      steps: [
        '1. Supabaseダッシュボードにログイン',
        '2. プロジェクトを選択',
        '3. Settings → Database → Connection string',
        '4. Connection pooling タブを選択',
        '5. Transaction mode を選択（Prisma推奨）',
        '6. 表示された接続文字列をコピー',
        '7. Vercelの環境変数 DATABASE_URL に設定',
      ],
    })
  }

  return NextResponse.json(results, { status: 200 })
}

