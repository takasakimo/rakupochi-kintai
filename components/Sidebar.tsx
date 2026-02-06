'use client'

import { useSession, signOut } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect } from 'react'

interface MenuItem {
  href: string
  label: string
  icon: string
  section?: string // セクション名（オプション）
  onClick?: (e: React.MouseEvent) => void // カスタムクリックハンドラ（オプション）
}

// 管理者メニュー（使いやすい順番に整理）
const adminMenuItems: MenuItem[] = [
  // 概要・ダッシュボード
  { href: '/admin/dashboard', label: 'ダッシュボード', icon: '', section: '概要' },
  
  // 打刻関連
  { href: '/employee/clock', label: '打刻', icon: '', section: '打刻' },
  { href: '/admin/attendances', label: '打刻管理', icon: '', section: '打刻' },
  { href: '/admin/sales-visit', label: '営業先入退店管理', icon: '', section: '打刻' },
  
  // 従業員・シフト管理
  { href: '/admin/employees', label: '従業員管理', icon: '', section: '管理' },
  { href: '/admin/shifts/manage', label: 'シフト管理', icon: '', section: '管理' },
  { href: '/admin/billing-clients', label: '請求先企業管理', icon: '', section: '管理' },
  
  // 申請・レポート
  { href: '/admin/applications', label: '申請管理', icon: '', section: '申請・レポート' },
  { href: '/admin/reports', label: 'レポート', icon: '', section: '申請・レポート' },
  
  // 情報・設定
  { href: '/admin/announcements', label: 'お知らせ管理', icon: '', section: '情報・設定' },
  { href: '/admin/notifications', label: '通知管理', icon: '', section: '情報・設定' },
  { href: '/admin/settings', label: '設定', icon: '', section: '情報・設定' },
]

const superAdminMenuItems: MenuItem[] = [
  { href: '/super-admin/companies', label: '企業管理', icon: '' },
]

// 従業員メニュー（使いやすい順番に整理）
const employeeMenuItems: MenuItem[] = [
  // 打刻関連（最も頻繁に使う機能）
  { href: '/employee/clock', label: '打刻', icon: '', section: '打刻' },
  { href: '/employee/sales-visit', label: '営業先入退店', icon: '', section: '打刻' },
  { href: '/employee/history', label: '打刻履歴', icon: '', section: '打刻' },
  
  // 個人情報
  { href: '/employee/mypage', label: 'マイページ', icon: '', section: '個人情報' },
  
  // シフト・申請
  { href: '/employee/shifts', label: 'シフト確認', icon: '', section: 'シフト・申請' },
  { href: '/employee/applications', label: '申請一覧', icon: '', section: 'シフト・申請' },
  
  // 通知
  { href: '/employee/notifications', label: '通知', icon: '', section: '通知' },
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
  const { data: session, update } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const [company, setCompany] = useState<Company | null>(null)
  const [settings, setSettings] = useState<{ enableSalesVisit?: boolean } | null>(null)

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
      
      // 設定を取得（従業員の場合のみ）
      if (session.user.role === 'employee') {
        fetch('/api/settings/display')
          .then((res) => res.json())
          .then((data) => {
            if (data.enableSalesVisit !== undefined) {
              setSettings({ enableSalesVisit: data.enableSalesVisit })
            }
          })
          .catch((err) => {
            console.error('Failed to fetch settings:', err)
          })
      }
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
  // スーパー管理者がテナントの管理者画面に入っている場合（selectedCompanyIdが設定されている場合）
  // は通常の管理者メニューを表示
  if (isSuperAdmin && session.user.selectedCompanyId) {
    menuItems = adminMenuItems
  } else if (isSuperAdmin) {
    menuItems = superAdminMenuItems
  } else if (isAdmin) {
    menuItems = adminMenuItems
  } else {
    menuItems = employeeMenuItems
    // 営業先入退店機能が無効の場合はメニューから除外
    if (settings && settings.enableSalesVisit === false) {
      menuItems = menuItems.filter(item => item.href !== '/employee/sales-visit')
    }
  }

  // スーパー管理者の場合、店舗切り替えメニューを先頭に追加
  if (isSuperAdmin) {
    const handleStoreSwitch = async (e: React.MouseEvent) => {
      e.preventDefault()
      try {
        // selectedCompanyIdをクリア
        await update({
          selectedCompanyId: null,
        })
        // セッションが更新されるまで少し待機
        await new Promise(resolve => setTimeout(resolve, 300))
        // ページを完全にリロードしてセッション更新を確実に反映
        window.location.href = '/super-admin/select-company'
      } catch (err) {
        console.error('Failed to switch store:', err)
        // エラーが発生しても遷移
        window.location.href = '/super-admin/select-company'
      }
    }
    
    const storeSwitchItem: MenuItem = {
      href: '/super-admin/select-company',
      label: '店舗切り替え',
      icon: '',
      section: 'システム',
      onClick: handleStoreSwitch
    }
    menuItems = [storeSwitchItem, ...menuItems]
  }

  const handleLogout = async () => {
    if (confirm('ログアウトしますか？')) {
      try {
        await signOut({ 
          redirect: false,
          callbackUrl: '/auth/signin'
        })
        // セッションを完全にクリアするため、ページを完全にリロード
        window.location.href = '/auth/signin'
      } catch (error) {
        console.error('Logout error:', error)
        // エラーが発生してもログインページにリダイレクト
        window.location.href = '/auth/signin'
      }
    }
  }

  return (
    <>
      {/* オーバーレイ */}
      {isHamburgerMode && (
        <div
          className={`fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity no-print ${
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
          <h1 className="text-xl font-bold">らくっぽ勤怠</h1>
          <p className="text-sm text-gray-400 mt-1">勤怠管理システム</p>
        </div>

      {/* メニュー */}
      <nav className="flex-1 p-4 overflow-y-auto">
        <ul className="space-y-4">
          {(() => {
            // セクションごとにグループ化
            const sections: { [key: string]: MenuItem[] } = {}
            let currentSection = ''
            
            menuItems.forEach((item) => {
              const section = item.section || 'その他'
              if (!sections[section]) {
                sections[section] = []
              }
              sections[section].push(item)
            })
            
            // セクションごとにレンダリング
            return Object.entries(sections).map(([sectionName, items]) => (
              <li key={sectionName}>
                {/* セクション見出し（最初のセクション以外に表示） */}
                {sectionName !== 'その他' && (
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-2 px-2">
                    {sectionName}
                  </div>
                )}
                <ul className="space-y-1">
                  {items.map((item) => {
                    const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
                    return (
                      <li key={item.href}>
                        {item.onClick ? (
                          <button
                            onClick={(e) => {
                              item.onClick?.(e)
                              if (isHamburgerMode) onClose?.()
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition ${
                              isActive
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                            }`}
                          >
                            <span className="font-medium text-sm">{item.label}</span>
                          </button>
                        ) : (
                          <Link
                            href={item.href}
                            onClick={isHamburgerMode ? onClose : undefined}
                            className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition ${
                              isActive
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                            }`}
                          >
                            <span className="font-medium text-sm">{item.label}</span>
                          </Link>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </li>
            ))
          })()}
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
