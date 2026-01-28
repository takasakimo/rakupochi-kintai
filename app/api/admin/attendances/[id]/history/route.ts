import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const attendanceId = parseInt(params.id)
    if (isNaN(attendanceId)) {
      return NextResponse.json({ error: 'Invalid attendance ID' }, { status: 400 })
    }

    // 打刻データが存在し、同じ会社のものか確認
    const attendance = await prisma.attendance.findFirst({
      where: {
        id: attendanceId,
        companyId: effectiveCompanyId,
      },
    })

    if (!attendance) {
      return NextResponse.json({ error: 'Attendance not found' }, { status: 404 })
    }

    // 修正履歴を取得
    const logs = await prisma.attendanceModificationLog.findMany({
      where: {
        attendanceId: attendanceId,
        companyId: effectiveCompanyId,
      },
      include: {
        modifier: {
          select: {
            id: true,
            name: true,
            employeeNumber: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({ logs })
  } catch (error) {
    console.error('Failed to fetch attendance modification logs:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
