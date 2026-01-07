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

const analyzeReceiptSchema = z.object({
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
    const { imageBase64 } = analyzeReceiptSchema.parse(body)

    // Call OpenAI GPT-4o for image analysis
    const openai = getOpenAI()
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `あなたはレシート画像を解析する専門家です。レシートから食材情報を抽出し、以下のJSON形式で返してください。
各食材について、名前、数量、カテゴリ（肉、野菜、調味料、乳製品、その他）、推定消費期限（購入日から推測）を含めてください。

出力形式:
{
  "items": [
    {
      "name": "食材名",
      "quantity": "数量（例: 2個、300g）",
      "category": "カテゴリ",
      "expiry_estimation": "YYYY-MM-DD形式の日付"
    }
  ]
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
        { error: 'Failed to analyze receipt' },
        { status: 500 }
      )
    }

    // Parse JSON from response
    let parsedData
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/\{[\s\S]*\}/)
      const jsonString = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content
      parsedData = JSON.parse(jsonString)
    } catch (error) {
      return NextResponse.json(
        { error: 'Failed to parse AI response', details: content },
        { status: 500 }
      )
    }

    return NextResponse.json({ items: parsedData.items || [] })
  } catch (error) {
    console.error('Error analyzing receipt:', error)
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


