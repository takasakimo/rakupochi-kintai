'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Sidebar from './Sidebar'

interface PageLayoutProps {
  children: React.ReactNode
  requireAuth?: boolean
}

export default function PageLayout({
  children,
  requireAuth = true,
}: PageLayoutProps) {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (requireAuth && status === 'unauthenticated') {
      router.push('/auth/signin')
    }
  }, [status, router, requireAuth])

  // 認証が必要なページでローディング中
  if (requireAuth && status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-900">読み込み中...</div>
      </div>
    )
  }

  // 認証が必要なページで未認証
  if (requireAuth && !session) {
    return null
  }

  // 認証不要のページ（ログインページなど）はサイドバーなし
  if (!requireAuth || !session) {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-x-hidden">
        {children}
      </main>
    </div>
  )
}

