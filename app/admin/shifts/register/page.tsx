'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'
import { isHolidayOrSunday } from '@/lib/holidays'

interface Shift {
  id?: number
  date: string
  startTime: string
  endTime: string
  breakMinutes: number
  notes: string | null
  status: string
  isPublicHoliday?: boolean
  workLocation?: string | null
  workType?: string | null
  workingHours?: string | null
  timeSlot?: string | null
  directDestination?: string | null
  approvalNumber?: string | null
  leavingLocation?: string | null
  employee?: {
    id: number
    name: string
    employeeNumber: string
    department: string | null
  }
}

interface Employee {
  id: number
  name: string
  employeeNumber: string
  department: string | null
}

interface ShiftRow {
  date: Date
  dayOfWeek: string
  isPublicHoliday: boolean
  workLocation: string
  workType: string
  workingHours: string
  timeSlot: string
  startTime: string
  endTime: string
  directDestination: string
  approvalNumber: string
  leavingLocation: string
  notes: string
}

export default function ShiftRegisterPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('')
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7)
  )
  const [loading, setLoading] = useState(true)
  const [shifts, setShifts] = useState<Shift[]>([])
  const [shiftRows, setShiftRows] = useState<ShiftRow[]>([])

  // フィルター用の状態
  const [displayMode, setDisplayMode] = useState<'all' | 'department' | 'location'>('all')
  const [selectedDepartment, setSelectedDepartment] = useState<string>('')
  const [selectedLocation, setSelectedLocation] = useState<string>('')

  // 基本設定
  const [defaultWorkHours, setDefaultWorkHours] = useState<string>('8') // 基本勤務種別（時間数）
  const [defaultStartTime, setDefaultStartTime] = useState<string>('10:00') // 基本勤務開始時間

  // 勤務場所の選択肢
  const workLocations = ['SB天白', 'その他']
  const workTypes = ['出勤', '公休']
  const timeSlots = ['-', '早番', '中番', '遅番']
  const workHourOptions = ['2', '3', '4', '5', '6', '7', '8'] // 2時間から8時間まで

  useEffect(() => {
    if (status === 'authenticated' && session?.user.role === 'admin') {
      fetchEmployees()
    }
  }, [status, session])

  useEffect(() => {
    if (status === 'authenticated' && session?.user.role === 'admin') {
      if (selectedEmployeeId) {
        fetchShifts()
      } else {
        setShiftRows([])
        setLoading(false)
      }
    }
  }, [status, session, selectedEmployeeId, selectedMonth])

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/admin/employees')
      const data = await response.json()
      setEmployees(data.employees || [])
    } catch (err) {
      console.error('Failed to fetch employees:', err)
    }
  }

  // フィルターされた従業員を取得
  const getFilteredEmployees = (): Employee[] => {
    let filtered = employees

    if (displayMode === 'department' && selectedDepartment) {
      filtered = filtered.filter(emp => emp.department === selectedDepartment)
    } else if (displayMode === 'location' && selectedLocation) {
      // 店舗でフィルターする場合は、シフトから該当店舗の従業員を取得
      const locationEmployeeIds = new Set(
        shifts
          .filter(shift => shift.workLocation === selectedLocation)
          .map(shift => shift.employee?.id)
          .filter((id): id is number => id !== undefined)
      )
      filtered = filtered.filter(emp => locationEmployeeIds.has(emp.id))
    }

    return filtered.sort((a, b) => a.employeeNumber.localeCompare(b.employeeNumber))
  }

  // 事業部の一覧を取得
  const getDepartments = (): string[] => {
    const departments = new Set<string>()
    employees.forEach(emp => {
      if (emp.department) {
        departments.add(emp.department)
      }
    })
    return Array.from(departments).sort()
  }

  // 店舗の一覧を取得
  const getLocations = (): string[] => {
    const locations = new Set<string>()
    shifts.forEach(shift => {
      if (shift.workLocation) {
        locations.add(shift.workLocation)
      }
    })
    // 既存のシフトがない場合でも、workLocationsから取得
    workLocations.forEach(loc => locations.add(loc))
    return Array.from(locations).sort()
  }

  // 表示モードが変更されたら従業員選択をリセット
  useEffect(() => {
    setSelectedEmployeeId('')
    setShiftRows([])
  }, [displayMode, selectedDepartment, selectedLocation])

  const fetchShifts = async () => {
    setLoading(true)
    try {
      const year = parseInt(selectedMonth.split('-')[0])
      const month = parseInt(selectedMonth.split('-')[1])
      const daysInMonth = new Date(year, month, 0).getDate()

      // 日付を文字列形式で送信（タイムゾーンの問題を回避）
      const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`
      const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`
      
      const params = new URLSearchParams()
      params.append('employee_id', selectedEmployeeId)
      params.append('start_date', startDateStr)
      params.append('end_date', endDateStr)

      const response = await fetch(`/api/admin/shifts?${params.toString()}`)
      const data = await response.json()
      setShifts(data.shifts || [])
      generateShiftRows(data.shifts || [], year, month)
    } catch (err) {
      console.error('Failed to fetch shifts:', err)
    } finally {
      setLoading(false)
    }
  }

  const generateShiftRows = (existingShifts: Shift[], year: number, month: number) => {
    const daysInMonth = new Date(year, month, 0).getDate()
    const rows: ShiftRow[] = []

    for (let day = 1; day <= daysInMonth; day++) {
      // ローカル時間で日付を作成（タイムゾーンの問題を回避）
      const date = new Date(year, month - 1, day, 12, 0, 0, 0)
      const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()]

      // 既存のシフトを検索
      // ターゲット日付を文字列形式で作成
      const targetDateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      
      const existingShift = existingShifts.find((s) => {
        // 日付文字列から直接比較（タイムゾーンの問題を回避）
        // APIからは既に文字列形式（YYYY-MM-DD）で返されているはず
        const shiftDateStr = typeof s.date === 'string' 
          ? s.date.split('T')[0] 
          : s.date
        return shiftDateStr === targetDateStr
      })

      // 祝日判定（既存のシフトで祝日として登録されている場合、または実際の祝日・日曜日の場合）
      const isHoliday = existingShift?.isPublicHoliday || isHolidayOrSunday(date)
      
      rows.push({
        date,
        dayOfWeek,
        isPublicHoliday: isHoliday,
        workLocation: existingShift?.workLocation || '',
        workType: existingShift?.workType || (isHoliday ? '公休' : '出勤'),
        workingHours: existingShift?.workingHours || '', // デフォルト値なし
        timeSlot: existingShift?.timeSlot || '-',
        startTime: existingShift?.startTime && typeof existingShift.startTime === 'string'
          ? existingShift.startTime.slice(0, 5)
          : (isHoliday ? '' : ''),
        endTime: existingShift?.endTime && typeof existingShift.endTime === 'string'
          ? existingShift.endTime.slice(0, 5)
          : (isHoliday ? '' : ''),
        directDestination: existingShift?.directDestination || '',
        approvalNumber: existingShift?.approvalNumber || '',
        leavingLocation: existingShift?.leavingLocation || '',
        notes: existingShift?.notes || '',
      })
    }

    setShiftRows(rows)
  }

  // 休憩時間を計算する関数（5時間未満は休憩なし、5時間以上は1時間）
  const calculateBreakHours = (workHours: number): number => {
    return workHours >= 5 ? 1 : 0
  }

  // 基本設定を適用する関数
  const applyDefaultSettings = () => {
    if (!defaultWorkHours || !defaultStartTime) return

    const newRows = shiftRows.map((row) => {
      // 出勤の場合のみ適用
      if (row.workType === '出勤' && !row.isPublicHoliday) {
        const [hours, minutes] = defaultStartTime.split(':').map(Number)
        const workHours = parseInt(defaultWorkHours)
        const breakHours = calculateBreakHours(workHours) // 休憩時間を計算

        // 終了時間を計算（開始時間 + 勤務時間 + 休憩時間）
        const startDate = new Date(2000, 0, 1, hours, minutes)
        const endDate = new Date(
          startDate.getTime() + (workHours + breakHours) * 60 * 60 * 1000
        )

        const calculatedEndTime = `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`

        return {
          ...row,
          workingHours: `${workHours}:00`,
          startTime: defaultStartTime,
          endTime: calculatedEndTime,
        }
      }
      return row
    })

    setShiftRows(newRows)
  }

  const handleRowChange = (
    index: number,
    field: keyof ShiftRow,
    value: string | boolean
  ) => {
    const newRows = [...shiftRows]
    newRows[index] = {
      ...newRows[index],
      [field]: value,
    }

    // 公休が選択された場合、勤務種別も自動的に「公休」に
    if (field === 'isPublicHoliday' && value === true) {
      newRows[index].workType = '公休'
      newRows[index].workLocation = ''
      newRows[index].workingHours = ''
      newRows[index].startTime = ''
      newRows[index].endTime = '' // 終了時間もクリア
    } else if (field === 'isPublicHoliday' && value === false) {
      // 公休を解除した場合、勤務種別を「出勤」に変更し、基本設定を適用
      newRows[index].workType = '出勤'
      if (defaultWorkHours && defaultStartTime) {
        const [hours, minutes] = defaultStartTime.split(':').map(Number)
        const workHours = parseInt(defaultWorkHours)
        const breakHours = calculateBreakHours(workHours) // 休憩時間を計算

        const startDate = new Date(2000, 0, 1, hours, minutes)
        const endDate = new Date(
          startDate.getTime() + (workHours + breakHours) * 60 * 60 * 1000
        )

        const calculatedEndTime = `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`

        newRows[index].workingHours = `${workHours}:00`
        newRows[index].startTime = defaultStartTime
        newRows[index].endTime = calculatedEndTime
      } else {
        // 基本設定がない場合は空にする
        newRows[index].workingHours = ''
        newRows[index].startTime = ''
        newRows[index].endTime = ''
      }
    } else if (field === 'workType' && value === '公休') {
      newRows[index].isPublicHoliday = true
      newRows[index].workLocation = ''
      newRows[index].workingHours = ''
      newRows[index].startTime = ''
      newRows[index].endTime = '' // 終了時間もクリア
    } else if (field === 'workType' && value === '出勤') {
      newRows[index].isPublicHoliday = false
      // 出勤に変更した場合、基本設定を適用
      if (defaultWorkHours && defaultStartTime) {
        const [hours, minutes] = defaultStartTime.split(':').map(Number)
        const workHours = parseInt(defaultWorkHours)
        const breakHours = calculateBreakHours(workHours) // 休憩時間を計算

        const startDate = new Date(2000, 0, 1, hours, minutes)
        const endDate = new Date(
          startDate.getTime() + (workHours + breakHours) * 60 * 60 * 1000
        )

        const calculatedEndTime = `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`

        newRows[index].workingHours = `${workHours}:00`
        newRows[index].startTime = defaultStartTime
        newRows[index].endTime = calculatedEndTime
      }
    }

    setShiftRows(newRows)
  }

  const handleSave = async () => {
    if (!selectedEmployeeId) {
      alert('従業員を選択してください')
      return
    }

    try {
      const shiftsToSave = shiftRows
        .filter((row) => row.workType === '出勤' || row.isPublicHoliday)
        .map((row) => {
          // 日付をローカル時間で取得（タイムゾーンの問題を回避）
          const year = row.date.getFullYear()
          const month = row.date.getMonth() + 1
          const day = row.date.getDate()
          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          
          const baseShift: any = {
            employeeId: parseInt(selectedEmployeeId),
            date: dateStr,
            isPublicHoliday: row.isPublicHoliday,
            workLocation: row.workLocation || null,
            workType: row.workType || null,
            workingHours: row.workingHours || null,
            timeSlot: row.timeSlot || null,
            directDestination: row.directDestination || null,
            approvalNumber: row.approvalNumber || null,
            leavingLocation: row.leavingLocation || null,
            notes: row.notes || null,
          }

          if (row.workType === '出勤' && !row.isPublicHoliday && row.startTime && row.endTime) {
            // 出勤の場合、開始時刻と終了時刻を使用
            const workHours = row.workingHours ? parseInt(row.workingHours.split(':')[0]) : 8
            baseShift.startTime = row.startTime
            baseShift.endTime = row.endTime
            baseShift.breakMinutes = calculateBreakHours(workHours) * 60 // 休憩時間を計算（分単位）
          } else {
            // 公休の場合
            baseShift.startTime = '00:00'
            baseShift.endTime = '00:00'
            baseShift.breakMinutes = 0
          }

          return baseShift
        })

      const response = await fetch('/api/admin/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shifts: shiftsToSave }),
      })

      const data = await response.json()
      if (data.success) {
        alert('シフトを登録しました')
        fetchShifts()
      } else {
        alert('シフトの登録に失敗しました')
      }
    } catch (err) {
      console.error('Failed to save shifts:', err)
      alert('シフトの登録に失敗しました')
    }
  }

  const getRowClassName = (row: ShiftRow) => {
    // 祝日または日曜日は赤色
    if (isHolidayOrSunday(row.date)) return 'bg-red-50 text-red-700' // 祝日または日曜日
    if (row.date.getDay() === 6) return 'bg-blue-50' // 土曜日
    return 'bg-white'
  }

  if (status === 'loading' || loading) {
    return <div className="p-8 text-center text-gray-900">読み込み中...</div>
  }

  // ビュー切り替えタブ
  const renderViewTabs = () => (
    <div className="bg-white rounded-lg shadow-md p-4 mb-6">
      <div className="flex gap-2 border-b">
        <button
          onClick={() => router.push('/admin/shifts/manage')}
          className={`px-6 py-3 font-medium transition ${
            pathname === '/admin/shifts/manage'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          📋 シフト管理
        </button>
        <button
          onClick={() => router.push('/admin/shifts/register')}
          className={`px-6 py-3 font-medium transition ${
            pathname === '/admin/shifts/register'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          📝 シフト登録
        </button>
        <button
          onClick={() => router.push('/admin/shifts/manage?view=timetable')}
          className={`px-6 py-3 font-medium transition ${
            pathname?.includes('timetable')
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          🗓️ タイムテーブル
        </button>
      </div>
    </div>
  )

  return (
    <div className="p-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-gray-900">シフト管理</h1>

        {/* ビュー切り替えタブ */}
        {renderViewTabs()}

        {/* 警告バナー */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-red-800">
            ※休暇は計画的有給のみ設定できます。その他の休暇についてはワークフローより申請してください。
          </p>
        </div>

        {/* フィルター */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                表示モード
              </label>
              <select
                value={displayMode}
                onChange={(e) => {
                  setDisplayMode(e.target.value as 'all' | 'department' | 'location')
                  setSelectedDepartment('')
                  setSelectedLocation('')
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
              >
                <option value="all">全体</option>
                <option value="department">事業部</option>
                <option value="location">店舗</option>
              </select>
            </div>
            {displayMode === 'department' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  事業部
                </label>
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                >
                  <option value="">選択してください</option>
                  {getDepartments().map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {displayMode === 'location' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  店舗
                </label>
                <select
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                >
                  <option value="">選択してください</option>
                  {getLocations().map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                従業員 *
              </label>
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                disabled={displayMode === 'department' && !selectedDepartment || displayMode === 'location' && !selectedLocation}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="">選択してください</option>
                {getFilteredEmployees().map((emp) => (
                  <option key={emp.id} value={emp.id.toString()}>
                    {emp.name} ({emp.employeeNumber})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                表示月
              </label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                基本勤務種別（時間）
              </label>
              <select
                value={defaultWorkHours}
                onChange={(e) => setDefaultWorkHours(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
              >
                {workHourOptions.map((hours) => (
                  <option key={hours} value={hours}>
                    {hours}時間
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                基本勤務開始時間
              </label>
              <input
                type="time"
                value={defaultStartTime}
                onChange={(e) => setDefaultStartTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={applyDefaultSettings}
                className="w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 font-medium"
              >
                基本設定を適用
              </button>
            </div>
          </div>
          <div className="text-sm text-gray-600">
            ※基本設定を適用すると、出勤の行に選択した勤務種別と開始時間が自動で設定されます（5時間未満は休憩なし、5時間以上は休憩1時間）
          </div>
        </div>

        {/* シフトテーブル */}
        {selectedEmployeeId && shiftRows.length > 0 && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-900 border-r">
                      日付
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-900 border-r">
                      曜日
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-900 border-r">
                      公休
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-900 border-r">
                      勤務場所
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-900 border-r">
                      勤務種別
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-900 border-r">
                      勤務時間
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-900 border-r">
                      時間帯選択
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-900 border-r">
                      開始時間
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-900 border-r">
                      終了時間
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-900 border-r">
                      直行先
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-900 border-r">
                      稟議番号
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-900 border-r">
                      退勤場所
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-900">
                      備考
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shiftRows.map((row, index) => {
                    const isHolidayOrSun = isHolidayOrSunday(row.date)
                    return (
                      <tr key={index} className={getRowClassName(row)}>
                        <td className={`px-3 py-2 text-sm border-r border-b ${isHolidayOrSun ? 'text-red-700' : 'text-gray-900'}`}>
                          {row.date.getMonth() + 1}/{row.date.getDate()}
                        </td>
                        <td className={`px-3 py-2 text-sm border-r border-b ${isHolidayOrSun ? 'text-red-700' : 'text-gray-900'}`}>
                          {row.dayOfWeek}
                        </td>
                      <td className="px-3 py-2 border-r border-b">
                        <input
                          type="checkbox"
                          checked={row.isPublicHoliday}
                          onChange={(e) =>
                            handleRowChange(index, 'isPublicHoliday', e.target.checked)
                          }
                          className="w-4 h-4"
                        />
                      </td>
                      <td className="px-3 py-2 border-r border-b">
                        <select
                          value={row.workLocation}
                          onChange={(e) =>
                            handleRowChange(index, 'workLocation', e.target.value)
                          }
                          disabled={row.isPublicHoliday}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white disabled:bg-gray-100"
                        >
                          <option value="">-</option>
                          {workLocations.map((loc) => (
                            <option key={loc} value={loc}>
                              {loc}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 border-r border-b">
                        <select
                          value={row.workType}
                          onChange={(e) =>
                            handleRowChange(index, 'workType', e.target.value)
                          }
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white"
                        >
                          {workTypes.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 border-r border-b">
                        <input
                          type="text"
                          value={row.workingHours}
                          onChange={(e) =>
                            handleRowChange(index, 'workingHours', e.target.value)
                          }
                          disabled={row.isPublicHoliday}
                          placeholder="-"
                          readOnly
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-gray-50 disabled:bg-gray-100"
                        />
                      </td>
                      <td className="px-3 py-2 border-r border-b">
                        <select
                          value={row.timeSlot}
                          onChange={(e) =>
                            handleRowChange(index, 'timeSlot', e.target.value)
                          }
                          disabled={row.isPublicHoliday}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white disabled:bg-gray-100"
                        >
                          {timeSlots.map((slot) => (
                            <option key={slot} value={slot}>
                              {slot}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 border-r border-b">
                        <input
                          type="time"
                          value={row.startTime}
                          onChange={(e) => {
                            const newStartTime = e.target.value
                            handleRowChange(index, 'startTime', newStartTime)
                            
                            // 開始時間が変更された場合、終了時間を再計算
                            if (newStartTime && row.workingHours && !row.isPublicHoliday) {
                              const [hours, minutes] = newStartTime.split(':').map(Number)
                              const workHours = parseInt(row.workingHours.split(':')[0])
                              const breakHours = calculateBreakHours(workHours) // 休憩時間を計算
                              
                              const startDate = new Date(2000, 0, 1, hours, minutes)
                              const endDate = new Date(
                                startDate.getTime() + (workHours + breakHours) * 60 * 60 * 1000
                              )
                              
                              const newRows = [...shiftRows]
                              newRows[index].endTime = `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`
                              setShiftRows(newRows)
                            }
                          }}
                          disabled={row.isPublicHoliday}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white disabled:bg-gray-100"
                        />
                      </td>
                      <td className="px-3 py-2 border-r border-b">
                        <input
                          type="time"
                          value={row.endTime}
                          onChange={(e) =>
                            handleRowChange(index, 'endTime', e.target.value)
                          }
                          disabled={row.isPublicHoliday}
                          readOnly
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-gray-50 disabled:bg-gray-100"
                        />
                      </td>
                      <td className="px-3 py-2 border-r border-b">
                        <input
                          type="text"
                          value={row.directDestination}
                          onChange={(e) =>
                            handleRowChange(index, 'directDestination', e.target.value)
                          }
                          disabled={row.isPublicHoliday}
                          placeholder="-"
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white disabled:bg-gray-100"
                        />
                      </td>
                      <td className="px-3 py-2 border-r border-b">
                        <input
                          type="text"
                          value={row.approvalNumber}
                          onChange={(e) =>
                            handleRowChange(index, 'approvalNumber', e.target.value)
                          }
                          disabled={row.isPublicHoliday}
                          placeholder="-"
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white disabled:bg-gray-100"
                        />
                      </td>
                      <td className="px-3 py-2 border-r border-b">
                        <input
                          type="text"
                          value={row.leavingLocation}
                          onChange={(e) =>
                            handleRowChange(index, 'leavingLocation', e.target.value)
                          }
                          disabled={row.isPublicHoliday}
                          placeholder="-"
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white disabled:bg-gray-100"
                        />
                      </td>
                      <td className="px-3 py-2 border-b">
                        <input
                          type="text"
                          value={row.notes}
                          onChange={(e) =>
                            handleRowChange(index, 'notes', e.target.value)
                          }
                          placeholder="-"
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white"
                        />
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 登録ボタン */}
        {selectedEmployeeId && shiftRows.length > 0 && (
          <div className="flex justify-center mb-6">
            <button
              onClick={handleSave}
              className="px-8 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium text-lg"
            >
              登録する
            </button>
          </div>
        )}

        {!selectedEmployeeId && (
          <div className="bg-white rounded-lg shadow-md p-6 text-center text-gray-700">
            従業員を選択してください
          </div>
        )}
      </div>
    </div>
  )
}

