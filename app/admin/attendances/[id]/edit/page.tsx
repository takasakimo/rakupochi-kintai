'use client'

import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import { useState, useEffect } from 'react'

interface Attendance {
  id: number
  date: string
  wakeUpTime: string | null | Date
  departureTime: string | null | Date
  clockIn: string | null | Date
  clockOut: string | null | Date
  clockInLocation: any
  clockOutLocation: any
  breakMinutes: number
  notes: string | null
  employee: {
    id: number
    name: string
    employeeNumber: string
    department: string | null
  }
}

export default function EditAttendancePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const attendanceId = params?.id as string
  const [viewMode, setViewMode] = useState<'shifts' | 'attendances'>('shifts')

  const [attendance, setAttendance] = useState<Attendance | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editFormData, setEditFormData] = useState({
    wakeUpTime: '',
    departureTime: '',
    clockIn: '',
    clockOut: '',
    clockInLocation: {
      latitude: '',
      longitude: '',
      locationName: '',
    },
    clockOutLocation: {
      latitude: '',
      longitude: '',
      locationName: '',
    },
    breakMinutes: 0,
    notes: '',
  })

  useEffect(() => {
    // URLパラメータからviewModeを取得
    const searchParams = new URLSearchParams(window.location.search)
    const mode = searchParams.get('viewMode')
    if (mode === 'attendances' || mode === 'shifts') {
      setViewMode(mode)
    }

    if (status === 'authenticated' && attendanceId) {
      const isAdmin = session?.user.role === 'admin'
      const isSuperAdmin = session?.user.role === 'super_admin' || 
                          session?.user.email === 'superadmin@rakupochi.com'
      
      if (isAdmin || (isSuperAdmin && session?.user.selectedCompanyId)) {
        fetchAttendance()
      }
    } else if (status === 'unauthenticated') {
      router.push('/auth/signin')
    }
  }, [status, session, attendanceId, router])

  const fetchAttendance = async () => {
    try {
      const response = await fetch(`/api/admin/attendances/${attendanceId}`)
      if (!response.ok) {
        alert('打刻データの取得に失敗しました')
        router.push('/admin/attendances')
        return
      }
      const data = await response.json()
      if (data.attendance) {
        setAttendance(data.attendance)
        
        const formatTime = (time: string | null | Date) => {
          if (!time) return ''
          if (typeof time === 'string') {
            if (time.includes('T')) {
              return time.split('T')[1]?.slice(0, 5) || ''
            }
            return time.slice(0, 5)
          }
          if (time instanceof Date) {
            const hours = String(time.getHours()).padStart(2, '0')
            const minutes = String(time.getMinutes()).padStart(2, '0')
            return `${hours}:${minutes}`
          }
          return ''
        }

        const formatLocation = (location: any) => {
          if (!location) return { latitude: '', longitude: '', locationName: '' }
          if (typeof location === 'object') {
            return {
              latitude: location.latitude?.toString() || '',
              longitude: location.longitude?.toString() || '',
              locationName: location.locationName || location.address || '',
            }
          }
          return { latitude: '', longitude: '', locationName: '' }
        }

        // 備考：JSON（休憩情報等）の場合はoriginalNotesを表示、それ以外はそのまま
        const getEditableNotes = (notes: string | null) => {
          if (!notes) return ''
          try {
            const parsed = JSON.parse(notes)
            if (parsed.originalNotes !== undefined) return parsed.originalNotes || ''
            if (parsed.breakStartTime) return ''
            return notes
          } catch {
            return notes
          }
        }

        setEditFormData({
          wakeUpTime: formatTime(data.attendance.wakeUpTime),
          departureTime: formatTime(data.attendance.departureTime),
          clockIn: formatTime(data.attendance.clockIn),
          clockOut: formatTime(data.attendance.clockOut),
          clockInLocation: formatLocation(data.attendance.clockInLocation),
          clockOutLocation: formatLocation(data.attendance.clockOutLocation),
          breakMinutes: data.attendance.breakMinutes || 0,
          notes: getEditableNotes(data.attendance.notes),
        })
      }
    } catch (err) {
      alert('打刻データの取得に失敗しました')
      router.push('/admin/attendances')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!attendance) return

    setSaving(true)
    try {
      const payload: any = {
        wakeUpTime: editFormData.wakeUpTime || null,
        departureTime: editFormData.departureTime || null,
        clockIn: editFormData.clockIn || null,
        clockOut: editFormData.clockOut || null,
        breakMinutes: editFormData.breakMinutes || 0,
      }

      // 備考：既存がJSON（休憩情報等）の場合はマージ、それ以外は上書き
      if (attendance.notes) {
        try {
          const parsed = JSON.parse(attendance.notes)
          if (parsed.breakStartTime || (parsed.breaks && Array.isArray(parsed.breaks))) {
            payload.notes = JSON.stringify({ ...parsed, originalNotes: editFormData.notes.trim() || null })
          } else {
            payload.notes = editFormData.notes.trim() || null
          }
        } catch {
          payload.notes = editFormData.notes.trim() || null
        }
      } else {
        payload.notes = editFormData.notes.trim() || null
      }

      if (editFormData.clockInLocation.latitude && editFormData.clockInLocation.longitude) {
        payload.clockInLocation = {
          latitude: parseFloat(editFormData.clockInLocation.latitude),
          longitude: parseFloat(editFormData.clockInLocation.longitude),
          locationName: editFormData.clockInLocation.locationName || null,
        }
      } else {
        payload.clockInLocation = null
      }

      if (editFormData.clockOutLocation.latitude && editFormData.clockOutLocation.longitude) {
        payload.clockOutLocation = {
          latitude: parseFloat(editFormData.clockOutLocation.latitude),
          longitude: parseFloat(editFormData.clockOutLocation.longitude),
          locationName: editFormData.clockOutLocation.locationName || null,
        }
      } else {
        payload.clockOutLocation = null
      }

      const response = await fetch(`/api/admin/attendances/${attendanceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      if (data.success) {
        alert('打刻を更新しました')
        // viewModeに応じてリダイレクト先を変更
        const redirectUrl = viewMode === 'attendances' 
          ? '/admin/attendances?viewMode=attendances'
          : '/admin/attendances'
        router.push(redirectUrl)
      } else {
        alert(data.error || '打刻の更新に失敗しました')
      }
    } catch (err) {
      alert('打刻の更新に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  if (status === 'loading' || loading) {
    return <div className="p-8 text-center text-gray-900">読み込み中...</div>
  }

  if (!attendance) {
    return <div className="p-8 text-center text-gray-900">打刻データが見つかりません</div>
  }

  return (
    <div className="p-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <button
            onClick={() => {
              const redirectUrl = viewMode === 'attendances' 
                ? '/admin/attendances?viewMode=attendances'
                : '/admin/attendances'
              router.push(redirectUrl)
            }}
            className="text-blue-600 hover:text-blue-800 mb-4 flex items-center gap-2"
          >
            ← 打刻管理に戻る
          </button>
          <h1 className="text-2xl font-bold text-gray-900">打刻を強制編集</h1>
          <p className="text-gray-600 mt-2">
            {attendance.employee?.name || 'N/A'} ({attendance.date ? new Date(attendance.date).toLocaleDateString('ja-JP') : 'N/A'})
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border-2 border-blue-500">
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">起床時刻</label>
                <input
                  type="time"
                  value={editFormData.wakeUpTime}
                  onChange={(e) => setEditFormData({ ...editFormData, wakeUpTime: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">出発時刻</label>
                <input
                  type="time"
                  value={editFormData.departureTime}
                  onChange={(e) => setEditFormData({ ...editFormData, departureTime: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">出勤時刻</label>
                <input
                  type="time"
                  value={editFormData.clockIn}
                  onChange={(e) => setEditFormData({ ...editFormData, clockIn: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">退勤時刻</label>
                <input
                  type="time"
                  value={editFormData.clockOut}
                  onChange={(e) => setEditFormData({ ...editFormData, clockOut: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">休憩時間（分）</label>
                <input
                  type="number"
                  min="0"
                  value={editFormData.breakMinutes}
                  onChange={(e) => setEditFormData({ ...editFormData, breakMinutes: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">備考（レポートに表示されます）</label>
              <textarea
                value={editFormData.notes}
                onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                rows={3}
                maxLength={500}
                placeholder="備考を入力"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white resize-none"
              />
              <p className="text-xs text-gray-500 mt-1">最大500文字（印刷時は表示幅により省略される場合があります）</p>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">出勤位置情報</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">緯度</label>
                  <input
                    type="number"
                    step="any"
                    value={editFormData.clockInLocation.latitude}
                    onChange={(e) => setEditFormData({ ...editFormData, clockInLocation: { ...editFormData.clockInLocation, latitude: e.target.value } })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">経度</label>
                  <input
                    type="number"
                    step="any"
                    value={editFormData.clockInLocation.longitude}
                    onChange={(e) => setEditFormData({ ...editFormData, clockInLocation: { ...editFormData.clockInLocation, longitude: e.target.value } })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">場所名</label>
                  <input
                    type="text"
                    value={editFormData.clockInLocation.locationName}
                    onChange={(e) => setEditFormData({ ...editFormData, clockInLocation: { ...editFormData.clockInLocation, locationName: e.target.value } })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">退勤位置情報</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">緯度</label>
                  <input
                    type="number"
                    step="any"
                    value={editFormData.clockOutLocation.latitude}
                    onChange={(e) => setEditFormData({ ...editFormData, clockOutLocation: { ...editFormData.clockOutLocation, latitude: e.target.value } })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">経度</label>
                  <input
                    type="number"
                    step="any"
                    value={editFormData.clockOutLocation.longitude}
                    onChange={(e) => setEditFormData({ ...editFormData, clockOutLocation: { ...editFormData.clockOutLocation, longitude: e.target.value } })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">場所名</label>
                  <input
                    type="text"
                    value={editFormData.clockOutLocation.locationName}
                    onChange={(e) => setEditFormData({ ...editFormData, clockOutLocation: { ...editFormData.clockOutLocation, locationName: e.target.value } })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 font-medium disabled:opacity-50"
              >
                {saving ? '保存中...' : '強制更新'}
              </button>
              <button
                type="button"
                onClick={() => {
                  const redirectUrl = viewMode === 'attendances' 
                    ? '/admin/attendances?viewMode=attendances'
                    : '/admin/attendances'
                  router.push(redirectUrl)
                }}
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




