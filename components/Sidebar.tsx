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

// 管理者メニュー（カテゴリごとに整理）
const adminMenuItems: MenuItem[] = [
  // ダッシュボード
  { href: '/admin/dashboard', label: 'ダッシュボード', icon: '', section: 'ダッシュボード' },
  
  // 勤怠管理
  { href: '/employee/clock', label: '打刻', icon: '', section: '勤怠管理' },
  { href: '/admin/attendances', label: '打刻管理', icon: '', section: '勤怠管理' },
  { href: '/admin/sales-visit', label: '営業先入退店管理', icon: '', section: '勤怠管理' },
  
  // マスタ管理
  { href: '/admin/employees', label: '従業員管理', icon: '', section: 'マスタ管理' },
  { href: '/admin/shifts/manage', label: 'シフト管理', icon: '', section: 'マスタ管理' },
  
  // 申請・承認
  { href: '/admin/applications', label: '申請管理', icon: '', section: '申請・承認' },
  
  // レポート・分析
  { href: '/admin/reports', label: 'レポート', icon: '', section: 'レポート・分析' },
  
  // お知らせ・通知
  { href: '/admin/announcements', label: 'お知らせ管理', icon: '', section: 'お知らせ・通知' },
  { href: '/admin/notifications', label: '通知管理', icon: '', section: 'お知らせ・通知' },
  
  // システム設定
  { href: '/admin/settings', label: '設定', icon: '', section: 'システム設定' },
]

const superAdminMenuItems: MenuItem[] = [
  { href: '/super-admin/companies', label: '企業管理', icon: '' },
]

