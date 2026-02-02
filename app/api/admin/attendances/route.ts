import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    console.log('[Attendances] GET /api/admin/attendances - Starting')
    
    const { searchParams } = new URL(request.url)
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      console.log('[Attendances] Unauthorized: no session or user')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // スーパー管理者または管理者のみアクセス可能
    const isSuperAdmin = session.user.role === 'super_admin' || 
                         session.user.email === 'superadmin@rakupochi.com'
    const isAdmin = session.user.role === 'admin'

    if (!isSuperAdmin && !isAdmin) {
      console.log('[Attendances] Forbidden: not admin or super admin role')
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

    console.log('[Attendances] Company ID:', effectiveCompanyId)

    const searchParams = request.nextUrl.searchParams
    const employeeId = searchParams.get('employee_id')
      ? parseInt(searchParams.get('employee_id')!)
      : undefined
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    const where: any = {
      companyId: effectiveCompanyId,
      // isDeletedがtrueでないデータを取得（falseとnullの両方を含む）
      isDeleted: { not: true },
    }

    if (employeeId) {
      where.employeeId = employeeId
    }

    if (startDate || endDate) {
      where.date = {}
      if (startDate) {
        where.date.gte = new Date(startDate)
      }
      if (endDate) {
        // 終了日は23:59:59まで含める
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        where.date.lte = end
      }
    }
    // 日付範囲が指定されていない場合は最新100件のみ取得（パフォーマンス最適化）
    // ページネーション対応
    const limit = parseInt(searchParams.get('limit') || '100')
    const skip = parseInt(searchParams.get('skip') || '0')
    const maxLimit = 1000 // 最大1000件まで
    
    // 日付範囲が指定されていない場合は最新のデータのみ取得
    if (!startDate && !endDate) {
      where.date = {
        gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 過去90日間のみ
      }
    }

    console.log('[Attendances] Where clause:', JSON.stringify(where))

    let attendances
    try {
      attendances = await prisma.attendance.findMany({
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
        take: Math.min(limit, maxLimit),
        skip: skip,
      })
      console.log('[Attendances] Found attendances:', attendances.length)
    } catch (error: any) {
      console.error('[Attendances] Error fetching attendances:', error)
      console.error('[Attendances] Error name:', error?.name)
      console.error('[Attendances] Error code:', error?.code)
      console.error('[Attendances] Error message:', error?.message)
      if (error?.stack) {
        console.error('[Attendances] Error stack:', error.stack.substring(0, 500))
      }
      return NextResponse.json(
        { 
          error: 'Failed to fetch attendances',
          details: error?.message || 'Unknown error',
          code: error?.code || 'UNKNOWN',
        },
        { status: 500 }
      )
    }
    
    // 時刻データを文字列形式に変換
    const formattedAttendances = attendances.map((attendance) => {
      const formatTime = (time: Date | null): string | null => {
        if (!time) return null
        try {
          // Date型の場合
          if (time instanceof Date) {
            const hours = time.getHours().toString().padStart(2, '0')
            const minutes = time.getMinutes().toString().padStart(2, '0')
            const seconds = time.getSeconds().toString().padStart(2, '0')
            return `${hours}:${minutes}:${seconds}`
          }
          // 文字列の場合
          if (typeof time === 'string') {
            return time
          }
          return null
        } catch (e) {
          console.error('[Attendances] Error formatting time:', e)
          return null
        }
      }

      return {
        ...attendance,
        wakeUpTime: formatTime(attendance.wakeUpTime),
        departureTime: formatTime(attendance.departureTime),
        clockIn: formatTime(attendance.clockIn),
        clockOut: formatTime(attendance.clockOut),
      }
    })
    
    // 総件数を取得（ページネーション用）
    const totalCount = await prisma.attendance.count({ where })
    
    return NextResponse.json({ 
      attendances: formattedAttendances,
      pagination: {
        total: totalCount,
        limit: Math.min(limit, maxLimit),
        skip: skip,
        hasMore: skip + attendances.length < totalCount,
      },
    })
  } catch (error: any) {
    console.error('[Attendances] Get attendances error:', error)
    console.error('[Attendances] Error name:', error?.name)
    console.error('[Attendances] Error message:', error?.message)
    console.error('[Attendances] Error code:', error?.code)
    if (error?.stack) {
      console.error('[Attendances] Error stack:', error.stack.substring(0, 500))
    }
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error?.message || 'Unknown error',
        code: error?.code || 'UNKNOWN',
      },
      { status: 500 }
    )
  }
}

