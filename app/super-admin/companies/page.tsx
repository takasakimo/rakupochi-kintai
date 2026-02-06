'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface Company {
  id: number
  name: string
  code: string
  email: string | null
  phone: string | null
  address: string | null
  isActive: boolean
  createdAt: string
  _count: {
    employees: number
    attendances: number
  }
}

interface CompanySettings {
  allowPreOvertime: boolean
  enableSalesVisit: boolean
  enableWakeUpDeparture: boolean
}

export default function SuperAdminCompaniesPage() {
  const { data: session, status, update } = useSession()
  const router = useRouter()
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingCompany, setEditingCompany] = useState<Company | null>(null)
  const [editingSettingsCompanyId, setEditingSettingsCompanyId] = useState<number | null>(null)
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null)
  const [loadingSettings, setLoadingSettings] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)

  const [formData, setFormData] = useState({
    companyName: '',
    companyCode: '',
    companyEmail: '',
    companyPhone: '',
    companyAddress: '',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
    adminEmployeeNumber: 'ADMIN001',
    isActive: true,
  })

  useEffect(() => {
    if (status === 'authenticated') {
      const isSuperAdmin =
        session?.user.role === 'super_admin' ||
        session?.user.email === 'superadmin@rakupochi.com'

      if (isSuperAdmin) {
        fetchCompanies()
      }
    }
  }, [status, session])

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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch('/api/super-admin/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()
      if (data.success) {
        setShowCreateForm(false)
        setFormData({
          companyName: '',
          companyCode: '',
          companyEmail: '',
          companyPhone: '',
          companyAddress: '',
          adminName: '',
          adminEmail: '',
          adminPassword: '',
          adminEmployeeNumber: 'ADMIN001',
          isActive: true,
        })
        fetchCompanies()
        alert('企業登録が完了しました')
      } else {
        alert(data.error || '企業登録に失敗しました')
      }
    } catch (err) {
      console.error('Failed to create company:', err)
      alert('企業登録に失敗しました')
    }
  }

  const handleUpdate = async (company: Company) => {
    try {
      const response = await fetch(`/api/super-admin/companies/${company.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: company.name,
          code: company.code,
          email: company.email,
          phone: company.phone,
          address: company.address,
          isActive: company.isActive,
        }),
      })

      const data = await response.json()
      if (data.success) {
        setEditingCompany(null)
        fetchCompanies()
        alert('企業情報を更新しました')
      } else {
        alert(data.error || '企業情報の更新に失敗しました')
      }
    } catch (err) {
      console.error('Failed to update company:', err)
      alert('企業情報の更新に失敗しました')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('この企業を削除しますか？関連するすべてのデータも削除されます。')) {
      return
    }

    try {
      const response = await fetch(`/api/super-admin/companies/${id}`, {
        method: 'DELETE',
      })

      const data = await response.json()
      if (data.success) {
        fetchCompanies()
        alert('企業を削除しました')
      } else {
        alert(data.error || '企業の削除に失敗しました')
      }
    } catch (err) {
      console.error('Failed to delete company:', err)
      alert('企業の削除に失敗しました')
    }
  }

  const handleEnterAdminPanel = async (companyId: number) => {
    try {
      // セッションを更新してselectedCompanyIdを設定
      await update({
        selectedCompanyId: companyId,
      })

      // セッションが更新されるまで少し待機
      await new Promise(resolve => setTimeout(resolve, 300))

      // 完全なページリロードでリダイレクト（セッション更新を確実に反映）
      window.location.href = '/admin/dashboard'
    } catch (err) {
      console.error('Failed to enter admin panel:', err)
      alert('管理者画面へのアクセスに失敗しました')
    }
  }

  const handleOpenSettings = async (companyId: number) => {
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
    return <div className="p-8 text-center text-gray-900">読み込み中...</div>
  }

  return (
    <div className="p-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-gray-900">企業管理（スーパー管理者）</h1>

        <div className="flex justify-end mb-6">
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 font-medium"
          >
            {showCreateForm ? 'キャンセル' : '+ 企業登録'}
          </button>
        </div>

        {/* 企業登録フォーム */}
        {showCreateForm && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4 text-gray-900">新規企業登録</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    企業名 *
                  </label>
                  <input
                    type="text"
                    value={formData.companyName}
                    onChange={(e) =>
                      setFormData({ ...formData, companyName: e.target.value })
                    }
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    企業コード *
                  </label>
                  <input
                    type="text"
                    value={formData.companyCode}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        companyCode: e.target.value.toUpperCase(),
                      })
                    }
                    required
                    pattern="[A-Z0-9]+"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    企業メールアドレス
                  </label>
                  <input
                    type="email"
                    value={formData.companyEmail}
                    onChange={(e) =>
                      setFormData({ ...formData, companyEmail: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    電話番号
                  </label>
                  <input
                    type="tel"
                    value={formData.companyPhone}
                    onChange={(e) =>
                      setFormData({ ...formData, companyPhone: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    住所
                  </label>
                  <input
                    type="text"
                    value={formData.companyAddress}
                    onChange={(e) =>
                      setFormData({ ...formData, companyAddress: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>
                <div className="md:col-span-2 border-t pt-4">
                  <h3 className="font-semibold mb-2 text-gray-900">初期管理者アカウント</h3>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    社員番号 *
                  </label>
                  <input
                    type="text"
                    value={formData.adminEmployeeNumber}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        adminEmployeeNumber: e.target.value,
                      })
                    }
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    氏名 *
                  </label>
                  <input
                    type="text"
                    value={formData.adminName}
                    onChange={(e) =>
                      setFormData({ ...formData, adminName: e.target.value })
                    }
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    メールアドレス *
                  </label>
                  <input
                    type="email"
                    value={formData.adminEmail}
                    onChange={(e) =>
                      setFormData({ ...formData, adminEmail: e.target.value })
                    }
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    パスワード *
                  </label>
                  <input
                    type="password"
                    value={formData.adminPassword}
                    onChange={(e) =>
                      setFormData({ ...formData, adminPassword: e.target.value })
                    }
                    required
                    minLength={8}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) =>
                        setFormData({ ...formData, isActive: e.target.checked })
                      }
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-gray-700">アクティブ</span>
                  </label>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 font-medium"
                >
                  登録
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-900 rounded-md hover:bg-gray-300 font-medium"
                >
                  キャンセル
                </button>
              </div>
            </form>
          </div>
        )}

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

        {/* 企業一覧 */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {companies.length === 0 ? (
            <div className="p-6 text-center text-gray-700">企業がありません</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      企業名
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      企業コード
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      従業員数
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      打刻数
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      ステータス
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      登録日
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {companies.map((company) => (
                    <tr key={company.id} className="hover:bg-gray-50">
                      {editingCompany?.id === company.id ? (
                        <>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={editingCompany.name}
                              onChange={(e) =>
                                setEditingCompany({
                                  ...editingCompany,
                                  name: e.target.value,
                                })
                              }
                              className="px-2 py-1 border border-gray-300 rounded text-gray-900 bg-white"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={editingCompany.code}
                              onChange={(e) =>
                                setEditingCompany({
                                  ...editingCompany,
                                  code: e.target.value.toUpperCase(),
                                })
                              }
                              className="px-2 py-1 border border-gray-300 rounded text-gray-900 bg-white"
                            />
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {company._count.employees}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {company._count.attendances}
                          </td>
                          <td className="px-4 py-3">
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={editingCompany.isActive}
                                onChange={(e) =>
                                  setEditingCompany({
                                    ...editingCompany,
                                    isActive: e.target.checked,
                                  })
                                }
                                className="w-4 h-4"
                              />
                              <span className="text-sm text-gray-700">
                                {editingCompany.isActive ? '有効' : '無効'}
                              </span>
                            </label>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {new Date(company.createdAt).toLocaleDateString('ja-JP')}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleUpdate(editingCompany)}
                                className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
                              >
                                保存
                              </button>
                              <button
                                onClick={() => setEditingCompany(null)}
                                className="px-3 py-1 bg-gray-200 text-gray-900 rounded text-sm hover:bg-gray-300"
                              >
                                キャンセル
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {company.name}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {company.code}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {company._count.employees}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {company._count.attendances}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                company.isActive
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {company.isActive ? '有効' : '無効'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {new Date(company.createdAt).toLocaleDateString('ja-JP')}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2 flex-wrap">
                              <button
                                onClick={() => handleEnterAdminPanel(company.id)}
                                className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
                              >
                                管理者画面に入る
                              </button>
                              <button
                                onClick={() => handleOpenSettings(company.id)}
                                className="px-3 py-1 bg-purple-500 text-white rounded text-sm hover:bg-purple-600"
                              >
                                設定
                              </button>
                              <button
                                onClick={() => setEditingCompany(company)}
                                className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                              >
                                編集
                              </button>
                              <button
                                onClick={() => handleDelete(company.id)}
                                className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                              >
                                削除
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

