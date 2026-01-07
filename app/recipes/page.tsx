'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Sparkles, Plus, Star, ShoppingCart, Upload, Link as LinkIcon } from 'lucide-react'
import Navigation from '@/components/Navigation'

interface Recipe {
  id: string
  title: string
  description: string | null
  ingredients: Array<{ name: string; quantity: string }>
  steps: string[]
  calories: string | null
  image_url: string | null
  source_type: string
  is_favorite: boolean
}

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [aiRecipe, setAiRecipe] = useState<any>(null)
  const [generating, setGenerating] = useState(false)
  const [addRecipeDialogOpen, setAddRecipeDialogOpen] = useState(false)
  const [addMode, setAddMode] = useState<'manual' | 'url' | 'image'>('manual')
  const supabase = createClient()

  useEffect(() => {
    loadRecipes()
  }, [])

  const loadRecipes = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('recipes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Parse JSON fields
      const parsedRecipes = (data || []).map((recipe: any) => ({
        ...recipe,
        ingredients: typeof recipe.ingredients === 'string' 
          ? JSON.parse(recipe.ingredients) 
          : recipe.ingredients,
        steps: typeof recipe.steps === 'string' 
          ? JSON.parse(recipe.steps) 
          : recipe.steps,
      }))

      setRecipes(parsedRecipes)
    } catch (error) {
      console.error('Error loading recipes:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateRecipe = async () => {
    setGenerating(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      // Get inventory
      const { data: inventory } = await supabase
        .from('inventory')
        .select('*')
        .eq('user_id', user.id)

      // Get preferences
      const { data: preferences } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single()

      const inventoryItems = (inventory || []).map((item: any) => ({
        name: item.name,
        quantity: item.quantity,
        category: item.category,
      }))

      const response = await fetch('/api/generate-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inventoryItems,
          preferences: preferences?.preferences_summary,
        }),
      })

      if (!response.ok) throw new Error('Failed to generate recipe')

      const recipeData = await response.json()
      setAiRecipe(recipeData)
    } catch (error) {
      console.error('Error generating recipe:', error)
      alert('レシピの生成に失敗しました')
    } finally {
      setGenerating(false)
    }
  }

  const saveRecipe = async (recipeData: any, sourceType: string) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase.from('recipes').insert({
        user_id: user.id,
        title: recipeData.title,
        description: recipeData.description || null,
        ingredients: recipeData.ingredients || [],
        steps: recipeData.steps || [],
        calories: recipeData.calories || null,
        image_url: recipeData.image_url || null,
        source_type: sourceType,
        is_favorite: false,
      })

      if (error) throw error

      setAddRecipeDialogOpen(false)
      loadRecipes()
    } catch (error) {
      console.error('Error saving recipe:', error)
      alert('レシピの保存に失敗しました')
    }
  }

  const addToShoppingList = async (items: string[]) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const itemsToInsert = items.map((item) => ({
        user_id: user.id,
        item_name: item,
        is_checked: false,
      }))

      const { error } = await supabase.from('shopping_list').insert(itemsToInsert)

      if (error) throw error
      alert('買い物リストに追加しました')
    } catch (error) {
      console.error('Error adding to shopping list:', error)
      alert('買い物リストへの追加に失敗しました')
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
          <h1 className="text-3xl font-bold">レシピ</h1>
          <Button onClick={() => setAddRecipeDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            レシピを追加
          </Button>
        </div>

        <Tabs defaultValue="ai" className="space-y-4">
          <TabsList>
            <TabsTrigger value="ai">AI提案</TabsTrigger>
            <TabsTrigger value="my">Myレシピ</TabsTrigger>
          </TabsList>

          <TabsContent value="ai" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>AIレシピ提案</CardTitle>
                <CardDescription>
                  冷蔵庫の在庫から最適なレシピを提案します
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={generateRecipe} disabled={generating}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  {generating ? '生成中...' : 'レシピを生成'}
                </Button>

                {aiRecipe && (
                  <div className="mt-6 space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>{aiRecipe.title}</CardTitle>
                        <CardDescription>{aiRecipe.description}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <h3 className="font-semibold mb-2">使用する食材</h3>
                          <ul className="list-disc list-inside">
                            {aiRecipe.ingredients_available?.map(
                              (ing: string, i: number) => (
                                <li key={i}>{ing}</li>
                              )
                            )}
                          </ul>
                        </div>

                        {aiRecipe.ingredients_missing &&
                          aiRecipe.ingredients_missing.length > 0 && (
                            <div>
                              <h3 className="font-semibold mb-2">
                                買い足す食材
                              </h3>
                              <ul className="list-disc list-inside">
                                {aiRecipe.ingredients_missing.map(
                                  (ing: string, i: number) => (
                                    <li key={i}>{ing}</li>
                                  )
                                )}
                              </ul>
                              <Button
                                className="mt-2"
                                variant="outline"
                                onClick={() =>
                                  addToShoppingList(aiRecipe.ingredients_missing)
                                }
                              >
                                <ShoppingCart className="h-4 w-4 mr-2" />
                                買い物リストに追加
                              </Button>
                            </div>
                          )}

                        <div>
                          <h3 className="font-semibold mb-2">作り方</h3>
                          <ol className="list-decimal list-inside space-y-1">
                            {aiRecipe.steps?.map((step: string, i: number) => (
                              <li key={i}>{step}</li>
                            ))}
                          </ol>
                        </div>

                        {aiRecipe.calories && (
                          <p className="text-sm text-gray-600">
                            カロリー: {aiRecipe.calories}
                          </p>
                        )}

                        {aiRecipe.nutrition_tips && (
                          <div className="bg-blue-50 p-3 rounded">
                            <p className="text-sm">{aiRecipe.nutrition_tips}</p>
                          </div>
                        )}

                        <Button
                          onClick={() => saveRecipe(aiRecipe, 'ai_generated')}
                        >
                          レシピを保存
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="my" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recipes.map((recipe) => (
                <Card key={recipe.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle>{recipe.title}</CardTitle>
                        <CardDescription>{recipe.description}</CardDescription>
                      </div>
                      {recipe.is_favorite && (
                        <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div>
                        <h4 className="font-semibold text-sm">材料</h4>
                        <ul className="text-sm text-gray-600">
                          {recipe.ingredients.map((ing, i) => (
                            <li key={i}>
                              {ing.name}: {ing.quantity}
                            </li>
                          ))}
                        </ul>
                      </div>
                      {recipe.calories && (
                        <p className="text-sm text-gray-600">
                          カロリー: {recipe.calories}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {recipes.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">レシピがありません</p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Add Recipe Dialog */}
        <Dialog open={addRecipeDialogOpen} onOpenChange={setAddRecipeDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>レシピを追加</DialogTitle>
              <DialogDescription>
                手動入力、URL/テキスト解析、画像解析から選択してください
              </DialogDescription>
            </DialogHeader>
            <Tabs value={addMode} onValueChange={(v) => setAddMode(v as any)}>
              <TabsList>
                <TabsTrigger value="manual">手動</TabsTrigger>
                <TabsTrigger value="url">URL/テキスト</TabsTrigger>
                <TabsTrigger value="image">画像</TabsTrigger>
              </TabsList>
              <TabsContent value="manual">
                <ManualRecipeForm onSave={(data) => saveRecipe(data, 'manual')} />
              </TabsContent>
              <TabsContent value="url">
                <URLRecipeForm onSave={(data) => saveRecipe(data, 'url_import')} />
              </TabsContent>
              <TabsContent value="image">
                <ImageRecipeForm onSave={(data) => saveRecipe(data, 'ocr_import')} />
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}

function ManualRecipeForm({ onSave }: { onSave: (data: any) => void }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [ingredients, setIngredients] = useState('')
  const [steps, setSteps] = useState('')
  const [calories, setCalories] = useState('')

  const handleSubmit = () => {
    const ingredientsArray = ingredients
      .split('\n')
      .map((line) => {
        const [name, quantity] = line.split(':').map((s) => s.trim())
        return { name, quantity: quantity || '' }
      })
      .filter((ing) => ing.name)

    const stepsArray = steps.split('\n').filter((s) => s.trim())

    onSave({
      title,
      description,
      ingredients: ingredientsArray,
      steps: stepsArray,
      calories: calories || null,
    })
  }

  return (
    <div className="space-y-4 py-4">
      <div>
        <Label>タイトル</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div>
        <Label>説明</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div>
        <Label>材料（1行1つ、形式: 食材名: 数量）</Label>
        <Textarea
          value={ingredients}
          onChange={(e) => setIngredients(e.target.value)}
          rows={5}
        />
      </div>
      <div>
        <Label>作り方（1行1ステップ）</Label>
        <Textarea
          value={steps}
          onChange={(e) => setSteps(e.target.value)}
          rows={5}
        />
      </div>
      <div>
        <Label>カロリー（任意）</Label>
        <Input value={calories} onChange={(e) => setCalories(e.target.value)} />
      </div>
      <Button onClick={handleSubmit}>保存</Button>
    </div>
  )
}

function URLRecipeForm({ onSave }: { onSave: (data: any) => void }) {
  const [text, setText] = useState('')
  const [parsing, setParsing] = useState(false)

  const handleParse = async () => {
    setParsing(true)
    try {
      const response = await fetch('/api/parse-recipe-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, sourceType: 'url_import' }),
      })

      if (!response.ok) throw new Error('Failed to parse')

      const data = await response.json()
      onSave(data)
    } catch (error) {
      console.error('Error parsing:', error)
      alert('解析に失敗しました')
    } finally {
      setParsing(false)
    }
  }

  return (
    <div className="space-y-4 py-4">
      <div>
        <Label>URLまたはテキスト</Label>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="レシピのURLまたはテキストを貼り付けてください"
          rows={10}
        />
      </div>
      <Button onClick={handleParse} disabled={parsing || !text}>
        {parsing ? '解析中...' : '解析して追加'}
      </Button>
    </div>
  )
}

function ImageRecipeForm({ onSave }: { onSave: (data: any) => void }) {
  const [parsing, setParsing] = useState(false)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setParsing(true)
    try {
      const reader = new FileReader()
      reader.onloadend = async () => {
        const base64String = (reader.result as string).split(',')[1]

        const response = await fetch('/api/parse-recipe-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64String }),
        })

        if (!response.ok) throw new Error('Failed to parse')

        const data = await response.json()
        onSave(data)
      }
      reader.readAsDataURL(file)
    } catch (error) {
      console.error('Error parsing:', error)
      alert('解析に失敗しました')
    } finally {
      setParsing(false)
    }
  }

  return (
    <div className="space-y-4 py-4">
      <div>
        <Label>レシピ画像をアップロード</Label>
        <Input
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          disabled={parsing}
        />
        {parsing && <p className="mt-2 text-sm">解析中...</p>}
      </div>
    </div>
  )
}


