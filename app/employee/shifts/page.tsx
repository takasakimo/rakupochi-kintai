'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface Shift {
  id: number
  date: string
  startTime: string
  endTime: string
  breakMinutes: number
  notes: string | null
  status: string
}

export default function EmployeeShiftsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7)
  )

  useEffect(() => {
    if (status === 'authenticated') {
      fetchShifts()
    }
  }, [status, selectedMonth])

  useEffect(() => {
    if (status === 'authenticated') {
      fetchShifts()
    }
  }, [startDate, endDate])

  const fetchShifts = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (startDate) {
        params.append('start_date', startDate)
      }
      if (endDate) {
        params.append('end_date', endDate)
      }
      if (!startDate && !endDate && selectedMonth) {
        // 選択された月の開始日と終了日を計算
        const [year, month] = selectedMonth.split('-').map(Number)
        const start = new Date(year, month - 1, 1)
        const end = new Date(year, month, 0)
        params.append('start_date', start.toISOString().split('T')[0])
        params.append('end_date', end.toISOString().split('T')[0])
      }

      const response = await fetch(`/api/employee/shifts?${params.toString()}`)
      const data = await response.json()
      setShifts(data.shifts || [])
    } catch (err) {
      console.error('Failed to fetch shifts:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (time: string) => {
    return time.slice(0, 5)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    })
  }

  const calculateWorkHours = (startTime: string, endTime: string, breakMinutes: number) => {
    const start = new Date(`2000-01-01T${startTime}`)
    const end = new Date(`2000-01-01T${endTime}`)
    const diffMs = end.getTime() - start.getTime()
    const totalMinutes = Math.floor(diffMs / (1000 * 60)) - breakMinutes
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    return `${hours}時間${minutes}分`
  }

  const getTotalWorkHours = () => {
    let totalMinutes = 0
    shifts.forEach((shift) => {
      const start = new Date(`2000-01-01T${shift.startTime}`)
      const end = new Date(`2000-01-01T${shift.endTime}`)
      const diffMs = end.getTime() - start.getTime()
      const workMinutes = Math.floor(diffMs / (1000 * 60)) - shift.breakMinutes
      totalMinutes += workMinutes
    })
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    return `${hours}時間${minutes}分`
  }

  const resetFilters = () => {
    setStartDate('')
    setEndDate('')
    setSelectedMonth(new Date().toISOString().slice(0, 7))
  }

  if (status === 'loading' || loading) {
    return <div className="p-8 text-center text-gray-900">読み込み中...</div>
  }

  return (
    <div className="p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-gray-900">シフト管理</h1>

        {/* フィルター */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-900">検索条件</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                月を選択
              </label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => {
                  setSelectedMonth(e.target.value)
                  setStartDate('')
                  setEndDate('')
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                開始日
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  setSelectedMonth('')
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                終了日
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value)
                  setSelectedMonth('')
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
              />
            </div>
          </div>
          <div className="mt-4">
            <button
              onClick={resetFilters}
              className="px-4 py-2 bg-gray-200 text-gray-900 rounded-md hover:bg-gray-300 font-medium"
            >
              リセット
            </button>
          </div>
        </div>

        {/* サマリー */}
        {shifts.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4 text-gray-900">今月のサマリー</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="text-sm text-gray-700 mb-1">シフト数</div>
                <div className="text-2xl font-bold text-gray-900">{shifts.length}件</div>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <div className="text-sm text-gray-700 mb-1">総勤務時間</div>
                <div className="text-2xl font-bold text-gray-900">{getTotalWorkHours()}</div>
              </div>
            </div>
          </div>
        )}

        {/* シフト一覧 */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {shifts.length === 0 ? (
            <div className="p-6 text-center text-gray-700">
              シフトデータがありません
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      日付
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      開始時刻
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      終了時刻
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      休憩
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      勤務時間
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      備考
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      ステータス
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {shifts.map((shift) => (
                    <tr key={shift.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {formatDate(shift.date)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {formatTime(shift.startTime)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {formatTime(shift.endTime)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {shift.breakMinutes}分
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                        {calculateWorkHours(shift.startTime, shift.endTime, shift.breakMinutes)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {shift.notes || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            shift.status === 'confirmed'
                              ? 'bg-green-100 text-green-800'
                              : shift.status === 'requested'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {shift.status === 'confirmed'
                            ? '確定'
                            : shift.status === 'requested'
                            ? '申請中'
                            : '交換'}
                        </span>
                      </td>
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

