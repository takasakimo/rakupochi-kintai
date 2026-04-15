'use client'

import { useState, useEffect, useRef } from 'react'
import { compressImageToBase64 } from '@/lib/compress-image'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface Property {
  id: number
  name: string
  address: string
  latitude: number
  longitude: number
  lockInfo?: string | null
  hasManager?: boolean | null
  parkingInfo?: string | null
  keyAccessInfo?: string | null
  contactInfo?: string | null
  workRangeNotes?: string | null
  buildingAccessInfo?: string | null
}

interface Assignment {
  id: number
  propertyId: number
  sortOrder: number
  property: Property
}

interface CleaningWorkRecord {
  id: number
  propertyId: number
  workDate: string
  checkInAt: string | null
  checkOutAt: string | null
  checkInPhotoUrl: string | null
  impression?: string | null
  dirtyAreas?: string | null
  handoverNotes?: string | null
  checkOutPhotoUrls?: { exterior?: string | null; garbage?: string[] } | null
  durationMinutes?: number | null
  property?: Property
}

interface MergedItem {
  assignment: Assignment
  workRecord: CleaningWorkRecord | null
}

const WORK_TYPES = ['定期清掃', '追加清掃', '特別清掃', 'その他']

function formatTime(iso: string | null): string {
  if (!iso) return '-'
  const d = new Date(iso)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

export default function EmployeeCleaningCheckPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [workRecords, setWorkRecords] = useState<CleaningWorkRecord[]>([])
  const [currentTime, setCurrentTime] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Modals
  const [checkInModal, setCheckInModal] = useState<Assignment | null>(null)
  const [checkOutModal, setCheckOutModal] = useState<Assignment | null>(null)
  const [routeMapModalOpen, setRouteMapModalOpen] = useState(false)
  const [propertyDetailModal, setPropertyDetailModal] = useState<Property | null>(null)
  const [reportEditModal, setReportEditModal] = useState<{ assignment: Assignment; workRecord: CleaningWorkRecord } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // 履歴タブ用（勤怠の打刻履歴と同様のカレンダー表記）
  const [activeView, setActiveView] = useState<'schedule' | 'history'>('schedule')
  const [historyMonth, setHistoryMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [historySelectedDate, setHistorySelectedDate] = useState<string | null>(null)
  const [historyRecordsAll, setHistoryRecordsAll] = useState<CleaningWorkRecord[]>([])
  const [historyAssignmentsAll, setHistoryAssignmentsAll] = useState<Array<{ assignmentDate: string; property?: { name: string } }>>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyDetailModal, setHistoryDetailModal] = useState<CleaningWorkRecord | null>(null)

  const fetchHistoryRecords = async () => {
    if (!historyMonth) return
    setHistoryLoading(true)
    try {
      const [recordsRes, assignRes] = await Promise.all([
        fetch(`/api/employee/cleaning-work-records?month=${historyMonth}`),
        fetch(`/api/employee/cleaning-assignments?month=${historyMonth}`),
      ])
      const recordsData = await recordsRes.json()
      const assignData = await assignRes.json()
      const recs = recordsData.records || []
      const assigns = assignData.assignments || []
      setHistoryRecordsAll(recs)
      setHistoryAssignmentsAll(assigns)
      const normalizeWorkDate = (r: CleaningWorkRecord) =>
        typeof r.workDate === 'string' ? r.workDate.split('T')[0] : String(r.workDate).split('T')[0]
      const normalizeAssignDate = (a: { assignmentDate: string | Date }) =>
        typeof a.assignmentDate === 'string' ? a.assignmentDate.split('T')[0] : String(a.assignmentDate).split('T')[0]
      const allDates = new Set<string>([
        ...recs.map((r: CleaningWorkRecord) => normalizeWorkDate(r)),
        ...assigns.map((a: { assignmentDate: string | Date }) => normalizeAssignDate(a)),
      ])
      const firstDate = [...allDates].sort()[0] ?? null
      const today = getCurrentDateString()
      const [y, m] = historyMonth.split('-').map(Number)
      const todayInMonth = today.startsWith(`${y}-${String(m).padStart(2, '0')}`)
      const hasToday = todayInMonth && allDates.has(today)
      const selInMonth = historySelectedDate && historySelectedDate.startsWith(`${y}-${String(m).padStart(2, '0')}`) && allDates.has(historySelectedDate)
      if (!selInMonth) {
        setHistorySelectedDate(hasToday ? today : firstDate)
      }
    } catch (err) {
      console.error('Failed to fetch history:', err)
      setHistoryRecordsAll([])
      setHistoryAssignmentsAll([])
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
    }
  }, [status, router])

  // 履歴タブ表示時・表示月変更時にAPI取得
  useEffect(() => {
    if (status === 'authenticated' && activeView === 'history' && historyMonth) {
      fetchHistoryRecords()
    }
  }, [status, activeView, historyMonth])

  useEffect(() => {
    if (status === 'authenticated') {
      fetchData()
    }
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [status])

  const getCurrentTimeString = () => currentTime.toTimeString().slice(0, 5)
  // ローカル日付（0時跨ぎで日付ずれしない。toISOStringはUTCのため日本時間午前中に1日ずれる）
  const getCurrentDateString = () => {
    const y = currentTime.getFullYear()
    const m = String(currentTime.getMonth() + 1).padStart(2, '0')
    const d = String(currentTime.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  const fetchData = async () => {
    try {
      setError(null)
      const date = getCurrentDateString()
      const [assignRes, recordsRes] = await Promise.all([
        fetch(`/api/employee/cleaning-assignments?date=${date}`),
        fetch(`/api/employee/cleaning-work-records?date=${date}`),
      ])
      const assignData = await assignRes.json()
      const recordsData = await recordsRes.json()
      if (!assignRes.ok && assignData?.error) {
        setError(assignData.error)
        setAssignments([])
      } else {
        setAssignments(assignData.assignments || [])
      }
      setWorkRecords(recordsData.records || [])
    } catch (err) {
      console.error('Failed to fetch:', err)
      setError('データの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const todayStr = getCurrentDateString()
  const normalizeWorkDate = (r: CleaningWorkRecord) =>
    typeof r.workDate === 'string' ? r.workDate.split('T')[0] : String(r.workDate).split('T')[0]
  const normalizeAssignDate = (a: { assignmentDate: string | Date }) =>
    typeof a.assignmentDate === 'string' ? a.assignmentDate.split('T')[0] : String(a.assignmentDate).split('T')[0]
  const historyRecords = historySelectedDate
    ? historyRecordsAll.filter((r) => normalizeWorkDate(r) === historySelectedDate)
    : []
  const historyAssignments = historySelectedDate
    ? historyAssignmentsAll.filter((a) => normalizeAssignDate(a) === historySelectedDate)
    : []

  const merged: MergedItem[] = assignments.map((a) => ({
    assignment: a,
    workRecord:
      workRecords.find(
        (r) =>
          r.propertyId === a.propertyId &&
          (typeof r.workDate === 'string'
            ? r.workDate.startsWith(todayStr)
            : r.workDate === todayStr)
      ) || null,
  }))

  const getLocation = (): Promise<{ latitude: number; longitude: number } | null> =>
    new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null)
        return
      }
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      )
    })

  const handleCheckInClick = (a: Assignment) => {
    if (!window.confirm(`${a.property.name}に入場しますか？`)) return
    setCheckInModal(a)
    setError(null)
  }

  const handleCheckInSubmit = async (photoBase64: string | null, handoverConfirmed = false) => {
    if (!checkInModal) return
    setSubmitting(true)
    setError(null)
    try {
      const location = await getLocation()
      const res = await fetch('/api/employee/cleaning-work-records/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: checkInModal.propertyId,
          workDate: getCurrentDateString(),
          time: getCurrentTimeString(),
          date: getCurrentDateString(),
          location,
          photoBase64: photoBase64 || undefined,
          handoverConfirmed,
        }),
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
        return
      }
      setCheckInModal(null)
      await fetchData()
    } catch (err) {
      setError('入場に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCheckOutClick = (a: Assignment) => {
    if (!window.confirm(`${a.property.name}に退場しますか？`)) return
    setCheckOutModal(a)
    setError(null)
  }

  const handleCheckOutSubmit = async (payload: {
    photoExteriorBase64: string | null
    photoGarbageBase64s: string[]
    workType: string
    workTypeOtherComment?: string
    impression?: string
    dirtyAreas?: string
    handoverNotes?: string
  }) => {
    if (!checkOutModal) return
    setSubmitting(true)
    setError(null)
    try {
      const location = await getLocation()
      const res = await fetch('/api/employee/cleaning-work-records/check-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: checkOutModal.propertyId,
          workDate: getCurrentDateString(),
          time: getCurrentTimeString(),
          date: getCurrentDateString(),
          location,
          photoExteriorBase64: payload.photoExteriorBase64 || undefined,
          photoGarbageBase64s:
            payload.photoGarbageBase64s?.filter(Boolean).length > 0
              ? payload.photoGarbageBase64s.filter(Boolean)
              : undefined,
          workType: payload.workType,
          workTypeOtherComment: payload.workTypeOtherComment || undefined,
          impression: payload.impression || undefined,
          dirtyAreas: payload.dirtyAreas || undefined,
          handoverNotes: payload.handoverNotes || undefined,
        }),
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
        return
      }
      setCheckOutModal(null)
      await fetchData()
    } catch (err) {
      setError('退場に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  if (status === 'loading' || loading) {
    return <div className="p-8 text-center">読み込み中...</div>
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">入退場</h1>
      <p className="text-gray-600 mb-2">
        {currentTime.toLocaleDateString('ja-JP', {
          weekday: 'short',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}
        {'　'}
        <span className="font-mono">{getCurrentTimeString()}</span>
      </p>

      {/* タブ: 今日のスケジュール | 履歴 */}
      <div className="flex border-b border-gray-200 mb-4">
        <button
          type="button"
          onClick={() => setActiveView('schedule')}
          className={`px-4 py-2 font-medium text-sm ${
            activeView === 'schedule' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          今日のスケジュール
        </button>
        <button
          type="button"
          onClick={() => setActiveView('history')}
          className={`px-4 py-2 font-medium text-sm ${
            activeView === 'history' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          履歴
        </button>
      </div>

      {activeView === 'history' ? (
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow-md p-4 mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">表示月</label>
            <input
              type="month"
              value={historyMonth}
              onChange={(e) => setHistoryMonth(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white"
            />
          </div>

          {/* カレンダー（勤怠の打刻履歴と同様） */}
          <div className="bg-white rounded-lg shadow-md p-4 mb-4">
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-gray-600 mb-2">
              {['日', '月', '火', '水', '木', '金', '土'].map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {(() => {
                const [y, m] = historyMonth.split('-').map(Number)
                const first = new Date(y, m - 1, 1)
                const last = new Date(y, m, 0)
                const startPad = first.getDay()
                const daysInMonth = last.getDate()
                const cells: (null | { date: string; day: number; hasRecords: boolean; propertyNames: string[] })[] = []
                for (let i = 0; i < startPad; i++) cells.push(null)
                const normalizeAssignDate = (a: { assignmentDate: string | Date }) =>
                  typeof a.assignmentDate === 'string' ? a.assignmentDate.split('T')[0] : String(a.assignmentDate).split('T')[0]
                for (let d = 1; d <= daysInMonth; d++) {
                  const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                  const dayRecords = historyRecordsAll.filter((r) => normalizeWorkDate(r) === dateStr)
                  const dayAssignments = historyAssignmentsAll.filter((a) => normalizeAssignDate(a) === dateStr)
                  const propertyNames = dayRecords.length > 0
                    ? [...new Set(dayRecords.map((r) => r.property?.name ?? '').filter(Boolean))]
                    : [...new Set(dayAssignments.map((a) => a.property?.name ?? '').filter(Boolean))]
                  const hasContent = dayRecords.length > 0 || dayAssignments.length > 0
                  cells.push({ date: dateStr, day: d, hasRecords: hasContent, propertyNames })
                }
                return cells.map((cell, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => cell && setHistorySelectedDate(cell.date)}
                    className={`min-h-[4rem] rounded text-left p-1 flex flex-col ${
                      !cell
                        ? 'bg-transparent'
                        : historySelectedDate === cell.date
                          ? 'bg-blue-600 text-white'
                          : cell.hasRecords
                            ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                            : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <span className="text-sm font-medium shrink-0">{cell?.day ?? ''}</span>
                    {cell?.hasRecords && cell.propertyNames.length > 0 && (
                      <span className="text-xs leading-tight mt-0.5 line-clamp-4 break-words overflow-hidden">
                        {cell.propertyNames.map((name, idx) => (
                          <span key={idx} className="block truncate" title={name}>{name}</span>
                        ))}
                      </span>
                    )}
                  </button>
                ))
              })()}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <h3 className="px-4 py-3 bg-gray-50 text-sm font-semibold text-gray-800">
              {historySelectedDate ? `${historySelectedDate} の記録` : '日付を選択してください'}
            </h3>
            <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">物件</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">入場</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">退場</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">所要時間</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {historyRecords.length > 0 ? (
                    historyRecords.map(r => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">{r.property?.name ?? '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{formatTime(r.checkInAt)}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{formatTime(r.checkOutAt)}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {r.durationMinutes != null ? `${r.durationMinutes}分` : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setHistoryDetailModal(r)}
                            className="text-blue-600 hover:underline text-sm"
                          >
                            詳細
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : historyAssignments.length > 0 ? (
                    historyAssignments.map((a, idx) => (
                      <tr key={`assign-${idx}`} className="hover:bg-gray-50 bg-amber-50/50">
                        <td className="px-4 py-3 text-sm text-gray-900">{a.property?.name ?? '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">-</td>
                        <td className="px-4 py-3 text-sm text-gray-500">-</td>
                        <td className="px-4 py-3 text-sm text-gray-500">-</td>
                        <td className="px-4 py-3 text-sm text-amber-600 font-medium">予定</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-gray-600">
                        この日の記録はありません
                      </td>
                    </tr>
                  )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <>
      {assignments.length > 0 && (
        <button
          type="button"
          onClick={() => setRouteMapModalOpen(true)}
          className="mb-4 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 font-medium text-sm"
        >
          今日の訪問ルート
        </button>
      )}
      <h2 className="text-lg font-semibold mb-4 text-gray-700">今日のスケジュール</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
          {error}
        </div>
      )}

      {assignments.length === 0 ? (
        <p className="text-gray-600">本日のアサインメントはありません。</p>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <ul className="divide-y divide-gray-200">
            {merged.map(({ assignment, workRecord }) => {
              const isComplete = workRecord?.checkOutAt != null
              const canCheckIn = !isComplete && !workRecord?.checkInAt
              const canCheckOut = !isComplete && !!workRecord?.checkInAt

              return (
                <li key={assignment.id} className="px-4 py-3 flex items-center gap-4 hover:bg-gray-50">
                  <span className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-100 text-blue-700 font-medium text-sm">
                    {assignment.sortOrder}
                  </span>
                  <div className="flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => setPropertyDetailModal(assignment.property)}
                      className="text-left font-medium text-blue-600 hover:text-blue-800 hover:underline block cursor-pointer"
                    >
                      {assignment.property.name}
                    </button>
                    <div className="text-sm text-gray-600">{assignment.property.address}</div>
                    <div className="flex items-center gap-4 mt-1 text-sm">
                      <span>
                        入場: {formatTime(workRecord?.checkInAt ?? null)}
                      </span>
                      <span>退場: {formatTime(workRecord?.checkOutAt ?? null)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={`https://www.google.com/maps?q=${assignment.property.latitude},${assignment.property.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline"
                    >
                      地図
                    </a>
                    {isComplete ? (
                      <>
                        <button
                          type="button"
                          onClick={() => workRecord && setReportEditModal({ assignment, workRecord })}
                          className="px-3 py-1.5 rounded text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
                        >
                          報告内容編集
                        </button>
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-sm font-medium">
                          済
                        </span>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleCheckInClick(assignment)}
                          disabled={!canCheckIn}
                          className={`px-3 py-1.5 rounded text-sm font-medium ${
                            canCheckIn
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                          }`}
                        >
                          入場
                        </button>
                        <button
                          onClick={() => handleCheckOutClick(assignment)}
                          disabled={!canCheckOut}
                          className={`px-3 py-1.5 rounded text-sm font-medium ${
                            canCheckOut
                              ? 'bg-amber-600 text-white hover:bg-amber-700'
                              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                          }`}
                        >
                          退場
                        </button>
                      </>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
        </>
      )}

      {/* Check-in modal */}
      {checkInModal && (
        <CheckInModal
          propertyId={checkInModal.propertyId}
          propertyName={checkInModal.property.name}
          currentTime={getCurrentTimeString()}
          currentDate={getCurrentDateString()}
          submitting={submitting}
          onClose={() => setCheckInModal(null)}
          onSubmit={handleCheckInSubmit}
        />
      )}

      {/* Check-out modal */}
      {routeMapModalOpen && assignments.length > 0 && (
        <RouteMapModal
          assignments={assignments}
          onClose={() => setRouteMapModalOpen(false)}
        />
      )}

      {propertyDetailModal && (
        <PropertyDetailModal
          property={propertyDetailModal}
          onClose={() => setPropertyDetailModal(null)}
        />
      )}

      {reportEditModal && (
        <ReportEditModal
          propertyName={reportEditModal.assignment.property.name}
          record={reportEditModal.workRecord}
          submitting={submitting}
          onClose={() => setReportEditModal(null)}
          onSaved={() => {
            setReportEditModal(null)
            fetchData()
          }}
        />
      )}

      {historyDetailModal && (
        <HistoryDetailModal
          record={historyDetailModal}
          onClose={() => setHistoryDetailModal(null)}
        />
      )}

      {checkOutModal && (
        <CheckOutModal
          propertyName={checkOutModal.property.name}
          currentTime={getCurrentTimeString()}
          currentDate={getCurrentDateString()}
          submitting={submitting}
          onClose={() => setCheckOutModal(null)}
          onSubmit={handleCheckOutSubmit}
        />
      )}
    </div>
  )
}

function CheckInModal({
  propertyId,
  propertyName,
  currentTime,
  currentDate,
  submitting,
  onClose,
  onSubmit,
}: {
  propertyId: number
  propertyName: string
  currentTime: string
  currentDate: string
  submitting: boolean
  onClose: () => void
  onSubmit: (photoBase64: string | null, handoverConfirmed: boolean) => Promise<void>
}) {
  const [photoBase64, setPhotoBase64] = useState<string | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [step, setStep] = useState<'photo' | 'handover'>('photo')
  const [handoverNotes, setHandoverNotes] = useState<string | null>(null)
  const [handoverLoading, setHandoverLoading] = useState(false)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    try {
      const data = await compressImageToBase64(f)
      setPhotoBase64(data)
      setPhotoPreview(data)
    } catch {
      const reader = new FileReader()
      reader.onload = () => {
        const d = reader.result as string
        setPhotoBase64(d)
        setPhotoPreview(d)
      }
      reader.readAsDataURL(f)
    }
  }

  const handlePhotoSubmit = async () => {
    setHandoverLoading(true)
    try {
      const res = await fetch(`/api/employee/cleaning-handover?propertyId=${propertyId}`)
      const data = await res.json()
      if (data.handoverNotes) {
        setHandoverNotes(data.handoverNotes)
        setStep('handover')
      } else {
        await onSubmit(photoBase64, false)
      }
    } catch {
      await onSubmit(photoBase64, false)
    } finally {
      setHandoverLoading(false)
    }
  }

  const handleHandoverConfirm = () => {
    onSubmit(photoBase64, true)
  }

  const handleSubmit = () => {
    if (step === 'handover') {
      handleHandoverConfirm()
    } else {
      handlePhotoSubmit()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-bold mb-2">入場 - {propertyName}</h3>
        <p className="text-sm text-gray-600 mb-4">
          {currentDate} {currentTime}
        </p>
        <div className="space-y-4">
          {step === 'photo' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                建物外観写真（1枚・建物全体＋貸与時計）
              </label>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="block w-full text-sm"
              />
              {photoPreview && (
                <img
                  src={photoPreview}
                  alt="プレビュー"
                  className="mt-2 max-h-40 rounded border"
                />
              )}
            </div>
          )}
          {step === 'handover' && handoverNotes && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded">
              <p className="text-sm font-medium text-amber-800 mb-2">前回からの引き継ぎ事項</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{handoverNotes}</p>
              <p className="text-xs text-amber-700 mt-2">確認完了ボタンを押して打刻を完了してください。</p>
            </div>
          )}
        </div>
        <div className="mt-6 flex gap-2 justify-end">
          {step === 'handover' && (
            <button
              type="button"
              onClick={() => setStep('photo')}
              disabled={submitting}
              className="px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50"
            >
              戻る
            </button>
          )}
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50"
          >
            キャンセル
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || handoverLoading || (step === 'photo' && !photoPreview)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? '送信中...' : handoverLoading ? '確認中...' : step === 'handover' ? '確認完了' : '提出'}
          </button>
        </div>
      </div>
    </div>
  )
}

function RouteMapModal({ assignments, onClose }: { assignments: Assignment[]; onClose: () => void }) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)

  useEffect(() => {
    if (!mapContainerRef.current || assignments.length === 0) return
    let mounted = true
    const loadLeaflet = (): Promise<void> =>
      new Promise((resolve) => {
        if ((window as any).L) {
          resolve()
          return
        }
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
        document.head.appendChild(link)
        const script = document.createElement('script')
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
        script.async = true
        script.onload = () => resolve()
        document.head.appendChild(script)
      })

    const init = async () => {
      await loadLeaflet()
      if (!mounted || !mapContainerRef.current) return
      const L = (window as any).L
      if (!L) return
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })
      const pts = assignments.map((a) => [a.property.latitude, a.property.longitude] as [number, number])
      const center = pts.length > 0
        ? [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length]
        : [35.6812, 139.7671]
      const map = L.map(mapContainerRef.current).setView(center as [number, number], 12)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(map)
      pts.forEach((pt, i) => {
        L.marker(pt)
          .addTo(map)
          .bindPopup(`${i + 1}. ${assignments[i].property.name}`)
      })
      if (pts.length >= 2) {
        L.polyline(pts, { color: '#3b82f6', weight: 4 }).addTo(map)
      }
      mapRef.current = map
    }
    init()
    return () => {
      mounted = false
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [assignments])

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-semibold">今日の訪問ルート</h2>
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">
            閉じる
          </button>
        </div>
        <div ref={mapContainerRef} className="w-full h-[400px]" />
      </div>
    </div>
  )
}

function HistoryDetailModal({ record, onClose }: { record: CleaningWorkRecord; onClose: () => void }) {
  const urls = record.checkOutPhotoUrls
  const exteriorUrl = urls && typeof urls === 'object' && (urls as any).exterior ? (urls as any).exterior : null
  const garbageUrls = urls && typeof urls === 'object' && Array.isArray((urls as any).garbage) ? (urls as any).garbage : []

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b flex justify-between items-center sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-gray-900">
            作業記録詳細 - {record.property?.name ?? '-'}
          </h2>
          <button onClick={onClose} className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300">閉じる</button>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <p><span className="text-gray-600">入場:</span> {formatTime(record.checkInAt)}</p>
            <p><span className="text-gray-600">退場:</span> {formatTime(record.checkOutAt)}</p>
            <p><span className="text-gray-600">所要時間:</span> {(record as any).durationMinutes != null ? `${(record as any).durationMinutes}分` : '-'}</p>
          </div>
          {record.checkInPhotoUrl && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">入場写真</p>
              <img src={record.checkInPhotoUrl} alt="入場" className="rounded border max-w-full max-h-48 object-contain" />
            </div>
          )}
          {exteriorUrl && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">退場外観写真</p>
              <img src={exteriorUrl} alt="外観" className="rounded border max-w-full max-h-48 object-contain" />
            </div>
          )}
          {garbageUrls.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">ゴミ袋写真</p>
              <div className="flex flex-wrap gap-2">
                {garbageUrls.map((url: string, i: number) => (
                  <img key={i} src={url} alt={`ゴミ袋${i + 1}`} className="rounded border max-w-full max-h-32 object-contain" />
                ))}
              </div>
            </div>
          )}
          {record.impression && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">所感</p>
              <p className="text-sm text-gray-900 whitespace-pre-wrap">{record.impression}</p>
            </div>
          )}
          {record.dirtyAreas && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">特に汚れていた場所</p>
              <p className="text-sm text-gray-900 whitespace-pre-wrap">{record.dirtyAreas}</p>
            </div>
          )}
          {record.handoverNotes && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">次回への引き継ぎ事項</p>
              <p className="text-sm text-gray-900 whitespace-pre-wrap">{record.handoverNotes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PropertyDetailModal({ property, onClose }: { property: Property; onClose: () => void }) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)

  useEffect(() => {
    if (!mapContainerRef.current) return
    let mounted = true
    const loadLeaflet = (): Promise<void> =>
      new Promise((resolve) => {
        if ((window as any).L) {
          resolve()
          return
        }
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
        document.head.appendChild(link)
        const script = document.createElement('script')
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
        script.async = true
        script.onload = () => resolve()
        document.head.appendChild(script)
      })

    const init = async () => {
      await loadLeaflet()
      if (!mounted || !mapContainerRef.current) return
      const L = (window as any).L
      if (!L) return
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })
      const map = L.map(mapContainerRef.current).setView(
        [property.latitude, property.longitude],
        16
      )
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(map)
      L.marker([property.latitude, property.longitude])
        .addTo(map)
        .bindPopup(property.name)
      mapRef.current = map
    }
    init()
    return () => {
      mounted = false
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [property])

  const detailItems: { label: string; value: string | boolean | null | undefined }[] = []
  if (property.lockInfo) detailItems.push({ label: '施錠情報', value: property.lockInfo })
  if (property.hasManager != null) detailItems.push({ label: '管理人有無', value: property.hasManager ? 'あり' : 'なし' })
  if (property.parkingInfo) detailItems.push({ label: '駐車情報', value: property.parkingInfo })
  if (property.keyAccessInfo) detailItems.push({ label: '鍵・アクセス方法', value: property.keyAccessInfo })
  if (property.buildingAccessInfo) detailItems.push({ label: '建物の入り方', value: property.buildingAccessInfo })
  if (property.workRangeNotes) detailItems.push({ label: '作業範囲・注意事項', value: property.workRangeNotes })
  if (property.contactInfo) detailItems.push({ label: '連絡先', value: property.contactInfo })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md my-8">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">物件詳細</h2>
          <p className="text-base font-medium text-gray-800 mt-2">{property.name}</p>
          <p className="text-sm text-gray-600 mt-1">{property.address}</p>
        </div>
        {detailItems.length > 0 && (
          <div className="p-4 border-b space-y-3">
            {detailItems.map(({ label, value }) => (
              <div key={label}>
                <span className="text-xs font-medium text-gray-500 block mb-0.5">{label}</span>
                <p className="text-sm text-gray-900 whitespace-pre-wrap">{String(value)}</p>
              </div>
            ))}
          </div>
        )}
        <div ref={mapContainerRef} className="w-full h-[240px] bg-gray-100" />
        <div className="p-4 flex gap-2">
          <a
            href={`https://www.google.com/maps?q=${property.latitude},${property.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded text-center hover:bg-blue-700 font-medium"
          >
            Googleマップで開く
          </a>
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 font-medium">
            閉じる
          </button>
        </div>
      </div>
    </div>
  )
}

function ReportEditModal({
  propertyName,
  record,
  submitting,
  onClose,
  onSaved,
}: {
  propertyName: string
  record: CleaningWorkRecord
  submitting: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [impression, setImpression] = useState(record.impression ?? '')
  const [dirtyAreas, setDirtyAreas] = useState(record.dirtyAreas ?? '')
  const [handoverNotes, setHandoverNotes] = useState(record.handoverNotes ?? '')
  const [photoExteriorBase64, setPhotoExteriorBase64] = useState<string | null>(null)
  const [photoGarbageBase64s, setPhotoGarbageBase64s] = useState<string[]>([])
  const [exteriorPreview, setExteriorPreview] = useState<string | null>(null)
  const [garbagePreviews, setGarbagePreviews] = useState<string[]>([])

  const urls = record.checkOutPhotoUrls as { exterior?: string | null; garbage?: string[] } | null
  const existingExterior = urls?.exterior ?? null
  const existingGarbage = urls?.garbage ?? []

  const handleExteriorChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    try {
      const data = await compressImageToBase64(f)
      setPhotoExteriorBase64(data)
      setExteriorPreview(data)
    } catch {
      const reader = new FileReader()
      reader.onload = () => {
        const d = reader.result as string
        setPhotoExteriorBase64(d)
        setExteriorPreview(d)
      }
      reader.readAsDataURL(f)
    }
  }

  const handleGarbageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const results: string[] = []
    for (const f of files.slice(0, 5)) {
      try {
        const data = await compressImageToBase64(f)
        results.push(data)
      } catch {
        const d = await new Promise<string>((resolve, reject) => {
          const r = new FileReader()
          r.onload = () => resolve((r.result as string) || '')
          r.onerror = reject
          r.readAsDataURL(f)
        })
        results.push(d)
      }
    }
    setPhotoGarbageBase64s((prev) => [...prev, ...results])
    setGarbagePreviews((prev) => [...prev, ...results])
  }

  const handleSave = async () => {
    try {
      const res = await fetch(`/api/employee/cleaning-work-records/${record.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          impression: impression || undefined,
          dirtyAreas: dirtyAreas || undefined,
          handoverNotes: handoverNotes || undefined,
          photoExteriorBase64: photoExteriorBase64 || undefined,
          photoGarbageBase64s:
            photoGarbageBase64s.filter(Boolean).length > 0
              ? photoGarbageBase64s.filter(Boolean)
              : undefined,
        }),
      })
      const data = await res.json()
      if (data.error) {
        alert(data.error)
        return
      }
      onSaved()
    } catch {
      alert('保存に失敗しました')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 my-8">
        <h3 className="text-lg font-bold mb-2">報告内容編集 - {propertyName}</h3>
        <p className="text-sm text-gray-500 mb-4">作業当日のみ編集可能です。打刻時刻は変更できません。</p>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">外観写真（追加）</label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleExteriorChange}
              className="block w-full text-sm"
            />
            {existingExterior && !exteriorPreview && (
              <img src={existingExterior} alt="外観" className="mt-2 max-h-32 rounded border" />
            )}
            {exteriorPreview && (
              <img src={exteriorPreview} alt="外観（新規）" className="mt-2 max-h-32 rounded border" />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">ゴミ袋写真（追加）</label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              onChange={handleGarbageChange}
              className="block w-full text-sm"
            />
            {(existingGarbage.length > 0 || garbagePreviews.length > 0) && (
              <div className="flex gap-2 mt-2 flex-wrap">
                {existingGarbage.map((url, i) => (
                  <img key={`e-${i}`} src={url} alt={`ゴミ${i + 1}`} className="max-h-24 rounded border" />
                ))}
                {garbagePreviews.map((url, i) => (
                  <img key={`n-${i}`} src={url} alt={`ゴミ追加${i + 1}`} className="max-h-24 rounded border" />
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">所感</label>
            <textarea
              value={impression}
              onChange={(e) => setImpression(e.target.value)}
              rows={2}
              className="block w-full border rounded px-2 py-1.5"
              placeholder="作業全般の感想・メモ"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">特に汚れていた場所</label>
            <textarea
              value={dirtyAreas}
              onChange={(e) => setDirtyAreas(e.target.value)}
              rows={2}
              className="block w-full border rounded px-2 py-1.5"
              placeholder="今後の注意事項"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">次回への引き継ぎ事項</label>
            <textarea
              value={handoverNotes}
              onChange={(e) => setHandoverNotes(e.target.value)}
              rows={2}
              className="block w-full border rounded px-2 py-1.5"
              placeholder="次回の作業者向けメモ"
            />
          </div>
        </div>
        <div className="mt-6 flex gap-2 justify-end">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={submitting}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

function CheckOutModal({
  propertyName,
  currentTime,
  currentDate,
  submitting,
  onClose,
  onSubmit,
}: {
  propertyName: string
  currentTime: string
  currentDate: string
  submitting: boolean
  onClose: () => void
  onSubmit: (payload: {
    photoExteriorBase64: string | null
    photoGarbageBase64s: string[]
    workType: string
    workTypeOtherComment?: string
    impression?: string
    dirtyAreas?: string
    handoverNotes?: string
  }) => Promise<void>
}) {
  const [exteriorBase64, setExteriorBase64] = useState<string | null>(null)
  const [garbageBase64s, setGarbageBase64s] = useState<string[]>([])
  const [workType, setWorkType] = useState('定期清掃')
  const [workTypeOtherComment, setWorkTypeOtherComment] = useState('')
  const [impression, setImpression] = useState('')
  const [dirtyAreas, setDirtyAreas] = useState('')
  const [handoverNotes, setHandoverNotes] = useState('')
  const [exteriorPreview, setExteriorPreview] = useState<string | null>(null)
  const [garbagePreviews, setGarbagePreviews] = useState<string[]>([])

  const handleExteriorChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    try {
      const data = await compressImageToBase64(f)
      setExteriorBase64(data)
      setExteriorPreview(data)
    } catch {
      const reader = new FileReader()
      reader.onload = () => {
        const d = reader.result as string
        setExteriorBase64(d)
        setExteriorPreview(d)
      }
      reader.readAsDataURL(f)
    }
  }

  const handleGarbageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const results: string[] = []
    for (const f of files.slice(0, 5)) {
      try {
        const data = await compressImageToBase64(f)
        results.push(data)
      } catch {
        const d = await new Promise<string>((resolve, reject) => {
          const r = new FileReader()
          r.onload = () => resolve((r.result as string) || '')
          r.onerror = reject
          r.readAsDataURL(f)
        })
        results.push(d)
      }
    }
    setGarbageBase64s((prev) => [...prev, ...results])
    setGarbagePreviews((prev) => [...prev, ...results])
  }

  const handleSubmit = () => {
    onSubmit({
      photoExteriorBase64: exteriorBase64,
      photoGarbageBase64s: garbageBase64s,
      workType,
      workTypeOtherComment: workType === 'その他' ? workTypeOtherComment : undefined,
      impression,
      dirtyAreas,
      handoverNotes,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 my-8">
        <h3 className="text-lg font-bold mb-2">退場 - {propertyName}</h3>
        <p className="text-sm text-gray-600 mb-4">
          {currentDate} {currentTime}
        </p>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              外観写真（1枚）
            </label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleExteriorChange}
              className="block w-full text-sm"
            />
            {exteriorPreview && (
              <img src={exteriorPreview} alt="外観" className="mt-2 max-h-32 rounded border" />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ゴミ袋写真（複数可）
            </label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              onChange={handleGarbageChange}
              className="block w-full text-sm"
            />
            <div className="flex gap-2 mt-2 flex-wrap">
              {garbagePreviews.map((url, i) => (
                <img key={i} src={url} alt={`ゴミ${i + 1}`} className="max-h-24 rounded border" />
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">作業種別</label>
            <select
              value={workType}
              onChange={(e) => setWorkType(e.target.value)}
              className="block w-full border rounded px-2 py-1.5"
            >
              {WORK_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            {workType === 'その他' && (
              <input
                type="text"
                placeholder="コメント"
                value={workTypeOtherComment}
                onChange={(e) => setWorkTypeOtherComment(e.target.value)}
                className="mt-2 block w-full border rounded px-2 py-1.5"
              />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">所感</label>
            <textarea
              value={impression}
              onChange={(e) => setImpression(e.target.value)}
              rows={2}
              className="block w-full border rounded px-2 py-1.5"
              placeholder="作業全般の感想・メモ"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              特に汚れていた場所
            </label>
            <textarea
              value={dirtyAreas}
              onChange={(e) => setDirtyAreas(e.target.value)}
              rows={2}
              className="block w-full border rounded px-2 py-1.5"
              placeholder="今後の注意事項"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              次回への引き継ぎ事項
            </label>
            <textarea
              value={handoverNotes}
              onChange={(e) => setHandoverNotes(e.target.value)}
              rows={2}
              className="block w-full border rounded px-2 py-1.5"
              placeholder="次回の作業者向けメモ"
            />
          </div>
        </div>
        <div className="mt-6 flex gap-2 justify-end">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50"
          >
            キャンセル
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50"
          >
            {submitting ? '送信中...' : '退場'}
          </button>
        </div>
      </div>
    </div>
  )
}
