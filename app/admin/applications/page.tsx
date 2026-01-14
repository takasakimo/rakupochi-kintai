'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, getDay } from 'date-fns'

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
    department?: string | null
  }
}

const APPLICATION_TYPES: Record<string, string> = {
  attendance_correction: '打刻修正',
  overtime: '残業申請',
  leave: '休暇申請',
  expense_advance: '立替金精算',
  expense_transportation: '交通費精算',
  shift_request: 'シフト希望',
  employee_registration: '従業員登録申請',
}

export default function AdminApplicationsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('pending')
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showNewApplicationModal, setShowNewApplicationModal] = useState(false)
  const [showEditApplicationModal, setShowEditApplicationModal] = useState(false)
  const [editingApplication, setEditingApplication] = useState<Application | null>(null)
  const [employees, setEmployees] = useState<any[]>([])
  const [approvingApplicationId, setApprovingApplicationId] = useState<number | null>(null)
  const [employeeNumberInput, setEmployeeNumberInput] = useState<string>('')
  
  // ソート状態
  const [sortBy, setSortBy] = useState<'name' | null>(null)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  // 部署・店舗フィルター状態（シフト管理と同様の考え方）
  const [displayMode, setDisplayMode] = useState<'all' | 'department' | 'location'>('all')
  const [selectedDepartment, setSelectedDepartment] = useState<string>('')
  const [selectedLocation, setSelectedLocation] = useState<string>('')
  
  // 検索フィルター
  const [searchFilters, setSearchFilters] = useState({
    startDate: '',
    endDate: '',
    category: '',
    type: '',
    employee: '',
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
    if (status === 'authenticated') {
      const isAdmin = session?.user.role === 'admin'
      const isSuperAdmin = session?.user.role === 'super_admin' || 
                          session?.user.email === 'superadmin@rakupochi.com'
      
      if (isAdmin || (isSuperAdmin && session?.user.selectedCompanyId)) {
        fetchApplications()
        fetchEmployees()
      }
    }
  }, [status, session, filterStatus, searchFilters])

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/admin/employees')
      const data = await response.json()
      setEmployees(data.employees || [])
    } catch (err) {
      console.error('Failed to fetch employees:', err)
    }
  }

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

  const handleApprove = async (id: number, applicationType?: string) => {
    // 従業員登録申請の場合は従業員番号が必要
    if (applicationType === 'employee_registration') {
      const employeeNumber = prompt('従業員番号を入力してください:')
      if (!employeeNumber) {
        return
      }
      setEmployeeNumberInput(employeeNumber)
      setApprovingApplicationId(id)
      
      try {
        const response = await fetch(`/api/applications/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'approved', employeeNumber }),
        })

        const data = await response.json()
        if (data.success) {
          fetchApplications()
          setApprovingApplicationId(null)
          setEmployeeNumberInput('')
        } else {
          alert(data.error || '承認に失敗しました')
          setApprovingApplicationId(null)
          setEmployeeNumberInput('')
        }
      } catch (err) {
        console.error('Failed to approve application:', err)
        alert('承認に失敗しました')
        setApprovingApplicationId(null)
        setEmployeeNumberInput('')
      }
    } else {
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

  // 部署一覧（シフト管理と同様に従業員マスタから生成）
  const getDepartments = (): string[] => {
    const departments = new Set<string>()
    employees.forEach((emp: any) => {
      if (emp.department) {
        departments.add(emp.department)
      }
    })
    return Array.from(departments).sort()
  }

  // ソート処理
  const handleSort = (field: 'name') => {
    if (sortBy === field) {
      // 同じフィールドをクリックした場合は順序を切り替え
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      // 新しいフィールドをクリックした場合は昇順で開始
      setSortBy(field)
      setSortOrder('asc')
    }
  }

  // ソート・検索済み申請リストを取得
  const getSortedApplications = (): Application[] => {
    let filtered = applications

    // 申請者（氏名・社員番号）での検索
    if (searchFilters.employee && searchFilters.employee.trim() !== '') {
      const keyword = searchFilters.employee.trim().toLowerCase()
      filtered = filtered.filter((app) => {
        const name = app.employee.name?.toLowerCase() || ''
        const number = app.employee.employeeNumber?.toLowerCase() || ''
        return name.includes(keyword) || number.includes(keyword)
      })
    }

    // 部署フィルター（シフト管理のロジックに合わせて所属単位で絞り込み）
    if (displayMode === 'department' && selectedDepartment) {
      filtered = filtered.filter(
        (app) => app.employee.department === selectedDepartment
      )
    }

    if (!sortBy) {
      return filtered
    }

    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'name') {
        const nameA = a.employee.name.toLowerCase()
        const nameB = b.employee.name.toLowerCase()
        if (nameA < nameB) return sortOrder === 'asc' ? -1 : 1
        if (nameA > nameB) return sortOrder === 'asc' ? 1 : -1
        return 0
      }
      return 0
    })

    return sorted
  }

  // 詳細モーダルを開く
  const handleShowDetail = (app: Application) => {
    setSelectedApplication(app)
    setShowDetailModal(true)
  }

  // 申請詳細の表示
  const renderApplicationDetails = (application: Application) => {
    try {
      const content = JSON.parse(application.content)

      switch (application.type) {
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
          const leaveTypeMap: Record<string, string> = {
            paid: '有給休暇',
            unpaid: '無給休暇',
            special: '特別休暇',
            bereavement: '慶弔休暇',
            childcare: '育児休暇',
            nursing: '介護休暇',
            sick: '病気休暇',
            menstrual: '生理休暇',
            marriage: '結婚休暇',
            maternity: '出産休暇',
            paternity: 'パートナー出産休暇',
            refresh: 'リフレッシュ休暇',
            volunteer: 'ボランティア休暇',
          }
          return (
            <div className="space-y-2 text-sm text-gray-700">
              <div>
                <span className="font-medium">休暇種別:</span>{' '}
                {leaveTypeMap[content.type] || content.type}
              </div>
              {content.reason && (
                <div>
                  <span className="font-medium">理由:</span> {content.reason}
                </div>
              )}
              <div>
                <span className="font-medium">開始日:</span>{' '}
                {content.startDate
                  ? new Date(content.startDate).toLocaleDateString('ja-JP')
                  : '-'}
              </div>
              {content.dateMode === 'multiple' ? (
                <div>
                  <span className="font-medium">選択された日付:</span>{' '}
                  {content.selectedDates && content.selectedDates.length > 0
                    ? content.selectedDates
                        .map((date: string) => new Date(date).toLocaleDateString('ja-JP'))
                        .join(', ')
                    : '-'}
                  <div className="text-xs text-gray-500 mt-1">
                    ({content.selectedDates?.length || 0}日)
                  </div>
                </div>
              ) : (
                <>
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
                </>
              )}
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
                        <a
                          href={`/api/applications/${application.id}/files/${index}`}
                          className="mt-1 inline-block text-xs text-blue-600 hover:text-blue-800 underline"
                        >
                          ダウンロード
                        </a>
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
                        <a
                          href={`/api/applications/${application.id}/files/${index}`}
                          className="mt-1 inline-block text-xs text-blue-600 hover:text-blue-800 underline"
                        >
                          ダウンロード
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )

        case 'employee_registration':
          return (
            <div className="space-y-2 text-sm text-gray-700">
              <div>
                <span className="font-medium">氏名:</span> {content.name || '-'}
              </div>
              <div>
                <span className="font-medium">メールアドレス:</span> {content.email || '-'}
              </div>
              <div>
                <span className="font-medium">電話番号:</span> {content.phone || '-'}
              </div>
              <div>
                <span className="font-medium">住所:</span> {content.address || '-'}
              </div>
              {content.transportationRoutes && content.transportationRoutes.length > 0 && (
                <div className="mt-3">
                  <div className="font-medium mb-2">交通経路:</div>
                  <div className="space-y-2">
                    {content.transportationRoutes.map((route: any, index: number) => (
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
                            <span className="font-medium">交通手段:</span> {route.method}
                          </div>
                        )}
                        {route.amount && (
                          <div>
                            <span className="font-medium">金額:</span> ¥{parseInt(route.amount).toLocaleString()}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )

        case 'shift_request':
          // 新しい形式（selectedDates + timeSlots）と旧形式（date + startTime + endTime）の両方に対応
          const hasSelectedDates = content.selectedDates && Array.isArray(content.selectedDates)
          return (
            <div className="space-y-2 text-sm text-gray-700">
              {hasSelectedDates ? (
                <>
                  <div>
                    <span className="font-medium">希望日 ({content.selectedDates.length}日):</span>
                  </div>
                  {content.selectedDates.map((date: string, index: number) => {
                    const timeSlot = content.timeSlots?.[date]
                    return (
                      <div key={date} className="ml-4 p-2 bg-gray-50 rounded">
                        <div>
                          <span className="font-medium">日付 {index + 1}:</span>{' '}
                          {new Date(date).toLocaleDateString('ja-JP')}
                        </div>
                        {timeSlot && (
                          <>
                            <div>
                              <span className="font-medium">開始時刻:</span> {timeSlot.startTime?.slice(0, 5) || '-'}
                            </div>
                            <div>
                              <span className="font-medium">終了時刻:</span> {timeSlot.endTime?.slice(0, 5) || '-'}
                            </div>
                          </>
                        )}
                      </div>
                    )
                  })}
                </>
              ) : (
                <>
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
                </>
              )}
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
          申請内容の解析に失敗しました
        </div>
      )
    }
  }

  const handleEdit = (app: Application) => {
    setEditingApplication(app)
    setShowEditApplicationModal(true)
  }

  if (status === 'loading' || loading) {
    return <div className="p-8 text-center text-gray-900">読み込み中...</div>
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                申請者（氏名・社員番号）
              </label>
              <input
                type="text"
                value={searchFilters.employee}
                onChange={(e) =>
                  setSearchFilters({ ...searchFilters, employee: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                placeholder="例）山田 / 0001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                所属（部署・店舗）
              </label>
              <div className="flex gap-2">
                <select
                  value={displayMode}
                  onChange={(e) =>
                    setDisplayMode(e.target.value as 'all' | 'department' | 'location')
                  }
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                >
                  <option value="all">全て</option>
                  <option value="department">部署</option>
                  {/* 店舗モードは将来の拡張用。現状は部署での絞り込みを主に利用 */}
                  <option value="location">店舗</option>
                </select>
                {displayMode === 'department' && (
                  <select
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  >
                    <option value="">部署を選択</option>
                    {getDepartments().map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                )}
              </div>
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
                setSearchFilters({
                  startDate: '',
                  endDate: '',
                  category: '',
                  type: '',
                  employee: '',
                })
                setFilterStatus('pending')
                setDisplayMode('all')
                setSelectedDepartment('')
                setSelectedLocation('')
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
                      <button
                        onClick={() => handleSort('name')}
                        className="flex items-center gap-1 hover:text-blue-600"
                      >
                        申請者
                        {sortBy === 'name' && (
                          <span className="text-blue-600">
                            {sortOrder === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </button>
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
                  {getSortedApplications().map((app) => {
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
                          {app.type === 'employee_registration' ? (
                            (() => {
                              try {
                                const content = JSON.parse(app.content)
                                return content.name || '申請者情報なし'
                              } catch {
                                return '申請者情報なし'
                              }
                            })()
                          ) : (
                            app.employee.name + (app.employee.employeeNumber ? ` (${app.employee.employeeNumber})` : '')
                          )}
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
                                  onClick={() => handleApprove(app.id, app.type)}
                                  disabled={approvingApplicationId === app.id}
                                  className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 disabled:opacity-50"
                                >
                                  {approvingApplicationId === app.id ? '処理中...' : '承認'}
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
                      {selectedApplication.type === 'employee_registration' ? (
                        (() => {
                          try {
                            const content = JSON.parse(selectedApplication.content)
                            return content.name || '申請者情報なし'
                          } catch {
                            return '申請者情報なし'
                          }
                        })()
                      ) : (
                        selectedApplication.employee.name + (selectedApplication.employee.employeeNumber ? ` (${selectedApplication.employee.employeeNumber})` : '')
                      )}
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
                      {renderApplicationDetails(selectedApplication)}
                    </div>
                  )}

                  {selectedApplication.status === 'pending' && (
                    <div className="flex gap-2 pt-4 border-t">
                      {selectedApplication.type === 'employee_registration' && (
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            従業員番号 <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={employeeNumberInput}
                            onChange={(e) => setEmployeeNumberInput(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                            placeholder="従業員番号を入力"
                          />
                        </div>
                      )}
                      <button
                        onClick={() => {
                          if (selectedApplication.type === 'employee_registration' && !employeeNumberInput) {
                            alert('従業員番号を入力してください')
                            return
                          }
                          handleApprove(selectedApplication.id, selectedApplication.type)
                          if (selectedApplication.type !== 'employee_registration') {
                            setShowDetailModal(false)
                            setSelectedApplication(null)
                          }
                        }}
                        disabled={approvingApplicationId === selectedApplication.id}
                        className="px-6 py-2 bg-green-500 text-white rounded hover:bg-green-600 font-medium disabled:opacity-50"
                      >
                        {approvingApplicationId === selectedApplication.id ? '処理中...' : '承認'}
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
    leaveDateMode: 'range',
    leaveStartDate: '',
    leaveEndDate: '',
    leaveSelectedDates: [] as string[],
    reimbursementDate: '',
    reimbursementStoreName: '', // 店名（旧カテゴリ）
    reimbursementAmount: '',
    reimbursementReason: '', // 理由（旧詳細）
    reimbursementApproverId: '', // 承認者ID
    reimbursementNotes: '', // 備考
    reimbursementFiles: [],
    transportationDate: '',
    transportationRoutes: [{ from: '', to: '', amount: '', method: '' }],
    transportationFiles: [],
    requestSelectedDates: [] as string[],
    requestTimeSlots: {} as Record<string, { startTime: string; endTime: string }>,
    requestReason: '',
  })

  const APPLICATION_TYPES = [
    { value: 'attendance_correction', label: '打刻修正' },
    { value: 'overtime', label: '残業申請' },
    { value: 'leave', label: '休暇申請' },
    { value: 'expense_advance', label: '立替金精算' },
    { value: 'expense_transportation', label: '交通費精算' },
    { value: 'shift_request', label: 'シフト希望' },
  ]

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
            (date: string) => !formData.requestTimeSlots || !formData.requestTimeSlots[date] || 
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
          approverId: selectedType === 'expense_advance' ? formData.reimbursementApproverId || null : null,
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
                    {employees
                      .filter((emp) => emp.role === 'admin' || emp.role === 'super_admin')
                      .map((admin) => (
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
                                setFormData({ ...formData, transportationRoutes: newRoutes })
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
        leaveDateMode: content.dateMode || 'range',
        leaveSelectedDates: content.selectedDates || [],
        ...content,
      }
    } catch (e) {
      return {
        employeeId: application.employee.id.toString(),
        title: application.title || '',
        reason: application.reason || '',
        leaveDateMode: 'range',
        leaveSelectedDates: [],
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
        leaveDateMode: content.dateMode || 'range',
        leaveSelectedDates: content.selectedDates || [],
        ...content,
      })
    } catch (e) {
      console.error('Failed to parse application content:', e)
      setFormData({
        employeeId: application.employee.id.toString(),
        title: application.title || '',
        reason: application.reason || '',
        leaveDateMode: 'range',
        leaveSelectedDates: [],
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
                    修正理由 <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={formData.reason || ''}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    required
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

            {application.type === 'leave' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    休暇種別 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.leaveType || 'paid'}
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
                        value={formData.leaveStartDate || ''}
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
                        value={formData.leaveEndDate || ''}
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
                    value={formData.reason || ''}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    placeholder="休暇の理由を記入してください"
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


