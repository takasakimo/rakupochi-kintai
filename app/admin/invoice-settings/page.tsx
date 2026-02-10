'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface CompanyInfo {
  id: number
  name: string
  email: string | null
  phone: string | null
  address: string | null
  issuerName: string | null
  taxId: string | null
  bankName: string | null
  bankBranch: string | null
  accountNumber: string | null
  accountHolder: string | null
  invoiceItemNameTemplate: string | null
}

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

export default function InvoiceSettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'company' | 'clients'>('company')
  const [loading, setLoading] = useState(true)
  const [enableInvoice, setEnableInvoice] = useState<boolean>(false)
  
  // 自社情報
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null)
  const [companyFormData, setCompanyFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    issuerName: '',
    taxId: '',
    bankName: '',
    bankBranch: '',
    accountNumber: '',
    accountHolder: '',
    invoiceItemNameTemplate: '{businessName}委託費用',
  })
  const [savingCompany, setSavingCompany] = useState(false)
  
  // 請求先企業管理
  const [billingClients, setBillingClients] = useState<BillingClient[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingClient, setEditingClient] = useState<BillingClient | null>(null)
  const [clientFormData, setClientFormData] = useState({
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
          fetchCompanyInfo()
          fetchBillingClients()
        } else {
          router.push('/admin/dashboard')
        }
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchCompanyInfo = async () => {
    try {
      const response = await fetch('/api/admin/invoice-settings/company')
      if (response.ok) {
        const data = await response.json()
        setCompanyInfo(data.company)
        if (data.company) {
          setCompanyFormData({
            name: data.company.name || '',
            email: data.company.email || '',
            phone: data.company.phone || '',
            address: data.company.address || '',
            issuerName: data.company.issuerName || '',
            taxId: data.company.taxId || '',
            bankName: data.company.bankName || '',
            bankBranch: data.company.bankBranch || '',
            accountNumber: data.company.accountNumber || '',
            accountHolder: data.company.accountHolder || '',
            invoiceItemNameTemplate: data.company.invoiceItemNameTemplate 
              ? data.company.invoiceItemNameTemplate.replace(/{employeeName}/g, '{businessName}')
              : '{businessName}委託費用',
          })
        }
      }
    } catch (err) {
      console.error('Failed to fetch company info:', err)
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

  const handleSaveCompanyInfo = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingCompany(true)
    try {
      const response = await fetch('/api/admin/invoice-settings/company', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(companyFormData),
      })
      if (response.ok) {
        alert('自社情報を保存しました')
        fetchCompanyInfo()
      } else {
        const error = await response.json()
        alert(`保存に失敗しました: ${error.error}`)
      }
    } catch (err) {
      console.error('Failed to save company info:', err)
      alert('保存に失敗しました')
    } finally {
      setSavingCompany(false)
    }
  }

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch('/api/admin/billing-clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...clientFormData,
          taxRate: parseFloat(clientFormData.taxRate),
        }),
      })
      if (response.ok) {
        alert('請求先企業を登録しました')
        setShowCreateForm(false)
        setClientFormData({
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
      } else {
        const error = await response.json()
        alert(`登録に失敗しました: ${error.error}`)
      }
    } catch (err) {
      console.error('Failed to create billing client:', err)
      alert('登録に失敗しました')
    }
  }

  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingClient) return
    try {
      const response = await fetch(`/api/admin/billing-clients/${editingClient.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...clientFormData,
          taxRate: parseFloat(clientFormData.taxRate),
        }),
      })
      if (response.ok) {
        alert('請求先企業を更新しました')
        setEditingClient(null)
        setClientFormData({
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
      } else {
        const error = await response.json()
        alert(`更新に失敗しました: ${error.error}`)
      }
    } catch (err) {
      console.error('Failed to update billing client:', err)
      alert('更新に失敗しました')
    }
  }

  const handleDeleteClient = async (id: number) => {
    if (!confirm('この請求先企業を削除しますか？')) return
    try {
      const response = await fetch(`/api/admin/billing-clients/${id}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        alert('請求先企業を削除しました')
        fetchBillingClients()
      } else {
        const error = await response.json()
        alert(`削除に失敗しました: ${error.error}`)
      }
    } catch (err) {
      console.error('Failed to delete billing client:', err)
      alert('削除に失敗しました')
    }
  }

  const startEditClient = (client: BillingClient) => {
    setEditingClient(client)
    setClientFormData({
      name: client.name,
      code: client.code || '',
      address: client.address || '',
      phone: client.phone || '',
      fax: client.fax || '',
      contactPerson: client.contactPerson || '',
      bankName: client.bankName || '',
      bankBranch: client.bankBranch || '',
      accountNumber: client.accountNumber || '',
      accountHolder: client.accountHolder || '',
      taxRate: client.taxRate.toString(),
      invoiceNumberPrefix: client.invoiceNumberPrefix || '',
      isActive: client.isActive,
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">読み込み中...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">請求書設定</h1>

      {/* タブ */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('company')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'company'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            自社情報設定
          </button>
          <button
            onClick={() => setActiveTab('clients')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'clients'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            請求先企業管理
          </button>
        </nav>
      </div>

      {/* 自社情報設定タブ */}
      {activeTab === 'company' && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">自社情報設定</h2>
          <p className="text-gray-600 mb-6">
            請求書に表示される自社情報と振込先情報を設定します。
          </p>

          <form onSubmit={handleSaveCompanyInfo} className="space-y-6">
            <div className="border-b pb-6">
              <h3 className="text-lg font-semibold mb-4">企業情報</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    企業名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={companyFormData.name}
                    onChange={(e) => setCompanyFormData({ ...companyFormData, name: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={companyFormData.email}
                    onChange={(e) => setCompanyFormData({ ...companyFormData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    電話番号
                  </label>
                  <input
                    type="tel"
                    value={companyFormData.phone}
                    onChange={(e) => setCompanyFormData({ ...companyFormData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    住所
                  </label>
                  <textarea
                    value={companyFormData.address}
                    onChange={(e) => setCompanyFormData({ ...companyFormData, address: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
            <div className="border-b pb-6">
              <h3 className="text-lg font-semibold mb-4">請求書表示情報</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    発行者名
                  </label>
                  <input
                    type="text"
                    value={companyFormData.issuerName}
                    onChange={(e) => setCompanyFormData({ ...companyFormData, issuerName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="mt-1 text-sm text-gray-500">請求書に表示される発行者名</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    適格番号
                  </label>
                  <input
                    type="text"
                    value={companyFormData.taxId}
                    onChange={(e) => setCompanyFormData({ ...companyFormData, taxId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                請求書費目テンプレート
              </label>
              <input
                type="text"
                value={companyFormData.invoiceItemNameTemplate || ''}
                onChange={(e) => setCompanyFormData({ ...companyFormData, invoiceItemNameTemplate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="{businessName}委託費用"
              />
            </div>

            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4">振込先情報</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    銀行名
                  </label>
                  <input
                    type="text"
                    value={companyFormData.bankName}
                    onChange={(e) => setCompanyFormData({ ...companyFormData, bankName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    支店名
                  </label>
                  <input
                    type="text"
                    value={companyFormData.bankBranch}
                    onChange={(e) => setCompanyFormData({ ...companyFormData, bankBranch: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    口座番号
                  </label>
                  <input
                    type="text"
                    value={companyFormData.accountNumber}
                    onChange={(e) => setCompanyFormData({ ...companyFormData, accountNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    口座名義
                  </label>
                  <input
                    type="text"
                    value={companyFormData.accountHolder}
                    onChange={(e) => setCompanyFormData({ ...companyFormData, accountHolder: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingCompany}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingCompany ? '保存中...' : '保存'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 請求先企業管理タブ */}
      {activeTab === 'clients' && (
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">請求先企業管理</h2>
            {!showCreateForm && !editingClient && (
              <button
                onClick={() => setShowCreateForm(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                新規登録
              </button>
            )}
          </div>

          {/* 作成フォーム */}
          {showCreateForm && (
            <div className="mb-6 p-4 border border-gray-300 rounded-lg">
              <h3 className="text-lg font-semibold mb-4">請求先企業を新規登録</h3>
              <form onSubmit={handleCreateClient} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      企業名 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={clientFormData.name}
                      onChange={(e) => setClientFormData({ ...clientFormData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      企業コード
                    </label>
                    <input
                      type="text"
                      value={clientFormData.code}
                      onChange={(e) => setClientFormData({ ...clientFormData, code: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      住所
                    </label>
                    <input
                      type="text"
                      value={clientFormData.address}
                      onChange={(e) => setClientFormData({ ...clientFormData, address: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      電話番号
                    </label>
                    <input
                      type="text"
                      value={clientFormData.phone}
                      onChange={(e) => setClientFormData({ ...clientFormData, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      FAX
                    </label>
                    <input
                      type="text"
                      value={clientFormData.fax}
                      onChange={(e) => setClientFormData({ ...clientFormData, fax: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      担当者名
                    </label>
                    <input
                      type="text"
                      value={clientFormData.contactPerson}
                      onChange={(e) => setClientFormData({ ...clientFormData, contactPerson: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      消費税率
                    </label>
                    <select
                      value={clientFormData.taxRate}
                      onChange={(e) => setClientFormData({ ...clientFormData, taxRate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="0.1">10%</option>
                      <option value="0.08">8%</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      請求書番号プレフィックス
                    </label>
                    <input
                      type="text"
                      value={clientFormData.invoiceNumberPrefix}
                      onChange={(e) => setClientFormData({ ...clientFormData, invoiceNumberPrefix: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateForm(false)
                      setClientFormData({
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
                    className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    登録
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 編集フォーム */}
          {editingClient && (
            <div className="mb-6 p-4 border border-gray-300 rounded-lg">
              <h3 className="text-lg font-semibold mb-4">請求先企業を編集</h3>
              <form onSubmit={handleUpdateClient} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      企業名 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={clientFormData.name}
                      onChange={(e) => setClientFormData({ ...clientFormData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      企業コード
                    </label>
                    <input
                      type="text"
                      value={clientFormData.code}
                      onChange={(e) => setClientFormData({ ...clientFormData, code: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      住所
                    </label>
                    <input
                      type="text"
                      value={clientFormData.address}
                      onChange={(e) => setClientFormData({ ...clientFormData, address: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      電話番号
                    </label>
                    <input
                      type="text"
                      value={clientFormData.phone}
                      onChange={(e) => setClientFormData({ ...clientFormData, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      FAX
                    </label>
                    <input
                      type="text"
                      value={clientFormData.fax}
                      onChange={(e) => setClientFormData({ ...clientFormData, fax: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      担当者名
                    </label>
                    <input
                      type="text"
                      value={clientFormData.contactPerson}
                      onChange={(e) => setClientFormData({ ...clientFormData, contactPerson: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      消費税率
                    </label>
                    <select
                      value={clientFormData.taxRate}
                      onChange={(e) => setClientFormData({ ...clientFormData, taxRate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="0.1">10%</option>
                      <option value="0.08">8%</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      請求書番号プレフィックス
                    </label>
                    <input
                      type="text"
                      value={clientFormData.invoiceNumberPrefix}
                      onChange={(e) => setClientFormData({ ...clientFormData, invoiceNumberPrefix: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingClient(null)
                      setClientFormData({
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
                    className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    更新
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 請求先企業一覧 */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    企業名
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    企業コード
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    従業員数
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    請求書数
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    状態
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {billingClients.map((client) => (
                  <tr key={client.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {client.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {client.code || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {client._count?.employees || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {client._count?.invoices || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        client.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {client.isActive ? '有効' : '無効'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => startEditClient(client)}
                        className="text-blue-600 hover:text-blue-900 mr-4"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => handleDeleteClient(client.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        削除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {billingClients.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                請求先企業が登録されていません
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
