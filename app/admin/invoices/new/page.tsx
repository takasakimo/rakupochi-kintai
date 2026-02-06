'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface BillingClient {
  id: number
  name: string
  invoiceNumberPrefix: string | null
  taxRate: number
  isActive: boolean
}

interface Employee {
  id: number
  employeeNumber: string
  name: string
  billingClientId: number | null
  billingRate: number | null
  isActive: boolean
}

export default function NewInvoicePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [billingClients, setBillingClients] = useState<BillingClient[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedBillingClientId, setSelectedBillingClientId] = useState<string>('')
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([])
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [formData, setFormData] = useState({
    subject: '',
    periodStart: '',
    periodEnd: '',
    paymentTerms: '月末締め翌月末払い',
    dueDate: '',
    transportationCost: '0',
    adjustmentAmount: '0',
  })

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
        if (invoiceEnabled) {
          fetchBillingClients()
          fetchEmployees()
        } else {
          // enableInvoiceがfalseの場合はダッシュボードにリダイレクト
          router.push('/admin/dashboard')
        }
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err)
    }
  }

  useEffect(() => {
    if (selectedBillingClientId) {
      const filtered = employees.filter(
        emp => emp.billingClientId === parseInt(selectedBillingClientId) && emp.isActive
      )
      setFilteredEmployees(filtered)
      setSelectedEmployeeIds(new Set())
    } else {
      setFilteredEmployees([])
      setSelectedEmployeeIds(new Set())
    }
  }, [selectedBillingClientId, employees])

  useEffect(() => {
    if (selectedBillingClientId && formData.periodStart && formData.periodEnd) {
      generateInvoiceNumber()
    }
  }, [selectedBillingClientId, formData.periodStart, formData.periodEnd])

  const fetchBillingClients = async () => {
    try {
      const response = await fetch('/api/admin/billing-clients?all=true')
      if (response.ok) {
        const data = await response.json()
        setBillingClients(data.billingClients || [])
      }
    } catch (err) {
      console.error('Failed to fetch billing clients:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/admin/employees')
      if (response.ok) {
        const data = await response.json()
        setEmployees(data.employees || [])
      }
    } catch (err) {
      console.error('Failed to fetch employees:', err)
    }
  }

  const generateInvoiceNumber = async () => {
    if (!selectedBillingClientId || !formData.periodStart || !formData.periodEnd) return

    try {
      const response = await fetch(
        `/api/admin/invoices/generate-number?billingClientId=${selectedBillingClientId}&periodStart=${formData.periodStart}&periodEnd=${formData.periodEnd}`
      )
      if (response.ok) {
        const data = await response.json()
        setInvoiceNumber(data.invoiceNumber)
      }
    } catch (err) {
      console.error('Failed to generate invoice number:', err)
    }
  }

  const handleBillingClientChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    setSelectedBillingClientId(value)
    setInvoiceNumber('')
  }

  const handleEmployeeToggle = (employeeId: number) => {
    setSelectedEmployeeIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(employeeId)) {
        newSet.delete(employeeId)
      } else {
        newSet.add(employeeId)
      }
      return newSet
    })
  }

  const handleSelectAll = () => {
    if (selectedEmployeeIds.size === filteredEmployees.length) {
      setSelectedEmployeeIds(new Set())
    } else {
      setSelectedEmployeeIds(new Set(filteredEmployees.map(emp => emp.id)))
    }
  }

  const calculateDueDate = () => {
    if (formData.periodEnd) {
      const endDate = new Date(formData.periodEnd)
      // 月末の翌月末を計算
      const nextMonth = new Date(endDate.getFullYear(), endDate.getMonth() + 2, 0)
      setFormData(prev => ({
        ...prev,
        dueDate: nextMonth.toISOString().split('T')[0],
      }))
    }
  }

  useEffect(() => {
    if (formData.periodEnd && !formData.dueDate) {
      calculateDueDate()
    }
  }, [formData.periodEnd])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // バリデーション
    if (!selectedBillingClientId) {
      alert('請求先企業を選択してください')
      return
    }

    if (!invoiceNumber) {
      alert('請求書番号を生成してください')
      return
    }

    if (selectedEmployeeIds.size === 0) {
      alert('対象従業員を選択してください')
      return
    }

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

    // 交通費・調整金額の妥当性チェック
    const transportationCost = parseInt(formData.transportationCost) || 0
    const adjustmentAmount = parseInt(formData.adjustmentAmount) || 0

    if (transportationCost < 0) {
      alert('交通費は0以上の値を入力してください')
      return
    }

    setSubmitting(true)
    try {
      // 明細を自動計算
      const calculateResponse = await fetch('/api/admin/invoices/calculate-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeIds: Array.from(selectedEmployeeIds),
          periodStart: formData.periodStart,
          periodEnd: formData.periodEnd,
          billingClientId: parseInt(selectedBillingClientId),
        }),
      })

      if (!calculateResponse.ok) {
        const errorData = await calculateResponse.json()
        alert(errorData.error || '明細の計算に失敗しました')
        setSubmitting(false)
        return
      }

      const calculateData = await calculateResponse.json()
      const { details, subtotal, taxAmount, totalAmount } = calculateData

      // 交通費と調整金額を加算（既にバリデーション済み）
      // 請求先企業の消費税率を取得
      const selectedBillingClient = billingClients.find(
        client => client.id === parseInt(selectedBillingClientId)
      )
      const taxRate = selectedBillingClient?.taxRate || 0.1

      const finalSubtotal = subtotal + transportationCost + adjustmentAmount
      const finalTaxAmount = Math.round(finalSubtotal * taxRate)
      const finalTotalAmount = finalSubtotal + finalTaxAmount

      // 請求書を作成
      const response = await fetch('/api/admin/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billingClientId: parseInt(selectedBillingClientId),
          invoiceNumber,
          subject: formData.subject || `請求書 ${formData.periodStart} ～ ${formData.periodEnd}`,
          periodStart: formData.periodStart,
          periodEnd: formData.periodEnd,
          paymentTerms: formData.paymentTerms,
          dueDate: formData.dueDate,
          subtotal: finalSubtotal,
          taxAmount: finalTaxAmount,
          totalAmount: finalTotalAmount,
          transportationCost,
          adjustmentAmount,
          status: 'draft',
          details,
        }),
      })

      const data = await response.json()
      if (data.success) {
        router.push(`/admin/invoices/${data.invoice.id}/edit`)
      } else {
        const errorMessage = data.error || '請求書の作成に失敗しました'
        console.error('Failed to create invoice:', errorMessage)
        alert(errorMessage)
      }
    } catch (err: any) {
      console.error('Failed to create invoice:', err)
      const errorMessage = err?.message || 'ネットワークエラーが発生しました。接続を確認してください。'
      alert(`請求書の作成に失敗しました: ${errorMessage}`)
    } finally {
      setSubmitting(false)
    }
  }

  const selectedBillingClient = billingClients.find(
    client => client.id === parseInt(selectedBillingClientId)
  )

  if (status === 'loading' || loading) {
    return <div className="p-8 text-center text-gray-900">読み込み中...</div>
  }

  return (
    <div className="p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">請求書作成</h1>
          <Link
            href="/admin/invoices"
            className="px-4 py-2 bg-gray-200 text-gray-900 rounded-md hover:bg-gray-300 font-medium"
          >
            キャンセル
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 space-y-6">
          {/* 請求先企業選択 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              請求先企業 <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedBillingClientId}
              onChange={handleBillingClientChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
            >
              <option value="">選択してください</option>
              {billingClients
                .filter(client => client.isActive)
                .map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
            </select>
          </div>

          {/* 請求書番号 */}
          {invoiceNumber && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                請求書番号
              </label>
              <input
                type="text"
                value={invoiceNumber}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900"
              />
              <p className="text-xs text-gray-500 mt-1">
                請求先企業のプレフィックスと請求期間から自動生成されます
              </p>
            </div>
          )}

          {/* 件名 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              件名
            </label>
            <input
              type="text"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              placeholder={`請求書 ${formData.periodStart || 'YYYY-MM-DD'} ～ ${formData.periodEnd || 'YYYY-MM-DD'}`}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
            />
          </div>

          {/* 請求期間 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                請求期間開始 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.periodStart}
                onChange={(e) => setFormData({ ...formData, periodStart: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                請求期間終了 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.periodEnd}
                onChange={(e) => setFormData({ ...formData, periodEnd: e.target.value })}
                required
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
                お支払い期日 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
              />
            </div>
          </div>

          {/* 対象従業員選択 */}
          {selectedBillingClientId && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  対象従業員 <span className="text-red-500">*</span>
                </label>
                {filteredEmployees.length > 0 && (
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    {selectedEmployeeIds.size === filteredEmployees.length ? 'すべて解除' : 'すべて選択'}
                  </button>
                )}
              </div>
              {filteredEmployees.length === 0 ? (
                <div className="p-4 border border-gray-300 rounded-md bg-gray-50 text-gray-600 text-sm">
                  この請求先企業に紐づいている従業員がありません
                </div>
              ) : (
                <div className="border border-gray-300 rounded-md p-4 max-h-64 overflow-y-auto">
                  <div className="space-y-2">
                    {filteredEmployees.map((employee) => (
                      <label
                        key={employee.id}
                        className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedEmployeeIds.has(employee.id)}
                          onChange={() => handleEmployeeToggle(employee.id)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <div className="flex-1">
                          <span className="text-sm font-medium text-gray-900">
                            {employee.name}
                          </span>
                          <span className="text-xs text-gray-500 ml-2">
                            ({employee.employeeNumber})
                          </span>
                          {employee.billingRate && (
                            <span className="text-xs text-gray-500 ml-2">
                              単価: {employee.billingRate.toLocaleString()}円
                            </span>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-xs text-gray-500 mt-1">
                選択された従業員: {selectedEmployeeIds.size}名
              </p>
            </div>
          )}

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

          {/* 送信ボタン */}
          <div className="flex gap-4 pt-4 border-t">
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? '作成中...' : '請求書を作成'}
            </button>
            <Link
              href="/admin/invoices"
              className="px-6 py-2 bg-gray-200 text-gray-900 rounded-md hover:bg-gray-300 font-medium"
            >
              キャンセル
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
