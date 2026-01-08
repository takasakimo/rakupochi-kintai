import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // 認証チェック
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { address } = body

    if (!address || typeof address !== 'string' || address.trim() === '') {
      return NextResponse.json(
        { error: '住所が指定されていません' },
        { status: 400 }
      )
    }

    // OpenStreetMap Nominatim APIを使用（無料、1秒に1リクエスト制限あり）
    // 日本の住所を優先的に検索するため、countrycodes=jpを指定
    const encodedAddress = encodeURIComponent(address.trim())
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&countrycodes=jp&limit=1&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'Rakupochi-Kintai/1.0', // 必須：User-Agentを設定
        },
      }
    )

    if (!response.ok) {
      console.error('Geocoding failed:', response.status)
      return NextResponse.json(
        { error: '住所の検索に失敗しました' },
        { status: 500 }
      )
    }

    const data = await response.json()

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: '住所が見つかりませんでした' },
        { status: 404 }
      )
    }

    const result = data[0]
    const latitude = parseFloat(result.lat)
    const longitude = parseFloat(result.lon)

    if (isNaN(latitude) || isNaN(longitude)) {
      return NextResponse.json(
        { error: '緯度経度の取得に失敗しました' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      latitude,
      longitude,
      displayName: result.display_name,
    })
  } catch (error) {
    console.error('Geocoding error:', error)
    return NextResponse.json(
      { error: '内部サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}
