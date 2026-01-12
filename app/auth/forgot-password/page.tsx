'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [resetUrl, setResetUrl] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!email) {
      setError('メールアドレスを入力してください')
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setSuccess(true)
        if (data.resetUrl) {
          setResetUrl(data.resetUrl)
        }
      } else {
        setError(data.error || 'リクエストの送信に失敗しました')
      }
    } catch (err) {
      console.error('Forgot password error:', err)
      setError('リクエストの送信に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
          <div className="mb-4">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100">
              <svg
                className="h-6 w-6 text-blue-600"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-bold mb-4 text-gray-900">
            {resetUrl ? 'パスワードリセットリンクを生成しました' : 'メールを送信しました'}
          </h1>
          {resetUrl ? (
            <>
              <p className="text-gray-700 mb-4">
                以下のリンクをクリックして、パスワードをリセットしてください。
              </p>
              <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <a
                  href={resetUrl}
                  className="text-blue-600 hover:text-blue-800 underline break-all text-sm"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {resetUrl}
                </a>
              </div>
              <p className="text-sm text-gray-600 mb-6">
                ※ このリンクは24時間有効です。メール送信が無効な場合は、このリンクを直接使用してください。
              </p>
            </>
          ) : (
            <p className="text-gray-700 mb-6">
              メールアドレスが登録されている場合、パスワードリセットリンクを送信しました。
              <br />
              メールボックスを確認し、リンクをクリックしてパスワードをリセットしてください。
            </p>
          )}
          <Link
            href="/auth/signin"
            className="text-blue-500 hover:text-blue-600 font-medium"
          >
            ログインページに戻る
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">パスワードを忘れた場合</h1>
          <p className="text-gray-600">
            登録されているメールアドレスを入力してください。
            <br />
            パスワードリセットリンクを送信します。
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm">
            {error}
          </div>
        )}

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
              placeholder="example@company.com"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? '送信中...' : 'リセットリンクを送信'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link
            href="/auth/signin"
            className="text-sm text-blue-500 hover:text-blue-600"
          >
            ログインページに戻る
          </Link>
        </div>
      </div>
    </div>
  )
}

