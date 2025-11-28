'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface Employee {
  id: number
  employeeNumber: string
  name: string
  email: string
  role: string
  department: string | null
  position: string | null
  phone: string | null
  birthDate: string | null
  address: string | null
  hireDate: string | null
  bankAccount: string | null
  transportationRoutes: any | null
  transportationCost: number | null
  isActive: boolean
}

export default function EmployeesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)

  const [formData, setFormData] = useState({
    employeeNumber: '',
    name: '',
    email: '',
    password: '',
    role: 'employee',
    department: '',
    position: '',
    phone: '',
    birthDate: '',
    address: '',
    bankAccount: '',
    transportationRoutes: [] as Array<{ from: string; to: string; method: string; amount: string }>,
    transportationCost: '',
  })

  useEffect(() => {
    if (status === 'authenticated' && session?.user.role === 'admin') {
      fetchEmployees()
    }
  }, [status, session])

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/admin/employees')
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('Failed to fetch employees:', response.status, response.statusText, errorData)
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
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const payload: any = {
        ...formData,
        bankAccount: formData.bankAccount || null,
        transportationRoutes: formData.transportationRoutes.length > 0 ? formData.transportationRoutes : null,
        transportationCost: formData.transportationCost ? parseInt(formData.transportationCost) : null,
      }
      const response = await fetch('/api/admin/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      if (data.success) {
        setShowCreateForm(false)
        setFormData({
          employeeNumber: '',
          name: '',
          email: '',
          password: '',
          role: 'employee',
          department: '',
          position: '',
          phone: '',
          birthDate: '',
          address: '',
          bankAccount: '',
          transportationRoutes: [],
          transportationCost: '',
        })
        fetchEmployees()
        alert('従業員を登録しました')
      } else {
        alert(data.error || '従業員の登録に失敗しました')
      }
    } catch (err) {
      console.error('Failed to create employee:', err)
      alert('従業員の登録に失敗しました')
    }
  }

  const handleUpdate = async (employee: Employee, isFromModal: boolean = false) => {
    try {
      const updateData: any = {
        employeeNumber: employee.employeeNumber,
        name: employee.name,
        email: employee.email,
        role: employee.role,
        department: employee.department || '',
        position: employee.position || '',
        phone: employee.phone || '',
        birthDate: employee.birthDate || null,
        address: employee.address || '',
        isActive: employee.isActive,
      }

      if (isFromModal) {
        // モーダルからの更新の場合、employeeオブジェクトから直接取得
        updateData.birthDate = employee.birthDate || null
        updateData.address = employee.address || null
        updateData.bankAccount = employee.bankAccount || null
        updateData.hireDate = employee.hireDate || null
        
        // パスワードが変更されている場合のみ含める
        const passwordInput = document.getElementById(
          `password-modal-${employee.id}`
        ) as HTMLInputElement
        if (passwordInput && passwordInput.value) {
          if (passwordInput.value.length < 8) {
            alert('パスワードは8文字以上で入力してください')
            return
          }
          updateData.password = passwordInput.value
        }
        
        // 交通経路と交通費の処理
        if (employee.transportationRoutes && Array.isArray(employee.transportationRoutes) && employee.transportationRoutes.length > 0) {
          updateData.transportationRoutes = employee.transportationRoutes
        } else {
          updateData.transportationRoutes = null
        }
        updateData.transportationCost = employee.transportationCost || null
      } else {
        // テーブルからの更新の場合（旧方式、互換性のため残す）
        const birthDateInput = document.getElementById(
          `birthDate-${employee.id}`
        ) as HTMLInputElement
        if (birthDateInput && birthDateInput.value) {
          updateData.birthDate = birthDateInput.value
        } else if (birthDateInput && !birthDateInput.value) {
          updateData.birthDate = null
        }

        const addressInput = document.getElementById(
          `address-${employee.id}`
        ) as HTMLInputElement
        if (addressInput) {
          updateData.address = addressInput.value || null
        }

        const hireDateInput = document.getElementById(
          `hireDate-${employee.id}`
        ) as HTMLInputElement
        if (hireDateInput && hireDateInput.value) {
          updateData.hireDate = hireDateInput.value
        } else if (hireDateInput && !hireDateInput.value) {
          updateData.hireDate = null
        }

        const passwordInput = document.getElementById(
          `password-${employee.id}`
        ) as HTMLInputElement
        if (passwordInput && passwordInput.value) {
          if (passwordInput.value.length < 8) {
            alert('パスワードは8文字以上で入力してください')
            return
          }
          updateData.password = passwordInput.value
        }

        if (editingEmployee && editingEmployee.transportationRoutes) {
          updateData.transportationRoutes = editingEmployee.transportationRoutes
        } else {
          updateData.transportationRoutes = null
        }

        const transportationCostInput = document.getElementById(
          `transportationCost-${employee.id}`
        ) as HTMLInputElement
        if (transportationCostInput) {
          updateData.transportationCost = transportationCostInput.value ? parseInt(transportationCostInput.value) : null
        }
      }

      const response = await fetch(`/api/admin/employees/${employee.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      })

      const data = await response.json()
      if (data.success) {
        setEditingEmployee(null)
        if (isFromModal) {
          setShowDetailModal(false)
          setSelectedEmployee(null)
        }
        fetchEmployees()
        alert('従業員情報を更新しました')
      } else {
        alert(data.error || '従業員情報の更新に失敗しました')
      }
    } catch (err) {
      console.error('Failed to update employee:', err)
      alert('従業員情報の更新に失敗しました')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('この従業員を削除しますか？\n関連するすべてのデータ（打刻、申請、シフト等）も削除されます。')) return

    try {
      const response = await fetch(`/api/admin/employees/${id}`, {
        method: 'DELETE',
      })

      const data = await response.json()
      if (data.success) {
        fetchEmployees()
        alert('従業員を削除しました')
      } else {
        alert(data.error || '従業員の削除に失敗しました')
      }
    } catch (err) {
      console.error('Failed to delete employee:', err)
      alert('従業員の削除に失敗しました')
    }
  }

  const handleEditClick = (employee: Employee) => {
    // 交通経路を配列形式に変換（JSON形式の場合はパース）
    let routes = []
    if (employee.transportationRoutes) {
      if (Array.isArray(employee.transportationRoutes)) {
        routes = employee.transportationRoutes
      } else if (typeof employee.transportationRoutes === 'string') {
        try {
          routes = JSON.parse(employee.transportationRoutes)
        } catch {
          routes = []
        }
      } else {
        routes = employee.transportationRoutes
      }
    }
    
    setEditingEmployee({
      ...employee,
      transportationRoutes: routes,
    })
    setShowCreateForm(false)
  }

  if (status === 'loading' || loading) {
    return <div className="p-8 text-center text-gray-900">読み込み中...</div>
  }

  return (
    <div className="p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">従業員管理</h1>
          <button
            onClick={() => {
              setShowCreateForm(!showCreateForm)
              setEditingEmployee(null)
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 font-medium"
          >
            {showCreateForm ? 'キャンセル' : '+ 従業員登録'}
          </button>
        </div>

        {/* 従業員登録フォーム */}
        {showCreateForm && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4 text-gray-900">新規従業員登録</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    社員番号 *
                  </label>
                  <input
                    type="text"
                    value={formData.employeeNumber}
                    onChange={(e) =>
                      setFormData({ ...formData, employeeNumber: e.target.value })
                    }
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    氏名 *
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
                    メールアドレス *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    パスワード *
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    required
                    minLength={8}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                  <p className="mt-1 text-xs text-gray-500">8文字以上</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    権限 *
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) =>
                      setFormData({ ...formData, role: e.target.value })
                    }
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  >
                    <option value="employee">従業員</option>
                    <option value="admin">管理者</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    部署
                  </label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) =>
                      setFormData({ ...formData, department: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    役職
                  </label>
                  <input
                    type="text"
                    value={formData.position}
                    onChange={(e) =>
                      setFormData({ ...formData, position: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    電話番号 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    生年月日
                  </label>
                  <input
                    type="date"
                    value={formData.birthDate}
                    onChange={(e) =>
                      setFormData({ ...formData, birthDate: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    住所 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    振込先口座 <span className="text-gray-500 text-xs">(任意)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.bankAccount}
                    onChange={(e) =>
                      setFormData({ ...formData, bankAccount: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    placeholder="例: 三菱UFJ銀行 1234567"
                  />
                </div>
              </div>

              {/* 交通経路入力 */}
              <div className="border-t pt-4 mt-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">
                  交通経路 <span className="text-gray-500 text-xs font-normal">(任意)</span>
                </h3>
                {formData.transportationRoutes.map((route, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-3 p-3 bg-gray-50 rounded">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">出発地</label>
                      <input
                        type="text"
                        value={route.from}
                        onChange={(e) => {
                          const newRoutes = [...formData.transportationRoutes]
                          newRoutes[index].from = e.target.value
                          setFormData({ ...formData, transportationRoutes: newRoutes })
                        }}
                        placeholder="例: 自宅"
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">到着地</label>
                      <input
                        type="text"
                        value={route.to}
                        onChange={(e) => {
                          const newRoutes = [...formData.transportationRoutes]
                          newRoutes[index].to = e.target.value
                          setFormData({ ...formData, transportationRoutes: newRoutes })
                        }}
                        placeholder="例: 本社"
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">交通手段</label>
                      <select
                        value={route.method}
                        onChange={(e) => {
                          const newRoutes = [...formData.transportationRoutes]
                          newRoutes[index].method = e.target.value
                          setFormData({ ...formData, transportationRoutes: newRoutes })
                        }}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white"
                      >
                        <option value="">選択</option>
                        <option value="train">電車</option>
                        <option value="bus">バス</option>
                        <option value="car">車</option>
                        <option value="bicycle">自転車</option>
                        <option value="walk">徒歩</option>
                        <option value="other">その他</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">金額（円）</label>
                      <input
                        type="number"
                        value={route.amount}
                        onChange={(e) => {
                          const newRoutes = [...formData.transportationRoutes]
                          newRoutes[index].amount = e.target.value
                          setFormData({ ...formData, transportationRoutes: newRoutes })
                        }}
                        placeholder="0"
                        min="0"
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white"
                      />
                    </div>
                    <div className="flex items-end">
                      {formData.transportationRoutes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const newRoutes = formData.transportationRoutes.filter((_, i) => i !== index)
                            setFormData({ ...formData, transportationRoutes: newRoutes })
                          }}
                          className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                        >
                          削除
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setFormData({
                      ...formData,
                      transportationRoutes: [
                        ...formData.transportationRoutes,
                        { from: '', to: '', method: '', amount: '' },
                      ],
                    })
                  }}
                  className="px-3 py-1 bg-gray-200 text-gray-900 rounded text-sm hover:bg-gray-300"
                >
                  + 経路を追加
                </button>
              </div>

              {/* 交通費（月額）入力 */}
              <div className="border-t pt-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    定期代（月額・円） <span className="text-gray-500 text-xs">(任意)</span>
                  </label>
                  <input
                    type="number"
                    value={formData.transportationCost}
                    onChange={(e) =>
                      setFormData({ ...formData, transportationCost: e.target.value })
                    }
                    placeholder="例: 15000"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                  <p className="mt-1 text-xs text-gray-500">月額の交通費を入力してください</p>
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
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-900 rounded-md hover:bg-gray-300 font-medium"
                >
                  キャンセル
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 従業員一覧 - カード形式 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          {employees.length === 0 ? (
            <div className="p-6 text-center text-gray-700">従業員がありません</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {employees.map((employee) => (
                <div
                  key={employee.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{employee.name}</h3>
                      <p className="text-sm text-gray-600">{employee.employeeNumber}</p>
                    </div>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        employee.role === 'admin'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {employee.role === 'admin' ? '管理者' : '従業員'}
                    </span>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    <div className="text-sm">
                      <span className="text-gray-600">メール:</span>
                      <span className="text-gray-900 ml-2">{employee.email}</span>
                    </div>
                    {employee.department && (
                      <div className="text-sm">
                        <span className="text-gray-600">部署:</span>
                        <span className="text-gray-900 ml-2">{employee.department}</span>
                      </div>
                    )}
                    {employee.position && (
                      <div className="text-sm">
                        <span className="text-gray-600">役職:</span>
                        <span className="text-gray-900 ml-2">{employee.position}</span>
                      </div>
                    )}
                    <div className="text-sm">
                      <span className="text-gray-600">ステータス:</span>
                      <span
                        className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${
                          employee.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {employee.isActive ? '有効' : '無効'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        // 交通経路を配列形式に変換
                        let routes = []
                        if (employee.transportationRoutes) {
                          if (Array.isArray(employee.transportationRoutes)) {
                            routes = employee.transportationRoutes
                          } else if (typeof employee.transportationRoutes === 'string') {
                            try {
                              routes = JSON.parse(employee.transportationRoutes)
                            } catch {
                              routes = []
                            }
                          } else {
                            routes = employee.transportationRoutes
                          }
                        }
                        setSelectedEmployee({
                          ...employee,
                          transportationRoutes: routes,
                        })
                        setShowDetailModal(true)
                      }}
                      className="flex-1 px-3 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 font-medium"
                    >
                      詳細・編集
                    </button>
                    <button
                      onClick={() => handleDelete(employee.id)}
                      disabled={employee.id === parseInt(session?.user.id || '0')}
                      className="px-3 py-2 bg-red-500 text-white rounded text-sm hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      title={
                        employee.id === parseInt(session?.user.id || '0')
                          ? '自分自身を削除することはできません'
                          : '削除'
                      }
                    >
                      削除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 従業員詳細・編集モーダル */}
        {showDetailModal && selectedEmployee && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900">
                  {selectedEmployee.name} の詳細情報
                </h2>
                <button
                  onClick={() => {
                    setShowDetailModal(false)
                    setSelectedEmployee(null)
                  }}
                  className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
                >
                  ×
                </button>
              </div>
              
              <div className="p-6">
                <form
                  onSubmit={async (e) => {
                    e.preventDefault()
                    await handleUpdate(selectedEmployee, true)
                  }}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        社員番号 *
                      </label>
                      <input
                        type="text"
                        value={selectedEmployee.employeeNumber}
                        onChange={(e) =>
                          setSelectedEmployee({
                            ...selectedEmployee,
                            employeeNumber: e.target.value,
                          })
                        }
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        氏名 *
                      </label>
                      <input
                        type="text"
                        value={selectedEmployee.name}
                        onChange={(e) =>
                          setSelectedEmployee({
                            ...selectedEmployee,
                            name: e.target.value,
                          })
                        }
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        メールアドレス *
                      </label>
                      <input
                        type="email"
                        value={selectedEmployee.email}
                        onChange={(e) =>
                          setSelectedEmployee({
                            ...selectedEmployee,
                            email: e.target.value,
                          })
                        }
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        パスワード変更（任意）
                      </label>
                      <input
                        id={`password-modal-${selectedEmployee.id}`}
                        type="password"
                        placeholder="変更する場合のみ入力"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        部署
                      </label>
                      <input
                        type="text"
                        value={selectedEmployee.department || ''}
                        onChange={(e) =>
                          setSelectedEmployee({
                            ...selectedEmployee,
                            department: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        役職
                      </label>
                      <input
                        type="text"
                        value={selectedEmployee.position || ''}
                        onChange={(e) =>
                          setSelectedEmployee({
                            ...selectedEmployee,
                            position: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        電話番号 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        value={selectedEmployee.phone || ''}
                        onChange={(e) =>
                          setSelectedEmployee({
                            ...selectedEmployee,
                            phone: e.target.value,
                          })
                        }
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        生年月日
                      </label>
                      <input
                        type="date"
                        value={
                          selectedEmployee.birthDate
                            ? new Date(selectedEmployee.birthDate).toISOString().split('T')[0]
                            : ''
                        }
                        onChange={(e) =>
                          setSelectedEmployee({
                            ...selectedEmployee,
                            birthDate: e.target.value || null,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                      />
                    </div>
                    
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        住所 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={selectedEmployee.address || ''}
                        onChange={(e) =>
                          setSelectedEmployee({
                            ...selectedEmployee,
                            address: e.target.value,
                          })
                        }
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                      />
                    </div>
                    
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        振込先口座 <span className="text-gray-500 text-xs">(任意)</span>
                      </label>
                      <input
                        type="text"
                        value={selectedEmployee.bankAccount || ''}
                        onChange={(e) =>
                          setSelectedEmployee({
                            ...selectedEmployee,
                            bankAccount: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                        placeholder="例: 三菱UFJ銀行 1234567"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        入社日
                      </label>
                      <input
                        type="date"
                        value={
                          selectedEmployee.hireDate
                            ? new Date(selectedEmployee.hireDate).toISOString().split('T')[0]
                            : ''
                        }
                        onChange={(e) =>
                          setSelectedEmployee({
                            ...selectedEmployee,
                            hireDate: e.target.value || null,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        権限 *
                      </label>
                      <select
                        value={selectedEmployee.role}
                        onChange={(e) =>
                          setSelectedEmployee({
                            ...selectedEmployee,
                            role: e.target.value,
                          })
                        }
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                      >
                        <option value="employee">従業員</option>
                        <option value="admin">管理者</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        ステータス
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedEmployee.isActive}
                          onChange={(e) =>
                            setSelectedEmployee({
                              ...selectedEmployee,
                              isActive: e.target.checked,
                            })
                          }
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-gray-700">
                          {selectedEmployee.isActive ? '有効' : '無効'}
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* 交通経路入力 */}
                  <div className="border-t pt-4">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">
                      交通経路 <span className="text-gray-500 text-xs font-normal">(任意)</span>
                    </h3>
                    {(() => {
                      const routes = selectedEmployee.transportationRoutes && Array.isArray(selectedEmployee.transportationRoutes)
                        ? selectedEmployee.transportationRoutes
                        : []
                      if (routes.length === 0) {
                        return <p className="text-sm text-gray-500 mb-2">交通経路が登録されていません</p>
                      }
                      return routes.map((route: any, index: number) => (
                        <div key={index} className="grid grid-cols-1 md:grid-cols-5 gap-2 p-3 bg-gray-50 rounded mb-2">
                          <input
                            type="text"
                            value={route.from || ''}
                            onChange={(e) => {
                              const currentRoutes = selectedEmployee.transportationRoutes && Array.isArray(selectedEmployee.transportationRoutes)
                                ? [...selectedEmployee.transportationRoutes]
                                : []
                              currentRoutes[index] = { ...currentRoutes[index], from: e.target.value }
                              setSelectedEmployee({
                                ...selectedEmployee,
                                transportationRoutes: currentRoutes,
                              })
                            }}
                            placeholder="出発地"
                            className="px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white"
                          />
                          <input
                            type="text"
                            value={route.to || ''}
                            onChange={(e) => {
                              const currentRoutes = selectedEmployee.transportationRoutes && Array.isArray(selectedEmployee.transportationRoutes)
                                ? [...selectedEmployee.transportationRoutes]
                                : []
                              currentRoutes[index] = { ...currentRoutes[index], to: e.target.value }
                              setSelectedEmployee({
                                ...selectedEmployee,
                                transportationRoutes: currentRoutes,
                              })
                            }}
                            placeholder="到着地"
                            className="px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white"
                          />
                          <select
                            value={route.method || ''}
                            onChange={(e) => {
                              const currentRoutes = selectedEmployee.transportationRoutes && Array.isArray(selectedEmployee.transportationRoutes)
                                ? [...selectedEmployee.transportationRoutes]
                                : []
                              currentRoutes[index] = { ...currentRoutes[index], method: e.target.value }
                              setSelectedEmployee({
                                ...selectedEmployee,
                                transportationRoutes: currentRoutes,
                              })
                            }}
                            className="px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white"
                          >
                            <option value="">選択</option>
                            <option value="train">電車</option>
                            <option value="bus">バス</option>
                            <option value="car">車</option>
                            <option value="bicycle">自転車</option>
                            <option value="walk">徒歩</option>
                            <option value="other">その他</option>
                          </select>
                          <input
                            type="number"
                            value={route.amount || ''}
                            onChange={(e) => {
                              const currentRoutes = selectedEmployee.transportationRoutes && Array.isArray(selectedEmployee.transportationRoutes)
                                ? [...selectedEmployee.transportationRoutes]
                                : []
                              currentRoutes[index] = { ...currentRoutes[index], amount: e.target.value }
                              setSelectedEmployee({
                                ...selectedEmployee,
                                transportationRoutes: currentRoutes,
                              })
                            }}
                            placeholder="金額"
                            min="0"
                            className="px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const currentRoutes = selectedEmployee.transportationRoutes && Array.isArray(selectedEmployee.transportationRoutes)
                                ? selectedEmployee.transportationRoutes.filter((_: any, i: number) => i !== index)
                                : []
                              setSelectedEmployee({
                                ...selectedEmployee,
                                transportationRoutes: currentRoutes,
                              })
                            }}
                            className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
                          >
                            削除
                          </button>
                        </div>
                      ))
                    })()}
                    <button
                      type="button"
                      onClick={() => {
                        const currentRoutes = selectedEmployee.transportationRoutes && Array.isArray(selectedEmployee.transportationRoutes)
                          ? [...selectedEmployee.transportationRoutes]
                          : []
                        currentRoutes.push({ from: '', to: '', method: '', amount: '' })
                        setSelectedEmployee({
                          ...selectedEmployee,
                          transportationRoutes: currentRoutes,
                        })
                      }}
                      className="px-3 py-1 bg-gray-200 text-gray-900 rounded text-sm hover:bg-gray-300"
                    >
                      + 経路を追加
                    </button>
                  </div>

                  {/* 交通費（月額）入力 */}
                  <div className="border-t pt-4">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">
                      定期代（月額・円） <span className="text-gray-500 text-xs font-normal">(任意)</span>
                    </h3>
                    <input
                      type="number"
                      value={selectedEmployee.transportationCost?.toString() || ''}
                      onChange={(e) =>
                        setSelectedEmployee({
                          ...selectedEmployee,
                          transportationCost: e.target.value ? parseInt(e.target.value) : null,
                        })
                      }
                      placeholder="例: 15000"
                      min="0"
                      className="w-full md:w-64 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    />
                  </div>

                  <div className="flex gap-2 pt-4 border-t">
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 font-medium"
                    >
                      保存
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowDetailModal(false)
                        setSelectedEmployee(null)
                      }}
                      className="px-4 py-2 bg-gray-200 text-gray-900 rounded-md hover:bg-gray-300 font-medium"
                    >
                      キャンセル
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
