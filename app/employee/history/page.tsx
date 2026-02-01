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
}

interface ShiftInfo {
  id: number
  date: string
  startTime: string
  endTime: string
  breakMinutes: number
  workLocation: string | null
  workType: string | null
  directDestination: string | null
}

interface AttendanceWithShift {
  attendance: Attendance | null
  shift: ShiftInfo | null
  date: string
}

export default function HistoryPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [attendances, setAttendances] = useState<Attendance[]>([])
  const [shifts, setShifts] = useState<ShiftInfo[]>([])
  const [attendanceWithShifts, setAttendanceWithShifts] = useState<AttendanceWithShift[]>([])
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7)
  )
  const [loading, setLoading] = useState(true)
  const [showMapModal, setShowMapModal] = useState(false)
  const [mapLocation, setMapLocation] = useState<{ latitude: number; longitude: number; locationName?: string } | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const mapInstanceRef = useRef<any>(null)
  const markerInstanceRef = useRef<any>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const [companySettings, setCompanySettings] = useState<{
    allowPreOvertime?: boolean
    workStartTime?: Date | string | null
    workEndTime?: Date | string | null
    standardBreakMinutes?: number
  } | null>(null)

  useEffect(() => {
    if (status === 'authenticated') {
      fetchCompanySettings()
      fetchHistory()
    }
  }, [status, selectedMonth])

  const fetchCompanySettings = async () => {
    try {
      const response = await fetch('/api/settings/display')
      const data = await response.json()
      if (data) {
        setCompanySettings({
          allowPreOvertime: data.allowPreOvertime,
          workStartTime: data.workStartTime,
          workEndTime: data.workEndTime,
          standardBreakMinutes: data.standardBreakMinutes,
        })
      }
    } catch (err) {
      console.error('Failed to fetch company settings:', err)
    }
  }

  const fetchHistory = async () => {
    setLoading(true)
    try {
      // 打刻履歴を取得
      const attendanceResponse = await fetch(`/api/attendance/history?month=${selectedMonth}`)
      const attendanceData = await attendanceResponse.json()
      setAttendances(attendanceData.attendances || [])

      // シフト情報を取得
      const [year, monthNum] = selectedMonth.split('-').map(Number)
      const startDate = new Date(year, monthNum - 1, 1)
      const endDate = new Date(year, monthNum, 0)
      
      const shiftResponse = await fetch(
        `/api/employee/shifts?start_date=${startDate.toISOString().split('T')[0]}&end_date=${endDate.toISOString().split('T')[0]}`
      )
      const shiftData = await shiftResponse.json()
      setShifts(shiftData.shifts || [])

      // 打刻履歴とシフト情報をマージ
      const merged: AttendanceWithShift[] = []
      const attendanceMap: { [key: string]: Attendance } = {}
      const shiftMap: { [key: string]: ShiftInfo } = {}

      // 打刻履歴を日付でマップ
      if (attendanceData.attendances && Array.isArray(attendanceData.attendances)) {
        attendanceData.attendances.forEach((attendance: Attendance) => {
          const dateStr = new Date(attendance.date).toISOString().split('T')[0]
          attendanceMap[dateStr] = attendance
        })
      }

      // シフト情報を日付でマップ
      if (shiftData.shifts && Array.isArray(shiftData.shifts)) {
        shiftData.shifts.forEach((shift: ShiftInfo) => {
          const dateStr = new Date(shift.date).toISOString().split('T')[0]
          shiftMap[dateStr] = shift
        })
      }

      // 選択された月の全ての日をループ
      const currentDate = new Date(startDate)
      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0]
        merged.push({
          date: dateStr,
          attendance: attendanceMap[dateStr] || null,
          shift: shiftMap[dateStr] || null,
        })
        currentDate.setDate(currentDate.getDate() + 1)
      }

      setAttendanceWithShifts(merged)
    } catch (err) {
      console.error('Failed to fetch history:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (time: string | null | Date) => {
    if (!time) return '-'
    
    // Date型の場合は時刻部分を抽出
    if (time instanceof Date) {
      // 無効な日付（1970年1月1日以前）をチェック
      if (isNaN(time.getTime()) || time.getTime() < 0) {
        return '-'
      }
      // 1970-01-01T00:00:00.000Z のようなデフォルト値も無効とみなす
      const epochTime = new Date('1970-01-01T00:00:00.000Z').getTime()
      if (Math.abs(time.getTime() - epochTime) < 1000) {
        return '-'
      }
      const hours = time.getHours().toString().padStart(2, '0')
      const minutes = time.getMinutes().toString().padStart(2, '0')
      return `${hours}:${minutes}`
    }
    
    // 文字列の場合
    if (typeof time === 'string') {
      // 無効な日付文字列をチェック
      if (time.includes('1970-01-01') && (time.includes('00:00:00') || time.includes('T00:00'))) {
        return '-'
      }
      // ISO形式の日時文字列の場合
      if (time.includes('T') || time.includes(' ')) {
        const date = new Date(time)
        if (!isNaN(date.getTime())) {
          // 無効な日付を再チェック
          const epochTime = new Date('1970-01-01T00:00:00.000Z').getTime()
          if (Math.abs(date.getTime() - epochTime) < 1000) {
            return '-'
          }
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
    const d = new Date(date)
    return d.getDate().toString()
  }

  const formatWeekday = (date: string) => {
    const d = new Date(date)
    const weekdays = ['日', '月', '火', '水', '木', '金', '土']
    return weekdays[d.getDay()]
  }

  const calculateBasicTime = (attendance: Attendance) => {
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
      
      // 標準勤務時間（8時間）を考慮して基本と残業を計算
      const standardWorkMinutes = 8 * 60
      const basicMinutes = Math.min(Math.max(0, netWorkMinutes), standardWorkMinutes)
      
      const basicHours = Math.floor(basicMinutes / 60)
      const basicMins = basicMinutes % 60
      return `${basicHours}:${String(basicMins).padStart(2, '0')}`
    } catch (e) {
      console.error('Error calculating basic time:', e)
      return '-'
    }
  }

  const formatBreakTime = (attendance: Attendance) => {
    const breakMinutes = calculateBreakMinutes(attendance)
    const hours = Math.floor(breakMinutes / 60)
    const minutes = breakMinutes % 60
    return `${hours}:${String(minutes).padStart(2, '0')}`
  }

  const calculateWorkTime = (attendance: Attendance) => {
    if (!attendance.clockIn || !attendance.clockOut) return '-'
    
    try {
      const inTime = new Date(attendance.clockIn)
      const outTime = new Date(attendance.clockOut)
      
      if (isNaN(inTime.getTime()) || isNaN(outTime.getTime())) return '-'
      
      const diffMs = outTime.getTime() - inTime.getTime()
      const diffMinutes = Math.floor(diffMs / (1000 * 60)) - (attendance.breakMinutes || 0)
      
      if (diffMinutes < 0) return '-'
      
      const hours = Math.floor(diffMinutes / 60)
      const mins = diffMinutes % 60
      return `${hours}:${mins.toString().padStart(2, '0')}`
    } catch (e) {
      console.error('Error calculating work time:', e)
      return '-'
    }
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

  const calculateOvertime = (attendance: Attendance, shift?: ShiftInfo | null) => {
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
          // shift.startTimeはstring型として定義されている
          const [hours, minutes] = (shift.startTime as string).split(':').map(Number)
          workStartTime = new Date(2000, 0, 1, hours, minutes)
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
          // shift.endTimeはstring型として定義されている
          const [hours, minutes] = (shift.endTime as string).split(':').map(Number)
          workEndTime = new Date(2000, 0, 1, hours, minutes)
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

  if (status === 'loading') {
    return <div className="p-8 text-center text-gray-900">読み込み中...</div>
  }

  return (
    <div className="p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-gray-900">打刻履歴</h1>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <label className="block mb-2 font-semibold text-gray-900">表示月</label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white"
          />
        </div>

        {loading ? (
          <div className="text-center p-8 text-gray-900">読み込み中...</div>
        ) : attendanceWithShifts.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-6 text-center text-gray-700">
            データがありません
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">日</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">曜日</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">区分</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">開始時刻</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">終了時刻</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">基本</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">残業</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">休憩</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">備考</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {attendanceWithShifts.map((item) => {
                    const attendance = item.attendance
                    const shift = item.shift
                    const hasClockIn = attendance?.clockIn && formatTime(attendance.clockIn) !== '-'
                    const hasClockOut = attendance?.clockOut && formatTime(attendance.clockOut) !== '-'
                    const hasShift = shift !== null
                    
                    // 区分: 打刻があれば「出勤」、シフトのみなら「シフト」、どちらもなければ「-」
                    let category = '-'
                    if (hasClockIn && hasClockOut) {
                      category = '出勤'
                    } else if (hasShift) {
                      category = 'シフト'
                    }
                    
                    // 開始時刻: 打刻があれば打刻時刻、なければシフト時刻、どちらもなければ「-」
                    const startTime = hasClockIn 
                      ? formatTime(attendance!.clockIn) 
                      : hasShift 
                        ? shift!.startTime 
                        : '-'
                    
                    // 終了時刻: 打刻があれば打刻時刻、なければシフト時刻、どちらもなければ「-」
                    const endTime = hasClockOut 
                      ? formatTime(attendance!.clockOut) 
                      : hasShift 
                        ? shift!.endTime 
                        : '-'
                    
                    // 基本時間、残業時間、休憩時間は打刻がある場合のみ計算
                    const basicTime = hasClockIn && hasClockOut ? calculateBasicTime(attendance!) : '-'
                    const overtime = hasClockIn && hasClockOut ? calculateOvertime(attendance!, shift) : '-'
                    const breakTime = hasClockIn && hasClockOut 
                      ? formatBreakTime(attendance!) 
                      : hasShift && shift!.breakMinutes > 0
                        ? `${Math.floor(shift!.breakMinutes / 60)}:${String(shift!.breakMinutes % 60).padStart(2, '0')}`
                        : '-'
                    
                    // 備考: 打刻があれば打刻の備考、なければ「-」
                    const notes = attendance ? formatNotes(attendance.notes) : '-'
                    
                    return (
                      <tr key={item.date} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-center text-gray-900">
                          {formatDate(item.date)}
                        </td>
                        <td className="px-4 py-3 text-sm text-center text-gray-900">
                          {formatWeekday(item.date)}
                        </td>
                        <td className="px-4 py-3 text-sm text-center text-gray-900">
                          {category}
                        </td>
                        <td className="px-4 py-3 text-sm text-center text-gray-900">
                          {startTime}
                        </td>
                        <td className="px-4 py-3 text-sm text-center text-gray-900">
                          {endTime}
                        </td>
                        <td className="px-4 py-3 text-sm text-center text-gray-900">
                          {basicTime}
                        </td>
                        <td className="px-4 py-3 text-sm text-center text-gray-900">
                          {overtime}
                        </td>
                        <td className="px-4 py-3 text-sm text-center text-gray-900">
                          {breakTime}
                        </td>
                        <td className="px-4 py-3 text-sm text-center text-gray-900">
                          {notes}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
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

