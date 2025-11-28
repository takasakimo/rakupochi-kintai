'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Sidebar from '@/components/Sidebar'

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }

    if (status === 'authenticated') {
      const isSuperAdmin =
        session?.user.role === 'super_admin' ||
        session?.user.email === 'superadmin@rakupochi.com'

      if (!isSuperAdmin) {
        router.push('/')
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

  const isSuperAdmin =
    session.user.role === 'super_admin' ||
    session.user.email === 'superadmin@rakupochi.com'

  if (!isSuperAdmin) {
    return null
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

