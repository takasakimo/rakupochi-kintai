import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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
      // セキュリティ: 機密情報を返さない
      connectionTest: 'OK',
      queryTest: 'OK',
      employeeTest: employeeTest ? 'OK' : 'Failed',
      // employeeTestDetailsは機密情報を含む可能性があるため削除
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
      // セキュリティ: 機密情報を返さない
      error: 'Database connection failed',
    }, { status: 500 })
  }
}

