'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface Report {
  employee: {
    id: number
    name: string
    employeeNumber: string
    department: string | null
    position: string | null
    workLocation: string | null // 店舗名（従業員テーブルから）
    locationName: string | null // 店舗名（レポートAPIから）
  }
  totalWorkDays: number
  totalWorkHours: number
  totalWorkMinutes: number
  totalOvertimeHours: number
  totalOvertimeMinutes: number
  totalBreakMinutes: number
  overtime40Hours: number
  overtime60Hours: number
  attendances: any[]
}

interface SalesVisitReport {
  employee: {
    id: number
    name: string
    employeeNumber: string
    department: string | null
    position: string | null
  }
  totalVisits: number
  totalVisitHours: number
  totalVisitMinutes: number
  visits: any[]
}

interface Employee {
  id: number
  name: string
  employeeNumber: string
  department: string | null
}

export default function AdminReportsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [reportType, setReportType] = useState<'attendance' | 'sales-visit'>('attendance')
  const [reports, setReports] = useState<Report[]>([])
  const [salesVisitReports, setSalesVisitReports] = useState<SalesVisitReport[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(false)
  const [enableSalesVisit, setEnableSalesVisit] = useState(true)
  const [companySettings, setCompanySettings] = useState<{
    allowPreOvertime?: boolean
    workStartTime?: Date | string | null
    workEndTime?: Date | string | null
    standardBreakMinutes?: number
  } | null>(null)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('')
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7)
  )
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [period, setPeriod] = useState<{ start: string; end: string } | null>(null)
  const [selectedEmployeeForTimesheet, setSelectedEmployeeForTimesheet] = useState<number | null>(null)
  const [selectedSalesVisitEmployee, setSelectedSalesVisitEmployee] = useState<number | null>(null)
  const [shifts, setShifts] = useState<Record<string, any>>({})
  
  // URLクエリパラメータから従業員IDを取得（URL変更を監視）
  useEffect(() => {
    const updateFromURL = () => {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search)
        const employeeIdParam = params.get('employee_id')
        if (employeeIdParam) {
          setSelectedEmployeeForTimesheet(parseInt(employeeIdParam))
        } else {
          setSelectedEmployeeForTimesheet(null)
        }
      }
    }
    
    updateFromURL()
    
    // URL変更を監視（ブラウザの戻る/進むボタン対応）
    window.addEventListener('popstate', updateFromURL)
    
    // 定期的にURLをチェック（router.push後の変更を検知）
    const interval = setInterval(updateFromURL, 100)
    
    return () => {
      window.removeEventListener('popstate', updateFromURL)
      clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated') {
      const isAdmin = session?.user.role === 'admin'
      const isSuperAdmin = session?.user.role === 'super_admin' || 
                          session?.user.email === 'superadmin@rakupochi.com'
      
      if (isAdmin || (isSuperAdmin && session?.user.selectedCompanyId)) {
        fetchEmployees()
        fetchSettings()
        fetchReports()
      }
    }
  }, [status, session])

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/admin/settings')
      const data = await response.json()
      if (data.settings) {
        setEnableSalesVisit(data.settings.enableSalesVisit ?? true)
        setCompanySettings({
          allowPreOvertime: data.settings.allowPreOvertime,
          workStartTime: data.settings.workStartTime,
          workEndTime: data.settings.workEndTime,
          standardBreakMinutes: data.settings.standardBreakMinutes,
        })
        // 営業先入退店機能が無効の場合は、入退店記録レポートタブが選択されていたら打刻レポートに戻す
        if (!data.settings.enableSalesVisit && reportType === 'sales-visit') {
          setReportType('attendance')
        }
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err)
    }
  }

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/admin/employees')
      const data = await response.json()
      setEmployees(data.employees || [])
    } catch (err) {
      console.error('Failed to fetch employees:', err)
    }
  }
  
  const fetchShifts = useCallback(async (period: { start: string; end: string }, employeeId?: string) => {
    try {
      const params = new URLSearchParams()
      if (employeeId) {
        params.append('employee_id', employeeId)
      }
      if (period.start) {
        params.append('start_date', period.start)
      }
      if (period.end) {
        params.append('end_date', period.end)
      }
      
      const response = await fetch(`/api/admin/shifts?${params.toString()}`)
      const data = await response.json()
      
      // シフト情報を日付をキーとしたマップに変換
      const shiftMap: Record<string, any> = {}
      if (data.shifts && Array.isArray(data.shifts)) {
        data.shifts.forEach((shift: any) => {
          const dateStr = shift.date
          if (dateStr) {
            shiftMap[dateStr] = {
              startTime: shift.startTime,
              endTime: shift.endTime,
              breakMinutes: shift.breakMinutes || 0,
            }
          }
        })
      }
      setShifts(shiftMap)
    } catch (err) {
      console.error('Failed to fetch shifts:', err)
    }
  }, [])

  const fetchReports = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      // selectedEmployeeForTimesheetが設定されている場合はそれを優先
      const employeeIdToUse = selectedEmployeeForTimesheet 
        ? selectedEmployeeForTimesheet.toString() 
        : selectedEmployeeId
      if (employeeIdToUse) {
        params.append('employee_id', employeeIdToUse)
      }
      if (selectedMonth && !startDate && !endDate) {
        params.append('month', selectedMonth)
      } else {
        if (startDate) {
          params.append('start_date', startDate)
        }
        if (endDate) {
          params.append('end_date', endDate)
        }
      }

      const response = await fetch(`/api/admin/reports?${params.toString()}`)
      const data = await response.json()
      setReports(data.reports || [])
      setPeriod(data.period || null)
      
      // シフト情報を取得（残業時間の計算に必要）
      const periodToUse = data.period || { 
        start: startDate || (selectedMonth ? `${selectedMonth}-01` : new Date().toISOString().split('T')[0]), 
        end: endDate || (selectedMonth ? new Date(new Date(`${selectedMonth}-01`).getFullYear(), new Date(`${selectedMonth}-01`).getMonth() + 1, 0).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]) 
      }
      await fetchShifts(periodToUse, employeeIdToUse)
    } catch (err) {
      console.error('Failed to fetch reports:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchSalesVisitReports = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedEmployeeId) {
        params.append('employee_id', selectedEmployeeId)
      }
      if (selectedMonth && !startDate && !endDate) {
        params.append('month', selectedMonth)
      } else {
        if (startDate) {
          params.append('start_date', startDate)
        }
        if (endDate) {
          params.append('end_date', endDate)
        }
      }

      const response = await fetch(`/api/admin/sales-visit-reports?${params.toString()}`)
      const data = await response.json()
      setSalesVisitReports(data.reports || [])
      setPeriod(data.period || null)
    } catch (err) {
      console.error('Failed to fetch sales visit reports:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (status === 'authenticated') {
      const isAdmin = session?.user.role === 'admin'
      const isSuperAdmin = session?.user.role === 'super_admin' || 
                          session?.user.email === 'superadmin@rakupochi.com'
      
      if (isAdmin || (isSuperAdmin && session?.user.selectedCompanyId)) {
        if (reportType === 'attendance') {
          fetchReports()
        } else if (enableSalesVisit) {
          fetchSalesVisitReports()
        }
      }
    }
  }, [selectedEmployeeId, selectedMonth, startDate, endDate, reportType, enableSalesVisit])
  
  // 選択された従業員が変更されたときにシフト情報を取得
  useEffect(() => {
    if (selectedEmployeeForTimesheet && period) {
      fetchShifts(period, selectedEmployeeForTimesheet.toString())
    }
  }, [selectedEmployeeForTimesheet, period, fetchShifts])

  const formatTime = (hours: number | null | undefined, minutes: number | null | undefined) => {
    const h = hours ?? 0
    const m = minutes ?? 0
    if (h === 0 && m === 0) return '0時間'
    if (m === 0) return `${h}時間`
    return `${h}時間${m}分`
  }

  const formatTimeForPDF = (hours: number, minutes: number) => {
    const h = hours ?? 0
    const m = minutes ?? 0
    if (h === 0 && m === 0) return '0:00'
    return `${h}:${String(m).padStart(2, '0')}`
  }

  const formatDateForPDF = (date: string) => {
    const d = new Date(date)
    const month = d.getMonth() + 1
    const day = d.getDate()
    const weekdays = ['日', '月', '火', '水', '木', '金', '土']
    const weekday = weekdays[d.getDay()]
    return `${month}/${day}(${weekday})`
  }

  const formatTimeFromString = (timeStr: string | null | Date) => {
    if (!timeStr) return '-'
    if (typeof timeStr === 'string') {
      // 文字列の場合（HH:MM:SS形式またはHH:MM形式）
      if (timeStr.includes(':')) {
        return timeStr.slice(0, 5) // HH:MMのみ返す
      }
      // ISO形式の日時文字列の場合
      if (timeStr.includes('T') || timeStr.includes(' ')) {
        const date = new Date(timeStr)
        if (!isNaN(date.getTime())) {
          const hours = date.getHours().toString().padStart(2, '0')
          const minutes = date.getMinutes().toString().padStart(2, '0')
          return `${hours}:${minutes}`
        }
      }
    }
    if (timeStr instanceof Date) {
      // Date型の場合は、ローカル時間を使用
      const hours = timeStr.getHours().toString().padStart(2, '0')
      const minutes = timeStr.getMinutes().toString().padStart(2, '0')
      return `${hours}:${minutes}`
    }
    return '-'
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

  const exportToPDF = () => {
    if (reports.length === 0) {
      alert('エクスポートするデータがありません')
      return
    }

    // 各従業員ごとにPDFを生成
    reports.forEach((report) => {
      const doc = new jsPDF({
        orientation: 'landscape', // 横向き
        unit: 'mm',
        format: 'a4',
      })

      // ヘッダー情報
      const month = selectedMonth
        ? `${selectedMonth.split('-')[0]}年 ${parseInt(selectedMonth.split('-')[1])}月`
        : period
        ? `${new Date(period.start).getFullYear()}年 ${new Date(period.start).getMonth() + 1}月`
        : `${new Date().getFullYear()}年 ${new Date().getMonth() + 1}月`

      // タイトルとヘッダー情報
      // 店舗があれば店舗、なければ部署を表示
      const displayLocation = report.employee.workLocation || report.employee.locationName || report.employee.department || '-'
      doc.setFontSize(10)
      doc.text(displayLocation, 14, 15)
      doc.text(`氏名: ${report.employee.name}`, 150, 22)
      doc.text(month, 14, 28)

      // 日次データの準備
      const tableData: any[] = []
      let totalBasicHours = 0
      let totalBasicMinutes = 0
      let totalOvertimeHours = 0
      let totalOvertimeMinutes = 0
      let totalBreakMinutes = 0

      // 期間内の各日を処理
      const start = period
        ? new Date(period.start)
        : selectedMonth
        ? new Date(`${selectedMonth}-01`)
        : new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      const end = period
        ? new Date(period.end)
        : selectedMonth
        ? new Date(
            new Date(`${selectedMonth}-01`).getFullYear(),
            new Date(`${selectedMonth}-01`).getMonth() + 1,
            0
          )
        : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)

      // 各日のデータを取得
      const dailyData: Record<string, any> = {}
      if (report.attendances && Array.isArray(report.attendances)) {
        report.attendances.forEach((attendance: any) => {
          const dateStr = new Date(attendance.date).toISOString().split('T')[0]
          dailyData[dateStr] = attendance
        })
      }

      // 日付ごとにループ
      const currentDate = new Date(start)
      while (currentDate <= end) {
        const dateStr = currentDate.toISOString().split('T')[0]
        const attendance = dailyData[dateStr]
        const day = currentDate.getDate()
        const weekdays = ['日', '月', '火', '水', '木', '金', '土']
        const weekday = weekdays[currentDate.getDay()]

        if (attendance && attendance.clockIn && attendance.clockOut) {
          const clockIn = formatTimeFromString(attendance.clockIn)
          const clockOut = formatTimeFromString(attendance.clockOut)

          // 勤務時間を計算（8時間以内は基本、超過分は残業）
          const inTime = new Date(`2000-01-01T${clockIn}`)
          const outTime = new Date(`2000-01-01T${clockOut}`)
          const diffMs = outTime.getTime() - inTime.getTime()
          const totalMinutes = Math.floor(diffMs / (1000 * 60)) - (attendance.breakMinutes || 0)

          const basicMinutes = Math.min(totalMinutes, 8 * 60)
          const overtimeMinutes = Math.max(0, totalMinutes - 8 * 60)

          const basicHours = Math.floor(basicMinutes / 60)
          const basicMins = basicMinutes % 60
          const overtimeHrs = Math.floor(overtimeMinutes / 60)
          const overtimeMins = overtimeMinutes % 60

          totalBasicHours += basicHours
          totalBasicMinutes += basicMins
          totalOvertimeHours += overtimeHrs
          totalOvertimeMinutes += overtimeMins
          totalBreakMinutes += attendance.breakMinutes || 0

          tableData.push([
            day.toString(),
            weekday,
            '出勤',
            clockIn,
            clockOut,
            `${basicHours}:${String(basicMins).padStart(2, '0')}`,
            `${overtimeHrs}:${String(overtimeMins).padStart(2, '0')}`,
            `${Math.floor((attendance.breakMinutes || 0) / 60)}:${String((attendance.breakMinutes || 0) % 60).padStart(2, '0')}`,
            formatNotes(attendance.notes),
          ])
        } else {
          tableData.push([day.toString(), weekday, '-', '-', '-', '-', '-', '-', '-'])
        }

        currentDate.setDate(currentDate.getDate() + 1)
      }

      // 合計を計算
      totalBasicHours += Math.floor(totalBasicMinutes / 60)
      totalBasicMinutes = totalBasicMinutes % 60
      totalOvertimeHours += Math.floor(totalOvertimeMinutes / 60)
      totalOvertimeMinutes = totalOvertimeMinutes % 60
      const totalBreakHours = Math.floor(totalBreakMinutes / 60)
      const totalBreakMins = totalBreakMinutes % 60

      // テーブルを追加（1枚に収まるように調整）
      autoTable(doc, {
        startY: 45,
        head: [['日', '曜日', '区分', '開始時刻', '終了時刻', '基本', '残業', '休憩', '備考']],
        body: tableData,
        foot: [
          [
            '合計',
            '',
            '',
            '',
            '',
            `${totalBasicHours}:${String(totalBasicMinutes).padStart(2, '0')}`,
            `${totalOvertimeHours}:${String(totalOvertimeMinutes).padStart(2, '0')}`,
            `${totalBreakHours}:${String(totalBreakMins).padStart(2, '0')}`,
            '',
          ],
        ],
        theme: 'grid',
        headStyles: { fillColor: [200, 200, 200], textColor: [0, 0, 0], fontStyle: 'bold' },
        footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
        styles: { 
          fontSize: 7, 
          cellPadding: 1.5,
          overflow: 'linebreak',
        },
        margin: { left: 10, right: 10, top: 35 },
        tableWidth: 'auto',
        columnStyles: {
          0: { cellWidth: 10 }, // 日
          1: { cellWidth: 10 }, // 曜日
          2: { cellWidth: 15 }, // 区分
          3: { cellWidth: 18 }, // 開始時刻
          4: { cellWidth: 18 }, // 終了時刻
          5: { cellWidth: 15 }, // 基本
          6: { cellWidth: 15 }, // 残業
          7: { cellWidth: 15 }, // 休憩
          8: { cellWidth: 20 }, // 備考
        },
        // 1枚に収めるための設定
        didParseCell: (data) => {
          // セルの高さを最小限に
          if (data.row.index >= 0) {
            data.cell.styles.minCellHeight = 5
          }
        },
      })

      // PDFを保存
      const fileName = `タイムシート_${report.employee.name}_${month.replace(/\s/g, '')}.pdf`
      doc.save(fileName)
    })
  }

  const exportToCSV = () => {
    if (reportType === 'attendance') {
      if (reports.length === 0) {
        alert('エクスポートするデータがありません')
        return
      }

      const headers = [
        '社員番号',
        '氏名',
        '部署',
        '役職',
        '出勤日数',
        '総勤務時間',
        '残業時間',
        '休憩時間',
        '40時間超残業',
        '60時間超残業',
      ]

      const rows = reports.map((report) => [
        report.employee.employeeNumber,
        report.employee.name,
        report.employee.department || '',
        report.employee.position || '',
        report.totalWorkDays.toString(),
        formatTime(report.totalWorkHours, report.totalWorkMinutes),
        formatTime(report.totalOvertimeHours, report.totalOvertimeMinutes),
        `${report.totalBreakMinutes}分`,
        `${report.overtime40Hours}時間`,
        `${report.overtime60Hours}時間`,
      ])

      const csvContent = [
        headers.join(','),
        ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
      ].join('\n')

      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `勤怠レポート_${period?.start || 'report'}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } else {
      if (salesVisitReports.length === 0) {
        alert('エクスポートするデータがありません')
        return
      }

      const headers = [
        '社員番号',
        '氏名',
        '部署',
        '役職',
        '訪問先',
        '担当者',
        '訪問回数（累計）',
        '総滞在時間',
      ]

      const rows = salesVisitReports.map((report) => {
        // 訪問先と担当者を集計（最も多いものを表示）
        const visitCompanies = report.visits.map((v: any) => v.companyName)
        const visitContactPersons = report.visits
          .map((v: any) => v.contactPersonName)
          .filter((name: string | null) => name && name.trim() !== '')
        
        // 最も多い訪問先
        const companyCounts: Record<string, number> = {}
        visitCompanies.forEach((company: string) => {
          companyCounts[company] = (companyCounts[company] || 0) + 1
        })
        const mostVisitedCompany = Object.keys(companyCounts).reduce((a, b) => 
          companyCounts[a] > companyCounts[b] ? a : b, visitCompanies[0] || '-'
        )
        
        // 最も多い担当者
        const contactPersonCounts: Record<string, number> = {}
        visitContactPersons.forEach((person: string) => {
          contactPersonCounts[person] = (contactPersonCounts[person] || 0) + 1
        })
        const mostCommonContactPerson = visitContactPersons.length > 0
          ? Object.keys(contactPersonCounts).reduce((a, b) => 
              contactPersonCounts[a] > contactPersonCounts[b] ? a : b, visitContactPersons[0] || '-'
            )
          : '-'
        
        return [
          report.employee.employeeNumber,
          report.employee.name,
          report.employee.department || '',
          report.employee.position || '',
          mostVisitedCompany,
          mostCommonContactPerson,
          report.totalVisits.toString(),
          formatTime(report.totalVisitHours, report.totalVisitMinutes),
        ]
      })

      const csvContent = [
        headers.join(','),
        ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
      ].join('\n')

      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `入退店記録レポート_${period?.start || 'report'}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }


  const resetFilters = () => {
    setSelectedEmployeeId('')
    setSelectedMonth(new Date().toISOString().slice(0, 7))
    setStartDate('')
    setEndDate('')
  }

  if (status === 'loading' || loading) {
    return <div className="p-8 text-center text-gray-900">読み込み中...</div>
  }

  return (
    <div className="p-4">
      <div className="max-w-7xl mx-auto">
        {/* タブ */}
        {enableSalesVisit && (
          <div className="mb-6 no-print">
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => {
                  setReportType('attendance')
                  setSelectedEmployeeForTimesheet(null)
                }}
                className={`px-6 py-3 font-medium text-sm ${
                  reportType === 'attendance'
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                打刻レポート
              </button>
              <button
                onClick={() => {
                  setReportType('sales-visit')
                  setSelectedEmployeeForTimesheet(null)
                }}
                className={`px-6 py-3 font-medium text-sm ${
                  reportType === 'sales-visit'
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                入退店記録レポート
              </button>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 mb-6 no-print">
          {((reportType === 'attendance' && reports.length > 0) || 
            (reportType === 'sales-visit' && salesVisitReports.length > 0)) && (
            <>
              <button
                onClick={exportToCSV}
                className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 font-medium"
              >
                CSVエクスポート
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 font-medium"
              >
                印刷
              </button>
            </>
          )}
        </div>

        {/* フィルター */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6 no-print">
          <h2 className="text-lg font-semibold mb-4 text-gray-900">検索条件</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                従業員
              </label>
              <select
                value={selectedEmployeeId}
                onChange={(e) => {
                  setSelectedEmployeeId(e.target.value)
                  setStartDate('')
                  setEndDate('')
                }}
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
                月を選択
              </label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => {
                  setSelectedMonth(e.target.value)
                  setStartDate('')
                  setEndDate('')
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                開始日
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  setSelectedMonth('')
                }}
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
                onChange={(e) => {
                  setEndDate(e.target.value)
                  setSelectedMonth('')
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
              />
            </div>
          </div>
          <div className="mt-4">
            <button
              onClick={resetFilters}
              className="px-4 py-2 bg-gray-200 text-gray-900 rounded-md hover:bg-gray-300 font-medium"
            >
              リセット
            </button>
          </div>
        </div>

        {/* 期間表示 */}
        {period && (
          <div className="bg-blue-50 rounded-lg p-4 mb-6 no-print">
            <div className="text-sm text-gray-700">
              対象期間: {period.start} ～ {period.end}
            </div>
          </div>
        )}

        {/* レポート一覧（画面表示用） */}
        {!selectedEmployeeForTimesheet && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden no-print">
          {reportType === 'attendance' ? (
            reports.length === 0 ? (
              <div className="p-6 text-center text-gray-700">
                レポートデータがありません
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                        社員番号
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                        氏名
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                        部署
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                        役職
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                        出勤日数
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                        総勤務時間
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                        残業時間
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                        休憩時間
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                        40時間超
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                        60時間超
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {reports.map((report) => (
                    <tr key={report.employee.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {report.employee.employeeNumber}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium">
                        <button
                          onClick={() => {
                            // URLクエリパラメータを更新してページ遷移
                            const params = new URLSearchParams(window.location.search)
                            params.set('employee_id', report.employee.id.toString())
                            const newUrl = `/admin/reports?${params.toString()}`
                            router.push(newUrl)
                            // 状態を即座に更新
                            setSelectedEmployeeForTimesheet(report.employee.id)
                            // スクロールをトップに移動
                            setTimeout(() => {
                              window.scrollTo({ top: 0, behavior: 'smooth' })
                            }, 100)
                          }}
                          className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                        >
                          {report.employee.name}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {report.employee.workLocation || report.employee.locationName || report.employee.department || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {report.employee.position || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">
                        {report.totalWorkDays}日
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">
                        {formatTime(report.totalWorkHours, report.totalWorkMinutes)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        <span
                          className={
                            report.totalOvertimeHours > 0
                              ? 'text-red-600 font-medium'
                              : 'text-gray-900'
                          }
                        >
                          {formatTime(report.totalOvertimeHours, report.totalOvertimeMinutes)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">
                        {report.totalBreakMinutes}分
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        <span
                          className={
                            report.overtime40Hours > 0
                              ? 'text-orange-600 font-medium'
                              : 'text-gray-900'
                          }
                        >
                          {report.overtime40Hours}時間
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        <span
                          className={
                            report.overtime60Hours > 0
                              ? 'text-red-600 font-medium'
                              : 'text-gray-900'
                          }
                        >
                          {report.overtime60Hours}時間
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
          ) : (
            salesVisitReports.length === 0 ? (
              <div className="p-6 text-center text-gray-700">
                レポートデータがありません
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                        社員番号
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                        氏名
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                        部署
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                        役職
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                        訪問先
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                        担当者
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                        訪問理由
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                        訪問回数（累計）
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                        総滞在時間
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {salesVisitReports.map((report) => {
                      // 訪問先、担当者、訪問理由を集計（最も多いものを表示）
                      const visitCompanies = report.visits.map((v: any) => v.companyName)
                      const visitContactPersons = report.visits
                        .map((v: any) => v.contactPersonName)
                        .filter((name: string | null) => name && name.trim() !== '')
                      const visitPurposes = report.visits.map((v: any) => v.purpose)
                      
                      // 最も多い訪問先
                      const companyCounts: Record<string, number> = {}
                      visitCompanies.forEach((company: string) => {
                        companyCounts[company] = (companyCounts[company] || 0) + 1
                      })
                      const mostVisitedCompany = Object.keys(companyCounts).reduce((a, b) => 
                        companyCounts[a] > companyCounts[b] ? a : b, visitCompanies[0] || '-'
                      )
                      
                      // 最も多い担当者
                      const contactPersonCounts: Record<string, number> = {}
                      visitContactPersons.forEach((person: string) => {
                        contactPersonCounts[person] = (contactPersonCounts[person] || 0) + 1
                      })
                      const mostCommonContactPerson = visitContactPersons.length > 0
                        ? Object.keys(contactPersonCounts).reduce((a, b) => 
                            contactPersonCounts[a] > contactPersonCounts[b] ? a : b, visitContactPersons[0] || '-'
                          )
                        : '-'
                      
                      // 最も多い訪問理由
                      const purposeCounts: Record<string, number> = {}
                      visitPurposes.forEach((purpose: string) => {
                        purposeCounts[purpose] = (purposeCounts[purpose] || 0) + 1
                      })
                      const mostCommonPurpose = Object.keys(purposeCounts).reduce((a, b) => 
                        purposeCounts[a] > purposeCounts[b] ? a : b, visitPurposes[0] || '-'
                      )
                      
                      const getPurposeLabel = (purpose: string) => {
                        const labels: { [key: string]: string } = {
                          '商談': '商談',
                          '見積': '見積',
                          'アフターサービス': 'アフターサービス',
                          'その他': 'その他',
                        }
                        return labels[purpose] || purpose
                      }
                      
                      return (
                        <tr 
                          key={report.employee.id} 
                          className="hover:bg-gray-50 cursor-pointer"
                          onClick={() => setSelectedSalesVisitEmployee(
                            selectedSalesVisitEmployee === report.employee.id ? null : report.employee.id
                          )}
                        >
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {report.employee.employeeNumber}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {report.employee.name}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {report.employee.department || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {report.employee.position || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {mostVisitedCompany}
                            {visitCompanies.length > 1 && (
                              <span className="text-xs text-gray-500 ml-1">
                                (他{visitCompanies.length - 1}件)
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {mostCommonContactPerson}
                            {visitContactPersons.length > 1 && (
                              <span className="text-xs text-gray-500 ml-1">
                                (他{visitContactPersons.length - 1}件)
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {getPurposeLabel(mostCommonPurpose)}
                            {visitPurposes.length > 1 && (
                              <span className="text-xs text-gray-500 ml-1">
                                (他{visitPurposes.length - 1}件)
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900">
                            {report.totalVisits}回
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900">
                            {formatTime(report.totalVisitHours, report.totalVisitMinutes)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
        )}

        {/* 営業先訪問詳細表示 */}
        {selectedSalesVisitEmployee && salesVisitReports.length > 0 && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6 no-print">
            {salesVisitReports
              .filter((r) => r.employee.id === selectedSalesVisitEmployee)
              .map((report) => {
                const formatDate = (date: string) => {
                  const d = new Date(date)
                  return d.toLocaleDateString('ja-JP', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    weekday: 'short',
                  })
                }

                const getPurposeLabel = (purpose: string) => {
                  const labels: { [key: string]: string } = {
                    '商談': '商談',
                    '見積': '見積',
                    'アフターサービス': 'アフターサービス',
                    'その他': 'その他',
                  }
                  return labels[purpose] || purpose
                }

                return (
                  <div key={report.employee.id} className="p-6">
                    <div className="mb-4 flex justify-between items-center">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {report.employee.name} ({report.employee.employeeNumber}) の訪問詳細
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {report.employee.department || '-'} {report.employee.position ? `・ ${report.employee.position}` : ''}
                        </p>
                      </div>
                      <button
                        onClick={() => setSelectedSalesVisitEmployee(null)}
                        className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        × 閉じる
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse border border-gray-300">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-900">日付</th>
                            <th className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-900">訪問先</th>
                            <th className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-900">担当者</th>
                            <th className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-900">訪問理由</th>
                            <th className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-900">入店時刻</th>
                            <th className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-900">退店時刻</th>
                            <th className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-900">滞在時間</th>
                            <th className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-900">商談内容</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.visits
                            .sort((a: any, b: any) => {
                              const dateA = new Date(a.date).getTime()
                              const dateB = new Date(b.date).getTime()
                              if (dateA !== dateB) return dateB - dateA
                              // 同じ日付の場合は時刻でソート
                              const timeA = a.entryTime || '00:00:00'
                              const timeB = b.entryTime || '00:00:00'
                              return timeB.localeCompare(timeA)
                            })
                            .map((visit: any, idx: number) => {
                              // 滞在時間を計算
                              let stayDuration = '-'
                              if (visit.entryTime && visit.exitTime) {
                                const [entryHours, entryMinutes] = visit.entryTime.split(':').map(Number)
                                const [exitHours, exitMinutes] = visit.exitTime.split(':').map(Number)
                                
                                const entryTime = new Date(`2000-01-01T${String(entryHours).padStart(2, '0')}:${String(entryMinutes).padStart(2, '0')}:00`)
                                const exitTime = new Date(`2000-01-01T${String(exitHours).padStart(2, '0')}:${String(exitMinutes).padStart(2, '0')}:00`)
                                
                                let exitTimeAdjusted = exitTime
                                if (exitTime.getTime() < entryTime.getTime()) {
                                  exitTimeAdjusted = new Date(`2000-01-02T${String(exitHours).padStart(2, '0')}:${String(exitMinutes).padStart(2, '0')}:00`)
                                }
                                
                                const diffMs = exitTimeAdjusted.getTime() - entryTime.getTime()
                                const stayMinutes = Math.floor(diffMs / (1000 * 60))
                                const hours = Math.floor(stayMinutes / 60)
                                const minutes = stayMinutes % 60
                                stayDuration = hours > 0 ? `${hours}時間${minutes}分` : `${minutes}分`
                              }

                              return (
                                <tr key={idx} className="hover:bg-gray-50">
                                  <td className="border border-gray-300 px-3 py-2 text-sm text-center text-gray-900">
                                    {formatDate(visit.date)}
                                  </td>
                                  <td className="border border-gray-300 px-3 py-2 text-sm text-gray-900">
                                    {visit.companyName}
                                  </td>
                                  <td className="border border-gray-300 px-3 py-2 text-sm text-gray-900">
                                    {visit.contactPersonName || '-'}
                                  </td>
                                  <td className="border border-gray-300 px-3 py-2 text-sm text-center text-gray-900">
                                    {getPurposeLabel(visit.purpose)}
                                  </td>
                                  <td className="border border-gray-300 px-3 py-2 text-sm text-center text-gray-900">
                                    {visit.entryTime ? visit.entryTime.slice(0, 5) : '-'}
                                  </td>
                                  <td className="border border-gray-300 px-3 py-2 text-sm text-center text-gray-900">
                                    {visit.exitTime ? visit.exitTime.slice(0, 5) : '-'}
                                  </td>
                                  <td className="border border-gray-300 px-3 py-2 text-sm text-center text-gray-900">
                                    {stayDuration}
                                  </td>
                                  <td className="border border-gray-300 px-3 py-2 text-sm text-gray-900">
                                    {visit.meetingNotes ? (
                                      <div className="max-w-xs">
                                        <div className="text-xs text-gray-600 whitespace-pre-wrap break-words">
                                          {visit.meetingNotes}
                                        </div>
                                      </div>
                                    ) : (
                                      '-'
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })}
          </div>
        )}

        {/* 個人タイムシート表示（画面表示用） */}
        {selectedEmployeeForTimesheet && reports.length > 0 && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6 no-print">
            {reports
              .filter((r) => r.employee.id === selectedEmployeeForTimesheet)
              .map((report) => {
                const month = selectedMonth
                  ? `${selectedMonth.split('-')[0]}年 ${parseInt(selectedMonth.split('-')[1])}月`
                  : period
                  ? `${new Date(period.start).getFullYear()}年 ${new Date(period.start).getMonth() + 1}月`
                  : `${new Date().getFullYear()}年 ${new Date().getMonth() + 1}月`

                const start = period
                  ? new Date(period.start)
                  : selectedMonth
                  ? new Date(`${selectedMonth}-01`)
                  : new Date(new Date().getFullYear(), new Date().getMonth(), 1)
                const end = period
                  ? new Date(period.end)
                  : selectedMonth
                  ? new Date(
                      new Date(`${selectedMonth}-01`).getFullYear(),
                      new Date(`${selectedMonth}-01`).getMonth() + 1,
                      0
                    )
                  : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)

                const dailyData: Record<string, any> = {}
                if (report.attendances && Array.isArray(report.attendances)) {
                  report.attendances.forEach((attendance: any) => {
                    const dateStr = new Date(attendance.date).toISOString().split('T')[0]
                    dailyData[dateStr] = attendance
                  })
                }

                const tableData: any[] = []
                let totalBasicHours = 0
                let totalBasicMinutes = 0
                let totalOvertimeHours = 0
                let totalOvertimeMinutes = 0
                let totalBreakMinutes = 0

                const currentDate = new Date(start)
                while (currentDate <= end) {
                  const dateStr = currentDate.toISOString().split('T')[0]
                  const attendance = dailyData[dateStr]
                  const day = currentDate.getDate()
                  const weekdays = ['日', '月', '火', '水', '木', '金', '土']
                  const weekday = weekdays[currentDate.getDay()]

                  if (attendance && attendance.clockIn && attendance.clockOut) {
                    // 時刻を文字列として取得（APIから返される形式：HH:MM:SS）
                    // APIからは既に文字列形式で返されているはず
                    let clockIn = ''
                    let clockOut = ''
                    
                    if (typeof attendance.clockIn === 'string') {
                      clockIn = attendance.clockIn.slice(0, 5) // HH:MM形式
                    } else if (attendance.clockIn instanceof Date) {
                      // Date型の場合は文字列に変換（念のため）
                      const timeStr = attendance.clockIn.toISOString().split('T')[1]?.split('.')[0] || ''
                      clockIn = timeStr.slice(0, 5)
                    }
                    
                    if (typeof attendance.clockOut === 'string') {
                      clockOut = attendance.clockOut.slice(0, 5) // HH:MM形式
                    } else if (attendance.clockOut instanceof Date) {
                      const timeStr = attendance.clockOut.toISOString().split('T')[1]?.split('.')[0] || ''
                      clockOut = timeStr.slice(0, 5)
                    }

                    // 日をまたぐ勤務時間を正しく計算
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
                    let breakMinutes = attendance.breakMinutes || 0
                    if (breakMinutes === 0 && totalWorkMinutes >= 6 * 60) {
                      breakMinutes = 60 // 6時間以上の場合は自動的に60分の休憩
                    }
                    const netWorkMinutes = Math.max(0, totalWorkMinutes - breakMinutes)

                    // 企業設定を取得（前残業を認める設定、デフォルトはfalse）
                    const allowPreOvertime = companySettings?.allowPreOvertime === true
                    
                    // シフト情報を取得
                    const shift = shifts[dateStr]
                    
                    // 基本時間と残業時間を計算
                    let basicMinutes: number
                    let overtimeMinutes: number
                    
                    // シフトが登録されている場合のみシフト時間を使用
                    if (shift?.startTime && shift?.endTime) {
                      // 標準始業時刻・終業時刻を取得（デフォルト値）
                      const defaultWorkStart = new Date('2000-01-01T09:00:00')
                      const defaultWorkEnd = new Date('2000-01-01T18:00:00')
                      
                      let workStartTime = defaultWorkStart
                      let workEndTime = defaultWorkEnd
                      
                      // シフト情報があればシフト時間を使用、なければ企業設定の標準時間を使用
                      if (shift.startTime) {
                        try {
                          // shift.startTimeはstring型として扱う
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
                      
                      if (shift.endTime) {
                        try {
                          // shift.endTimeはstring型として扱う
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
                      
                      // inTimeと同じ日付基準にworkStartTimeとworkEndTimeを合わせる
                      const inTimeDate = inTime.getDate()
                      const inTimeMonth = inTime.getMonth()
                      const inTimeYear = inTime.getFullYear()
                      
                      // workStartTimeとworkEndTimeをinTimeと同じ日付で作成
                      const workStartHours = workStartTime.getHours()
                      const workStartMinutes = workStartTime.getMinutes()
                      const workEndHours = workEndTime.getHours()
                      const workEndMinutes = workEndTime.getMinutes()
                      
                      workStartTime = new Date(inTimeYear, inTimeMonth, inTimeDate, workStartHours, workStartMinutes)
                      workEndTime = new Date(inTimeYear, inTimeMonth, inTimeDate, workEndHours, workEndMinutes)
                      
                      // シフト終了時刻が開始時刻より前の場合（翌日にまたがるシフト）は1日加算
                      if (workEndTime.getTime() < workStartTime.getTime()) {
                        workEndTime = new Date(workEndTime.getTime() + 24 * 60 * 60 * 1000)
                      }
                      
                      // シフト勤務時間を計算
                      const shiftBreakMinutes = shift?.breakMinutes || companySettings?.standardBreakMinutes || 60
                      const shiftWorkMinutes = Math.max(0, Math.floor(
                        (workEndTime.getTime() - workStartTime.getTime()) / (1000 * 60)
                      ) - shiftBreakMinutes)
                      
                      // preWorkMinutes計算用：inTimeと同じ日付基準（既にworkStartTimeはinTimeと同じ日付基準）
                      const workStartTimeForPreCalc = workStartTime
                      
                      // postWorkMinutes計算用：outTimeと同じ日付基準でworkEndTimeを作成
                      const outTimeDate = outTime.getDate()
                      const outTimeMonth = outTime.getMonth()
                      const outTimeYear = outTime.getFullYear()
                      
                      // workEndTimeから時刻を取得（24時間加算後の値も考慮）
                      const workEndTimeHours = workEndTime.getHours()
                      const workEndTimeMinutes = workEndTime.getMinutes()
                      
                      // workEndTimeをoutTimeと同じ日付基準で作成
                      // 日付跨ぎがない場合、inTimeとoutTimeは同じ日付なので、workEndTimeも同じ日付基準で作成
                      let workEndTimeForPostCalc = new Date(outTimeYear, outTimeMonth, outTimeDate, workEndTimeHours, workEndTimeMinutes)
                      
                      // シフト終了時刻が開始時刻より前の場合（翌日にまたがるシフト）は1日加算
                      // workStartTimeをoutTimeと同じ日付基準に調整して比較
                      const workStartTimeForPostCalc = new Date(outTimeYear, outTimeMonth, outTimeDate, workStartHours, workStartMinutes)
                      if (workEndTimeForPostCalc.getTime() < workStartTimeForPostCalc.getTime()) {
                        workEndTimeForPostCalc = new Date(workEndTimeForPostCalc.getTime() + 24 * 60 * 60 * 1000)
                      }
                      
                      if (!allowPreOvertime) {
                        // 前残業を認めない場合：シフト開始時刻より前の時間は残業としてカウントしない
                        // シフト終了時刻より後の時間のみを残業としてカウント
                        
                        // シフト開始時刻より前の時間を計算（inTimeと同じ日付基準で比較）
                        const preWorkMinutes = Math.max(0, Math.floor((workStartTimeForPreCalc.getTime() - inTime.getTime()) / (1000 * 60)))
                        
                        // シフト終了時刻より後の時間を計算（outTimeと同じ日付基準で比較）
                        const postWorkMinutes = Math.max(0, Math.floor((outTime.getTime() - workEndTimeForPostCalc.getTime()) / (1000 * 60)))
                        
                        // 実働時間から前残業分を除外
                        const adjustedNetWorkMinutes = Math.max(0, netWorkMinutes - preWorkMinutes)
                        
                        // 基本時間はシフト勤務時間まで
                        basicMinutes = Math.min(adjustedNetWorkMinutes, shiftWorkMinutes)
                        
                        // 残業時間はシフト終了時刻より後の時間のみ（前残業は含めない）
                        overtimeMinutes = postWorkMinutes
                      } else {
                        // 前残業を認める場合：従来通り、シフト勤務時間を超えた分が残業時間
                        basicMinutes = Math.max(0, Math.min(Math.max(0, netWorkMinutes), shiftWorkMinutes))
                        overtimeMinutes = Math.max(0, netWorkMinutes - shiftWorkMinutes)
                      }
                    } else {
                      // シフトが登録されていない場合：標準時間（8時間）を使用
                      const standardWorkMinutes = 8 * 60 // 8時間
                      basicMinutes = Math.min(Math.max(0, netWorkMinutes), standardWorkMinutes)
                      overtimeMinutes = Math.max(0, netWorkMinutes - standardWorkMinutes)
                    }

                    const basicHours = Math.floor(basicMinutes / 60)
                    const basicMins = basicMinutes % 60
                    const overtimeHrs = Math.floor(overtimeMinutes / 60)
                    const overtimeMins = overtimeMinutes % 60

                    totalBasicHours += basicHours
                    totalBasicMinutes += basicMins
                    totalOvertimeHours += overtimeHrs
                    totalOvertimeMinutes += overtimeMins
                    totalBreakMinutes += breakMinutes

                    tableData.push({
                      day: day.toString(),
                      weekday,
                      category: '出勤',
                      startTime: clockIn,
                      endTime: clockOut,
                      basic: `${basicHours}:${String(basicMins).padStart(2, '0')}`,
                      overtime: `${overtimeHrs}:${String(overtimeMins).padStart(2, '0')}`,
                      break: `${Math.floor(breakMinutes / 60)}:${String(breakMinutes % 60).padStart(2, '0')}`,
                      notes: formatNotes(attendance.notes),
                    })
                  } else {
                    tableData.push({
                      day: day.toString(),
                      weekday,
                      category: '-',
                      startTime: '-',
                      endTime: '-',
                      basic: '-',
                      overtime: '-',
                      break: '-',
                      notes: '',
                    })
                  }

                  currentDate.setDate(currentDate.getDate() + 1)
                }

                totalBasicHours += Math.floor(totalBasicMinutes / 60)
                totalBasicMinutes = totalBasicMinutes % 60
                totalOvertimeHours += Math.floor(totalOvertimeMinutes / 60)
                totalOvertimeMinutes = totalOvertimeMinutes % 60
                const totalBreakHours = Math.floor(totalBreakMinutes / 60)
                const totalBreakMins = totalBreakMinutes % 60

                return (
                  <div key={report.employee.id} className="p-6">
                    <div className="mb-4">
                      <div className="text-lg text-gray-700 mb-2">
                        <span>{report.employee.workLocation || report.employee.locationName || report.employee.department || '-'}</span>
                        <span className="ml-4">氏名: {report.employee.name}</span>
                        <span className="ml-4">{month}</span>
                      </div>
                      <button
                        onClick={() => {
                          // URLクエリパラメータをクリアして一覧に戻る
                          const params = new URLSearchParams(window.location.search)
                          params.delete('employee_id')
                          const newUrl = params.toString() 
                            ? `/admin/reports?${params.toString()}`
                            : '/admin/reports'
                          router.push(newUrl)
                          // 状態を即座に更新
                          setSelectedEmployeeForTimesheet(null)
                          // スクロールをトップに移動
                          setTimeout(() => {
                            window.scrollTo({ top: 0, behavior: 'smooth' })
                          }, 100)
                        }}
                        className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        ← 一覧に戻る
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse border border-gray-300">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="border border-gray-300 px-2 py-1 text-sm font-semibold text-gray-900">日</th>
                            <th className="border border-gray-300 px-2 py-1 text-sm font-semibold text-gray-900">曜日</th>
                            <th className="border border-gray-300 px-2 py-1 text-sm font-semibold text-gray-900">区分</th>
                            <th className="border border-gray-300 px-2 py-1 text-sm font-semibold text-gray-900">開始時刻</th>
                            <th className="border border-gray-300 px-2 py-1 text-sm font-semibold text-gray-900">終了時刻</th>
                            <th className="border border-gray-300 px-2 py-1 text-sm font-semibold text-gray-900">基本</th>
                            <th className="border border-gray-300 px-2 py-1 text-sm font-semibold text-gray-900">残業</th>
                            <th className="border border-gray-300 px-2 py-1 text-sm font-semibold text-gray-900">休憩</th>
                            <th className="border border-gray-300 px-2 py-1 text-sm font-semibold text-gray-900">備考</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tableData.map((row, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="border border-gray-300 px-2 py-1 text-sm text-center text-gray-900">{row.day}</td>
                              <td className="border border-gray-300 px-2 py-1 text-sm text-center text-gray-900">{row.weekday}</td>
                              <td className="border border-gray-300 px-2 py-1 text-sm text-center text-gray-900">{row.category}</td>
                              <td className="border border-gray-300 px-2 py-1 text-sm text-center text-gray-900">{row.startTime}</td>
                              <td className="border border-gray-300 px-2 py-1 text-sm text-center text-gray-900">{row.endTime}</td>
                              <td className="border border-gray-300 px-2 py-1 text-sm text-center text-gray-900">{row.basic}</td>
                              <td className="border border-gray-300 px-2 py-1 text-sm text-center text-gray-900">{row.overtime}</td>
                              <td className="border border-gray-300 px-2 py-1 text-sm text-center text-gray-900">{row.break}</td>
                              <td className="border border-gray-300 px-2 py-1 text-sm text-center text-gray-900">{row.notes}</td>
                            </tr>
                          ))}
                          <tr className="bg-gray-100 font-bold">
                            <td className="border border-gray-300 px-2 py-1 text-sm text-center text-gray-900">合計</td>
                            <td className="border border-gray-300 px-2 py-1 text-sm text-center text-gray-900"></td>
                            <td className="border border-gray-300 px-2 py-1 text-sm text-center text-gray-900"></td>
                            <td className="border border-gray-300 px-2 py-1 text-sm text-center text-gray-900"></td>
                            <td className="border border-gray-300 px-2 py-1 text-sm text-center text-gray-900"></td>
                            <td className="border border-gray-300 px-2 py-1 text-sm text-center text-gray-900">{`${totalBasicHours}:${String(totalBasicMinutes).padStart(2, '0')}`}</td>
                            <td className="border border-gray-300 px-2 py-1 text-sm text-center text-gray-900">{`${totalOvertimeHours}:${String(totalOvertimeMinutes).padStart(2, '0')}`}</td>
                            <td className="border border-gray-300 px-2 py-1 text-sm text-center text-gray-900">{`${totalBreakHours}:${String(totalBreakMins).padStart(2, '0')}`}</td>
                            <td className="border border-gray-300 px-2 py-1 text-sm text-center text-gray-900"></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })}
          </div>
        )}

        {/* 印刷用タイムシート */}
        {reports.length > 0 && (
          <div className="print-container" style={{ display: 'none' }}>
            {reports
              .filter((report) => {
                // 特定の従業員が選択されている場合は、その従業員だけを表示
                if (selectedEmployeeForTimesheet) {
                  return report.employee.id === selectedEmployeeForTimesheet
                }
                // 従業員フィルターが設定されている場合は、その従業員だけを表示
                if (selectedEmployeeId) {
                  return report.employee.id.toString() === selectedEmployeeId
                }
                // どちらも設定されていない場合は、全て表示
                return true
              })
              .map((report) => {
              const month = selectedMonth
                ? `${selectedMonth.split('-')[0]}年 ${parseInt(selectedMonth.split('-')[1])}月`
                : period
                ? `${new Date(period.start).getFullYear()}年 ${new Date(period.start).getMonth() + 1}月`
                : `${new Date().getFullYear()}年 ${new Date().getMonth() + 1}月`

              // 期間内の各日を処理
              const start = period
                ? new Date(period.start)
                : selectedMonth
                ? new Date(`${selectedMonth}-01`)
                : new Date(new Date().getFullYear(), new Date().getMonth(), 1)
              const end = period
                ? new Date(period.end)
                : selectedMonth
                ? new Date(
                    new Date(`${selectedMonth}-01`).getFullYear(),
                    new Date(`${selectedMonth}-01`).getMonth() + 1,
                    0
                  )
                : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)

              // 各日のデータを取得
              const dailyData: Record<string, any> = {}
              if (report.attendances && Array.isArray(report.attendances)) {
                report.attendances.forEach((attendance: any) => {
                  const dateStr = new Date(attendance.date).toISOString().split('T')[0]
                  dailyData[dateStr] = attendance
                })
              }

              // 日次データの準備
              const tableData: any[] = []
              let totalBasicHours = 0
              let totalBasicMinutes = 0
              let totalOvertimeHours = 0
              let totalOvertimeMinutes = 0
              let totalBreakMinutes = 0

              // 日付ごとにループ
              const currentDate = new Date(start)
              while (currentDate <= end) {
                const dateStr = currentDate.toISOString().split('T')[0]
                const attendance = dailyData[dateStr]
                const day = currentDate.getDate()
                const weekdays = ['日', '月', '火', '水', '木', '金', '土']
                const weekday = weekdays[currentDate.getDay()]

                if (attendance && attendance.clockIn && attendance.clockOut) {
                  // 時刻を文字列として取得（APIから返される形式：HH:MM:SS）
                  // APIからは既に文字列形式で返されているはず
                  let clockIn = ''
                  let clockOut = ''
                  
                  if (typeof attendance.clockIn === 'string') {
                    clockIn = attendance.clockIn.slice(0, 5) // HH:MM形式
                  } else if (attendance.clockIn instanceof Date) {
                    // Date型の場合は文字列に変換（念のため）
                    const timeStr = attendance.clockIn.toISOString().split('T')[1]?.split('.')[0] || ''
                    clockIn = timeStr.slice(0, 5)
                  }
                  
                  if (typeof attendance.clockOut === 'string') {
                    clockOut = attendance.clockOut.slice(0, 5) // HH:MM形式
                  } else if (attendance.clockOut instanceof Date) {
                    const timeStr = attendance.clockOut.toISOString().split('T')[1]?.split('.')[0] || ''
                    clockOut = timeStr.slice(0, 5)
                  }

                  // 日をまたぐ勤務時間を正しく計算
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
                  let breakMinutes = attendance.breakMinutes || 0
                  if (breakMinutes === 0 && totalWorkMinutes >= 6 * 60) {
                    breakMinutes = 60 // 6時間以上の場合は自動的に60分の休憩
                  }
                  const netWorkMinutes = Math.max(0, totalWorkMinutes - breakMinutes)

                  // シフト情報を取得
                  const shift = shifts[dateStr]
                  
                  // 企業設定を取得（前残業を認める設定、デフォルトはfalse）
                  const allowPreOvertime = companySettings?.allowPreOvertime === true
                  
                  // 基本時間と残業時間を計算
                  let basicMinutes: number
                  let overtimeMinutes: number
                  
                  // シフトが登録されている場合のみシフト時間を使用
                  if (shift?.startTime && shift?.endTime) {
                    // 標準始業時刻・終業時刻を取得（デフォルト値）
                    const defaultWorkStart = new Date('2000-01-01T09:00:00')
                    const defaultWorkEnd = new Date('2000-01-01T18:00:00')
                    
                    let workStartTime = defaultWorkStart
                    let workEndTime = defaultWorkEnd
                    
                    // シフト情報があればシフト時間を使用、なければ企業設定の標準時間を使用
                    if (shift.startTime) {
                      try {
                        // shift.startTimeはstring型として扱う
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
                    
                    if (shift.endTime) {
                      try {
                        // shift.endTimeはstring型として扱う
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
                    
                    // inTimeと同じ日付基準にworkStartTimeとworkEndTimeを合わせる
                    const inTimeDate = inTime.getDate()
                    const inTimeMonth = inTime.getMonth()
                    const inTimeYear = inTime.getFullYear()
                    
                    // workStartTimeとworkEndTimeをinTimeと同じ日付で作成
                    const workStartHours = workStartTime.getHours()
                    const workStartMinutes = workStartTime.getMinutes()
                    const workEndHours = workEndTime.getHours()
                    const workEndMinutes = workEndTime.getMinutes()
                    
                    let workStartTimeForCalc = new Date(inTimeYear, inTimeMonth, inTimeDate, workStartHours, workStartMinutes)
                    let workEndTimeForCalc = new Date(inTimeYear, inTimeMonth, inTimeDate, workEndHours, workEndMinutes)
                    
                    // シフト終了時刻が開始時刻より前の場合（翌日にまたがるシフト）は1日加算
                    if (workEndTimeForCalc.getTime() < workStartTimeForCalc.getTime()) {
                      workEndTimeForCalc = new Date(workEndTimeForCalc.getTime() + 24 * 60 * 60 * 1000)
                    }
                    
                    // シフト勤務時間を計算
                    const shiftBreakMinutes = shift?.breakMinutes || companySettings?.standardBreakMinutes || 60
                    const shiftWorkMinutes = Math.max(0, Math.floor(
                      (workEndTimeForCalc.getTime() - workStartTimeForCalc.getTime()) / (1000 * 60)
                    ) - shiftBreakMinutes)
                    
                    if (!allowPreOvertime) {
                      // 前残業を認めない場合：シフト開始時刻より前の時間は残業としてカウントしない
                      // シフト終了時刻より後の時間のみを残業としてカウント
                      
                      // workEndTimeForCalcをoutTimeと同じ日付基準で作成
                      const outTimeDate = outTime.getDate()
                      const outTimeMonth = outTime.getMonth()
                      const outTimeYear = outTime.getFullYear()
                      
                      // workEndTimeForCalcから時刻を取得（24時間加算後の値も考慮）
                      const workEndTimeForCalcHours = workEndTimeForCalc.getHours()
                      const workEndTimeForCalcMinutes = workEndTimeForCalc.getMinutes()
                      
                      // workEndTimeForCalcをoutTimeと同じ日付基準で作成
                      // 日付跨ぎがない場合、inTimeとoutTimeは同じ日付なので、workEndTimeForCalcも同じ日付基準で作成
                      let workEndTimeForPostCalc = new Date(outTimeYear, outTimeMonth, outTimeDate, workEndTimeForCalcHours, workEndTimeForCalcMinutes)
                      
                      // シフト終了時刻が開始時刻より前の場合（翌日にまたがるシフト）は1日加算
                      const workStartTimeForPostCalc = new Date(outTimeYear, outTimeMonth, outTimeDate, workStartHours, workStartMinutes)
                      if (workEndTimeForPostCalc.getTime() < workStartTimeForPostCalc.getTime()) {
                        workEndTimeForPostCalc = new Date(workEndTimeForPostCalc.getTime() + 24 * 60 * 60 * 1000)
                      }
                      
                      // シフト開始時刻より前の時間を計算（inTimeと同じ日付基準で比較）
                      const preWorkMinutes = Math.max(0, Math.floor((workStartTimeForCalc.getTime() - inTime.getTime()) / (1000 * 60)))
                      
                      // シフト終了時刻より後の時間を計算（outTimeと同じ日付基準で比較）
                      const postWorkMinutes = Math.max(0, Math.floor((outTime.getTime() - workEndTimeForPostCalc.getTime()) / (1000 * 60)))
                      
                      // 実働時間から前残業分を除外
                      const adjustedNetWorkMinutes = Math.max(0, netWorkMinutes - preWorkMinutes)
                      
                      // 基本時間はシフト勤務時間まで
                      basicMinutes = Math.min(adjustedNetWorkMinutes, shiftWorkMinutes)
                      
                      // 残業時間はシフト終了時刻より後の時間のみ（前残業は含めない）
                      overtimeMinutes = postWorkMinutes
                    } else {
                      // 前残業を認める場合：従来通り、シフト勤務時間を超えた分が残業時間
                      basicMinutes = Math.min(Math.max(0, netWorkMinutes), shiftWorkMinutes)
                      overtimeMinutes = Math.max(0, netWorkMinutes - shiftWorkMinutes)
                    }
                  } else {
                    // シフトが登録されていない場合：標準時間（8時間）を使用
                    const standardWorkMinutes = 8 * 60 // 8時間
                    basicMinutes = Math.min(Math.max(0, netWorkMinutes), standardWorkMinutes)
                    overtimeMinutes = Math.max(0, netWorkMinutes - standardWorkMinutes)
                  }

                  const basicHours = Math.floor(basicMinutes / 60)
                  const basicMins = basicMinutes % 60
                  const overtimeHrs = Math.floor(overtimeMinutes / 60)
                  const overtimeMins = overtimeMinutes % 60

                  totalBasicHours += basicHours
                  totalBasicMinutes += basicMins
                  totalOvertimeHours += overtimeHrs
                  totalOvertimeMinutes += overtimeMins
                  totalBreakMinutes += attendance.breakMinutes || 0

                  tableData.push({
                    day: day.toString(),
                    weekday,
                    category: '出勤',
                    startTime: clockIn,
                    endTime: clockOut,
                    basic: `${basicHours}:${String(basicMins).padStart(2, '0')}`,
                    overtime: `${overtimeHrs}:${String(overtimeMins).padStart(2, '0')}`,
                    break: `${Math.floor(breakMinutes / 60)}:${String(breakMinutes % 60).padStart(2, '0')}`,
                    notes: attendance.notes || '-',
                  })
                } else {
                  tableData.push({
                    day: day.toString(),
                    weekday,
                    category: '-',
                    startTime: '-',
                    endTime: '-',
                    basic: '-',
                    overtime: '-',
                    break: '-',
                    notes: '-',
                  })
                }

                currentDate.setDate(currentDate.getDate() + 1)
              }

              // 合計を計算
              totalBasicHours += Math.floor(totalBasicMinutes / 60)
              totalBasicMinutes = totalBasicMinutes % 60
              totalOvertimeHours += Math.floor(totalOvertimeMinutes / 60)
              totalOvertimeMinutes = totalOvertimeMinutes % 60
              const totalBreakHours = Math.floor(totalBreakMinutes / 60)
              const totalBreakMins = totalBreakMinutes % 60

              return (
                <div key={report.employee.id} className="print-page">
                  <div className="timesheet-header">
                    <div className="timesheet-info">
                      <div>
                        <span>{report.employee.workLocation || report.employee.locationName || report.employee.department || '-'}</span>
                      </div>
                      <div>
                        <span>氏名: {report.employee.name}</span>
                      </div>
                    </div>
                    <div style={{ marginTop: '5px', fontSize: '18pt' }}>{month}</div>
                  </div>
                  <table className="timesheet-table">
                    <thead>
                      <tr>
                        <th>日</th>
                        <th>曜日</th>
                        <th>区分</th>
                        <th>開始時刻</th>
                        <th>終了時刻</th>
                        <th>基本</th>
                        <th>残業</th>
                        <th>休憩</th>
                        <th>備考</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableData.map((row, idx) => (
                        <tr key={idx}>
                          <td>{row.day}</td>
                          <td>{row.weekday}</td>
                          <td>{row.category}</td>
                          <td>{row.startTime}</td>
                          <td>{row.endTime}</td>
                          <td>{row.basic}</td>
                          <td>{row.overtime}</td>
                          <td>{row.break}</td>
                          <td>{row.notes}</td>
                        </tr>
                      ))}
                      <tr className="total-row">
                        <td>合計</td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td>{`${totalBasicHours}:${String(totalBasicMinutes).padStart(2, '0')}`}</td>
                        <td>{`${totalOvertimeHours}:${String(totalOvertimeMinutes).padStart(2, '0')}`}</td>
                        <td>{`${totalBreakHours}:${String(totalBreakMins).padStart(2, '0')}`}</td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

