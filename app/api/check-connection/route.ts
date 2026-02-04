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
    envCheck: {},
    connectionTest: {},
    queryTest: {},
  }

  // セキュリティ: 機密情報を返さない
  const dbUrl = process.env.DATABASE_URL
  results.envCheck.hasDatabaseUrl = !!dbUrl
  // databaseUrlPreview, parsedUrlなどの機密情報は返さない

  // 接続テスト
  let testClient: PrismaClient | null = null
  try {
    testClient = new PrismaClient({
      log: ['error'],
    })
    
    await testClient.$connect()
    results.connectionTest.success = true
    results.connectionTest.message = 'Connected successfully'
  } catch (error: any) {
    results.connectionTest.success = false
    results.connectionTest.error = {
      name: error?.name,
      message: error?.message,
      code: error?.code,
    }
  } finally {
    if (testClient) {
      try {
        await testClient.$disconnect()
      } catch (e) {
        // ignore
      }
    }
  }

  // クエリテスト
  if (results.connectionTest.success) {
    try {
      testClient = new PrismaClient({
        log: ['error'],
      })
      await testClient.$connect()
      
      const employeeCount = await testClient.employee.count()
      results.queryTest.success = true
      results.queryTest.employeeCount = employeeCount
    } catch (error: any) {
      results.queryTest.success = false
      results.queryTest.error = {
        name: error?.name,
        message: error?.message,
        code: error?.code,
      }
    } finally {
      if (testClient) {
        try {
          await testClient.$disconnect()
        } catch (e) {
          // ignore
        }
      }
    }
  }

  return NextResponse.json(results, { status: 200 })
}

