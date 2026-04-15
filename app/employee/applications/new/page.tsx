'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, getDay } from 'date-fns'

const APPLICATION_TYPES = [
  { value: 'attendance_correction', label: '打刻修正', icon: null },
  { value: 'overtime', label: '残業申請', icon: null },
  { value: 'leave', label: '休暇申請', icon: null },
  { value: 'expense_advance', label: '立替金精算', icon: null },
  { value: 'expense_transportation', label: '交通費精算', icon: null },
  { value: 'shift_request', label: 'シフト希望', icon: null },
  { value: 'cleaning_check_omission', label: '入場/退場漏れ', icon: null },
]

export default function NewApplicationPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [selectedType, setSelectedType] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [admins, setAdmins] = useState<any[]>([])
  const [omissionProperties, setOmissionProperties] = useState<{ id: number; name: string }[]>([])

  // フォームデータ
  const [formData, setFormData] = useState<any>({
    title: '',
    reason: '',
    // 打刻修正用
    date: '',
    wakeUpTime: '',
    departureTime: '',
    clockIn: '',
    clockOut: '',
    // 残業申請用
    overtimeDate: '',
    overtimeStartTime: '',
    overtimeEndTime: '',
    overtimeReason: '',
    // 休暇申請用
    leaveType: 'paid', // paid, unpaid, special
    leaveDateMode: 'range', // 'range' or 'multiple'
    leaveStartDate: '',
    leaveEndDate: '',
    leaveSelectedDates: [] as string[], // 複数日選択用
    // 立替金精算用
    reimbursementDate: '',
    reimbursementStoreName: '', // 店名（旧カテゴリ）
    reimbursementAmount: '',
    reimbursementReason: '', // 理由（旧詳細）
    reimbursementApproverId: '', // 承認者ID
    reimbursementNotes: '', // 備考
    reimbursementFiles: [] as Array<{ name: string; data: string; type: string }>, // ファイル配列
    // 交通費精算用
    transportationDate: '',
    transportationRoutes: [{ from: '', to: '', amount: '', method: '' }], // 経路配列
    transportationTotalAmount: '',
    transportationFiles: [] as Array<{ name: string; data: string; type: string }>, // ファイル配列
    // シフト希望用
    requestSelectedDates: [] as string[], // 複数日選択用
    requestTimeSlots: {} as Record<string, { startTime: string; endTime: string }>, // 日付ごとの時間設定
    requestReason: '',
    // チェックイン/チェックアウト漏れ用
    omissionPropertyId: '',
    omissionWorkDate: '',
    omissionType: 'check_in' as 'check_in' | 'check_out',
    omissionEstimatedTime: '',
    omissionReason: '',
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
    }
    if (status === 'authenticated' && selectedType === 'expense_advance') {
      fetchAdmins()
    }
    if (status === 'authenticated' && selectedType === 'cleaning_check_omission') {
      fetch('/api/employee/properties')
        .then(res => res.json())
        .then(data => setOmissionProperties(data.properties || []))
        .catch(() => setOmissionProperties([]))
    }
  }, [status, router, selectedType])

  // 管理者リストを取得（承認者選択用）
  const fetchAdmins = async () => {
    try {
      const response = await fetch('/api/employee/admins')
      if (response.ok) {
        const data = await response.json()
        setAdmins(data.admins || [])
      }
    } catch (err) {
      console.error('Failed to fetch admins:', err)
    }
  }

  // ファイルアップロード処理
  const handleFileUpload = (
    event: React.ChangeEvent<HTMLInputElement>,
    fileType: 'reimbursement' | 'transportation'
  ) => {
    const files = event.target.files
    if (!files) return

    const currentFiles =
      fileType === 'reimbursement'
        ? formData.reimbursementFiles
        : formData.transportationFiles

    if (currentFiles.length + files.length > 10) {
      setError('ファイルは最大10枚までアップロードできます')
      return
    }

    const newFiles: Array<{ name: string; data: string; type: string }> = []

    Array.from(files).forEach((file) => {
      // ファイルタイプのチェック
      const validTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/pdf',
      ]
      if (!validTypes.includes(file.type)) {
        setError(
          '対応していないファイル形式です。PDF、JPEG、PNG、GIF、WebPのみアップロード可能です。'
        )
        return
      }

      // ファイルサイズのチェック（10MB以下）
      if (file.size > 10 * 1024 * 1024) {
        setError('ファイルサイズは10MB以下にしてください')
        return
      }

      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        newFiles.push({
          name: file.name,
          data: result,
          type: file.type,
        })

        // 全てのファイルを読み込んだら更新
        if (newFiles.length === files.length) {
          if (fileType === 'reimbursement') {
            setFormData({
              ...formData,
              reimbursementFiles: [...currentFiles, ...newFiles],
            })
          } else {
            setFormData({
              ...formData,
              transportationFiles: [...currentFiles, ...newFiles],
            })
          }
          setError('')
        }
      }
      reader.readAsDataURL(file)
    })
  }

  // ファイル削除処理
  const handleFileRemove = (
    index: number,
    fileType: 'reimbursement' | 'transportation'
  ) => {
    if (fileType === 'reimbursement') {
      const newFiles = formData.reimbursementFiles.filter((_: any, i: number) => i !== index)
      setFormData({ ...formData, reimbursementFiles: newFiles })
    } else {
      const newFiles = formData.transportationFiles.filter((_: any, i: number) => i !== index)
      setFormData({ ...formData, transportationFiles: newFiles })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      let content: any = {}
      let reason = formData.reason

      // 申請タイプごとにcontentを構築
      switch (selectedType) {
        case 'attendance_correction':
          if (!formData.date || !formData.reason) {
            setError('日付と理由を入力してください')
            setLoading(false)
            return
          }
          content = {
            date: formData.date,
            wakeUpTime: formData.wakeUpTime || null,
            departureTime: formData.departureTime || null,
            clockIn: formData.clockIn || null,
            clockOut: formData.clockOut || null,
          }
          reason = formData.reason
          break

        case 'overtime':
          if (!formData.overtimeDate || !formData.overtimeStartTime || !formData.overtimeEndTime) {
            setError('日付、開始時刻、終了時刻を入力してください')
            setLoading(false)
            return
          }
          content = {
            date: formData.overtimeDate,
            startTime: formData.overtimeStartTime,
            endTime: formData.overtimeEndTime,
            reason: formData.overtimeReason || '',
          }
          reason = formData.overtimeReason || '残業申請'
          break

        case 'leave':
          if (formData.leaveDateMode === 'range') {
            if (!formData.leaveStartDate || !formData.leaveEndDate) {
              setError('開始日と終了日を入力してください')
              setLoading(false)
              return
            }
            content = {
              type: formData.leaveType,
              dateMode: 'range',
              startDate: formData.leaveStartDate,
              endDate: formData.leaveEndDate,
              reason: formData.reason || '',
            }
          } else {
            if (!formData.leaveSelectedDates || formData.leaveSelectedDates.length === 0) {
              setError('休暇日を選択してください')
              setLoading(false)
              return
            }
            content = {
              type: formData.leaveType,
              dateMode: 'multiple',
              selectedDates: formData.leaveSelectedDates.sort(),
              reason: formData.reason || '',
            }
          }
          reason = formData.reason || '休暇申請'
          break

        case 'expense_advance':
          if (!formData.reimbursementDate || !formData.reimbursementStoreName || !formData.reimbursementAmount) {
            setError('日付、店名、金額を入力してください')
            setLoading(false)
            return
          }
          content = {
            date: formData.reimbursementDate,
            storeName: formData.reimbursementStoreName,
            amount: parseFloat(formData.reimbursementAmount),
            reason: formData.reimbursementReason || '',
            notes: formData.reimbursementNotes || '',
            files: formData.reimbursementFiles || [],
          }
          reason = formData.reimbursementReason || '立替金精算'
          break

        case 'expense_transportation':
          if (!formData.transportationDate || formData.transportationRoutes.length === 0) {
            setError('日付と経路を入力してください')
            setLoading(false)
            return
          }
          // 経路のバリデーション
          const invalidRoute = formData.transportationRoutes.find(
            (r: any) => !r.from || !r.to || !r.amount
          )
          if (invalidRoute) {
            setError('全ての経路の出発地、到着地、金額を入力してください')
            setLoading(false)
            return
          }
          const totalAmount = formData.transportationRoutes.reduce(
            (sum: number, r: any) => sum + (parseFloat(r.amount) || 0),
            0
          )
          content = {
            date: formData.transportationDate,
            routes: formData.transportationRoutes.map((r: any) => ({
              from: r.from,
              to: r.to,
              method: r.method || '',
              amount: parseFloat(r.amount) || 0,
            })),
            totalAmount,
            files: formData.transportationFiles || [],
          }
          reason = `交通費精算（${formData.transportationRoutes.length}経路、合計¥${totalAmount.toLocaleString()}）`
          break

        case 'shift_request':
          if (!formData.requestSelectedDates || formData.requestSelectedDates.length === 0) {
            setError('希望日を選択してください')
            setLoading(false)
            return
          }
          // 選択された日付ごとに時間が設定されているか確認
          const missingTimeSlots = formData.requestSelectedDates.filter(
            (date: string) => !formData.requestTimeSlots[date] || 
            !formData.requestTimeSlots[date].startTime || 
            !formData.requestTimeSlots[date].endTime
          )
          if (missingTimeSlots.length > 0) {
            setError('選択した日付すべてに開始時刻と終了時刻を設定してください')
            setLoading(false)
            return
          }
          content = {
            selectedDates: formData.requestSelectedDates.sort(),
            timeSlots: formData.requestTimeSlots,
            reason: formData.requestReason || '',
          }
          reason = formData.requestReason || 'シフト希望申請'
          break

        case 'cleaning_check_omission':
          if (!formData.omissionPropertyId || !formData.omissionWorkDate || !formData.omissionType) {
            setError('物件・作業日・漏れ種別を入力してください')
            setLoading(false)
            return
          }
          const prop = omissionProperties.find((p: { id: number; name: string }) => p.id === Number(formData.omissionPropertyId))
          content = {
            propertyId: Number(formData.omissionPropertyId),
            propertyName: prop?.name ?? '',
            workDate: formData.omissionWorkDate,
            omissionType: formData.omissionType,
            estimatedTime: formData.omissionEstimatedTime || null,
            reason: formData.omissionReason || null,
          }
          reason = formData.omissionReason || '入場/退場漏れ申請'
          break

        default:
          setError('申請タイプを選択してください')
          setLoading(false)
          return
      }

      const response = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: selectedType,
          title: formData.title || null,
          content,
          reason,
          approverId: selectedType === 'expense_advance' ? formData.reimbursementApproverId || null : null,
        }),
      })

      const data = await response.json()

      if (data.success) {
        router.push('/employee/applications')
        router.refresh()
      } else {
        setError(data.error || '申請の作成に失敗しました')
      }
    } catch (err) {
      console.error('Failed to create application:', err)
      setError('申請の作成に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading') {
    return <div className="p-8 text-center text-gray-900">読み込み中...</div>
  }

  if (!selectedType) {
    return (
      <div className="p-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-6 text-gray-900">新規申請</h1>
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold mb-4 text-gray-900">申請タイプを選択</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {APPLICATION_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setSelectedType(type.value)}
                  className="p-6 bg-blue-50 hover:bg-blue-100 rounded-lg transition text-left"
                >
                  <div className="text-lg font-semibold text-gray-900">{type.label}</div>
                </button>
              ))}
            </div>
            <div className="mt-6">
              <Link
                href="/employee/applications"
                className="px-4 py-2 bg-gray-200 text-gray-900 rounded-md hover:bg-gray-300 font-medium"
              >
                キャンセル
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const selectedTypeInfo = APPLICATION_TYPES.find((t) => t.value === selectedType)

  return (
    <div className="p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => setSelectedType('')}
            className="px-4 py-2 bg-gray-200 text-gray-900 rounded-md hover:bg-gray-300 font-medium"
          >
            ← 戻る
          </button>
          <h1 className="text-2xl font-bold text-gray-900">
            {selectedTypeInfo?.label}
          </h1>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* タイトル（任意） */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                タイトル（任意）
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                placeholder="申請のタイトルを入力"
              />
            </div>

            {/* 打刻修正フォーム */}
            {selectedType === 'attendance_correction' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    修正する日付 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">起床時刻</label>
                    <input
                      type="time"
                      value={formData.wakeUpTime}
                      onChange={(e) =>
                        setFormData({ ...formData, wakeUpTime: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">出発時刻</label>
                    <input
                      type="time"
                      value={formData.departureTime}
                      onChange={(e) =>
                        setFormData({ ...formData, departureTime: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">出勤時刻</label>
                    <input
                      type="time"
                      value={formData.clockIn}
                      onChange={(e) => setFormData({ ...formData, clockIn: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">退勤時刻</label>
                    <input
                      type="time"
                      value={formData.clockOut}
                      onChange={(e) => setFormData({ ...formData, clockOut: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    修正理由 <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    required
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    placeholder="修正理由を詳しく記入してください"
                  />
                </div>
              </>
            )}

            {/* 残業申請フォーム */}
            {selectedType === 'overtime' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    残業日 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.overtimeDate}
                    onChange={(e) =>
                      setFormData({ ...formData, overtimeDate: e.target.value })
                    }
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      開始時刻 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="time"
                      value={formData.overtimeStartTime}
                      onChange={(e) =>
                        setFormData({ ...formData, overtimeStartTime: e.target.value })
                      }
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      終了時刻 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="time"
                      value={formData.overtimeEndTime}
                      onChange={(e) =>
                        setFormData({ ...formData, overtimeEndTime: e.target.value })
                      }
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">理由</label>
                  <textarea
                    value={formData.overtimeReason}
                    onChange={(e) =>
                      setFormData({ ...formData, overtimeReason: e.target.value })
                    }
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    placeholder="残業の理由を記入してください"
                  />
                </div>
              </>
            )}

            {/* 休暇申請フォーム */}
            {selectedType === 'leave' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    休暇種別 <span className="text-red-500">*</span>
                  </label>
                    <select
                    value={formData.leaveType}
                    onChange={(e) => setFormData({ ...formData, leaveType: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  >
                    <option value="paid">有給休暇</option>
                    <option value="unpaid">無給休暇</option>
                    <option value="special">特別休暇</option>
                    <option value="bereavement">慶弔休暇</option>
                    <option value="childcare">育児休暇</option>
                    <option value="nursing">介護休暇</option>
                    <option value="sick">病気休暇</option>
                    <option value="menstrual">生理休暇</option>
                    <option value="marriage">結婚休暇</option>
                    <option value="maternity">出産休暇</option>
                    <option value="paternity">パートナー出産休暇</option>
                    <option value="refresh">リフレッシュ休暇</option>
                    <option value="volunteer">ボランティア休暇</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    日付選択方法 <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="range"
                        checked={formData.leaveDateMode === 'range'}
                        onChange={(e) => setFormData({ ...formData, leaveDateMode: e.target.value, leaveSelectedDates: [] })}
                        className="mr-2"
                      />
                      <span>開始日・終了日で選択</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="multiple"
                        checked={formData.leaveDateMode === 'multiple'}
                        onChange={(e) => setFormData({ ...formData, leaveDateMode: e.target.value, leaveStartDate: '', leaveEndDate: '' })}
                        className="mr-2"
                      />
                      <span>カレンダーから複数日選択</span>
                    </label>
                  </div>
                </div>
                {formData.leaveDateMode === 'range' ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        開始日 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={formData.leaveStartDate}
                        onChange={(e) =>
                          setFormData({ ...formData, leaveStartDate: e.target.value })
                        }
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        終了日 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={formData.leaveEndDate}
                        onChange={(e) =>
                          setFormData({ ...formData, leaveEndDate: e.target.value })
                        }
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                      />
                    </div>
                  </div>
                ) : (
                  <LeaveDateCalendar
                    selectedDates={formData.leaveSelectedDates || []}
                    onDateToggle={(date: string) => {
                      const dates = [...(formData.leaveSelectedDates || [])]
                      const index = dates.indexOf(date)
                      if (index > -1) {
                        dates.splice(index, 1)
                      } else {
                        dates.push(date)
                      }
                      setFormData({ ...formData, leaveSelectedDates: dates })
                    }}
                  />
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">理由</label>
                  <textarea
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    placeholder="休暇の理由を記入してください"
                  />
                </div>
              </>
            )}

            {/* 立替金精算フォーム */}
            {selectedType === 'expense_advance' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    日付 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.reimbursementDate}
                    onChange={(e) =>
                      setFormData({ ...formData, reimbursementDate: e.target.value })
                    }
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    店名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.reimbursementStoreName}
                    onChange={(e) =>
                      setFormData({ ...formData, reimbursementStoreName: e.target.value })
                    }
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    placeholder="店名を入力してください"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    金額 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={formData.reimbursementAmount}
                    onChange={(e) =>
                      setFormData({ ...formData, reimbursementAmount: e.target.value })
                    }
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">理由</label>
                  <textarea
                    value={formData.reimbursementReason}
                    onChange={(e) =>
                      setFormData({ ...formData, reimbursementReason: e.target.value })
                    }
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    placeholder="立替金の理由を記入してください"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">承認者</label>
                  <select
                    value={formData.reimbursementApproverId}
                    onChange={(e) =>
                      setFormData({ ...formData, reimbursementApproverId: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  >
                    <option value="">選択してください</option>
                    {admins.map((admin) => (
                      <option key={admin.id} value={admin.id}>
                        {admin.name} ({admin.employeeNumber})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">備考</label>
                  <textarea
                    value={formData.reimbursementNotes}
                    onChange={(e) =>
                      setFormData({ ...formData, reimbursementNotes: e.target.value })
                    }
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    placeholder="備考を記入してください"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    領収書（PDF・画像、最大10枚、1ファイル10MBまで）
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
                    multiple
                    onChange={(e) => handleFileUpload(e, 'reimbursement')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white text-sm"
                    disabled={formData.reimbursementFiles.length >= 10}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {formData.reimbursementFiles.length}/10枚
                    {formData.reimbursementFiles.length >= 10 && '（上限に達しています）'}
                  </p>
                  {formData.reimbursementFiles.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {formData.reimbursementFiles.map((file: { name: string; data: string; type: string }, index: number) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-2 bg-gray-50 rounded border"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {file.type.startsWith('image/') ? (
                              <img
                                src={file.data}
                                alt={file.name}
                                className="w-12 h-12 object-cover rounded"
                              />
                            ) : (
                              <div className="w-12 h-12 bg-red-100 flex items-center justify-center rounded">
                                <span className="text-red-600 font-bold text-xs">PDF</span>
                              </div>
                            )}
                            <span className="text-sm text-gray-900 truncate">{file.name}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleFileRemove(index, 'reimbursement')}
                            className="ml-2 text-red-500 hover:text-red-700 text-sm"
                          >
                            削除
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* 交通費精算フォーム */}
            {selectedType === 'expense_transportation' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    日付 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.transportationDate}
                    onChange={(e) =>
                      setFormData({ ...formData, transportationDate: e.target.value })
                    }
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    経路 <span className="text-red-500">*</span>
                  </label>
                  <div className="space-y-3">
                    {formData.transportationRoutes.map((route: { from: string; to: string; amount: string; method: string }, index: number) => (
                      <div
                        key={index}
                        className="p-4 border border-gray-300 rounded-md bg-gray-50"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium text-gray-700">
                            経路 {index + 1}
                          </span>
                          {formData.transportationRoutes.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const newRoutes = formData.transportationRoutes.filter(
                                  (_: any, i: number) => i !== index
                                )
                                setFormData({ ...formData, transportationRoutes: newRoutes })
                              }}
                              className="text-red-500 hover:text-red-700 text-sm"
                            >
                              削除
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">出発地 *</label>
                            <input
                              type="text"
                              value={route.from}
                              onChange={(e) => {
                                const newRoutes = [...formData.transportationRoutes]
                                newRoutes[index].from = e.target.value
                                setFormData({ ...formData, transportationRoutes: newRoutes })
                              }}
                              required
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">到着地 *</label>
                            <input
                              type="text"
                              value={route.to}
                              onChange={(e) => {
                                const newRoutes = [...formData.transportationRoutes]
                                newRoutes[index].to = e.target.value
                                setFormData({ ...formData, transportationRoutes: newRoutes })
                              }}
                              required
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white text-sm"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">交通手段</label>
                            <select
                              value={route.method}
                              onChange={(e) => {
                                const newRoutes = [...formData.transportationRoutes]
                                newRoutes[index].method = e.target.value
                                setFormData({ ...formData, transportationRoutes: newRoutes })
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white text-sm"
                            >
                              <option value="">選択</option>
                              <option value="train">電車</option>
                              <option value="bus">バス</option>
                              <option value="taxi">タクシー</option>
                              <option value="car">車</option>
                              <option value="other">その他</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">金額 *</label>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={route.amount}
                              onChange={(e) => {
                                const newRoutes = [...formData.transportationRoutes]
                                newRoutes[index].amount = e.target.value
                                // 合計金額を自動計算
                                const total = newRoutes.reduce(
                                  (sum: number, r: any) => sum + (parseFloat(r.amount) || 0),
                                  0
                                )
                                setFormData({
                                  ...formData,
                                  transportationRoutes: newRoutes,
                                  transportationTotalAmount: total.toString(),
                                })
                              }}
                              required
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white text-sm"
                              placeholder="0"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({
                          ...formData,
                          transportationRoutes: [
                            ...formData.transportationRoutes,
                            { from: '', to: '', amount: '', method: '' },
                          ],
                        })
                      }}
                      className="w-full py-2 px-4 border-2 border-dashed border-gray-300 rounded-md text-gray-600 hover:border-blue-500 hover:text-blue-500 transition text-sm"
                    >
                      + 経路を追加
                    </button>
                  </div>
                </div>
                <div className="bg-blue-50 p-4 rounded-md">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-900">合計金額:</span>
                    <span className="text-xl font-bold text-blue-600">
                      ¥
                      {formData.transportationRoutes
                        .reduce((sum: number, route: any) => sum + (parseFloat(route.amount) || 0), 0)
                        .toLocaleString()}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    領収書（PDF・画像、最大10枚、1ファイル10MBまで）
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
                    multiple
                    onChange={(e) => handleFileUpload(e, 'transportation')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white text-sm"
                    disabled={formData.transportationFiles.length >= 10}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {formData.transportationFiles.length}/10枚
                    {formData.transportationFiles.length >= 10 && '（上限に達しています）'}
                  </p>
                  {formData.transportationFiles.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {formData.transportationFiles.map((file: { name: string; data: string; type: string }, index: number) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-2 bg-gray-50 rounded border"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {file.type.startsWith('image/') ? (
                              <img
                                src={file.data}
                                alt={file.name}
                                className="w-12 h-12 object-cover rounded"
                              />
                            ) : (
                              <div className="w-12 h-12 bg-red-100 flex items-center justify-center rounded">
                                <span className="text-red-600 font-bold text-xs">PDF</span>
                              </div>
                            )}
                            <span className="text-sm text-gray-900 truncate">{file.name}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleFileRemove(index, 'transportation')}
                            className="ml-2 text-red-500 hover:text-red-700 text-sm"
                          >
                            削除
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* シフト希望フォーム */}
            {selectedType === 'shift_request' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    希望日をカレンダーから選択 <span className="text-red-500">*</span>
                  </label>
                  <LeaveDateCalendar
                    selectedDates={formData.requestSelectedDates || []}
                    onDateToggle={(date: string) => {
                      const dates = [...(formData.requestSelectedDates || [])]
                      const index = dates.indexOf(date)
                      const timeSlots = { ...formData.requestTimeSlots }
                      
                      if (index > -1) {
                        // 日付を削除する場合、対応する時間設定も削除
                        dates.splice(index, 1)
                        delete timeSlots[date]
                      } else {
                        // 日付を追加する場合、デフォルトの時間設定を追加
                        dates.push(date)
                        timeSlots[date] = { startTime: '', endTime: '' }
                      }
                      setFormData({ 
                        ...formData, 
                        requestSelectedDates: dates,
                        requestTimeSlots: timeSlots
                      })
                    }}
                  />
                </div>
                
                {/* 選択された日付ごとの時間設定 */}
                {formData.requestSelectedDates && formData.requestSelectedDates.length > 0 && (
                  <div className="mt-4 space-y-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      各日付の勤務可能時間 <span className="text-red-500">*</span>
                    </label>
                    {formData.requestSelectedDates.sort().map((date: string) => (
                      <div key={date} className="p-4 border border-gray-300 rounded-md bg-gray-50">
                        <div className="mb-2 font-medium text-gray-900">
                          {new Date(date).toLocaleDateString('ja-JP', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            weekday: 'short'
                          })}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">
                              開始時刻 <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="time"
                              value={formData.requestTimeSlots[date]?.startTime || ''}
                              onChange={(e) => {
                                const timeSlots = { ...formData.requestTimeSlots }
                                timeSlots[date] = {
                                  ...timeSlots[date],
                                  startTime: e.target.value
                                }
                                setFormData({ ...formData, requestTimeSlots: timeSlots })
                              }}
                              required
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">
                              終了時刻 <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="time"
                              value={formData.requestTimeSlots[date]?.endTime || ''}
                              onChange={(e) => {
                                const timeSlots = { ...formData.requestTimeSlots }
                                timeSlots[date] = {
                                  ...timeSlots[date],
                                  endTime: e.target.value
                                }
                                setFormData({ ...formData, requestTimeSlots: timeSlots })
                              }}
                              required
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">理由</label>
                  <textarea
                    value={formData.requestReason}
                    onChange={(e) =>
                      setFormData({ ...formData, requestReason: e.target.value })
                    }
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    placeholder="シフト希望の理由を記入してください"
                  />
                </div>
              </>
            )}

            {/* 入場/退場漏れフォーム */}
            {selectedType === 'cleaning_check_omission' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">物件 <span className="text-red-500">*</span></label>
                  <select
                    value={formData.omissionPropertyId}
                    onChange={(e) => setFormData({ ...formData, omissionPropertyId: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  >
                    <option value="">選択してください</option>
                    {omissionProperties.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">作業日 <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    value={formData.omissionWorkDate}
                    onChange={(e) => setFormData({ ...formData, omissionWorkDate: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">漏れ種別 <span className="text-red-500">*</span></label>
                  <select
                    value={formData.omissionType}
                    onChange={(e) => setFormData({ ...formData, omissionType: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  >
                    <option value="check_in">入場</option>
                    <option value="check_out">退場</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">想定時刻（任意）</label>
                  <input
                    type="time"
                    value={formData.omissionEstimatedTime}
                    onChange={(e) => setFormData({ ...formData, omissionEstimatedTime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">理由（任意）</label>
                  <textarea
                    value={formData.omissionReason}
                    onChange={(e) => setFormData({ ...formData, omissionReason: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    placeholder="漏れの理由を記入してください"
                  />
                </div>
              </>
            )}

            {error && (
              <div className="p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>
            )}

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-blue-500 text-white rounded-md font-semibold hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '送信中...' : '申請する'}
              </button>
              <Link
                href="/employee/applications"
                className="px-6 py-2 bg-gray-200 text-gray-900 rounded-md hover:bg-gray-300 font-semibold text-center"
              >
                キャンセル
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// カレンダーコンポーネント
function LeaveDateCalendar({
  selectedDates,
  onDateToggle,
}: {
  selectedDates: string[]
  onDateToggle: (date: string) => void
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })

  const firstDayOfWeek = getDay(monthStart)
  const weeks: (Date | null)[][] = []
  let currentWeek: (Date | null)[] = []

  // 最初の週の空欄を埋める
  for (let i = 0; i < firstDayOfWeek; i++) {
    currentWeek.push(null)
  }

  // 日付を追加
  daysInMonth.forEach((day) => {
    currentWeek.push(day)
    if (currentWeek.length === 7) {
      weeks.push(currentWeek)
      currentWeek = []
    }
  })

  // 最後の週の空欄を埋める
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push(null)
    }
    weeks.push(currentWeek)
  }

  const handleDateClick = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    onDateToggle(dateStr)
  }

  const isDateSelected = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    return selectedDates && Array.isArray(selectedDates) ? selectedDates.includes(dateStr) : false
  }

  const isDatePast = (date: Date) => {
    return date < today
  }

  const prevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1))
  }

  const nextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1))
  }

  return (
    <div className="border border-gray-300 rounded-md p-4 bg-white">
      <div className="flex justify-between items-center mb-4">
        <button
          type="button"
          onClick={prevMonth}
          className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-900"
        >
          ←
        </button>
        <h3 className="text-lg font-semibold text-gray-900">
          {format(currentMonth, 'yyyy年MM月')}
        </h3>
        <button
          type="button"
          onClick={nextMonth}
          className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-900"
        >
          →
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['日', '月', '火', '水', '木', '金', '土'].map((day) => (
          <div key={day} className="text-center text-sm font-semibold text-gray-700 py-2">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {weeks.map((week, weekIndex) =>
          week.map((day, dayIndex) => {
            if (!day) {
              return <div key={`${weekIndex}-${dayIndex}`} className="aspect-square" />
            }
            const dateStr = format(day, 'yyyy-MM-dd')
            const selected = isDateSelected(day)
            const past = isDatePast(day)
            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => !past && handleDateClick(day)}
                disabled={past}
                className={`
                  aspect-square border rounded-md text-sm
                  ${selected ? 'bg-blue-500 text-white border-blue-600' : 'bg-white text-gray-900 border-gray-300'}
                  ${past ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-50 cursor-pointer'}
                  ${isSameDay(day, today) ? 'ring-2 ring-blue-400' : ''}
                `}
              >
                {format(day, 'd')}
              </button>
            )
          })
        )}
      </div>
      {selectedDates && Array.isArray(selectedDates) && selectedDates.length > 0 && (
        <div className="mt-4 p-3 bg-blue-50 rounded-md">
          <div className="text-sm font-medium text-gray-900 mb-2">
            選択された日付 ({selectedDates.length}日):
          </div>
          <div className="text-xs text-gray-700">
            {selectedDates.sort().map((date) => format(new Date(date), 'yyyy/MM/dd')).join(', ')}
          </div>
        </div>
      )}
    </div>
  )
}