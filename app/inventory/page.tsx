'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Upload, Plus, Trash2 } from 'lucide-react'
import Navigation from '@/components/Navigation'
import { formatDate } from '@/lib/utils'

interface InventoryItem {
  id: string
  name: string
  quantity: string
  expiry_date: string | null
  category: string
  created_at: string
}

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzedItems, setAnalyzedItems] = useState<any[]>([])
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    loadInventory()
  }, [])

  const loadInventory = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setItems(data || [])
    } catch (error) {
      console.error('Error loading inventory:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setSelectedFile(file)
    setAnalyzing(true)

    try {
      // Convert image to base64
      const reader = new FileReader()
      reader.onloadend = async () => {
        const base64String = (reader.result as string).split(',')[1]

        // Call analyze-receipt API
        const response = await fetch('/api/analyze-receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64String }),
        })

        if (!response.ok) throw new Error('Failed to analyze receipt')

        const data = await response.json()
        setAnalyzedItems(data.items || [])
        setConfirmDialogOpen(true)
        setUploadDialogOpen(false)
      }
      reader.readAsDataURL(file)
    } catch (error) {
      console.error('Error analyzing receipt:', error)
      alert('レシートの解析に失敗しました')
    } finally {
      setAnalyzing(false)
    }
  }

  const confirmAndSaveItems = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const itemsToInsert = analyzedItems.map((item) => ({
        user_id: user.id,
        name: item.name,
        quantity: item.quantity,
        category: item.category,
        expiry_date: item.expiry_estimation || null,
      }))

      const { error } = await supabase.from('inventory').insert(itemsToInsert)

      if (error) throw error

      setConfirmDialogOpen(false)
      setAnalyzedItems([])
      setSelectedFile(null)
      loadInventory()
    } catch (error) {
      console.error('Error saving items:', error)
      alert('在庫の保存に失敗しました')
    }
  }

  const deleteItem = async (id: string) => {
    if (!confirm('この食材を削除しますか？')) return

    try {
      const { error } = await supabase.from('inventory').delete().eq('id', id)

      if (error) throw error
      loadInventory()
    } catch (error) {
      console.error('Error deleting item:', error)
      alert('削除に失敗しました')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>読み込み中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">在庫管理</h1>
          <div className="flex gap-2">
            <Button onClick={() => setUploadDialogOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              レシートをスキャン
            </Button>
            <Button variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              手動で追加
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <Card key={item.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{item.name}</CardTitle>
                    <CardDescription>{item.category}</CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteItem(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">数量: {item.quantity}</p>
                {item.expiry_date && (
                  <p className="text-sm text-gray-600">
                    消費期限: {formatDate(item.expiry_date)}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {items.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">在庫がありません</p>
          </div>
        )}

        {/* Upload Dialog */}
        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>レシートをスキャン</DialogTitle>
              <DialogDescription>
                レシートの画像をアップロードして、在庫を自動登録します
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                disabled={analyzing}
              />
              {analyzing && <p className="mt-2 text-sm">解析中...</p>}
            </div>
          </DialogContent>
        </Dialog>

        {/* Confirm Dialog */}
        <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>解析結果を確認</DialogTitle>
              <DialogDescription>
                以下の食材が検出されました。内容を確認して保存してください
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-96 overflow-y-auto space-y-2">
              {analyzedItems.map((item, index) => (
                <Card key={index}>
                  <CardContent className="p-4">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-gray-600">
                      数量: {item.quantity} | カテゴリ: {item.category}
                    </p>
                    {item.expiry_estimation && (
                      <p className="text-sm text-gray-600">
                        推定消費期限: {item.expiry_estimation}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setConfirmDialogOpen(false)}
              >
                キャンセル
              </Button>
              <Button onClick={confirmAndSaveItems}>保存</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}




