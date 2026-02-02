'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'
import { isHolidayOrSunday } from '@/lib/holidays'

interface Shift {
  id: number
  date: string
  startTime: string | null
  endTime: string | null
  breakMinutes: number
  notes: string | null
  status: string
  isPublicHoliday: boolean
  workLocation: string | null
  workType: string | null
  workingHours: string | null
  timeSlot: string | null
  directDestination: string | null
  approvalNumber: string | null
  leavingLocation: string | null
  employee: {
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

interface BreakPeriod {
  startTime: string
  endTime: string
}


type ViewMode = 'list' | 'register'

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

export default function ShiftManagePage() {
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
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [editingShift, setEditingShift] = useState<Shift | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [newShift, setNewShift] = useState<Partial<Shift>>({
    date: '',
    startTime: '',
    endTime: '',
    breakMinutes: 0,
    notes: '',
    workType: '',
    isPublicHoliday: false,
  })
  
  // フィルター用の状態
  const [displayMode, setDisplayMode] = useState<'all' | 'department' | 'location'>('all')
  const [selectedDepartment, setSelectedDepartment] = useState<string>('')
  const [selectedLocation, setSelectedLocation] = useState<string>('')
  
  // 一括登録用の状態
  const [shiftRows, setShiftRows] = useState<ShiftRow[]>([])
  const [defaultWorkHours, setDefaultWorkHours] = useState<string>('8')
  const [defaultStartTime, setDefaultStartTime] = useState<string>('10:00')
  const workLocations = ['SB天白', 'その他']
  const workTypes = ['出勤', '公休', '有給休暇']
  const timeSlots = ['-', '早番', '中番', '遅番']
  const workHourOptions = ['2', '3', '4', '5', '6', '7', '8']
  
  // 一括反映用の状態
  const [selectedShiftIds, setSelectedShiftIds] = useState<Set<number>>(new Set())
  const [bulkUpdateData, setBulkUpdateData] = useState<{
    startTime?: string
    endTime?: string
    breakMinutes?: number
    workLocation?: string
    workType?: string
    timeSlot?: string
    workingHours?: string
    directDestination?: string
    approvalNumber?: string
    leavingLocation?: string
    notes?: string
    isPublicHoliday?: boolean
  }>({})

  useEffect(() => {
    if (status === 'authenticated') {
      fetchShifts()
    }
  }, [status, selectedMonth, viewMode])

  // フィルターされたシフトを取得（従業員側では自分自身のシフトのみ）
  const getFilteredShifts = (): Shift[] => {
    let filtered = shifts

    if (displayMode === 'location' && selectedLocation) {
      filtered = filtered.filter(shift => shift.workLocation === selectedLocation)
    }

    return filtered
  }

  // 店舗の一覧を取得
  const getLocations = (): string[] => {
    const locations = new Set<string>()
    shifts.forEach(shift => {
      if (shift.workLocation) {
        locations.add(shift.workLocation)
      }
    })
    return Array.from(locations).sort()
  }

  const fetchShifts = async () => {
    setLoading(true)
    try {
      const year = parseInt(selectedMonth.split('-')[0])
      const month = parseInt(selectedMonth.split('-')[1])
      const daysInMonth = new Date(year, month, 0).getDate()

      const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`
      const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`
      
      const params = new URLSearchParams()
      params.append('start_date', startDateStr)
      params.append('end_date', endDateStr)

      const response = await fetch(`/api/employee/shifts?${params.toString()}`)
      const data = await response.json()
      setShifts(data.shifts || [])
      
      if (viewMode === 'register') {
        generateShiftRows(data.shifts || [], year, month)
      }
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
      const date = new Date(year, month - 1, day, 12, 0, 0, 0)
      const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()]
      const targetDateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      
      const existingShift = existingShifts.find((s) => {
        const shiftDateStr = typeof s.date === 'string' ? s.date.split('T')[0] : s.date
        return shiftDateStr === targetDateStr
      })

      const isHoliday = existingShift?.isPublicHoliday || isHolidayOrSunday(date)
      
      rows.push({
        date,
        dayOfWeek,
        isPublicHoliday: isHoliday,
        workLocation: existingShift?.workLocation || '',
        workType: existingShift?.workType || (isHoliday ? '公休' : '出勤'),
        workingHours: existingShift?.workingHours || '',
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

  const calculateBreakHours = (workHours: number): number => {
    return workHours >= 5 ? 1 : 0
  }

  const applyDefaultSettings = () => {
    if (!defaultWorkHours || !defaultStartTime) return

    const newRows = shiftRows.map((row) => {
      if (row.workType === '出勤' && !row.isPublicHoliday) {
        const [hours, minutes] = defaultStartTime.split(':').map(Number)
        const workHours = parseInt(defaultWorkHours)
        const breakHours = calculateBreakHours(workHours)

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

    if (field === 'isPublicHoliday' && value === true) {
      newRows[index].workType = '公休'
      newRows[index].workLocation = ''
      newRows[index].workingHours = ''
      newRows[index].startTime = ''
      newRows[index].endTime = ''
    } else if (field === 'isPublicHoliday' && value === false) {
      newRows[index].workType = '出勤'
      if (defaultWorkHours && defaultStartTime) {
        const [hours, minutes] = defaultStartTime.split(':').map(Number)
        const workHours = parseInt(defaultWorkHours)
        const breakHours = calculateBreakHours(workHours)

        const startDate = new Date(2000, 0, 1, hours, minutes)
        const endDate = new Date(
          startDate.getTime() + (workHours + breakHours) * 60 * 60 * 1000
        )

        const calculatedEndTime = `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`

        newRows[index].workingHours = `${workHours}:00`
        newRows[index].startTime = defaultStartTime
        newRows[index].endTime = calculatedEndTime
      }
    } else if (field === 'workType' && value === '公休') {
      newRows[index].isPublicHoliday = true
      newRows[index].workLocation = ''
      newRows[index].workingHours = ''
      newRows[index].startTime = ''
      newRows[index].endTime = ''
    } else if (field === 'workType' && value === '有給休暇') {
      newRows[index].isPublicHoliday = false
      newRows[index].workLocation = ''
      newRows[index].workingHours = ''
      newRows[index].startTime = ''
      newRows[index].endTime = ''
    } else if (field === 'workType' && value === '出勤') {
      newRows[index].isPublicHoliday = false
      if (defaultWorkHours && defaultStartTime) {
        const [hours, minutes] = defaultStartTime.split(':').map(Number)
        const workHours = parseInt(defaultWorkHours)
        const breakHours = calculateBreakHours(workHours)

        const startDate = new Date(2000, 0, 1, hours, minutes)
        const endDate = new Date(
          startDate.getTime() + (workHours + breakHours) * 60 * 60 * 1000
        )

        const calculatedEndTime = `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`

        newRows[index].workingHours = `${workHours}:00`
        newRows[index].startTime = defaultStartTime
        newRows[index].endTime = calculatedEndTime
      }
    } else if (field === 'startTime' && typeof value === 'string') {
      const newStartTime = value
      if (newStartTime && newRows[index].workingHours && !newRows[index].isPublicHoliday) {
        const [hours, minutes] = newStartTime.split(':').map(Number)
        const workHours = parseInt(newRows[index].workingHours.split(':')[0])
        const breakHours = calculateBreakHours(workHours)
        
        const startDate = new Date(2000, 0, 1, hours, minutes)
        const endDate = new Date(
          startDate.getTime() + (workHours + breakHours) * 60 * 60 * 1000
        )
        
        newRows[index].endTime = `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`
      }
    }

    setShiftRows(newRows)
  }

  const handleBulkSave = async () => {
    try {
      const shiftsToSave = shiftRows
        .filter((row) => row.workType === '出勤' || row.workType === '有給休暇' || row.isPublicHoliday)
        .map((row) => {
          const year = row.date.getFullYear()
          const month = row.date.getMonth() + 1
          const day = row.date.getDate()
          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          
          const baseShift: any = {
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
            const workHours = row.workingHours ? parseInt(row.workingHours.split(':')[0]) : 8
            baseShift.startTime = row.startTime
            baseShift.endTime = row.endTime
            baseShift.breakMinutes = calculateBreakHours(workHours) * 60
          } else if (row.workType === '有給休暇') {
            baseShift.startTime = '00:00'
            baseShift.endTime = '00:00'
            baseShift.breakMinutes = 0
          } else {
            baseShift.startTime = '00:00'
            baseShift.endTime = '00:00'
            baseShift.breakMinutes = 0
          }

          return baseShift
        })

      const response = await fetch('/api/employee/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shifts: shiftsToSave }),
      })

      const data = await response.json()
      if (data.success) {
        alert('シフトを登録しました')
        await fetchShifts()
        setViewMode('list')
      } else {
        alert(data.error || 'シフトの登録に失敗しました')
      }
    } catch (err) {
      console.error('Failed to save shifts:', err)
      alert('シフトの登録に失敗しました')
    }
  }

  const getRowClassName = (row: ShiftRow) => {
    if (isHolidayOrSunday(row.date)) return 'bg-red-50 text-red-700'
    if (row.date.getDay() === 6) return 'bg-blue-50'
    return 'bg-white'
  }

  // ローカル時間で日付文字列を生成する関数
  const formatLocalDateString = (date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }




  if (status === 'loading' || loading) {
    return <div className="p-8 text-center text-gray-900">読み込み中...</div>
  }

  // ビュー切り替えタブ
  const renderViewTabs = () => (
    <div className="bg-white rounded-lg shadow-md p-4 mb-6">
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setViewMode('list')}
          className={`px-6 py-3 font-medium transition ${
            viewMode === 'list'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          シフト管理
        </button>
        <button
          onClick={() => setViewMode('register')}
          className={`px-6 py-3 font-medium transition ${
            viewMode === 'register'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          一括登録
        </button>
      </div>
    </div>
  )

  // 一括更新処理
  const handleBulkUpdate = async () => {
    console.log('handleBulkUpdate called', { 
      selectedShiftIds: Array.from(selectedShiftIds), 
      selectedShiftIdsSize: selectedShiftIds.size,
      bulkUpdateData 
    })
    
    if (selectedShiftIds.size === 0) {
      alert('反映するシフトを選択してください')
      return
    }
    
    const updateData: any = {}
    
    // 公休の設定を先に確認
    const isPublicHoliday = bulkUpdateData.isPublicHoliday
    
    if (bulkUpdateData.workLocation !== undefined && bulkUpdateData.workLocation !== '') {
      updateData.workLocation = bulkUpdateData.workLocation
    }
    if (bulkUpdateData.workType !== undefined && bulkUpdateData.workType !== '') {
      updateData.workType = bulkUpdateData.workType
    }
    if (bulkUpdateData.workingHours !== undefined && bulkUpdateData.workingHours !== '') {
      updateData.workingHours = bulkUpdateData.workingHours
    }
    if (bulkUpdateData.timeSlot !== undefined && bulkUpdateData.timeSlot !== '') {
      updateData.timeSlot = bulkUpdateData.timeSlot
    }
    if (bulkUpdateData.directDestination !== undefined && bulkUpdateData.directDestination !== '') {
      updateData.directDestination = bulkUpdateData.directDestination
    }
    if (bulkUpdateData.approvalNumber !== undefined && bulkUpdateData.approvalNumber !== '') {
      updateData.approvalNumber = bulkUpdateData.approvalNumber
    }
    if (bulkUpdateData.leavingLocation !== undefined && bulkUpdateData.leavingLocation !== '') {
      updateData.leavingLocation = bulkUpdateData.leavingLocation
    }
    if (bulkUpdateData.notes !== undefined && bulkUpdateData.notes !== '') {
      updateData.notes = bulkUpdateData.notes
    }
    if (bulkUpdateData.isPublicHoliday !== undefined) {
      updateData.isPublicHoliday = bulkUpdateData.isPublicHoliday
    }
    
    // 公休の場合は時間関連をnull/0にする
    if (isPublicHoliday === true) {
      updateData.startTime = null
      updateData.endTime = null
      updateData.breakMinutes = 0
      updateData.workingHours = null
      updateData.timeSlot = null
    } else {
      // 公休でない場合のみ時間関連を設定
      if (bulkUpdateData.startTime && bulkUpdateData.startTime !== '') {
        updateData.startTime = bulkUpdateData.startTime
      }
      if (bulkUpdateData.endTime && bulkUpdateData.endTime !== '') {
        updateData.endTime = bulkUpdateData.endTime
      }
      if (bulkUpdateData.breakMinutes !== undefined && bulkUpdateData.breakMinutes !== null) {
        updateData.breakMinutes = bulkUpdateData.breakMinutes
      }
    }
    
    console.log('Update data:', updateData)
    console.log('Update data keys:', Object.keys(updateData))
    
    if (Object.keys(updateData).length === 0) {
      alert('反映する項目を入力してください')
      return
    }
    
    if (!confirm(`選択した${selectedShiftIds.size}件のシフトに反映しますか？`)) {
      return
    }
    
    try {
      console.log('Starting bulk update for', selectedShiftIds.size, 'shifts')
      const shiftIds = Array.from(selectedShiftIds)
      console.log('Shift IDs to update:', shiftIds)
      
      const updatePromises = shiftIds.map(async (shiftId) => {
        try {
          console.log('Updating shift', shiftId, 'with data', updateData)
          const response = await fetch(`/api/employee/shifts/${shiftId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData),
          })
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
            console.error('Failed to update shift', shiftId, ':', errorData)
            throw new Error(errorData.error || `HTTP ${response.status}`)
          }
          
          const data = await response.json()
          console.log('Successfully updated shift', shiftId, ':', data)
          return { success: true, shiftId, data }
        } catch (err) {
          console.error('Error updating shift', shiftId, ':', err)
          return { success: false, shiftId, error: err instanceof Error ? err.message : String(err) }
        }
      })
      
      const results = await Promise.all(updatePromises)
      const failed = results.filter(r => !r.success)
      
      console.log('Bulk update results:', { total: results.length, success: results.length - failed.length, failed: failed.length })
      
      if (failed.length > 0) {
        console.error('Failed updates:', failed)
        alert(`${failed.length}件のシフトの更新に失敗しました。詳細はコンソールを確認してください。`)
      } else {
        alert(`${selectedShiftIds.size}件のシフトを更新しました`)
        setSelectedShiftIds(new Set())
        setBulkUpdateData({})
        await fetchShifts()
      }
    } catch (err) {
      console.error('Failed to bulk update shifts:', err)
      alert('一括更新に失敗しました: ' + (err instanceof Error ? err.message : String(err)))
    }
  }

  const handleCreate = () => {
    setIsCreating(true)
    setNewShift({
      date: '',
      startTime: '',
      endTime: '',
      breakMinutes: 0,
      notes: '',
      workType: '',
      isPublicHoliday: false,
    })
  }

  // シフト管理（テーブル表示）
  const renderListView = () => {
    const filteredShifts = getFilteredShifts()
    
    const handleEdit = (shift: Shift) => {
      setEditingShift({ ...shift })
    }
    
    const handleSelectShift = (shiftId: number, checked: boolean) => {
      setSelectedShiftIds(prev => {
        const newSet = new Set(prev)
        if (checked) {
          newSet.add(shiftId)
        } else {
          newSet.delete(shiftId)
        }
        console.log('Selected shifts:', Array.from(newSet))
        return newSet
      })
    }
    
    const handleSelectAll = (checked: boolean) => {
      if (checked) {
        setSelectedShiftIds(new Set(filteredShifts.map(s => s.id)))
      } else {
        setSelectedShiftIds(new Set())
      }
    }

    const handleUpdate = async () => {
      if (!editingShift) return

      try {
        // 公休の場合は時間関連のフィールドをnullにする
        const updateData: any = {
          date: editingShift.date,
          notes: editingShift.notes || null,
          isPublicHoliday: editingShift.isPublicHoliday,
          workLocation: editingShift.workLocation || null,
          workType: editingShift.workType || null,
          directDestination: editingShift.directDestination || null,
          approvalNumber: editingShift.approvalNumber || null,
          leavingLocation: editingShift.leavingLocation || null,
        }

        if (editingShift.isPublicHoliday) {
          // 公休の場合は時間関連をnull/0にする（明示的に送信）
          updateData.startTime = null
          updateData.endTime = null
          updateData.breakMinutes = 0
          updateData.workingHours = null
          updateData.timeSlot = null
        } else {
          // 公休でない場合は時間を設定
          updateData.startTime = editingShift.startTime || null
          updateData.endTime = editingShift.endTime || null
          updateData.breakMinutes = editingShift.breakMinutes || 0
          updateData.workingHours = editingShift.workingHours || null
          updateData.timeSlot = editingShift.timeSlot || null
        }

        const response = await fetch(`/api/employee/shifts/${editingShift.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          console.error('Update shift error:', errorData)
          alert(errorData.error || `シフトの更新に失敗しました (${response.status})`)
          return
        }

        const data = await response.json()
        if (data.success) {
          alert('シフトを更新しました')
          setEditingShift(null)
          fetchShifts()
        } else {
          alert(data.error || 'シフトの更新に失敗しました')
        }
      } catch (err) {
        console.error('Failed to update shift:', err)
        alert('シフトの更新に失敗しました: ' + (err instanceof Error ? err.message : String(err)))
      }
    }

    const handleDelete = async (id: number) => {
      if (!confirm('このシフトを削除しますか？有給休暇の場合は残数が戻されます。')) return

      try {
        const response = await fetch(`/api/employee/shifts/${id}`, {
          method: 'DELETE',
        })

        const data = await response.json()
        if (data.success) {
          alert('シフトを削除しました')
          fetchShifts()
        } else {
          alert(data.error || 'シフトの削除に失敗しました')
        }
      } catch (err) {
        console.error('Failed to delete shift:', err)
        alert('シフトの削除に失敗しました')
      }
    }

    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr)
      const month = date.getMonth() + 1
      const day = date.getDate()
      const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()]
      return `${month}/${day} (${dayOfWeek})`
    }

    const formatTime = (timeStr: string | null, isPublicHoliday?: boolean) => {
      if (isPublicHoliday) return ''
      if (!timeStr || timeStr === null || timeStr === '') return ''
      if (typeof timeStr === 'string' && timeStr.length >= 5) {
        // 00:00の場合は空文字列を返す
        if (timeStr.slice(0, 5) === '00:00') return ''
        return timeStr.slice(0, 5)
      }
      return timeStr
    }

    const formatNotes = (notes: string | null) => {
      if (!notes) return '-'
      
      // JSON形式の休憩時間情報を除外
      try {
        const parsed = JSON.parse(notes)
        // breakStartTimeが含まれている場合は、originalNotesがあればそれを表示
        if (parsed.breakStartTime && parsed.originalNotes) {
          return parsed.originalNotes || '-'
        }
        // breakStartTimeが含まれているがoriginalNotesがない場合は空欄
        if (parsed.breakStartTime) {
          return '-'
        }
        // JSON形式だがbreakStartTimeがない場合はそのまま表示（通常のJSONデータ）
        return notes
      } catch {
        // JSON形式でない場合はそのまま表示
        return notes
      }
    }

    const handleCancelCreate = () => {
      setIsCreating(false)
      setNewShift({
        date: '',
        startTime: '',
        endTime: '',
        breakMinutes: 0,
        notes: '',
        workType: '',
        isPublicHoliday: false,
      })
    }

    const handleSaveNew = async () => {
      if (!newShift.date) {
        alert('日付を入力してください')
        return
      }

      // 公休・有給休暇でない場合は時間が必要
      if (!newShift.isPublicHoliday && newShift.workType !== '公休' && newShift.workType !== '有給休暇') {
        if (!newShift.startTime || !newShift.endTime) {
          alert('開始時刻と終了時刻を入力してください（公休・有給休暇以外の場合）')
          return
        }
      }

      try {
        const createData: any = {
          date: newShift.date,
          notes: newShift.notes || null,
          isPublicHoliday: newShift.isPublicHoliday || false,
          workType: newShift.workType || null,
        }

        if (newShift.isPublicHoliday || newShift.workType === '公休' || newShift.workType === '有給休暇') {
          // 公休・有給休暇の場合は時間関連をnull/0にする
          createData.startTime = null
          createData.endTime = null
          createData.breakMinutes = 0
        } else {
          // 公休でない場合は時間を設定
          createData.startTime = newShift.startTime || null
          createData.endTime = newShift.endTime || null
          createData.breakMinutes = newShift.breakMinutes || 0
        }

        const response = await fetch('/api/employee/shifts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(createData),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          alert(errorData.error || `シフトの作成に失敗しました (${response.status})`)
          return
        }

        const data = await response.json()
        if (data.success) {
          alert('シフトを作成しました')
          setIsCreating(false)
          setNewShift({
            date: '',
            startTime: '',
            endTime: '',
            breakMinutes: 0,
            notes: '',
            workType: '',
            isPublicHoliday: false,
          })
          fetchShifts()
        }
      } catch (err) {
        console.error('Failed to create shift:', err)
        alert('シフトの作成に失敗しました')
      }
    }

    return (
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {/* 新規作成フォーム */}
        {isCreating && (
          <div className="bg-blue-50 border-b border-blue-200 p-4">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">新規シフト作成</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  日付 *
                </label>
                <input
                  type="date"
                  value={newShift.date || ''}
                  onChange={(e) => setNewShift({ ...newShift, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  勤務種別
                </label>
                <select
                  value={newShift.workType || ''}
                  onChange={(e) => {
                    const workType = e.target.value || null
                    setNewShift({
                      ...newShift,
                      workType,
                      isPublicHoliday: workType === '公休' ? true : false,
                    })
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                >
                  <option value="">通常</option>
                  <option value="公休">公休</option>
                  <option value="有給休暇">有給休暇</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  開始時刻 {!newShift.isPublicHoliday && newShift.workType !== '公休' && newShift.workType !== '有給休暇' && '*'}
                </label>
                <input
                  type="time"
                  value={newShift.startTime || ''}
                  onChange={(e) => setNewShift({ ...newShift, startTime: e.target.value })}
                  disabled={newShift.isPublicHoliday || newShift.workType === '公休' || newShift.workType === '有給休暇'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white disabled:bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  終了時刻 {!newShift.isPublicHoliday && newShift.workType !== '公休' && newShift.workType !== '有給休暇' && '*'}
                </label>
                <input
                  type="time"
                  value={newShift.endTime || ''}
                  onChange={(e) => setNewShift({ ...newShift, endTime: e.target.value })}
                  disabled={newShift.isPublicHoliday || newShift.workType === '公休' || newShift.workType === '有給休暇'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white disabled:bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  休憩時間（分）
                </label>
                <input
                  type="number"
                  value={newShift.breakMinutes || 0}
                  onChange={(e) => setNewShift({ ...newShift, breakMinutes: parseInt(e.target.value) || 0 })}
                  disabled={newShift.isPublicHoliday || newShift.workType === '公休' || newShift.workType === '有給休暇'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white disabled:bg-gray-100"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  備考
                </label>
                <input
                  type="text"
                  value={newShift.notes || ''}
                  onChange={(e) => setNewShift({ ...newShift, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  placeholder="備考"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={handleSaveNew}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 font-medium"
              >
                作成
              </button>
              <button
                onClick={handleCancelCreate}
                className="px-4 py-2 bg-gray-300 text-gray-900 rounded-md hover:bg-gray-400 font-medium"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}
        {/* 一括反映UI */}
        {selectedShiftIds.size > 0 && (
          <div className="bg-blue-50 border-b border-blue-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-gray-900">
                選択中: {selectedShiftIds.size}件
              </div>
              <button
                onClick={() => {
                  setSelectedShiftIds(new Set())
                  setBulkUpdateData({})
                }}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                選択解除
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
                  <label className="block text-xs text-gray-700 mb-1">勤務場所</label>
              <input
                    type="text"
                    value={bulkUpdateData.workLocation || ''}
                    onChange={(e) => setBulkUpdateData({ ...bulkUpdateData, workLocation: e.target.value || undefined })}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white"
                    placeholder="変更なし"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-700 mb-1">勤務種別</label>
                  <select
                    value={bulkUpdateData.workType || ''}
                onChange={(e) => {
                      const workType = e.target.value || undefined
                      const isPublicHoliday = workType === '公休'
                      setBulkUpdateData({
                        ...bulkUpdateData,
                        workType,
                        // 公休にした場合は時間関連のフィールドをクリア
                        ...(isPublicHoliday && {
                          startTime: undefined,
                          endTime: undefined,
                          breakMinutes: undefined,
                          workingHours: undefined,
                          timeSlot: undefined,
                        }),
                      })
                    }}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white"
                  >
                    <option value="">変更なし</option>
                    <option value="出勤">出勤</option>
                    <option value="公休">公休</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-700 mb-1">勤務時間</label>
                  <input
                    type="text"
                    value={bulkUpdateData.workingHours || ''}
                    onChange={(e) => setBulkUpdateData({ ...bulkUpdateData, workingHours: e.target.value || undefined })}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white"
                    placeholder="変更なし"
              />
            </div>
            <div>
                  <label className="block text-xs text-gray-700 mb-1">時間帯</label>
                  <select
                    value={bulkUpdateData.timeSlot || ''}
                    onChange={(e) => setBulkUpdateData({ ...bulkUpdateData, timeSlot: e.target.value || undefined })}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white"
                  >
                    <option value="">変更なし</option>
                    <option value="早番">早番</option>
                    <option value="中番">中番</option>
                    <option value="遅番">遅番</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-gray-700 mb-1">開始時間</label>
              <input
                    type="time"
                    value={bulkUpdateData.startTime || ''}
                    onChange={(e) => setBulkUpdateData({ ...bulkUpdateData, startTime: e.target.value || undefined })}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white"
              />
            </div>
            <div>
                  <label className="block text-xs text-gray-700 mb-1">終了時間</label>
              <input
                    type="time"
                    value={bulkUpdateData.endTime || ''}
                    onChange={(e) => setBulkUpdateData({ ...bulkUpdateData, endTime: e.target.value || undefined })}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-700 mb-1">休憩時間（分）</label>
                  <input
                    type="number"
                    value={bulkUpdateData.breakMinutes !== undefined ? bulkUpdateData.breakMinutes : ''}
                    onChange={(e) => setBulkUpdateData({ ...bulkUpdateData, breakMinutes: e.target.value ? parseInt(e.target.value) : undefined })}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white"
                    placeholder="変更なし"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-700 mb-1">公休</label>
                  <select
                    value={bulkUpdateData.isPublicHoliday === undefined ? '' : bulkUpdateData.isPublicHoliday ? 'true' : 'false'}
                onChange={(e) => {
                      const isPublicHoliday = e.target.value === '' ? undefined : e.target.value === 'true'
                      setBulkUpdateData({
                        ...bulkUpdateData,
                        isPublicHoliday,
                        // 公休にした場合は時間関連のフィールドをクリア
                        ...(isPublicHoliday === true && {
                          startTime: undefined,
                          endTime: undefined,
                          breakMinutes: undefined,
                          workingHours: undefined,
                          timeSlot: undefined,
                        }),
                      })
                    }}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white"
                  >
                    <option value="">変更なし</option>
                    <option value="false">出勤</option>
                    <option value="true">公休</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-gray-700 mb-1">直行先</label>
                  <input
                    type="text"
                    value={bulkUpdateData.directDestination || ''}
                    onChange={(e) => setBulkUpdateData({ ...bulkUpdateData, directDestination: e.target.value || undefined })}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white"
                    placeholder="変更なし"
              />
            </div>
                <div>
                  <label className="block text-xs text-gray-700 mb-1">稟議番号</label>
                  <input
                    type="text"
                    value={bulkUpdateData.approvalNumber || ''}
                    onChange={(e) => setBulkUpdateData({ ...bulkUpdateData, approvalNumber: e.target.value || undefined })}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white"
                    placeholder="変更なし"
                  />
          </div>
                <div>
                  <label className="block text-xs text-gray-700 mb-1">退勤場所</label>
                  <input
                    type="text"
                    value={bulkUpdateData.leavingLocation || ''}
                    onChange={(e) => setBulkUpdateData({ ...bulkUpdateData, leavingLocation: e.target.value || undefined })}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white"
                    placeholder="変更なし"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-700 mb-1">備考</label>
                  <input
                    type="text"
                    value={bulkUpdateData.notes || ''}
                    onChange={(e) => setBulkUpdateData({ ...bulkUpdateData, notes: e.target.value || undefined })}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white"
                    placeholder="変更なし"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
            <button
                  onClick={() => {
                    setSelectedShiftIds(new Set())
                    setBulkUpdateData({})
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-900 rounded text-sm font-medium hover:bg-gray-300"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleBulkUpdate}
                  className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
                >
                  一括反映
            </button>
          </div>
        </div>
          </div>
        )}
        
        {/* 編集モーダル */}
        {editingShift && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setEditingShift(null)
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setEditingShift(null)
              }
            }}
            tabIndex={-1}
          >
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-blue-600 text-white p-4 rounded-t-lg flex items-center justify-between">
                <h2 className="text-xl font-bold">
                  {editingShift.employee?.name || 'シフト'} のシフト編集
                </h2>
                <button
                  onClick={() => setEditingShift(null)}
                  className="text-white hover:text-gray-200 text-2xl font-bold"
                >
                  ×
                </button>
              </div>
              
              <div className="p-6 space-y-6">
                {/* 基本情報 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">日付</label>
                    <input
                      type="date"
                      value={editingShift.date.split('T')[0]}
                      onChange={(e) =>
                        setEditingShift({
                          ...editingShift,
                          date: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
              </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">従業員</label>
                    <div className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700">
                      {editingShift.employee?.name || '-'}
                    </div>
                  </div>
                </div>

                {/* 公休チェックボックス */}
                <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingShift.isPublicHoliday}
                      onChange={(e) => {
                        const isPublicHoliday = e.target.checked
                        setEditingShift({
                          ...editingShift,
                          isPublicHoliday,
                          // 公休にした場合は勤務種別も「公休」に変更し、時間関連のフィールドをクリア
                          ...(isPublicHoliday && {
                            workType: '公休',
                            startTime: null,
                            endTime: null,
                            breakMinutes: 0,
                            workingHours: null,
                            timeSlot: null,
                          }),
                          // 公休を解除した場合は勤務種別を「出勤」に変更
                          ...(!isPublicHoliday && editingShift.workType === '公休' && {
                            workType: '出勤',
                          }),
                        })
                      }}
                      className="w-5 h-5 text-yellow-600 border-gray-300 rounded focus:ring-yellow-500"
                    />
                    <span className="text-lg font-bold text-gray-900">公休</span>
                  </label>
                </div>

                {/* 勤務時間（重要フィールド） */}
                {!editingShift.isPublicHoliday && (
                  <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">勤務時間</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">開始時間</label>
                        <input
                          type="time"
                          value={formatTime(editingShift.startTime)}
                          onChange={(e) =>
                            setEditingShift({
                              ...editingShift,
                              startTime: e.target.value,
                            })
                          }
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">終了時間</label>
                        <input
                          type="time"
                          value={formatTime(editingShift.endTime)}
                          onChange={(e) =>
                            setEditingShift({
                              ...editingShift,
                              endTime: e.target.value,
                            })
                          }
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">休憩時間（分）</label>
                        <input
                          type="number"
                          value={editingShift.breakMinutes}
                          onChange={(e) =>
                            setEditingShift({
                              ...editingShift,
                              breakMinutes: parseInt(e.target.value) || 0,
                            })
                          }
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="60"
                        />
              </div>
            </div>
          </div>
        )}

                {/* その他の情報 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">勤務場所</label>
                    <input
                      type="text"
                      value={editingShift.workLocation || ''}
                      onChange={(e) =>
                        setEditingShift({
                          ...editingShift,
                          workLocation: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="SB天白"
                    />
            </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">勤務種別</label>
                    <select
                      value={editingShift.workType || '出勤'}
                      onChange={(e) => {
                        const workType = e.target.value
                        const isPublicHoliday = workType === '公休'
                        setEditingShift({
                          ...editingShift,
                          workType,
                          isPublicHoliday,
                          // 公休にした場合は時間関連のフィールドをクリア
                          ...(isPublicHoliday && {
                            startTime: null,
                            endTime: null,
                            breakMinutes: 0,
                            workingHours: null,
                            timeSlot: null,
                          }),
                        })
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="出勤">出勤</option>
                      <option value="公休">公休</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">勤務時間</label>
                    <input
                      type="text"
                      value={editingShift.workingHours || ''}
                      onChange={(e) =>
                        setEditingShift({
                          ...editingShift,
                          workingHours: e.target.value,
                        })
                      }
                      disabled={editingShift.isPublicHoliday}
                      className={`w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        editingShift.isPublicHoliday ? 'opacity-50 cursor-not-allowed bg-gray-100' : ''
                      }`}
                      placeholder="8:00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">時間帯</label>
                    <select
                      value={editingShift.timeSlot || '-'}
                      onChange={(e) =>
                        setEditingShift({
                          ...editingShift,
                          timeSlot: e.target.value,
                        })
                      }
                      disabled={editingShift.isPublicHoliday}
                      className={`w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        editingShift.isPublicHoliday ? 'opacity-50 cursor-not-allowed bg-gray-100' : ''
                      }`}
                    >
                      <option value="-">-</option>
                      <option value="早番">早番</option>
                      <option value="中番">中番</option>
                      <option value="遅番">遅番</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">直行先</label>
                    <input
                      type="text"
                      value={editingShift.directDestination || ''}
                      onChange={(e) =>
                        setEditingShift({
                          ...editingShift,
                          directDestination: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="-"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">稟議番号</label>
                    <input
                      type="text"
                      value={editingShift.approvalNumber || ''}
                      onChange={(e) =>
                        setEditingShift({
                          ...editingShift,
                          approvalNumber: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="-"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">退勤場所</label>
                    <input
                      type="text"
                      value={editingShift.leavingLocation || ''}
                      onChange={(e) =>
                        setEditingShift({
                          ...editingShift,
                          leavingLocation: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="-"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">備考</label>
                    <textarea
                      value={editingShift.notes || ''}
                      onChange={(e) =>
                        setEditingShift({
                          ...editingShift,
                          notes: e.target.value,
                        })
                      }
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="-"
                    />
                  </div>
                </div>

                {/* ボタン */}
                <div className="flex justify-end gap-4 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => setEditingShift(null)}
                    className="px-6 py-3 bg-gray-200 text-gray-900 rounded-lg text-base font-medium hover:bg-gray-300 transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleUpdate}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg text-base font-medium hover:bg-blue-700 transition-colors"
                  >
                    保存
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {filteredShifts.length === 0 ? (
          <div className="p-6 text-center text-gray-700">シフトがありません</div>
        ) : (
          <div>
            <div className="overflow-x-auto overflow-y-auto max-h-[70vh]">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-900">日付</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-900">
                    <input
                      type="checkbox"
                      checked={selectedShiftIds.size > 0 && selectedShiftIds.size === filteredShifts.length}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="w-3 h-3"
                    />
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-900">公休</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-900">勤務場所</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-900">勤務種別</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-900">勤務時間</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-900">時間帯</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-900">開始時間</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-900">終了時間</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-900">休憩</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-900">直行先</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-900">稟議番号</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-900">退勤場所</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-900">備考</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-900">操作</th>
                </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                {filteredShifts.map((shift) => {
                  const shiftDate = new Date(shift.date)
                  const isHolidayOrSun = isHolidayOrSunday(shiftDate)
                  const rowClassName = isHolidayOrSun ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'
                  
                  return (
                  <tr key={shift.id} className={rowClassName}>
                    <>
                        <td className={`px-2 py-2 text-xs ${isHolidayOrSun ? 'text-red-700 font-semibold' : 'text-gray-900'}`}>{formatDate(shift.date)}</td>
                        <td className="px-2 py-2">
                          <input
                            type="checkbox"
                            checked={selectedShiftIds.has(shift.id)}
                            onChange={(e) => handleSelectShift(shift.id, e.target.checked)}
                            className="w-3 h-3"
                          />
                      </td>
                        <td className="px-2 py-2 text-xs text-gray-900">{shift.isPublicHoliday ? '✓' : '-'}</td>
                        <td className="px-2 py-2 text-xs text-gray-900">{shift.workLocation || '-'}</td>
                        <td className="px-2 py-2 text-xs text-gray-900">{shift.workType || '-'}</td>
                        <td className="px-2 py-2 text-xs text-gray-900">{shift.isPublicHoliday ? '-' : (shift.workingHours || '-')}</td>
                        <td className="px-2 py-2 text-xs text-gray-900">{shift.isPublicHoliday ? '-' : (shift.timeSlot || '-')}</td>
                        <td className="px-2 py-2 text-xs text-gray-900">{formatTime(shift.startTime, shift.isPublicHoliday)}</td>
                        <td className="px-2 py-2 text-xs text-gray-900">{formatTime(shift.endTime, shift.isPublicHoliday)}</td>
                        <td className="px-2 py-2 text-xs text-gray-900">{shift.isPublicHoliday ? '-' : `${shift.breakMinutes}分`}</td>
                        <td className="px-2 py-2 text-xs text-gray-900">{shift.directDestination || '-'}</td>
                        <td className="px-2 py-2 text-xs text-gray-900">{shift.approvalNumber || '-'}</td>
                        <td className="px-2 py-2 text-xs text-gray-900">{shift.leavingLocation || '-'}</td>
                        <td className="px-2 py-2 text-xs text-gray-900">{formatNotes(shift.notes)}</td>
                        <td className="px-2 py-2">
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleEdit(shift)}
                              className="px-2 py-0.5 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 whitespace-nowrap"
                            >
                              編集
                            </button>
                            <button
                              onClick={() => handleDelete(shift.id)}
                              className="px-2 py-0.5 bg-red-500 text-white rounded text-xs hover:bg-red-600 whitespace-nowrap"
                            >
                              削除
                            </button>
                          </div>
                      </td>
                    </>
                  </tr>
                )
              })}
              </tbody>
            </table>
          </div>
          </div>
        )}
      </div>
    )
  }



  const year = parseInt(selectedMonth.split('-')[0])
  const month = parseInt(selectedMonth.split('-')[1])

  return (
    <div className="p-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-gray-900">シフト管理</h1>

        {/* ビュー切り替えタブ */}
        {renderViewTabs()}

        {/* フィルター */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
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
                <option value="location">店舗ごと</option>
              </select>
            </div>
            {displayMode === 'location' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  店舗
                </label>
                <select
                  value={selectedLocation}
                  onChange={(e) => {
                    setSelectedLocation(e.target.value)
                  }}
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
                表示月
              </label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleCreate}
                className="w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 font-medium"
              >
                新規作成
              </button>
            </div>
          </div>
        </div>

        {/* ビュー表示 */}
        {viewMode === 'list' && renderListView()}
        {viewMode === 'register' && renderRegisterView()}
      </div>
    </div>
  )

  // 一括登録ビュー
  function renderRegisterView() {
  const year = parseInt(selectedMonth.split('-')[0])
  const month = parseInt(selectedMonth.split('-')[1])

  return (
    <>
      {/* 基本設定 */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
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
      {shiftRows.length > 0 && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-900 border-r">日付</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-900 border-r">曜日</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-900 border-r">公休</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-900 border-r">勤務場所</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-900 border-r">勤務種別</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-900 border-r">勤務時間</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-900 border-r">時間帯選択</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-900 border-r">開始時間</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-900 border-r">終了時間</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-900 border-r">直行先</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-900 border-r">稟議番号</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-900 border-r">退勤場所</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-900">備考</th>
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
                          onChange={(e) => handleRowChange(index, 'isPublicHoliday', e.target.checked)}
                          className="w-4 h-4"
                        />
                      </td>
                      <td className="px-3 py-2 border-r border-b">
                        <select
                          value={row.workLocation}
                          onChange={(e) => handleRowChange(index, 'workLocation', e.target.value)}
                          disabled={row.isPublicHoliday || row.workType === '有給休暇'}
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
                          onChange={(e) => handleRowChange(index, 'workType', e.target.value)}
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
                          onChange={(e) => handleRowChange(index, 'workingHours', e.target.value)}
                          disabled={row.isPublicHoliday || row.workType === '有給休暇'}
                          placeholder="-"
                          readOnly
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-gray-50 disabled:bg-gray-100"
                        />
                      </td>
                      <td className="px-3 py-2 border-r border-b">
                        <select
                          value={row.timeSlot}
                          onChange={(e) => handleRowChange(index, 'timeSlot', e.target.value)}
                          disabled={row.isPublicHoliday || row.workType === '有給休暇'}
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
                        {row.isPublicHoliday || row.workType === '有給休暇' ? (
                          <div className="w-full px-2 py-1 text-sm text-gray-900 text-center">-</div>
                        ) : (
                          <input
                            type="time"
                            value={row.startTime || ''}
                            onChange={(e) => handleRowChange(index, 'startTime', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white"
                          />
                        )}
                      </td>
                      <td className="px-3 py-2 border-r border-b">
                        {row.isPublicHoliday || row.workType === '有給休暇' ? (
                          <div className="w-full px-2 py-1 text-sm text-gray-900 text-center">-</div>
                        ) : (
                          <input
                            type="time"
                            value={row.endTime || ''}
                            onChange={(e) => handleRowChange(index, 'endTime', e.target.value)}
                            readOnly
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-gray-50"
                          />
                        )}
                      </td>
                      <td className="px-3 py-2 border-r border-b">
                        <input
                          type="text"
                          value={row.directDestination}
                          onChange={(e) => handleRowChange(index, 'directDestination', e.target.value)}
                          disabled={row.isPublicHoliday || row.workType === '有給休暇'}
                          placeholder="-"
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white disabled:bg-gray-100"
                        />
                      </td>
                      <td className="px-3 py-2 border-r border-b">
                        <input
                          type="text"
                          value={row.approvalNumber}
                          onChange={(e) => handleRowChange(index, 'approvalNumber', e.target.value)}
                          disabled={row.isPublicHoliday || row.workType === '有給休暇'}
                          placeholder="-"
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white disabled:bg-gray-100"
                        />
                      </td>
                      <td className="px-3 py-2 border-r border-b">
                        <input
                          type="text"
                          value={row.leavingLocation}
                          onChange={(e) => handleRowChange(index, 'leavingLocation', e.target.value)}
                          disabled={row.isPublicHoliday || row.workType === '有給休暇'}
                          placeholder="-"
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white disabled:bg-gray-100"
                        />
                      </td>
                      <td className="px-3 py-2 border-b">
                        <input
                          type="text"
                          value={row.notes}
                          onChange={(e) => handleRowChange(index, 'notes', e.target.value)}
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
      {shiftRows.length > 0 && (
        <div className="flex justify-center mb-6">
          <button
            onClick={handleBulkSave}
            className="px-8 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium text-lg"
          >
            登録する
          </button>
        </div>
      )}
    </>
  )
  }
}
