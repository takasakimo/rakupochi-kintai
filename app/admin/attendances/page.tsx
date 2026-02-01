'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

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

interface ModificationLog {
  id: number
  action: string
  oldValues: any
  newValues: any
  changedFields: string[]
  createdAt: string
  modifier: {
    id: number
    name: string
    employeeNumber: string
    email: string
  }
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
  // URLパラメータからviewModeを取得
  const [viewMode, setViewMode] = useState<'shifts' | 'attendances'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const mode = params.get('viewMode')
      return (mode === 'attendances' || mode === 'shifts') ? mode : 'shifts'
    }
    return 'shifts'
  })
  const [showMapModal, setShowMapModal] = useState(false)
  const [mapLocation, setMapLocation] = useState<{ latitude: number; longitude: number; locationName?: string } | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const mapInstanceRef = useRef<any>(null)
  const markerInstanceRef = useRef<any>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [selectedAttendanceId, setSelectedAttendanceId] = useState<number | null>(null)
  const [modificationLogs, setModificationLogs] = useState<ModificationLog[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [showAllHistoryModal, setShowAllHistoryModal] = useState(false)
  const [allModificationLogs, setAllModificationLogs] = useState<any[]>([])
  const [loadingAllHistory, setLoadingAllHistory] = useState(false)
  const [companySettings, setCompanySettings] = useState<{
    allowPreOvertime?: boolean
    workStartTime?: Date | string | null
    workEndTime?: Date | string | null
    standardBreakMinutes?: number
  } | null>(null)

  // URLパラメータからviewModeを読み取る
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const mode = params.get('viewMode')
      if (mode === 'attendances' || mode === 'shifts') {
        setViewMode(mode)
      }
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated') {
      const isAdmin = session?.user.role === 'admin'
      const isSuperAdmin = session?.user.role === 'super_admin' || 
                          session?.user.email === 'superadmin@rakupochi.com'
      
      if (isAdmin || (isSuperAdmin && session?.user.selectedCompanyId)) {
        fetchEmployees()
        fetchLocations()
        fetchDepartments()
        fetchDirectDestinations()
        fetchCompanySettings()
        if (viewMode === 'shifts') {
          fetchShiftsAndAttendances()
        } else {
          fetchAttendances()
        }
      }
    }
  }, [status, session, viewMode])

  const fetchCompanySettings = async () => {
    try {
      const response = await fetch('/api/admin/settings')
      const data = await response.json()
      if (data.settings) {
        setCompanySettings(data.settings)
      }
    } catch (err) {
      console.error('Failed to fetch company settings:', err)
    }
  }

  useEffect(() => {
    if (status === 'authenticated') {
      const isAdmin = session?.user.role === 'admin'
      const isSuperAdmin = session?.user.role === 'super_admin' || 
                          session?.user.email === 'superadmin@rakupochi.com'
      
      if (isAdmin || (isSuperAdmin && session?.user.selectedCompanyId)) {
        if (viewMode === 'shifts') {
          fetchShiftsAndAttendances()
        } else {
          fetchAttendances()
        }
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
        // 店舗のみを表示
        const storeLocations = data.locations.filter((loc: any) => loc.type === 'store')
        setLocations(storeLocations)
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

  const calculateOvertime = (attendance: Attendance, shift?: Shift | null) => {
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
      
      // 企業設定を取得（前残業を認める設定、デフォルトはfalse）
      const allowPreOvertime = companySettings?.allowPreOvertime === true
      
      // 標準始業時刻・終業時刻を取得（デフォルト値）
      const defaultWorkStart = new Date('2000-01-01T09:00:00')
      const defaultWorkEnd = new Date('2000-01-01T18:00:00')
      
      let workStartTime = defaultWorkStart
      let workEndTime = defaultWorkEnd
      
      // シフト情報があればシフト時間を使用、なければ標準時間を使用
      if (shift?.startTime) {
        try {
          if (shift.startTime instanceof Date) {
            // UTC時間として取得（シフト登録時と同じ方法）
            const hours = shift.startTime.getUTCHours()
            const minutes = shift.startTime.getUTCMinutes()
            workStartTime = new Date(`2000-01-01T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`)
          } else if (typeof shift.startTime === 'string') {
            const [hours, minutes] = shift.startTime.split(':').map(Number)
            workStartTime = new Date(2000, 0, 1, hours, minutes)
          }
        } catch (e) {
          console.error('Error parsing shift startTime:', e)
        }
      } else if (companySettings?.workStartTime) {
        try {
          if (companySettings.workStartTime instanceof Date) {
            const hours = companySettings.workStartTime.getHours()
            const minutes = companySettings.workStartTime.getMinutes()
            workStartTime = new Date(`2000-01-01T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`)
          } else if (typeof companySettings.workStartTime === 'string') {
            workStartTime = new Date(`2000-01-01T${companySettings.workStartTime}`)
          }
        } catch (e) {
          console.error('Error parsing workStartTime:', e)
        }
      }
      
      if (shift?.endTime) {
        try {
          if (shift.endTime instanceof Date) {
            // UTC時間として取得（シフト登録時と同じ方法）
            const hours = shift.endTime.getUTCHours()
            const minutes = shift.endTime.getUTCMinutes()
            workEndTime = new Date(`2000-01-01T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`)
          } else if (typeof shift.endTime === 'string') {
            const [hours, minutes] = shift.endTime.split(':').map(Number)
            workEndTime = new Date(2000, 0, 1, hours, minutes)
          }
        } catch (e) {
          console.error('Error parsing shift endTime:', e)
        }
      } else if (companySettings?.workEndTime) {
        try {
          if (companySettings.workEndTime instanceof Date) {
            const hours = companySettings.workEndTime.getHours()
            const minutes = companySettings.workEndTime.getMinutes()
            workEndTime = new Date(`2000-01-01T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`)
          } else if (typeof companySettings.workEndTime === 'string') {
            workEndTime = new Date(`2000-01-01T${companySettings.workEndTime}`)
          }
        } catch (e) {
          console.error('Error parsing workEndTime:', e)
        }
      }
      
      // シフト終了時刻が開始時刻より前の場合（翌日にまたがるシフト）は1日加算
      if (workEndTime.getTime() < workStartTime.getTime()) {
        workEndTime = new Date(workEndTime.getTime() + 24 * 60 * 60 * 1000)
      }
      
      // シフト勤務時間を計算
      const shiftBreakMinutes = shift?.breakMinutes || companySettings?.standardBreakMinutes || 60
      const shiftWorkMinutes = Math.floor(
        (workEndTime.getTime() - workStartTime.getTime()) / (1000 * 60)
      ) - shiftBreakMinutes
      
      let overtimeMinutes: number
      
      if (!allowPreOvertime) {
        // 前残業を認めない場合：シフト開始時刻より前の時間は残業としてカウントしない
        // シフト終了時刻より後の時間のみを残業としてカウント
        
        // シフト開始時刻より前の時間を計算
        const preWorkMinutes = Math.max(0, Math.floor((workStartTime.getTime() - inTime.getTime()) / (1000 * 60)))
        
        // シフト終了時刻より後の時間を計算
        const postWorkMinutes = Math.max(0, Math.floor((outTime.getTime() - workEndTime.getTime()) / (1000 * 60)))
        
        // 実働時間から前残業分を除外
        const adjustedNetWorkMinutes = Math.max(0, netWorkMinutes - preWorkMinutes)
        
        // 残業時間はシフト終了時刻より後の時間 + シフト時間を超えた分
        const overtimeWithinShift = Math.max(0, adjustedNetWorkMinutes - shiftWorkMinutes)
        overtimeMinutes = postWorkMinutes + overtimeWithinShift
      } else {
        // 前残業を認める場合：従来通り、シフト勤務時間を超えた分が残業時間
        overtimeMinutes = Math.max(0, netWorkMinutes - shiftWorkMinutes)
      }
      
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

  const handleShowHistory = async (attendanceId: number) => {
    setSelectedAttendanceId(attendanceId)
    setShowHistoryModal(true)
    setLoadingHistory(true)
    try {
      const response = await fetch(`/api/admin/attendances/${attendanceId}/history`)
      if (!response.ok) {
        console.error('Failed to fetch modification logs:', response.status)
        setModificationLogs([])
        return
      }
      const data = await response.json()
      setModificationLogs(data.logs || [])
    } catch (err) {
      console.error('Failed to fetch modification logs:', err)
      setModificationLogs([])
    } finally {
      setLoadingHistory(false)
    }
  }

  const formatFieldName = (field: string) => {
    const fieldNames: { [key: string]: string } = {
      wakeUpTime: '起床時刻',
      departureTime: '出発時刻',
      clockIn: '出勤時刻',
      clockOut: '退勤時刻',
      breakMinutes: '休憩時間',
      clockInLocation: '出勤位置情報',
      clockOutLocation: '退勤位置情報',
      isDeleted: '削除',
    }
    return fieldNames[field] || field
  }

  const formatValue = (value: any, field: string) => {
    if (value === null || value === undefined) return '-'
    if (field.includes('Location')) {
      if (typeof value === 'object') {
        return value.locationName || value.address || '位置情報あり'
      }
      return String(value)
    }
    if (field === 'breakMinutes') {
      return `${value}分`
    }
    if (field.includes('Time')) {
      return String(value)
    }
    return String(value)
  }

  const handleShowAllHistory = async () => {
    setShowAllHistoryModal(true)
    setLoadingAllHistory(true)
    try {
      const params = new URLSearchParams()
      if (selectedEmployeeId) {
        params.append('employee_id', selectedEmployeeId)
      }
      if (startDate) {
        params.append('start_date', startDate)
      }
      if (endDate) {
        params.append('end_date', endDate)
      }

      const response = await fetch(`/api/admin/attendances/modification-logs?${params.toString()}`)
      if (!response.ok) {
        console.error('Failed to fetch all modification logs:', response.status)
        setAllModificationLogs([])
        return
      }
      const data = await response.json()
      setAllModificationLogs(data.logs || [])
    } catch (err) {
      console.error('Failed to fetch all modification logs:', err)
      setAllModificationLogs([])
    } finally {
      setLoadingAllHistory(false)
    }
  }


  const handleDelete = async (id: number) => {
    if (!confirm('この打刻を削除しますか？')) return

    try {
      const response = await fetch(`/api/admin/attendances/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        let errorMessage = '打刻の削除に失敗しました'
        const contentType = response.headers.get('content-type')
        
        if (contentType && contentType.includes('application/json')) {
          try {
            const errorData = await response.json()
            errorMessage = errorData.error || errorData.message || errorMessage
          } catch (parseError) {
            console.error('Failed to parse error response:', parseError)
          }
        } else {
          const errorText = await response.text()
          console.error('Error response text:', errorText)
          
          if (response.status === 405) {
            errorMessage = '削除機能が利用できません。サーバーを更新してください。'
          } else if (response.status === 404) {
            errorMessage = '打刻データが見つかりませんでした。'
          } else if (response.status === 403) {
            errorMessage = '削除する権限がありません。'
          } else if (response.status === 401) {
            errorMessage = '認証が必要です。再度ログインしてください。'
          }
        }
        
        console.error('Delete failed:', {
          status: response.status,
          statusText: response.statusText,
          message: errorMessage,
        })
        alert(`エラー: ${errorMessage} (ステータス: ${response.status})`)
        return
      }

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
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      alert(`打刻の削除に失敗しました: ${errorMessage}`)
    }
  }




  if (status === 'loading' || loading) {
    return <div className="p-8 text-center text-gray-900">読み込み中...</div>
  }

  return (
    <div className="p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">打刻管理</h1>
          <Link
            href="/admin/attendances/new"
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 font-medium inline-block"
          >
            + 打刻を登録
          </Link>
        </div>

        {/* フィルター */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <h2 className="text-lg font-semibold text-gray-900">検索条件</h2>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setViewMode('shifts')
                  // URLパラメータを更新
                  const url = new URL(window.location.href)
                  url.searchParams.set('viewMode', 'shifts')
                  window.history.pushState({}, '', url.toString())
                }}
                className={`px-4 py-2 rounded-md font-medium transition ${
                  viewMode === 'shifts'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                シフト表示
              </button>
              <button
                onClick={() => {
                  setViewMode('attendances')
                  // URLパラメータを更新
                  const url = new URL(window.location.href)
                  url.searchParams.set('viewMode', 'attendances')
                  window.history.pushState({}, '', url.toString())
                }}
                className={`px-4 py-2 rounded-md font-medium transition ${
                  viewMode === 'attendances'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                打刻履歴表示
              </button>
              <button
                onClick={handleShowAllHistory}
                className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 font-medium transition"
              >
                修正履歴
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
                                  {getLocationInfo(attendance.clockInLocation)}
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
                                  {getLocationInfo(attendance.clockOutLocation)}
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {attendance ? `${calculateBreakMinutes(attendance)}分` : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {attendance ? calculateOvertime(attendance, item.shift) : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {attendance ? formatNotes(attendance.notes) : '-'}
                          </td>
                          <td className="px-4 py-3">
                            {attendance ? (
                              <div className="flex gap-2">
                                <Link
                                  href={`/admin/attendances/${attendance.id}/edit?viewMode=${viewMode}`}
                                  className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 inline-block text-center"
                                >
                                  編集
                                </Link>
                                <button
                                  onClick={() => handleDelete(attendance.id)}
                                  className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                                >
                                  削除
                                </button>
                                <button
                                  onClick={() => handleShowHistory(attendance.id)}
                                  className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
                                >
                                  履歴
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  const shiftDate = typeof shift.date === 'string' 
                                ? shift.date.split('T')[0] 
                                : new Date(shift.date).toISOString().split('T')[0]
                              router.push(`/admin/attendances/new?employeeId=${shift.employee.id}&date=${shiftDate}&type=clock_in`)
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
                                {getLocationInfo(attendance.clockInLocation)}
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
                                {getLocationInfo(attendance.clockOutLocation)}
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {calculateBreakMinutes(attendance)}分
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {calculateOvertime(attendance, null)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {formatNotes(attendance.notes)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <Link
                              href={`/admin/attendances/${attendance.id}/edit`}
                              className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 inline-block text-center"
                            >
                              編集
                            </Link>
                            <button
                              onClick={() => handleDelete(attendance.id)}
                              className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                            >
                              削除
                            </button>
                            <button
                              onClick={() => handleShowHistory(attendance.id)}
                              className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
                            >
                              履歴
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

      {/* 修正履歴モーダル */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">修正履歴</h2>
              <button
                onClick={() => {
                  setShowHistoryModal(false)
                  setSelectedAttendanceId(null)
                  setModificationLogs([])
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {loadingHistory ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <p className="text-sm text-gray-600">読み込み中...</p>
                </div>
              ) : modificationLogs.length === 0 ? (
                <div className="text-center py-8 text-gray-600">
                  修正履歴がありません
                </div>
              ) : (
                <div className="space-y-4">
                  {modificationLogs.map((log) => (
                    <div key={log.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="font-semibold text-gray-900">
                            {log.action === 'update' ? '修正' : '削除'}
                          </div>
                          <div className="text-sm text-gray-600 mt-1">
                            {new Date(log.createdAt).toLocaleString('ja-JP', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </div>
                        <div className="text-sm text-gray-600">
                          修正者: {log.modifier.name} ({log.modifier.employeeNumber})
                        </div>
                      </div>
                      {log.action === 'update' && log.changedFields.length > 0 && (
                        <div className="space-y-2">
                          {log.changedFields.map((field) => (
                            <div key={field} className="bg-gray-50 rounded p-3">
                              <div className="font-medium text-gray-900 mb-1">
                                {formatFieldName(field)}
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>
                                  <span className="text-gray-600">変更前: </span>
                                  <span className="text-red-600 font-medium">
                                    {formatValue(log.oldValues?.[field], field)}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-gray-600">変更後: </span>
                                  <span className="text-green-600 font-medium">
                                    {formatValue(log.newValues?.[field], field)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {log.action === 'delete' && (
                        <div className="bg-red-50 rounded p-3">
                          <div className="text-red-800 font-medium">削除されました</div>
                          <div className="text-sm text-gray-600 mt-2">
                            削除前の値:
                          </div>
                          <div className="text-sm text-gray-700 mt-1 space-y-1">
                            {log.oldValues?.wakeUpTime && (
                              <div>起床時刻: {log.oldValues.wakeUpTime}</div>
                            )}
                            {log.oldValues?.departureTime && (
                              <div>出発時刻: {log.oldValues.departureTime}</div>
                            )}
                            {log.oldValues?.clockIn && (
                              <div>出勤時刻: {log.oldValues.clockIn}</div>
                            )}
                            {log.oldValues?.clockOut && (
                              <div>退勤時刻: {log.oldValues.clockOut}</div>
                            )}
                            {log.oldValues?.breakMinutes !== undefined && (
                              <div>休憩時間: {log.oldValues.breakMinutes}分</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 修正履歴一覧モーダル */}
      {showAllHistoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl mx-4 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">修正履歴一覧</h2>
              <button
                onClick={() => {
                  setShowAllHistoryModal(false)
                  setAllModificationLogs([])
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {loadingAllHistory ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <p className="text-sm text-gray-600">読み込み中...</p>
                </div>
              ) : allModificationLogs.length === 0 ? (
                <div className="text-center py-8 text-gray-600">
                  修正履歴がありません
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">日付</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">従業員</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">操作</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">変更内容</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">修正者</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">時刻</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {allModificationLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {log.attendance?.date
                              ? new Date(log.attendance.date).toLocaleDateString('ja-JP', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                })
                              : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {log.attendance?.employee ? (
                              <div>
                                <div className="font-medium">{log.attendance.employee.name}</div>
                                <div className="text-xs text-gray-600">
                                  {log.attendance.employee.employeeNumber}
                                  {log.attendance.employee.department && (
                                    <> / {log.attendance.employee.department}</>
                                  )}
                                </div>
                              </div>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                log.action === 'update'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {log.action === 'update' ? '修正' : '削除'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {log.action === 'update' && log.changedFields.length > 0 ? (
                              <div className="space-y-1">
                                {log.changedFields.slice(0, 3).map((field: string) => (
                                  <div key={field} className="text-xs">
                                    <span className="text-gray-600">{formatFieldName(field)}:</span>{' '}
                                    <span className="text-red-600">
                                      {formatValue(log.oldValues?.[field], field)}
                                    </span>{' '}
                                    →{' '}
                                    <span className="text-green-600">
                                      {formatValue(log.newValues?.[field], field)}
                                    </span>
                                  </div>
                                ))}
                                {log.changedFields.length > 3 && (
                                  <div className="text-xs text-gray-500">
                                    +{log.changedFields.length - 3}件
                                  </div>
                                )}
                              </div>
                            ) : log.action === 'delete' ? (
                              <span className="text-red-600 text-xs">削除されました</span>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            <div>
                              <div className="font-medium">{log.modifier.name}</div>
                              <div className="text-xs text-gray-600">{log.modifier.employeeNumber}</div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {new Date(log.createdAt).toLocaleString('ja-JP', {
                              month: 'numeric',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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

