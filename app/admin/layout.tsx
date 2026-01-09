'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }

    if (status === 'authenticated') {
      const isSuperAdmin = session?.user.role === 'super_admin' || 
                           session?.user.email === 'superadmin@rakupochi.com'
      const isAdmin = session?.user.role === 'admin'

      if (isSuperAdmin) {
        // スーパー管理者の場合は企業が選択されているか確認
        if (!session.user.selectedCompanyId) {
          router.push('/super-admin/select-company')
          return
        }
      } else if (!isAdmin) {
        router.push('/employee/clock')
        return
      }
    }
  }, [status, router, session])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-900">読み込み中...</div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  const isSuperAdmin = session.user.role === 'super_admin' || 
                       session.user.email === 'superadmin@rakupochi.com'
  const isAdmin = session.user.role === 'admin'

  if (!isSuperAdmin && !isAdmin) {
    return null
  }

  // スーパー管理者の場合は企業が選択されているか確認
  if (isSuperAdmin && !session.user.selectedCompanyId) {
    return null
  }

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen)
  }

  const closeSidebar = () => {
    setIsSidebarOpen(false)
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* ハンバーガーメニューボタン */}
      <button
        onClick={toggleSidebar}
        className="fixed top-4 left-4 z-50 bg-gray-800 text-white p-2 rounded-lg shadow-lg hover:bg-gray-700"
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
      
      <Sidebar isOpen={isSidebarOpen} onClose={closeSidebar} />
      <main className="flex-1 overflow-x-hidden pt-16">
        {children}
      </main>
    </div>
  )
}

