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
  workLocation: string | null
  workLocationAddress: string | null
  position: string | null
  phone: string | null
  birthDate: string | null
  address: string | null
  hireDate: string | null
  bankAccount: string | null
  transportationRoutes: any | null
  transportationCost: number | null
  paidLeaveGrantDate: string | null
  yearsOfService: number | null
  paidLeaveBalance: number
  isActive: boolean
}

interface Location {
  id: number
  name: string
  address: string | null
  latitude: number
  longitude: number
  radius: number
  isActive: boolean
}

export default function EmployeesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'employees' | 'locations'>('employees')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  
  // フィルター用の状態
  const [displayMode, setDisplayMode] = useState<'all' | 'department' | 'location'>('all')
  const [selectedDepartment, setSelectedDepartment] = useState<string>('')
  const [selectedLocation, setSelectedLocation] = useState<string>('')
  const [locations, setLocations] = useState<{ id: number; name: string; address?: string | null }[]>([])
  const [locationEmployeeIds, setLocationEmployeeIds] = useState<Set<number>>(new Set())

  // 勤務先登録用の状態
  const [workLocations, setWorkLocations] = useState<Location[]>([])
  const [workLocationsLoading, setWorkLocationsLoading] = useState(false)
  const [showLocationForm, setShowLocationForm] = useState(false)
  const [editingWorkLocation, setEditingWorkLocation] = useState<Location | null>(null)
  const [locationFormData, setLocationFormData] = useState({
    name: '',
    address: '',
    latitude: '',
    longitude: '',
    radius: '500',
  })
  const [geocodingLoading, setGeocodingLoading] = useState(false)

  const [formData, setFormData] = useState({
    employeeNumber: '',
    name: '',
    email: '',
    password: '',
    role: 'employee',
    department: '',
    workLocation: '',
    workLocationAddress: '',
    position: '',
    phone: '',
    birthDate: '',
    address: '',
    bankAccount: '',
    transportationRoutes: [] as Array<{ from: string; to: string; method: string; amount: string }>,
    transportationCost: '',
    hireDate: '',
    paidLeaveGrantDate: '',
    yearsOfService: '',
    paidLeaveBalance: '0',
  })

  useEffect(() => {
    if (status === 'authenticated' && session?.user.role === 'admin') {
      fetchEmployees()
      fetchLocations()
      if (activeTab === 'locations') {
        fetchWorkLocations()
      }
    }
  }, [status, session, activeTab])
  
  const fetchLocations = async () => {
    try {
      const response = await fetch('/api/admin/locations')
      if (response.ok) {
        const data = await response.json()
        setLocations(data.locations || [])
      }
    } catch (err) {
      console.error('Failed to fetch locations:', err)
    }
  }

  const fetchWorkLocations = async () => {
    setWorkLocationsLoading(true)
    try {
      const response = await fetch('/api/admin/locations?all=true')
      if (response.ok) {
        const data = await response.json()
        setWorkLocations(data.locations || [])
      }
    } catch (err) {
      console.error('Failed to fetch work locations:', err)
    } finally {
      setWorkLocationsLoading(false)
    }
  }

  // 住所から緯度経度を自動取得（勤務先登録用）
  const handleAddressGeocode = async (address: string) => {
    if (!address || address.trim() === '') {
      return
    }

    setGeocodingLoading(true)
    try {
      const response = await fetch('/api/admin/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      })

      const data = await response.json()
      
      if (!response.ok) {
        console.warn('緯度経度の取得に失敗しました:', response.status, data.error || response.statusText)
        return
      }

      if (data.success && data.latitude && data.longitude) {
        setLocationFormData({
          ...locationFormData,
          latitude: data.latitude.toString(),
          longitude: data.longitude.toString(),
        })
      } else {
        console.warn('緯度経度の取得に失敗しました:', data.error || '住所が見つかりませんでした')
      }
    } catch (err) {
      console.error('Failed to geocode address:', err)
    } finally {
      setGeocodingLoading(false)
    }
  }

  // 住所から緯度経度を自動取得（編集用）
  const handleEditAddressGeocode = async (address: string) => {
    if (!address || address.trim() === '' || !editingWorkLocation) {
      return
    }

    setGeocodingLoading(true)
    try {
      const response = await fetch('/api/admin/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      })

      const data = await response.json()
      
      if (!response.ok) {
        console.warn('緯度経度の取得に失敗しました:', response.status, data.error || response.statusText)
        return
      }

      if (data.success && data.latitude && data.longitude) {
        setEditingWorkLocation({
          ...editingWorkLocation,
          latitude: data.latitude,
          longitude: data.longitude,
        })
      } else {
        console.warn('緯度経度の取得に失敗しました:', data.error || '住所が見つかりませんでした')
      }
    } catch (err) {
      console.error('Failed to geocode address:', err)
    } finally {
      setGeocodingLoading(false)
    }
  }

  const handleCreateWorkLocation = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch('/api/admin/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: locationFormData.name,
          address: locationFormData.address || null,
          latitude: locationFormData.latitude ? parseFloat(locationFormData.latitude) : 0,
          longitude: locationFormData.longitude ? parseFloat(locationFormData.longitude) : 0,
          radius: locationFormData.radius ? parseInt(locationFormData.radius) : 500,
        }),
      })

      const data = await response.json()
      if (data.success) {
        setShowLocationForm(false)
        setLocationFormData({
          name: '',
          address: '',
          latitude: '',
          longitude: '',
          radius: '500',
        })
        fetchWorkLocations()
        fetchLocations() // 従業員管理のフィルター用にも更新
        alert('勤務先を登録しました')
      } else {
        alert(data.error || '勤務先の登録に失敗しました')
      }
    } catch (err) {
      console.error('Failed to create work location:', err)
      alert('勤務先の登録に失敗しました')
    }
  }

  const handleUpdateWorkLocation = async (location: Location) => {
    try {
      const response = await fetch(`/api/admin/locations/${location.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: location.name,
          address: location.address,
          latitude: location.latitude,
          longitude: location.longitude,
          radius: location.radius,
          isActive: location.isActive,
        }),
      })

      const data = await response.json()
      if (data.success) {
        setEditingWorkLocation(null)
        fetchWorkLocations()
        fetchLocations() // 従業員管理のフィルター用にも更新
        alert('勤務先を更新しました')
      } else {
        alert(data.error || '勤務先の更新に失敗しました')
      }
    } catch (err) {
      console.error('Failed to update work location:', err)
      alert('勤務先の更新に失敗しました')
    }
  }

  const handleDeleteWorkLocation = async (id: number) => {
    if (!confirm('この勤務先を削除しますか？')) return

    try {
      const response = await fetch(`/api/admin/locations/${id}`, {
        method: 'DELETE',
      })

      const data = await response.json()
      if (data.success) {
        fetchWorkLocations()
        fetchLocations() // 従業員管理のフィルター用にも更新
        alert('勤務先を削除しました')
      } else {
        alert(data.error || '勤務先の削除に失敗しました')
      }
    } catch (err) {
      console.error('Failed to delete work location:', err)
      alert('勤務先の削除に失敗しました')
    }
  }
  
  // 店舗でフィルターする場合、シフトから該当店舗の従業員IDを取得
  useEffect(() => {
    if (displayMode === 'location' && selectedLocation) {
      fetchLocationEmployees()
    } else {
      setLocationEmployeeIds(new Set())
    }
  }, [displayMode, selectedLocation])
  
  const fetchLocationEmployees = async () => {
    try {
      // 現在の月のシフトデータを取得
      const now = new Date()
      const year = now.getFullYear()
      const month = now.getMonth() + 1
      const daysInMonth = new Date(year, month, 0).getDate()
      const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`
      const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`
      
      const params = new URLSearchParams()
      params.append('start_date', startDateStr)
      params.append('end_date', endDateStr)
      params.append('workLocation', selectedLocation)
      
      const response = await fetch(`/api/admin/shifts?${params.toString()}`)
      const data = await response.json()
      
      if (data.shifts && Array.isArray(data.shifts)) {
        const employeeIds = new Set<number>(
          data.shifts
            .filter((shift: any) => shift.workLocation === selectedLocation)
            .map((shift: any) => shift.employee.id)
            .filter((id: any): id is number => typeof id === 'number')
        )
        setLocationEmployeeIds(employeeIds)
      }
    } catch (err) {
      console.error('Failed to fetch location employees:', err)
      setLocationEmployeeIds(new Set())
    }
  }

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
        hireDate: formData.hireDate || null,
        paidLeaveGrantDate: formData.paidLeaveGrantDate || null,
        yearsOfService: formData.yearsOfService ? parseFloat(formData.yearsOfService) : null,
        paidLeaveBalance: formData.paidLeaveBalance ? parseInt(formData.paidLeaveBalance) : 0,
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
          workLocation: '',
          workLocationAddress: '',
          position: '',
          phone: '',
          birthDate: '',
          address: '',
          bankAccount: '',
          transportationRoutes: [],
          transportationCost: '',
          hireDate: '',
          paidLeaveGrantDate: '',
          yearsOfService: '',
          paidLeaveBalance: '0',
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
        workLocation: employee.workLocation || '',
        workLocationAddress: employee.workLocationAddress || '',
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
        updateData.paidLeaveGrantDate = employee.paidLeaveGrantDate || null
        updateData.yearsOfService = employee.yearsOfService || null
        updateData.paidLeaveBalance = employee.paidLeaveBalance || 0
        
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
  
  // 事業部の一覧を取得
  const getDepartments = (): string[] => {
    const departments = new Set<string>()
    employees.forEach(emp => {
      if (emp.department) {
        departments.add(emp.department)
      }
    })
    return Array.from(departments).sort()
  }
  
  // フィルターされた従業員を取得
  const getFilteredEmployees = (): Employee[] => {
    let filtered = employees
    
    if (displayMode === 'department' && selectedDepartment) {
      filtered = filtered.filter(emp => emp.department === selectedDepartment)
    } else if (displayMode === 'location' && selectedLocation) {
      // 店舗でフィルターする場合、シフトデータから該当店舗の従業員IDを使用
      filtered = filtered.filter(emp => locationEmployeeIds.has(emp.id))
    }
    
    return filtered
  }

  if (status === 'loading' || loading) {
    return <div className="p-8 text-center text-gray-900">読み込み中...</div>
  }

  return (
    <div className="p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">従業員管理</h1>
          {activeTab === 'employees' && (
            <button
              onClick={() => {
                setShowCreateForm(!showCreateForm)
                setEditingEmployee(null)
              }}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 font-medium"
            >
              {showCreateForm ? 'キャンセル' : '+ 従業員登録'}
            </button>
          )}
          {activeTab === 'locations' && (
            <button
              onClick={() => {
                setShowLocationForm(!showLocationForm)
                setEditingWorkLocation(null)
              }}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 font-medium"
            >
              {showLocationForm ? 'キャンセル' : '+ 勤務先登録'}
            </button>
          )}
        </div>

        {/* タブ */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('employees')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'employees'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              従業員管理
            </button>
            <button
              onClick={() => setActiveTab('locations')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'locations'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              勤務先登録
            </button>
          </nav>
        </div>

        {/* 勤務先登録タブのコンテンツ */}
        {activeTab === 'locations' && (
          <>
            {/* 新規勤務先登録フォーム */}
            {showLocationForm && (
              <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <h2 className="text-lg font-semibold mb-4 text-gray-900">新規勤務先登録</h2>
                <form onSubmit={handleCreateWorkLocation} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      勤務先名 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={locationFormData.name}
                      onChange={(e) =>
                        setLocationFormData({ ...locationFormData, name: e.target.value })
                      }
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      住所
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={locationFormData.address}
                        onChange={(e) =>
                          setLocationFormData({ ...locationFormData, address: e.target.value })
                        }
                        onBlur={(e) => {
                          if (e.target.value.trim() && (!locationFormData.latitude || !locationFormData.longitude)) {
                            handleAddressGeocode(e.target.value)
                          }
                        }}
                        placeholder="住所を入力すると自動的に緯度経度が取得されます"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                      />
                      {geocodingLoading && (
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-gray-500">
                          取得中...
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        緯度
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={locationFormData.latitude}
                        onChange={(e) =>
                          setLocationFormData({ ...locationFormData, latitude: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        経度
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={locationFormData.longitude}
                        onChange={(e) =>
                          setLocationFormData({ ...locationFormData, longitude: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      許容範囲（メートル）
                    </label>
                    <input
                      type="number"
                      value={locationFormData.radius}
                      onChange={(e) =>
                        setLocationFormData({ ...locationFormData, radius: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    />
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
                        setShowLocationForm(false)
                        setLocationFormData({
                          name: '',
                          address: '',
                          latitude: '',
                          longitude: '',
                          radius: '500',
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

            {/* 勤務先一覧 */}
            {workLocationsLoading ? (
              <div className="p-8 text-center text-gray-900">読み込み中...</div>
            ) : (
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                        勤務先名
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                        住所
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                        緯度
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                        経度
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                        許容範囲
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
                    {workLocations.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-6 text-center text-gray-700">
                          勤務先が登録されていません
                        </td>
                      </tr>
                    ) : (
                      workLocations.map((location) => (
                        <tr key={location.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {editingWorkLocation?.id === location.id ? (
                              <input
                                type="text"
                                value={editingWorkLocation.name}
                                onChange={(e) =>
                                  setEditingWorkLocation({
                                    ...editingWorkLocation,
                                    name: e.target.value,
                                  })
                                }
                                className="w-full px-2 py-1 border border-gray-300 rounded text-gray-900 bg-white"
                              />
                            ) : (
                              location.name
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {editingWorkLocation?.id === location.id ? (
                              <div className="relative">
                                <input
                                  type="text"
                                  value={editingWorkLocation.address || ''}
                                  onChange={(e) =>
                                    setEditingWorkLocation({
                                      ...editingWorkLocation,
                                      address: e.target.value,
                                    })
                                  }
                                  onBlur={(e) => {
                                    if (
                                      e.target.value.trim() &&
                                      (editingWorkLocation.latitude === 0 ||
                                        editingWorkLocation.longitude === 0)
                                    ) {
                                      handleEditAddressGeocode(e.target.value)
                                    }
                                  }}
                                  placeholder="住所を入力すると自動的に緯度経度が取得されます"
                                  className="w-full px-2 py-1 border border-gray-300 rounded text-gray-900 bg-white"
                                />
                                {geocodingLoading && editingWorkLocation?.id === location.id && (
                                  <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-gray-500">
                                    取得中...
                                  </div>
                                )}
                              </div>
                            ) : (
                              location.address || '-'
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {editingWorkLocation?.id === location.id ? (
                              <input
                                type="number"
                                step="any"
                                value={editingWorkLocation.latitude}
                                onChange={(e) =>
                                  setEditingWorkLocation({
                                    ...editingWorkLocation,
                                    latitude: parseFloat(e.target.value) || 0,
                                  })
                                }
                                className="w-full px-2 py-1 border border-gray-300 rounded text-gray-900 bg-white"
                              />
                            ) : (
                              location.latitude
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {editingWorkLocation?.id === location.id ? (
                              <input
                                type="number"
                                step="any"
                                value={editingWorkLocation.longitude}
                                onChange={(e) =>
                                  setEditingWorkLocation({
                                    ...editingWorkLocation,
                                    longitude: parseFloat(e.target.value) || 0,
                                  })
                                }
                                className="w-full px-2 py-1 border border-gray-300 rounded text-gray-900 bg-white"
                              />
                            ) : (
                              location.longitude
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {editingWorkLocation?.id === location.id ? (
                              <input
                                type="number"
                                value={editingWorkLocation.radius}
                                onChange={(e) =>
                                  setEditingWorkLocation({
                                    ...editingWorkLocation,
                                    radius: parseInt(e.target.value) || 500,
                                  })
                                }
                                className="w-full px-2 py-1 border border-gray-300 rounded text-gray-900 bg-white"
                              />
                            ) : (
                              `${location.radius}m`
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {editingWorkLocation?.id === location.id ? (
                              <select
                                value={editingWorkLocation.isActive ? 'true' : 'false'}
                                onChange={(e) =>
                                  setEditingWorkLocation({
                                    ...editingWorkLocation,
                                    isActive: e.target.value === 'true',
                                  })
                                }
                                className="w-full px-2 py-1 border border-gray-300 rounded text-gray-900 bg-white"
                              >
                                <option value="true">有効</option>
                                <option value="false">無効</option>
                              </select>
                            ) : (
                              <span
                                className={`px-2 py-1 rounded text-xs font-medium ${
                                  location.isActive
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}
                              >
                                {location.isActive ? '有効' : '無効'}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {editingWorkLocation?.id === location.id ? (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleUpdateWorkLocation(editingWorkLocation)}
                                  className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
                                >
                                  保存
                                </button>
                                <button
                                  onClick={() => setEditingWorkLocation(null)}
                                  className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
                                >
                                  キャンセル
                                </button>
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setEditingWorkLocation(location)}
                                  className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                                >
                                  編集
                                </button>
                                <button
                                  onClick={() => handleDeleteWorkLocation(location.id)}
                                  className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                                >
                                  削除
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* 従業員管理タブのコンテンツ */}
        {activeTab === 'employees' && (
          <>

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
                    店舗
                  </label>
                  <select
                    value={formData.workLocation}
                    onChange={(e) =>
                      setFormData({ ...formData, workLocation: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  >
                    <option value="">選択してください</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.name}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    勤務先住所
                  </label>
                  <input
                    type="text"
                    value={formData.workLocationAddress}
                    onChange={(e) =>
                      setFormData({ ...formData, workLocationAddress: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    placeholder="店舗の住所を入力してください"
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    入社日
                  </label>
                  <input
                    type="date"
                    value={formData.hireDate}
                    onChange={(e) => {
                      const newHireDate = e.target.value
                      setFormData({ ...formData, hireDate: newHireDate })
                      // 入社日から勤続年数を自動計算
                      if (newHireDate) {
                        const hire = new Date(newHireDate)
                        const now = new Date()
                        const years = (now.getTime() - hire.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
                        setFormData(prev => ({ ...prev, yearsOfService: years.toFixed(2) }))
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    勤続年数
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.yearsOfService}
                    onChange={(e) => {
                      const years = e.target.value
                      setFormData({ ...formData, yearsOfService: years })
                      // 勤続年数から有給付与日を自動計算
                      if (formData.hireDate && years) {
                        const hire = new Date(formData.hireDate)
                        const grantDate = new Date(hire)
                        grantDate.setFullYear(grantDate.getFullYear() + Math.floor(parseFloat(years)))
                        grantDate.setMonth(grantDate.getMonth() + Math.floor((parseFloat(years) % 1) * 12))
                        setFormData(prev => ({ 
                          ...prev, 
                          paidLeaveGrantDate: grantDate.toISOString().split('T')[0] 
                        }))
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    placeholder="例: 2.5"
                  />
                  <p className="mt-1 text-xs text-gray-500">入社日から自動計算されます</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    有給付与日
                  </label>
                  <input
                    type="date"
                    value={formData.paidLeaveGrantDate}
                    onChange={(e) =>
                      setFormData({ ...formData, paidLeaveGrantDate: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                  <p className="mt-1 text-xs text-gray-500">勤続年数から自動計算されます</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    有給残数
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.paidLeaveBalance}
                    onChange={(e) =>
                      setFormData({ ...formData, paidLeaveBalance: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                  <p className="mt-1 text-xs text-gray-500">日数（取得から2年経過で自動消滅）</p>
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

        {/* フィルター */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                表示モード
              </label>
              <select
                value={displayMode}
                onChange={(e) => {
                  setDisplayMode(e.target.value as 'all' | 'department' | 'location')
                  setSelectedDepartment('')
                  setSelectedLocation('')
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
              >
                <option value="all">全体</option>
                <option value="department">事業部</option>
                <option value="location">店舗</option>
              </select>
            </div>
            {displayMode === 'department' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  事業部
                </label>
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                >
                  <option value="">選択してください</option>
                  {getDepartments().map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {displayMode === 'location' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  店舗
                </label>
                <select
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                >
                  <option value="">選択してください</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.name}>
                      {loc.name}
                    </option>
                  ))}
                </select>
                {selectedLocation && (
                  <p className="mt-1 text-xs text-gray-500">
                    住所:{' '}
                    {
                      locations.find((loc) => loc.name === selectedLocation)
                        ?.address || '住所情報が登録されていません'
                    }
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 従業員一覧 - カード形式 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          {getFilteredEmployees().length === 0 ? (
            <div className="p-6 text-center text-gray-700">
              {displayMode === 'all' 
                ? '従業員がありません'
                : displayMode === 'department' && selectedDepartment
                ? `${selectedDepartment}の従業員がありません`
                : displayMode === 'location' && selectedLocation
                ? `${selectedLocation}の従業員がありません`
                : 'フィルター条件を選択してください'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {getFilteredEmployees().map((employee) => (
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
                    {employee.workLocation && (
                      <div className="text-sm">
                        <span className="text-gray-600">店舗:</span>
                        <span className="text-gray-900 ml-2">{employee.workLocation}</span>
                      </div>
                    )}
                    {employee.workLocationAddress && (
                      <div className="text-sm">
                        <span className="text-gray-600">勤務先住所:</span>
                        <span className="text-gray-900 ml-2">{employee.workLocationAddress}</span>
                      </div>
                    )}
                    {employee.position && (
                      <div className="text-sm">
                        <span className="text-gray-600">役職:</span>
                        <span className="text-gray-900 ml-2">{employee.position}</span>
                      </div>
                    )}
                    {employee.yearsOfService !== null && (
                      <div className="text-sm">
                        <span className="text-gray-600">勤続年数:</span>
                        <span className="text-gray-900 ml-2">{employee.yearsOfService.toFixed(1)}年</span>
                      </div>
                    )}
                    <div className="text-sm">
                      <span className="text-gray-600">有給残数:</span>
                      <span className="text-gray-900 ml-2 font-semibold">{employee.paidLeaveBalance || 0}日</span>
                    </div>
                    {employee.paidLeaveGrantDate && (
                      <div className="text-sm">
                        <span className="text-gray-600">有給付与日:</span>
                        <span className="text-gray-900 ml-2">
                          {new Date(employee.paidLeaveGrantDate).toLocaleDateString('ja-JP')}
                        </span>
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
                        店舗
                      </label>
                      <select
                        value={selectedEmployee.workLocation || ''}
                        onChange={(e) =>
                          setSelectedEmployee({
                            ...selectedEmployee,
                            workLocation: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                      >
                        <option value="">選択してください</option>
                        {locations.map((loc) => (
                          <option key={loc.id} value={loc.name}>
                            {loc.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        勤務先住所
                      </label>
                      <input
                        type="text"
                        value={selectedEmployee.workLocationAddress || ''}
                        onChange={(e) =>
                          setSelectedEmployee({
                            ...selectedEmployee,
                            workLocationAddress: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                        placeholder="店舗の住所を入力してください"
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
                        onChange={(e) => {
                          const newHireDate = e.target.value || null
                          if (!selectedEmployee) return
                          setSelectedEmployee({
                            ...selectedEmployee,
                            hireDate: newHireDate,
                          })
                          // 入社日から勤続年数を自動計算
                          if (newHireDate) {
                            const hire = new Date(newHireDate)
                            const now = new Date()
                            const years = (now.getTime() - hire.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
                            setSelectedEmployee(prev => {
                              if (!prev) return prev
                              return {
                                ...prev,
                                yearsOfService: parseFloat(years.toFixed(2)),
                              }
                            })
                          }
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        勤続年数
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={selectedEmployee.yearsOfService || ''}
                        onChange={(e) => {
                          const years = e.target.value
                          if (!selectedEmployee) return
                          setSelectedEmployee({
                            ...selectedEmployee,
                            yearsOfService: years ? parseFloat(years) : null,
                          })
                          // 勤続年数から有給付与日を自動計算
                          if (selectedEmployee.hireDate && years) {
                            const hire = new Date(selectedEmployee.hireDate)
                            const grantDate = new Date(hire)
                            grantDate.setFullYear(grantDate.getFullYear() + Math.floor(parseFloat(years)))
                            grantDate.setMonth(grantDate.getMonth() + Math.floor((parseFloat(years) % 1) * 12))
                            setSelectedEmployee(prev => {
                              if (!prev) return prev
                              return {
                                ...prev,
                                paidLeaveGrantDate: grantDate.toISOString().split('T')[0],
                              }
                            })
                          }
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                        placeholder="例: 2.5"
                      />
                      <p className="mt-1 text-xs text-gray-500">入社日から自動計算されます</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        有給付与日
                      </label>
                      <input
                        type="date"
                        value={
                          selectedEmployee.paidLeaveGrantDate
                            ? new Date(selectedEmployee.paidLeaveGrantDate).toISOString().split('T')[0]
                            : ''
                        }
                        onChange={(e) =>
                          setSelectedEmployee({
                            ...selectedEmployee,
                            paidLeaveGrantDate: e.target.value || null,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                      />
                      <p className="mt-1 text-xs text-gray-500">勤続年数から自動計算されます</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        有給残数
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={selectedEmployee.paidLeaveBalance || 0}
                        onChange={(e) =>
                          setSelectedEmployee({
                            ...selectedEmployee,
                            paidLeaveBalance: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                      />
                      <p className="mt-1 text-xs text-gray-500">日数（取得から2年経過で自動消滅）</p>
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
          </>
        )}
      </div>
    </div>
  )
}
