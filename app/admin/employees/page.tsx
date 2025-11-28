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

  const handleUpdate = async (employee: Employee) => {
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

      // 生年月日の処理
      const birthDateInput = document.getElementById(
        `birthDate-${employee.id}`
      ) as HTMLInputElement
      if (birthDateInput && birthDateInput.value) {
        updateData.birthDate = birthDateInput.value
      } else if (birthDateInput && !birthDateInput.value) {
        updateData.birthDate = null
      }

      // 住所の処理
      const addressInput = document.getElementById(
        `address-${employee.id}`
      ) as HTMLInputElement
      if (addressInput) {
        updateData.address = addressInput.value || null
      }

      // 入社日の処理
      const hireDateInput = document.getElementById(
        `hireDate-${employee.id}`
      ) as HTMLInputElement
      if (hireDateInput && hireDateInput.value) {
        updateData.hireDate = hireDateInput.value
      } else if (hireDateInput && !hireDateInput.value) {
        updateData.hireDate = null
      }

      // パスワードが変更されている場合のみ含める
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

      // 交通経路の処理（editingEmployeeのstateから直接取得）
      if (editingEmployee && editingEmployee.transportationRoutes) {
        updateData.transportationRoutes = editingEmployee.transportationRoutes
      } else {
        updateData.transportationRoutes = null
      }

      // 交通費の処理
      const transportationCostInput = document.getElementById(
        `transportationCost-${employee.id}`
      ) as HTMLInputElement
      if (transportationCostInput) {
        updateData.transportationCost = transportationCostInput.value ? parseInt(transportationCostInput.value) : null
      }

      const response = await fetch(`/api/admin/employees/${employee.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      })

      const data = await response.json()
      if (data.success) {
        setEditingEmployee(null)
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
              </div>

              {/* 交通経路入力 */}
              <div className="border-t pt-4 mt-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">交通経路</h3>
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
                    交通費（月額・円）
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

        {/* 従業員一覧 */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {employees.length === 0 ? (
            <div className="p-6 text-center text-gray-700">従業員がありません</div>
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
                      メールアドレス
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      部署
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      役職
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      電話番号
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      生年月日
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      住所
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      入社日
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      権限
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
                  {employees.map((employee) => (
                    <>
                      {editingEmployee?.id === employee.id ? (
                        <tr key={employee.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={editingEmployee.employeeNumber}
                              onChange={(e) =>
                                setEditingEmployee({
                                  ...editingEmployee,
                                  employeeNumber: e.target.value,
                                })
                              }
                              className="px-2 py-1 border border-gray-300 rounded text-gray-900 bg-white w-full"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={editingEmployee.name}
                              onChange={(e) =>
                                setEditingEmployee({
                                  ...editingEmployee,
                                  name: e.target.value,
                                })
                              }
                              className="px-2 py-1 border border-gray-300 rounded text-gray-900 bg-white w-full"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="email"
                              value={editingEmployee.email}
                              onChange={(e) =>
                                setEditingEmployee({
                                  ...editingEmployee,
                                  email: e.target.value,
                                })
                              }
                              className="px-2 py-1 border border-gray-300 rounded text-gray-900 bg-white w-full"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={editingEmployee.department || ''}
                              onChange={(e) =>
                                setEditingEmployee({
                                  ...editingEmployee,
                                  department: e.target.value,
                                })
                              }
                              className="px-2 py-1 border border-gray-300 rounded text-gray-900 bg-white w-full"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={editingEmployee.position || ''}
                              onChange={(e) =>
                                setEditingEmployee({
                                  ...editingEmployee,
                                  position: e.target.value,
                                })
                              }
                              className="px-2 py-1 border border-gray-300 rounded text-gray-900 bg-white w-full"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="tel"
                              value={editingEmployee.phone || ''}
                              onChange={(e) =>
                                setEditingEmployee({
                                  ...editingEmployee,
                                  phone: e.target.value,
                                })
                              }
                              className="px-2 py-1 border border-gray-300 rounded text-gray-900 bg-white w-full"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              id={`birthDate-${employee.id}`}
                              type="date"
                              defaultValue={
                                editingEmployee.birthDate
                                  ? new Date(editingEmployee.birthDate).toISOString().split('T')[0]
                                  : ''
                              }
                              className="px-2 py-1 border border-gray-300 rounded text-gray-900 bg-white w-full"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              id={`address-${employee.id}`}
                              type="text"
                              defaultValue={editingEmployee.address || ''}
                              className="px-2 py-1 border border-gray-300 rounded text-gray-900 bg-white w-full"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              id={`hireDate-${employee.id}`}
                              type="date"
                              defaultValue={
                                editingEmployee.hireDate
                                  ? new Date(editingEmployee.hireDate).toISOString().split('T')[0]
                                  : ''
                              }
                              className="px-2 py-1 border border-gray-300 rounded text-gray-900 bg-white w-full"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={editingEmployee.role}
                              onChange={(e) =>
                                setEditingEmployee({
                                  ...editingEmployee,
                                  role: e.target.value,
                                })
                              }
                              className="px-2 py-1 border border-gray-300 rounded text-gray-900 bg-white"
                            >
                              <option value="employee">従業員</option>
                              <option value="admin">管理者</option>
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={editingEmployee.isActive}
                                onChange={(e) =>
                                  setEditingEmployee({
                                    ...editingEmployee,
                                    isActive: e.target.checked,
                                  })
                                }
                                className="w-4 h-4"
                              />
                              <span className="text-sm text-gray-700">
                                {editingEmployee.isActive ? '有効' : '無効'}
                              </span>
                            </label>
                          </td>
                          <td className="px-4 py-3">
                            <div className="space-y-2">
                              <input
                                id={`password-${employee.id}`}
                                type="password"
                                placeholder="パスワード変更（任意）"
                                className="px-2 py-1 border border-gray-300 rounded text-gray-900 bg-white text-xs w-full"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleUpdate(editingEmployee)}
                                  className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
                                >
                                  保存
                                </button>
                                <button
                                  onClick={() => setEditingEmployee(null)}
                                  className="px-3 py-1 bg-gray-200 text-gray-900 rounded text-sm hover:bg-gray-300"
                                >
                                  キャンセル
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        <tr key={employee.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {employee.employeeNumber}
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                            {employee.name}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {employee.email}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {employee.department || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {employee.position || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {employee.phone || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {employee.birthDate
                              ? new Date(employee.birthDate).toLocaleDateString('ja-JP')
                              : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {employee.address || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {employee.hireDate
                              ? new Date(employee.hireDate).toLocaleDateString('ja-JP')
                              : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                employee.role === 'admin'
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {employee.role === 'admin' ? '管理者' : '従業員'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                employee.isActive
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {employee.isActive ? '有効' : '無効'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEditClick(employee)}
                                className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                              >
                                編集
                              </button>
                              <button
                                onClick={() => handleDelete(employee.id)}
                                disabled={employee.id === parseInt(session?.user.id || '0')}
                                className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                title={
                                  employee.id === parseInt(session?.user.id || '0')
                                    ? '自分自身を削除することはできません'
                                    : '削除'
                                }
                              >
                                削除
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                      {editingEmployee?.id === employee.id && (
                      <tr>
                        <td colSpan={12} className="px-4 py-4 bg-gray-50">
                          <div className="space-y-4">
                            {/* 交通経路入力 */}
                            <div>
                              <h4 className="text-sm font-semibold text-gray-900 mb-2">交通経路</h4>
                              <div id={`transportationRoutes-${employee.id}`} className="space-y-2">
                                {(() => {
                                  const routes = editingEmployee.transportationRoutes && Array.isArray(editingEmployee.transportationRoutes)
                                    ? editingEmployee.transportationRoutes
                                    : []
                                  return routes.length > 0 ? routes.map((route: any, index: number) => (
                                    <div key={index} className="grid grid-cols-1 md:grid-cols-5 gap-2 p-2 bg-white rounded border">
                                      <input
                                        type="text"
                                        defaultValue={route.from || ''}
                                        placeholder="出発地"
                                        className="px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white"
                                        onChange={(e) => {
                                          const currentRoutes = editingEmployee.transportationRoutes && Array.isArray(editingEmployee.transportationRoutes)
                                            ? [...editingEmployee.transportationRoutes]
                                            : []
                                          currentRoutes[index] = { ...currentRoutes[index], from: e.target.value }
                                          setEditingEmployee({ ...editingEmployee, transportationRoutes: currentRoutes })
                                        }}
                                      />
                                      <input
                                        type="text"
                                        defaultValue={route.to || ''}
                                        placeholder="到着地"
                                        className="px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white"
                                        onChange={(e) => {
                                          const currentRoutes = editingEmployee.transportationRoutes && Array.isArray(editingEmployee.transportationRoutes)
                                            ? [...editingEmployee.transportationRoutes]
                                            : []
                                          currentRoutes[index] = { ...currentRoutes[index], to: e.target.value }
                                          setEditingEmployee({ ...editingEmployee, transportationRoutes: currentRoutes })
                                        }}
                                      />
                                      <select
                                        defaultValue={route.method || ''}
                                        className="px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white"
                                        onChange={(e) => {
                                          const currentRoutes = editingEmployee.transportationRoutes && Array.isArray(editingEmployee.transportationRoutes)
                                            ? [...editingEmployee.transportationRoutes]
                                            : []
                                          currentRoutes[index] = { ...currentRoutes[index], method: e.target.value }
                                          setEditingEmployee({ ...editingEmployee, transportationRoutes: currentRoutes })
                                        }}
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
                                        defaultValue={route.amount || ''}
                                        placeholder="金額"
                                        min="0"
                                        className="px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white"
                                        onChange={(e) => {
                                          const currentRoutes = editingEmployee.transportationRoutes && Array.isArray(editingEmployee.transportationRoutes)
                                            ? [...editingEmployee.transportationRoutes]
                                            : []
                                          currentRoutes[index] = { ...currentRoutes[index], amount: e.target.value }
                                          setEditingEmployee({ ...editingEmployee, transportationRoutes: currentRoutes })
                                        }}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const currentRoutes = editingEmployee.transportationRoutes && Array.isArray(editingEmployee.transportationRoutes)
                                            ? editingEmployee.transportationRoutes.filter((_: any, i: number) => i !== index)
                                            : []
                                          setEditingEmployee({ ...editingEmployee, transportationRoutes: currentRoutes })
                                        }}
                                        className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
                                      >
                                        削除
                                      </button>
                                    </div>
                                  )) : null
                                })()}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const currentRoutes = editingEmployee.transportationRoutes && Array.isArray(editingEmployee.transportationRoutes)
                                      ? [...editingEmployee.transportationRoutes]
                                      : []
                                    currentRoutes.push({ from: '', to: '', method: '', amount: '' })
                                    setEditingEmployee({ ...editingEmployee, transportationRoutes: currentRoutes })
                                  }}
                                  className="px-3 py-1 bg-gray-200 text-gray-900 rounded text-sm hover:bg-gray-300"
                                >
                                  + 経路を追加
                                </button>
                              </div>
                            </div>

                            {/* 交通費（月額）入力 */}
                            <div>
                              <h4 className="text-sm font-semibold text-gray-900 mb-2">交通費（月額・円）</h4>
                              <input
                                id={`transportationCost-${employee.id}`}
                                type="number"
                                defaultValue={editingEmployee.transportationCost?.toString() || ''}
                                placeholder="例: 15000"
                                min="0"
                                className="w-full md:w-64 px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white"
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                      )}
                    </>
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
