'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface Property {
  id: number
  name: string
  address: string
  latitude: number
  longitude: number
  lockInfo: string
  hasManager: boolean
  parkingInfo: string
  keyAccessInfo: string | null
  contactInfo: string | null
  workRangeNotes: string | null
  buildingAccessInfo: string | null
  lastVisitedAt: string | null
}

interface EmployeeBasic {
  id: number
  name: string
  isActive?: boolean
}

interface AssignmentItem {
  employeeId: number
  employeeName: string
  propertyId: number
  propertyName: string
  sortOrder: number
}

const DEFAULT_CENTER = { lat: 35.6812, lng: 139.7671 } // 東京

export default function AdminCleaningCheckPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'properties' | 'assignment' | 'myCheckin' | 'progress'>('properties')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingProperty, setEditingProperty] = useState<Property | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    latitude: '',
    longitude: '',
    lockInfo: '',
    hasManager: false,
    parkingInfo: '',
    keyAccessInfo: '',
    contactInfo: '',
    workRangeNotes: '',
    buildingAccessInfo: '',
  })
  const [geocodingLoading, setGeocodingLoading] = useState(false)
  const [mapModalOpen, setMapModalOpen] = useState(false)
  const [mapLatLng, setMapLatLng] = useState<{ lat: number; lng: number } | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markerInstanceRef = useRef<any>(null)

  // アサインメント用
  const [employees, setEmployees] = useState<EmployeeBasic[]>([])
  const [assignmentDate, setAssignmentDate] = useState(() => {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  })
  const [assignmentItems, setAssignmentItems] = useState<AssignmentItem[]>([])
  const [assignmentLoading, setAssignmentLoading] = useState(false)
  const [addEmployeeId, setAddEmployeeId] = useState<number | ''>('')
  const [addPropertyId, setAddPropertyId] = useState<number | ''>('')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }
    if (status === 'authenticated') {
      const isAdmin = session?.user?.role === 'admin'
      const isSuperAdmin = session?.user?.role === 'super_admin' || session?.user?.email === 'superadmin@rakupochi.com'
      if (isAdmin || (isSuperAdmin && session?.user?.selectedCompanyId)) {
        fetchProperties()
      } else {
        setLoading(false)
      }
    }
  }, [status, session, router])

  const fetchProperties = async () => {
    try {
      const response = await fetch('/api/admin/properties')
      const data = await response.json()
      setProperties(data.properties || [])
    } catch (err) {
      console.error('Failed to fetch properties:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchEmployees = async () => {
    try {
      const res = await fetch('/api/admin/employees')
      const data = await res.json()
      const list = (data.employees || data).filter((e: EmployeeBasic) => e.isActive !== false)
      setEmployees(list)
    } catch (err) {
      console.error('Failed to fetch employees:', err)
    }
  }

  const fetchAssignments = async () => {
    if (!assignmentDate) return
    setAssignmentLoading(true)
    try {
      const res = await fetch(`/api/admin/cleaning-assignments?date=${assignmentDate}`)
      const data = await res.json()
      const list: AssignmentItem[] = (data.assignments || []).map((a: any) => ({
        employeeId: a.employeeId,
        employeeName: a.employee?.name ?? '',
        propertyId: a.propertyId,
        propertyName: a.property?.name ?? '',
        sortOrder: a.sortOrder,
      }))
      setAssignmentItems(list)
    } catch (err) {
      console.error('Failed to fetch assignments:', err)
    } finally {
      setAssignmentLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'assignment') {
      fetchEmployees()
      fetchAssignments()
    }
  }, [activeTab, assignmentDate])

  const handleAddAssignment = () => {
    const eId = typeof addEmployeeId === 'number' ? addEmployeeId : null
    const pId = typeof addPropertyId === 'number' ? addPropertyId : null
    if (eId == null || pId == null) return
    const emp = employees.find(e => e.id === eId)
    const prop = properties.find(p => p.id === pId)
    if (!emp || !prop) return
    const existingForEmployee = assignmentItems.filter(a => a.employeeId === eId)
    const nextOrder = existingForEmployee.length ? Math.max(...existingForEmployee.map(a => a.sortOrder)) + 1 : 1
    setAssignmentItems(prev => [...prev, {
      employeeId: eId,
      employeeName: emp.name,
      propertyId: pId,
      propertyName: prop.name,
      sortOrder: nextOrder,
    }])
    setAddEmployeeId('')
    setAddPropertyId('')
  }

  const handleRemoveAssignment = (employeeId: number, propertyId: number) => {
    setAssignmentItems(prev => {
      const filtered = prev.filter(a => !(a.employeeId === employeeId && a.propertyId === propertyId))
      return filtered.map((a, idx) => {
        const sameEmployee = filtered.filter(x => x.employeeId === a.employeeId).sort((x, y) => x.sortOrder - y.sortOrder)
        const pos = sameEmployee.findIndex(x => x.propertyId === a.propertyId)
        return { ...a, sortOrder: pos + 1 }
      })
    })
  }

  const handleSaveAssignments = async () => {
    if (!assignmentDate) return
    setAssignmentLoading(true)
    try {
      const payload = {
        date: assignmentDate,
        assignments: assignmentItems.map(a => ({
          employeeId: a.employeeId,
          propertyId: a.propertyId,
          sortOrder: a.sortOrder,
        })),
      }
      const res = await fetch('/api/admin/cleaning-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.success) {
        alert('アサインメントを保存しました')
        fetchAssignments()
      } else {
        alert(data.error || '保存に失敗しました')
      }
    } catch (err) {
      console.error('Failed to save:', err)
      alert('保存に失敗しました')
    } finally {
      setAssignmentLoading(false)
    }
  }

  const handleAddressGeocode = async () => {
    const addr = formData.address.trim() || (editingProperty?.address ?? '').trim()
    if (!addr) return
    setGeocodingLoading(true)
    try {
      const response = await fetch('/api/admin/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: addr }),
      })
      const data = await response.json()
      if (data.success && data.latitude != null && data.longitude != null) {
        setFormData(f => ({ ...f, latitude: String(data.latitude), longitude: String(data.longitude) }))
        if (editingProperty) {
          setEditingProperty(p => p ? { ...p, latitude: data.latitude, longitude: data.longitude } : null)
        }
      }
    } catch (err) {
      console.error('Failed to geocode:', err)
    } finally {
      setGeocodingLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const lat = parseFloat(formData.latitude)
    const lng = parseFloat(formData.longitude)
    if (isNaN(lat) || isNaN(lng)) {
      alert('緯度・経度を入力するか、住所から取得してください')
      return
    }
    try {
      const response = await fetch('/api/admin/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          address: formData.address,
          latitude: lat,
          longitude: lng,
          lockInfo: formData.lockInfo || '（未設定）',
          hasManager: formData.hasManager,
          parkingInfo: formData.parkingInfo || '（未設定）',
          keyAccessInfo: formData.keyAccessInfo || null,
          contactInfo: formData.contactInfo || null,
          workRangeNotes: formData.workRangeNotes || null,
          buildingAccessInfo: formData.buildingAccessInfo || null,
        }),
      })
      const data = await response.json()
      if (data.success) {
        setShowCreateForm(false)
        setFormData({
          name: '',
          address: '',
          latitude: '',
          longitude: '',
          lockInfo: '',
          hasManager: false,
          parkingInfo: '',
          keyAccessInfo: '',
          contactInfo: '',
          workRangeNotes: '',
          buildingAccessInfo: '',
        })
        fetchProperties()
        alert('物件を登録しました')
      } else {
        alert(data.error || '物件の登録に失敗しました')
      }
    } catch (err) {
      console.error('Failed to create property:', err)
      alert('物件の登録に失敗しました')
    }
  }

  const handleUpdate = async () => {
    if (!editingProperty) return
    const lat = editingProperty.latitude
    const lng = editingProperty.longitude
    try {
      const response = await fetch(`/api/admin/properties/${editingProperty.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingProperty.name,
          address: editingProperty.address,
          latitude: lat,
          longitude: lng,
          lockInfo: editingProperty.lockInfo,
          hasManager: editingProperty.hasManager,
          parkingInfo: editingProperty.parkingInfo,
          keyAccessInfo: editingProperty.keyAccessInfo || null,
          contactInfo: editingProperty.contactInfo || null,
          workRangeNotes: editingProperty.workRangeNotes || null,
          buildingAccessInfo: editingProperty.buildingAccessInfo || null,
        }),
      })
      const data = await response.json()
      if (data.success) {
        setEditingProperty(null)
        fetchProperties()
        alert('物件を更新しました')
      } else {
        alert(data.error || '物件の更新に失敗しました')
      }
    } catch (err) {
      console.error('Failed to update property:', err)
      alert('物件の更新に失敗しました')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('この物件を削除しますか？関連するアサインメントや作業記録も削除されます。')) return
    try {
      const response = await fetch(`/api/admin/properties/${id}`, { method: 'DELETE' })
      const data = await response.json()
      if (data.success) {
        fetchProperties()
        setEditingProperty(null)
        alert('物件を削除しました')
      } else {
        alert(data.error || '物件の削除に失敗しました')
      }
    } catch (err) {
      console.error('Failed to delete property:', err)
      alert('物件の削除に失敗しました')
    }
  }

  // Leaflet マップ（ピン差し用）
  useEffect(() => {
    if (!mapModalOpen) return
    const coords = mapLatLng || { lat: DEFAULT_CENTER.lat, lng: DEFAULT_CENTER.lng }
    let mounted = true
    const loadLeaflet = (): Promise<void> => {
      return new Promise((resolve, reject) => {
        if ((window as any).L) {
          resolve()
          return
        }
        const existingCss = document.querySelector('link[href*="leaflet.css"]')
        if (!existingCss) {
          const link = document.createElement('link')
          link.rel = 'stylesheet'
          link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
          document.head.appendChild(link)
        }
        const existingScript = document.querySelector('script[src*="leaflet.js"]')
        if (existingScript) {
          const check = setInterval(() => {
            if ((window as any).L) {
              clearInterval(check)
              resolve()
            }
          }, 100)
          setTimeout(() => clearInterval(check), 5000)
          return
        }
        const script = document.createElement('script')
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
        script.async = true
        script.onload = () => ((window as any).L ? resolve() : reject(new Error('L not found')))
        script.onerror = () => reject(new Error('Load failed'))
        document.head.appendChild(script)
      })
    }

    const initMap = async () => {
      try {
        await loadLeaflet()
        if (!mounted || !mapContainerRef.current) return
        const L = (window as any).L
        if (!L) return

        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove()
          mapInstanceRef.current = null
        }
        if (markerInstanceRef.current) markerInstanceRef.current = null

        delete (L.Icon.Default.prototype as any)._getIconUrl
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        })

        const map = L.map(mapContainerRef.current).setView([coords.lat, coords.lng], 15)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map)

        const marker = L.marker([coords.lat, coords.lng], { draggable: true })
          .addTo(map)
          .on('dragend', () => {
            const pos = marker.getLatLng()
            setMapLatLng({ lat: pos.lat, lng: pos.lng })
          })

        map.on('click', (e: any) => {
          const { lat, lng } = e.latlng
          marker.setLatLng([lat, lng])
          setMapLatLng({ lat, lng })
        })

        mapInstanceRef.current = map
        markerInstanceRef.current = marker
      } catch (err) {
        console.error('Map init error:', err)
      }
    }

    const t = setTimeout(initMap, 300)
    return () => {
      mounted = false
      clearTimeout(t)
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
      markerInstanceRef.current = null
    }
  }, [mapModalOpen])

  const handleMapConfirm = () => {
    if (mapLatLng) {
      if (editingProperty) {
        setEditingProperty(p => p ? { ...p, latitude: mapLatLng.lat, longitude: mapLatLng.lng } : null)
      } else {
        setFormData(f => ({
          ...f,
          latitude: String(mapLatLng.lat),
          longitude: String(mapLatLng.lng),
        }))
      }
    }
    setMapModalOpen(false)
    setMapLatLng(null)
  }

  if (status === 'loading' || loading) {
    return <div className="p-8 text-center text-gray-900">読み込み中...</div>
  }

  return (
    <div className="p-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-gray-900">管理物件掃除・チェックイン/チェックアウト</h1>

        {/* タブ */}
        <div className="mb-6">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('properties')}
              className={`px-6 py-3 font-medium text-sm ${
                activeTab === 'properties' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              物件マスタ
            </button>
            <button
              onClick={() => setActiveTab('assignment')}
              className={`px-6 py-3 font-medium text-sm ${
                activeTab === 'assignment' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              アサインメント
            </button>
            <button
              onClick={() => setActiveTab('myCheckin')}
              className={`px-6 py-3 font-medium text-sm ${
                activeTab === 'myCheckin' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              自分のチェックイン/チェックアウト
            </button>
            <button
              onClick={() => setActiveTab('progress')}
              className={`px-6 py-3 font-medium text-sm ${
                activeTab === 'progress' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              進捗一覧（準備中）
            </button>
          </div>
        </div>

        {activeTab === 'properties' && (
          <>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">物件一覧</h2>
              <button
                onClick={() => {
                  setShowCreateForm(true)
                  setEditingProperty(null)
                  setFormData({
                    name: '',
                    address: '',
                    latitude: '',
                    longitude: '',
                    lockInfo: '',
                    hasManager: false,
                    parkingInfo: '',
                    keyAccessInfo: '',
                    contactInfo: '',
                    workRangeNotes: '',
                    buildingAccessInfo: '',
                  })
                }}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 font-medium"
              >
                + 物件登録
              </button>
            </div>

            {/* 新規登録フォーム */}
            {showCreateForm && (
              <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <h3 className="text-lg font-semibold mb-4 text-gray-900">新規物件登録</h3>
                <form onSubmit={handleCreate} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">物件名 <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">住所 <span className="text-red-500">*</span></label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={formData.address}
                        onChange={e => setFormData({ ...formData, address: e.target.value })}
                        placeholder="住所を入力"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                      />
                      <button
                        type="button"
                        onClick={handleAddressGeocode}
                        disabled={geocodingLoading || !formData.address.trim()}
                        className="px-4 py-2 bg-gray-200 text-gray-900 rounded-md hover:bg-gray-300 disabled:opacity-50"
                      >
                        {geocodingLoading ? '取得中...' : '緯度経度取得'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const lat = parseFloat(formData.latitude) || DEFAULT_CENTER.lat
                          const lng = parseFloat(formData.longitude) || DEFAULT_CENTER.lng
                          setMapLatLng({ lat, lng })
                          setMapModalOpen(true)
                        }}
                        className="px-4 py-2 bg-green-100 text-green-800 rounded-md hover:bg-green-200"
                      >
                        地図でピン差し
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">緯度 <span className="text-red-500">*</span></label>
                      <input
                        type="number"
                        step="any"
                        value={formData.latitude}
                        onChange={e => setFormData({ ...formData, latitude: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">経度 <span className="text-red-500">*</span></label>
                      <input
                        type="number"
                        step="any"
                        value={formData.longitude}
                        onChange={e => setFormData({ ...formData, longitude: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">施錠情報 <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={formData.lockInfo}
                      onChange={e => setFormData({ ...formData, lockInfo: e.target.value })}
                      placeholder="オートロック解除キー等"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={formData.hasManager} onChange={e => setFormData({ ...formData, hasManager: e.target.checked })} className="w-4 h-4" />
                      <span className="text-sm font-medium text-gray-700">管理人有り（報告が必要）</span>
                    </label>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">駐車情報 <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={formData.parkingInfo}
                      onChange={e => setFormData({ ...formData, parkingInfo: e.target.value })}
                      placeholder="駐車可能/コインパーキング情報"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">鍵・アクセス方法（任意）</label>
                    <input
                      type="text"
                      value={formData.keyAccessInfo}
                      onChange={e => setFormData({ ...formData, keyAccessInfo: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">連絡先（任意）</label>
                    <input
                      type="text"
                      value={formData.contactInfo}
                      onChange={e => setFormData({ ...formData, contactInfo: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">作業範囲・注意事項（任意）</label>
                    <textarea
                      value={formData.workRangeNotes}
                      onChange={e => setFormData({ ...formData, workRangeNotes: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">建物の入り方（任意）</label>
                    <input
                      type="text"
                      value={formData.buildingAccessInfo}
                      onChange={e => setFormData({ ...formData, buildingAccessInfo: e.target.value })}
                      placeholder="インターホン番号など"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 font-medium">
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

            {/* 物件一覧 */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">物件名</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">住所</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">施錠</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">管理人</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {properties.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-gray-700">
                        物件が登録されていません
                      </td>
                    </tr>
                  ) : (
                    properties.map(p => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {editingProperty?.id === p.id ? (
                            <input
                              type="text"
                              value={editingProperty.name}
                              onChange={e => setEditingProperty({ ...editingProperty, name: e.target.value })}
                              className="w-full px-2 py-1 border rounded text-gray-900 bg-white"
                            />
                          ) : (
                            p.name
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {editingProperty?.id === p.id ? (
                            <input
                              type="text"
                              value={editingProperty.address}
                              onChange={e => setEditingProperty({ ...editingProperty, address: e.target.value })}
                              className="w-full px-2 py-1 border rounded text-gray-900 bg-white"
                            />
                          ) : (
                            p.address
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {editingProperty?.id === p.id ? (
                            <input
                              type="text"
                              value={editingProperty.lockInfo}
                              onChange={e => setEditingProperty({ ...editingProperty, lockInfo: e.target.value })}
                              className="w-full px-2 py-1 border rounded text-gray-900 bg-white"
                            />
                          ) : (
                            p.lockInfo
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{p.hasManager ? '有' : '無'}</td>
                        <td className="px-4 py-3">
                          {editingProperty?.id === p.id ? (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setMapLatLng({ lat: editingProperty.latitude, lng: editingProperty.longitude })
                                  setMapModalOpen(true)
                                }}
                                className="px-2 py-1 text-sm bg-green-100 text-green-800 rounded hover:bg-green-200"
                              >
                                地図でピン調整
                              </button>
                              <button onClick={handleUpdate} className="px-2 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600">
                                保存
                              </button>
                              <button onClick={() => setEditingProperty(null)} className="px-2 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300">
                                キャンセル
                              </button>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <button
                                onClick={() =>
                                  setEditingProperty({
                                    ...p,
                                    lockInfo: p.lockInfo || '',
                                    parkingInfo: p.parkingInfo || '',
                                  })
                                }
                                className="px-2 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                              >
                                編集
                              </button>
                              <a
                                href={`https://www.google.com/maps?q=${p.latitude},${p.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2 py-1 text-sm text-blue-600 hover:underline"
                              >
                                地図
                              </a>
                              <button onClick={() => handleDelete(p.id)} className="px-2 py-1 text-sm bg-red-100 text-red-800 rounded hover:bg-red-200">
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
          </>
        )}

        {activeTab === 'myCheckin' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-gray-600 mb-4">
              スタッフと同じ画面で、自分のアサインメントのチェックイン・チェックアウトができます。
            </p>
            <button
              type="button"
              onClick={() => router.push('/employee/cleaning-check')}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
            >
              チェックイン/チェックアウト画面を開く
            </button>
          </div>
        )}

        {activeTab === 'assignment' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">対象日</label>
                <input
                  type="date"
                  value={assignmentDate}
                  onChange={e => setAssignmentDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white"
                />
              </div>
              <div className="flex items-end gap-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">スタッフ</label>
                  <select
                    value={addEmployeeId}
                    onChange={e => setAddEmployeeId(e.target.value ? Number(e.target.value) : '')}
                    className="px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white min-w-[140px]"
                  >
                    <option value="">選択</option>
                    {employees.map(e => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">物件</label>
                  <select
                    value={addPropertyId}
                    onChange={e => setAddPropertyId(e.target.value ? Number(e.target.value) : '')}
                    className="px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white min-w-[180px]"
                  >
                    <option value="">選択</option>
                    {properties.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={handleAddAssignment}
                  disabled={!addEmployeeId || !addPropertyId || assignmentLoading}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 font-medium"
                >
                  追加
                </button>
              </div>
              <button
                type="button"
                onClick={handleSaveAssignments}
                disabled={assignmentLoading}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 font-medium"
              >
                {assignmentLoading ? '保存中...' : '保存'}
              </button>
            </div>
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              ※チェックイン画面には、担当スタッフとして割り当てた本人のみスケジュールが表示されます。自分で打刻する場合は、スタッフに自分の名前を選択してください。
            </p>
            {assignmentLoading && assignmentItems.length === 0 ? (
              <p className="text-gray-600">読み込み中...</p>
            ) : assignmentItems.length === 0 ? (
              <p className="text-gray-600">対象日のアサインメントはありません。スタッフと物件を選択して追加してください。</p>
            ) : (
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">スタッフ</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">訪問順</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">物件</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {Object.entries(
                      assignmentItems.reduce<Record<number, AssignmentItem[]>>((acc, a) => {
                        if (!acc[a.employeeId]) acc[a.employeeId] = []
                        acc[a.employeeId].push(a)
                        acc[a.employeeId].sort((x, y) => x.sortOrder - y.sortOrder)
                        return acc
                      }, {})
                    ).map(([empId, items]) =>
                      items.map((a, i) => (
                        <tr key={`${a.employeeId}-${a.propertyId}`} className="hover:bg-gray-50">
                          {i === 0 && (
                            <td rowSpan={items.length} className="px-4 py-3 text-sm font-medium text-gray-900 align-top">
                              {a.employeeName}
                            </td>
                          )}
                          <td className="px-4 py-3 text-sm text-gray-900">{a.sortOrder}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{a.propertyName}</td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => handleRemoveAssignment(a.employeeId, a.propertyId)}
                              className="text-red-600 hover:underline text-sm"
                            >
                              削除
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'progress' && (
          <div className="bg-white rounded-lg shadow-md p-6 text-center text-gray-600">
            進捗一覧はフェーズ5で実装予定です。
          </div>
        )}

        {/* 地図ピン差しモーダル */}
        {mapModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
              <div className="flex justify-between items-center p-4 border-b">
                <h2 className="text-lg font-semibold text-gray-900">地図でピンを配置（クリックまたはドラッグで調整）</h2>
                <div className="flex gap-2">
                  <button
                    onClick={handleMapConfirm}
                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                  >
                    この位置で決定
                  </button>
                  <button onClick={() => { setMapModalOpen(false); setMapLatLng(null) }} className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300">
                    キャンセル
                  </button>
                </div>
              </div>
              <div className="p-4">
                <div ref={mapContainerRef} className="w-full h-[400px] rounded-lg border border-gray-300" />
                {mapLatLng && (
                  <p className="mt-2 text-sm text-gray-600">
                    緯度: {mapLatLng.lat.toFixed(6)} / 経度: {mapLatLng.lng.toFixed(6)}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
