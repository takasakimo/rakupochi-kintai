'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function RegisterPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const [formData, setFormData] = useState({
    // 企業情報
    companyName: '',
    companyCode: '',
    companyEmail: '',
    companyPhone: '',
    companyAddress: '',
    // 管理者情報
    adminName: '',
    adminEmail: '',
    adminPassword: '',
    adminPasswordConfirm: '',
    adminEmployeeNumber: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // バリデーション
    if (formData.adminPassword !== formData.adminPasswordConfirm) {
      setError('パスワードが一致しません')
      setLoading(false)
      return
    }

    if (formData.adminPassword.length < 8) {
      setError('パスワードは8文字以上で入力してください')
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/companies/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: formData.companyName,
          companyCode: formData.companyCode,
          companyEmail: formData.companyEmail || null,
          companyPhone: formData.companyPhone || null,
          companyAddress: formData.companyAddress || null,
          adminName: formData.adminName,
          adminEmail: formData.adminEmail,
          adminPassword: formData.adminPassword,
          adminEmployeeNumber: formData.adminEmployeeNumber,
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setSuccess(true)
        setTimeout(() => {
          router.push('/auth/signin')
        }, 3000)
      } else {
        setError(data.error || '企業登録に失敗しました')
      }
    } catch (err) {
      console.error('Registration error:', err)
      setError('企業登録に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
          <div className="text-4xl mb-4">✅</div>
          <h1 className="text-2xl font-bold mb-4 text-gray-900">登録完了</h1>
          <p className="text-gray-700 mb-6">
            企業登録が完了しました。
            <br />
            3秒後にログインページにリダイレクトします。
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
        <p className="text-center text-gray-600 mb-6">企業登録</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 企業情報 */}
          <div className="border-b pb-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900">企業情報</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  企業名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.companyName}
                  onChange={(e) =>
                    setFormData({ ...formData, companyName: e.target.value })
                  }
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                />
              </div>
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
                />
                <p className="mt-1 text-xs text-gray-500">
                  英数字のみ（大文字推奨）
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  企業メールアドレス
                </label>
                <input
                  type="email"
                  value={formData.companyEmail}
                  onChange={(e) =>
                    setFormData({ ...formData, companyEmail: e.target.value })
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
                  value={formData.companyPhone}
                  onChange={(e) =>
                    setFormData({ ...formData, companyPhone: e.target.value })
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
                  value={formData.companyAddress}
                  onChange={(e) =>
                    setFormData({ ...formData, companyAddress: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                />
              </div>
            </div>
          </div>

          {/* 管理者情報 */}
          <div>
            <h2 className="text-xl font-semibold mb-4 text-gray-900">管理者アカウント</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  社員番号 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.adminEmployeeNumber}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      adminEmployeeNumber: e.target.value,
                    })
                  }
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  氏名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.adminName}
                  onChange={(e) =>
                    setFormData({ ...formData, adminName: e.target.value })
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
                  value={formData.adminEmail}
                  onChange={(e) =>
                    setFormData({ ...formData, adminEmail: e.target.value })
                  }
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  パスワード <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={formData.adminPassword}
                  onChange={(e) =>
                    setFormData({ ...formData, adminPassword: e.target.value })
                  }
                  required
                  minLength={8}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                />
                <p className="mt-1 text-xs text-gray-500">8文字以上</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  パスワード（確認） <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={formData.adminPasswordConfirm}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      adminPasswordConfirm: e.target.value,
                    })
                  }
                  required
                  minLength={8}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                />
              </div>
            </div>
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
              {loading ? '登録中...' : '企業登録'}
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

