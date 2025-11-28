'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface Attendance {
  id?: number
  wakeUpTime: string | null
  departureTime: string | null
  clockIn: string | null
  clockOut: string | null
  clockInLocation?: any
  clockOutLocation?: any
}

export default function ClockPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [attendance, setAttendance] = useState<Attendance | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'authenticated') {
      fetchTodayAttendance()
    }

    // 現在時刻を1秒ごとに更新
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [status])

  const fetchTodayAttendance = async () => {
    try {
      const response = await fetch('/api/attendance/today')
      const data = await response.json()
      setAttendance(data.attendance)
    } catch (err) {
      console.error('Failed to fetch attendance:', err)
    }
  }

  const getCurrentTimeString = () => {
    return currentTime.toTimeString().slice(0, 5)
  }

  const getCurrentDateString = () => {
    return currentTime.toISOString().split('T')[0]
  }

  const handleWakeUp = async () => {
    if (loading) return
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/attendance/wake-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          time: getCurrentTimeString(),
          date: getCurrentDateString(),
        }),
      })

      const data = await response.json()
      if (data.success) {
        await fetchTodayAttendance()
      } else {
        setError(data.error || '打刻に失敗しました')
      }
    } catch (err) {
      setError('打刻に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleDeparture = async () => {
    if (loading) return
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/attendance/departure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          time: getCurrentTimeString(),
          date: getCurrentDateString(),
        }),
      })

      const data = await response.json()
      if (data.success) {
        await fetchTodayAttendance()
      } else {
        setError(data.error || '打刻に失敗しました')
      }
    } catch (err) {
      setError('打刻に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleClockIn = async () => {
    if (loading) return
    setLoading(true)
    setError(null)

    try {
      // GPS位置情報を取得
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
          }
        )
      })

      const location = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      }

      const response = await fetch('/api/attendance/clock-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          time: getCurrentTimeString(),
          date: getCurrentDateString(),
          location,
        }),
      })

      const data = await response.json()
      if (data.success) {
        await fetchTodayAttendance()
      } else {
        setError(data.error || '打刻に失敗しました')
      }
    } catch (err: any) {
      if (err.code === 1) {
        setError('位置情報の取得が拒否されました。ブラウザの設定を確認してください。')
      } else {
        setError('位置情報の取得に失敗しました')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleClockOut = async () => {
    if (loading) return
    setLoading(true)
    setError(null)

    try {
      // GPS位置情報を取得
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
          }
        )
      })

      const location = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      }

      const response = await fetch('/api/attendance/clock-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          time: getCurrentTimeString(),
          date: getCurrentDateString(),
          location,
        }),
      })

      const data = await response.json()
      if (data.success) {
        await fetchTodayAttendance()
      } else {
        setError(data.error || '打刻に失敗しました')
      }
    } catch (err: any) {
      if (err.code === 1) {
        setError('位置情報の取得が拒否されました。ブラウザの設定を確認してください。')
      } else {
        setError('位置情報の取得に失敗しました')
      }
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (time: string | null) => {
    if (!time) return '未打刻'
    
    // 文字列の場合（HH:MM:SS または HH:MM）
    if (typeof time === 'string') {
      // HH:MM:SS形式の場合
      if (time.includes(':')) {
        return time.slice(0, 5) // HH:MM のみ返す
      }
      return time
    }
    
    return '未打刻'
  }

  const getLocationInfo = (location: any) => {
    if (!location) return null
    if (location.locationName) {
      return `${location.locationName} (距離: ${location.distance}m)`
    }
    return '位置情報取得済み'
  }

  if (status === 'loading') {
    return <div className="p-8 text-center">読み込み中...</div>
  }

  return (
    <div className="p-4">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-center mb-4 text-gray-900">らくポチ勤怠</h1>
        <div className="text-center mb-6">
          <div className="text-lg font-semibold text-gray-900">
            {currentTime.toLocaleDateString('ja-JP', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              weekday: 'short',
            })}
          </div>
          <div className="text-3xl font-bold mt-2 text-gray-900">
            {currentTime.toLocaleTimeString('ja-JP', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm">
            {error}
          </div>
        )}

        {/* 打刻ボタン（横2つずつ、2列×2行） */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {/* 起床ボタン */}
          <button
            onClick={handleWakeUp}
            disabled={loading || !!attendance?.wakeUpTime}
            className={`py-4 px-3 rounded-lg font-semibold transition ${
              attendance?.wakeUpTime
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed'
            }`}
          >
            <div className="text-2xl mb-1">🌅</div>
            <div className="text-sm font-bold">起床</div>
            {attendance?.wakeUpTime && (
              <div className="text-xs mt-1">✓ {formatTime(attendance.wakeUpTime)}</div>
            )}
          </button>

          {/* 出発ボタン */}
          <button
            onClick={handleDeparture}
            disabled={loading || !!attendance?.departureTime}
            className={`py-4 px-3 rounded-lg font-semibold transition ${
              attendance?.departureTime
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'bg-green-500 text-white hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed'
            }`}
          >
            <div className="text-2xl mb-1">🚗</div>
            <div className="text-sm font-bold">出発</div>
            {attendance?.departureTime && (
              <div className="text-xs mt-1">✓ {formatTime(attendance.departureTime)}</div>
            )}
          </button>

          {/* 出勤ボタン */}
          <button
            onClick={handleClockIn}
            disabled={loading || !!attendance?.clockIn}
            className={`py-4 px-3 rounded-lg font-semibold transition ${
              attendance?.clockIn
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed'
            }`}
          >
            <div className="text-2xl mb-1">🏢</div>
            <div className="text-sm font-bold">出勤</div>
            {attendance?.clockIn ? (
              <div className="text-xs mt-1">✓ {formatTime(attendance.clockIn)}</div>
            ) : (
              <div className="text-xs mt-1">位置情報取得</div>
            )}
          </button>

          {/* 退勤ボタン */}
          <button
            onClick={handleClockOut}
            disabled={loading || !!attendance?.clockOut}
            className={`py-4 px-3 rounded-lg font-semibold transition ${
              attendance?.clockOut
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed'
            }`}
          >
            <div className="text-2xl mb-1">🏠</div>
            <div className="text-sm font-bold">退勤</div>
            {attendance?.clockOut ? (
              <div className="text-xs mt-1">✓ {formatTime(attendance.clockOut)}</div>
            ) : (
              <div className="text-xs mt-1">位置情報取得</div>
            )}
          </button>
        </div>

        {loading && (
          <div className="mb-4 text-center text-gray-500">処理中...</div>
        )}

        {/* 打刻状況の表示 */}
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
            <span className="text-lg text-gray-900">🌅 起床</span>
            <span className="font-semibold">
              {attendance?.wakeUpTime ? (
                <span className="text-green-600">✓ {formatTime(attendance.wakeUpTime)}</span>
              ) : (
                <span className="text-gray-500">未打刻</span>
              )}
            </span>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
            <span className="text-lg text-gray-900">🚗 出発</span>
            <span className="font-semibold">
              {attendance?.departureTime ? (
                <span className="text-green-600">✓ {formatTime(attendance.departureTime)}</span>
              ) : (
                <span className="text-gray-500">未打刻</span>
              )}
            </span>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
            <div>
              <span className="text-lg text-gray-900">🏢 出勤</span>
              {attendance?.clockInLocation && (
                <div className="text-xs text-gray-700 mt-1">
                  📍 {getLocationInfo(attendance.clockInLocation)}
                </div>
              )}
            </div>
            <span className="font-semibold">
              {attendance?.clockIn ? (
                <span className="text-green-600">✓ {formatTime(attendance.clockIn)}</span>
              ) : (
                <span className="text-gray-500">未打刻</span>
              )}
            </span>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
            <div>
              <span className="text-lg text-gray-900">🏠 退勤</span>
              {attendance?.clockOutLocation && (
                <div className="text-xs text-gray-700 mt-1">
                  📍 {getLocationInfo(attendance.clockOutLocation)}
                </div>
              )}
            </div>
            <span className="font-semibold">
              {attendance?.clockOut ? (
                <span className="text-green-600">✓ {formatTime(attendance.clockOut)}</span>
              ) : (
                <span className="text-gray-500">未打刻</span>
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

