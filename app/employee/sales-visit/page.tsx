'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface SalesVisit {
  id: number
  companyName: string
  purpose: string
  entryTime: string | Date | null
  exitTime: string | Date | null
  entryLocation?: any
  exitLocation?: any
  meetingNotes: string | null
}

export default function SalesVisitPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [visits, setVisits] = useState<SalesVisit[]>([])
  const [currentTime, setCurrentTime] = useState(new Date())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  
  // 入店フォームの状態
  const [showEntryForm, setShowEntryForm] = useState(false)
  const [companyName, setCompanyName] = useState('')
  const [purpose, setPurpose] = useState('商談')
  
  // 退店フォームの状態
  const [showExitForm, setShowExitForm] = useState<number | null>(null)
  const [meetingNotes, setMeetingNotes] = useState<{ [key: number]: string }>({})

  useEffect(() => {
    if (status === 'authenticated') {
      fetchTodayVisits()
    }

    // 現在時刻を1秒ごとに更新
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [status])

  const fetchTodayVisits = async () => {
    try {
      const response = await fetch('/api/sales-visit/today')
      const data = await response.json()
      if (data.success) {
        setVisits(data.visits)
      }
    } catch (err) {
      console.error('Failed to fetch visits:', err)
    }
  }

  const getCurrentTimeString = () => {
    return currentTime.toTimeString().slice(0, 5)
  }

  const getCurrentDateString = () => {
    return currentTime.toISOString().split('T')[0]
  }

  const handleEntry = async () => {
    if (loading) return
    
    if (!companyName.trim()) {
      setError('会社名を入力してください')
      return
    }

    setLoading(true)
    setError(null)
    setWarning(null)

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

      // 入店を実行
      const response = await fetch('/api/sales-visit/entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          time: getCurrentTimeString(),
          date: getCurrentDateString(),
          companyName: companyName.trim(),
          purpose,
          location,
        }),
      })

      const data = await response.json()
      if (data.success) {
        await fetchTodayVisits()
        setShowEntryForm(false)
        setCompanyName('')
        setPurpose('商談')
      } else {
        setError(data.error || '入店の記録に失敗しました')
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

  const handleExit = async (visitId: number) => {
    if (loading) return
    setLoading(true)
    setError(null)
    setWarning(null)

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

      const notes = meetingNotes[visitId] || ''

      // 退店を実行
      const response = await fetch('/api/sales-visit/exit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          time: getCurrentTimeString(),
          date: getCurrentDateString(),
          visitId,
          meetingNotes: notes.trim() || null,
          location,
        }),
      })

      const data = await response.json()
      if (data.success) {
        await fetchTodayVisits()
        setShowExitForm(null)
        setMeetingNotes({ ...meetingNotes, [visitId]: '' })
      } else {
        setError(data.error || '退店の記録に失敗しました')
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

  const formatTime = (time: string | Date | null) => {
    if (!time) return '未記録'
    
    // 文字列の場合（APIから返される形式: "HH:MM:SS"）
    if (typeof time === 'string') {
      // HH:MM:SS形式またはHH:mm形式の場合（時刻のみの文字列）
      if (time.includes(':')) {
        return time.slice(0, 5) // HH:mmのみ返す
      }
      // ISO形式の日時文字列の場合
      if (time.includes('T') || time.includes(' ')) {
        const date = new Date(time)
        if (!isNaN(date.getTime())) {
          const hours = date.getHours().toString().padStart(2, '0')
          const minutes = date.getMinutes().toString().padStart(2, '0')
          return `${hours}:${minutes}`
        }
      }
    }
    
    // Date型の場合は時刻部分を抽出
    if (time instanceof Date) {
      const hours = time.getHours().toString().padStart(2, '0')
      const minutes = time.getMinutes().toString().padStart(2, '0')
      return `${hours}:${minutes}`
    }
    
    return '未記録'
  }

  const getPurposeLabel = (purpose: string) => {
    const labels: { [key: string]: string } = {
      '商談': '商談',
      '見積': '見積',
      'アフターサービス': 'アフターサービス',
      'その他': 'その他',
    }
    return labels[purpose] || purpose
  }

  if (status === 'loading') {
    return <div className="p-8 text-center">読み込み中...</div>
  }

  return (
    <div className="p-4">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-center mb-4 text-gray-900">営業先入退店</h1>
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

        {warning && (
          <div className="mb-4 p-3 bg-yellow-50 text-yellow-800 border border-yellow-300 rounded text-sm">
            ⚠️ {warning}
          </div>
        )}

        {/* 入店ボタン */}
        {!showEntryForm ? (
          <button
            onClick={() => setShowEntryForm(true)}
            disabled={loading}
            className="w-full py-4 px-3 rounded-lg font-semibold bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed mb-6"
          >
            営業先に到着（入店）
          </button>
        ) : (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h2 className="text-lg font-semibold mb-3 text-gray-900">入店情報を入力</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  営業先の会社名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="例: 株式会社サンプル"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  目的 <span className="text-red-500">*</span>
                </label>
                <select
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                >
                  <option value="商談">商談</option>
                  <option value="見積">見積</option>
                  <option value="アフターサービス">アフターサービス</option>
                  <option value="その他">その他</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleEntry}
                  disabled={loading || !companyName.trim()}
                  className="flex-1 py-2 px-4 rounded-lg font-semibold bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  入店を記録
                </button>
                <button
                  onClick={() => {
                    setShowEntryForm(false)
                    setCompanyName('')
                    setPurpose('商談')
                  }}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg font-semibold bg-gray-300 text-gray-700 hover:bg-gray-400 disabled:opacity-50"
                >
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div className="mb-4 text-center text-gray-500">処理中...</div>
        )}

        {/* 今日の訪問履歴 */}
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-3 text-gray-900">今日の訪問履歴</h2>
          {visits.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              まだ訪問記録がありません
            </div>
          ) : (
            <div className="space-y-4">
              {visits.map((visit) => (
                <div
                  key={visit.id}
                  className="p-4 border border-gray-200 rounded-lg bg-gray-50"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-semibold text-lg text-gray-900">
                        {visit.companyName}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        目的: {getPurposeLabel(visit.purpose)}
                      </div>
                    </div>
                    {visit.exitTime ? (
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-semibold">
                        退店済み
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-semibold">
                        訪問中
                      </span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                    <div>
                      <span className="text-gray-600">入店時刻:</span>
                      <span className="ml-2 font-semibold text-gray-900">
                        {formatTime(visit.entryTime)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">退店時刻:</span>
                      <span className="ml-2 font-semibold text-gray-900">
                        {formatTime(visit.exitTime)}
                      </span>
                    </div>
                  </div>

                  {visit.meetingNotes && (
                    <div className="mt-3 p-2 bg-white rounded border border-gray-200">
                      <div className="text-xs text-gray-600 mb-1">商談内容:</div>
                      <div className="text-sm text-gray-900 whitespace-pre-wrap">
                        {visit.meetingNotes}
                      </div>
                    </div>
                  )}

                  {!visit.exitTime && (
                    <div className="mt-3">
                      {showExitForm === visit.id ? (
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700">
                            商談内容メモ（最大1000文字）
                          </label>
                          <textarea
                            value={meetingNotes[visit.id] || ''}
                            onChange={(e) => {
                              const value = e.target.value
                              if (value.length <= 1000) {
                                setMeetingNotes({ ...meetingNotes, [visit.id]: value })
                              }
                            }}
                            placeholder="商談内容を記録してください（任意）"
                            rows={4}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            disabled={loading}
                          />
                          <div className="text-xs text-gray-500 text-right">
                            {(meetingNotes[visit.id] || '').length} / 1000文字
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleExit(visit.id)}
                              disabled={loading}
                              className="flex-1 py-2 px-4 rounded-lg font-semibold bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              退店を記録
                            </button>
                            <button
                              onClick={() => {
                                setShowExitForm(null)
                                setMeetingNotes({ ...meetingNotes, [visit.id]: '' })
                              }}
                              disabled={loading}
                              className="px-4 py-2 rounded-lg font-semibold bg-gray-300 text-gray-700 hover:bg-gray-400 disabled:opacity-50"
                            >
                              キャンセル
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowExitForm(visit.id)}
                          disabled={loading}
                          className="w-full py-2 px-4 rounded-lg font-semibold bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          退店を記録
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