// 従業員メニュー（カテゴリごとに整理）
const employeeMenuItems: MenuItem[] = [
  // 勤怠
  { href: '/employee/clock', label: '打刻', icon: '', section: '勤怠' },
  { href: '/employee/sales-visit', label: '営業先入退店', icon: '', section: '勤怠' },
  { href: '/employee/history', label: '打刻履歴', icon: '', section: '勤怠' },
  
  // シフト・申請
  { href: '/employee/shifts', label: 'シフト確認', icon: '', section: 'シフト・申請' },
  { href: '/employee/applications', label: '申請一覧', icon: '', section: 'シフト・申請' },
  
  // マイページ
  { href: '/employee/mypage', label: 'マイページ', icon: '', section: 'マイページ' },
  
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
  const [settings, setSettings] = useState<{ enableSalesVisit?: boolean; enableInvoice?: boolean; enableCleaningCheck?: boolean } | null>(null)

  useEffect(() => {
    const isSuperAdmin = session?.user?.role === 'super_admin' || 
                        session?.user?.email === 'superadmin@rakupochi.com'
    const effectiveCompanyId = isSuperAdmin 
      ? session?.user?.selectedCompanyId 
      : session?.user?.companyId
    
    if (effectiveCompanyId) {
      // 企業情報を取得（通常の管理者の場合のみ）
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
      
      // 設定を取得
      if (session?.user?.role === 'employee') {
        fetch('/api/settings/display')
          .then((res) => res.json())
          .then((data) => {
            if (data.enableSalesVisit !== undefined || data.enableCleaningCheck !== undefined) {
              setSettings({
                enableSalesVisit: data.enableSalesVisit,
                enableCleaningCheck: data.enableCleaningCheck,
              })
            }
          })
          .catch((err) => {
            console.error('Failed to fetch settings:', err)
          })
      } else if (session?.user?.role === 'admin' || isSuperAdmin) {
        // 管理者の場合はenableInvoice設定を取得
        fetch('/api/admin/settings')
          .then((res) => res.json())
          .then((data) => {
            if (data.settings) {
              setSettings({
                enableInvoice: data.settings.enableInvoice,
                enableCleaningCheck: data.settings.enableCleaningCheck,
              })
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
    menuItems = [...adminMenuItems]
  } else if (isSuperAdmin) {
    menuItems = superAdminMenuItems
  } else if (isAdmin) {
    menuItems = [...adminMenuItems]
  } else {
    menuItems = employeeMenuItems
    // 営業先入退店機能が無効の場合はメニューから除外
    if (settings && settings.enableSalesVisit === false) {
      menuItems = menuItems.filter(item => item.href !== '/employee/sales-visit')
    }
    // 清掃案件管理（入退場）機能が有効な場合はメニューに追加
    if (settings?.enableCleaningCheck) {
      const cleaningItem: MenuItem = {
        href: '/employee/cleaning-check',
        label: '入退場',
        icon: '',
        section: '勤怠',
      }
      const salesVisitIndex = menuItems.findIndex(item => item.href === '/employee/sales-visit')
      const insertIndex = salesVisitIndex >= 0 ? salesVisitIndex + 1 : 1
      menuItems.splice(insertIndex, 0, cleaningItem)
    }
  }

  // 管理者メニューの場合、enableCleaningCheckがtrueの場合のみ清掃案件管理・入退場メニューを追加
  if ((isAdmin || (isSuperAdmin && session.user.selectedCompanyId)) && settings?.enableCleaningCheck) {
    const cleaningAdminItem: MenuItem = {
      href: '/admin/cleaning-check',
      label: '清掃案件管理',
      icon: '',
      section: '勤怠管理',
    }
    const cleaningCheckInOutItem: MenuItem = {
      href: '/employee/cleaning-check',
      label: '入退場',
      icon: '',
      section: '勤怠管理',
    }
    const salesVisitIndex = menuItems.findIndex(item => item.href === '/admin/sales-visit')
    const insertIndex = salesVisitIndex >= 0 ? salesVisitIndex + 1 : 3
    menuItems.splice(insertIndex, 0, cleaningAdminItem)
    menuItems.splice(insertIndex + 1, 0, cleaningCheckInOutItem)
  }

  // 管理者メニューの場合、enableInvoiceがtrueの場合のみ請求書関連メニューを追加
  if ((isAdmin || (isSuperAdmin && session.user.selectedCompanyId)) && settings?.enableInvoice) {
    // 請求書設定と請求書管理のメニューを「マスタ管理」セクションに追加
    const invoiceSettingsMenuItem: MenuItem = {
      href: '/admin/invoice-settings',
      label: '請求書設定',
      icon: '',
      section: 'マスタ管理',
    }
    const invoiceMenuItem: MenuItem = {
      href: '/admin/invoices',
      label: '請求書管理',
      icon: '',
      section: 'マスタ管理',
    }
    // シフト管理の後に追加
    const shiftsIndex = menuItems.findIndex(item => item.href === '/admin/shifts/manage')
    if (shiftsIndex >= 0) {
      menuItems.splice(shiftsIndex + 1, 0, invoiceSettingsMenuItem, invoiceMenuItem)
    } else {
      menuItems.push(invoiceSettingsMenuItem, invoiceMenuItem)
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
      section: 'システム管理',
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
        <ul className="space-y-2">
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
            
            // 各セクション内の項目を元の順序で保持
            Object.keys(sections).forEach(section => {
              sections[section] = sections[section].sort((a, b) => {
                const indexA = menuItems.findIndex(item => item.href === a.href)
                const indexB = menuItems.findIndex(item => item.href === b.href)
                return indexA - indexB
              })
            })
            
            // セクションごとにレンダリング（順序を保持）
            const sectionOrder = [
              'ダッシュボード',
              '勤怠管理',
              'マスタ管理',
              '申請・承認',
              'レポート・分析',
              'お知らせ・通知',
              'システム設定',
              'システム管理',
              '勤怠',
              'シフト・申請',
              'マイページ',
              '通知',
              'その他'
            ]
            
            // セクションを順序付け
            const orderedSections: [string, MenuItem[]][] = sectionOrder
              .filter(section => sections[section])
              .map(section => [section, sections[section]])
            
            // 順序にないセクションも追加
            Object.entries(sections).forEach(([sectionName, items]) => {
              if (!sectionOrder.includes(sectionName)) {
                orderedSections.push([sectionName, items])
              }
            })
            
            return orderedSections.map(([sectionName, items]) => (
              <li key={sectionName} className="mb-4">
                {/* セクション見出し */}
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-2 border-b border-gray-700 pb-1">
                  {sectionName}
                </div>
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
