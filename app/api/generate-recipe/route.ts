import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'

const getOpenAI = () => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured')
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
}

const generateRecipeSchema = z.object({
  inventoryItems: z.array(
    z.object({
      name: z.string(),
      quantity: z.string(),
      category: z.string(),
    })
  ),
  preferences: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { inventoryItems, preferences } = generateRecipeSchema.parse(body)

    // Build inventory summary
    const inventorySummary = inventoryItems
      .map((item) => `${item.name} (${item.quantity})`)
      .join(', ')

    // Call OpenAI GPT-4o-mini for recipe generation
    const openai = getOpenAI()
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `あなたはプロの栄養士シェフです。ユーザーの冷蔵庫の中身と好みを考慮し、レシピを提案してください。
以下のJSON形式で出力してください。

出力形式:
{
  "title": "料理名",
  "description": "魅力的な説明",
  "ingredients_available": ["在庫から使う食材1", "在庫から使う食材2"],
  "ingredients_missing": ["買い足す必要がある食材1", "買い足す必要がある食材2"],
  "steps": ["手順1", "手順2", "手順3"],
  "calories": "500kcal",
  "nutrition_tips": "栄養アドバイス"
}`,
        },
        {
          role: 'user',
          content: `冷蔵庫にある食材: ${inventorySummary}
${preferences ? `ユーザーの好み: ${preferences}` : ''}

上記の食材を使って、美味しいレシピを提案してください。`,
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 2000,
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      return NextResponse.json(
        { error: 'Failed to generate recipe' },
        { status: 500 }
      )
    }

    let recipeData
    try {
      recipeData = JSON.parse(content)
    } catch (error) {
      return NextResponse.json(
        { error: 'Failed to parse AI response' },
        { status: 500 }
      )
    }

    // Save to recipe_history
    await supabase.from('recipe_history').insert({
      user_id: user.id,
      generated_recipe_json: recipeData,
    })

    return NextResponse.json(recipeData)
  } catch (error) {
    console.error('Error generating recipe:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


