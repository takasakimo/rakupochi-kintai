import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const dbUrl = process.env.DATABASE_URL
    const dbUrlPreview = dbUrl ? `${dbUrl.substring(0, 80)}...` : 'NOT SET'
    
    // 接続文字列の解析
    let parsedUrl = null
    if (dbUrl) {
      try {
        const url = new URL(dbUrl)
        parsedUrl = {
          protocol: url.protocol,
          username: url.username,
          hostname: url.hostname,
          port: url.port,
          pathname: url.pathname,
          search: url.search,
        }
      } catch (e) {
        parsedUrl = { error: 'Failed to parse URL' }
      }
    }
    
    // データベース接続テスト
    await prisma.$connect()
    
    // 簡単なクエリを実行
    const result = await prisma.$queryRaw`SELECT 1 as test`
    
    // 従業員テーブルへのクエリテスト
    let employeeTest = null
    try {
      employeeTest = await prisma.employee.findFirst({
        take: 1,
      })
    } catch (empError: any) {
      employeeTest = { error: empError?.message, code: empError?.code }
    }
    
    await prisma.$disconnect()
    
    return NextResponse.json({
      success: true,
      databaseUrl: dbUrlPreview,
      parsedUrl,
      connectionTest: 'OK',
      queryTest: 'OK',
      employeeTest: employeeTest ? 'OK' : 'Failed',
      employeeTestDetails: employeeTest,
    })
  } catch (error: any) {
    const dbUrl = process.env.DATABASE_URL
    const dbUrlPreview = dbUrl ? `${dbUrl.substring(0, 80)}...` : 'NOT SET'
    
    let parsedUrl = null
    if (dbUrl) {
      try {
        const url = new URL(dbUrl)
        parsedUrl = {
          protocol: url.protocol,
          username: url.username,
          hostname: url.hostname,
          port: url.port,
          pathname: url.pathname,
          search: url.search,
        }
      } catch (e) {
        parsedUrl = { error: 'Failed to parse URL' }
      }
    }
    
    return NextResponse.json({
      success: false,
      databaseUrl: dbUrlPreview,
      parsedUrl,
      error: {
        name: error?.name,
        message: error?.message,
        code: error?.code,
      },
    }, { status: 500 })
  }
}

