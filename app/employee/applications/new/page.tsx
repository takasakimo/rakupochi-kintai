'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const APPLICATION_TYPES = [
  { value: 'attendance_correction', label: '打刻修正', icon: '🕐' },
  { value: 'overtime', label: '残業申請', icon: '⏰' },
  { value: 'leave', label: '休暇申請', icon: '🏖️' },
  { value: 'expense_advance', label: '立替金精算', icon: '💰' },
  { value: 'expense_transportation', label: '交通費精算', icon: '🚗' },
  { value: 'shift_exchange', label: 'シフト交換', icon: '🔄' },
  { value: 'shift_request', label: 'シフト希望', icon: '📅' },
]

export default function NewApplicationPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [selectedType, setSelectedType] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
    leaveStartDate: '',
    leaveEndDate: '',
    leaveDays: 1,
    // 立替金精算用
    reimbursementDate: '',
    reimbursementCategory: '',
    reimbursementAmount: '',
    reimbursementDescription: '',
    reimbursementFiles: [] as Array<{ name: string; data: string; type: string }>, // ファイル配列
    // 交通費精算用
    transportationDate: '',
    transportationRoutes: [{ from: '', to: '', amount: '', method: '' }], // 経路配列
    transportationTotalAmount: '',
    transportationFiles: [] as Array<{ name: string; data: string; type: string }>, // ファイル配列
    // シフト交換用
    exchangeMyShiftDate: '',
    exchangeMyShiftId: '',
    exchangeTargetEmployeeId: '',
    exchangeTargetShiftDate: '',
    exchangeTargetShiftId: '',
    // シフト希望用
    requestDate: '',
    requestStartTime: '',
    requestEndTime: '',
    requestReason: '',
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
    }
  }, [status, router])

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
          if (!formData.date || !formData.reason || formData.reason.length < 10) {
            setError('日付と理由（10文字以上）を入力してください')
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
          if (!formData.leaveStartDate || !formData.leaveEndDate) {
            setError('開始日と終了日を入力してください')
            setLoading(false)
            return
          }
          content = {
            type: formData.leaveType,
            startDate: formData.leaveStartDate,
            endDate: formData.leaveEndDate,
            days: formData.leaveDays,
          }
          reason = formData.reason || '休暇申請'
          break

        case 'expense_advance':
          if (!formData.reimbursementDate || !formData.reimbursementCategory || !formData.reimbursementAmount) {
            setError('日付、カテゴリ、金額を入力してください')
            setLoading(false)
            return
          }
          content = {
            date: formData.reimbursementDate,
            category: formData.reimbursementCategory,
            amount: parseFloat(formData.reimbursementAmount),
            description: formData.reimbursementDescription || '',
            files: formData.reimbursementFiles || [],
          }
          reason = formData.reimbursementDescription || '立替金精算'
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

        case 'shift_exchange':
          if (
            !formData.exchangeMyShiftDate ||
            !formData.exchangeTargetEmployeeId ||
            !formData.exchangeTargetShiftDate
          ) {
            setError('自分のシフト日、交換相手、相手のシフト日を入力してください')
            setLoading(false)
            return
          }
          content = {
            myShiftDate: formData.exchangeMyShiftDate,
            myShiftId: formData.exchangeMyShiftId || null,
            targetEmployeeId: parseInt(formData.exchangeTargetEmployeeId),
            targetShiftDate: formData.exchangeTargetShiftDate,
            targetShiftId: formData.exchangeTargetShiftId || null,
          }
          reason = formData.reason || 'シフト交換申請'
          break

        case 'shift_request':
          if (!formData.requestDate || !formData.requestStartTime || !formData.requestEndTime) {
            setError('日付、開始時刻、終了時刻を入力してください')
            setLoading(false)
            return
          }
          content = {
            date: formData.requestDate,
            startTime: formData.requestStartTime,
            endTime: formData.requestEndTime,
            reason: formData.requestReason || '',
          }
          reason = formData.requestReason || 'シフト希望申請'
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
                  <div className="text-3xl mb-2">{type.icon}</div>
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
            {selectedTypeInfo?.icon} {selectedTypeInfo?.label}
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
                    修正理由 <span className="text-red-500">*</span>（10文字以上）
                  </label>
                  <textarea
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    required
                    minLength={10}
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
                  </select>
                </div>
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">日数</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.leaveDays}
                    onChange={(e) =>
                      setFormData({ ...formData, leaveDays: parseInt(e.target.value) || 1 })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>
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
                    カテゴリ <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.reimbursementCategory}
                    onChange={(e) =>
                      setFormData({ ...formData, reimbursementCategory: e.target.value })
                    }
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  >
                    <option value="">選択してください</option>
                    <option value="meal">食事代</option>
                    <option value="accommodation">宿泊費</option>
                    <option value="supplies">備品・消耗品</option>
                    <option value="entertainment">交際費</option>
                    <option value="other">その他</option>
                  </select>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">詳細</label>
                  <textarea
                    value={formData.reimbursementDescription}
                    onChange={(e) =>
                      setFormData({ ...formData, reimbursementDescription: e.target.value })
                    }
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    placeholder="立替金の詳細を記入してください（例: 会議費、備品購入など）"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    添付ファイル（PDF・画像、最大10枚）
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
                              placeholder="例: 東京駅"
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
                              placeholder="例: 新宿駅"
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
                    添付ファイル（PDF・画像、最大10枚）
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

            {/* シフト交換フォーム */}
            {selectedType === 'shift_exchange' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    自分のシフト日 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.exchangeMyShiftDate}
                    onChange={(e) =>
                      setFormData({ ...formData, exchangeMyShiftDate: e.target.value })
                    }
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    交換相手の従業員ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={formData.exchangeTargetEmployeeId}
                    onChange={(e) =>
                      setFormData({ ...formData, exchangeTargetEmployeeId: e.target.value })
                    }
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    placeholder="従業員IDを入力"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    交換したい相手の従業員IDを入力してください
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    相手のシフト日 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.exchangeTargetShiftDate}
                    onChange={(e) =>
                      setFormData({ ...formData, exchangeTargetShiftDate: e.target.value })
                    }
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">理由</label>
                  <textarea
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    placeholder="シフト交換の理由を記入してください"
                  />
                </div>
              </>
            )}

            {/* シフト希望フォーム */}
            {selectedType === 'shift_request' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    希望日 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.requestDate}
                    onChange={(e) =>
                      setFormData({ ...formData, requestDate: e.target.value })
                    }
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      希望開始時刻 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="time"
                      value={formData.requestStartTime}
                      onChange={(e) =>
                        setFormData({ ...formData, requestStartTime: e.target.value })
                      }
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      希望終了時刻 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="time"
                      value={formData.requestEndTime}
                      onChange={(e) =>
                        setFormData({ ...formData, requestEndTime: e.target.value })
                      }
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    />
                  </div>
                </div>
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

