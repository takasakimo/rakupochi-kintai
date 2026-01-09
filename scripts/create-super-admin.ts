import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function createSuperAdmin() {
  try {
    console.log('スーパー管理者アカウントを作成します...')

    // 既存のスーパー管理者を確認
    const existingSuperAdmin = await prisma.employee.findFirst({
      where: {
        role: 'super_admin',
      },
    })

    if (existingSuperAdmin) {
      console.log('既にスーパー管理者が存在します:')
      console.log(`  ID: ${existingSuperAdmin.id}`)
      console.log(`  メールアドレス: ${existingSuperAdmin.email}`)
      console.log(`  名前: ${existingSuperAdmin.name}`)
      return
    }

    // デフォルトのスーパー管理者情報
    const email = process.env.SUPER_ADMIN_EMAIL || 'superadmin@rakupochi.com'
    const password = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin123!'
    const name = process.env.SUPER_ADMIN_NAME || 'スーパー管理者'

    // パスワードのハッシュ化
    const hashedPassword = await bcrypt.hash(password, 10)

    // システム企業を取得または作成（スーパー管理者用）
    let systemCompany = await prisma.company.findFirst({
      where: { code: 'SYSTEM' },
    })

    if (!systemCompany) {
      systemCompany = await prisma.company.create({
        data: {
          name: 'システム管理',
          code: 'SYSTEM',
          isActive: true,
        },
      })
      console.log('システム企業を作成しました:', systemCompany.id)
    }

    // スーパー管理者を作成
    const superAdmin = await prisma.employee.create({
      data: {
        companyId: systemCompany.id,
        employeeNumber: 'SUPERADMIN001',
        name,
        email,
        password: hashedPassword,
        role: 'super_admin',
        isActive: true,
      },
    })

    console.log('スーパー管理者アカウントを作成しました:')
    console.log(`  ID: ${superAdmin.id}`)
    console.log(`  メールアドレス: ${superAdmin.email}`)
    console.log(`  名前: ${superAdmin.name}`)
    console.log(`  パスワード: ${password}`)
    console.log('\n⚠️  初回ログイン後、パスワードを変更することを推奨します。')
  } catch (error: any) {
    console.error('エラーが発生しました:', error)
    if (error.code === 'P2002') {
      console.error('このメールアドレスは既に使用されています。')
    }
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

createSuperAdmin()

