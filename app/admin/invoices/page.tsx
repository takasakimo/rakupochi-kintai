'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Invoice {
  id: number
  invoiceNumber: string
  subject: string
  periodStart: string
  periodEnd: string
  dueDate: string
  subtotal: number
  taxAmount: number
  totalAmount: number
  status: string
  issuedAt: string | null
  createdAt: string
  billingClient: {
    id: number
    name: string
  }
  _count?: {
    details: number
  }
}

export default function InvoicesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [billingClientFilter, setBillingClientFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [billingClients, setBillingClients] = useState<{ id: number; name: string }[]>([])

  useEffect(() => {
    if (status === 'authenticated') {
      const isAdmin = session?.user.role === 'admin'
      const isSuperAdmin = session?.user.role === 'super_admin' || 
                          session?.user.email === 'superadmin@rakupochi.com'
      
      if (isAdmin || (isSuperAdmin && session?.user.selectedCompanyId)) {
        fetchSettings()
      }
    }
  }, [status, session, statusFilter, billingClientFilter])

  // 検索フィルタリング
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredInvoices(invoices)
      return
    }

    const query = searchQuery.toLowerCase()
    const filtered = invoices.filter((invoice) => {
      return (
        invoice.invoiceNumber.toLowerCase().includes(query) ||
        invoice.subject.toLowerCase().includes(query) ||
        invoice.billingClient.name.toLowerCase().includes(query)
      )
    })
    setFilteredInvoices(filtered)
  }, [searchQuery, invoices])

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/admin/settings')
      if (response.ok) {
        const data = await response.json()
        const invoiceEnabled = data.settings?.enableInvoice ?? false
        if (invoiceEnabled) {
          fetchBillingClients()
          fetchInvoices()
        } else {
          // enableInvoiceがfalseの場合はダッシュボードにリダイレクト
          router.push('/admin/dashboard')
        }
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err)
    }
  }

  const fetchBillingClients = async () => {
    try {
      const response = await fetch('/api/admin/billing-clients?all=true')
      if (response.ok) {
        const data = await response.json()
        setBillingClients(data.billingClients || [])
      }
    } catch (err) {
      console.error('Failed to fetch billing clients:', err)
    }
  }

  const fetchInvoices = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') {
        params.append('status', statusFilter)
      }
      if (billingClientFilter !== 'all') {
        params.append('billingClientId', billingClientFilter)
      }
      
      const response = await fetch(`/api/admin/invoices?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setInvoices(data.invoices || [])
        setFilteredInvoices(data.invoices || [])
      }
    } catch (err) {
      console.error('Failed to fetch invoices:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('この請求書を削除しますか？')) return

    try {
      const response = await fetch(`/api/admin/invoices/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      if (data.success) {
        fetchInvoices()
        alert('請求書を削除しました')
      } else {
        alert(data.error || '請求書の削除に失敗しました')
      }
    } catch (err: any) {
      console.error('Failed to delete invoice:', err)
      alert(`請求書の削除に失敗しました: ${err?.message || String(err)}`)
    }
  }

  const handleCopy = async (id: number) => {
    if (!confirm('この請求書をコピーして新しい請求書を作成しますか？')) return

    try {
      // 元の請求書を取得
      const response = await fetch(`/api/admin/invoices/${id}`)
      if (!response.ok) {
        alert('請求書の取得に失敗しました')
        return
      }

      const data = await response.json()
      const originalInvoice = data.invoice

      // 請求書番号を生成（新しい期間で）
      const periodStart = originalInvoice.periodStart
      const periodEnd = originalInvoice.periodEnd
      const generateNumberResponse = await fetch(
        `/api/admin/invoices/generate-number?billingClientId=${originalInvoice.billingClientId}&periodStart=${periodStart}&periodEnd=${periodEnd}`
      )

      if (!generateNumberResponse.ok) {
        alert('請求書番号の生成に失敗しました')
        return
      }

      const generateData = await generateNumberResponse.json()
      const newInvoiceNumber = generateData.invoiceNumber

      // 明細データを準備
      const detailsData = originalInvoice.details.map((detail: any) => ({
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

      // 新しい請求書を作成
      const createResponse = await fetch('/api/admin/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billingClientId: originalInvoice.billingClientId,
          invoiceNumber: newInvoiceNumber,
          subject: `${originalInvoice.subject}（コピー）`,
          periodStart: originalInvoice.periodStart,
          periodEnd: originalInvoice.periodEnd,
          paymentTerms: originalInvoice.paymentTerms,
          dueDate: originalInvoice.dueDate,
          subtotal: originalInvoice.subtotal,
          taxAmount: originalInvoice.taxAmount,
          totalAmount: originalInvoice.totalAmount,
          transportationCost: originalInvoice.transportationCost || 0,
          adjustmentAmount: originalInvoice.adjustmentAmount || 0,
          status: 'draft',
          details: detailsData,
        }),
      })

      const createData = await createResponse.json()
      if (createData.success) {
        alert('請求書をコピーしました')
        fetchInvoices()
        // 編集ページに遷移
        router.push(`/admin/invoices/${createData.invoice.id}/edit`)
      } else {
        alert(createData.error || '請求書のコピーに失敗しました')
      }
    } catch (err) {
      console.error('Failed to copy invoice:', err)
      alert('請求書のコピーに失敗しました')
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft':
        return '下書き'
      case 'issued':
        return '発行済み'
      case 'billed':
        return '請求済み'
      case 'paid':
        return '支払済み'
      default:
        return status
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800'
      case 'issued':
        return 'bg-blue-100 text-blue-800'
      case 'billed':
        return 'bg-yellow-100 text-yellow-800'
      case 'paid':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
    }).format(amount)
  }

  if (status === 'loading' || loading) {
    return <div className="p-8 text-center text-gray-900">読み込み中...</div>
  }

  return (
    <div className="p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">請求書管理</h1>
          <Link
            href="/admin/invoices/new"
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 font-medium"
          >
            + 請求書作成
          </Link>
        </div>

        {/* フィルター */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          {/* 検索バー */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              検索
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="請求書番号、件名、請求先企業名で検索..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ステータス
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
              >
                <option value="all">すべて</option>
                <option value="draft">下書き</option>
                <option value="issued">発行済み</option>
                <option value="billed">請求済み</option>
                <option value="paid">支払済み</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                請求先企業
              </label>
              <select
                value={billingClientFilter}
                onChange={(e) => setBillingClientFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
              >
                <option value="all">すべて</option>
                {billingClients.map((client) => (
                  <option key={client.id} value={client.id.toString()}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 請求書一覧 */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {filteredInvoices.length === 0 ? (
            <div className="p-6 text-center text-gray-700">
              {searchQuery ? '検索条件に一致する請求書がありません' : '請求書が登録されていません'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      請求書番号
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      件名
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      請求先企業
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      請求期間
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      お支払い期日
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      合計金額
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      ステータス
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredInvoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {invoice.invoiceNumber}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {invoice.subject}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {invoice.billingClient.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {formatDate(invoice.periodStart)} ～ {formatDate(invoice.periodEnd)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {formatDate(invoice.dueDate)}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {formatCurrency(invoice.totalAmount)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(invoice.status)}`}
                        >
                          {getStatusLabel(invoice.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Link
                            href={`/admin/invoices/${invoice.id}/edit`}
                            className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                          >
                            編集
                          </Link>
                          <button
                            onClick={() => handleCopy(invoice.id)}
                            className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
                          >
                            コピー
                          </button>
                          <button
                            onClick={() => handleDelete(invoice.id)}
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
      </div>
    </div>
  )
}
