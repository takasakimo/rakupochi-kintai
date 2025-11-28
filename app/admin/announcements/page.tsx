'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

interface Attachment {
  name: string
  type: string
  data: string // Base64エンコードされたデータ
}

interface Announcement {
  id: number
  title: string
  content: string
  attachments: Attachment[] | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export default function AnnouncementsPage() {
  const { data: session, status } = useSession()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null)

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    attachments: [] as Attachment[],
    isActive: true,
  })

  useEffect(() => {
    if (status === 'authenticated' && session?.user.role === 'admin') {
      fetchAnnouncements()
    }
  }, [status, session])

  const fetchAnnouncements = async () => {
    try {
      const response = await fetch('/api/admin/announcements')
      if (!response.ok) {
        console.error('Failed to fetch announcements:', response.status)
        setAnnouncements([])
        return
      }
      const data = await response.json()
      if (data.announcements && Array.isArray(data.announcements)) {
        setAnnouncements(data.announcements)
      } else {
        setAnnouncements([])
      }
    } catch (err) {
      console.error('Failed to fetch announcements:', err)
      setAnnouncements([])
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    Array.from(files).forEach((file) => {
      const reader = new FileReader()
      reader.onload = (event) => {
        const base64 = event.target?.result as string
        const attachment: Attachment = {
          name: file.name,
          type: file.type,
          data: base64,
        }
        setFormData({
          ...formData,
          attachments: [...formData.attachments, attachment],
        })
      }
      reader.readAsDataURL(file)
    })
  }

  const handleRemoveAttachment = (index: number) => {
    const newAttachments = formData.attachments.filter((_, i) => i !== index)
    setFormData({ ...formData, attachments: newAttachments })
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const payload = {
        ...formData,
        attachments: formData.attachments.length > 0 ? formData.attachments : null,
      }
      const response = await fetch('/api/admin/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      if (data.success) {
        setShowCreateForm(false)
        setFormData({
          title: '',
          content: '',
          attachments: [],
          isActive: true,
        })
        fetchAnnouncements()
        alert('お知らせを作成しました')
      } else {
        alert(data.error || 'お知らせの作成に失敗しました')
      }
    } catch (err) {
      console.error('Failed to create announcement:', err)
      alert('お知らせの作成に失敗しました')
    }
  }

  const handleUpdate = async (announcement: Announcement) => {
    try {
      const payload = {
        title: formData.title || announcement.title,
        content: formData.content || announcement.content,
        attachments: formData.attachments.length > 0 ? formData.attachments : null,
        isActive: formData.isActive,
      }
      const response = await fetch(`/api/admin/announcements/${announcement.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      if (data.success) {
        setEditingAnnouncement(null)
        setFormData({
          title: '',
          content: '',
          attachments: [],
          isActive: true,
        })
        fetchAnnouncements()
        alert('お知らせを更新しました')
      } else {
        alert(data.error || 'お知らせの更新に失敗しました')
      }
    } catch (err) {
      console.error('Failed to update announcement:', err)
      alert('お知らせの更新に失敗しました')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('このお知らせを削除しますか？')) return

    try {
      const response = await fetch(`/api/admin/announcements/${id}`, {
        method: 'DELETE',
      })

      const data = await response.json()
      if (data.success) {
        fetchAnnouncements()
        alert('お知らせを削除しました')
      } else {
        alert(data.error || 'お知らせの削除に失敗しました')
      }
    } catch (err) {
      console.error('Failed to delete announcement:', err)
      alert('お知らせの削除に失敗しました')
    }
  }

  const handleEditClick = (announcement: Announcement) => {
    setEditingAnnouncement(announcement)
    setFormData({
      title: announcement.title,
      content: announcement.content,
      attachments: (announcement.attachments as Attachment[]) || [],
      isActive: announcement.isActive,
    })
    setShowCreateForm(false)
  }

  const renderAttachment = (attachment: Attachment, index: number) => {
    const isImage = attachment.type.startsWith('image/')
    const isPdf = attachment.type === 'application/pdf'

    return (
      <div key={index} className="border border-gray-300 rounded p-2 mb-2">
        {isImage ? (
          <div>
            <img
              src={attachment.data}
              alt={attachment.name}
              className="max-w-full h-auto max-h-48 rounded"
            />
            <p className="text-sm text-gray-600 mt-1">{attachment.name}</p>
          </div>
        ) : isPdf ? (
          <div>
            <iframe
              src={attachment.data}
              className="w-full h-64 rounded"
              title={attachment.name}
            />
            <p className="text-sm text-gray-600 mt-1">{attachment.name}</p>
          </div>
        ) : (
          <p className="text-sm text-gray-600">{attachment.name}</p>
        )}
        {editingAnnouncement && (
          <button
            type="button"
            onClick={() => handleRemoveAttachment(index)}
            className="mt-2 px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
          >
            削除
          </button>
        )}
      </div>
    )
  }

  if (status === 'loading' || loading) {
    return <div className="p-8 text-center text-gray-900">読み込み中...</div>
  }

  return (
    <div className="p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">お知らせ管理</h1>
          <button
            onClick={() => {
              setShowCreateForm(!showCreateForm)
              setEditingAnnouncement(null)
              setFormData({
                title: '',
                content: '',
                attachments: [],
                isActive: true,
              })
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 font-medium"
          >
            {showCreateForm ? 'キャンセル' : '+ お知らせ作成'}
          </button>
        </div>

        {/* お知らせ作成フォーム */}
        {showCreateForm && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4 text-gray-900">新規お知らせ作成</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  タイトル *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  本文 *
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  required
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  添付ファイル（PDF、画像）
                </label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.gif"
                  multiple
                  onChange={handleFileUpload}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                />
                <p className="text-xs text-gray-500 mt-1">
                  PDF、JPG、PNG、GIF形式のファイルをアップロードできます
                </p>
                {formData.attachments.length > 0 && (
                  <div className="mt-2">
                    {formData.attachments.map((attachment, index) => (
                      <div key={index} className="border border-gray-300 rounded p-2 mb-2">
                        {attachment.type.startsWith('image/') ? (
                          <img
                            src={attachment.data}
                            alt={attachment.name}
                            className="max-w-full h-auto max-h-32 rounded"
                          />
                        ) : (
                          <p className="text-sm text-gray-600">{attachment.name}</p>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveAttachment(index)}
                          className="mt-2 px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
                        >
                          削除
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-gray-700">公開中</span>
                </label>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 font-medium"
                >
                  作成
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

        {/* お知らせ一覧 */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {announcements.length === 0 ? (
            <div className="p-6 text-center text-gray-700">お知らせがありません</div>
          ) : (
            <div className="divide-y divide-gray-200">
              {announcements.map((announcement) => (
                <div key={announcement.id} className="p-6 hover:bg-gray-50">
                  {editingAnnouncement?.id === announcement.id ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault()
                        handleUpdate(announcement)
                      }}
                      className="space-y-4"
                    >
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          タイトル *
                        </label>
                        <input
                          type="text"
                          value={formData.title}
                          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          本文 *
                        </label>
                        <textarea
                          value={formData.content}
                          onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                          required
                          rows={6}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          添付ファイル
                        </label>
                        {formData.attachments.length > 0 && (
                          <div className="mb-2">
                            {formData.attachments.map((attachment, index) =>
                              renderAttachment(attachment, index)
                            )}
                          </div>
                        )}
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.gif"
                          multiple
                          onChange={handleFileUpload}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                        />
                      </div>
                      <div>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={formData.isActive}
                            onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                            className="w-4 h-4"
                          />
                          <span className="text-sm text-gray-700">公開中</span>
                        </label>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 font-medium"
                        >
                          保存
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingAnnouncement(null)
                            setFormData({
                              title: '',
                              content: '',
                              attachments: [],
                              isActive: true,
                            })
                          }}
                          className="px-4 py-2 bg-gray-200 text-gray-900 rounded-md hover:bg-gray-300 font-medium"
                        >
                          キャンセル
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">
                            {announcement.title}
                          </h3>
                          <p className="text-sm text-gray-500 mt-1">
                            {new Date(announcement.createdAt).toLocaleString('ja-JP')}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              announcement.isActive
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {announcement.isActive ? '公開中' : '非公開'}
                          </span>
                          <button
                            onClick={() => handleEditClick(announcement)}
                            className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => handleDelete(announcement.id)}
                            className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                          >
                            削除
                          </button>
                        </div>
                      </div>
                      <div className="text-gray-700 whitespace-pre-wrap mb-4">
                        {announcement.content}
                      </div>
                      {announcement.attachments &&
                        Array.isArray(announcement.attachments) &&
                        announcement.attachments.length > 0 && (
                          <div className="mt-4">
                            <h4 className="text-sm font-semibold text-gray-900 mb-2">添付ファイル</h4>
                            {announcement.attachments.map((attachment: Attachment, index: number) =>
                              renderAttachment(attachment, index)
                            )}
                          </div>
                        )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

