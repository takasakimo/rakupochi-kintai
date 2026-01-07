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

const updatePreferencesSchema = z.object({
  recipeHistory: z.array(
    z.object({
      rating: z.number().min(1).max(5),
      feedback_text: z.string().optional(),
      generated_recipe_json: z.any(),
    })
  ),
  currentPreferences: z.string().optional(),
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
    const { recipeHistory, currentPreferences } =
      updatePreferencesSchema.parse(body)

    // Filter high/low ratings
    const highRatings = recipeHistory.filter((r) => r.rating >= 4)
    const lowRatings = recipeHistory.filter((r) => r.rating <= 2)

    if (highRatings.length === 0 && lowRatings.length === 0) {
      return NextResponse.json({
        message: 'No significant ratings to learn from',
      })
    }

    // Build learning context
    const learningContext = `
高評価レシピ（4以上）:
${highRatings
  .map(
    (r) =>
      `- ${JSON.stringify(r.generated_recipe_json.title)}: ${r.feedback_text || '評価のみ'}`
  )
  .join('\n')}

低評価レシピ（2以下）:
${lowRatings
  .map(
    (r) =>
      `- ${JSON.stringify(r.generated_recipe_json.title)}: ${r.feedback_text || '評価のみ'}`
  )
  .join('\n')}

現在の好み設定: ${currentPreferences || 'なし'}
`

    // Call OpenAI GPT-4o-mini to update preferences
    const openai = getOpenAI()
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `あなたはユーザーの好みを学習する専門家です。レシピの評価履歴を分析し、ユーザーの好みを要約してください。
簡潔で実用的な要約を日本語で返してください。例: "辛い料理が好き。エビはアレルギー。20分以内の時短料理を好む"`,
        },
        {
          role: 'user',
          content: `以下の評価履歴からユーザーの好みを学習してください:\n\n${learningContext}`,
        },
      ],
      max_tokens: 500,
    })

    const newPreferences = response.choices[0]?.message?.content || ''

    // Update user preferences
    await supabase.from('user_preferences').upsert({
      user_id: user.id,
      preferences_summary: newPreferences,
      updated_at: new Date().toISOString(),
    })

    return NextResponse.json({ preferences_summary: newPreferences })
  } catch (error) {
    console.error('Error updating preferences:', error)
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


