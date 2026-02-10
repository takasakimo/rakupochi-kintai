import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from './prisma'
import bcrypt from 'bcryptjs'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          console.log('[Auth] Missing credentials')
          return null
        }

        try {
          // セキュリティ: 本番環境では詳細なログを出力しない
          if (process.env.NODE_ENV === 'development') {
            console.log('[Auth] Attempting to authenticate:', credentials.email)
          }
          
          let employee
          try {
            employee = await prisma.employee.findUnique({
              where: { email: credentials.email },
              select: {
                id: true,
                email: true,
                password: true,
                name: true,
                role: true,
                companyId: true,
                isActive: true,
                company: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
                  }
                }
              }
            })
            if (process.env.NODE_ENV === 'development') {
              console.log('[Auth] Employee query result:', employee ? 'found' : 'not found')
            }
          } catch (dbError: any) {
            // セキュリティ: エラーの詳細をログに出力しない（本番環境）
            console.error('[Auth] Database query error')
            if (process.env.NODE_ENV === 'development') {
              console.error('[Auth] Error details:', dbError?.message)
            }
            throw dbError
          }

          if (!employee) {
            // セキュリティ: ユーザーが存在しないことを明示しない
            return null
          }

          if (!employee.isActive) {
            // セキュリティ: アカウントが無効であることを明示しない
            return null
          }

          const isPasswordValid = await bcrypt.compare(
            credentials.password,
            employee.password
          )

          if (!isPasswordValid) {
            // セキュリティ: パスワードが無効であることを明示しない
            return null
          }

          if (process.env.NODE_ENV === 'development') {
            console.log('[Auth] Authentication successful for:', credentials.email)
          }
          
          // スーパー管理者の判定
          const { isSuperAdminEmail } = await import('./super-admin-helper')
          const isSuperAdmin = employee.role === 'super_admin' || 
                               isSuperAdminEmail(employee.email)
          
          return {
            id: employee.id.toString(),
            email: employee.email,
            name: employee.name,
            role: employee.role,
            companyId: isSuperAdmin ? null : employee.companyId, // スーパー管理者の場合はnull
          }
        } catch (error: any) {
          // セキュリティ: 本番環境ではエラーの詳細をログに出力しない
          console.error('[Auth] Authentication error')
          if (process.env.NODE_ENV === 'development') {
            console.error('[Auth] Error details:', error?.message)
          }
          // データベース接続エラーの場合は、エラーを再スローしてNextAuthに伝える
          if (error?.name === 'PrismaClientInitializationError' || 
              error?.message?.includes('Tenant') || 
              error?.message?.includes('database')) {
            throw new Error('Database connection error')
          }
          return null
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user, account, trigger, session }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.companyId = user.companyId
        // スーパー管理者の場合はselectedCompanyIdも初期化
        if (user.companyId === null) {
          token.selectedCompanyId = null
        }
      }
      // セッション更新時にselectedCompanyIdを反映
      if (trigger === 'update' && session?.selectedCompanyId !== undefined) {
        token.selectedCompanyId = session.selectedCompanyId
      }
      return token
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.companyId = token.companyId as number | null
        session.user.selectedCompanyId = token.selectedCompanyId as number | null | undefined
      }
      return session
    },
    async signIn({ user, account, profile }) {
      // スーパー管理者の場合はcompanyIdをnullに設定
      const { isSuperAdminEmail } = await import('./super-admin-helper')
      if (user.role === 'super_admin' || isSuperAdminEmail(user.email)) {
        return true
      }
      return true
    }
  },
  pages: {
    signIn: '/auth/signin',
  },
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8時間（セキュリティ強化）
  },
  secret: process.env.NEXTAUTH_SECRET,
  // ビルド時のエラーを防ぐため、NEXTAUTH_URLが設定されていない場合は警告のみ
  ...(process.env.NEXTAUTH_URL ? {} : { debug: true }),
  events: {
    async signOut() {
      // ログアウト時にセッションを完全にクリア
      console.log('[Auth] User signed out')
    },
  },
}

