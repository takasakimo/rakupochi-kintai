'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Check, Plus, Trash2 } from 'lucide-react'
import Navigation from '@/components/Navigation'

interface ShoppingListItem {
  id: string
  item_name: string
  is_checked: boolean
  created_at: string
}

export default function ShoppingListPage() {
  const [items, setItems] = useState<ShoppingListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [newItem, setNewItem] = useState('')
  const supabase = createClient()

  useEffect(() => {
    loadShoppingList()
  }, [])

  const loadShoppingList = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('shopping_list')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setItems(data || [])
    } catch (error) {
      console.error('Error loading shopping list:', error)
    } finally {
      setLoading(false)
    }
  }

  const addItem = async () => {
    if (!newItem.trim()) return

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase.from('shopping_list').insert({
        user_id: user.id,
        item_name: newItem.trim(),
        is_checked: false,
      })

      if (error) throw error

      setNewItem('')
      loadShoppingList()
    } catch (error) {
      console.error('Error adding item:', error)
      alert('追加に失敗しました')
    }
  }

  const toggleCheck = async (id: string, currentChecked: boolean) => {
    try {
      const { error } = await supabase
        .from('shopping_list')
        .update({ is_checked: !currentChecked })
        .eq('id', id)

      if (error) throw error
      loadShoppingList()
    } catch (error) {
      console.error('Error toggling check:', error)
    }
  }

  const deleteItem = async (id: string) => {
    try {
      const { error } = await supabase
        .from('shopping_list')
        .delete()
        .eq('id', id)

      if (error) throw error
      loadShoppingList()
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

  const checkedItems = items.filter((item) => item.is_checked)
  const uncheckedItems = items.filter((item) => !item.is_checked)

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold mb-6">買い物リスト</h1>

        <div className="flex gap-2 mb-6">
          <Input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addItem()}
            placeholder="アイテムを追加..."
          />
          <Button onClick={addItem}>
            <Plus className="h-4 w-4 mr-2" />
            追加
          </Button>
        </div>

        <div className="space-y-4">
          {uncheckedItems.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-2">未チェック</h2>
              <div className="space-y-2">
                {uncheckedItems.map((item) => (
                  <Card key={item.id}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggleCheck(item.id, item.is_checked)}
                          className="w-5 h-5 border-2 border-gray-300 rounded flex items-center justify-center hover:border-primary"
                        >
                          {item.is_checked && (
                            <Check className="h-4 w-4 text-primary" />
                          )}
                        </button>
                        <span>{item.item_name}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {checkedItems.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-2">完了</h2>
              <div className="space-y-2">
                {checkedItems.map((item) => (
                  <Card key={item.id} className="opacity-60">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggleCheck(item.id, item.is_checked)}
                          className="w-5 h-5 border-2 border-primary bg-primary rounded flex items-center justify-center"
                        >
                          <Check className="h-4 w-4 text-white" />
                        </button>
                        <span className="line-through">{item.item_name}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {items.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">買い物リストが空です</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}






