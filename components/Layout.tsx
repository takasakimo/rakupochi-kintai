'use client'

import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import Sidebar from './Sidebar'

export default function Layout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // モバイルかどうかを判定
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768) // md breakpoint
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // 認証が必要なページ以外ではサイドバーを表示しない
  const showSidebar =
    session &&
    pathname &&
    !pathname.startsWith('/auth') &&
    pathname !== '/register' &&
    pathname !== '/employee/register' &&
    pathname !== '/'

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen)
  }

  const closeSidebar = () => {
    setIsSidebarOpen(false)
  }

  return (
    <div className="flex min-h-screen">
      {showSidebar && (
        <>
          {/* ハンバーガーメニューボタン（モバイルのみ） */}
          <button
            onClick={toggleSidebar}
            className="fixed top-4 left-4 z-50 md:hidden bg-gray-800 text-white p-2 rounded-lg shadow-lg hover:bg-gray-700"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
          
          {/* モバイルの場合はonCloseを渡す、デスクトップでは渡さない */}
          {isMobile ? (
            <Sidebar isOpen={isSidebarOpen} onClose={closeSidebar} />
          ) : (
            <Sidebar />
          )}
        </>
      )}
      <main
        className={`flex-1 ${showSidebar ? 'md:ml-64' : ''} transition-all pt-16 md:pt-0`}
      >
        {children}
      </main>
    </div>
  )
}

