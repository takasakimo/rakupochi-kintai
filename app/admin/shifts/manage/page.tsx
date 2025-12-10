'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'
import { isHolidayOrSunday } from '@/lib/holidays'

interface Shift {
  id: number
  date: string
  startTime: string
  endTime: string
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

interface TimetableShift {
  shiftId: number
  employeeId: number
  employeeName: string
  employeeNumber: string
  startTime: string
  endTime: string
  breaks: BreakPeriod[]
}

type ViewMode = 'list' | 'timetable'

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
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [timetableShifts, setTimetableShifts] = useState<TimetableShift[]>([])
  const [draggingShift, setDraggingShift] = useState<{
    shiftId: number
    type: 'start' | 'end' | 'breakStart' | 'breakEnd' | string
    breakIndex?: number
    initialX: number
  } | null>(null)
  const [editingShift, setEditingShift] = useState<Shift | null>(null)
  
  // フィルター用の状態
  const [displayMode, setDisplayMode] = useState<'all' | 'department' | 'location'>('all')
  const [selectedDepartment, setSelectedDepartment] = useState<string>('')
  const [selectedLocation, setSelectedLocation] = useState<string>('')
  
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
    if (status === 'authenticated' && session?.user.role === 'admin') {
      fetchEmployees()
    }
  }, [status, session])

  useEffect(() => {
    if (status === 'authenticated' && session?.user.role === 'admin') {
      fetchShifts()
    }
  }, [status, session, selectedEmployeeId, selectedMonth])

  useEffect(() => {
    if (viewMode === 'timetable' && selectedDate) {
      generateTimetableShifts()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, selectedDate, shifts])

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/admin/employees')
      const data = await response.json()
      const sortedEmployees = (data.employees || []).sort((a: Employee, b: Employee) => 
        a.employeeNumber.localeCompare(b.employeeNumber)
      )
      setEmployees(sortedEmployees)
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
      // シフトから該当店舗の従業員を取得
      const locationEmployeeIds = new Set(
        shifts
          .filter(shift => shift.workLocation === selectedLocation)
          .map(shift => shift.employee.id)
      )
      filtered = filtered.filter(emp => locationEmployeeIds.has(emp.id))
    }

    return filtered
  }

  // フィルターされたシフトを取得
  const getFilteredShifts = (): Shift[] => {
    let filtered = shifts

    if (selectedEmployeeId) {
      filtered = filtered.filter(shift => shift.employee.id.toString() === selectedEmployeeId)
    }

    if (displayMode === 'department' && selectedDepartment) {
      filtered = filtered.filter(shift => shift.employee.department === selectedDepartment)
    } else if (displayMode === 'location' && selectedLocation) {
      filtered = filtered.filter(shift => shift.workLocation === selectedLocation)
    }

    return filtered
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
      if (selectedEmployeeId) {
        params.append('employee_id', selectedEmployeeId)
      }
      params.append('start_date', startDateStr)
      params.append('end_date', endDateStr)

      const response = await fetch(`/api/admin/shifts?${params.toString()}`)
      const data = await response.json()
      setShifts(data.shifts || [])
    } catch (err) {
      console.error('Failed to fetch shifts:', err)
    } finally {
      setLoading(false)
    }
  }

  const generateTimetableShifts = () => {
    if (!selectedDate) return

    const dateStr = selectedDate.split('T')[0]
    const filteredShifts = getFilteredShifts()
    const dayShifts = filteredShifts.filter(shift => {
      const shiftDateStr = shift.date.split('T')[0]
      return shiftDateStr === dateStr && !shift.isPublicHoliday && shift.workType === '出勤'
    })

    const timetableData: TimetableShift[] = dayShifts.map(shift => {
      const startTime = shift.startTime || '00:00'
      const endTime = shift.endTime || '00:00'
      const breakMinutes = shift.breakMinutes || 0

      // notesフィールドから複数の休憩時間帯を取得
      let breaks: BreakPeriod[] = []
      try {
        if (shift.notes) {
          const notesData = JSON.parse(shift.notes) as { 
            breaks?: BreakPeriod[]
            breakStartTime?: string  // 旧形式との互換性
            originalNotes?: string 
          }
          
          if (notesData.breaks && Array.isArray(notesData.breaks)) {
            // 新しい形式：複数の休憩
            breaks = notesData.breaks.filter(b => b.startTime && b.endTime)
          } else if (notesData.breakStartTime && breakMinutes > 0) {
            // 旧形式：1つの休憩（互換性のため）
            const breakStartTime = notesData.breakStartTime
            const [startHour, startMin] = breakStartTime.split(':').map(Number)
            const breakStartTotalMinutes = startHour * 60 + startMin
            const breakEndTotalMinutes = breakStartTotalMinutes + breakMinutes
            const breakEndHour = Math.floor(breakEndTotalMinutes / 60)
            const breakEndMin = breakEndTotalMinutes % 60
            const breakEndTime = `${String(breakEndHour).padStart(2, '0')}:${String(breakEndMin).padStart(2, '0')}`
            breaks = [{ startTime: breakStartTime, endTime: breakEndTime }]
          }
        }
      } catch (e) {
        // notesがJSON形式でない場合は無視
      }

      // 休憩がなく、breakMinutesがある場合はデフォルトの休憩を作成
      if (breaks.length === 0 && breakMinutes > 0) {
        const [startHour, startMin] = startTime.split(':').map(Number)
        const startTotalMinutes = startHour * 60 + startMin
        const breakStartTotalMinutes = startTotalMinutes + 4 * 60
        const breakStartHour = Math.floor(breakStartTotalMinutes / 60)
        const breakStartMin = breakStartTotalMinutes % 60
        const breakStartTime = `${String(breakStartHour).padStart(2, '0')}:${String(breakStartMin).padStart(2, '0')}`
        
        const breakEndTotalMinutes = breakStartTotalMinutes + breakMinutes
        const breakEndHour = Math.floor(breakEndTotalMinutes / 60)
        const breakEndMin = breakEndTotalMinutes % 60
        const breakEndTime = `${String(breakEndHour).padStart(2, '0')}:${String(breakEndMin).padStart(2, '0')}`
        breaks = [{ startTime: breakStartTime, endTime: breakEndTime }]
      }

      return {
        shiftId: shift.id,
        employeeId: shift.employee.id,
        employeeName: shift.employee.name,
        employeeNumber: shift.employee.employeeNumber,
        startTime,
        endTime,
        breaks,
      }
    })

    // 従業員番号順にソート
    timetableData.sort((a, b) => a.employeeNumber.localeCompare(b.employeeNumber))
    setTimetableShifts(timetableData)
  }

  const handleDateClick = (date: string) => {
    setSelectedDate(date)
    setViewMode('timetable')
  }

  const handleBackToCalendar = () => {
    setViewMode('timetable')
    setSelectedDate(null)
  }

  const handlePreviousMonth = () => {
    const date = new Date(selectedMonth + '-01')
    date.setMonth(date.getMonth() - 1)
    setSelectedMonth(date.toISOString().slice(0, 7))
  }

  const handleNextMonth = () => {
    const date = new Date(selectedMonth + '-01')
    date.setMonth(date.getMonth() + 1)
    setSelectedMonth(date.toISOString().slice(0, 7))
  }

  const generateCalendar = () => {
    const year = parseInt(selectedMonth.split('-')[0])
    const month = parseInt(selectedMonth.split('-')[1])
    const firstDay = new Date(year, month - 1, 1)
    const lastDay = new Date(year, month, 0)
    const daysInMonth = lastDay.getDate()
    const startDayOfWeek = firstDay.getDay()

    const calendar: Array<Array<{ date: Date; shifts: Shift[] }>> = []
    let currentWeek: Array<{ date: Date; shifts: Shift[] }> = []

    // 前月の日付を埋める
    const prevMonthLastDay = new Date(year, month - 1, 0).getDate()
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month - 2, prevMonthLastDay - i)
      currentWeek.push({ date, shifts: [] })
    }

    // 当月の日付
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day)
      const dateStr = date.toISOString().split('T')[0]
      const dayShifts = shifts.filter(shift => {
        const shiftDateStr = shift.date.split('T')[0]
        return shiftDateStr === dateStr && !shift.isPublicHoliday && shift.workType === '出勤'
      })
      currentWeek.push({ date, shifts: dayShifts })

      if (currentWeek.length === 7) {
        calendar.push(currentWeek)
        currentWeek = []
      }
    }

    // 次月の日付を埋める
    const remainingDays = 7 - currentWeek.length
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(year, month, day)
      currentWeek.push({ date, shifts: [] })
    }
    if (currentWeek.length > 0) {
      calendar.push(currentWeek)
    }

    return calendar
  }

  const timeToPosition = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number)
    const totalMinutes = hours * 60 + minutes
    const startMinutes = 6 * 60 // 06:00
    const endMinutes = 20 * 60 // 20:00
    const range = endMinutes - startMinutes
    return ((totalMinutes - startMinutes) / range) * 100
  }

  const positionToTime = (position: number, roundToMinutes: number = 5): string => {
    const startMinutes = 6 * 60
    const endMinutes = 20 * 60
    const range = endMinutes - startMinutes
    const totalMinutes = Math.round(startMinutes + (position / 100) * range)
    
    // 指定した分単位に丸める（デフォルト5分）
    const roundedMinutes = Math.round(totalMinutes / roundToMinutes) * roundToMinutes
    const hours = Math.floor(roundedMinutes / 60)
    const minutes = roundedMinutes % 60
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
  }

  const timetableContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingShift || !timetableContainerRef.current) return

      const container = timetableContainerRef.current.querySelector('.min-w-\\[1400px\\]')
      if (!container) return

      const rect = container.getBoundingClientRect()
      const x = e.clientX - rect.left
      const containerWidth = rect.width - 128 // 従業員名の幅を引く
      const relativeX = Math.max(0, Math.min(100, ((x - 128) / containerWidth) * 100))

      const shift = timetableShifts.find(s => s.shiftId === draggingShift.shiftId)
      if (!shift) return

      const newTime = positionToTime(relativeX, 5) // 5分単位

      // 開始時間が終了時間を超えないように、終了時間が開始時間を下回らないようにする
      if (draggingShift.type === 'start') {
        const [endHours, endMins] = shift.endTime.split(':').map(Number)
        const [newHours, newMins] = newTime.split(':').map(Number)
        const endTotal = endHours * 60 + endMins
        const newTotal = newHours * 60 + newMins
        if (newTotal >= endTotal) return
        
        setTimetableShifts(prev => prev.map(s => 
          s.shiftId === shift.shiftId
            ? { ...s, startTime: newTime }
            : s
        ))
      } else if (draggingShift.type === 'end') {
        const [startHours, startMins] = shift.startTime.split(':').map(Number)
        const [newHours, newMins] = newTime.split(':').map(Number)
        const startTotal = startHours * 60 + startMins
        const newTotal = newHours * 60 + newMins
        if (newTotal <= startTotal) return
        
        setTimetableShifts(prev => prev.map(s => 
          s.shiftId === shift.shiftId
            ? { ...s, endTime: newTime }
            : s
        ))
      } else if (draggingShift.type.startsWith('breakStart-')) {
        // 複数の休憩の開始時間を更新
        const breakIndex = draggingShift.breakIndex ?? parseInt(draggingShift.type.split('-')[1])
        if (breakIndex === undefined || !shift.breaks[breakIndex]) return
        
        const [newHours, newMins] = newTime.split(':').map(Number)
        const newTotal = newHours * 60 + newMins
        
        const currentBreak = shift.breaks[breakIndex]
        const [endHours, endMins] = currentBreak.endTime.split(':').map(Number)
        const endTotal = endHours * 60 + endMins
        
        // 開始時間が終了時間を超えないように
        if (newTotal >= endTotal) return
        
        // 勤務時間内に収まるようにチェック
        const [startHours, startMins] = shift.startTime.split(':').map(Number)
        const [shiftEndHours, shiftEndMins] = shift.endTime.split(':').map(Number)
        const startTotal = startHours * 60 + startMins
        const shiftEndTotal = shiftEndHours * 60 + shiftEndMins
        
        if (newTotal < startTotal || endTotal > shiftEndTotal) return
        
        setTimetableShifts(prev => prev.map(s => 
          s.shiftId === shift.shiftId
            ? { 
                ...s, 
                breaks: s.breaks.map((b, idx) => 
                  idx === breakIndex ? { ...b, startTime: newTime } : b
                )
              }
            : s
        ))
      } else if (draggingShift.type.startsWith('breakEnd-')) {
        // 複数の休憩の終了時間を更新
        const breakIndex = draggingShift.breakIndex ?? parseInt(draggingShift.type.split('-')[1])
        if (breakIndex === undefined || !shift.breaks[breakIndex]) return
        
        const [newHours, newMins] = newTime.split(':').map(Number)
        const newTotal = newHours * 60 + newMins
        
        const currentBreak = shift.breaks[breakIndex]
        const [startHours, startMins] = currentBreak.startTime.split(':').map(Number)
        const startTotal = startHours * 60 + startMins
        
        // 終了時間が開始時間を下回らないように
        if (newTotal <= startTotal) return
        
        // 勤務時間内に収まるようにチェック
        const [shiftStartHours, shiftStartMins] = shift.startTime.split(':').map(Number)
        const [shiftEndHours, shiftEndMins] = shift.endTime.split(':').map(Number)
        const shiftStartTotal = shiftStartHours * 60 + shiftStartMins
        const shiftEndTotal = shiftEndHours * 60 + shiftEndMins
        
        if (startTotal < shiftStartTotal || newTotal > shiftEndTotal) return
        
        setTimetableShifts(prev => prev.map(s => 
          s.shiftId === shift.shiftId
            ? { 
                ...s, 
                breaks: s.breaks.map((b, idx) => 
                  idx === breakIndex ? { ...b, endTime: newTime } : b
                )
              }
            : s
        ))
      }
    }

    const handleMouseUp = async () => {
      if (!draggingShift) return

      const timetableShift = timetableShifts.find(s => s.shiftId === draggingShift.shiftId)
      if (!timetableShift) return

      // 元のshiftデータを取得
      const originalShift = shifts.find(s => s.id === draggingShift.shiftId)
      if (!originalShift) return

      try {
        let updateData: any = {}
        
        if (draggingShift.type === 'start') {
          updateData.startTime = timetableShift.startTime
        } else if (draggingShift.type === 'end') {
          updateData.endTime = timetableShift.endTime
        } else if (draggingShift.type.startsWith('breakStart-') || draggingShift.type.startsWith('breakEnd-')) {
          // 複数の休憩時間を更新（breakMinutesを合計し、notesに複数の休憩を保存）
          if (timetableShift.breaks.length > 0) {
            // 全休憩時間の合計を計算
            const totalBreakMinutes = timetableShift.breaks.reduce((total, b) => {
              const [startHours, startMins] = b.startTime.split(':').map(Number)
              const [endHours, endMins] = b.endTime.split(':').map(Number)
              const startTotal = startHours * 60 + startMins
              const endTotal = endHours * 60 + endMins
              return total + (endTotal - startTotal)
            }, 0)
            updateData.breakMinutes = totalBreakMinutes
            
            // notesフィールドに複数の休憩を保存
            try {
              let notesData: { breaks?: BreakPeriod[]; breakStartTime?: string; originalNotes?: string } = {}
              if (originalShift.notes) {
                try {
                  notesData = JSON.parse(originalShift.notes) as { breaks?: BreakPeriod[]; breakStartTime?: string; originalNotes?: string }
                } catch (e) {
                  // notesがJSON形式でない場合は、既存のnotesを保持
                  notesData = { originalNotes: originalShift.notes }
                }
              }
              // 複数の休憩を保存（旧形式のbreakStartTimeは削除）
              notesData.breaks = timetableShift.breaks
              delete notesData.breakStartTime
              updateData.notes = JSON.stringify(notesData)
            } catch (e) {
              console.error('Failed to save breaks:', e)
            }
          }
        }

        const response = await fetch(`/api/admin/shifts/${timetableShift.shiftId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData),
        })

        const data = await response.json()
        if (data.success) {
          await fetchShifts()
        } else {
          alert('シフトの更新に失敗しました')
          await fetchShifts()
        }
      } catch (err) {
        console.error('Failed to update shift:', err)
        alert('シフトの更新に失敗しました')
        await fetchShifts()
      }

      setDraggingShift(null)
    }

    if (draggingShift) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [draggingShift, timetableShifts])

  const handleMouseDown = (e: React.MouseEvent, shiftId: number, type: 'start' | 'end' | string) => {
    e.preventDefault()
    e.stopPropagation()
    const breakIndex = type.startsWith('breakStart-') || type.startsWith('breakEnd-') 
      ? parseInt(type.split('-')[1]) 
      : undefined
    setDraggingShift({ shiftId, type, breakIndex, initialX: e.clientX })
  }

  const handleDeleteBreakPeriod = async (shiftId: number, breakIndex: number) => {
    if (!confirm('この休憩を削除しますか？')) return

    try {
      const timetableShift = timetableShifts.find(s => s.shiftId === shiftId)
      if (!timetableShift || !timetableShift.breaks[breakIndex]) return

      // 指定された休憩を削除
      const updatedBreaks = timetableShift.breaks.filter((_, idx) => idx !== breakIndex)
      
      // 元のshiftデータを取得
      const originalShift = shifts.find(s => s.id === shiftId)
      if (!originalShift) return

      // 全休憩時間の合計を計算
      const totalBreakMinutes = updatedBreaks.reduce((total, b) => {
        const [startHours, startMins] = b.startTime.split(':').map(Number)
        const [endHours, endMins] = b.endTime.split(':').map(Number)
        const startTotal = startHours * 60 + startMins
        const endTotal = endHours * 60 + endMins
        return total + (endTotal - startTotal)
      }, 0)

      // notesフィールドを更新
      let notesData: { breaks?: BreakPeriod[]; breakStartTime?: string; originalNotes?: string } = {}
      if (originalShift.notes) {
        try {
          notesData = JSON.parse(originalShift.notes) as { breaks?: BreakPeriod[]; breakStartTime?: string; originalNotes?: string }
        } catch (e) {
          notesData = { originalNotes: originalShift.notes }
        }
      }
      
      if (updatedBreaks.length > 0) {
        notesData.breaks = updatedBreaks
      } else {
        delete notesData.breaks
      }
      delete notesData.breakStartTime // 旧形式を削除
      
      const updatedNotes = updatedBreaks.length > 0 
        ? JSON.stringify(notesData)
        : (notesData.originalNotes || null)

      const response = await fetch(`/api/admin/shifts/${shiftId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          breakMinutes: totalBreakMinutes,
          notes: updatedNotes,
        }),
      })

      const data = await response.json()
      if (data.success) {
        await fetchShifts()
      } else {
        alert('休憩の削除に失敗しました')
        await fetchShifts()
      }
    } catch (err) {
      console.error('Failed to delete break period:', err)
      alert('休憩の削除に失敗しました')
      await fetchShifts()
    }
  }

  const handleAddBreak = async (shiftId: number) => {
    try {
      const timetableShift = timetableShifts.find(s => s.shiftId === shiftId)
      if (!timetableShift) return

      // デフォルトの休憩時間（30分）を追加
      const [startHours, startMins] = timetableShift.startTime.split(':').map(Number)
      const startTotal = startHours * 60 + startMins
      
      // 既存の休憩の後、または開始時間から4時間後に配置
      let breakStartTotal = startTotal + 4 * 60
      if (timetableShift.breaks.length > 0) {
        const lastBreak = timetableShift.breaks[timetableShift.breaks.length - 1]
        const [lastEndHours, lastEndMins] = lastBreak.endTime.split(':').map(Number)
        breakStartTotal = lastEndHours * 60 + lastEndMins + 30 // 最後の休憩の30分後
      }
      
      // 勤務終了時間を超えないように
      const [endHours, endMins] = timetableShift.endTime.split(':').map(Number)
      const endTotal = endHours * 60 + endMins
      if (breakStartTotal + 30 > endTotal) {
        breakStartTotal = endTotal - 30
      }
      
      const breakStartHour = Math.floor(breakStartTotal / 60)
      const breakStartMin = breakStartTotal % 60
      const breakStartTime = `${String(breakStartHour).padStart(2, '0')}:${String(breakStartMin).padStart(2, '0')}`
      
      const breakEndTotal = breakStartTotal + 30
      const breakEndHour = Math.floor(breakEndTotal / 60)
      const breakEndMin = breakEndTotal % 60
      const breakEndTime = `${String(breakEndHour).padStart(2, '0')}:${String(breakEndMin).padStart(2, '0')}`

      const newBreak: BreakPeriod = { startTime: breakStartTime, endTime: breakEndTime }
      const updatedBreaks = [...timetableShift.breaks, newBreak]

      // 元のshiftデータを取得
      const originalShift = shifts.find(s => s.id === shiftId)
      if (!originalShift) return

      // 全休憩時間の合計を計算
      const totalBreakMinutes = updatedBreaks.reduce((total, b) => {
        const [sHours, sMins] = b.startTime.split(':').map(Number)
        const [eHours, eMins] = b.endTime.split(':').map(Number)
        const sTotal = sHours * 60 + sMins
        const eTotal = eHours * 60 + eMins
        return total + (eTotal - sTotal)
      }, 0)

      // notesフィールドを更新
      let notesData: { breaks?: BreakPeriod[]; breakStartTime?: string; originalNotes?: string } = {}
      if (originalShift.notes) {
        try {
          notesData = JSON.parse(originalShift.notes) as { breaks?: BreakPeriod[]; breakStartTime?: string; originalNotes?: string }
        } catch (e) {
          notesData = { originalNotes: originalShift.notes }
        }
      }
      
      notesData.breaks = updatedBreaks
      delete notesData.breakStartTime // 旧形式を削除

      const response = await fetch(`/api/admin/shifts/${shiftId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          breakMinutes: totalBreakMinutes,
          notes: JSON.stringify(notesData),
        }),
      })

      const data = await response.json()
      if (data.success) {
        await fetchShifts()
      } else {
        alert('休憩の追加に失敗しました')
        await fetchShifts()
      }
    } catch (err) {
      console.error('Failed to add break:', err)
      alert('休憩の追加に失敗しました')
      await fetchShifts()
    }
  }

  const generateTimeSlots = () => {
    const slots: string[] = []
    for (let hour = 6; hour <= 20; hour++) {
      slots.push(`${String(hour).padStart(2, '0')}:00`)
      if (hour < 20) {
        slots.push(`${String(hour).padStart(2, '0')}:30`)
      }
    }
    return slots
  }

  if (status === 'loading' || loading) {
    return <div className="p-8 text-center text-gray-900">読み込み中...</div>
  }

  if (viewMode === 'timetable' && selectedDate) {
    const date = new Date(selectedDate)
    const month = date.getMonth() + 1
    const day = date.getDate()
    const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()]

    return (
      <div className="p-4">
        <div className="max-w-7xl mx-auto">
          {/* ヘッダー */}
          <div className="bg-blue-600 text-white p-4 rounded-t-lg flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📅</span>
              <div>
                <h2 className="text-xl font-bold">{month}月{day}日のシフト</h2>
                <p className="text-sm text-blue-100">シフト登録者: {timetableShifts.length}名</p>
              </div>
            </div>
            <button
              onClick={() => setSelectedDate(null)}
              className="text-white hover:text-gray-200 text-2xl font-bold"
            >
              ×
            </button>
          </div>

          {/* タイムテーブル */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="bg-blue-600 text-white p-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">🕐</span>
                <h3 className="text-lg font-bold">タイムテーブル - {month}月{day}日 ({dayOfWeek})</h3>
              </div>
              <p className="text-sm text-blue-100 mt-1">シフト登録者: {timetableShifts.length}名</p>
            </div>

            <div className="overflow-x-auto" ref={timetableContainerRef}>
              <div className="min-w-[1400px]">
                {/* 時間軸ヘッダー */}
                <div className="flex border-b">
                  <div className="w-32 p-2 font-semibold text-gray-900 bg-gray-50 border-r">
                    従業員名
                  </div>
                  <div className="flex-1 relative">
                    <div className="flex">
                      {generateTimeSlots().map((time, index) => (
                        <div
                          key={index}
                          className="flex-1 border-r border-gray-200 text-center text-xs text-gray-600 p-1 bg-gray-50"
                          style={{ minWidth: '30px' }}
                        >
                          {time.split(':')[1] === '00' ? time : ''}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 従業員行 */}
                {timetableShifts.map((timetableShift) => {
                  const startPos = timeToPosition(timetableShift.startTime)
                  const endPos = timeToPosition(timetableShift.endTime)
                  const width = endPos - startPos

                  return (
                    <div key={timetableShift.shiftId} className="flex border-b border-gray-200">
                      <div className="w-32 p-2 text-sm text-gray-900 bg-gray-50 border-r">
                        {timetableShift.employeeName}
                      </div>
                      <div className="flex-1 relative h-16">
                        {/* 勤務ブロック */}
                        <div
                          className="absolute bg-blue-500 h-full flex items-center justify-between px-2"
                          style={{
                            left: `${startPos}%`,
                            width: `${width}%`,
                            top: '0',
                            zIndex: 1,
                          }}
                        >
                          {/* 開始マーカー */}
                          <div
                            className="bg-blue-600 text-white text-xs px-2 py-1 rounded cursor-move hover:bg-blue-700 select-none"
                            onMouseDown={(e) => handleMouseDown(e, timetableShift.shiftId, 'start')}
                          >
                            開始 {timetableShift.startTime}
                          </div>

                          {/* 終了マーカー */}
                          <div
                            className="bg-blue-600 text-white text-xs px-2 py-1 rounded cursor-move hover:bg-blue-700 select-none"
                            onMouseDown={(e) => handleMouseDown(e, timetableShift.shiftId, 'end')}
                          >
                            終了 {timetableShift.endTime}
                          </div>
                        </div>

                        {/* 複数の休憩ブロック（勤務ブロックの上に重ねて表示） */}
                        {timetableShift.breaks.map((breakPeriod, breakIndex) => {
                          const breakStartPos = timeToPosition(breakPeriod.startTime)
                          const breakEndPos = timeToPosition(breakPeriod.endTime)
                          const breakLeft = breakStartPos
                          const breakWidth = breakEndPos - breakStartPos

                          return (
                            <div
                              key={breakIndex}
                              className="absolute bg-orange-500 h-full flex items-center justify-between px-2"
                              style={{
                                left: `${breakLeft}%`,
                                width: `${breakWidth}%`,
                                top: '0',
                                zIndex: 10,
                                backgroundColor: '#f97316',
                                opacity: 1,
                              }}
                            >
                              <div
                                className="bg-orange-600 text-white text-xs px-2 py-1 rounded cursor-move hover:bg-orange-700 select-none"
                                onMouseDown={(e) => handleMouseDown(e, timetableShift.shiftId, `breakStart-${breakIndex}` as any)}
                              >
                                休憩開始 {breakPeriod.startTime}
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="text-white text-xs">
                                  休憩 {breakPeriod.startTime}-{breakPeriod.endTime}
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    handleDeleteBreakPeriod(timetableShift.shiftId, breakIndex)
                                  }}
                                  className="bg-red-600 text-white text-xs px-2 py-1 rounded hover:bg-red-700 select-none"
                                  title="休憩を削除"
                                >
                                  ×
                                </button>
                              </div>
                              <div
                                className="bg-orange-600 text-white text-xs px-2 py-1 rounded cursor-move hover:bg-orange-700 select-none"
                                onMouseDown={(e) => handleMouseDown(e, timetableShift.shiftId, `breakEnd-${breakIndex}` as any)}
                              >
                                休憩終了 {breakPeriod.endTime}
                              </div>
                            </div>
                          )
                        })}

                        {/* 休憩追加ボタン */}
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleAddBreak(timetableShift.shiftId)
                          }}
                          className="absolute top-0 right-0 bg-green-600 text-white text-xs px-2 py-1 rounded hover:bg-green-700 z-20"
                          title="休憩を追加"
                          style={{ marginTop: '4px', marginRight: '4px' }}
                        >
                          + 休憩追加
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="p-4 flex justify-end">
              <button
                onClick={() => setSelectedDate(null)}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      </div>
    )
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
          onClick={() => setViewMode('timetable')}
          className={`px-6 py-3 font-medium transition ${
            viewMode === 'timetable'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          🗓️ タイムテーブル
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
          const response = await fetch(`/api/admin/shifts/${shiftId}`, {
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
          workingHours: editingShift.workingHours || null,
          timeSlot: editingShift.timeSlot || null,
          directDestination: editingShift.directDestination || null,
          approvalNumber: editingShift.approvalNumber || null,
          leavingLocation: editingShift.leavingLocation || null,
        }

        if (editingShift.isPublicHoliday) {
          // 公休の場合は時間関連をnull/0にする
          updateData.startTime = null
          updateData.endTime = null
          updateData.breakMinutes = 0
          updateData.workingHours = null
          updateData.timeSlot = null
        } else {
          if (editingShift.startTime) updateData.startTime = editingShift.startTime
          if (editingShift.endTime) updateData.endTime = editingShift.endTime
          updateData.breakMinutes = editingShift.breakMinutes
        }

        const response = await fetch(`/api/admin/shifts/${editingShift.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData),
        })

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
        alert('シフトの更新に失敗しました')
      }
    }

    const handleDelete = async (id: number) => {
      if (!confirm('このシフトを削除しますか？')) return

      try {
        const response = await fetch(`/api/admin/shifts/${id}`, {
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
      if (isPublicHoliday) return '-'
      if (!timeStr) return '-'
      if (typeof timeStr === 'string' && timeStr.length >= 5) {
        // 00:00の場合は公休として扱う
        if (timeStr.slice(0, 5) === '00:00') return '-'
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

    return (
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
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
        
        {filteredShifts.length === 0 ? (
          <div className="p-6 text-center text-gray-700">シフトがありません</div>
        ) : (
          <div>
            {editingShift && (
              <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded sticky top-0 z-20 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-900">
                  {editingShift.employee?.name || 'シフト'} のシフトを編集中
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={handleUpdate}
                    className="px-4 py-2 bg-blue-500 text-white rounded text-sm font-medium hover:bg-blue-600 whitespace-nowrap"
                  >
                    保存
                  </button>
                  <button
                    onClick={() => setEditingShift(null)}
                    className="px-4 py-2 bg-gray-200 text-gray-900 rounded text-sm font-medium hover:bg-gray-300 whitespace-nowrap"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            )}
            <div className="overflow-x-auto overflow-y-auto max-h-[70vh]">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-900">日付</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-900">従業員</th>
                  {displayMode === 'all' && (
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-900">事業部</th>
                  )}
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
                    {editingShift?.id === shift.id ? (
                      <>
                        <td className="px-1 py-0.5">
                          <input
                            type="date"
                            value={editingShift.date.split('T')[0]}
                            onChange={(e) =>
                              setEditingShift({
                                ...editingShift,
                                date: e.target.value,
                              })
                            }
                            className="px-1 py-0.5 border border-gray-300 rounded text-xs text-gray-900 bg-white w-28 h-6"
                          />
                        </td>
                        <td className="px-1 py-0.5 text-xs text-gray-900">{shift.employee.name}</td>
                        {displayMode === 'all' && (
                          <td className="px-1 py-0.5 text-xs text-gray-900">{shift.employee.department || '-'}</td>
                        )}
                        <td className="px-1 py-0.5">
                          <input
                            type="checkbox"
                            checked={selectedShiftIds.has(shift.id)}
                            onChange={(e) => handleSelectShift(shift.id, e.target.checked)}
                            className="w-3 h-3"
                          />
                        </td>
                        <td className="px-1 py-0.5">
                          <input
                            type="checkbox"
                            checked={editingShift.isPublicHoliday}
                            onChange={(e) => {
                              const isPublicHoliday = e.target.checked
                              setEditingShift({
                                ...editingShift,
                                isPublicHoliday,
                                // 公休にした場合は時間関連のフィールドをクリア
                                ...(isPublicHoliday && {
                                  startTime: '',
                                  endTime: '',
                                  breakMinutes: 0,
                                  workingHours: null,
                                  timeSlot: null,
                                }),
                              })
                            }}
                            className="w-3 h-3"
                          />
                        </td>
                        <td className="px-1 py-0.5">
                          <input
                            type="text"
                            value={editingShift.workLocation || ''}
                            onChange={(e) =>
                              setEditingShift({
                                ...editingShift,
                                workLocation: e.target.value,
                              })
                            }
                            className="px-1 py-0.5 border border-gray-300 rounded text-xs text-gray-900 bg-white w-24 h-6"
                            placeholder="SB天白"
                          />
                        </td>
                        <td className="px-1 py-0.5">
                          <select
                            value={editingShift.workType || '出勤'}
                            onChange={(e) => {
                              const workType = e.target.value
                              const isPublicHoliday = workType === '公休'
                              setEditingShift({
                                ...editingShift,
                                workType,
                                // 公休にした場合は時間関連のフィールドをクリア
                                ...(isPublicHoliday && {
                                  startTime: '',
                                  endTime: '',
                                  breakMinutes: 0,
                                  workingHours: null,
                                  timeSlot: null,
                                }),
                              })
                            }}
                            className="px-1 py-0.5 border border-gray-300 rounded text-xs text-gray-900 bg-white w-20 h-6"
                          >
                            <option value="出勤">出勤</option>
                            <option value="公休">公休</option>
                          </select>
                        </td>
                        <td className="px-1 py-0.5">
                          <input
                            type="text"
                            value={editingShift.workingHours || ''}
                            onChange={(e) =>
                              setEditingShift({
                                ...editingShift,
                                workingHours: e.target.value,
                              })
                            }
                            className="px-1 py-0.5 border border-gray-300 rounded text-xs text-gray-900 bg-white w-16 h-6"
                            placeholder="8:00"
                          />
                        </td>
                        <td className="px-1 py-0.5">
                          <select
                            value={editingShift.timeSlot || '-'}
                            onChange={(e) =>
                              setEditingShift({
                                ...editingShift,
                                timeSlot: e.target.value,
                              })
                            }
                            className="px-1 py-0.5 border border-gray-300 rounded text-xs text-gray-900 bg-white w-16 h-6"
                          >
                            <option value="-">-</option>
                            <option value="早番">早番</option>
                            <option value="中番">中番</option>
                            <option value="遅番">遅番</option>
                          </select>
                        </td>
                        <td className="px-1 py-0.5">
                          <input
                            type="time"
                            value={formatTime(editingShift.startTime)}
                            onChange={(e) =>
                              setEditingShift({
                                ...editingShift,
                                startTime: e.target.value,
                              })
                            }
                            className="px-1 py-0.5 border border-gray-300 rounded text-xs text-gray-900 bg-white w-20 h-6"
                          />
                        </td>
                        <td className="px-1 py-0.5">
                          <input
                            type="time"
                            value={formatTime(editingShift.endTime)}
                            onChange={(e) =>
                              setEditingShift({
                                ...editingShift,
                                endTime: e.target.value,
                              })
                            }
                            className="px-1 py-0.5 border border-gray-300 rounded text-xs text-gray-900 bg-white w-20 h-6"
                          />
                        </td>
                        <td className="px-1 py-0.5">
                          <div className="flex items-center gap-0.5">
                            <input
                              type="number"
                              value={editingShift.breakMinutes}
                              onChange={(e) =>
                                setEditingShift({
                                  ...editingShift,
                                  breakMinutes: parseInt(e.target.value) || 0,
                                })
                              }
                              className="px-1 py-0.5 border border-gray-300 rounded text-xs text-gray-900 bg-white w-12 h-6"
                            />
                            <span className="text-xs text-gray-700">分</span>
                          </div>
                        </td>
                        <td className="px-1 py-0.5">
                          <input
                            type="text"
                            value={editingShift.directDestination || ''}
                            onChange={(e) =>
                              setEditingShift({
                                ...editingShift,
                                directDestination: e.target.value,
                              })
                            }
                            className="px-1 py-0.5 border border-gray-300 rounded text-xs text-gray-900 bg-white w-20 h-6"
                            placeholder="-"
                          />
                        </td>
                        <td className="px-1 py-0.5">
                          <input
                            type="text"
                            value={editingShift.approvalNumber || ''}
                            onChange={(e) =>
                              setEditingShift({
                                ...editingShift,
                                approvalNumber: e.target.value,
                              })
                            }
                            className="px-1 py-0.5 border border-gray-300 rounded text-xs text-gray-900 bg-white w-20 h-6"
                            placeholder="-"
                          />
                        </td>
                        <td className="px-1 py-0.5">
                          <input
                            type="text"
                            value={editingShift.leavingLocation || ''}
                            onChange={(e) =>
                              setEditingShift({
                                ...editingShift,
                                leavingLocation: e.target.value,
                              })
                            }
                            className="px-1 py-0.5 border border-gray-300 rounded text-xs text-gray-900 bg-white w-20 h-6"
                            placeholder="-"
                          />
                        </td>
                        <td className="px-1 py-0.5">
                          <input
                            type="text"
                            value={editingShift.notes || ''}
                            onChange={(e) =>
                              setEditingShift({
                                ...editingShift,
                                notes: e.target.value,
                              })
                            }
                            className="px-1 py-0.5 border border-gray-300 rounded text-xs text-gray-900 bg-white w-24 h-6"
                            placeholder="-"
                          />
                        </td>
                        <td className="px-1 py-0.5">
                          <div className="text-xs text-gray-500">編集中</div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className={`px-2 py-2 text-xs ${isHolidayOrSun ? 'text-red-700 font-semibold' : 'text-gray-900'}`}>{formatDate(shift.date)}</td>
                        <td className="px-2 py-2 text-xs text-gray-900">{shift.employee.name}</td>
                        {displayMode === 'all' && (
                          <td className="px-2 py-2 text-xs text-gray-900">{shift.employee.department || '-'}</td>
                        )}
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
                    )}
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


  // タイムテーブルビュー（カレンダー表示）
  const renderTimetableView = () => {
    const calendar = generateCalendar()
    const year = parseInt(selectedMonth.split('-')[0])
    const month = parseInt(selectedMonth.split('-')[1])

    return (
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="bg-blue-600 text-white p-4 flex items-center justify-between">
          <button
            onClick={handlePreviousMonth}
            className="px-4 py-2 bg-blue-700 hover:bg-blue-800 rounded-lg"
          >
            前月
          </button>
          <h2 className="text-xl font-bold">{year}年{month}月</h2>
          <button
            onClick={handleNextMonth}
            className="px-4 py-2 bg-blue-700 hover:bg-blue-800 rounded-lg"
          >
            次月
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                  {['日', '月', '火', '水', '木', '金', '土'].map((day, index) => (
                    <th
                      key={day}
                      className={`p-2 text-center font-semibold border ${
                        index === 0 ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'
                      }`}
                    >
                      {day}
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {calendar.map((week, weekIndex) => (
                <tr key={weekIndex}>
                  {week.map((day, dayIndex) => {
                    const dateStr = day.date.toISOString().split('T')[0]
                    const isCurrentMonth = day.date.getMonth() + 1 === month
                    const isHolidayOrSun = isHolidayOrSunday(day.date)
                    const isToday = dateStr === new Date().toISOString().split('T')[0]

                    return (
                      <td
                        key={dayIndex}
                        className={`border p-2 align-top h-32 ${
                          !isCurrentMonth ? 'bg-gray-50 text-gray-400' : ''
                        } ${isHolidayOrSun ? 'bg-red-50' : ''} ${
                          isToday ? 'ring-2 ring-blue-500' : ''
                        } cursor-pointer hover:bg-blue-50`}
                        onClick={() => isCurrentMonth && handleDateClick(dateStr)}
                      >
                        <div className="font-semibold mb-1">{day.date.getDate()}</div>
                        <div className="space-y-1">
                          {day.shifts.slice(0, 3).map((shift) => {
                            if (shift.isPublicHoliday) {
                              return (
                                <div
                                  key={shift.id}
                                  className="bg-gray-200 text-gray-600 text-xs p-1 rounded truncate"
                                  title={`${shift.employee.name}: 公休`}
                                >
                                  <div className="font-medium">{shift.employee.name}</div>
                                  <div className="text-xs">公休</div>
                                </div>
                              )
                            }
                            const startTime = shift.startTime && shift.startTime !== '00:00' ? shift.startTime.slice(0, 5) : '-'
                            const endTime = shift.endTime && shift.endTime !== '00:00' ? shift.endTime.slice(0, 5) : '-'
                            return (
                              <div
                                key={shift.id}
                                className="bg-blue-200 text-blue-900 text-xs p-1 rounded truncate"
                                title={`${shift.employee.name}: ${startTime}-${endTime}`}
                              >
                                <div className="font-medium">{shift.employee.name}</div>
                                <div className="text-xs">{startTime}-{endTime}</div>
                              </div>
                            )
                          })}
                          {day.shifts.length > 3 && (
                            <div className="text-xs text-gray-500">
                              +{day.shifts.length - 3}名
                            </div>
                          )}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // カレンダー表示
  const calendar = generateCalendar()
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
                  setSelectedEmployeeId('')
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
              >
                <option value="all">全体</option>
                <option value="department">事業部ごと</option>
                <option value="location">店舗ごと</option>
              </select>
            </div>
            {displayMode === 'department' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  事業部
                </label>
                <select
                  value={selectedDepartment}
                  onChange={(e) => {
                    setSelectedDepartment(e.target.value)
                    setSelectedEmployeeId('')
                  }}
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
                  onChange={(e) => {
                    setSelectedLocation(e.target.value)
                    setSelectedEmployeeId('')
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
                従業員
              </label>
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
              >
                <option value="">全員</option>
                {getFilteredEmployees().map((emp) => (
                  <option key={emp.id} value={emp.id.toString()}>
                    {emp.name} ({emp.employeeNumber})
                    {emp.department && ` - ${emp.department}`}
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
          </div>
        </div>

        {/* ビュー表示 */}
        {viewMode === 'list' && renderListView()}
        {viewMode === 'timetable' && !selectedDate && renderTimetableView()}
      </div>
    </div>
  )
}
