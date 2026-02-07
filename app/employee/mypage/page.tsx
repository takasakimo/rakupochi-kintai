'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface AttendanceSummary {
  totalWorkDays: number
  totalWorkMinutes: number
  totalOvertimeMinutes: number
}

interface Employee {
  id: number
  employeeNumber: string
  name: string
  email: string
  phone: string | null
  address: string | null
  bankAccount: string | null
  transportationRoutes: any | null
  transportationCost: number | null
}

interface Notification {
  id: number
  type: string
  title: string
  message: string
  isRead: boolean
  createdAt: string
}

export default function MyPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [summary, setSummary] = useState<AttendanceSummary | null>(null)
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    passwordConfirm: '',
    phone: '',
    address: '',
    bankAccount: '',
    transportationRoutes: [] as Array<{ from: string; to: string; method: string; amount: string }>,
    transportationCost: '',
  })

  useEffect(() => {
    if (status === 'authenticated') {
      fetchSummary()
      fetchEmployee()
      fetchNotifications()
    }
  }, [status])

  const fetchEmployee = async () => {
    try {
      const response = await fetch('/api/employee/mypage')
      if (response.ok) {
        const data = await response.json()
        if (data.employee) {
          setEmployee(data.employee)
          setFormData({
            email: data.employee.email || '',
            password: '',
            passwordConfirm: '',
            phone: data.employee.phone || '',
            address: data.employee.address || '',
            bankAccount: data.employee.bankAccount || '',
            transportationRoutes: Array.isArray(data.employee.transportationRoutes)
              ? data.employee.transportationRoutes
              : [],
            transportationCost: data.employee.transportationCost?.toString() || '',
          })
        }
      }
    } catch (err) {
      console.error('Failed to fetch employee:', err)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)
    setSaving(true)

    // バリデーション
    if (!formData.email || !formData.phone || !formData.address) {
      setError('メールアドレス、電話番号、住所は必須です')
      setSaving(false)
      return
    }

    if (formData.password && formData.password.length < 8) {
      setError('パスワードは8文字以上で入力してください')
      setSaving(false)
      return
    }

    if (formData.password && formData.password !== formData.passwordConfirm) {
      setError('パスワードが一致しません')
      setSaving(false)
      return
    }

    try {
      const payload: any = {
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        bankAccount: formData.bankAccount || null,
        transportationRoutes: formData.transportationRoutes.length > 0 ? formData.transportationRoutes : null,
        transportationCost: formData.transportationCost ? parseInt(formData.transportationCost) : null,
      }

      // パスワードが入力されている場合のみ送信
      if (formData.password) {
        payload.password = formData.password
      }

      const response = await fetch('/api/employee/mypage', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setSuccess(true)
        setEditing(false)
        setFormData({
          ...formData,
          password: '',
          passwordConfirm: '',
        })
        await fetchEmployee()
        setTimeout(() => setSuccess(false), 3000)
      } else {
        setError(data.error || '更新に失敗しました')
      }
    } catch (err) {
      console.error('Failed to update employee:', err)
      setError('更新に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleAddTransportationRoute = () => {
    setFormData({
      ...formData,
      transportationRoutes: [
        ...formData.transportationRoutes,
        { from: '', to: '', method: '', amount: '' },
      ],
    })
  }

  const handleRemoveTransportationRoute = (index: number) => {
    setFormData({
      ...formData,
      transportationRoutes: formData.transportationRoutes.filter((_, i) => i !== index),
    })
  }

  const handleTransportationRouteChange = (
    index: number,
    field: string,
    value: string
  ) => {
    const newRoutes = [...formData.transportationRoutes]
    newRoutes[index] = { ...newRoutes[index], [field]: value }
    setFormData({ ...formData, transportationRoutes: newRoutes })
  }

  const fetchSummary = async () => {
    try {
      const currentMonth = new Date().toISOString().slice(0, 7)
      const response = await fetch(`/api/attendance/history?month=${currentMonth}`)
      const data = await response.json()

      if (data.attendances) {
        const totalWorkDays = data.attendances.filter(
          (a: any) => a.clockIn && a.clockOut
        ).length

        const totalWorkMinutes = data.attendances.reduce((sum: number, a: any) => {
          if (!a.clockIn || !a.clockOut) return sum
          const inTime = new Date(`2000-01-01T${a.clockIn}`)
          const outTime = new Date(`2000-01-01T${a.clockOut}`)
          const diffMs = outTime.getTime() - inTime.getTime()
          const diffMinutes = Math.floor(diffMs / (1000 * 60))
          return sum + Math.max(0, diffMinutes - (a.breakMinutes || 0))
        }, 0)

        // 標準勤務時間（8時間 × 出勤日数）を超えた分を残業とする
        const standardMinutes = totalWorkDays * 8 * 60
        const totalOvertimeMinutes = Math.max(0, totalWorkMinutes - standardMinutes)

        setSummary({
          totalWorkDays,
          totalWorkMinutes,
          totalOvertimeMinutes,
        })
      }
    } catch (err) {
      console.error('Failed to fetch summary:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchNotifications = async () => {
    try {
      const response = await fetch('/api/notifications?is_read=false')
      const data = await response.json()
      if (data.notifications) {
        setNotifications(data.notifications.slice(0, 5)) // 最新5件のみ表示
        setUnreadCount(data.notifications.length)
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err)
    }
  }

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}時間${mins}分`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ja-JP', {
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getNotificationTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      overtime_alert: '残業アラート',
      attendance_missing: '打刻忘れ',
      consecutive_work: '連続勤務',
      leave_expiry: '有給失効',
    }
    return labels[type] || type
  }

  const getNotificationTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      overtime_alert: 'bg-orange-100 text-orange-800',
      attendance_missing: 'bg-red-100 text-red-800',
      consecutive_work: 'bg-yellow-100 text-yellow-800',
      leave_expiry: 'bg-blue-100 text-blue-800',
    }
    return colors[type] || 'bg-gray-100 text-gray-800'
  }

  if (status === 'loading' || loading) {
    return <div className="p-8 text-center text-gray-900">読み込み中...</div>
  }

  return (
    <div className="p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">マイページ</h1>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 font-medium"
            >
              編集
            </button>
          )}
        </div>

        {editing ? (
          <form onSubmit={handleSave} className="space-y-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900">基本情報</h2>
              
              {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm">
                  {error}
                </div>
              )}

              {success && (
                <div className="mb-4 p-3 bg-green-50 text-green-700 rounded text-sm">
                  更新が完了しました
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    メールアドレス <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    パスワード <span className="text-gray-500 text-xs">(変更する場合のみ入力)</span>
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    minLength={8}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                  <p className="mt-1 text-xs text-gray-500">8文字以上</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    パスワード（確認） <span className="text-gray-500 text-xs">(変更する場合のみ入力)</span>
                  </label>
                  <input
                    type="password"
                    value={formData.passwordConfirm}
                    onChange={(e) => setFormData({ ...formData, passwordConfirm: e.target.value })}
                    minLength={8}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    電話番号 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    住所 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    振込先口座 <span className="text-gray-500 text-xs">(任意)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.bankAccount}
                    onChange={(e) => setFormData({ ...formData, bankAccount: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      交通経路 <span className="text-gray-500 text-xs">(任意)</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleAddTransportationRoute}
                      className="text-sm text-blue-500 hover:text-blue-600"
                    >
                      + 追加
                    </button>
                  </div>
                  {formData.transportationRoutes.map((route, index) => (
                    <div key={index} className="mb-2 p-3 border border-gray-300 rounded-md">
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <input
                          type="text"
                          placeholder="出発地"
                          value={route.from}
                          onChange={(e) => handleTransportationRouteChange(index, 'from', e.target.value)}
                          className="px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white"
                        />
                        <input
                          type="text"
                          placeholder="到着地"
                          value={route.to}
                          onChange={(e) => handleTransportationRouteChange(index, 'to', e.target.value)}
                          className="px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white"
                        />
                        <input
                          type="text"
                          placeholder="交通手段"
                          value={route.method}
                          onChange={(e) => handleTransportationRouteChange(index, 'method', e.target.value)}
                          className="px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white"
                        />
                        <div className="flex gap-2">
                          <input
                            type="number"
                            placeholder="金額"
                            value={route.amount}
                            onChange={(e) => handleTransportationRouteChange(index, 'amount', e.target.value)}
                            className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveTransportationRoute(index)}
                            className="px-2 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                          >
                            削除
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {formData.transportationRoutes.length === 0 && (
                    <p className="text-sm text-gray-500">交通経路が登録されていません</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    定期代（月額） <span className="text-gray-500 text-xs">(任意)</span>
                  </label>
                  <input
                    type="number"
                    value={formData.transportationCost}
                    onChange={(e) => setFormData({ ...formData, transportationCost: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                  <p className="mt-1 text-xs text-gray-500">円単位で入力してください</p>
                </div>
              </div>

              <div className="flex gap-4 mt-6">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 font-medium disabled:opacity-50"
                >
                  {saving ? '保存中...' : '保存'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false)
                    setError('')
                    setSuccess(false)
                    fetchEmployee()
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-900 rounded-md hover:bg-gray-300 font-medium"
                >
                  キャンセル
                </button>
              </div>
            </div>
          </form>
        ) : (
          <>
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900">基本情報</h2>
              {employee && (
                <div className="space-y-3">
                  <div>
                    <span className="text-sm text-gray-600">メールアドレス:</span>
                    <p className="text-gray-900 font-medium">{employee.email}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">電話番号:</span>
                    <p className="text-gray-900 font-medium">{employee.phone || '-'}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">住所:</span>
                    <p className="text-gray-900 font-medium">{employee.address || '-'}</p>
                  </div>
                  {employee.bankAccount && (
                    <div>
                      <span className="text-sm text-gray-600">振込先口座:</span>
                      <p className="text-gray-900 font-medium">{employee.bankAccount}</p>
                    </div>
                  )}
                  {employee.transportationRoutes && Array.isArray(employee.transportationRoutes) && employee.transportationRoutes.length > 0 && (
                    <div>
                      <span className="text-sm text-gray-600">交通経路:</span>
                      <div className="mt-1 space-y-1">
                        {employee.transportationRoutes.map((route: any, index: number) => (
                          <p key={index} className="text-gray-900 text-sm">
                            {route.from} → {route.to} ({route.method}) {route.amount}円
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                  {employee.transportationCost && (
                    <div>
                      <span className="text-sm text-gray-600">定期代（月額）:</span>
                      <p className="text-gray-900 font-medium">{employee.transportationCost.toLocaleString()}円</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900">今月の勤怠サマリー</h2>
              {summary ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 bg-gray-50 rounded">
                    <span className="text-gray-900 font-medium">出勤日数</span>
                    <span className="text-2xl font-bold text-gray-900">{summary.totalWorkDays}日</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-gray-50 rounded">
                    <span className="text-gray-900 font-medium">総勤務時間</span>
                    <span className="text-2xl font-bold text-gray-900">
                      {formatMinutes(summary.totalWorkMinutes)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-gray-50 rounded">
                    <span className="text-gray-900 font-medium">残業時間</span>
                    <span className="text-2xl font-bold text-red-600">
                      {formatMinutes(summary.totalOvertimeMinutes)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-gray-700">データがありません</div>
              )}
            </div>

            {/* 通知セクション */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-900">通知</h2>
                <Link
                  href="/employee/notifications"
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  全て見る →
                </Link>
              </div>
              {unreadCount > 0 ? (
                <div className="space-y-3">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className="p-4 bg-gray-50 rounded-lg border-l-4 border-blue-500"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${getNotificationTypeColor(
                            notification.type
                          )}`}
                        >
                          {getNotificationTypeLabel(notification.type)}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatDate(notification.createdAt)}
                        </span>
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-1">{notification.title}</h3>
                      <p className="text-sm text-gray-700">{notification.message}</p>
                    </div>
                  ))}
                  {unreadCount > 5 && (
                    <div className="text-center pt-2">
                      <Link
                        href="/employee/notifications"
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                      >
                        他 {unreadCount - 5} 件の通知を見る →
                      </Link>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  未読の通知はありません
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900">メニュー</h2>
              <div className="space-y-2">
                <Link
                  href="/employee/clock"
                  className="block p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition text-gray-900 font-medium"
                >
                  打刻
                </Link>
                <Link
                  href="/employee/history"
                  className="block p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition text-gray-900 font-medium"
                >
                  打刻履歴
                </Link>
                <Link
                  href="/employee/applications"
                  className="block p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition text-gray-900 font-medium"
                >
                  申請一覧
                </Link>
                <Link
                  href="/employee/shifts"
                  className="block p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition text-gray-900 font-medium"
                >
                  シフト管理
                </Link>
                <Link
                  href="/employee/notifications"
                  className="relative block p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition text-gray-900 font-medium"
                >
                  通知
                  {unreadCount > 0 && (
                    <span className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

