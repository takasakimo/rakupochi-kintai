'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function EmployeeRegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1) // ステップ1: 従業員情報、ステップ2: パスワード設定
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState('') // ステップ1で登録されたメールアドレス

  const [formData, setFormData] = useState({
    companyCode: '',
    employeeNumber: '',
    name: '',
    email: '',
    password: '',
    passwordConfirm: '',
    phone: '',
    birthDate: '',
    address: '',
  })

  // ステップ1: 従業員情報を登録
  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/employee/register-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyCode: formData.companyCode.toUpperCase(),
          employeeNumber: formData.employeeNumber,
          name: formData.name,
          email: formData.email,
          phone: formData.phone || null,
          birthDate: formData.birthDate || null,
          address: formData.address || null,
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setRegisteredEmail(formData.email)
        setStep(2) // ステップ2に進む
      } else {
        setError(data.error || '従業員情報の登録に失敗しました')
      }
    } catch (err) {
      console.error('Registration error:', err)
      setError('従業員情報の登録に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  // ステップ2: パスワードを設定
  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // バリデーション
    if (formData.password !== formData.passwordConfirm) {
      setError('パスワードが一致しません')
      setLoading(false)
      return
    }

    if (formData.password.length < 8) {
      setError('パスワードは8文字以上で入力してください')
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/employee/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: registeredEmail,
          password: formData.password,
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setSuccess(true)
        setTimeout(() => {
          router.push('/auth/signin')
        }, 3000)
      } else {
        setError(data.error || 'パスワードの設定に失敗しました')
      }
    } catch (err) {
      console.error('Set password error:', err)
      setError('パスワードの設定に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
          <h1 className="text-2xl font-bold mb-4 text-gray-900">登録完了</h1>
          <p className="text-gray-700 mb-6">
            スタッフ登録が完了しました。
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
        <p className="text-center text-gray-600 mb-6">スタッフ新規登録</p>

        {/* ステップインジケーター */}
        <div className="flex items-center justify-center mb-6">
          <div className="flex items-center">
            <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
              step >= 1 ? 'bg-blue-500 border-blue-500 text-white' : 'bg-gray-100 border-gray-300 text-gray-500'
            }`}>
              1
            </div>
            <div className={`w-20 h-1 ${step >= 2 ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
            <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
              step >= 2 ? 'bg-blue-500 border-blue-500 text-white' : 'bg-gray-100 border-gray-300 text-gray-500'
            }`}>
              2
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center mb-6">
          <div className="flex items-center gap-20">
            <span className={`text-sm ${step >= 1 ? 'text-blue-500 font-semibold' : 'text-gray-500'}`}>
              従業員情報
            </span>
            <span className={`text-sm ${step >= 2 ? 'text-blue-500 font-semibold' : 'text-gray-500'}`}>
              パスワード設定
            </span>
          </div>
        </div>

        {step === 1 ? (
          <form onSubmit={handleStep1Submit} className="space-y-6">
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
              />
              <p className="mt-1 text-xs text-gray-500">
                管理者から提供された企業コードを入力してください
              </p>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-4 text-gray-900">スタッフ情報</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  社員番号 <span className="text-red-500">*</span>
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
                {loading ? '登録中...' : '次へ'}
              </button>
              <Link
                href="/auth/signin"
                className="flex-1 py-2 px-4 bg-gray-200 text-gray-900 rounded-md font-semibold hover:bg-gray-300 text-center"
              >
                ログイン
              </Link>
            </div>
          </form>
        ) : (
          <form onSubmit={handleStep2Submit} className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-4 text-gray-900">パスワード設定</h2>
              <p className="text-sm text-gray-600 mb-4">
                メールアドレス: <span className="font-semibold">{registeredEmail}</span>
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    パスワード <span className="text-red-500">*</span>
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
                    パスワード（確認） <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={formData.passwordConfirm}
                    onChange={(e) =>
                      setFormData({ ...formData, passwordConfirm: e.target.value })
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
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 py-2 px-4 bg-gray-200 text-gray-900 rounded-md font-semibold hover:bg-gray-300"
              >
                戻る
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2 px-4 bg-blue-500 text-white rounded-md font-semibold hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '設定中...' : '登録完了'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

