'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Application {
  id: number
  type: string
  status: string
  title: string | null
  content: string
  reason: string | null
  createdAt: string
  approvedAt: string | null
  rejectedAt: string | null
  rejectionReason: string | null
}

const APPLICATION_TYPES: Record<string, string> = {
  attendance_correction: '打刻修正',
  overtime: '残業申請',
  leave: '休暇申請',
  expense_advance: '立替金精算',
  expense_transportation: '交通費精算',
  shift_exchange: 'シフト交換',
  shift_request: 'シフト希望',
}

const STATUS_LABELS: Record<string, string> = {
  pending: '承認待ち',
  approved: '承認済み',
  rejected: '却下',
}

export default function ApplicationsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'authenticated') {
      fetchApplications()
    }
  }, [status])

  const fetchApplications = async () => {
    try {
      const response = await fetch('/api/applications')
      const data = await response.json()
      setApplications(data.applications || [])
    } catch (err) {
      console.error('Failed to fetch applications:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  if (status === 'loading' || loading) {
    return <div className="p-8 text-center text-gray-900">読み込み中...</div>
  }

  return (
    <div className="p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-gray-900">申請一覧</h1>
        <div className="flex justify-end mb-6">
          <Link
            href="/employee/applications/new"
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium"
          >
            + 新規申請
          </Link>
        </div>

        {applications.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-6 text-center text-gray-500">
            申請がありません
          </div>
        ) : (
          <div className="space-y-4">
            {applications.map((app) => (
              <div key={app.id} className="bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {APPLICATION_TYPES[app.type] || app.type}
                    </h3>
                    {app.title && (
                      <p className="text-gray-700 mt-1">{app.title}</p>
                    )}
                  </div>
                  <span
                    className={`px-3 py-1 rounded text-sm ${
                      app.status === 'approved'
                        ? 'bg-green-100 text-green-800'
                        : app.status === 'rejected'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {STATUS_LABELS[app.status]}
                  </span>
                </div>

                <div className="text-sm text-gray-600 mb-2">
                  申請日: {formatDate(app.createdAt)}
                </div>

                {app.reason && (
                  <div className="mb-2">
                    <div className="text-sm font-semibold mb-1 text-gray-900">理由:</div>
                    <div className="text-sm text-gray-700">{app.reason}</div>
                  </div>
                )}

                {app.rejectionReason && (
                  <div className="mt-2 p-3 bg-red-50 rounded">
                    <div className="text-sm font-semibold text-red-800 mb-1">
                      却下理由:
                    </div>
                    <div className="text-sm text-red-700">{app.rejectionReason}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

