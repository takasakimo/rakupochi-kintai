import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// 管理者による営業先訪問履歴取得
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const where: any = {
      companyId: effectiveCompanyId,
    }

    if (employeeId) {
      where.employeeId = parseInt(employeeId)
    }

    if (startDate || endDate) {
      where.date = {}
      if (startDate) {
        where.date.gte = new Date(startDate)
      }
      if (endDate) {
        where.date.lte = new Date(endDate)
      }
    }

    const visits = await prisma.salesVisit.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            employeeNumber: true,
            department: true,
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
    })

    // 時刻データを文字列形式に変換（通常の打刻と同じロジック）
    const formattedVisits = visits.map((visit) => {
      const formatTime = (time: Date | null): string | null => {
        if (!time) return null
        if (time instanceof Date) {
          const hours = String(time.getUTCHours()).padStart(2, '0')
          const minutes = String(time.getUTCMinutes()).padStart(2, '0')
          const seconds = String(time.getUTCSeconds()).padStart(2, '0')
          return `${hours}:${minutes}:${seconds}`
        }
        return null
      }

      return {
        ...visit,
        entryTime: formatTime(visit.entryTime),
        exitTime: formatTime(visit.exitTime),
      }
    })

    return NextResponse.json({
      success: true,
      visits: formattedVisits,
    })
  } catch (error) {
    console.error('Get admin sales visits error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
