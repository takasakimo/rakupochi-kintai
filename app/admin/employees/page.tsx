'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import QRCodeSVG from 'react-qr-code'

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
  billingClientId: number | null
  billingRate: number | null
  billingRateType: string | null
  overtimeRate: number | null
  hasOvertime: boolean | null
  baseWorkDays: number | null
  billingClient?: {
    id: number
    name: string
  } | null
}

interface Location {
  id: number
  name: string
  type?: string
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
  const [showImportModal, setShowImportModal] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importLoading, setImportLoading] = useState(false)
  const [importResult, setImportResult] = useState<any>(null)
  const [showQRCodeModal, setShowQRCodeModal] = useState(false)
  const [companyCode, setCompanyCode] = useState<string>('')
  
  // フィルター用の状態
  const [displayMode, setDisplayMode] = useState<'all' | 'department' | 'location'>('all')
  const [selectedDepartment, setSelectedDepartment] = useState<string>('')
  const [selectedLocation, setSelectedLocation] = useState<string>('')
  const [locations, setLocations] = useState<{ id: number; name: string; type?: string; address?: string | null }[]>([])
  const [departments, setDepartments] = useState<{ id: number; name: string; type?: string; address?: string | null }[]>([])
  const [locationEmployeeIds, setLocationEmployeeIds] = useState<Set<number>>(new Set())
  const [billingClients, setBillingClients] = useState<{ id: number; name: string }[]>([])
  const [enableInvoice, setEnableInvoice] = useState<boolean>(false)

  // 勤務先登録用の状態
  const [workLocations, setWorkLocations] = useState<Location[]>([])
  const [workLocationsLoading, setWorkLocationsLoading] = useState(false)
  const [showLocationForm, setShowLocationForm] = useState(false)
  const [editingWorkLocation, setEditingWorkLocation] = useState<Location | null>(null)
  const [locationFormData, setLocationFormData] = useState({
    storeName: '',
    departmentName: '',
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
    if (status === 'authenticated') {
      const isAdmin = session?.user.role === 'admin'
      const isSuperAdmin = session?.user.role === 'super_admin' || 
                          session?.user.email === 'superadmin@rakupochi.com'
      
      if (isAdmin || (isSuperAdmin && session?.user.selectedCompanyId)) {
        fetchEmployees()
        fetchLocations()
        fetchCompanyCode()
        fetchSettings()
        if (activeTab === 'locations') {
          fetchWorkLocations()
        }
      }
    }
  }, [status, session, activeTab])

  const fetchCompanyCode = async () => {
    try {
      const response = await fetch('/api/user/company')
      if (response.ok) {
        const data = await response.json()
        setCompanyCode(data.company?.code || '')
      }
    } catch (err) {
      console.error('Failed to fetch company code:', err)
    }
  }
  
  const fetchLocations = async () => {
    try {
      const response = await fetch('/api/admin/locations')
      if (response.ok) {
        const data = await response.json()
        const allLocations = data.locations || []
        // 店舗選択では type='store' のもののみを表示
        const storeLocations = allLocations.filter((loc: any) => loc.type === 'store')
        setLocations(storeLocations)
        // 部署選択では type='department' のもののみを表示
        const departmentLocations = allLocations.filter((loc: any) => loc.type === 'department')
        setDepartments(departmentLocations)
      }
    } catch (err) {
      console.error('Failed to fetch locations:', err)
    }
  }

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/admin/settings')
      if (response.ok) {
        const data = await response.json()
        const invoiceEnabled = data.settings?.enableInvoice ?? false
        setEnableInvoice(invoiceEnabled)
        // enableInvoiceがtrueの場合のみ請求先企業を取得
        if (invoiceEnabled) {
          fetchBillingClients()
        }
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err)
    }
  }

  const fetchBillingClients = async () => {
    try {
      const response = await fetch('/api/admin/billing-clients')
      if (response.ok) {
        const data = await response.json()
        setBillingClients(data.billingClients || [])
      }
    } catch (err) {
      console.error('Failed to fetch billing clients:', err)
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
    
    // 店舗名または部署名のどちらかが入力されているかチェック
    if (!locationFormData.storeName.trim() && !locationFormData.departmentName.trim()) {
      alert('店舗名または部署名のどちらかを入力してください')
      return
    }

    // 店舗名と部署名を結合してnameとして保存（両方入力されている場合は「店舗名 - 部署名」、片方だけの場合はその値）
    const name = locationFormData.storeName.trim() && locationFormData.departmentName.trim()
      ? `${locationFormData.storeName.trim()} - ${locationFormData.departmentName.trim()}`
      : locationFormData.storeName.trim() || locationFormData.departmentName.trim()
    
    // typeを決定: 店舗名のみまたは両方入力されている場合は'store'、部署名のみの場合は'department'
    const type = locationFormData.storeName.trim() ? 'store' : 'department'

    try {
      const response = await fetch('/api/admin/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name,
          type: type,
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
          storeName: '',
          departmentName: '',
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
      // typeを決定: nameに「 - 」が含まれていて、最初の部分（店舗名）が存在する場合は'store'、そうでない場合は'department'
      const parts = location.name.split(' - ')
      const hasStoreName = parts[0] && parts[0].trim() !== ''
      const type = hasStoreName ? 'store' : 'department'
      
      const response = await fetch(`/api/admin/locations/${location.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: location.name,
          type: type,
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
        
        // 請求情報の処理
        updateData.billingClientId = employee.billingClientId || null
        updateData.billingRate = employee.billingRate || null
        updateData.billingRateType = employee.billingRateType || 'daily'
        updateData.overtimeRate = employee.overtimeRate || null
        updateData.hasOvertime = employee.hasOvertime || false
        updateData.baseWorkDays = employee.baseWorkDays || null
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
            <div className="flex gap-2">
              <button
                onClick={() => {
                  window.location.href = '/api/admin/employees/export'
                }}
                className="px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 font-medium"
              >
                CSVエクスポート
              </button>
              <button
                onClick={() => {
                  setShowImportModal(true)
                  setImportResult(null)
                  setImportFile(null)
                }}
                className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 font-medium"
              >
                CSVインポート
              </button>
              <button
                onClick={() => {
                  setShowCreateForm(!showCreateForm)
                  setEditingEmployee(null)
                }}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 font-medium"
              >
                {showCreateForm ? 'キャンセル' : '+ 従業員登録'}
              </button>
              <button
                onClick={() => {
                  setShowQRCodeModal(true)
                }}
                className="px-4 py-2 bg-indigo-500 text-white rounded-md hover:bg-indigo-600 font-medium"
              >
                QRコード発行
              </button>
            </div>
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
              勤務先管理
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
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        店舗名
                      </label>
                      <input
                        type="text"
                        value={locationFormData.storeName}
                        onChange={(e) =>
                          setLocationFormData({ ...locationFormData, storeName: e.target.value })
                        }
                        placeholder="店舗名を入力"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        部署名
                      </label>
                      <input
                        type="text"
                        value={locationFormData.departmentName}
                        onChange={(e) =>
                          setLocationFormData({ ...locationFormData, departmentName: e.target.value })
                        }
                        placeholder="部署名を入力"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">※ 店舗名または部署名のどちらかを入力してください</p>
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
                          storeName: '',
                          departmentName: '',
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
                              <div className="grid grid-cols-2 gap-2">
                                <input
                                  type="text"
                                  value={(() => {
                                    // 既存のnameを「 - 」で分割して店舗名を取得
                                    const parts = editingWorkLocation.name.split(' - ')
                                    return parts[0] || ''
                                  })()}
                                  onChange={(e) => {
                                    const storeName = e.target.value
                                    const parts = editingWorkLocation.name.split(' - ')
                                    const departmentName = parts[1] || ''
                                    setEditingWorkLocation({
                                      ...editingWorkLocation,
                                      name: departmentName 
                                        ? `${storeName} - ${departmentName}` 
                                        : storeName,
                                    })
                                  }}
                                  placeholder="店舗名"
                                  className="w-full px-2 py-1 border border-gray-300 rounded text-gray-900 bg-white"
                                />
                                <input
                                  type="text"
                                  value={(() => {
                                    // 既存のnameを「 - 」で分割して部署名を取得
                                    const parts = editingWorkLocation.name.split(' - ')
                                    return parts[1] || ''
                                  })()}
                                  onChange={(e) => {
                                    const departmentName = e.target.value
                                    const parts = editingWorkLocation.name.split(' - ')
                                    const storeName = parts[0] || ''
                                    setEditingWorkLocation({
                                      ...editingWorkLocation,
                                      name: storeName && departmentName
                                        ? `${storeName} - ${departmentName}`
                                        : storeName || departmentName,
                                    })
                                  }}
                                  placeholder="部署名"
                                  className="w-full px-2 py-1 border border-gray-300 rounded text-gray-900 bg-white"
                                />
                              </div>
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
                  <select
                    value={formData.department}
                    onChange={(e) => {
                      const newDepartment = e.target.value || ''
                      const selectedDept = newDepartment ? departments.find((dept) => dept.name === newDepartment) : null
                      // 店舗が選択されている場合は店舗の住所を優先、そうでない場合は部署の住所を使用
                      const selectedStore = locations.find((loc) => loc.name === formData.workLocation)
                      const storeAddress = selectedStore?.address || ''
                      const deptAddress = selectedDept?.address || ''
                      // 部署を「なし」に選択した場合、店舗が選択されていない場合は住所もクリア
                      const newAddress = newDepartment 
                        ? (storeAddress || deptAddress || '')
                        : (storeAddress || '')
                      setFormData({ 
                        ...formData, 
                        department: newDepartment,
                        workLocationAddress: newAddress
                      })
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  >
                    <option value="">選択してください</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.name}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    店舗
                  </label>
                  <select
                    value={formData.workLocation}
                    onChange={(e) => {
                      const newWorkLocation = e.target.value || ''
                      const selectedLoc = newWorkLocation ? locations.find((loc) => loc.name === newWorkLocation) : null
                      const storeAddress = selectedLoc?.address || ''
                      // 店舗を「なし」に選択した場合、部署が選択されている場合は部署の住所を使用
                      const selectedDept = departments.find((dept) => dept.name === formData.department)
                      const deptAddress = selectedDept?.address || ''
                      // 店舗を選択した場合は店舗の住所を優先、店舗を「なし」にした場合は部署の住所を使用
                      const newAddress = newWorkLocation 
                        ? storeAddress 
                        : (deptAddress || '')
                      setFormData({ 
                        ...formData, 
                        workLocation: newWorkLocation,
                        workLocationAddress: newAddress
                      })
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  >
                    <option value="">選択してください</option>
                    {locations.filter((loc) => loc.type === 'store').map((loc) => (
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
                  {locations.filter((loc) => loc.type === 'store').map((loc) => (
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
                    {enableInvoice && employee.billingClient && (
                      <div className="text-sm">
                        <span className="text-gray-600">請求先企業:</span>
                        <span className="text-gray-900 ml-2 font-semibold">{employee.billingClient.name}</span>
                      </div>
                    )}
                    {enableInvoice && employee.billingRate && (
                      <div className="text-sm">
                        <span className="text-gray-600">請求単価:</span>
                        <span className="text-gray-900 ml-2">
                          {employee.billingRate.toLocaleString()}円
                          {employee.billingRateType === 'hourly' && '（時間）'}
                          {employee.billingRateType === 'daily' && '（日額）'}
                          {employee.billingRateType === 'monthly' && '（月額）'}
                        </span>
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
                      <select
                        value={selectedEmployee.department || ''}
                        onChange={(e) => {
                          const newDepartment = e.target.value || ''
                          const selectedDept = newDepartment ? departments.find((dept) => dept.name === newDepartment) : null
                          // 店舗が選択されている場合は店舗の住所を優先、そうでない場合は部署の住所を使用
                          const selectedStore = locations.find((loc) => loc.name === selectedEmployee.workLocation)
                          const storeAddress = selectedStore?.address || ''
                          const deptAddress = selectedDept?.address || ''
                          // 部署を「なし」に選択した場合、店舗が選択されていない場合は住所もクリア
                          const newAddress = newDepartment 
                            ? (storeAddress || deptAddress || '')
                            : (storeAddress || '')
                          setSelectedEmployee({
                            ...selectedEmployee,
                            department: newDepartment,
                            workLocationAddress: newAddress
                          })
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                      >
                        <option value="">選択してください</option>
                        {departments.map((dept) => (
                          <option key={dept.id} value={dept.name}>
                            {dept.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        店舗
                      </label>
                      <select
                        value={selectedEmployee.workLocation || ''}
                        onChange={(e) => {
                          const newWorkLocation = e.target.value || ''
                          const selectedLoc = newWorkLocation ? locations.find((loc) => loc.name === newWorkLocation) : null
                          const storeAddress = selectedLoc?.address || ''
                          // 店舗を「なし」に選択した場合、部署が選択されている場合は部署の住所を使用
                          const selectedDept = departments.find((dept) => dept.name === selectedEmployee.department)
                          const deptAddress = selectedDept?.address || ''
                          // 店舗を選択した場合は店舗の住所を優先、店舗を「なし」にした場合は部署の住所を使用
                          const newAddress = newWorkLocation 
                            ? storeAddress 
                            : (deptAddress || '')
                          setSelectedEmployee({
                            ...selectedEmployee,
                            workLocation: newWorkLocation,
                            workLocationAddress: newAddress
                          })
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                      >
                        <option value="">選択してください</option>
                        {locations.filter((loc) => loc.type === 'store').map((loc) => (
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

                  {/* 請求情報セクション */}
                  {enableInvoice && (
                  <div className="border-t pt-4">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">
                      請求情報 <span className="text-gray-500 text-xs font-normal">(任意)</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          請求先企業
                        </label>
                        <select
                          value={selectedEmployee.billingClientId?.toString() || ''}
                          onChange={(e) =>
                            setSelectedEmployee({
                              ...selectedEmployee,
                              billingClientId: e.target.value ? parseInt(e.target.value) : null,
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                        >
                          <option value="">選択してください</option>
                          {billingClients.map((client) => (
                            <option key={client.id} value={client.id}>
                              {client.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          請求単価タイプ
                        </label>
                        <select
                          value={selectedEmployee.billingRateType || 'daily'}
                          onChange={(e) =>
                            setSelectedEmployee({
                              ...selectedEmployee,
                              billingRateType: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                        >
                          <option value="hourly">時間</option>
                          <option value="daily">日額</option>
                          <option value="monthly">月額</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          請求単価（円）
                        </label>
                        <input
                          type="number"
                          value={selectedEmployee.billingRate?.toString() || ''}
                          onChange={(e) =>
                            setSelectedEmployee({
                              ...selectedEmployee,
                              billingRate: e.target.value ? parseInt(e.target.value) : null,
                            })
                          }
                          placeholder={
                            selectedEmployee.billingRateType === 'hourly' 
                              ? '例: 1500（時間）'
                              : selectedEmployee.billingRateType === 'daily'
                              ? '例: 12000（日額）'
                              : '例: 300000（月額）'
                          }
                          min="0"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          {selectedEmployee.billingRateType === 'hourly' 
                            ? '1時間あたりの単価'
                            : selectedEmployee.billingRateType === 'daily'
                            ? '1日あたりの単価'
                            : '1ヶ月あたりの単価'}
                        </p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          残業の有無
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedEmployee.hasOvertime || false}
                            onChange={(e) =>
                              setSelectedEmployee({
                                ...selectedEmployee,
                                hasOvertime: e.target.checked,
                              })
                            }
                            className="w-4 h-4"
                          />
                          <span className="text-sm text-gray-700">
                            残業時間を請求に含める
                          </span>
                        </label>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          残業単価倍率
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={selectedEmployee.overtimeRate?.toString() || '1.25'}
                          onChange={(e) =>
                            setSelectedEmployee({
                              ...selectedEmployee,
                              overtimeRate: e.target.value ? parseFloat(e.target.value) : 1.25,
                            })
                          }
                          placeholder="例: 1.25"
                          min="1"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                        />
                        <p className="mt-1 text-xs text-gray-500">基本単価に対する倍率（デフォルト: 1.25）</p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          稼働日数のベース（月間）
                        </label>
                        <input
                          type="number"
                          value={selectedEmployee.baseWorkDays?.toString() || '22'}
                          onChange={(e) =>
                            setSelectedEmployee({
                              ...selectedEmployee,
                              baseWorkDays: e.target.value ? parseInt(e.target.value) : 22,
                            })
                          }
                          placeholder="例: 22"
                          min="1"
                          max="31"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                        />
                        <p className="mt-1 text-xs text-gray-500">月間の標準稼働日数（デフォルト: 22日）</p>
                      </div>
                    </div>
                  </div>
                  )}

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

        {/* CSVインポートモーダル */}
        {showImportModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold mb-4 text-gray-900">CSVインポート</h2>
              
              {!importResult ? (
                <>
                  <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-2">
                      CSVファイルを選択して、従業員を一括登録できます。
                    </p>
                    <div className="mb-3">
                      <p className="text-xs font-semibold text-gray-700 mb-2">テンプレート（空のフォーマット）:</p>
                      <div className="flex flex-wrap gap-2">
                        <a
                          href="/api/admin/employees/template?format=rakupochi"
                          download
                          className="px-3 py-1 bg-gray-200 text-gray-900 rounded text-sm hover:bg-gray-300"
                        >
                          らくポチ形式テンプレート
                        </a>
                        <a
                          href="/api/admin/employees/template?format=general"
                          download
                          className="px-3 py-1 bg-gray-200 text-gray-900 rounded text-sm hover:bg-gray-300"
                        >
                          一般的な形式テンプレート
                        </a>
                        <a
                          href="/api/admin/employees/template?format=simple"
                          download
                          className="px-3 py-1 bg-gray-200 text-gray-900 rounded text-sm hover:bg-gray-300"
                        >
                          シンプル形式テンプレート
                        </a>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-700 mb-2">サンプルデータ（テスト用）:</p>
                      <div className="flex flex-wrap gap-2">
                        <a
                          href="/samples/sample_employees_rakupochi.csv"
                          download
                          className="px-3 py-1 bg-blue-200 text-blue-900 rounded text-sm hover:bg-blue-300"
                        >
                          らくポチ形式サンプル
                        </a>
                        <a
                          href="/samples/sample_employees_general.csv"
                          download
                          className="px-3 py-1 bg-blue-200 text-blue-900 rounded text-sm hover:bg-blue-300"
                        >
                          一般的な形式サンプル
                        </a>
                        <a
                          href="/samples/sample_employees_simple.csv"
                          download
                          className="px-3 py-1 bg-blue-200 text-blue-900 rounded text-sm hover:bg-blue-300"
                        >
                          シンプル形式サンプル
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      CSVファイルを選択
                    </label>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          setImportFile(file)
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      ファイルサイズ: 10MB以下、行数: 1000行以下
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        if (!importFile) {
                          alert('CSVファイルを選択してください')
                          return
                        }

                        setImportLoading(true)
                        try {
                          const formData = new FormData()
                          formData.append('file', importFile)

                          const response = await fetch('/api/admin/employees/import', {
                            method: 'POST',
                            body: formData,
                          })

                          const data = await response.json()
                          setImportResult(data)
                          
                          if (data.success && data.errorCount === 0) {
                            fetchEmployees()
                          }
                        } catch (error) {
                          console.error('Import error:', error)
                          alert('インポート処理中にエラーが発生しました')
                        } finally {
                          setImportLoading(false)
                        }
                      }}
                      disabled={!importFile || importLoading}
                      className="flex-1 px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {importLoading ? 'インポート中...' : 'インポート実行'}
                    </button>
                    <button
                      onClick={() => {
                        setShowImportModal(false)
                        setImportFile(null)
                        setImportResult(null)
                      }}
                      className="px-4 py-2 bg-gray-200 text-gray-900 rounded-md hover:bg-gray-300 font-medium"
                    >
                      キャンセル
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-4">
                    <div className={`p-4 rounded-md ${importResult.success && importResult.errorCount === 0 ? 'bg-green-50' : 'bg-yellow-50'}`}>
                      <h3 className="font-semibold mb-2 text-gray-900">
                        {importResult.success && importResult.errorCount === 0
                          ? 'インポート完了'
                          : 'インポート結果'}
                      </h3>
                      <div className="text-sm text-gray-700 space-y-1">
                        <p>総件数: {importResult.total}件</p>
                        <p className="text-green-600">成功: {importResult.successCount}件</p>
                        {importResult.errorCount > 0 && (
                          <p className="text-red-600">失敗: {importResult.errorCount}件</p>
                        )}
                        {importResult.format && (
                          <p>検出フォーマット: {importResult.format}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {importResult.errors && importResult.errors.length > 0 && (
                    <div className="mb-4">
                      <h3 className="font-semibold mb-2 text-gray-900">エラー詳細</h3>
                      <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-md">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="px-2 py-1 text-left text-gray-900">行</th>
                              <th className="px-2 py-1 text-left text-gray-900">社員番号</th>
                              <th className="px-2 py-1 text-left text-gray-900">氏名</th>
                              <th className="px-2 py-1 text-left text-gray-900">エラー</th>
                            </tr>
                          </thead>
                          <tbody>
                            {importResult.errors.map((error: any, index: number) => (
                              <tr key={index} className="border-t">
                                <td className="px-2 py-1 text-gray-900">{error.row}</td>
                                <td className="px-2 py-1 text-gray-900">{error.employeeNumber}</td>
                                <td className="px-2 py-1 text-gray-900">{error.name}</td>
                                <td className="px-2 py-1 text-red-600">{error.error}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {importResult.successEmployees && importResult.successEmployees.length > 0 && (
                    <div className="mb-4">
                      <h3 className="font-semibold mb-2 text-gray-900">登録成功した従業員</h3>
                      <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-md">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="px-2 py-1 text-left text-gray-900">社員番号</th>
                              <th className="px-2 py-1 text-left text-gray-900">氏名</th>
                            </tr>
                          </thead>
                          <tbody>
                            {importResult.successEmployees.map((emp: any, index: number) => (
                              <tr key={index} className="border-t">
                                <td className="px-2 py-1 text-gray-900">{emp.employeeNumber}</td>
                                <td className="px-2 py-1 text-gray-900">{emp.name}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setShowImportModal(false)
                        setImportFile(null)
                        setImportResult(null)
                        if (importResult.success && importResult.successCount > 0) {
                          fetchEmployees()
                        }
                      }}
                      className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 font-medium"
                    >
                      閉じる
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* QRコード発行モーダル */}
        {showQRCodeModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
              <h2 className="text-xl font-bold mb-4 text-gray-900">従業員登録用QRコード</h2>
              
              {companyCode ? (
                <>
                  <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-4">
                      このQRコードを従業員に提示してください。従業員はQRコードをスキャンして、登録申請フォームにアクセスできます。
                    </p>
                    <div className="flex justify-center mb-4 p-4 bg-gray-50 rounded-lg">
                      <QRCodeSVG
                        value={`${typeof window !== 'undefined' ? window.location.origin : ''}/register-application?company=${companyCode}`}
                        size={256}
                        level="H"
                      />
                    </div>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        登録URL
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={`${typeof window !== 'undefined' ? window.location.origin : ''}/register-application?company=${companyCode}`}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900 text-sm"
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-4">
                  <p className="text-gray-600">企業コードを読み込み中...</p>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={() => setShowQRCodeModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-900 rounded-md hover:bg-gray-300 font-medium"
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
