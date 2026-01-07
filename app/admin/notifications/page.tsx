'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface Notification {
  id: number
  type: string
  title: string
  message: string
  isRead: boolean
  createdAt: string
  employee: {
    id: number
    name: string
    employeeNumber: string
  }
}

const NOTIFICATION_TYPES: Record<string, { label: string; color: string }> = {
  overtime_alert: { label: '残業アラート', color: 'bg-orange-100 text-orange-800' },
  attendance_missing: { label: '打刻忘れ', color: 'bg-red-100 text-red-800' },
  consecutive_work: { label: '連続勤務', color: 'bg-yellow-100 text-yellow-800' },
  leave_expiry: { label: '有給失効', color: 'bg-blue-100 text-blue-800' },
}

export default function AdminNotificationsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all')
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('')
  const [employees, setEmployees] = useState<any[]>([])

  useEffect(() => {
    if (status === 'authenticated' && session?.user.role === 'admin') {
      fetchEmployees()
      fetchNotifications()
    }
  }, [status, session, filter, selectedEmployeeId])

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/admin/employees')
      const data = await response.json()
      setEmployees(data.employees || [])
    } catch (err) {
      console.error('Failed to fetch employees:', err)
    }
  }

  const fetchNotifications = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filter === 'unread') {
        params.append('is_read', 'false')
      } else if (filter === 'read') {
        params.append('is_read', 'true')
      }
      if (selectedEmployeeId) {
        params.append('employee_id', selectedEmployeeId)
      }

      const response = await fetch(`/api/notifications?${params.toString()}`)
      const data = await response.json()
      setNotifications(data.notifications || [])
    } catch (err) {
      console.error('Failed to fetch notifications:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateAlerts = async () => {
    if (!confirm('アラートを生成しますか？')) return

    try {
      const response = await fetch('/api/admin/alerts/generate', {
        method: 'POST',
      })

      const data = await response.json()
      if (data.success) {
        alert(`${data.generatedCount}件のアラートを生成しました`)
        fetchNotifications()
      } else {
        alert('アラートの生成に失敗しました')
      }
    } catch (err) {
      console.error('Failed to generate alerts:', err)
      alert('アラートの生成に失敗しました')
    }
  }

  const handleMarkAsRead = async (id: number) => {
    try {
      const response = await fetch(`/api/notifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isRead: true }),
      })

      const data = await response.json()
      if (data.success) {
        fetchNotifications()
      }
    } catch (err) {
      console.error('Failed to mark as read:', err)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('この通知を削除しますか？')) return

    try {
      const response = await fetch(`/api/notifications/${id}`, {
        method: 'DELETE',
      })

      const data = await response.json()
      if (data.success) {
        fetchNotifications()
      }
    } catch (err) {
      console.error('Failed to delete notification:', err)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (status === 'loading' || loading) {
    return <div className="p-8 text-center text-gray-900">読み込み中...</div>
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length

  return (
    <div className="p-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-gray-900">通知管理</h1>
        <div className="flex justify-end mb-6">
          <button
            onClick={handleGenerateAlerts}
            className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 font-medium"
          >
            アラート生成
          </button>
        </div>

        {/* フィルター */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                従業員
              </label>
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
              >
                <option value="">全て</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id.toString()}>
                    {emp.name} ({emp.employeeNumber})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                フィルター
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setFilter('all')}
                  className={`px-4 py-2 rounded font-medium ${
                    filter === 'all'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  全て
                </button>
                <button
                  onClick={() => setFilter('unread')}
                  className={`px-4 py-2 rounded font-medium ${
                    filter === 'unread'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  未読 ({unreadCount})
                </button>
                <button
                  onClick={() => setFilter('read')}
                  className={`px-4 py-2 rounded font-medium ${
                    filter === 'read'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  既読
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 通知一覧 */}
        {notifications.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-6 text-center text-gray-700">
            通知がありません
          </div>
        ) : (
          <div className="space-y-4">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`bg-white rounded-lg shadow-md p-6 ${
                  !notification.isRead ? 'border-l-4 border-blue-500' : ''
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        NOTIFICATION_TYPES[notification.type]?.color ||
                        'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {NOTIFICATION_TYPES[notification.type]?.label ||
                        notification.type}
                    </span>
                    {!notification.isRead && (
                      <span className="px-2 py-1 bg-blue-500 text-white rounded text-xs font-medium">
                        未読
                      </span>
                    )}
                    <span className="text-sm text-gray-600">
                      {notification.employee.name} ({notification.employee.employeeNumber})
                    </span>
                  </div>
                  <button
                    onClick={() => handleDelete(notification.id)}
                    className="text-gray-400 hover:text-red-500"
                  >
                    ✕
                  </button>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {notification.title}
                </h3>
                <p className="text-gray-700 mb-3">{notification.message}</p>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">
                    {formatDate(notification.createdAt)}
                  </span>
                  {!notification.isRead && (
                    <button
                      onClick={() => handleMarkAsRead(notification.id)}
                      className="px-3 py-1 bg-gray-200 text-gray-900 rounded text-sm hover:bg-gray-300 font-medium"
                    >
                      既読にする
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

