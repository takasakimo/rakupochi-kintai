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

  // 接続プールURLの形式を試す
  const poolerUrl = 'postgresql://postgres.qhjefghdnsyordbdkqyf:Moto0625@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true'
  
  // テスト1: デフォルトの接続プールURL
  try {
    const testClient1 = new PrismaClient({
      datasources: {
        db: {
          url: poolerUrl,
        },
      },
      log: ['error'],
    })
    
    await testClient1.$connect()
    const employeeCount1 = await testClient1.employee.count()
    await testClient1.$disconnect()
    
    results.tests.push({
      type: 'pooler_default',
      success: true,
      employeeCount: employeeCount1,
      url: poolerUrl,
    })
  } catch (error: any) {
    results.tests.push({
      type: 'pooler_default',
      success: false,
      error: {
        name: error?.name,
        message: error?.message,
        code: error?.code,
      },
    })
  }

  // テスト2: Transaction mode（pgbouncer=true&transaction_mode=transaction）
  const poolerUrlTransaction = 'postgresql://postgres.qhjefghdnsyordbdkqyf:Moto0625@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&transaction_mode=transaction'
  
  try {
    const testClient2 = new PrismaClient({
      datasources: {
        db: {
          url: poolerUrlTransaction,
        },
      },
      log: ['error'],
    })
    
    await testClient2.$connect()
    const employeeCount2 = await testClient2.employee.count()
    await testClient2.$disconnect()
    
    results.tests.push({
      type: 'pooler_transaction_mode',
      success: true,
      employeeCount: employeeCount2,
      url: poolerUrlTransaction,
      message: 'Use this URL! Transaction mode works with Prisma.',
    })
  } catch (error: any) {
    results.tests.push({
      type: 'pooler_transaction_mode',
      success: false,
      error: {
        name: error?.name,
        message: error?.message,
        code: error?.code,
      },
    })
  }

  // テスト3: ユーザー名をpostgresに変更（プロジェクト参照IDなし）
  const poolerUrlSimple = 'postgresql://postgres:Moto0625@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true'
  
  try {
    const testClient3 = new PrismaClient({
      datasources: {
        db: {
          url: poolerUrlSimple,
        },
      },
      log: ['error'],
    })
    
    await testClient3.$connect()
    const employeeCount3 = await testClient3.employee.count()
    await testClient3.$disconnect()
    
    results.tests.push({
      type: 'pooler_simple_username',
      success: true,
      employeeCount: employeeCount3,
      url: poolerUrlSimple,
    })
  } catch (error: any) {
    results.tests.push({
      type: 'pooler_simple_username',
      success: false,
      error: {
        name: error?.name,
        message: error?.message,
        code: error?.code,
      },
    })
  }

  return NextResponse.json(results, { status: 200 })
}

