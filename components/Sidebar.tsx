'use client'

import { useSession, signOut } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'

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
  { href: '/admin/shifts/register', label: 'シフト登録', icon: '📝' },
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

export default function Sidebar() {
  const { data: session } = useSession()
  const router = useRouter()
  const pathname = usePathname()

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
    <div className="w-64 bg-gray-800 text-white min-h-screen flex flex-col no-print">
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
  )
}
