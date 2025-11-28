'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface Attendance {
  id: number
  date: string
  wakeUpTime: Date | null
  departureTime: Date | null
  clockIn: Date | null
  clockOut: Date | null
  clockInLocation: any
  clockOutLocation: any
  breakMinutes: number
}

export default function HistoryPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [attendances, setAttendances] = useState<Attendance[]>([])
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7)
  )
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'authenticated') {
      fetchHistory()
    }
  }, [status, selectedMonth])

  const fetchHistory = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/attendance/history?month=${selectedMonth}`)
      const data = await response.json()
      setAttendances(data.attendances || [])
    } catch (err) {
      console.error('Failed to fetch history:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (time: Date | null) => {
    if (!time) return '-'
    const date = new Date(time)
    if (isNaN(date.getTime())) return '-'
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    return `${hours}:${minutes}`
  }

  const formatDate = (date: string) => {
    const d = new Date(date)
    return d.toLocaleDateString('ja-JP', {
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    })
  }

  const calculateWorkTime = (attendance: Attendance) => {
    if (!attendance.clockIn || !attendance.clockOut) return '-'
    
    try {
      const inTime = new Date(attendance.clockIn)
      const outTime = new Date(attendance.clockOut)
      
      if (isNaN(inTime.getTime()) || isNaN(outTime.getTime())) return '-'
      
      const diffMs = outTime.getTime() - inTime.getTime()
      const diffMinutes = Math.floor(diffMs / (1000 * 60)) - (attendance.breakMinutes || 0)
      
      if (diffMinutes < 0) return '-'
      
      const hours = Math.floor(diffMinutes / 60)
      const mins = diffMinutes % 60
      return `${hours}:${mins.toString().padStart(2, '0')}`
    } catch (e) {
      console.error('Error calculating work time:', e)
      return '-'
    }
  }

  const getLocationInfo = (location: any) => {
    if (!location) return null
    if (location.locationName) {
      return `${location.locationName} (${location.distance}m)`
    }
    return '位置情報取得済み'
  }

  if (status === 'loading') {
    return <div className="p-8 text-center text-gray-900">読み込み中...</div>
  }

  return (
    <div className="p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-gray-900">打刻履歴</h1>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <label className="block mb-2 font-semibold text-gray-900">表示月</label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white"
          />
        </div>

        {loading ? (
          <div className="text-center p-8 text-gray-900">読み込み中...</div>
        ) : attendances.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-6 text-center text-gray-700">
            データがありません
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">日付</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">起床</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">出発</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">出勤</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">退勤</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">勤務時間</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {attendances.map((attendance) => (
                    <tr key={attendance.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {formatDate(attendance.date)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {formatTime(attendance.wakeUpTime)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {formatTime(attendance.departureTime)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <div>{formatTime(attendance.clockIn)}</div>
                        {attendance.clockInLocation && (
                          <div className="text-xs text-gray-600">
                            📍 {getLocationInfo(attendance.clockInLocation)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <div>{formatTime(attendance.clockOut)}</div>
                        {attendance.clockOutLocation && (
                          <div className="text-xs text-gray-600">
                            📍 {getLocationInfo(attendance.clockOutLocation)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                        {calculateWorkTime(attendance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

