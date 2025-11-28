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

export default function MyPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [summary, setSummary] = useState<AttendanceSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'authenticated') {
      fetchSummary()
    }
  }, [status])

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

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}時間${mins}分`
  }

  if (status === 'loading' || loading) {
    return <div className="p-8 text-center text-gray-900">読み込み中...</div>
  }

  return (
    <div className="p-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-gray-900">マイページ</h1>

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

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">メニュー</h2>
          <div className="space-y-2">
            <Link
              href="/employee/clock"
              className="block p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition text-gray-900 font-medium"
            >
              📍 打刻
            </Link>
            <Link
              href="/employee/history"
              className="block p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition text-gray-900 font-medium"
            >
              📅 打刻履歴
            </Link>
            <Link
              href="/employee/applications"
              className="block p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition text-gray-900 font-medium"
            >
              📝 申請一覧
            </Link>
            <Link
              href="/employee/shifts"
              className="block p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition text-gray-900 font-medium"
            >
              🗓️ シフト管理
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

