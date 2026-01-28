'use client'

import { useState, useEffect } from 'react'
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

interface Employee {
  id: number
  name: string
  employeeNumber: string
  department: string | null
}

export default function AdminReportsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [reports, setReports] = useState<Report[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('')
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7)
  )
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [period, setPeriod] = useState<{ start: string; end: string } | null>(null)
  const [selectedEmployeeForTimesheet, setSelectedEmployeeForTimesheet] = useState<number | null>(null)
  
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
        fetchReports()
      }
    }
  }, [status, session])

  useEffect(() => {
    if (status === 'authenticated') {
      const isAdmin = session?.user.role === 'admin'
      const isSuperAdmin = session?.user.role === 'super_admin' || 
                          session?.user.email === 'superadmin@rakupochi.com'
      
      if (isAdmin || (isSuperAdmin && session?.user.selectedCompanyId)) {
        fetchReports()
      }
    }
  }, [selectedEmployeeId, selectedMonth, startDate, endDate])

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/admin/employees')
      const data = await response.json()
      setEmployees(data.employees || [])
    } catch (err) {
      console.error('Failed to fetch employees:', err)
    }
  }

  const fetchReports = async () => {
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

      const response = await fetch(`/api/admin/reports?${params.toString()}`)
      const data = await response.json()
      setReports(data.reports || [])
      setPeriod(data.period || null)
    } catch (err) {
      console.error('Failed to fetch reports:', err)
    } finally {
      setLoading(false)
    }
  }

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
        <div className="flex justify-end gap-2 mb-6 no-print">
          {reports.length > 0 && (
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
          {reports.length === 0 ? (
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
          )}
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

                    // 標準勤務時間（8時間）を考慮して基本と残業を計算
                    const standardWorkMinutes = 8 * 60
                    const basicMinutes = Math.min(Math.max(0, netWorkMinutes), standardWorkMinutes)
                    const overtimeMinutes = Math.max(0, netWorkMinutes - standardWorkMinutes)

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

                  // 標準勤務時間（8時間）を考慮して基本と残業を計算
                  const standardWorkMinutes = 8 * 60
                  const basicMinutes = Math.min(Math.max(0, netWorkMinutes), standardWorkMinutes)
                  const overtimeMinutes = Math.max(0, netWorkMinutes - standardWorkMinutes)

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

