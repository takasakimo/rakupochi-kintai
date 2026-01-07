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

const parseRecipeImageSchema = z.object({
  imageBase64: z.string(),
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
    const { imageBase64 } = parseRecipeImageSchema.parse(body)

    // Call OpenAI GPT-4o for image analysis
    const openai = getOpenAI()
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `あなたはレシピ画像を解析する専門家です。画像からレシピ情報を抽出し、以下のJSON形式で返してください。

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
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
      max_tokens: 2000,
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      return NextResponse.json(
        { error: 'Failed to parse recipe image' },
        { status: 500 }
      )
    }

    // Parse JSON from response
    let recipeData
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/\{[\s\S]*\}/)
      const jsonString = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content
      recipeData = JSON.parse(jsonString)
    } catch (error) {
      return NextResponse.json(
        { error: 'Failed to parse AI response', details: content },
        { status: 500 }
      )
    }

    return NextResponse.json(recipeData)
  } catch (error) {
    console.error('Error parsing recipe image:', error)
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


