'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface DashboardData {
  todayAttendanceCount: number
  pendingApplicationsCount: number
  overtimeAlertsCount: number
}

interface Announcement {
  id: number
  title: string
  content: string
  attachments: any
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export default function AdminDashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'authenticated' && session?.user.role === 'admin') {
      fetchDashboardData()
      fetchAnnouncements()
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
          pendingApplicationsCount: data?.pendingApplicationsCount || 0,
          overtimeAlertsCount: data?.overtimeAlertsCount || 0,
        })
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err)
      // エラー時もデフォルト値を設定
      setData({
        todayAttendanceCount: 0,
        pendingApplicationsCount: 0,
        overtimeAlertsCount: 0,
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchAnnouncements = async () => {
    try {
      const response = await fetch('/api/admin/announcements')
      if (!response.ok) {
        console.error('Failed to fetch announcements:', response.status)
        setAnnouncements([])
        return
      }
      const data = await response.json()
      if (data.announcements && Array.isArray(data.announcements)) {
        // 公開中のお知らせのみ、最新5件を表示
        const activeAnnouncements = data.announcements
          .filter((a: Announcement) => a.isActive)
          .slice(0, 5)
        setAnnouncements(activeAnnouncements)
      } else {
        setAnnouncements([])
      }
    } catch (err) {
      console.error('Failed to fetch announcements:', err)
      setAnnouncements([])
    }
  }

  if (status === 'loading' || loading) {
    return <div className="p-8 text-center text-gray-900">読み込み中...</div>
  }

  return (
    <div className="p-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-gray-900">管理者ダッシュボード</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <Link
            href="/admin/attendances"
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition cursor-pointer"
          >
            <div className="text-sm text-gray-700 mb-2 font-medium">本日の出勤者</div>
            <div className="text-3xl font-bold text-gray-900">{data?.todayAttendanceCount || 0}名</div>
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

        {/* お知らせ一覧 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">お知らせ</h2>
            <Link
              href="/admin/announcements"
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              すべて見る →
            </Link>
          </div>
          {announcements.length === 0 ? (
            <p className="text-gray-500 text-center py-4">お知らせはありません</p>
          ) : (
            <div className="space-y-4">
              {announcements.map((announcement) => {
                // 画像添付ファイルを取得
                const imageAttachments = announcement.attachments &&
                  Array.isArray(announcement.attachments)
                  ? announcement.attachments.filter((att: any) => 
                      att.type && att.type.startsWith('image/')
                    )
                  : []
                const firstImage = imageAttachments.length > 0 ? imageAttachments[0] : null
                const otherAttachmentsCount = announcement.attachments &&
                  Array.isArray(announcement.attachments)
                  ? announcement.attachments.length - imageAttachments.length
                  : 0

                return (
                  <div
                    key={announcement.id}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition"
                  >
                    <div className="flex gap-4">
                      {firstImage && (
                        <div className="flex-shrink-0">
                          <img
                            src={firstImage.data}
                            alt={firstImage.name || '添付画像'}
                            className="w-24 h-24 object-cover rounded border border-gray-300"
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 mb-2">{announcement.title}</h3>
                        <p className="text-sm text-gray-700 mb-2 line-clamp-2">
                          {announcement.content}
                        </p>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-500">
                            {new Date(announcement.createdAt).toLocaleDateString('ja-JP')}
                          </span>
                          {announcement.attachments &&
                            Array.isArray(announcement.attachments) &&
                            announcement.attachments.length > 0 && (
                                <span className="text-xs text-blue-600">
                                {imageAttachments.length > 0 && (
                                  <span className="mr-2">
                                    {imageAttachments.length}個の画像
                                  </span>
                                )}
                                {otherAttachmentsCount > 0 && (
                                  <span>{otherAttachmentsCount}個のファイル</span>
                                )}
                                {imageAttachments.length === 0 && otherAttachmentsCount === 0 && (
                                  <span>{announcement.attachments.length}個の添付ファイル</span>
                                )}
                              </span>
                            )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

