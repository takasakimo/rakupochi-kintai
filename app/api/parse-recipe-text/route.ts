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

const parseRecipeTextSchema = z.object({
  text: z.string(),
  sourceType: z.enum(['url_import', 'ocr_import']),
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
    const { text, sourceType } = parseRecipeTextSchema.parse(body)

    // Call OpenAI GPT-4o-mini for text parsing
    const openai = getOpenAI()
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `あなたはレシピテキストを解析する専門家です。提供されたテキストからレシピ情報を抽出し、以下のJSON形式で返してください。

出力形式:
{
  "title": "料理名",
  "description": "説明（任意）",
  "ingredients": [
    {
      "name": "食材名",
      "quantity": "数量"
    }
  ],
  "steps": ["手順1", "手順2", "手順3"],
  "calories": "カロリー（任意）"
}`,
        },
        {
          role: 'user',
          content: `以下のテキストからレシピ情報を抽出してください:\n\n${text}`,
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 2000,
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      return NextResponse.json(
        { error: 'Failed to parse recipe text' },
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

    return NextResponse.json(recipeData)
  } catch (error) {
    console.error('Error parsing recipe text:', error)
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


