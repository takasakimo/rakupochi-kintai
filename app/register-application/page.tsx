'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function RegisterApplicationForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const companyCode = searchParams.get('company')
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const [formData, setFormData] = useState({
    companyCode: companyCode || '',
    name: '',
    email: '',
    phone: '',
    address: '',
    transportationRoutes: [] as Array<{ from: string; to: string; method: string; amount: string }>,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // バリデーション
    if (!formData.companyCode || !formData.name || !formData.email || !formData.phone || !formData.address) {
      setError('必須項目（企業コード、氏名、メールアドレス、電話番号、住所）を入力してください')
      setLoading(false)
      return
    }

    // メールアドレスの形式チェック
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) {
      setError('正しいメールアドレスを入力してください')
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/applications/employee-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyCode: formData.companyCode.toUpperCase(),
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
          transportationRoutes: formData.transportationRoutes.length > 0 ? formData.transportationRoutes : null,
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setSuccess(true)
      } else {
        setError(data.error || '申請の送信に失敗しました')
      }
    } catch (err) {
      console.error('Application error:', err)
      setError('申請の送信に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const addTransportationRoute = () => {
    setFormData({
      ...formData,
      transportationRoutes: [
        ...formData.transportationRoutes,
        { from: '', to: '', method: '', amount: '' },
      ],
    })
  }

  const removeTransportationRoute = (index: number) => {
    setFormData({
      ...formData,
      transportationRoutes: formData.transportationRoutes.filter((_, i) => i !== index),
    })
  }

  const updateTransportationRoute = (index: number, field: string, value: string) => {
    const newRoutes = [...formData.transportationRoutes]
    newRoutes[index] = { ...newRoutes[index], [field]: value }
    setFormData({ ...formData, transportationRoutes: newRoutes })
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
          <h1 className="text-2xl font-bold mb-4 text-gray-900">申請完了</h1>
          <p className="text-gray-700 mb-6">
            従業員登録申請を送信しました。
            <br />
            管理者による承認をお待ちください。
          </p>
          <Link
            href="/auth/signin"
            className="text-blue-500 hover:text-blue-600 font-medium"
          >
            ログインページへ →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-md p-8">
        <h1 className="text-3xl font-bold text-center mb-2 text-gray-900">
          らくポチ勤怠
        </h1>
        <p className="text-center text-gray-600 mb-6">従業員登録申請</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="border-b pb-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900">企業情報</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                企業コード <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.companyCode}
                onChange={(e) =>
                  setFormData({ ...formData, companyCode: e.target.value.toUpperCase() })
                }
                required
                pattern="[A-Z0-9]+"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                placeholder="例: COMPANY001"
                readOnly={!!companyCode}
              />
              <p className="mt-1 text-xs text-gray-500">
                管理者から提供された企業コードを入力してください
              </p>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-4 text-gray-900">個人情報</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  氏名 <span className="text-red-500">*</span>
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
                  メールアドレス <span className="text-red-500">*</span>
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
            </div>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-4 text-gray-900">交通経路（任意）</h2>
            {formData.transportationRoutes.map((route, index) => (
              <div key={index} className="mb-4 p-4 border border-gray-200 rounded-md">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">経路 {index + 1}</span>
                  {formData.transportationRoutes.length > 0 && (
                    <button
                      type="button"
                      onClick={() => removeTransportationRoute(index)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      削除
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      出発地
                    </label>
                    <input
                      type="text"
                      value={route.from}
                      onChange={(e) =>
                        updateTransportationRoute(index, 'from', e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                      placeholder="例: 自宅"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      到着地
                    </label>
                    <input
                      type="text"
                      value={route.to}
                      onChange={(e) =>
                        updateTransportationRoute(index, 'to', e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                      placeholder="例: 本社"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      交通手段
                    </label>
                    <input
                      type="text"
                      value={route.method}
                      onChange={(e) =>
                        updateTransportationRoute(index, 'method', e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                      placeholder="例: 電車"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      金額（円）
                    </label>
                    <input
                      type="number"
                      value={route.amount}
                      onChange={(e) =>
                        updateTransportationRoute(index, 'amount', e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                      placeholder="例: 500"
                    />
                  </div>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addTransportationRoute}
              className="px-4 py-2 bg-gray-200 text-gray-900 rounded-md hover:bg-gray-300 font-medium text-sm"
            >
              + 交通経路を追加
            </button>
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 px-4 bg-blue-500 text-white rounded-md font-semibold hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '送信中...' : '申請を送信'}
            </button>
            <Link
              href="/auth/signin"
              className="flex-1 py-2 px-4 bg-gray-200 text-gray-900 rounded-md font-semibold hover:bg-gray-300 text-center"
            >
              ログイン
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function EmployeeRegisterApplicationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-900">読み込み中...</div>
      </div>
    }>
      <RegisterApplicationForm />
    </Suspense>
  )
}

