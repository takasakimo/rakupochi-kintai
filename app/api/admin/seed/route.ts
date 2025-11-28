import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

// 本番環境でシードデータを投入するためのAPI
// 注意: 本番環境では認証を追加することを推奨
export const dynamic = 'force-dynamic'

export async function GET() {
  return await seedDatabase()
}

export async function POST() {
  return await seedDatabase()
}

async function seedDatabase() {
  try {
    // データベース接続を確認
    await prisma.$connect()
    // テスト企業の作成
    const company = await prisma.company.upsert({
      where: { code: 'TEST001' },
      update: {},
      create: {
        name: 'テスト株式会社',
        code: 'TEST001',
        email: 'test@example.com',
        phone: '03-1234-5678',
        address: '東京都千代田区1-1-1',
      },
    })

    // テスト管理者の作成
    const hashedPassword = await bcrypt.hash('admin123', 10)
    const admin = await prisma.employee.upsert({
      where: { email: 'admin@example.com' },
      update: {},
      create: {
        companyId: company.id,
        employeeNumber: 'EMP001',
        name: '管理者 太郎',
        email: 'admin@example.com',
        password: hashedPassword,
        role: 'admin',
        department: '管理部',
        position: '管理者',
        isActive: true,
      },
    })

    // テスト従業員の作成
    const employeePassword = await bcrypt.hash('employee123', 10)
    const employee = await prisma.employee.upsert({
      where: { email: 'employee@example.com' },
      update: {},
      create: {
        companyId: company.id,
        employeeNumber: 'EMP002',
        name: '従業員 花子',
        email: 'employee@example.com',
        password: employeePassword,
        role: 'employee',
        department: '営業部',
        position: '営業',
        isActive: true,
      },
    })

    // テスト店舗・事業所の作成
    await prisma.location.deleteMany({
      where: { companyId: company.id },
    })
    const location = await prisma.location.create({
      data: {
        companyId: company.id,
        name: '本社',
        address: '東京都千代田区1-1-1',
        latitude: 35.6812,
        longitude: 139.7671,
        radius: 500,
        isActive: true,
      },
    })

    // 企業設定の作成
    await prisma.companySetting.upsert({
      where: { companyId: company.id },
      update: {},
      create: {
        companyId: company.id,
        payday: 25,
        overtimeThreshold40: 40,
        overtimeThreshold60: 60,
        consecutiveWorkAlert: 6,
        leaveExpiryAlertDays: 30,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'シードデータが正常に投入されました',
      data: {
        company: company.name,
        admin: admin.name,
        employee: employee.name,
        location: location.name,
      },
    })
  } catch (error: any) {
    console.error('Seed error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'シードデータの投入に失敗しました',
      },
      { status: 500 }
    )
  }
}

