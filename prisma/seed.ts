import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // テスト企業の作成
  const company = await prisma.company.upsert({
    where: { code: 'TEST001' },
    update: {},
    create: {
      name: 'テスト株式会社',
      code: 'TEST001',
      email: 'test@example.com',
      phone: '03-1234-5678',
      address: '',
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
      name: '管理者',
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
      name: '従業員',
      email: 'employee@example.com',
      password: employeePassword,
      role: 'employee',
      department: '営業部',
      position: '営業',
      isActive: true,
    },
  })

  // テスト店舗・事業所の作成（既存を削除してから作成）
  await prisma.location.deleteMany({
    where: { companyId: company.id },
  })
  const location = await prisma.location.create({
    data: {
      companyId: company.id,
      name: '店舗名',
      address: '',
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

  console.log('Seed data created:', {
    company: company.name,
    admin: admin.name,
    employee: employee.name,
    location: location.name,
  })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

