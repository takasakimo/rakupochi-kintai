import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// 管理者による営業先退店記録
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // スーパー管理者または管理者のみアクセス可能
    const isSuperAdmin = session.user.role === 'super_admin' || 
                         session.user.email === 'superadmin@rakupochi.com'
    const isAdmin = session.user.role === 'admin'

    if (!isSuperAdmin && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // スーパー管理者の場合はselectedCompanyIdを使用、通常の管理者の場合はcompanyIdを使用
    const effectiveCompanyId = isSuperAdmin 
      ? session.user.selectedCompanyId 
      : session.user.companyId

    if (!effectiveCompanyId) {
      return NextResponse.json(
        { error: isSuperAdmin ? '企業が選択されていません' : 'Company ID not found' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { time, date, visitId, meetingNotes, location } = body

    if (!time || !date || !visitId) {
      return NextResponse.json(
        { error: 'Time, date and visit ID are required' },
        { status: 400 }
      )
    }

    if (meetingNotes && meetingNotes.length > 1000) {
      return NextResponse.json(
        { error: 'Meeting notes must be 1000 characters or less' },
        { status: 400 }
      )
    }

    // 訪問レコードが存在し、自社のものであることを確認
    const existingVisit = await prisma.salesVisit.findFirst({
      where: {
        id: parseInt(visitId),
        companyId: effectiveCompanyId,
        entryTime: { not: null },
        exitTime: null,
      },
    })

    if (!existingVisit) {
      return NextResponse.json(
        { error: 'Visit not found or already exited' },
        { status: 404 }
      )
    }

    const exitTime = new Date(`2000-01-01T${time}`)

    // 位置情報を保存（オプション）
    const locationData = location && location.latitude && location.longitude
      ? {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy || null,
        }
      : null

    // 退店情報を更新
    const salesVisit = await prisma.salesVisit.update({
      where: { id: parseInt(visitId) },
      data: {
        exitTime,
        exitLocation: locationData as any,
        meetingNotes: meetingNotes?.trim() || null,
      },
    })

    return NextResponse.json({
      success: true,
      salesVisit,
      location: locationData,
    })
  } catch (error) {
    console.error('Admin sales visit exit error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
