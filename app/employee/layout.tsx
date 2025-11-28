'use client'

import { useSession } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect } from 'react'
import Sidebar from '@/components/Sidebar'

export default function EmployeeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()

  // 従業員登録ページは認証不要
  const isRegisterPage = pathname === '/employee/register'

  useEffect(() => {
    if (!isRegisterPage && status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }
  }, [status, router, isRegisterPage])

  if (status === 'loading' && !isRegisterPage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-900">読み込み中...</div>
      </div>
    )
  }

  if (!isRegisterPage && !session) {
    return null
  }

  // 従業員登録ページの場合はサイドバーなしで表示
  if (isRegisterPage) {
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

