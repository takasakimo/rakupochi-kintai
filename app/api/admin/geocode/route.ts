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

    const encodedAddress = encodeURIComponent(address.trim())
    
    // 方法1: OpenStreetMap Nominatim APIを試す
    try {
      const nominatimResponse = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&countrycodes=jp&limit=1&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'Rakupochi-Kintai/1.0',
          },
        }
      )

      if (nominatimResponse.ok) {
        const nominatimData = await nominatimResponse.json()
        if (nominatimData && nominatimData.length > 0) {
          const result = nominatimData[0]
          const latitude = parseFloat(result.lat)
          const longitude = parseFloat(result.lon)

          if (!isNaN(latitude) && !isNaN(longitude)) {
            return NextResponse.json({
              success: true,
              latitude,
              longitude,
              displayName: result.display_name,
            })
          }
        }
      }
    } catch (error) {
      console.log('Nominatim failed, trying alternative service:', error)
    }

    // 方法2: Geocoding.jpを試す（日本の住所に特化）
    try {
      const geocodingResponse = await fetch(
        `https://www.geocoding.jp/api/?q=${encodedAddress}`,
        {
          headers: {
            'User-Agent': 'Rakupochi-Kintai/1.0',
          },
        }
      )

      if (geocodingResponse.ok) {
        const xmlText = await geocodingResponse.text()
        
        // XMLをパースして緯度経度を取得
        const latMatch = xmlText.match(/<lat>([^<]+)<\/lat>/)
        const lngMatch = xmlText.match(/<lng>([^<]+)<\/lng>/)
        
        if (latMatch && lngMatch) {
          const latitude = parseFloat(latMatch[1])
          const longitude = parseFloat(lngMatch[1])

          if (!isNaN(latitude) && !isNaN(longitude)) {
            return NextResponse.json({
              success: true,
              latitude,
              longitude,
              displayName: address,
            })
          }
        }
      }
    } catch (error) {
      console.log('Geocoding.jp failed:', error)
    }

    // 方法3: より詳細な検索を試す（都道府県名を追加）
    try {
      // 都道府県名が含まれていない場合、より広範囲で検索
      const broadSearchResponse = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=5&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'Rakupochi-Kintai/1.0',
          },
        }
      )

      if (broadSearchResponse.ok) {
        const broadData = await broadSearchResponse.json()
        if (broadData && broadData.length > 0) {
          // 最初の結果を使用
          const result = broadData[0]
          const latitude = parseFloat(result.lat)
          const longitude = parseFloat(result.lon)

          if (!isNaN(latitude) && !isNaN(longitude)) {
            return NextResponse.json({
              success: true,
              latitude,
              longitude,
              displayName: result.display_name,
            })
          }
        }
      }
    } catch (error) {
      console.log('Broad search failed:', error)
    }

    // すべての方法が失敗した場合
    return NextResponse.json(
      { success: false, error: '住所が見つかりませんでした。手動で緯度経度を入力してください。' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Geocoding error:', error)
    return NextResponse.json(
      { error: '内部サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}
