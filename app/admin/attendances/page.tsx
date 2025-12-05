'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface Attendance {
  id: number
  date: string
  wakeUpTime: string | null | Date
  departureTime: string | null | Date
  clockIn: string | null | Date
  clockOut: string | null | Date
  clockInLocation: any
  clockOutLocation: any
  breakMinutes: number
  notes: string | null
  employee: {
    id: number
    name: string
    employeeNumber: string
    department: string | null
  }
  employeeId?: number // APIレスポンスに含まれる可能性がある
}

interface Employee {
  id: number
  name: string
  employeeNumber: string
  department: string | null
}

interface Shift {
  id: number
  date: string
  startTime: string
  endTime: string
  breakMinutes: number
  workLocation: string | null
  workType: string | null
  directDestination: string | null
  isPublicHoliday: boolean
  employee: {
    id: number
    name: string
    employeeNumber: string
    department: string | null
  }
}

interface ShiftWithAttendance {
  shift: Shift
  attendance: Attendance | null
}

export default function AdminAttendancesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [attendances, setAttendances] = useState<Attendance[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [shiftsWithAttendance, setShiftsWithAttendance] = useState<ShiftWithAttendance[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [locations, setLocations] = useState<{ id: number; name: string }[]>([])
  const [departments, setDepartments] = useState<string[]>([])
  const [directDestinations, setDirectDestinations] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('')
  const [selectedLocationId, setSelectedLocationId] = useState<string>('')
  const [selectedDepartment, setSelectedDepartment] = useState<string>('')
  const [selectedDirectDestination, setSelectedDirectDestination] = useState<string>('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [viewMode, setViewMode] = useState<'shifts' | 'attendances'>('shifts') // デフォルトはシフト表示
  const [showManualForm, setShowManualForm] = useState(false)
  const [editingAttendance, setEditingAttendance] = useState<Attendance | null>(null)
  const [showMapModal, setShowMapModal] = useState(false)
  const [mapLocation, setMapLocation] = useState<{ latitude: number; longitude: number; locationName?: string } | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const mapInstanceRef = useRef<any>(null)
  const markerInstanceRef = useRef<any>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const [manualFormData, setManualFormData] = useState({
    employeeId: '',
    date: new Date().toISOString().split('T')[0],
    type: 'clock_in',
    time: '',
    location: {
      latitude: '',
      longitude: '',
      locationName: '',
    },
  })
  const [editFormData, setEditFormData] = useState({
    wakeUpTime: '',
    departureTime: '',
    clockIn: '',
    clockOut: '',
    clockInLocation: {
      latitude: '',
      longitude: '',
      locationName: '',
    },
    clockOutLocation: {
      latitude: '',
      longitude: '',
      locationName: '',
    },
    breakMinutes: 0,
  })

  useEffect(() => {
    if (status === 'authenticated' && session?.user.role === 'admin') {
      fetchEmployees()
      fetchLocations()
      fetchDepartments()
      fetchDirectDestinations()
      if (viewMode === 'shifts') {
        fetchShiftsAndAttendances()
      } else {
        fetchAttendances()
      }
    }
  }, [status, session, viewMode])

  useEffect(() => {
    if (status === 'authenticated' && session?.user.role === 'admin') {
      if (viewMode === 'shifts') {
        fetchShiftsAndAttendances()
      } else {
        fetchAttendances()
      }
    }
  }, [selectedEmployeeId, selectedLocationId, selectedDepartment, selectedDirectDestination, startDate, endDate, viewMode])

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/admin/employees')
      if (!response.ok) {
        console.error('Failed to fetch employees:', response.status, response.statusText)
        setEmployees([])
        return
      }
      const data = await response.json()
      if (data.employees && Array.isArray(data.employees)) {
        setEmployees(data.employees)
        console.log('Fetched employees:', data.employees.length)
      } else {
        console.error('Invalid employees data:', data)
        setEmployees([])
      }
    } catch (err) {
      console.error('Failed to fetch employees:', err)
      setEmployees([])
    }
  }

  const fetchLocations = async () => {
    try {
      const response = await fetch('/api/admin/locations')
      if (!response.ok) {
        console.error('Failed to fetch locations:', response.status)
        setLocations([])
        return
      }
      const data = await response.json()
      if (data.locations && Array.isArray(data.locations)) {
        setLocations(data.locations)
      } else {
        setLocations([])
      }
    } catch (err) {
      console.error('Failed to fetch locations:', err)
      setLocations([])
    }
  }

  const fetchDepartments = async () => {
    try {
      const response = await fetch('/api/admin/departments')
      if (!response.ok) {
        console.error('Failed to fetch departments:', response.status)
        setDepartments([])
        return
      }
      const data = await response.json()
      if (data.departments && Array.isArray(data.departments)) {
        setDepartments(data.departments)
      } else {
        setDepartments([])
      }
    } catch (err) {
      console.error('Failed to fetch departments:', err)
      setDepartments([])
    }
  }

  const fetchDirectDestinations = async () => {
    try {
      const response = await fetch('/api/admin/direct-destinations')
      if (!response.ok) {
        console.error('Failed to fetch direct destinations:', response.status)
        setDirectDestinations([])
        return
      }
      const data = await response.json()
      if (data.directDestinations && Array.isArray(data.directDestinations)) {
        setDirectDestinations(data.directDestinations)
      } else {
        setDirectDestinations([])
      }
    } catch (err) {
      console.error('Failed to fetch direct destinations:', err)
      setDirectDestinations([])
    }
  }

  const fetchShiftsAndAttendances = async () => {
    setLoading(true)
    try {
      // 日付が指定されていない場合は今日の日付を使用
      const targetDate = startDate || new Date().toISOString().split('T')[0]
      
      // シフトを取得
      const shiftParams = new URLSearchParams()
      shiftParams.append('start_date', targetDate)
      shiftParams.append('end_date', targetDate)
      if (selectedEmployeeId) {
        shiftParams.append('employee_id', selectedEmployeeId)
      }

      const shiftResponse = await fetch(`/api/admin/shifts?${shiftParams.toString()}`)
      if (!shiftResponse.ok) {
        console.error('Failed to fetch shifts:', shiftResponse.status)
        setShifts([])
        setShiftsWithAttendance([])
        return
      }
      const shiftData = await shiftResponse.json()
      let fetchedShifts = (shiftData.shifts || []).filter((s: Shift) => !s.isPublicHoliday)

      // フィルタリング: 店舗（workLocation）
      if (selectedLocationId) {
        const selectedLocation = locations.find(loc => loc.id.toString() === selectedLocationId)
        if (selectedLocation) {
          fetchedShifts = fetchedShifts.filter((s: Shift) => 
            s.workLocation === selectedLocation.name
          )
        }
      }

      // フィルタリング: 事業部（department）
      if (selectedDepartment) {
        fetchedShifts = fetchedShifts.filter((s: Shift) => 
          s.employee.department === selectedDepartment
        )
      }

      // フィルタリング: 直行先（directDestination）
      if (selectedDirectDestination) {
        fetchedShifts = fetchedShifts.filter((s: Shift) => 
          s.directDestination === selectedDirectDestination
        )
      }

      setShifts(fetchedShifts)

      // 打刻を取得
      const attendanceParams = new URLSearchParams()
      attendanceParams.append('start_date', targetDate)
      attendanceParams.append('end_date', targetDate)
      if (selectedEmployeeId) {
        attendanceParams.append('employee_id', selectedEmployeeId)
      }

      const attendanceResponse = await fetch(`/api/admin/attendances?${attendanceParams.toString()}`)
      const attendanceData = await attendanceResponse.json()
      let fetchedAttendances = attendanceData.attendances || []

      // 打刻も同様にフィルタリング
      if (selectedDepartment) {
        fetchedAttendances = fetchedAttendances.filter((a: Attendance) => 
          a.employee.department === selectedDepartment
        )
      }

      // シフトと打刻を組み合わせる
      const combined: ShiftWithAttendance[] = fetchedShifts.map((shift: Shift) => {
        const attendance = fetchedAttendances.find(
          (a: Attendance) => a.employee.id === shift.employee.id
        ) || null
        return { shift, attendance }
      })

      // 従業員番号順にソート
      combined.sort((a, b) => 
        a.shift.employee.employeeNumber.localeCompare(b.shift.employee.employeeNumber)
      )

      setShiftsWithAttendance(combined)
      console.log('Fetched shifts with attendance:', combined.length)
    } catch (err) {
      console.error('Failed to fetch shifts and attendances:', err)
      setShifts([])
      setShiftsWithAttendance([])
    } finally {
      setLoading(false)
    }
  }

  const fetchAttendances = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      // 過去履歴も取得できるように、日付範囲を指定しない場合は全期間を取得
      if (selectedEmployeeId) {
        params.append('employee_id', selectedEmployeeId)
      }
      if (startDate) {
        params.append('start_date', startDate)
      }
      if (endDate) {
        params.append('end_date', endDate)
      }

      const response = await fetch(`/api/admin/attendances?${params.toString()}`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('Failed to fetch attendances:', response.status, response.statusText, errorData)
        setAttendances([])
        return
      }
      const data = await response.json()
      if (data.attendances && Array.isArray(data.attendances)) {
        setAttendances(data.attendances)
        console.log('Fetched attendances:', data.attendances.length)
      } else {
        console.error('Invalid attendances data:', data)
        setAttendances([])
      }
    } catch (err) {
      console.error('Failed to fetch attendances:', err)
      setAttendances([])
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (time: string | null | Date) => {
    if (!time) return '-'
    
    // Date型の場合は時刻部分を抽出
    if (time instanceof Date) {
      const hours = time.getHours().toString().padStart(2, '0')
      const minutes = time.getMinutes().toString().padStart(2, '0')
      return `${hours}:${minutes}`
    }
    
    // 文字列の場合
    if (typeof time === 'string') {
      // ISO形式の日時文字列の場合
      if (time.includes('T') || time.includes(' ')) {
        const date = new Date(time)
        if (!isNaN(date.getTime())) {
          const hours = date.getHours().toString().padStart(2, '0')
          const minutes = date.getMinutes().toString().padStart(2, '0')
          return `${hours}:${minutes}`
        }
      }
      // HH:MM:SS形式の場合
      if (time.includes(':')) {
        return time.slice(0, 5)
      }
    }
    
    return '-'
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    })
  }

  const getLocationInfo = (location: any) => {
    if (!location) return null
    if (location.address) {
      return location.address
    }
    if (location.locationName) {
      return location.locationName
    }
    return '位置情報取得済み'
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

  const handleShowMap = (location: any, type: 'clockIn' | 'clockOut') => {
    if (!location || !location.latitude || !location.longitude) {
      alert('位置情報がありません')
      return
    }
    setMapLocation({
      latitude: location.latitude,
      longitude: location.longitude,
      locationName: location.locationName || (type === 'clockIn' ? '出勤位置' : '退勤位置'),
    })
    setShowMapModal(true)
  }

  useEffect(() => {
    if (showMapModal && mapLocation && mapContainerRef.current && typeof window !== 'undefined') {
      setMapLoaded(false)
      
      // Leaflet.jsのスクリプトとCSSを動的に読み込む
      const loadLeaflet = (): Promise<void> => {
        return new Promise((resolve, reject) => {
          // 既に読み込まれている場合は即座に解決
          if ((window as any).L) {
            resolve()
            return
          }

          // CSSが既に読み込まれているか確認
          const existingCss = document.querySelector('link[href*="leaflet.css"]')
          if (!existingCss) {
            const link = document.createElement('link')
            link.rel = 'stylesheet'
            link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
            link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY='
            link.crossOrigin = 'anonymous'
            document.head.appendChild(link)
          }

          // スクリプトを読み込む
          const existingScript = document.querySelector('script[src*="leaflet.js"]')
          if (existingScript) {
            // 既に読み込み中または読み込み済み
            const checkInterval = setInterval(() => {
              if ((window as any).L) {
                clearInterval(checkInterval)
                resolve()
              }
            }, 100)
            setTimeout(() => {
              clearInterval(checkInterval)
              if (!(window as any).L) {
                reject(new Error('Leaflet.js loading timeout'))
              }
            }, 5000)
            return
          }

          const script = document.createElement('script')
          script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
          script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo='
          script.crossOrigin = 'anonymous'
          script.async = true
          script.onload = () => {
            if ((window as any).L) {
              resolve()
            } else {
              reject(new Error('Leaflet.js loaded but L is not available'))
            }
          }
          script.onerror = () => reject(new Error('Failed to load Leaflet.js'))
          document.head.appendChild(script)
        })
      }

      // マップコンテナが確実に存在するまで待つ
      const initMap = async () => {
        try {
          await loadLeaflet()
          
          // もう一度コンテナの存在を確認
          if (!mapContainerRef.current) {
            console.error('Map container not found')
            setMapLoaded(true)
            return
          }

          const L = (window as any).L
          if (!L) {
            console.error('Leaflet.js is not available')
            setMapLoaded(true)
            return
          }

          // 既存のマップをクリア
          if (mapInstanceRef.current) {
            mapInstanceRef.current.remove()
            mapInstanceRef.current = null
          }
          if (markerInstanceRef.current) {
            markerInstanceRef.current = null
          }

          // マーカーアイコンのパスを修正
          delete (L.Icon.Default.prototype as any)._getIconUrl
          L.Icon.Default.mergeOptions({
            iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
            iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
            shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
          })

          // マップを初期化
          const map = L.map(mapContainerRef.current, {
            zoomControl: true,
          }).setView(
            [mapLocation.latitude, mapLocation.longitude],
            15
          )

          // OpenStreetMapのタイルレイヤーを追加
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19,
          }).addTo(map)

          // マーカーを追加
          const marker = L.marker([mapLocation.latitude, mapLocation.longitude])
            .addTo(map)
            .bindPopup(`
              <div style="padding: 8px;">
                <strong>${mapLocation.locationName || '打刻位置'}</strong><br>
                緯度: ${mapLocation.latitude.toFixed(6)}<br>
                経度: ${mapLocation.longitude.toFixed(6)}
              </div>
            `)
            .openPopup()

          mapInstanceRef.current = map
          markerInstanceRef.current = marker
          setMapLoaded(true)
        } catch (error) {
          console.error('Failed to initialize map:', error)
          setMapLoaded(true) // エラーでもローディングを解除
        }
      }

      // 少し遅延させてマップコンテナが確実に存在するようにする
      const timer = setTimeout(() => {
        initMap()
      }, 300)

      return () => {
        clearTimeout(timer)
        // クリーンアップ
        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove()
          mapInstanceRef.current = null
        }
        markerInstanceRef.current = null
      }
    }
  }, [showMapModal, mapLocation])

  useEffect(() => {
    if (!showMapModal) {
      // モーダルが閉じられたときにマップインスタンスをクリア
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
      markerInstanceRef.current = null
      setMapLocation(null)
      setMapLoaded(false)
    }
  }, [showMapModal])

  // 休憩時間を計算（6時間以上は1時間休憩）
  const calculateBreakMinutes = (attendance: Attendance) => {
    if (!attendance.clockIn || !attendance.clockOut) {
      return attendance.breakMinutes || 0
    }
    
    try {
      const clockIn = formatTime(attendance.clockIn)
      const clockOut = formatTime(attendance.clockOut)
      
      if (clockIn === '-' || clockOut === '-') {
        return attendance.breakMinutes || 0
      }
      
      const [inHours, inMinutes] = clockIn.split(':').map(Number)
      const [outHours, outMinutes] = clockOut.split(':').map(Number)
      
      let inTime = new Date(2000, 0, 1, inHours, inMinutes)
      let outTime = new Date(2000, 0, 1, outHours, outMinutes)
      
      // 終了時刻が開始時刻より小さい場合は翌日とみなす
      if (outTime.getTime() < inTime.getTime()) {
        outTime = new Date(2000, 0, 2, outHours, outMinutes)
      }
      
      // 総勤務時間を計算
      const diffMs = outTime.getTime() - inTime.getTime()
      const totalWorkMinutes = Math.floor(diffMs / (1000 * 60))
      
      // 6時間（360分）以上の場合は1時間（60分）の休憩が必要
      // 既に休憩時間が設定されている場合はその値を使用
      if (attendance.breakMinutes && attendance.breakMinutes > 0) {
        return attendance.breakMinutes
      }
      
      // 6時間以上の場合は自動的に60分の休憩を適用
      if (totalWorkMinutes >= 6 * 60) {
        return 60
      }
      
      return 0
    } catch (e) {
      console.error('Error calculating break minutes:', e)
      return attendance.breakMinutes || 0
    }
  }

  const calculateOvertime = (attendance: Attendance) => {
    if (!attendance.clockIn || !attendance.clockOut) return '-'
    
    try {
      const clockIn = formatTime(attendance.clockIn)
      const clockOut = formatTime(attendance.clockOut)
      
      if (clockIn === '-' || clockOut === '-') return '-'
      
      const [inHours, inMinutes] = clockIn.split(':').map(Number)
      const [outHours, outMinutes] = clockOut.split(':').map(Number)
      
      let inTime = new Date(2000, 0, 1, inHours, inMinutes)
      let outTime = new Date(2000, 0, 1, outHours, outMinutes)
      
      // 終了時刻が開始時刻より小さい場合は翌日とみなす
      if (outTime.getTime() < inTime.getTime()) {
        outTime = new Date(2000, 0, 2, outHours, outMinutes)
      }
      
      // 総勤務時間を計算
      const diffMs = outTime.getTime() - inTime.getTime()
      const totalWorkMinutes = Math.floor(diffMs / (1000 * 60))
      
      // 休憩時間を計算（6時間以上は1時間休憩）
      const breakMinutes = calculateBreakMinutes(attendance)
      const netWorkMinutes = Math.max(0, totalWorkMinutes - breakMinutes)
      
      // 標準勤務時間（8時間）を超えた分が残業時間
      const standardWorkMinutes = 8 * 60
      const overtimeMinutes = Math.max(0, netWorkMinutes - standardWorkMinutes)
      
      if (overtimeMinutes === 0) return '0:00'
      
      const hours = Math.floor(overtimeMinutes / 60)
      const minutes = overtimeMinutes % 60
      return `${hours}:${String(minutes).padStart(2, '0')}`
    } catch (e) {
      console.error('Error calculating overtime:', e)
      return '-'
    }
  }

  const resetFilters = () => {
    setSelectedEmployeeId('')
    setSelectedLocationId('')
    setSelectedDepartment('')
    setSelectedDirectDestination('')
    setStartDate('')
    setEndDate('')
  }

  const handleEdit = (attendance: Attendance) => {
    console.log('handleEdit called with attendance:', attendance)
    if (!attendance) {
      console.error('Attendance is null or undefined')
      return
    }
    
    // employee情報が欠落している場合は、employeesから取得
    if (!attendance.employee) {
      console.warn('Attendance.employee is missing, trying to find from employees list')
      // attendanceオブジェクトからemployeeIdを取得（APIレスポンスの構造による）
      const employeeId = attendance.employeeId || (attendance as any).employeeId
      if (employeeId) {
        const employee = employees.find(emp => emp.id === employeeId)
        if (employee) {
          // attendanceオブジェクトを更新（型アサーションを使用）
          const updatedAttendance = {
            ...attendance,
            employee: {
              id: employee.id,
              name: employee.name,
              employeeNumber: employee.employeeNumber,
              department: employee.department,
            }
          }
          console.log('Found employee from employees list:', updatedAttendance.employee)
          setEditingAttendance(updatedAttendance)
          setShowManualForm(false)
          console.log('Editing attendance set:', updatedAttendance.id)
          
          // 編集フォームに既存のデータを設定
          const formatTime = (time: string | null | Date) => {
            if (!time) return ''
            if (typeof time === 'string') {
              if (time.includes('T')) {
                return time.split('T')[1]?.slice(0, 5) || ''
              }
              return time.slice(0, 5)
            }
            if (time instanceof Date) {
              const hours = String(time.getHours()).padStart(2, '0')
              const minutes = String(time.getMinutes()).padStart(2, '0')
              return `${hours}:${minutes}`
            }
            return ''
          }

          const formatLocation = (location: any) => {
            if (!location) return { latitude: '', longitude: '', locationName: '' }
            if (typeof location === 'object') {
              return {
                latitude: location.latitude?.toString() || '',
                longitude: location.longitude?.toString() || '',
                locationName: location.locationName || location.address || '',
              }
            }
            return { latitude: '', longitude: '', locationName: '' }
          }

          setEditFormData({
            wakeUpTime: formatTime(updatedAttendance.wakeUpTime),
            departureTime: formatTime(updatedAttendance.departureTime),
            clockIn: formatTime(updatedAttendance.clockIn),
            clockOut: formatTime(updatedAttendance.clockOut),
            clockInLocation: formatLocation(updatedAttendance.clockInLocation),
            clockOutLocation: formatLocation(updatedAttendance.clockOutLocation),
            breakMinutes: updatedAttendance.breakMinutes || 0,
          })
          return
        } else {
          console.error('Could not find employee for attendance:', attendance)
          alert('従業員情報が見つかりません。ページをリロードしてください。')
          return
        }
      } else {
        console.error('Could not find employeeId in attendance:', attendance)
        alert('従業員情報が見つかりません。ページをリロードしてください。')
        return
      }
    }
    
    // employee情報が存在する場合でも、必ず新しいオブジェクトを作成して状態を更新
    const finalAttendance: Attendance = attendance.employee 
      ? { ...attendance, employee: { ...attendance.employee } }
      : attendance
    
    console.log('Setting editingAttendance with employee:', finalAttendance.employee?.name || 'N/A')
    console.log('Final attendance object:', JSON.stringify(finalAttendance, null, 2))
    setEditingAttendance(finalAttendance)
    setShowManualForm(false)
    console.log('Editing attendance set:', finalAttendance.id)
    
    // 編集フォームに既存のデータを設定
    const formatTime = (time: string | null | Date) => {
      if (!time) return ''
      if (typeof time === 'string') {
        // ISO形式の文字列から時刻部分を抽出
        if (time.includes('T')) {
          return time.split('T')[1]?.slice(0, 5) || ''
        }
        return time.slice(0, 5)
      }
      if (time instanceof Date) {
        const hours = String(time.getHours()).padStart(2, '0')
        const minutes = String(time.getMinutes()).padStart(2, '0')
        return `${hours}:${minutes}`
      }
      return ''
    }

    const formatLocation = (location: any) => {
      if (!location) return { latitude: '', longitude: '', locationName: '' }
      if (typeof location === 'object') {
        return {
          latitude: location.latitude?.toString() || '',
          longitude: location.longitude?.toString() || '',
          locationName: location.locationName || location.address || '',
        }
      }
      return { latitude: '', longitude: '', locationName: '' }
    }

    setEditFormData({
      wakeUpTime: formatTime(attendance.wakeUpTime),
      departureTime: formatTime(attendance.departureTime),
      clockIn: formatTime(attendance.clockIn),
      clockOut: formatTime(attendance.clockOut),
      clockInLocation: formatLocation(attendance.clockInLocation),
      clockOutLocation: formatLocation(attendance.clockOutLocation),
      breakMinutes: attendance.breakMinutes || 0,
    })
  }

  const handleDelete = async (id: number) => {
    if (!confirm('この打刻を削除しますか？')) return

    try {
      const response = await fetch(`/api/admin/attendances/${id}`, {
        method: 'DELETE',
      })

      const data = await response.json()
      if (data.success) {
        alert('打刻を削除しました')
        if (viewMode === 'shifts') {
          fetchShiftsAndAttendances()
        } else {
          fetchAttendances()
        }
      } else {
        alert(data.error || '打刻の削除に失敗しました')
      }
    } catch (err) {
      console.error('Failed to delete attendance:', err)
      alert('打刻の削除に失敗しました')
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingAttendance) return

    try {
      const updateData: any = {}
      
      // すべての打刻時間を更新（空の場合はnullに設定）
      updateData.wakeUpTime = editFormData.wakeUpTime || null
      updateData.departureTime = editFormData.departureTime || null
      updateData.clockIn = editFormData.clockIn || null
      updateData.clockOut = editFormData.clockOut || null
      updateData.breakMinutes = editFormData.breakMinutes || 0

      // 出勤位置情報
      if (editFormData.clockIn) {
        updateData.clockInLocation = {
          latitude: editFormData.clockInLocation.latitude ? parseFloat(editFormData.clockInLocation.latitude) : null,
          longitude: editFormData.clockInLocation.longitude ? parseFloat(editFormData.clockInLocation.longitude) : null,
          locationName: editFormData.clockInLocation.locationName || null,
          isManual: true,
        }
      }

      // 退勤位置情報
      if (editFormData.clockOut) {
        updateData.clockOutLocation = {
          latitude: editFormData.clockOutLocation.latitude ? parseFloat(editFormData.clockOutLocation.latitude) : null,
          longitude: editFormData.clockOutLocation.longitude ? parseFloat(editFormData.clockOutLocation.longitude) : null,
          locationName: editFormData.clockOutLocation.locationName || null,
          isManual: true,
        }
      }

      const response = await fetch(`/api/admin/attendances/${editingAttendance.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      })

      const data = await response.json()
      if (data.success) {
        alert('打刻を更新しました')
        setEditingAttendance(null)
        setEditFormData({
          wakeUpTime: '',
          departureTime: '',
          clockIn: '',
          clockOut: '',
          clockInLocation: { latitude: '', longitude: '', locationName: '' },
          clockOutLocation: { latitude: '', longitude: '', locationName: '' },
          breakMinutes: 0,
        })
        if (viewMode === 'shifts') {
          fetchShiftsAndAttendances()
        } else {
          fetchAttendances()
        }
      } else {
        alert(data.error || '打刻の更新に失敗しました')
      }
    } catch (err) {
      console.error('Failed to update attendance:', err)
      alert('打刻の更新に失敗しました')
    }
  }

  const handleManualAttendance = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualFormData.employeeId || !manualFormData.date || !manualFormData.time) {
      alert('従業員、日付、時刻を入力してください')
      return
    }

    try {
      const payload: any = {
        employeeId: manualFormData.employeeId,
        date: manualFormData.date,
        type: manualFormData.type,
        time: manualFormData.time,
      }

      // 出勤・退勤の場合は位置情報も送信（オプション）
      if (
        (manualFormData.type === 'clock_in' || manualFormData.type === 'clock_out') &&
        (manualFormData.location.latitude || manualFormData.location.locationName)
      ) {
        payload.location = {
          latitude: manualFormData.location.latitude
            ? parseFloat(manualFormData.location.latitude)
            : null,
          longitude: manualFormData.location.longitude
            ? parseFloat(manualFormData.location.longitude)
            : null,
          locationName: manualFormData.location.locationName || null,
        }
      }

      const response = await fetch('/api/admin/attendance/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      if (data.success) {
        alert('打刻を登録しました')
        setShowManualForm(false)
        setManualFormData({
          employeeId: '',
          date: new Date().toISOString().split('T')[0],
          type: 'clock_in',
          time: '',
          location: {
            latitude: '',
            longitude: '',
            locationName: '',
          },
        })
        if (viewMode === 'shifts') {
          fetchShiftsAndAttendances()
        } else {
          fetchAttendances()
        }
      } else {
        alert(data.error || '打刻の登録に失敗しました')
      }
    } catch (err) {
      console.error('Failed to register manual attendance:', err)
      alert('打刻の登録に失敗しました')
    }
  }

  // デバッグ用：editingAttendanceの状態をログに出力
  useEffect(() => {
    if (editingAttendance) {
      console.log('editingAttendance state changed:', editingAttendance)
      console.log('Has employee?', !!editingAttendance.employee)
      console.log('Employee name:', editingAttendance.employee?.name)
      console.log('editFormData:', editFormData)
      // フォームが表示されるべき条件をチェック（明示的にbooleanに変換）
      const hasEmployee = !!editingAttendance.employee
      const hasEmployeeId = !!(editingAttendance as any).employeeId
      const shouldShowForm = !!(editingAttendance && (hasEmployee || hasEmployeeId))
      console.log('Should show form?', shouldShowForm, '(hasEmployee:', hasEmployee, ', hasEmployeeId:', hasEmployeeId, ')')
    } else {
      console.log('editingAttendance is null')
    }
  }, [editingAttendance, editFormData])

  if (status === 'loading' || loading) {
    return <div className="p-8 text-center text-gray-900">読み込み中...</div>
  }

  return (
    <div className="p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">打刻管理</h1>
          <button
            onClick={() => setShowManualForm(!showManualForm)}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 font-medium"
          >
            {showManualForm ? 'キャンセル' : '+ 打刻を登録'}
          </button>
        </div>

        {/* デバッグ表示 */}
        {editingAttendance && (
          <div className="bg-yellow-100 border-2 border-yellow-500 text-yellow-800 px-4 py-3 rounded mb-4">
            <strong>デバッグ:</strong> editingAttendance is set - ID: {editingAttendance.id}, Employee: {editingAttendance.employee?.name || 'N/A'}, Has Employee: {editingAttendance.employee ? 'YES' : 'NO'}
            <br />
            <pre className="text-xs mt-2 overflow-auto">{JSON.stringify(editingAttendance, null, 2)}</pre>
          </div>
        )}

        {/* 打刻編集フォーム（全項目編集可能） - ページ上部に表示 */}
        {editingAttendance ? (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6 border-4 border-blue-500" style={{ backgroundColor: '#e0f2fe', minHeight: '200px', position: 'relative', zIndex: 1000, marginTop: '20px', marginBottom: '20px' }}>
            <div className="text-red-600 font-bold mb-2 text-lg">⚠️ 編集フォームが表示されています (ID: {editingAttendance.id})</div>
            <h2 className="text-lg font-semibold mb-4 text-gray-900">
              打刻を強制編集 - {editingAttendance.employee?.name || employees.find(e => e.id === (editingAttendance as any).employeeId)?.name || 'N/A'} ({editingAttendance.date ? new Date(editingAttendance.date).toLocaleDateString('ja-JP') : 'N/A'})
            </h2>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">起床時刻</label>
                  <input
                    type="time"
                    value={editFormData.wakeUpTime}
                    onChange={(e) => setEditFormData({ ...editFormData, wakeUpTime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">出発時刻</label>
                  <input
                    type="time"
                    value={editFormData.departureTime}
                    onChange={(e) => setEditFormData({ ...editFormData, departureTime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">出勤時刻</label>
                  <input
                    type="time"
                    value={editFormData.clockIn}
                    onChange={(e) => setEditFormData({ ...editFormData, clockIn: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">退勤時刻</label>
                  <input
                    type="time"
                    value={editFormData.clockOut}
                    onChange={(e) => setEditFormData({ ...editFormData, clockOut: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">休憩時間（分）</label>
                  <input
                    type="number"
                    min="0"
                    value={editFormData.breakMinutes}
                    onChange={(e) => setEditFormData({ ...editFormData, breakMinutes: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>
              </div>

              {/* 出勤位置情報 */}
              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">出勤位置情報</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">緯度</label>
                    <input
                      type="number"
                      step="any"
                      value={editFormData.clockInLocation.latitude}
                      onChange={(e) => setEditFormData({ ...editFormData, clockInLocation: { ...editFormData.clockInLocation, latitude: e.target.value } })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">経度</label>
                    <input
                      type="number"
                      step="any"
                      value={editFormData.clockInLocation.longitude}
                      onChange={(e) => setEditFormData({ ...editFormData, clockInLocation: { ...editFormData.clockInLocation, longitude: e.target.value } })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">場所名</label>
                    <input
                      type="text"
                      value={editFormData.clockInLocation.locationName}
                      onChange={(e) => setEditFormData({ ...editFormData, clockInLocation: { ...editFormData.clockInLocation, locationName: e.target.value } })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* 退勤位置情報 */}
              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">退勤位置情報</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">緯度</label>
                    <input
                      type="number"
                      step="any"
                      value={editFormData.clockOutLocation.latitude}
                      onChange={(e) => setEditFormData({ ...editFormData, clockOutLocation: { ...editFormData.clockOutLocation, latitude: e.target.value } })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">経度</label>
                    <input
                      type="number"
                      step="any"
                      value={editFormData.clockOutLocation.longitude}
                      onChange={(e) => setEditFormData({ ...editFormData, clockOutLocation: { ...editFormData.clockOutLocation, longitude: e.target.value } })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">場所名</label>
                    <input
                      type="text"
                      value={editFormData.clockOutLocation.locationName}
                      onChange={(e) => setEditFormData({ ...editFormData, clockOutLocation: { ...editFormData.clockOutLocation, locationName: e.target.value } })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 font-medium">強制更新</button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingAttendance(null)
                    setEditFormData({ wakeUpTime: '', departureTime: '', clockIn: '', clockOut: '', clockInLocation: { latitude: '', longitude: '', locationName: '' }, clockOutLocation: { latitude: '', longitude: '', locationName: '' }, breakMinutes: 0 })
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-900 rounded-md hover:bg-gray-300 font-medium"
                >
                  キャンセル
                </button>
              </div>
            </form>
          </div>
        ) : null}

        {/* 打刻登録フォーム */}
        {showManualForm && !editingAttendance && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4 text-gray-900">打刻を登録</h2>
            <form onSubmit={handleManualAttendance} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">従業員 *</label>
                  <select
                    value={manualFormData.employeeId}
                    onChange={(e) => setManualFormData({ ...manualFormData, employeeId: e.target.value })}
                    required
                    disabled={employees.length === 0}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white disabled:bg-gray-100"
                  >
                    <option value="">{employees.length > 0 ? '選択してください' : '従業員データを読み込み中...'}</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id.toString()}>
                        {emp.name} ({emp.employeeNumber})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">日付 *</label>
                  <input
                    type="date"
                    value={manualFormData.date}
                    onChange={(e) => setManualFormData({ ...manualFormData, date: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">打刻タイプ *</label>
                  <select
                    value={manualFormData.type}
                    onChange={(e) => setManualFormData({ ...manualFormData, type: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  >
                    <option value="wake_up">起床</option>
                    <option value="departure">出発</option>
                    <option value="clock_in">出勤</option>
                    <option value="clock_out">退勤</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">時刻 *</label>
                  <input
                    type="time"
                    value={manualFormData.time}
                    onChange={(e) => setManualFormData({ ...manualFormData, time: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>
              </div>
              {(manualFormData.type === 'clock_in' || manualFormData.type === 'clock_out') && (
                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">位置情報（オプション）</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">緯度</label>
                      <input
                        type="number"
                        step="any"
                        value={manualFormData.location.latitude}
                        onChange={(e) => setManualFormData({ ...manualFormData, location: { ...manualFormData.location, latitude: e.target.value } })}
                        placeholder="例: 36.5658"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">経度</label>
                      <input
                        type="number"
                        step="any"
                        value={manualFormData.location.longitude}
                        onChange={(e) => setManualFormData({ ...manualFormData, location: { ...manualFormData.location, longitude: e.target.value } })}
                        placeholder="例: 139.8827"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">場所名</label>
                      <input
                        type="text"
                        value={manualFormData.location.locationName}
                        onChange={(e) => setManualFormData({ ...manualFormData, location: { ...manualFormData.location, locationName: e.target.value } })}
                        placeholder="例: 本社"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 font-medium">登録</button>
                <button
                  type="button"
                  onClick={() => {
                    setShowManualForm(false)
                    setManualFormData({ employeeId: '', date: new Date().toISOString().split('T')[0], type: 'clock_in', time: '', location: { latitude: '', longitude: '', locationName: '' } })
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-900 rounded-md hover:bg-gray-300 font-medium"
                >
                  キャンセル
                </button>
              </div>
            </form>
          </div>
        )}

        {/* フィルター */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <h2 className="text-lg font-semibold text-gray-900">検索条件</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('shifts')}
                className={`px-4 py-2 rounded-md font-medium transition ${
                  viewMode === 'shifts'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                シフト表示
              </button>
              <button
                onClick={() => setViewMode('attendances')}
                className={`px-4 py-2 rounded-md font-medium transition ${
                  viewMode === 'attendances'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                打刻履歴表示
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                従業員
              </label>
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
              >
                <option value="">全て</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id.toString()}>
                    {emp.name} ({emp.employeeNumber})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                店舗
              </label>
              <select
                value={selectedLocationId}
                onChange={(e) => setSelectedLocationId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
              >
                <option value="">全て</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id.toString()}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                事業部
              </label>
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
              >
                <option value="">全て</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                直行先
              </label>
              <select
                value={selectedDirectDestination}
                onChange={(e) => setSelectedDirectDestination(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
              >
                <option value="">全て</option>
                {directDestinations.map((dest) => (
                  <option key={dest} value={dest}>
                    {dest}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                開始日
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={resetFilters}
                className="w-full px-4 py-2 bg-gray-200 text-gray-900 rounded-md hover:bg-gray-300 font-medium"
              >
                リセット
              </button>
            </div>
          </div>
        </div>

        {/* シフト表示モード */}
        {viewMode === 'shifts' && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            {shiftsWithAttendance.length === 0 ? (
              <div className="p-6 text-center text-gray-700">
                シフトデータがありません
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                        従業員
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                        シフト
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                        起床
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                        出発
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                        出勤
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                        退勤
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                        休憩
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                        残業
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                        備考
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {shiftsWithAttendance.map((item) => {
                      const attendance = item.attendance
                      const shift = item.shift
                      return (
                        <tr key={shift.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">
                            <div className="font-medium">{shift.employee.name}</div>
                            <div className="text-xs text-gray-600">
                              {shift.employee.employeeNumber}
                              {shift.employee.department && (
                                <> / {shift.employee.department}</>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            <div className="space-y-1">
                              <div>
                                <span className="text-xs text-gray-600">開始:</span>{' '}
                                <span className="font-medium">{shift.startTime}</span>
                              </div>
                              <div>
                                <span className="text-xs text-gray-600">終了:</span>{' '}
                                <span className="font-medium">{shift.endTime}</span>
                              </div>
                              {shift.workLocation && (
                                <div className="text-xs text-gray-600">
                                  場所: {shift.workLocation}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {attendance ? formatTime(attendance.wakeUpTime) : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {attendance ? formatTime(attendance.departureTime) : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <div className="text-gray-900">
                              {attendance ? formatTime(attendance.clockIn) : '-'}
                            </div>
                            {attendance?.clockInLocation && (
                              <div className="text-xs text-gray-600 mt-1">
                                <button
                                  onClick={() => handleShowMap(attendance.clockInLocation, 'clockIn')}
                                  className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                                >
                                  📍 {getLocationInfo(attendance.clockInLocation)}
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <div className="text-gray-900">
                              {attendance ? formatTime(attendance.clockOut) : '-'}
                            </div>
                            {attendance?.clockOutLocation && (
                              <div className="text-xs text-gray-600 mt-1">
                                <button
                                  onClick={() => handleShowMap(attendance.clockOutLocation, 'clockOut')}
                                  className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                                >
                                  📍 {getLocationInfo(attendance.clockOutLocation)}
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {attendance ? `${calculateBreakMinutes(attendance)}分` : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {attendance ? calculateOvertime(attendance) : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {attendance ? formatNotes(attendance.notes) : '-'}
                          </td>
                          <td className="px-4 py-3">
                            {attendance ? (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleEdit(attendance)}
                                  className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                                >
                                  編集
                                </button>
                                <button
                                  onClick={() => handleDelete(attendance.id)}
                                  className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                                >
                                  削除
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  const shiftDate = typeof shift.date === 'string' 
                                ? shift.date.split('T')[0] 
                                : new Date(shift.date).toISOString().split('T')[0]
                              setManualFormData({
                                    employeeId: shift.employee.id.toString(),
                                    date: shiftDate,
                                    type: 'clock_in',
                                    time: '',
                                    location: {
                                      latitude: '',
                                      longitude: '',
                                      locationName: '',
                                    },
                                  })
                                  setShowManualForm(true)
                                  setEditingAttendance(null)
                                }}
                                className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
                              >
                                打刻登録
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 打刻履歴表示モード */}
        {viewMode === 'attendances' && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            {attendances.length === 0 ? (
              <div className="p-6 text-center text-gray-700">
                打刻データがありません
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                        日付
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                        従業員
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                        起床
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                        出発
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                        出勤
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                        退勤
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                        休憩
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                        残業
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                        備考
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {attendances.map((attendance) => (
                      <tr key={attendance.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {formatDate(attendance.date)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          <div className="font-medium">{attendance.employee.name}</div>
                          <div className="text-xs text-gray-600">
                            {attendance.employee.employeeNumber}
                            {attendance.employee.department && (
                              <> / {attendance.employee.department}</>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {formatTime(attendance.wakeUpTime)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {formatTime(attendance.departureTime)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="text-gray-900">
                            {formatTime(attendance.clockIn)}
                          </div>
                          {attendance.clockInLocation && (
                            <div className="text-xs text-gray-600 mt-1">
                              <button
                                onClick={() => handleShowMap(attendance.clockInLocation, 'clockIn')}
                                className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                              >
                                📍 {getLocationInfo(attendance.clockInLocation)}
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="text-gray-900">
                            {formatTime(attendance.clockOut)}
                          </div>
                          {attendance.clockOutLocation && (
                            <div className="text-xs text-gray-600 mt-1">
                              <button
                                onClick={() => handleShowMap(attendance.clockOutLocation, 'clockOut')}
                                className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                              >
                                📍 {getLocationInfo(attendance.clockOutLocation)}
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {calculateBreakMinutes(attendance)}分
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {calculateOvertime(attendance)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {formatNotes(attendance.notes)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEdit(attendance)}
                              className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                            >
                              編集
                            </button>
                            <button
                              onClick={() => handleDelete(attendance.id)}
                              className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                            >
                              削除
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* マップ モーダル（OpenStreetMap + Leaflet.js） */}
      {showMapModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">
                {mapLocation?.locationName || '打刻位置'}
              </h2>
              <button
                onClick={() => setShowMapModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
              >
                ×
              </button>
            </div>
            <div className="flex-1 p-4">
              {mapLocation ? (
                <>
                  <div className="relative">
                    {!mapLoaded && (
                      <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg z-10">
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                          <p className="text-sm text-gray-600">マップを読み込み中...</p>
                        </div>
                      </div>
                    )}
                    <div 
                      ref={mapContainerRef}
                      id="map" 
                      style={{ width: '100%', height: '500px', zIndex: 0 }} 
                      className="rounded-lg border border-gray-300"
                    ></div>
                  </div>
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-700 mb-2">
                      <p className="font-medium">位置情報</p>
                      <p>緯度: {mapLocation.latitude.toFixed(6)}</p>
                      <p>経度: {mapLocation.longitude.toFixed(6)}</p>
                    </div>
                    <div className="mt-2 space-x-4">
                      <a
                        href={`https://www.google.com/maps?q=${mapLocation.latitude},${mapLocation.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 underline text-sm"
                      >
                        Google Mapsで開く
                      </a>
                      <a
                        href={`https://www.openstreetmap.org/?mlat=${mapLocation.latitude}&mlon=${mapLocation.longitude}&zoom=15`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 underline text-sm"
                      >
                        OpenStreetMapで開く
                      </a>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-[500px] bg-gray-100 rounded-lg">
                  <p className="text-gray-600">位置情報がありません</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

