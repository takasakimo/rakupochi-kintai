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
          console.log('[Auth] Attempting to authenticate:', credentials.email)
          const dbUrl = process.env.DATABASE_URL
          console.log('[Auth] DATABASE_URL exists:', !!dbUrl)
          console.log('[Auth] DATABASE_URL (first 80 chars):', dbUrl?.substring(0, 80))
          
          // 接続文字列の解析（エラー処理付き）
          try {
            if (dbUrl) {
              const url = new URL(dbUrl)
              console.log('[Auth] DATABASE_URL username:', url.username)
              console.log('[Auth] DATABASE_URL hostname:', url.hostname)
              console.log('[Auth] DATABASE_URL port:', url.port)
            }
          } catch (urlError) {
            console.error('[Auth] Failed to parse DATABASE_URL:', urlError)
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
            console.log('[Auth] Employee query result:', employee ? 'found' : 'not found')
          } catch (dbError: any) {
            console.error('[Auth] Database query error:', dbError)
            console.error('[Auth] Error name:', dbError?.name)
            console.error('[Auth] Error message:', dbError?.message)
            console.error('[Auth] Error code:', dbError?.code)
            if (dbError?.stack) {
              console.error('[Auth] Error stack (first 500 chars):', dbError.stack.substring(0, 500))
            }
            throw dbError
          }

          if (!employee) {
            console.log('[Auth] Employee not found:', credentials.email)
            return null
          }

          if (!employee.isActive) {
            console.log('[Auth] Employee is inactive:', credentials.email)
            return null
          }

          const isPasswordValid = await bcrypt.compare(
            credentials.password,
            employee.password
          )

          if (!isPasswordValid) {
            console.log('[Auth] Invalid password for:', credentials.email)
            return null
          }

          console.log('[Auth] Authentication successful for:', credentials.email)
          return {
            id: employee.id.toString(),
            email: employee.email,
            name: employee.name,
            role: employee.role,
            companyId: employee.companyId,
          }
        } catch (error: any) {
          console.error('[Auth] Auth error:', error)
          console.error('[Auth] Error name:', error?.name)
          console.error('[Auth] Error message:', error?.message)
          console.error('[Auth] Error code:', error?.code)
          if (error?.stack) {
            console.error('[Auth] Error stack (first 500 chars):', error.stack.substring(0, 500))
          }
          // データベース接続エラーの場合は、エラーを再スローしてNextAuthに伝える
          if (error?.name === 'PrismaClientInitializationError' || 
              error?.message?.includes('Tenant') || 
              error?.message?.includes('database')) {
            throw new Error('Database connection error: ' + error?.message)
          }
          return null
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.companyId = user.companyId
      }
      return token
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.companyId = token.companyId as number
      }
      return session
    }
  },
  pages: {
    signIn: '/auth/signin',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30日
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

