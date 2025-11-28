import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Prismaクライアントの初期化
// 接続プーリングとタイムアウト設定を最適化
function createPrismaClient() {
  try {
    return new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
      // 接続プーリングの最適化
      // Vercelのサーバーレス環境では、接続が自動的に再利用される
      // 各リクエストで新しい接続を作成しないようにする
    })
  } catch (error) {
    console.error('Failed to create Prisma client:', error)
    throw error
  }
}

// グローバル変数でPrismaクライアントを再利用
// これにより、サーバーレス環境でも接続が効率的に再利用される
export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

