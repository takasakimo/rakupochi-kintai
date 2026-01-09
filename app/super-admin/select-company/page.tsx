'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface Company {
  id: number
  name: string
  code: string
  isActive: boolean
}

export default function SelectCompanyPage() {
  const { data: session, status, update } = useSession()
  const router = useRouter()
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null)

  useEffect(() => {
    if (status === 'authenticated') {
      const isSuperAdmin =
        session?.user.role === 'super_admin' ||
        session?.user.email === 'superadmin@rakupochi.com'

      if (!isSuperAdmin) {
        router.push('/')
        return
      }

      fetchCompanies()
    }
  }, [status, session, router])

  const fetchCompanies = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/super-admin/companies')
      const data = await response.json()
      setCompanies(data.companies || [])
    } catch (err) {
      console.error('Failed to fetch companies:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectCompany = async (companyId: number) => {
    try {
      // セッションを更新
      await update({
        selectedCompanyId: companyId,
      })

      // 企業の管理画面にリダイレクト
      router.push(`/admin/dashboard?companyId=${companyId}`)
    } catch (err) {
      console.error('Failed to select company:', err)
      alert('企業の選択に失敗しました')
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-900">読み込み中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">企業を選択</h1>
        <p className="text-gray-600 mb-6">
          管理する企業を選択してください。
        </p>

        {companies.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-6 text-center text-gray-700">
            企業が登録されていません。
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {companies.map((company) => (
              <div
                key={company.id}
                className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => handleSelectCompany(company.id)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {company.name}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      企業コード: {company.code}
                    </p>
                  </div>
                  <div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        company.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {company.isActive ? '有効' : '無効'}
                    </span>
                  </div>
                </div>
                <div className="mt-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleSelectCompany(company.id)
                    }}
                    className="w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 font-medium"
                  >
                    この企業を管理
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8">
          <button
            onClick={() => router.push('/super-admin/companies')}
            className="px-4 py-2 bg-gray-200 text-gray-900 rounded-md hover:bg-gray-300 font-medium"
          >
            企業を新規登録
          </button>
        </div>
      </div>
    </div>
  )
}

