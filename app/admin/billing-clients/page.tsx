'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface BillingClient {
  id: number
  name: string
  code: string | null
  address: string | null
  phone: string | null
  fax: string | null
  contactPerson: string | null
  bankName: string | null
  bankBranch: string | null
  accountNumber: string | null
  accountHolder: string | null
  taxRate: number
  invoiceNumberPrefix: string | null
  isActive: boolean
  _count?: {
    employees: number
    invoices: number
  }
}

export default function BillingClientsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [billingClients, setBillingClients] = useState<BillingClient[]>([])
  const [loading, setLoading] = useState(true)
  const [enableInvoice, setEnableInvoice] = useState<boolean>(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingClient, setEditingClient] = useState<BillingClient | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    address: '',
    phone: '',
    fax: '',
    contactPerson: '',
    bankName: '',
    bankBranch: '',
    accountNumber: '',
    accountHolder: '',
    taxRate: '0.1',
    invoiceNumberPrefix: '',
    isActive: true,
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
        setEnableInvoice(invoiceEnabled)
        if (invoiceEnabled) {
          fetchBillingClients()
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
    setLoading(true)
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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch('/api/admin/billing-clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          code: formData.code || null,
          address: formData.address || null,
          phone: formData.phone || null,
          fax: formData.fax || null,
          contactPerson: formData.contactPerson || null,
          bankName: formData.bankName || null,
          bankBranch: formData.bankBranch || null,
          accountNumber: formData.accountNumber || null,
          accountHolder: formData.accountHolder || null,
          taxRate: parseFloat(formData.taxRate) || 0.1,
          invoiceNumberPrefix: formData.invoiceNumberPrefix || null,
        }),
      })

      const data = await response.json()
      if (data.success) {
        setShowCreateForm(false)
        setFormData({
          name: '',
          code: '',
          address: '',
          phone: '',
          fax: '',
          contactPerson: '',
          bankName: '',
          bankBranch: '',
          accountNumber: '',
          accountHolder: '',
          taxRate: '0.1',
          invoiceNumberPrefix: '',
          isActive: true,
        })
        fetchBillingClients()
        alert('請求先企業を登録しました')
      } else {
        alert(data.error || '請求先企業の登録に失敗しました')
      }
    } catch (err) {
      console.error('Failed to create billing client:', err)
      alert('請求先企業の登録に失敗しました')
    }
  }

  const handleUpdate = async (client: BillingClient) => {
    try {
      const response = await fetch(`/api/admin/billing-clients/${client.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: client.name,
          code: client.code,
          address: client.address,
          phone: client.phone,
          fax: client.fax,
          contactPerson: client.contactPerson,
          bankName: client.bankName,
          bankBranch: client.bankBranch,
          accountNumber: client.accountNumber,
          accountHolder: client.accountHolder,
          taxRate: client.taxRate,
          invoiceNumberPrefix: client.invoiceNumberPrefix,
          isActive: client.isActive,
        }),
      })

      const data = await response.json()
      if (data.success) {
        setEditingClient(null)
        fetchBillingClients()
        alert('請求先企業を更新しました')
      } else {
        alert(data.error || '請求先企業の更新に失敗しました')
      }
    } catch (err) {
      console.error('Failed to update billing client:', err)
      alert('請求先企業の更新に失敗しました')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('この請求先企業を削除しますか？')) return

    try {
      const response = await fetch(`/api/admin/billing-clients/${id}`, {
        method: 'DELETE',
      })

      const data = await response.json()
      if (data.success) {
        fetchBillingClients()
        alert('請求先企業を削除しました')
      } else {
        alert(data.error || '請求先企業の削除に失敗しました')
      }
    } catch (err) {
      console.error('Failed to delete billing client:', err)
      alert('請求先企業の削除に失敗しました')
    }
  }

  if (status === 'loading' || loading) {
    return <div className="p-8 text-center text-gray-900">読み込み中...</div>
  }

  return (
    <div className="p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">請求先企業管理</h1>
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 font-medium"
          >
            + 請求先企業登録
          </button>
        </div>

        {/* 新規登録フォーム */}
        {showCreateForm && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4 text-gray-900">新規請求先企業登録</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    請求先企業名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    企業コード
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({ ...formData, code: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    消費税率
                  </label>
                  <select
                    value={formData.taxRate}
                    onChange={(e) =>
                      setFormData({ ...formData, taxRate: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  >
                    <option value="0.08">8%</option>
                    <option value="0.1">10%</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    住所
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    電話番号
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    FAX番号
                  </label>
                  <input
                    type="tel"
                    value={formData.fax}
                    onChange={(e) =>
                      setFormData({ ...formData, fax: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    担当者名
                  </label>
                  <input
                    type="text"
                    value={formData.contactPerson}
                    onChange={(e) =>
                      setFormData({ ...formData, contactPerson: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>
                <div className="md:col-span-2 border-t pt-4">
                  <h3 className="font-semibold mb-2 text-gray-900">振込先情報</h3>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    銀行名
                  </label>
                  <input
                    type="text"
                    value={formData.bankName}
                    onChange={(e) =>
                      setFormData({ ...formData, bankName: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    支店名
                  </label>
                  <input
                    type="text"
                    value={formData.bankBranch}
                    onChange={(e) =>
                      setFormData({ ...formData, bankBranch: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    口座番号
                  </label>
                  <input
                    type="text"
                    value={formData.accountNumber}
                    onChange={(e) =>
                      setFormData({ ...formData, accountNumber: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    口座名義
                  </label>
                  <input
                    type="text"
                    value={formData.accountHolder}
                    onChange={(e) =>
                      setFormData({ ...formData, accountHolder: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    請求書番号プレフィックス
                  </label>
                  <input
                    type="text"
                    value={formData.invoiceNumberPrefix}
                    onChange={(e) =>
                      setFormData({ ...formData, invoiceNumberPrefix: e.target.value })
                    }
                    placeholder="例: INV"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 font-medium"
                >
                  登録
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false)
                    setFormData({
                      name: '',
                      code: '',
                      address: '',
                      phone: '',
                      fax: '',
                      contactPerson: '',
                      bankName: '',
                      bankBranch: '',
                      accountNumber: '',
                      accountHolder: '',
                      taxRate: '0.1',
                      invoiceNumberPrefix: '',
                      isActive: true,
                    })
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-900 rounded-md hover:bg-gray-300 font-medium"
                >
                  キャンセル
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 請求先企業一覧 */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {billingClients.length === 0 ? (
            <div className="p-6 text-center text-gray-700">
              請求先企業が登録されていません
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      請求先企業名
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      企業コード
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      連絡先
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      消費税率
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      紐づく従業員
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      請求書数
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      状態
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {billingClients.map((client) => (
                    <tr key={client.id} className="hover:bg-gray-50">
                      {editingClient?.id === client.id ? (
                        <>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={editingClient.name}
                              onChange={(e) =>
                                setEditingClient({
                                  ...editingClient,
                                  name: e.target.value,
                                })
                              }
                              className="w-full px-2 py-1 border border-gray-300 rounded text-gray-900 bg-white"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={editingClient.code || ''}
                              onChange={(e) =>
                                setEditingClient({
                                  ...editingClient,
                                  code: e.target.value || null,
                                })
                              }
                              className="w-full px-2 py-1 border border-gray-300 rounded text-gray-900 bg-white"
                            />
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {client.phone || '-'}
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={editingClient.taxRate.toString()}
                              onChange={(e) =>
                                setEditingClient({
                                  ...editingClient,
                                  taxRate: parseFloat(e.target.value),
                                })
                              }
                              className="w-full px-2 py-1 border border-gray-300 rounded text-gray-900 bg-white"
                            >
                              <option value="0.08">8%</option>
                              <option value="0.1">10%</option>
                            </select>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {client._count?.employees || 0}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {client._count?.invoices || 0}
                          </td>
                          <td className="px-4 py-3">
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={editingClient.isActive}
                                onChange={(e) =>
                                  setEditingClient({
                                    ...editingClient,
                                    isActive: e.target.checked,
                                  })
                                }
                                className="w-4 h-4"
                              />
                              <span className="text-sm text-gray-700">
                                {editingClient.isActive ? '有効' : '無効'}
                              </span>
                            </label>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleUpdate(editingClient)}
                                className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
                              >
                                保存
                              </button>
                              <button
                                onClick={() => setEditingClient(null)}
                                className="px-3 py-1 bg-gray-200 text-gray-900 rounded text-sm hover:bg-gray-300"
                              >
                                キャンセル
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {client.name}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {client.code || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {client.phone || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {(client.taxRate * 100).toFixed(0)}%
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {client._count?.employees || 0}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {client._count?.invoices || 0}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                client.isActive
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {client.isActive ? '有効' : '無効'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <button
                                onClick={() => setEditingClient(client)}
                                className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                              >
                                編集
                              </button>
                              <button
                                onClick={() => handleDelete(client.id)}
                                className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                              >
                                削除
                              </button>
                            </div>
                          </td>
                        </>
                      )}
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
