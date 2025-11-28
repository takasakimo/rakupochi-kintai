'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface DashboardData {
  todayAttendanceCount: number
  missingAttendanceCount: number
  pendingApplicationsCount: number
  overtimeAlertsCount: number
}

export default function AdminDashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'authenticated' && session?.user.role === 'admin') {
      fetchDashboardData()
    }
  }, [status, session])

  const fetchDashboardData = async () => {
    try {
      const response = await fetch('/api/admin/dashboard')
      if (!response.ok) {
        console.error('Dashboard API error:', response.status, response.statusText)
        const errorData = await response.json().catch(() => ({}))
        console.error('Error data:', errorData)
        // エラー時もデフォルト値を設定
        setData({
          todayAttendanceCount: 0,
          missingAttendanceCount: 0,
          pendingApplicationsCount: 0,
          overtimeAlertsCount: 0,
        })
        return
      }
      const data = await response.json()
      console.log('Dashboard data received:', data)
      // データが正しく返されているか確認
      if (data && typeof data.pendingApplicationsCount === 'number') {
        setData(data)
      } else {
        console.error('Invalid dashboard data structure:', data)
        setData({
          todayAttendanceCount: data?.todayAttendanceCount || 0,
          missingAttendanceCount: data?.missingAttendanceCount || 0,
          pendingApplicationsCount: data?.pendingApplicationsCount || 0,
          overtimeAlertsCount: data?.overtimeAlertsCount || 0,
        })
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err)
      // エラー時もデフォルト値を設定
      setData({
        todayAttendanceCount: 0,
        missingAttendanceCount: 0,
        pendingApplicationsCount: 0,
        overtimeAlertsCount: 0,
      })
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading' || loading) {
    return <div className="p-8 text-center text-gray-900">読み込み中...</div>
  }

  return (
    <div className="p-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-gray-900">管理者ダッシュボード</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Link
            href="/admin/attendances"
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition cursor-pointer"
          >
            <div className="text-sm text-gray-700 mb-2 font-medium">本日の出勤者</div>
            <div className="text-3xl font-bold text-gray-900">{data?.todayAttendanceCount || 0}名</div>
            <div className="text-xs text-gray-500 mt-2">クリックして詳細を見る →</div>
          </Link>
          <Link
            href="/admin/attendances"
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition cursor-pointer"
          >
            <div className="text-sm text-gray-700 mb-2 font-medium">未打刻者</div>
            <div className="text-3xl font-bold text-red-600">
              {data?.missingAttendanceCount || 0}名
            </div>
            <div className="text-xs text-gray-500 mt-2">クリックして詳細を見る →</div>
          </Link>
          <Link
            href="/admin/applications?status=pending"
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition cursor-pointer"
          >
            <div className="text-sm text-gray-700 mb-2 font-medium">承認待ち申請</div>
            <div className="text-3xl font-bold text-amber-600">
              {data?.pendingApplicationsCount !== undefined ? data.pendingApplicationsCount : (loading ? '...' : 0)}件
            </div>
            <div className="text-xs text-gray-500 mt-2">クリックして詳細を見る →</div>
          </Link>
          <Link
            href="/admin/notifications"
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition cursor-pointer"
          >
            <div className="text-sm text-gray-700 mb-2 font-medium">残業アラート</div>
            <div className="text-3xl font-bold text-orange-600">
              {data?.overtimeAlertsCount || 0}件
            </div>
            <div className="text-xs text-gray-500 mt-2">クリックして詳細を見る →</div>
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">管理メニュー</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link
              href="/employee/clock"
              className="p-4 bg-green-50 hover:bg-green-100 rounded-lg transition text-gray-900 font-medium border-2 border-green-300"
            >
              📍 打刻
            </Link>
            <Link
              href="/admin/employees"
              className="p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition text-gray-900 font-medium"
            >
              👥 従業員管理
            </Link>
            <Link
              href="/admin/attendances"
              className="p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition text-gray-900 font-medium"
            >
              📍 打刻管理
            </Link>
            <Link
              href="/admin/applications"
              className="p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition text-gray-900 font-medium"
            >
              📝 申請管理
            </Link>
            <Link
              href="/admin/shifts/register"
              className="p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition text-gray-900 font-medium"
            >
              📝 シフト登録
            </Link>
            <Link
              href="/admin/shifts/manage"
              className="p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition text-gray-900 font-medium"
            >
              🗓️ シフト管理
            </Link>
            <Link
              href="/admin/reports"
              className="p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition text-gray-900 font-medium"
            >
              📊 レポート
            </Link>
            <Link
              href="/admin/settings"
              className="p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition text-gray-900 font-medium"
            >
              ⚙️ 設定
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

