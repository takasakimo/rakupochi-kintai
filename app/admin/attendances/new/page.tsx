'use client'

import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'

interface Employee {
  id: number
  name: string
  employeeNumber: string
}

export default function NewAttendancePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    employeeId: '',
    date: new Date().toISOString().split('T')[0],
    type: 'clock_in',
    time: '',
    location: {
      latitude: '',
      longitude: '',
      locationName: '',
    },
  })

  useEffect(() => {
    if (status === 'authenticated' && session?.user.role === 'admin') {
      fetchEmployees()
    } else if (status === 'unauthenticated') {
      router.push('/auth/signin')
    }
  }, [status, session, router])

  useEffect(() => {
    // クエリパラメータから初期値を設定
    const employeeId = searchParams?.get('employeeId')
    const date = searchParams?.get('date')
    const type = searchParams?.get('type')
    
    if (employeeId || date || type) {
      setFormData(prev => ({
        ...prev,
        employeeId: employeeId || prev.employeeId,
        date: date || prev.date,
        type: (type as 'wake_up' | 'departure' | 'clock_in' | 'clock_out') || prev.type,
      }))
    }
  }, [searchParams])

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/admin/employees')
      if (!response.ok) {
        alert('従業員データの取得に失敗しました')
        router.push('/admin/attendances')
        return
      }
      const data = await response.json()
      if (data.employees && Array.isArray(data.employees)) {
        setEmployees(data.employees)
      }
    } catch (err) {
      alert('従業員データの取得に失敗しました')
      router.push('/admin/attendances')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.employeeId || !formData.date || !formData.time) {
      alert('従業員、日付、時刻を入力してください')
      return
    }

    setSaving(true)
    try {
      const payload: any = {
        employeeId: formData.employeeId,
        date: formData.date,
        type: formData.type,
        time: formData.time,
      }

      // 出勤・退勤の場合は位置情報も送信（オプション）
      if (
        (formData.type === 'clock_in' || formData.type === 'clock_out') &&
        (formData.location.latitude || formData.location.locationName)
      ) {
        payload.location = {
          latitude: formData.location.latitude
            ? parseFloat(formData.location.latitude)
            : null,
          longitude: formData.location.longitude
            ? parseFloat(formData.location.longitude)
            : null,
          locationName: formData.location.locationName || null,
        }
      }

      const response = await fetch('/api/admin/attendance/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      if (data.success) {
        alert('打刻を登録しました')
        router.push('/admin/attendances')
      } else {
        alert(data.error || '打刻の登録に失敗しました')
      }
    } catch (err) {
      alert('打刻の登録に失敗しました')
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
        <div className="mb-6">
          <button
            onClick={() => router.push('/admin/attendances')}
            className="text-blue-600 hover:text-blue-800 mb-4 flex items-center gap-2"
          >
            ← 打刻管理に戻る
          </button>
          <h1 className="text-2xl font-bold text-gray-900">打刻を登録</h1>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border-2 border-blue-500">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">従業員 *</label>
                <select
                  value={formData.employeeId}
                  onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                  required
                  disabled={employees.length === 0}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white disabled:bg-gray-100"
                >
                  <option value="">{employees.length > 0 ? '選択してください' : '従業員データを読み込み中...'}</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id.toString()}>
                      {emp.name} ({emp.employeeNumber})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">日付 *</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">打刻タイプ *</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                >
                  <option value="wake_up">起床</option>
                  <option value="departure">出発</option>
                  <option value="clock_in">出勤</option>
                  <option value="clock_out">退勤</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">時刻 *</label>
                <input
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                />
              </div>
            </div>

            {/* 位置情報（出勤・退勤の場合のみ） */}
            {(formData.type === 'clock_in' || formData.type === 'clock_out') && (
              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">位置情報（任意）</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">緯度</label>
                    <input
                      type="number"
                      step="any"
                      value={formData.location.latitude}
                      onChange={(e) => setFormData({ ...formData, location: { ...formData.location, latitude: e.target.value } })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">経度</label>
                    <input
                      type="number"
                      step="any"
                      value={formData.location.longitude}
                      onChange={(e) => setFormData({ ...formData, location: { ...formData.location, longitude: e.target.value } })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">場所名</label>
                    <input
                      type="text"
                      value={formData.location.locationName}
                      onChange={(e) => setFormData({ ...formData, location: { ...formData.location, locationName: e.target.value } })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 font-medium disabled:opacity-50"
              >
                {saving ? '登録中...' : '登録'}
              </button>
              <button
                type="button"
                onClick={() => router.push('/admin/attendances')}
                className="px-4 py-2 bg-gray-200 text-gray-900 rounded-md hover:bg-gray-300 font-medium"
              >
                キャンセル
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

