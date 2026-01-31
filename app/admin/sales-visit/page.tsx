'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface Employee {
  id: number
  name: string
  employeeNumber: string
  department: string | null
}

interface MySalesVisit {
  id: number
  companyName: string
  contactPersonName?: string | null
  purpose: string
  entryTime: string | Date | null
  exitTime: string | Date | null
  entryLocation?: any
  exitLocation?: any
  meetingNotes: string | null
}

interface SalesVisit {
  id: number
  companyName: string
  contactPersonName: string | null
  purpose: string
  entryTime: string | Date | null
  exitTime: string | Date | null
  entryLocation?: any
  exitLocation?: any
  meetingNotes: string | null
  date: string
  employee: {
    id: number
    name: string
    employeeNumber: string
    department: string | null
  }
}

export default function AdminSalesVisitPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [visits, setVisits] = useState<SalesVisit[]>([])
  const [myVisits, setMyVisits] = useState<MySalesVisit[]>([]) // 自分の訪問記録
  const [currentTime, setCurrentTime] = useState(new Date())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  
  // タブの状態
  const [activeTab, setActiveTab] = useState<'my-visits' | 'manage'>('my-visits')
  
  // フィルター
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('')
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
  
  // 自分の入退店フォームの状態
  const [showMyEntryForm, setShowMyEntryForm] = useState(false)
  const [myCompanyName, setMyCompanyName] = useState('')
  const [myContactPersonName, setMyContactPersonName] = useState('')
  const [myPurpose, setMyPurpose] = useState('商談')
  
  // 従業員管理用の入店フォームの状態
  const [showEntryForm, setShowEntryForm] = useState(false)
  const [entryEmployeeId, setEntryEmployeeId] = useState('')
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0])
  const [entryTime, setEntryTime] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [contactPersonName, setContactPersonName] = useState('')
  const [purpose, setPurpose] = useState('商談')
  
  // 退店フォームの状態
  const [showExitForm, setShowExitForm] = useState<number | null>(null)
  const [showMyExitForm, setShowMyExitForm] = useState<number | null>(null)
  const [exitTime, setExitTime] = useState('')
  const [meetingNotes, setMeetingNotes] = useState<{ [key: number]: string }>({})

  useEffect(() => {
    if (status === 'authenticated') {
      const isAdmin = session?.user.role === 'admin'
      const isSuperAdmin = session?.user.role === 'super_admin' || 
                          session?.user.email === 'superadmin@rakupochi.com'
      
      if (isAdmin || (isSuperAdmin && session?.user.selectedCompanyId)) {
        fetchEmployees()
        if (activeTab === 'my-visits') {
          fetchMyTodayVisits()
        } else {
          fetchVisits()
        }
      }
    }

    // 現在時刻を1秒ごとに更新
    const timer = setInterval(() => {
      setCurrentTime(new Date())
      if (!entryTime) {
        setEntryTime(currentTime.toTimeString().slice(0, 5))
      }
      if (!exitTime && showExitForm) {
        setExitTime(currentTime.toTimeString().slice(0, 5))
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [status, session, selectedEmployeeId, startDate, endDate, activeTab])

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/admin/employees')
      const data = await response.json()
      if (data.employees) {
        setEmployees(data.employees.filter((e: Employee) => e.id))
      }
    } catch (err) {
      console.error('Failed to fetch employees:', err)
    }
  }

  const fetchMyTodayVisits = async () => {
    try {
      const response = await fetch('/api/sales-visit/today')
      const data = await response.json()
      if (data.success) {
        setMyVisits(data.visits)
      }
    } catch (err) {
      console.error('Failed to fetch my visits:', err)
    }
  }

  const fetchVisits = async () => {
    try {
      const params = new URLSearchParams()
      if (selectedEmployeeId) {
        params.append('employeeId', selectedEmployeeId)
      }
      if (startDate) {
        params.append('startDate', startDate)
      }
      if (endDate) {
        params.append('endDate', endDate)
      }

      const response = await fetch(`/api/admin/sales-visit?${params.toString()}`)
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

  const handleMyEntry = async () => {
    if (loading) return
    
    if (!myCompanyName.trim()) {
      setError('会社名を入力してください')
      return
    }

    setLoading(true)
    setError(null)
    setWarning(null)

    try {
      // GPS位置情報を取得（オプション：パソコンなどで取得できない場合も許可）
      let location = null
      try {
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

        location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }
      } catch (err: any) {
        // 位置情報の取得に失敗しても続行（パソコンなどで位置情報が取得できない場合）
        console.warn('位置情報の取得に失敗しましたが、続行します:', err)
        if (err.code === 1) {
          setWarning('位置情報の取得が拒否されました。位置情報なしで記録します。')
        } else {
          setWarning('位置情報の取得に失敗しました。位置情報なしで記録します。')
        }
      }

      // 入店を実行
      const response = await fetch('/api/sales-visit/entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          time: getCurrentTimeString(),
          date: getCurrentDateString(),
          companyName: myCompanyName.trim(),
          contactPersonName: myContactPersonName.trim() || null,
          purpose: myPurpose,
          location,
        }),
      })

      const data = await response.json()
      if (data.success) {
        await fetchMyTodayVisits()
        setShowMyEntryForm(false)
        setMyCompanyName('')
        setMyContactPersonName('')
        setMyPurpose('商談')
        setWarning(null) // 成功したら警告をクリア
      } else {
        setError(data.error || '入店の記録に失敗しました')
      }
    } catch (err: any) {
      setError('入店の記録に失敗しました')
      console.error('Entry error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleMyExit = async (visitId: number) => {
    if (loading) return
    setLoading(true)
    setError(null)
    setWarning(null)

    try {
      // GPS位置情報を取得（オプション：パソコンなどで取得できない場合も許可）
      let location = null
      try {
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

        location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }
      } catch (err: any) {
        // 位置情報の取得に失敗しても続行（パソコンなどで位置情報が取得できない場合）
        console.warn('位置情報の取得に失敗しましたが、続行します:', err)
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
        await fetchMyTodayVisits()
        setShowMyExitForm(null)
        setMeetingNotes({ ...meetingNotes, [visitId]: '' })
      } else {
        setError(data.error || '退店の記録に失敗しました')
      }
    } catch (err: any) {
      setError('退店の記録に失敗しました')
      console.error('Exit error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleEntry = async () => {
    if (loading) return
    
    if (!entryEmployeeId) {
      setError('従業員を選択してください')
      return
    }
    
    if (!companyName.trim()) {
      setError('会社名を入力してください')
      return
    }

    if (!entryTime) {
      setError('時刻を入力してください')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // 位置情報を取得（オプション）
      let location = null
      try {
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

        location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }
      } catch (err) {
        // 位置情報の取得に失敗しても続行
        console.warn('Location not available:', err)
      }

      // 入店を実行
      const response = await fetch('/api/admin/sales-visit/entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: entryEmployeeId,
          time: entryTime,
          date: entryDate,
          companyName: companyName.trim(),
          contactPersonName: contactPersonName.trim() || null,
          purpose,
          location,
        }),
      })

      const data = await response.json()
      if (data.success) {
        await fetchVisits()
        setShowEntryForm(false)
        setEntryEmployeeId('')
        setCompanyName('')
        setPurpose('商談')
        setEntryTime('')
        setEntryDate(new Date().toISOString().split('T')[0])
      } else {
        setError(data.error || '入店の記録に失敗しました')
      }
    } catch (err: any) {
      setError('入店の記録に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (visitId: number) => {
    if (!confirm('この訪問記録を削除しますか？この操作は取り消せません。')) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/admin/sales-visit/${visitId}`, {
        method: 'DELETE',
      })

      const data = await response.json()
      if (data.success) {
        await fetchVisits()
      } else {
        setError(data.error || '削除に失敗しました')
      }
    } catch (err: any) {
      setError('削除に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleExit = async (visitId: number) => {
    if (loading) return
    
    if (!exitTime) {
      setError('時刻を入力してください')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // 位置情報を取得（オプション）
      let location = null
      try {
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

        location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }
      } catch (err) {
        // 位置情報の取得に失敗しても続行
        console.warn('Location not available:', err)
      }

      const notes = meetingNotes[visitId] || ''
      const visit = visits.find(v => v.id === visitId)
      const exitDate = visit ? visit.date : new Date().toISOString().split('T')[0]

      // 退店を実行
      const response = await fetch('/api/admin/sales-visit/exit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          time: exitTime,
          date: exitDate,
          visitId,
          meetingNotes: notes.trim() || null,
          location,
        }),
      })

      const data = await response.json()
      if (data.success) {
        await fetchVisits()
        setShowExitForm(null)
        setExitTime('')
        setMeetingNotes({ ...meetingNotes, [visitId]: '' })
      } else {
        setError(data.error || '退店の記録に失敗しました')
      }
    } catch (err: any) {
      setError('退店の記録に失敗しました')
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

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    })
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
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-gray-900">営業先入退店管理</h1>

        {/* タブ */}
        <div className="mb-6">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => {
                setActiveTab('my-visits')
                fetchMyTodayVisits()
              }}
              className={`px-6 py-3 font-medium text-sm ${
                activeTab === 'my-visits'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              自分の入退店記録
            </button>
            <button
              onClick={() => {
                setActiveTab('manage')
                fetchVisits()
              }}
              className={`px-6 py-3 font-medium text-sm ${
                activeTab === 'manage'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              従業員の入退店記録管理
            </button>
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

        {/* 自分の入退店記録 */}
        {activeTab === 'my-visits' && (
          <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-center mb-4 text-gray-900">営業先入退店</h2>
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

            {/* 入店ボタン */}
            {!showMyEntryForm ? (
              <button
                onClick={() => setShowMyEntryForm(true)}
                disabled={loading}
                className="w-full py-4 px-3 rounded-lg font-semibold bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed mb-6"
              >
                営業先に到着（入店）
              </button>
            ) : (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-lg font-semibold mb-3 text-gray-900">入店情報を入力</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      営業先の会社名 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={myCompanyName}
                      onChange={(e) => setMyCompanyName(e.target.value)}
                      placeholder="例: 株式会社サンプル"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      取引先担当者名
                    </label>
                    <input
                      type="text"
                      value={myContactPersonName}
                      onChange={(e) => setMyContactPersonName(e.target.value)}
                      placeholder="例: 山田太郎"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      目的 <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={myPurpose}
                      onChange={(e) => setMyPurpose(e.target.value)}
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
                      onClick={handleMyEntry}
                      disabled={loading || !myCompanyName.trim()}
                      className="flex-1 py-2 px-4 rounded-lg font-semibold bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      入店を記録
                    </button>
                    <button
                      onClick={() => {
                        setShowMyEntryForm(false)
                        setMyCompanyName('')
                        setMyContactPersonName('')
                        setMyPurpose('商談')
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
              <h3 className="text-lg font-semibold mb-3 text-gray-900">今日の訪問履歴</h3>
              {myVisits.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  まだ訪問記録がありません
                </div>
              ) : (
                <div className="space-y-4">
                  {myVisits.map((visit) => (
                    <div
                      key={visit.id}
                      className="p-4 border border-gray-200 rounded-lg bg-gray-50"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="font-semibold text-lg text-gray-900">
                            {visit.companyName}
                          </div>
                          {visit.contactPersonName && (
                            <div className="text-sm text-gray-600 mt-1">
                              担当者: {visit.contactPersonName}
                            </div>
                          )}
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
                          {showMyExitForm === visit.id ? (
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
                                  onClick={() => handleMyExit(visit.id)}
                                  disabled={loading}
                                  className="flex-1 py-2 px-4 rounded-lg font-semibold bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  退店を記録
                                </button>
                                <button
                                  onClick={() => {
                                    setShowMyExitForm(null)
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
                              onClick={() => setShowMyExitForm(visit.id)}
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
        )}

        {/* 従業員の入退店記録管理 */}
        {activeTab === 'manage' && (
          <>

        {/* フィルター */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                従業員
              </label>
              <select
                value={selectedEmployeeId}
                onChange={(e) => {
                  setSelectedEmployeeId(e.target.value)
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">すべて</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id.toString()}>
                    {emp.name} ({emp.employeeNumber})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                開始日
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                終了日
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={fetchVisits}
                className="w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                検索
              </button>
            </div>
          </div>
        </div>

        {/* 入店ボタン */}
        {!showEntryForm ? (
          <button
            onClick={() => {
              setShowEntryForm(true)
              setEntryTime(currentTime.toTimeString().slice(0, 5))
            }}
            disabled={loading}
            className="mb-6 px-6 py-3 rounded-lg font-semibold bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            営業先入店を記録
          </button>
        ) : (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h2 className="text-lg font-semibold mb-3 text-gray-900">入店情報を入力</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  従業員 <span className="text-red-500">*</span>
                </label>
                <select
                  value={entryEmployeeId}
                  onChange={(e) => setEntryEmployeeId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                >
                  <option value="">選択してください</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id.toString()}>
                      {emp.name} ({emp.employeeNumber})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  日付 <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  時刻 <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  value={entryTime}
                  onChange={(e) => setEntryTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>
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
                  取引先担当者名
                </label>
                <input
                  type="text"
                  value={contactPersonName}
                  onChange={(e) => setContactPersonName(e.target.value)}
                  placeholder="例: 山田太郎"
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
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleEntry}
                disabled={loading || !entryEmployeeId || !companyName.trim() || !entryTime}
                className="px-6 py-2 rounded-lg font-semibold bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                入店を記録
              </button>
              <button
                onClick={() => {
                  setShowEntryForm(false)
                  setEntryEmployeeId('')
                  setCompanyName('')
                  setContactPersonName('')
                  setPurpose('商談')
                  setEntryTime('')
                  setEntryDate(new Date().toISOString().split('T')[0])
                }}
                disabled={loading}
                className="px-6 py-2 rounded-lg font-semibold bg-gray-300 text-gray-700 hover:bg-gray-400 disabled:opacity-50"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}

        {loading && (
          <div className="mb-4 text-center text-gray-500">処理中...</div>
        )}

        {/* 訪問履歴 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-900">訪問履歴</h2>
          {visits.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              訪問記録がありません
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
                      {visit.contactPersonName && (
                        <div className="text-sm text-gray-600 mt-1">
                          担当者: {visit.contactPersonName}
                        </div>
                      )}
                      <div className="text-sm text-gray-600 mt-1">
                        {visit.employee.name} ({visit.employee.employeeNumber})
                        {visit.employee.department && ` - ${visit.employee.department}`}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        {formatDate(visit.date)} - 目的: {getPurposeLabel(visit.purpose)}
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

                  <div className="mt-3 flex gap-2">
                    {!visit.exitTime && (
                      <>
                        {showExitForm === visit.id ? (
                          <div className="space-y-2 flex-1">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-sm font-medium text-gray-700">
                                  退店時刻 <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="time"
                                  value={exitTime}
                                  onChange={(e) => setExitTime(e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  disabled={loading}
                                />
                              </div>
                            </div>
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
                                disabled={loading || !exitTime}
                                className="px-6 py-2 rounded-lg font-semibold bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                退店を記録
                              </button>
                              <button
                                onClick={() => {
                                  setShowExitForm(null)
                                  setExitTime('')
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
                            onClick={() => {
                              setShowExitForm(visit.id)
                              setExitTime(currentTime.toTimeString().slice(0, 5))
                            }}
                            disabled={loading}
                            className="px-6 py-2 rounded-lg font-semibold bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            退店を記録
                          </button>
                        )}
                      </>
                    )}
                    <button
                      onClick={() => handleDelete(visit.id)}
                      disabled={loading}
                      className="px-4 py-2 rounded-lg font-semibold bg-gray-500 text-white hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      削除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
          </>
        )}
      </div>
    </div>
  )
}
