import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  const results: any = {
    timestamp: new Date().toISOString(),
    envCheck: {},
    connectionTest: {},
    queryTest: {},
  }

  // 環境変数のチェック
  const dbUrl = process.env.DATABASE_URL
  results.envCheck.hasDatabaseUrl = !!dbUrl
  results.envCheck.databaseUrlLength = dbUrl?.length || 0
  results.envCheck.databaseUrlPreview = dbUrl ? `${dbUrl.substring(0, 100)}...` : 'NOT SET'

  if (dbUrl) {
    try {
      const url = new URL(dbUrl)
      results.envCheck.parsedUrl = {
        protocol: url.protocol,
        username: url.username,
        usernameLength: url.username.length,
        hostname: url.hostname,
        port: url.port,
        pathname: url.pathname,
        search: url.search,
        hasPgbouncer: url.searchParams.has('pgbouncer'),
        pgbouncerValue: url.searchParams.get('pgbouncer'),
      }
    } catch (e: any) {
      results.envCheck.parseError = e.message
    }
  }

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

