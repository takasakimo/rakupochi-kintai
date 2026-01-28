import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
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

    const searchParams = request.nextUrl.searchParams
    const employeeId = searchParams.get('employee_id')
      ? parseInt(searchParams.get('employee_id')!)
      : undefined
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    // まずattendanceのIDを取得（日付範囲でフィルタ）
    let attendanceIds: number[] | undefined = undefined
    if (startDate || endDate || employeeId) {
      const attendanceWhere: any = {
        companyId: effectiveCompanyId,
      }
      if (employeeId) {
        attendanceWhere.employeeId = employeeId
      }
      if (startDate || endDate) {
        attendanceWhere.date = {}
        if (startDate) {
          attendanceWhere.date.gte = new Date(startDate)
        }
        if (endDate) {
          const end = new Date(endDate)
          end.setHours(23, 59, 59, 999)
          attendanceWhere.date.lte = end
        }
      }
      const attendances = await prisma.attendance.findMany({
        where: attendanceWhere,
        select: { id: true },
      })
      attendanceIds = attendances.map(a => a.id)
      if (attendanceIds.length === 0) {
        return NextResponse.json({ logs: [] })
      }
    }

    const where: any = {
      companyId: effectiveCompanyId,
    }

    if (attendanceIds) {
      where.attendanceId = { in: attendanceIds }
    } else if (employeeId) {
      where.employeeId = employeeId
    }

    // 修正履歴を取得
    const logs = await prisma.attendanceModificationLog.findMany({
      where,
      include: {
        modifier: {
          select: {
            id: true,
            name: true,
            employeeNumber: true,
            email: true,
          },
        },
        attendance: {
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
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 1000, // 最大1000件まで取得
    })

    return NextResponse.json({ logs })
  } catch (error) {
    console.error('Failed to fetch modification logs:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
