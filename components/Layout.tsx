'use client'

import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'

export default function Layout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const pathname = usePathname()

  // 認証が必要なページ以外ではサイドバーを表示しない
  const showSidebar =
    session &&
    pathname &&
    !pathname.startsWith('/auth') &&
    pathname !== '/register' &&
    pathname !== '/employee/register' &&
    pathname !== '/'

  return (
    <div className="flex min-h-screen">
      {showSidebar && <Sidebar />}
      <main
        className={`flex-1 ${showSidebar ? 'ml-64' : ''} transition-all`}
      >
        {children}
      </main>
    </div>
  )
}

