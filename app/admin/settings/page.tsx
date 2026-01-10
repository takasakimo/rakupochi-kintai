'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface CompanySettings {
  id: number
  companyId: number
  payday: number
  workStartTime: string | null
  workEndTime: string | null
  standardBreakMinutes: number
  overtimeThreshold40: number
  overtimeThreshold60: number
  consecutiveWorkAlert: number
  leaveExpiryAlertDays: number
  allowPreOvertime: boolean
}

export default function AdminSettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [settings, setSettings] = useState<CompanySettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [formData, setFormData] = useState({
    payday: 25,
    workStartTime: '',
    workEndTime: '',
    standardBreakMinutes: 60,
    overtimeThreshold40: 40,
    overtimeThreshold60: 60,
    consecutiveWorkAlert: 6,
    leaveExpiryAlertDays: 30,
    allowPreOvertime: false,
  })

  useEffect(() => {
    if (status === 'authenticated') {
      const isAdmin = session?.user.role === 'admin'
      const isSuperAdmin = session?.user.role === 'super_admin' || 
                          session?.user.email === 'superadmin@rakupochi.com'
      
      if (isAdmin || (isSuperAdmin && session?.user.selectedCompanyId)) {
        fetchSettings()
      }
    }
  }, [status, session])

  const fetchSettings = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/settings')
      const data = await response.json()
      if (data.settings) {
        setSettings(data.settings)
        setFormData({
          payday: data.settings.payday,
          workStartTime: data.settings.workStartTime
            ? data.settings.workStartTime.slice(0, 5)
            : '',
          workEndTime: data.settings.workEndTime
            ? data.settings.workEndTime.slice(0, 5)
            : '',
          standardBreakMinutes: data.settings.standardBreakMinutes,
          overtimeThreshold40: data.settings.overtimeThreshold40,
          overtimeThreshold60: data.settings.overtimeThreshold60,
          consecutiveWorkAlert: data.settings.consecutiveWorkAlert,
          leaveExpiryAlertDays: data.settings.leaveExpiryAlertDays,
          allowPreOvertime: data.settings.allowPreOvertime ?? false,
        })
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err)
      setMessage({ type: 'error', text: '設定の取得に失敗しました' })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payday: parseInt(formData.payday.toString()),
          workStartTime: formData.workStartTime || null,
          workEndTime: formData.workEndTime || null,
          standardBreakMinutes: parseInt(formData.standardBreakMinutes.toString()),
          overtimeThreshold40: parseInt(formData.overtimeThreshold40.toString()),
          overtimeThreshold60: parseInt(formData.overtimeThreshold60.toString()),
          consecutiveWorkAlert: parseInt(formData.consecutiveWorkAlert.toString()),
          leaveExpiryAlertDays: parseInt(formData.leaveExpiryAlertDays.toString()),
          allowPreOvertime: formData.allowPreOvertime,
        }),
      })

      const data = await response.json()
      if (data.success) {
        setSettings(data.settings)
        setMessage({ type: 'success', text: '設定を保存しました' })
        setTimeout(() => setMessage(null), 3000)
      } else {
        setMessage({ type: 'error', text: data.error || '設定の保存に失敗しました' })
      }
    } catch (err) {
      console.error('Failed to save settings:', err)
      setMessage({ type: 'error', text: '設定の保存に失敗しました' })
    } finally {
      setSaving(false)
    }
  }

  if (status === 'loading' || loading) {
    return <div className="p-8 text-center text-gray-900">読み込み中...</div>
  }

  return (
    <div className="p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-gray-900">企業設定</h1>

        {message && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-50 text-green-800'
                : 'bg-red-50 text-red-800'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 給与締め日 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                給与締め日
              </label>
              <input
                type="number"
                min="1"
                max="31"
                value={formData.payday}
                onChange={(e) =>
                  setFormData({ ...formData, payday: parseInt(e.target.value) || 1 })
                }
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
              />
              <p className="mt-1 text-sm text-gray-500">毎月の給与締め日（1-31日）</p>
            </div>

            {/* 標準始業時刻 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                標準始業時刻
              </label>
              <input
                type="time"
                value={formData.workStartTime}
                onChange={(e) =>
                  setFormData({ ...formData, workStartTime: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
              />
              <p className="mt-1 text-sm text-gray-500">標準的な始業時刻（任意）</p>
            </div>

            {/* 標準終業時刻 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                標準終業時刻
              </label>
              <input
                type="time"
                value={formData.workEndTime}
                onChange={(e) =>
                  setFormData({ ...formData, workEndTime: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
              />
              <p className="mt-1 text-sm text-gray-500">標準的な終業時刻（任意）</p>
            </div>

            {/* 標準休憩時間 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                標準休憩時間（分）
              </label>
              <input
                type="number"
                min="0"
                value={formData.standardBreakMinutes}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    standardBreakMinutes: parseInt(e.target.value) || 0,
                  })
                }
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
              />
              <p className="mt-1 text-sm text-gray-500">標準的な休憩時間（分）</p>
            </div>

            {/* 前残業設定 */}
            <div className="border-t pt-6">
              <h2 className="text-lg font-semibold mb-4 text-gray-900">残業設定</h2>
              <div className="mb-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.allowPreOvertime}
                    onChange={(e) =>
                      setFormData({ ...formData, allowPreOvertime: e.target.checked })
                    }
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm font-medium text-gray-700">
                    前残業を認める
                  </span>
                </label>
                <p className="mt-1 text-sm text-gray-500">
                  チェックを入れると、就業時間前の勤務も残業として計算します。
                  チェックを外すと、就業時間後の時間のみを残業として計算します。
                </p>
              </div>
            </div>

            <div className="border-t pt-6">
              <h2 className="text-lg font-semibold mb-4 text-gray-900">アラート設定</h2>

              {/* 残業40時間アラート */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  残業40時間アラート（時間）
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.overtimeThreshold40}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      overtimeThreshold40: parseInt(e.target.value) || 0,
                    })
                  }
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                />
                <p className="mt-1 text-sm text-gray-500">
                  この時間を超えるとアラートが表示されます
                </p>
              </div>

              {/* 残業60時間アラート */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  残業60時間アラート（時間）
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.overtimeThreshold60}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      overtimeThreshold60: parseInt(e.target.value) || 0,
                    })
                  }
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                />
                <p className="mt-1 text-sm text-gray-500">
                  この時間を超えるとアラートが表示されます
                </p>
              </div>

              {/* 連続勤務アラート */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  連続勤務アラート（日数）
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.consecutiveWorkAlert}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      consecutiveWorkAlert: parseInt(e.target.value) || 1,
                    })
                  }
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                />
                <p className="mt-1 text-sm text-gray-500">
                  この日数を超えて連続勤務するとアラートが表示されます
                </p>
              </div>

              {/* 有給失効前通知 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  有給失効前通知（日数）
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.leaveExpiryAlertDays}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      leaveExpiryAlertDays: parseInt(e.target.value) || 1,
                    })
                  }
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                />
                <p className="mt-1 text-sm text-gray-500">
                  有給失効の何日前に通知するか
                </p>
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {saving ? '保存中...' : '保存'}
              </button>
              <button
                type="button"
                onClick={fetchSettings}
                className="px-6 py-2 bg-gray-200 text-gray-900 rounded-md hover:bg-gray-300 font-medium"
              >
                リセット
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

