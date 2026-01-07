'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface Application {
  id: number
  type: string
  status: string
  title: string | null
  content: string
  reason: string | null
  createdAt: string
  employee: {
    id: number
    name: string
    employeeNumber: string
  }
}

const APPLICATION_TYPES: Record<string, string> = {
  attendance_correction: '打刻修正',
  overtime: '残業申請',
  leave: '休暇申請',
  expense_advance: '立替金精算',
  expense_transportation: '交通費精算',
  shift_exchange: 'シフト交換',
  shift_request: 'シフト希望',
}

export default function AdminApplicationsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('pending')
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  
  // 検索フィルター
  const [searchFilters, setSearchFilters] = useState({
    startDate: '',
    endDate: '',
    category: '',
    type: '',
  })

  // URLパラメータからstatusを取得
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const statusParam = params.get('status')
    if (statusParam) {
      setFilterStatus(statusParam)
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated' && session?.user.role === 'admin') {
      fetchApplications()
    }
  }, [status, session, filterStatus, searchFilters])

  const fetchApplications = async () => {
    try {
      const params = new URLSearchParams()
      if (filterStatus) {
        params.append('status', filterStatus)
      }
      if (searchFilters.startDate) {
        params.append('start_date', searchFilters.startDate)
      }
      if (searchFilters.endDate) {
        params.append('end_date', searchFilters.endDate)
      }
      if (searchFilters.category) {
        params.append('category', searchFilters.category)
      }
      if (searchFilters.type) {
        params.append('type', searchFilters.type)
      }

      const url = `/api/applications?${params.toString()}`
      const response = await fetch(url)
      const data = await response.json()
      setApplications(data.applications || [])
    } catch (err) {
      console.error('Failed to fetch applications:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (id: number) => {
    if (!confirm('この申請を承認しますか？')) return

    try {
      const response = await fetch(`/api/applications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      })

      const data = await response.json()
      if (data.success) {
        fetchApplications()
      }
    } catch (err) {
      console.error('Failed to approve application:', err)
      alert('承認に失敗しました')
    }
  }

  const handleReject = async (id: number) => {
    const reason = prompt('却下理由を入力してください:')
    if (!reason) return

    try {
      const response = await fetch(`/api/applications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected', rejectionReason: reason }),
      })

      const data = await response.json()
      if (data.success) {
        fetchApplications()
      }
    } catch (err) {
      console.error('Failed to reject application:', err)
      alert('却下に失敗しました')
    }
  }

  // 申請から金額を取得
  const getApplicationAmount = (app: Application): number | null => {
    try {
      const content = JSON.parse(app.content)
      if (app.type === 'expense_advance') {
        return content.amount || null
      } else if (app.type === 'expense_transportation') {
        return content.totalAmount || null
      }
      return null
    } catch {
      return null
    }
  }

  // 申請から日付を取得
  const getApplicationDate = (app: Application): string => {
    try {
      const content = JSON.parse(app.content)
      if (content.date) {
        return new Date(content.date).toLocaleDateString('ja-JP')
      }
      return new Date(app.createdAt).toLocaleDateString('ja-JP')
    } catch {
      return new Date(app.createdAt).toLocaleDateString('ja-JP')
    }
  }

  // 申請からカテゴリを取得
  const getApplicationCategory = (app: Application): string | null => {
    try {
      const content = JSON.parse(app.content)
      if (app.type === 'expense_advance' && content.category) {
        const categoryMap: Record<string, string> = {
          meal: '食事代',
          accommodation: '宿泊費',
          supplies: '備品・消耗品',
          entertainment: '交際費',
          other: 'その他',
        }
        return categoryMap[content.category] || content.category
      }
      return null
    } catch {
      return null
    }
  }

  // 詳細モーダルを開く
  const handleShowDetail = (app: Application) => {
    setSelectedApplication(app)
    setShowDetailModal(true)
  }

  // 申請詳細の表示
  const renderApplicationDetails = (type: string, contentString: string) => {
    try {
      const content = JSON.parse(contentString)

      switch (type) {
        case 'attendance_correction':
          return (
            <div className="space-y-2 text-sm text-gray-700">
              <div>
                <span className="font-medium">修正日付:</span>{' '}
                {content.date ? new Date(content.date).toLocaleDateString('ja-JP') : '-'}
              </div>
              {content.wakeUpTime && (
                <div>
                  <span className="font-medium">起床時刻:</span> {content.wakeUpTime.slice(0, 5)}
                </div>
              )}
              {content.departureTime && (
                <div>
                  <span className="font-medium">出発時刻:</span> {content.departureTime.slice(0, 5)}
                </div>
              )}
              {content.clockIn && (
                <div>
                  <span className="font-medium">出勤時刻:</span> {content.clockIn.slice(0, 5)}
                </div>
              )}
              {content.clockOut && (
                <div>
                  <span className="font-medium">退勤時刻:</span> {content.clockOut.slice(0, 5)}
                </div>
              )}
            </div>
          )

        case 'overtime':
          return (
            <div className="space-y-2 text-sm text-gray-700">
              <div>
                <span className="font-medium">残業日:</span>{' '}
                {content.date ? new Date(content.date).toLocaleDateString('ja-JP') : '-'}
              </div>
              <div>
                <span className="font-medium">開始時刻:</span> {content.startTime?.slice(0, 5) || '-'}
              </div>
              <div>
                <span className="font-medium">終了時刻:</span> {content.endTime?.slice(0, 5) || '-'}
              </div>
              {content.reason && (
                <div>
                  <span className="font-medium">理由:</span> {content.reason}
                </div>
              )}
            </div>
          )

        case 'leave':
          return (
            <div className="space-y-2 text-sm text-gray-700">
              <div>
                <span className="font-medium">休暇種別:</span>{' '}
                {content.type === 'paid'
                  ? '有給休暇'
                  : content.type === 'unpaid'
                  ? '無給休暇'
                  : '特別休暇'}
              </div>
              <div>
                <span className="font-medium">開始日:</span>{' '}
                {content.startDate
                  ? new Date(content.startDate).toLocaleDateString('ja-JP')
                  : '-'}
              </div>
              <div>
                <span className="font-medium">終了日:</span>{' '}
                {content.endDate ? new Date(content.endDate).toLocaleDateString('ja-JP') : '-'}
              </div>
              <div>
                <span className="font-medium">日数:</span> {content.days || '-'}日
              </div>
            </div>
          )

        case 'expense_advance':
          return (
            <div className="space-y-2 text-sm text-gray-700">
              <div>
                <span className="font-medium">日付:</span>{' '}
                {content.date ? new Date(content.date).toLocaleDateString('ja-JP') : '-'}
              </div>
              <div>
                <span className="font-medium">カテゴリ:</span>{' '}
                {content.category === 'meal'
                  ? '食事代'
                  : content.category === 'accommodation'
                  ? '宿泊費'
                  : content.category === 'supplies'
                  ? '備品・消耗品'
                  : content.category === 'entertainment'
                  ? '交際費'
                  : content.category || '-'}
              </div>
              <div>
                <span className="font-medium">金額:</span> ¥{content.amount?.toLocaleString() || '0'}
              </div>
              {content.description && (
                <div>
                  <span className="font-medium">詳細:</span> {content.description}
                </div>
              )}
              {content.files && content.files.length > 0 && (
                <div className="mt-3">
                  <div className="font-medium mb-2">添付ファイル ({content.files.length}件):</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {content.files.map((file: any, index: number) => (
                      <div key={index} className="border rounded p-2 bg-white">
                        {file.type?.startsWith('image/') ? (
                          <img
                            src={file.data}
                            alt={file.name}
                            className="w-full h-24 object-cover rounded mb-1"
                          />
                        ) : (
                          <div className="w-full h-24 bg-red-100 flex items-center justify-center rounded mb-1">
                            <span className="text-red-600 font-bold text-xs">PDF</span>
                          </div>
                        )}
                        <div className="text-xs text-gray-600 truncate">{file.name}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )

        case 'expense_transportation':
          return (
            <div className="space-y-2 text-sm text-gray-700">
              <div>
                <span className="font-medium">日付:</span>{' '}
                {content.date ? new Date(content.date).toLocaleDateString('ja-JP') : '-'}
              </div>
              {content.routes && content.routes.length > 0 && (
                <div className="mt-3">
                  <div className="font-medium mb-2">経路情報:</div>
                  <div className="space-y-2">
                    {content.routes.map((route: any, index: number) => (
                      <div key={index} className="p-2 bg-white rounded border">
                        <div className="font-medium text-xs mb-1">経路 {index + 1}</div>
                        <div>
                          <span className="font-medium">出発地:</span> {route.from || '-'}
                        </div>
                        <div>
                          <span className="font-medium">到着地:</span> {route.to || '-'}
                        </div>
                        {route.method && (
                          <div>
                            <span className="font-medium">交通手段:</span>{' '}
                            {route.method === 'train'
                              ? '電車'
                              : route.method === 'bus'
                              ? 'バス'
                              : route.method === 'taxi'
                              ? 'タクシー'
                              : route.method === 'car'
                              ? '車'
                              : route.method}
                          </div>
                        )}
                        <div>
                          <span className="font-medium">金額:</span> ¥{route.amount?.toLocaleString() || '0'}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 p-2 bg-blue-50 rounded">
                    <span className="font-medium">合計金額:</span>{' '}
                    <span className="text-lg font-bold text-blue-600">
                      ¥{content.totalAmount?.toLocaleString() || '0'}
                    </span>
                  </div>
                </div>
              )}
              {content.files && content.files.length > 0 && (
                <div className="mt-3">
                  <div className="font-medium mb-2">添付ファイル ({content.files.length}件):</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {content.files.map((file: any, index: number) => (
                      <div key={index} className="border rounded p-2 bg-white">
                        {file.type?.startsWith('image/') ? (
                          <img
                            src={file.data}
                            alt={file.name}
                            className="w-full h-24 object-cover rounded mb-1"
                          />
                        ) : (
                          <div className="w-full h-24 bg-red-100 flex items-center justify-center rounded mb-1">
                            <span className="text-red-600 font-bold text-xs">PDF</span>
                          </div>
                        )}
                        <div className="text-xs text-gray-600 truncate">{file.name}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )

        case 'shift_exchange':
          return (
            <div className="space-y-2 text-sm text-gray-700">
              <div>
                <span className="font-medium">自分のシフト日:</span>{' '}
                {content.myShiftDate
                  ? new Date(content.myShiftDate).toLocaleDateString('ja-JP')
                  : '-'}
              </div>
              <div>
                <span className="font-medium">交換相手の従業員ID:</span> {content.targetEmployeeId || '-'}
              </div>
              <div>
                <span className="font-medium">相手のシフト日:</span>{' '}
                {content.targetShiftDate
                  ? new Date(content.targetShiftDate).toLocaleDateString('ja-JP')
                  : '-'}
              </div>
            </div>
          )

        case 'shift_request':
          return (
            <div className="space-y-2 text-sm text-gray-700">
              <div>
                <span className="font-medium">希望日:</span>{' '}
                {content.date ? new Date(content.date).toLocaleDateString('ja-JP') : '-'}
              </div>
              <div>
                <span className="font-medium">希望開始時刻:</span> {content.startTime?.slice(0, 5) || '-'}
              </div>
              <div>
                <span className="font-medium">希望終了時刻:</span> {content.endTime?.slice(0, 5) || '-'}
              </div>
              {content.reason && (
                <div>
                  <span className="font-medium">理由:</span> {content.reason}
                </div>
              )}
            </div>
          )

        default:
          return (
            <div className="text-sm text-gray-700">
              <pre className="whitespace-pre-wrap">{JSON.stringify(content, null, 2)}</pre>
            </div>
          )
      }
    } catch (error) {
      return (
        <div className="text-sm text-red-600">
          申請内容の解析に失敗しました: {contentString}
        </div>
      )
    }
  }

  if (status === 'loading' || loading) {
    return <div className="p-8 text-center text-gray-900">読み込み中...</div>
  }

  const [showNewApplicationModal, setShowNewApplicationModal] = useState(false)
  const [showEditApplicationModal, setShowEditApplicationModal] = useState(false)
  const [editingApplication, setEditingApplication] = useState<Application | null>(null)
  const [employees, setEmployees] = useState<any[]>([])

  useEffect(() => {
    if (status === 'authenticated' && session?.user.role === 'admin') {
      fetchEmployees()
    }
  }, [status, session])

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/admin/employees')
      const data = await response.json()
      setEmployees(data.employees || [])
    } catch (err) {
      console.error('Failed to fetch employees:', err)
    }
  }

  const handleEdit = (app: Application) => {
    setEditingApplication(app)
    setShowEditApplicationModal(true)
  }

  return (
    <div className="p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">申請管理</h1>
          <button
            onClick={() => setShowNewApplicationModal(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 font-medium"
          >
            + 新規申請
          </button>
        </div>

        {/* 検索・フィルター */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-900">検索条件</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">申請日（開始）</label>
              <input
                type="date"
                value={searchFilters.startDate}
                onChange={(e) =>
                  setSearchFilters({ ...searchFilters, startDate: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">申請日（終了）</label>
              <input
                type="date"
                value={searchFilters.endDate}
                onChange={(e) =>
                  setSearchFilters({ ...searchFilters, endDate: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">申請タイプ</label>
              <select
                value={searchFilters.type}
                onChange={(e) =>
                  setSearchFilters({ ...searchFilters, type: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
              >
                <option value="">全て</option>
                <option value="attendance_correction">打刻修正</option>
                <option value="overtime">残業申請</option>
                <option value="leave">休暇申請</option>
                <option value="expense_advance">立替金精算</option>
                <option value="expense_transportation">交通費精算</option>
                <option value="shift_exchange">シフト交換</option>
                <option value="shift_request">シフト希望</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">カテゴリ（精算のみ）</label>
              <select
                value={searchFilters.category}
                onChange={(e) =>
                  setSearchFilters({ ...searchFilters, category: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
              >
                <option value="">全て</option>
                <option value="meal">食事代</option>
                <option value="accommodation">宿泊費</option>
                <option value="supplies">備品・消耗品</option>
                <option value="entertainment">交際費</option>
                <option value="other">その他</option>
              </select>
            </div>
          </div>
          <div className="flex gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">承認状態</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setFilterStatus('pending')}
                  className={`px-4 py-2 rounded font-medium text-sm ${
                    filterStatus === 'pending'
                      ? 'bg-yellow-500 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  承認待ち
                </button>
                <button
                  onClick={() => setFilterStatus('approved')}
                  className={`px-4 py-2 rounded font-medium text-sm ${
                    filterStatus === 'approved'
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  承認済み
                </button>
                <button
                  onClick={() => setFilterStatus('rejected')}
                  className={`px-4 py-2 rounded font-medium text-sm ${
                    filterStatus === 'rejected'
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  却下
                </button>
                <button
                  onClick={() => setFilterStatus('')}
                  className={`px-4 py-2 rounded font-medium text-sm ${
                    filterStatus === ''
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  全て
                </button>
              </div>
            </div>
            <button
              onClick={() => {
                setSearchFilters({ startDate: '', endDate: '', category: '', type: '' })
                setFilterStatus('pending')
              }}
              className="px-4 py-2 bg-gray-200 text-gray-900 rounded-md hover:bg-gray-300 font-medium"
            >
              リセット
            </button>
          </div>
        </div>

        {applications.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-6 text-center text-gray-700">
            申請がありません
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      申請日
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      申請タイプ
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      申請者
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      カテゴリ
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      金額
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      状態
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {applications.map((app) => {
                    const amount = getApplicationAmount(app)
                    const date = getApplicationDate(app)
                    const category = getApplicationCategory(app)
                    return (
                      <tr key={app.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">{date}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {APPLICATION_TYPES[app.type] || app.type}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {app.employee.name} ({app.employee.employeeNumber})
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {category || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                          {amount !== null ? `¥${amount.toLocaleString()}` : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              app.status === 'approved'
                                ? 'bg-green-100 text-green-800'
                                : app.status === 'rejected'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            {app.status === 'approved'
                              ? '承認済み'
                              : app.status === 'rejected'
                              ? '却下'
                              : '承認待ち'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleShowDetail(app)}
                              className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                            >
                              詳細
                            </button>
                            <button
                              onClick={() => handleEdit(app)}
                              className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
                            >
                              修正
                            </button>
                            {app.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => handleApprove(app.id)}
                                  className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
                                >
                                  承認
                                </button>
                                <button
                                  onClick={() => handleReject(app.id)}
                                  className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                                >
                                  却下
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 詳細モーダル */}
        {showDetailModal && selectedApplication && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {APPLICATION_TYPES[selectedApplication.type] || selectedApplication.type}
                  </h2>
                  <button
                    onClick={() => {
                      setShowDetailModal(false)
                      setSelectedApplication(null)
                    }}
                    className="text-gray-400 hover:text-gray-600 text-2xl"
                  >
                    ×
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="text-sm font-semibold text-gray-900 mb-1">申請者</div>
                    <div className="text-sm text-gray-700">
                      {selectedApplication.employee.name} ({selectedApplication.employee.employeeNumber})
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-semibold text-gray-900 mb-1">申請日</div>
                    <div className="text-sm text-gray-700">
                      {new Date(selectedApplication.createdAt).toLocaleString('ja-JP')}
                    </div>
                  </div>

                  {selectedApplication.title && (
                    <div>
                      <div className="text-sm font-semibold text-gray-900 mb-1">タイトル</div>
                      <div className="text-sm text-gray-700">{selectedApplication.title}</div>
                    </div>
                  )}

                  {selectedApplication.reason && (
                    <div>
                      <div className="text-sm font-semibold text-gray-900 mb-1">理由</div>
                      <div className="text-sm text-gray-700">{selectedApplication.reason}</div>
                    </div>
                  )}

                  {selectedApplication.content && (
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="text-sm font-semibold mb-3 text-gray-900">申請詳細</div>
                      {renderApplicationDetails(selectedApplication.type, selectedApplication.content)}
                    </div>
                  )}

                  {selectedApplication.status === 'pending' && (
                    <div className="flex gap-2 pt-4 border-t">
                      <button
                        onClick={() => {
                          handleApprove(selectedApplication.id)
                          setShowDetailModal(false)
                          setSelectedApplication(null)
                        }}
                        className="px-6 py-2 bg-green-500 text-white rounded hover:bg-green-600 font-medium"
                      >
                        承認
                      </button>
                      <button
                        onClick={() => {
                          handleReject(selectedApplication.id)
                          setShowDetailModal(false)
                          setSelectedApplication(null)
                        }}
                        className="px-6 py-2 bg-red-500 text-white rounded hover:bg-red-600 font-medium"
                      >
                        却下
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 新規申請モーダル */}
        {showNewApplicationModal && (
          <NewApplicationModal
            employees={employees}
            onClose={() => {
              setShowNewApplicationModal(false)
              fetchApplications()
            }}
          />
        )}

        {/* 申請修正モーダル */}
        {showEditApplicationModal && editingApplication && (
          <EditApplicationModal
            application={editingApplication}
            employees={employees}
            onClose={() => {
              setShowEditApplicationModal(false)
              setEditingApplication(null)
              fetchApplications()
            }}
          />
        )}
      </div>
    </div>
  )
}

// 新規申請モーダルコンポーネント
function NewApplicationModal({
  employees,
  onClose,
}: {
  employees: any[]
  onClose: () => void
}) {
  const [selectedType, setSelectedType] = useState<string>('')
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState<any>({
    title: '',
    reason: '',
    date: '',
    wakeUpTime: '',
    departureTime: '',
    clockIn: '',
    clockOut: '',
    overtimeDate: '',
    overtimeStartTime: '',
    overtimeEndTime: '',
    overtimeReason: '',
    leaveType: 'paid',
    leaveStartDate: '',
    leaveEndDate: '',
    leaveDays: 1,
    reimbursementDate: '',
    reimbursementCategory: '',
    reimbursementAmount: '',
    reimbursementDescription: '',
    reimbursementFiles: [],
    transportationDate: '',
    transportationRoutes: [{ from: '', to: '', amount: '', method: '' }],
    transportationFiles: [],
    exchangeMyShiftDate: '',
    exchangeTargetEmployeeId: '',
    exchangeTargetShiftDate: '',
    requestDate: '',
    requestStartTime: '',
    requestEndTime: '',
    requestReason: '',
  })

  const APPLICATION_TYPES = [
    { value: 'attendance_correction', label: '打刻修正' },
    { value: 'overtime', label: '残業申請' },
    { value: 'leave', label: '休暇申請' },
    { value: 'expense_advance', label: '立替金精算' },
    { value: 'expense_transportation', label: '交通費精算' },
    { value: 'shift_exchange', label: 'シフト交換' },
    { value: 'shift_request', label: 'シフト希望' },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!selectedEmployeeId) {
      setError('申請者を選択してください')
      setLoading(false)
      return
    }

    try {
      let content: any = {}
      let reason = formData.reason

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
          if (!formData.exchangeMyShiftDate || !formData.exchangeTargetEmployeeId || !formData.exchangeTargetShiftDate) {
            setError('自分のシフト日、交換相手、相手のシフト日を入力してください')
            setLoading(false)
            return
          }
          content = {
            myShiftDate: formData.exchangeMyShiftDate,
            targetEmployeeId: parseInt(formData.exchangeTargetEmployeeId),
            targetShiftDate: formData.exchangeTargetShiftDate,
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
          employeeId: selectedEmployeeId,
        }),
      })

      const data = await response.json()

      if (data.success) {
        onClose()
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

  if (!selectedType) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-900">新規申請</h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                申請者 <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
              >
                <option value="">選択してください</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.employeeNumber})
                  </option>
                ))}
              </select>
            </div>
            <h3 className="text-lg font-semibold mb-4 text-gray-900">申請タイプを選択</h3>
            <div className="grid grid-cols-2 gap-4">
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
          </div>
        </div>
      </div>
    )
  }

  const selectedTypeInfo = APPLICATION_TYPES.find((t) => t.value === selectedType)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {selectedTypeInfo?.label}
              </h2>
              <p className="text-sm text-gray-600 mt-1">申請者: {employees.find(e => e.id.toString() === selectedEmployeeId)?.name || '未選択'}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {!selectedEmployeeId && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  申請者 <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                >
                  <option value="">選択してください</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.employeeNumber})
                    </option>
                  ))}
                </select>
              </div>
            )}

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

            {/* 簡易フォーム（主要な申請タイプのみ） */}
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

            {selectedType === 'overtime' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    残業日 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.overtimeDate}
                    onChange={(e) => setFormData({ ...formData, overtimeDate: e.target.value })}
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
                      onChange={(e) => setFormData({ ...formData, overtimeStartTime: e.target.value })}
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
                      onChange={(e) => setFormData({ ...formData, overtimeEndTime: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">理由</label>
                  <textarea
                    value={formData.overtimeReason}
                    onChange={(e) => setFormData({ ...formData, overtimeReason: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    placeholder="残業の理由を記入してください"
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
                className="px-6 py-2 bg-blue-500 text-white rounded-md font-semibold hover:bg-blue-600 disabled:opacity-50"
              >
                {loading ? '送信中...' : '申請する'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedType('')
                  setFormData({
                    title: '',
                    reason: '',
                    date: '',
                    clockIn: '',
                    clockOut: '',
                    overtimeDate: '',
                    overtimeStartTime: '',
                    overtimeEndTime: '',
                    overtimeReason: '',
                  })
                }}
                className="px-6 py-2 bg-gray-200 text-gray-900 rounded-md hover:bg-gray-300 font-semibold"
              >
                戻る
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 bg-gray-200 text-gray-900 rounded-md hover:bg-gray-300 font-semibold"
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

// 申請修正モーダルコンポーネント
function EditApplicationModal({
  application,
  employees,
  onClose,
}: {
  application: Application
  employees: any[]
  onClose: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState<any>(() => {
    try {
      const content = JSON.parse(application.content)
      return {
        employeeId: application.employee.id.toString(),
        title: application.title || '',
        reason: application.reason || '',
        ...content,
      }
    } catch (e) {
      return {
        employeeId: application.employee.id.toString(),
        title: application.title || '',
        reason: application.reason || '',
      }
    }
  })

  useEffect(() => {
    try {
      const content = JSON.parse(application.content)
      setFormData({
        employeeId: application.employee.id.toString(),
        title: application.title || '',
        reason: application.reason || '',
        ...content,
      })
    } catch (e) {
      console.error('Failed to parse application content:', e)
      setFormData({
        employeeId: application.employee.id.toString(),
        title: application.title || '',
        reason: application.reason || '',
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [application.id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      let content: any = {}
      let reason = formData.reason

      switch (application.type) {
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
          break

        case 'overtime':
          if (!formData.date || !formData.startTime || !formData.endTime) {
            setError('日付、開始時刻、終了時刻を入力してください')
            setLoading(false)
            return
          }
          content = {
            date: formData.date,
            startTime: formData.startTime,
            endTime: formData.endTime,
            reason: formData.reason || '',
          }
          reason = formData.reason || '残業申請'
          break

        default:
          // その他のタイプは簡易対応
          try {
            content = JSON.parse(application.content)
          } catch {
            content = {}
          }
      }

      const response = await fetch(`/api/applications/${application.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: application.type,
          title: formData.title || null,
          content,
          reason,
          employeeId: formData.employeeId,
        }),
      })

      const data = await response.json()

      if (data.success) {
        onClose()
      } else {
        setError(data.error || '申請の修正に失敗しました')
      }
    } catch (err) {
      console.error('Failed to update application:', err)
      setError('申請の修正に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">申請修正</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                申請者 <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.employeeId}
                onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.employeeNumber})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                タイトル（任意）
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
              />
            </div>

            {application.type === 'attendance_correction' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    修正する日付 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.date || ''}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">出勤時刻</label>
                    <input
                      type="time"
                      value={formData.clockIn || ''}
                      onChange={(e) => setFormData({ ...formData, clockIn: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">退勤時刻</label>
                    <input
                      type="time"
                      value={formData.clockOut || ''}
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
                    value={formData.reason || ''}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    required
                    minLength={10}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>
              </>
            )}

            {application.type === 'overtime' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    残業日 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.date || ''}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
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
                      value={formData.startTime || ''}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
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
                      value={formData.endTime || ''}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">理由</label>
                  <textarea
                    value={formData.reason || ''}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
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
                className="px-6 py-2 bg-blue-500 text-white rounded-md font-semibold hover:bg-blue-600 disabled:opacity-50"
              >
                {loading ? '更新中...' : '更新する'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 bg-gray-200 text-gray-900 rounded-md hover:bg-gray-300 font-semibold"
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

