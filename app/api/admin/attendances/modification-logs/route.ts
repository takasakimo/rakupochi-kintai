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

    const where: any = {
      companyId: effectiveCompanyId,
    }

    if (employeeId) {
      where.employeeId = employeeId
    }

    // 日付範囲でフィルタリング（attendanceのdateでフィルタ）
    if (startDate || endDate) {
      where.attendance = {
        date: {} as any,
      }
      if (startDate) {
        where.attendance.date.gte = new Date(startDate)
      }
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        where.attendance.date.lte = end
      }
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
