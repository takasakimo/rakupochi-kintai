'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

interface BillingClient {
  id: number
  name: string
  taxRate: number
}

interface Employee {
  id: number
  name: string
  employeeNumber: string
}

interface InvoiceDetail {
  id: number
  employeeId: number
  workDays: number
  basicRate: number
  basicAmount: number
  overtimeHours: number | null
  overtimeRate: number | null
  overtimeAmount: number | null
  absenceDays: number | null
  absenceDeduction: number | null
  lateEarlyDeduction: number | null
  subtotal: number
  employee: Employee
}

interface Invoice {
  id: number
  invoiceNumber: string
  subject: string
  periodStart: string
  periodEnd: string
  paymentTerms: string
  dueDate: string
  subtotal: number
  taxAmount: number
  totalAmount: number
  transportationCost: number | null
  adjustmentAmount: number | null
  status: string
  billingClient: BillingClient
  details: InvoiceDetail[]
}

export default function EditInvoicePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const invoiceId = params?.id as string

  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [issuing, setIssuing] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [formData, setFormData] = useState({
    subject: '',
    periodStart: '',
    periodEnd: '',
    paymentTerms: '',
    dueDate: '',
    transportationCost: '0',
    adjustmentAmount: '0',
  })
  const [details, setDetails] = useState<InvoiceDetail[]>([])

  useEffect(() => {
    if (status === 'authenticated') {
      const isAdmin = session?.user.role === 'admin'
      const isSuperAdmin = session?.user.role === 'super_admin' || 
                          session?.user.email === 'superadmin@rakupochi.com'
      
      if (isAdmin || (isSuperAdmin && session?.user.selectedCompanyId)) {
        fetchSettings()
      }
    }
  }, [status, session])

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/admin/settings')
      if (response.ok) {
        const data = await response.json()
        const invoiceEnabled = data.settings?.enableInvoice ?? false
        if (invoiceEnabled && invoiceId) {
          fetchInvoice()
        } else {
          // enableInvoiceがfalseの場合はダッシュボードにリダイレクト
          router.push('/admin/dashboard')
        }
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err)
    }
  }

  const fetchInvoice = async () => {
    try {
      const response = await fetch(`/api/admin/invoices/${invoiceId}`)
      if (response.ok) {
        const data = await response.json()
        const invoiceData = data.invoice as Invoice
        
        // 日付をフォーマット（YYYY-MM-DD形式）
        const formatDate = (dateStr: string | Date) => {
          if (!dateStr) return ''
          const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr
          return date.toISOString().split('T')[0]
        }

        setInvoice(invoiceData)
        setFormData({
          subject: invoiceData.subject,
          periodStart: formatDate(invoiceData.periodStart),
          periodEnd: formatDate(invoiceData.periodEnd),
          paymentTerms: invoiceData.paymentTerms,
          dueDate: formatDate(invoiceData.dueDate),
          transportationCost: String(invoiceData.transportationCost || 0),
          adjustmentAmount: String(invoiceData.adjustmentAmount || 0),
        })
        setDetails(invoiceData.details || [])
      } else {
        alert('請求書の取得に失敗しました')
        router.push('/admin/invoices')
      }
    } catch (err) {
      console.error('Failed to fetch invoice:', err)
      alert('請求書の取得に失敗しました')
      router.push('/admin/invoices')
    } finally {
      setLoading(false)
    }
  }

  const handleDetailChange = (index: number, field: string, value: string | number) => {
    const updatedDetails = [...details]
    const detail = updatedDetails[index]
    
    if (field === 'workDays') {
      detail.workDays = parseInt(String(value)) || 0
      // 基本金額を再計算
      detail.basicAmount = detail.workDays * detail.basicRate
    } else if (field === 'basicRate') {
      detail.basicRate = parseInt(String(value)) || 0
      // 基本金額を再計算
      detail.basicAmount = detail.workDays * detail.basicRate
    } else if (field === 'basicAmount') {
      detail.basicAmount = parseInt(String(value)) || 0
    } else if (field === 'overtimeHours') {
      detail.overtimeHours = parseFloat(String(value)) || 0
      // 残業金額を再計算
      if (detail.overtimeRate && detail.basicRate) {
        detail.overtimeAmount = Math.round(detail.overtimeHours * detail.basicRate * detail.overtimeRate)
      }
    } else if (field === 'overtimeAmount') {
      detail.overtimeAmount = parseInt(String(value)) || 0
    } else if (field === 'absenceDays') {
      detail.absenceDays = parseInt(String(value)) || 0
      // 欠勤減算額を再計算
      detail.absenceDeduction = detail.absenceDays * detail.basicRate
    } else if (field === 'absenceDeduction') {
      detail.absenceDeduction = parseInt(String(value)) || 0
    } else if (field === 'lateEarlyDeduction') {
      detail.lateEarlyDeduction = parseInt(String(value)) || 0
    }

    // 小計を再計算
    detail.subtotal = Math.max(0, 
      (detail.basicAmount || 0) + 
      (detail.overtimeAmount || 0) - 
      (detail.absenceDeduction || 0) - 
      (detail.lateEarlyDeduction || 0)
    )

    updatedDetails[index] = detail
    setDetails(updatedDetails)
  }

  const calculateTotals = () => {
    if (!invoice) return { subtotal: 0, taxAmount: 0, totalAmount: 0 }

    // 明細の小計の合計
    const detailsSubtotal = details.reduce((sum, detail) => sum + (detail.subtotal || 0), 0)
    
    // 交通費と調整金額を加算
    const transportationCost = parseInt(formData.transportationCost) || 0
    const adjustmentAmount = parseInt(formData.adjustmentAmount) || 0
    const subtotal = detailsSubtotal + transportationCost + adjustmentAmount

    // 消費税を計算
    const taxRate = invoice.billingClient.taxRate || 0.1
    const taxAmount = Math.round(subtotal * taxRate)
    const totalAmount = subtotal + taxAmount

    return { subtotal, taxAmount, totalAmount }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!invoice) return

    // バリデーション
    if (!formData.periodStart || !formData.periodEnd || !formData.dueDate) {
      alert('請求期間とお支払い期日を入力してください')
      return
    }

    // 日付の妥当性チェック
    const periodStart = new Date(formData.periodStart)
    const periodEnd = new Date(formData.periodEnd)
    const dueDate = new Date(formData.dueDate)

    if (periodStart > periodEnd) {
      alert('請求期間開始日は請求期間終了日より前である必要があります')
      return
    }

    if (dueDate < periodEnd) {
      alert('お支払い期日は請求期間終了日以降である必要があります')
      return
    }

    // 明細のバリデーション
    if (details.length === 0) {
      alert('請求明細がありません')
      return
    }

    for (const detail of details) {
      if (detail.workDays < 0) {
        alert(`${detail.employee.name}の勤務日数が不正です`)
        return
      }
      if (detail.basicRate < 0) {
        alert(`${detail.employee.name}の基本単価が不正です`)
        return
      }
    }

    setSaving(true)
    try {
      const { subtotal, taxAmount, totalAmount } = calculateTotals()

      // 明細データを準備
      const detailsData = details.map(detail => ({
        employeeId: detail.employeeId,
        workDays: detail.workDays,
        basicRate: detail.basicRate,
        basicAmount: detail.basicAmount,
        overtimeHours: detail.overtimeHours || 0,
        overtimeRate: detail.overtimeRate,
        overtimeAmount: detail.overtimeAmount || 0,
        absenceDays: detail.absenceDays || 0,
        absenceDeduction: detail.absenceDeduction || 0,
        lateEarlyDeduction: detail.lateEarlyDeduction || 0,
        subtotal: detail.subtotal,
      }))

      // 請求書を更新
      const response = await fetch(`/api/admin/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: formData.subject,
          periodStart: formData.periodStart,
          periodEnd: formData.periodEnd,
          paymentTerms: formData.paymentTerms,
          dueDate: formData.dueDate,
          subtotal,
          taxAmount,
          totalAmount,
          transportationCost: parseInt(formData.transportationCost) || 0,
          adjustmentAmount: parseInt(formData.adjustmentAmount) || 0,
          status: invoice.status, // 現在のステータスを維持
          details: detailsData,
        }),
      })

      const data = await response.json()
      if (data.success) {
        alert('請求書を保存しました')
        // データを再取得して最新の状態を反映
        fetchInvoice()
      } else {
        const errorMessage = data.error || '請求書の保存に失敗しました'
        console.error('Failed to save invoice:', errorMessage)
        alert(errorMessage)
      }
    } catch (err: any) {
      console.error('Failed to save invoice:', err)
      const errorMessage = err?.message || 'ネットワークエラーが発生しました。接続を確認してください。'
      alert(`請求書の保存に失敗しました: ${errorMessage}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDownloadPDF = async () => {
    if (!invoice) return

    setDownloading(true)
    try {
      const response = await fetch(`/api/admin/invoices/${invoiceId}/pdf`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `invoice-${invoice.invoiceNumber}.pdf`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error || 'PDFのダウンロードに失敗しました'
        console.error('Failed to download PDF:', errorMessage)
        alert(errorMessage)
      }
    } catch (err: any) {
      console.error('Failed to download PDF:', err)
      const errorMessage = err?.message || 'ネットワークエラーが発生しました。接続を確認してください。'
      alert(`PDFのダウンロードに失敗しました: ${errorMessage}`)
    } finally {
      setDownloading(false)
    }
  }

  const handleIssue = async () => {
    if (!invoice) return

    if (!confirm('請求書を発行しますか？発行後はステータスが「発行済み」に変更されます。')) {
      return
    }

    setIssuing(true)
    try {
      // まず保存
      const { subtotal, taxAmount, totalAmount } = calculateTotals()

      const detailsData = details.map(detail => ({
        employeeId: detail.employeeId,
        workDays: detail.workDays,
        basicRate: detail.basicRate,
        basicAmount: detail.basicAmount,
        overtimeHours: detail.overtimeHours || 0,
        overtimeRate: detail.overtimeRate,
        overtimeAmount: detail.overtimeAmount || 0,
        absenceDays: detail.absenceDays || 0,
        absenceDeduction: detail.absenceDeduction || 0,
        lateEarlyDeduction: detail.lateEarlyDeduction || 0,
        subtotal: detail.subtotal,
      }))

      // 請求書を発行済みに更新
      const response = await fetch(`/api/admin/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: formData.subject,
          periodStart: formData.periodStart,
          periodEnd: formData.periodEnd,
          paymentTerms: formData.paymentTerms,
          dueDate: formData.dueDate,
          subtotal,
          taxAmount,
          totalAmount,
          transportationCost: parseInt(formData.transportationCost) || 0,
          adjustmentAmount: parseInt(formData.adjustmentAmount) || 0,
          status: 'issued', // 発行済みに変更
          details: detailsData,
        }),
      })

      const data = await response.json()
      if (data.success) {
        alert('請求書を発行しました')
        // データを再取得
        await fetchInvoice()
        // PDFをダウンロード
        await handleDownloadPDF()
      } else {
        const errorMessage = data.error || '請求書の発行に失敗しました'
        console.error('Failed to issue invoice:', errorMessage)
        alert(errorMessage)
      }
    } catch (err: any) {
      console.error('Failed to issue invoice:', err)
      const errorMessage = err?.message || 'ネットワークエラーが発生しました。接続を確認してください。'
      alert(`請求書の発行に失敗しました: ${errorMessage}`)
    } finally {
      setIssuing(false)
    }
  }

  const { subtotal, taxAmount, totalAmount } = calculateTotals()

  if (status === 'loading' || loading) {
    return <div className="p-8 text-center text-gray-900">読み込み中...</div>
  }

  if (!invoice) {
    return <div className="p-8 text-center text-gray-900">請求書が見つかりません</div>
  }

  return (
    <div className="p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">請求書編集</h1>
          <Link
            href="/admin/invoices"
            className="px-4 py-2 bg-gray-200 text-gray-900 rounded-md hover:bg-gray-300 font-medium"
          >
            一覧に戻る
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 space-y-6">
          {/* 請求書基本情報 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                請求書番号
              </label>
              <input
                type="text"
                value={invoice.invoiceNumber}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                請求先企業
              </label>
              <input
                type="text"
                value={invoice.billingClient.name}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              件名
            </label>
            <input
              type="text"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
            />
          </div>

          {/* 請求期間 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                請求期間開始
              </label>
              <input
                type="date"
                value={formData.periodStart}
                onChange={(e) => setFormData({ ...formData, periodStart: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                請求期間終了
              </label>
              <input
                type="date"
                value={formData.periodEnd}
                onChange={(e) => setFormData({ ...formData, periodEnd: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
              />
            </div>
          </div>

          {/* 代金決済条件・お支払い期日 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                代金決済条件
              </label>
              <input
                type="text"
                value={formData.paymentTerms}
                onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                お支払い期日
              </label>
              <input
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
              />
            </div>
          </div>

          {/* 請求明細 */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">請求明細</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 border border-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300">
                      従業員名
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300">
                      勤務日数
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300">
                      基本単価
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300">
                      基本金額
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300">
                      残業時間
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300">
                      残業金額
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300">
                      欠勤日数
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300">
                      欠勤減算
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300">
                      遅刻・早退減算
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      小計
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {details.map((detail, index) => (
                    <tr key={detail.id}>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 border-r border-gray-300">
                        {detail.employee.name}
                        <span className="text-xs text-gray-500 ml-1">
                          ({detail.employee.employeeNumber})
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap border-r border-gray-300">
                        <input
                          type="number"
                          value={detail.workDays}
                          onChange={(e) => handleDetailChange(index, 'workDays', e.target.value)}
                          min="0"
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white"
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap border-r border-gray-300">
                        <input
                          type="number"
                          value={detail.basicRate}
                          onChange={(e) => handleDetailChange(index, 'basicRate', e.target.value)}
                          min="0"
                          className="w-24 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white"
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 border-r border-gray-300">
                        <input
                          type="number"
                          value={detail.basicAmount}
                          onChange={(e) => handleDetailChange(index, 'basicAmount', e.target.value)}
                          min="0"
                          className="w-28 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white"
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap border-r border-gray-300">
                        <input
                          type="number"
                          value={detail.overtimeHours || 0}
                          onChange={(e) => handleDetailChange(index, 'overtimeHours', e.target.value)}
                          min="0"
                          step="0.1"
                          disabled={!detail.overtimeRate}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white disabled:bg-gray-50"
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 border-r border-gray-300">
                        <input
                          type="number"
                          value={detail.overtimeAmount || 0}
                          onChange={(e) => handleDetailChange(index, 'overtimeAmount', e.target.value)}
                          min="0"
                          className="w-28 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white"
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap border-r border-gray-300">
                        <input
                          type="number"
                          value={detail.absenceDays || 0}
                          onChange={(e) => handleDetailChange(index, 'absenceDays', e.target.value)}
                          min="0"
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white"
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 border-r border-gray-300">
                        <input
                          type="number"
                          value={detail.absenceDeduction || 0}
                          onChange={(e) => handleDetailChange(index, 'absenceDeduction', e.target.value)}
                          min="0"
                          className="w-28 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white"
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 border-r border-gray-300">
                        <input
                          type="number"
                          value={detail.lateEarlyDeduction || 0}
                          onChange={(e) => handleDetailChange(index, 'lateEarlyDeduction', e.target.value)}
                          min="0"
                          className="w-28 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white"
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        {detail.subtotal.toLocaleString()}円
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 交通費・調整金額 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                交通費
              </label>
              <input
                type="number"
                value={formData.transportationCost}
                onChange={(e) => setFormData({ ...formData, transportationCost: e.target.value })}
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                調整金額
              </label>
              <input
                type="number"
                value={formData.adjustmentAmount}
                onChange={(e) => setFormData({ ...formData, adjustmentAmount: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
              />
            </div>
          </div>

          {/* 合計金額 */}
          <div className="bg-gray-50 p-4 rounded-md border border-gray-300">
            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-700">小計（税抜）:</span>
                  <span className="text-gray-900 font-medium">{subtotal.toLocaleString()}円</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-700">消費税（{Math.round((invoice.billingClient.taxRate || 0.1) * 100)}%）:</span>
                  <span className="text-gray-900 font-medium">{taxAmount.toLocaleString()}円</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t border-gray-300 pt-2">
                  <span className="text-gray-900">合計（税込）:</span>
                  <span className="text-gray-900">{totalAmount.toLocaleString()}円</span>
                </div>
              </div>
            </div>
          </div>

          {/* ステータス表示 */}
          <div className="pt-4 border-t">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm font-medium text-gray-700">ステータス:</span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                invoice.status === 'draft' ? 'bg-gray-200 text-gray-800' :
                invoice.status === 'issued' ? 'bg-blue-200 text-blue-800' :
                invoice.status === 'billed' ? 'bg-yellow-200 text-yellow-800' :
                'bg-green-200 text-green-800'
              }`}>
                {invoice.status === 'draft' ? '下書き' :
                 invoice.status === 'issued' ? '発行済み' :
                 invoice.status === 'billed' ? '請求済み' :
                 '支払済み'}
              </span>
            </div>
          </div>

          {/* 送信ボタン */}
          <div className="flex gap-4 pt-4 border-t">
            <button
              type="submit"
              disabled={saving || invoice.status !== 'draft'}
              className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? '保存中...' : '保存'}
            </button>
            {invoice.status === 'draft' && (
              <button
                type="button"
                onClick={handleIssue}
                disabled={issuing}
                className="px-6 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {issuing ? '発行中...' : '発行する'}
              </button>
            )}
            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={downloading}
              className="px-6 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {downloading ? 'ダウンロード中...' : 'PDFダウンロード'}
            </button>
            <Link
              href="/admin/invoices"
              className="px-6 py-2 bg-gray-200 text-gray-900 rounded-md hover:bg-gray-300 font-medium"
            >
              一覧に戻る
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
