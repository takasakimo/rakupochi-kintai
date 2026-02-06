'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface Company {
  id: number
  name: string
  code: string
  isActive: boolean
}

interface CompanySettings {
  allowPreOvertime: boolean
  enableSalesVisit: boolean
  enableWakeUpDeparture: boolean
  enableInvoice: boolean
}

export default function SelectCompanyPage() {
  const { data: session, status, update } = useSession()
  const router = useRouter()
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null)
  const [editingSettingsCompanyId, setEditingSettingsCompanyId] = useState<number | null>(null)
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null)
  const [loadingSettings, setLoadingSettings] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)

  useEffect(() => {
    if (status === 'authenticated') {
      const isSuperAdmin =
        session?.user.role === 'super_admin' ||
        session?.user.email === 'superadmin@rakupochi.com'

      if (!isSuperAdmin) {
        router.push('/')
        return
      }

      fetchCompanies()
    }
  }, [status, session, router])

  const fetchCompanies = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/super-admin/companies')
      const data = await response.json()
      setCompanies(data.companies || [])
    } catch (err) {
      console.error('Failed to fetch companies:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectCompany = async (companyId: number) => {
    try {
      // セッションを更新
      await update({
        selectedCompanyId: companyId,
      })

      // 企業の管理画面にリダイレクト
      router.push(`/admin/dashboard?companyId=${companyId}`)
    } catch (err) {
      console.error('Failed to select company:', err)
      alert('企業の選択に失敗しました')
    }
  }

  const handleOpenSettings = async (companyId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingSettingsCompanyId(companyId)
    setLoadingSettings(true)
    try {
      const response = await fetch(`/api/super-admin/companies/${companyId}/settings`)
      const data = await response.json()
      if (data.settings) {
        setCompanySettings({
          allowPreOvertime: data.settings.allowPreOvertime ?? false,
          enableSalesVisit: data.settings.enableSalesVisit ?? true,
          enableWakeUpDeparture: data.settings.enableWakeUpDeparture ?? true,
          enableInvoice: data.settings.enableInvoice ?? false,
        })
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err)
      alert('設定の取得に失敗しました')
    } finally {
      setLoadingSettings(false)
    }
  }

  const handleCloseSettings = () => {
    setEditingSettingsCompanyId(null)
    setCompanySettings(null)
  }

  const handleSaveSettings = async () => {
    if (!editingSettingsCompanyId || !companySettings) return

    setSavingSettings(true)
    try {
      const response = await fetch(`/api/super-admin/companies/${editingSettingsCompanyId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(companySettings),
      })

      const data = await response.json()
      if (data.success) {
        alert('設定を保存しました')
        handleCloseSettings()
      } else {
        alert(data.error || '設定の保存に失敗しました')
      }
    } catch (err) {
      console.error('Failed to save settings:', err)
      alert('設定の保存に失敗しました')
    } finally {
      setSavingSettings(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-900">読み込み中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">企業を選択</h1>
        <p className="text-gray-600 mb-6">
          管理する企業を選択してください。
        </p>

        {companies.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-6 text-center text-gray-700">
            企業が登録されていません。
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {companies.map((company) => (
              <div
                key={company.id}
                className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => handleSelectCompany(company.id)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {company.name}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      企業コード: {company.code}
                    </p>
                  </div>
                  <div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        company.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {company.isActive ? '有効' : '無効'}
                    </span>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleSelectCompany(company.id)
                    }}
                    className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 font-medium"
                  >
                    この企業を管理
                  </button>
                  <button
                    onClick={(e) => handleOpenSettings(company.id, e)}
                    className="px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 font-medium"
                  >
                    設定
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8">
          <button
            onClick={() => router.push('/super-admin/companies')}
            className="px-4 py-2 bg-gray-200 text-gray-900 rounded-md hover:bg-gray-300 font-medium"
          >
            企業を新規登録
          </button>
        </div>

        {/* テナント設定モーダル */}
        {editingSettingsCompanyId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
              <h2 className="text-xl font-bold mb-4 text-gray-900">
                テナント設定 - {companies.find(c => c.id === editingSettingsCompanyId)?.name}
              </h2>
              
              {loadingSettings ? (
                <div className="text-center py-8 text-gray-900">読み込み中...</div>
              ) : companySettings ? (
                <div className="space-y-4">
                  <div className="border-t pt-4">
                    <h3 className="text-sm font-semibold mb-3 text-gray-900">機能設定</h3>
                    
                    <div className="mb-4">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={companySettings.allowPreOvertime}
                          onChange={(e) =>
                            setCompanySettings({
                              ...companySettings,
                              allowPreOvertime: e.target.checked,
                            })
                          }
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm font-medium text-gray-700">
                          前残業を認める
                        </span>
                      </label>
                      <p className="mt-1 text-xs text-gray-500 ml-6">
                        チェックを入れると、就業時間前の勤務も残業として計算します。
                      </p>
                    </div>

                    <div className="mb-4">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={companySettings.enableSalesVisit}
                          onChange={(e) =>
                            setCompanySettings({
                              ...companySettings,
                              enableSalesVisit: e.target.checked,
                            })
                          }
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm font-medium text-gray-700">
                          営業先入退店機能を表示する
                        </span>
                      </label>
                      <p className="mt-1 text-xs text-gray-500 ml-6">
                        チェックを入れると、従業員メニューに「営業先入退店」が表示されます。
                      </p>
                    </div>

                    <div className="mb-4">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={companySettings.enableWakeUpDeparture}
                          onChange={(e) =>
                            setCompanySettings({
                              ...companySettings,
                              enableWakeUpDeparture: e.target.checked,
                            })
                          }
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm font-medium text-gray-700">
                          起床・出発報告機能を表示する
                        </span>
                      </label>
                      <p className="mt-1 text-xs text-gray-500 ml-6">
                        チェックを入れると、打刻ページに「起床」「出発」ボタンが表示されます。
                      </p>
                    </div>

                    <div className="mb-4">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={companySettings.enableInvoice}
                          onChange={(e) =>
                            setCompanySettings({
                              ...companySettings,
                              enableInvoice: e.target.checked,
                            })
                          }
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm font-medium text-gray-700">
                          請求書作成機能を表示する
                        </span>
                      </label>
                      <p className="mt-1 text-xs text-gray-500 ml-6">
                        チェックを入れると、管理者メニューに「請求先企業管理」や「請求書管理」が表示されます。
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4 border-t">
                    <button
                      onClick={handleSaveSettings}
                      disabled={savingSettings}
                      className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                      {savingSettings ? '保存中...' : '保存'}
                    </button>
                    <button
                      onClick={handleCloseSettings}
                      className="px-4 py-2 bg-gray-200 text-gray-900 rounded-md hover:bg-gray-300 font-medium"
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-900">設定の読み込みに失敗しました</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

