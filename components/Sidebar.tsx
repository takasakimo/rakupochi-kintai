'use client'

import { useSession, signOut } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect } from 'react'

interface MenuItem {
  href: string
  label: string
  icon: string
}

const adminMenuItems: MenuItem[] = [
  { href: '/admin/dashboard', label: 'ダッシュボード', icon: '📊' },
  { href: '/employee/clock', label: '打刻', icon: '📍' },
  { href: '/admin/employees', label: '従業員管理', icon: '👥' },
  { href: '/admin/attendances', label: '打刻管理', icon: '📋' },
  { href: '/admin/applications', label: '申請管理', icon: '📝' },
  { href: '/admin/shifts/manage', label: 'シフト管理', icon: '🗓️' },
  { href: '/admin/announcements', label: 'お知らせ管理', icon: '📢' },
  { href: '/admin/reports', label: 'レポート', icon: '📈' },
  { href: '/admin/notifications', label: '通知管理', icon: '🔔' },
  { href: '/admin/settings', label: '設定', icon: '⚙️' },
]

const superAdminMenuItems: MenuItem[] = [
  { href: '/super-admin/companies', label: '企業管理', icon: '🏢' },
]

const employeeMenuItems: MenuItem[] = [
  { href: '/employee/clock', label: '打刻', icon: '📍' },
  { href: '/employee/mypage', label: 'マイページ', icon: '👤' },
  { href: '/employee/history', label: '打刻履歴', icon: '📅' },
  { href: '/employee/applications', label: '申請一覧', icon: '📝' },
  { href: '/employee/shifts', label: 'シフト管理', icon: '🗓️' },
  { href: '/employee/notifications', label: '通知', icon: '🔔' },
]

interface Company {
  id: number
  code: string
  name: string
}

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

export default function Sidebar({ isOpen, onClose }: SidebarProps = {}) {
  // onCloseが提供されている場合はハンバーガーメニューモード
  const isHamburgerMode = onClose !== undefined
  // ハンバーガーメニューモードではisOpenがtrueの時のみ表示
  const shouldShow = isHamburgerMode ? (isOpen === true) : true
  const { data: session } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const [company, setCompany] = useState<Company | null>(null)

  useEffect(() => {
    if (session?.user?.companyId) {
      fetch('/api/user/company')
        .then((res) => res.json())
        .then((data) => {
          if (data.company) {
            setCompany(data.company)
          }
        })
        .catch((err) => {
          console.error('Failed to fetch company:', err)
        })
    }
  }, [session])

  if (!session) {
    return null
  }

  const isAdmin = session.user.role === 'admin'
  const isSuperAdmin =
    session.user.role === 'super_admin' ||
    session.user.email === 'superadmin@rakupochi.com'

  let menuItems: MenuItem[]
  if (isSuperAdmin) {
    menuItems = superAdminMenuItems
  } else if (isAdmin) {
    menuItems = adminMenuItems
  } else {
    menuItems = employeeMenuItems
  }

  const handleLogout = async () => {
    if (confirm('ログアウトしますか？')) {
      await signOut({ redirect: false })
      router.push('/auth/signin')
      router.refresh()
    }
  }

  return (
    <>
      {/* オーバーレイ */}
      {isHamburgerMode && (
        <div
          className={`fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity ${
            shouldShow ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          onClick={onClose}
        />
      )}
      
      {/* サイドバー */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-gray-800 text-white min-h-screen flex flex-col no-print transform transition-transform duration-300 ease-in-out ${
          shouldShow 
            ? 'translate-x-0' 
            : '-translate-x-full'
        }`}
        style={{
          // ハンバーガーメニューモードで非表示の場合は確実に非表示にする
          display: isHamburgerMode && !shouldShow ? 'none' : 'flex',
        }}
      >
        {/* 閉じるボタン */}
        {isHamburgerMode && (
          <div className="flex justify-end p-4 border-b border-gray-700">
            <button
              onClick={onClose}
              className="text-white hover:text-gray-300 text-2xl font-bold"
            >
              ×
            </button>
          </div>
        )}
        
        {/* ロゴ・タイトル */}
        <div className="p-6 border-b border-gray-700">
          <h1 className="text-xl font-bold">らくポチ勤怠</h1>
          <p className="text-sm text-gray-400 mt-1">勤怠管理システム</p>
        </div>

      {/* メニュー */}
      <nav className="flex-1 p-4 overflow-y-auto">
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={isHamburgerMode ? onClose : undefined}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span className="font-medium">{item.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* ログイン者情報とログアウト */}
      <div className="p-4 border-t border-gray-700">
        <div className="mb-4">
          <div className="text-sm text-gray-400 mb-1">ログイン中</div>
          <div className="font-semibold text-white">{session.user.name}</div>
          <div className="text-xs text-gray-400 mt-1">{session.user.email}</div>
          {company && (
            <div className="text-xs text-gray-400 mt-1">企業ID: {company.code}</div>
          )}
          {isSuperAdmin && (
            <div className="text-xs text-purple-400 mt-1">スーパー管理者</div>
          )}
          {isAdmin && !isSuperAdmin && (
            <div className="text-xs text-blue-400 mt-1">管理者</div>
          )}
        </div>
        <button
          onClick={handleLogout}
          className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-medium transition text-white"
        >
          ログアウト
        </button>
      </div>
    </div>
    </>
  )
}
