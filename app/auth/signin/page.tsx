'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SignInPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        console.error('[SignIn] Login error:', result.error)
        // データベース接続エラーの場合の特別なメッセージ
        if (result.error.includes('database') || result.error.includes('connection') || result.error.includes('Tenant')) {
          setError('データベース接続エラーが発生しました。管理者にお問い合わせください。')
        } else {
          setError('メールアドレスまたはパスワードが正しくありません')
        }
      } else if (result?.ok) {
        router.push('/')
        router.refresh()
      } else {
        setError('ログインに失敗しました')
      }
    } catch (err: any) {
      console.error('[SignIn] Unexpected error:', err)
      setError('ログインに失敗しました: ' + (err?.message || 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <h1 className="text-3xl font-bold text-center mb-2 text-gray-900">らくポチ勤怠</h1>
        <p className="text-center text-gray-600 mb-6">勤怠管理システム</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              メールアドレス
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              パスワード
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
            />
          </div>
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded text-sm">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-blue-500 text-white rounded-md font-semibold hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>
        <div className="flex justify-between mt-4">
          <Link
            href="/employee/register"
            className="text-blue-500 hover:text-blue-600 text-sm font-medium"
          >
            新規従業員登録
          </Link>
          <Link
            href="/register"
            className="text-blue-500 hover:text-blue-600 text-sm font-medium"
          >
            新規企業登録
          </Link>
        </div>
      </div>
    </div>
  )
}

