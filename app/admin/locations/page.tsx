'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

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

export default function LocationsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingLocation, setEditingLocation] = useState<Location | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    latitude: '',
    longitude: '',
    radius: '500',
  })
  const [geocodingLoading, setGeocodingLoading] = useState(false)

  useEffect(() => {
    if (status === 'authenticated') {
      const isAdmin = session?.user.role === 'admin'
      const isSuperAdmin = session?.user.role === 'super_admin' || 
                          session?.user.email === 'superadmin@rakupochi.com'
      
      if (isAdmin || (isSuperAdmin && session?.user.selectedCompanyId)) {
        fetchLocations()
      }
    }
  }, [status, session])

  const fetchLocations = async () => {
    try {
      // 全ての店舗を取得（isActiveも含む）
      const response = await fetch('/api/admin/locations?all=true')
      if (response.ok) {
        const data = await response.json()
        setLocations(data.locations || [])
      }
    } catch (err) {
      console.error('Failed to fetch locations:', err)
    } finally {
      setLoading(false)
    }
  }

  // 住所から緯度経度を自動取得（新規登録用）
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
        setFormData({
          ...formData,
          latitude: data.latitude.toString(),
          longitude: data.longitude.toString(),
        })
      } else {
        console.warn('緯度経度の取得に失敗しました:', data.error || '住所が見つかりませんでした')
        // エラーは警告のみで、ユーザーに通知しない（手動入力も可能なため）
      }
    } catch (err) {
      console.error('Failed to geocode address:', err)
      // エラーは警告のみで、ユーザーに通知しない（手動入力も可能なため）
    } finally {
      setGeocodingLoading(false)
    }
  }

  // 住所から緯度経度を自動取得（編集用）
  const handleEditAddressGeocode = async (address: string) => {
    if (!address || address.trim() === '' || !editingLocation) {
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
        setEditingLocation({
          ...editingLocation,
          latitude: data.latitude,
          longitude: data.longitude,
        })
      } else {
        console.warn('緯度経度の取得に失敗しました:', data.error || '住所が見つかりませんでした')
        // エラーは警告のみで、ユーザーに通知しない（手動入力も可能なため）
      }
    } catch (err) {
      console.error('Failed to geocode address:', err)
      // エラーは警告のみで、ユーザーに通知しない（手動入力も可能なため）
    } finally {
      setGeocodingLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch('/api/admin/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          type: 'store', // 店舗管理ページでは常に'store'
          address: formData.address || null,
          latitude: formData.latitude ? parseFloat(formData.latitude) : 0,
          longitude: formData.longitude ? parseFloat(formData.longitude) : 0,
          radius: formData.radius ? parseInt(formData.radius) : 500,
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
          radius: '500',
        })
        fetchLocations()
        alert('店舗を登録しました')
      } else {
        alert(data.error || '店舗の登録に失敗しました')
      }
    } catch (err) {
      console.error('Failed to create location:', err)
      alert('店舗の登録に失敗しました')
    }
  }

  const handleUpdate = async (location: Location) => {
    try {
      const response = await fetch(`/api/admin/locations/${location.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: location.name,
          type: location.type || 'store', // 既存データの互換性のため
          address: location.address,
          latitude: location.latitude,
          longitude: location.longitude,
          radius: location.radius,
          isActive: location.isActive,
        }),
      })

      const data = await response.json()
      if (data.success) {
        setEditingLocation(null)
        fetchLocations()
        alert('店舗を更新しました')
      } else {
        alert(data.error || '店舗の更新に失敗しました')
      }
    } catch (err) {
      console.error('Failed to update location:', err)
      alert('店舗の更新に失敗しました')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('この店舗を削除しますか？')) return

    try {
      const response = await fetch(`/api/admin/locations/${id}`, {
        method: 'DELETE',
      })

      const data = await response.json()
      if (data.success) {
        fetchLocations()
        alert('店舗を削除しました')
      } else {
        alert(data.error || '店舗の削除に失敗しました')
      }
    } catch (err) {
      console.error('Failed to delete location:', err)
      alert('店舗の削除に失敗しました')
    }
  }

  if (status === 'loading' || loading) {
    return <div className="p-8 text-center text-gray-900">読み込み中...</div>
  }

  return (
    <div className="p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">店舗管理</h1>
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 font-medium"
          >
            + 店舗登録
          </button>
        </div>

        {/* 新規登録フォーム */}
        {showCreateForm && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4 text-gray-900">新規店舗登録</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  店舗名 <span className="text-red-500">*</span>
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
                  住所
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                    onBlur={(e) => {
                      // 住所が入力されていて、緯度経度が未入力の場合のみ自動取得
                      if (e.target.value.trim() && (!formData.latitude || !formData.longitude)) {
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
                    value={formData.latitude}
                    onChange={(e) =>
                      setFormData({ ...formData, latitude: e.target.value })
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
                    value={formData.longitude}
                    onChange={(e) =>
                      setFormData({ ...formData, longitude: e.target.value })
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
                  value={formData.radius}
                  onChange={(e) =>
                    setFormData({ ...formData, radius: e.target.value })
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
                    setShowCreateForm(false)
                    setFormData({
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

        {/* 店舗一覧 */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                  店舗名
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
              {locations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-700">
                    店舗が登録されていません
                  </td>
                </tr>
              ) : (
                locations.map((location) => (
                  <tr key={location.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {editingLocation?.id === location.id ? (
                        <input
                          type="text"
                          value={editingLocation.name}
                          onChange={(e) =>
                            setEditingLocation({
                              ...editingLocation,
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
                      {editingLocation?.id === location.id ? (
                        <div className="relative">
                          <input
                            type="text"
                            value={editingLocation.address || ''}
                            onChange={(e) =>
                              setEditingLocation({
                                ...editingLocation,
                                address: e.target.value,
                              })
                            }
                            onBlur={(e) => {
                              // 住所が変更されていて、緯度経度が未入力または0の場合のみ自動取得
                              if (
                                e.target.value.trim() &&
                                (editingLocation.latitude === 0 ||
                                  editingLocation.longitude === 0)
                              ) {
                                handleEditAddressGeocode(e.target.value)
                              }
                            }}
                            placeholder="住所を入力すると自動的に緯度経度が取得されます"
                            className="w-full px-2 py-1 border border-gray-300 rounded text-gray-900 bg-white"
                          />
                          {geocodingLoading && editingLocation?.id === location.id && (
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
                      {editingLocation?.id === location.id ? (
                        <input
                          type="number"
                          step="any"
                          value={editingLocation.latitude}
                          onChange={(e) =>
                            setEditingLocation({
                              ...editingLocation,
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
                      {editingLocation?.id === location.id ? (
                        <input
                          type="number"
                          step="any"
                          value={editingLocation.longitude}
                          onChange={(e) =>
                            setEditingLocation({
                              ...editingLocation,
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
                      {editingLocation?.id === location.id ? (
                        <input
                          type="number"
                          value={editingLocation.radius}
                          onChange={(e) =>
                            setEditingLocation({
                              ...editingLocation,
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
                      {editingLocation?.id === location.id ? (
                        <select
                          value={editingLocation.isActive ? 'true' : 'false'}
                          onChange={(e) =>
                            setEditingLocation({
                              ...editingLocation,
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
                      {editingLocation?.id === location.id ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleUpdate(editingLocation)}
                            className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
                          >
                            保存
                          </button>
                          <button
                            onClick={() => setEditingLocation(null)}
                            className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
                          >
                            キャンセル
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditingLocation(location)}
                            className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => handleDelete(location.id)}
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
      </div>
    </div>
  )
}

