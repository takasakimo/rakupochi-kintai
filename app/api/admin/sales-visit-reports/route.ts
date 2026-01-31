import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// 営業先入退店記録レポート生成
export async function GET(request: NextRequest) {
  try {
    console.log('[Sales Visit Reports] GET /api/admin/sales-visit-reports - Starting')
    
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      console.log('[Sales Visit Reports] Unauthorized: no session or user')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // スーパー管理者または管理者のみアクセス可能
    const isSuperAdmin = session.user.role === 'super_admin' || 
                         session.user.email === 'superadmin@rakupochi.com'
    const isAdmin = session.user.role === 'admin'

    if (!isSuperAdmin && !isAdmin) {
      console.log('[Sales Visit Reports] Forbidden: not admin or super admin role')
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

    console.log('[Sales Visit Reports] Company ID:', effectiveCompanyId)

    const searchParams = request.nextUrl.searchParams
    const employeeId = searchParams.get('employee_id')
      ? parseInt(searchParams.get('employee_id')!)
      : undefined
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const month = searchParams.get('month') // YYYY-MM形式

    let start: Date
    let end: Date

    if (month) {
      // 月指定の場合
      const [year, monthNum] = month.split('-').map(Number)
      start = new Date(year, monthNum - 1, 1)
      end = new Date(year, monthNum, 0)
    } else if (startDate && endDate) {
      // 日付範囲指定の場合
      start = new Date(startDate)
      end = new Date(endDate)
    } else {
      // デフォルトで今月
      const now = new Date()
      start = new Date(now.getFullYear(), now.getMonth(), 1)
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    }

    const where: any = {
      companyId: effectiveCompanyId,
      date: {
        gte: start,
        lte: end,
      },
    }

    if (employeeId) {
      where.employeeId = employeeId
    }

    // 営業先訪問データを取得
    console.log('[Sales Visit Reports] Fetching sales visits with where clause:', JSON.stringify(where))
    let salesVisits
    try {
      salesVisits = await prisma.salesVisit.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              name: true,
              employeeNumber: true,
              department: true,
              position: true,
            },
          },
        },
        orderBy: {
          date: 'asc',
        },
      })
      console.log('[Sales Visit Reports] Found sales visits:', salesVisits.length)
    } catch (error: any) {
      console.error('[Sales Visit Reports] Error fetching sales visits:', error)
      return NextResponse.json(
        { 
          error: 'Failed to fetch sales visits',
          details: error?.message || 'Unknown error',
          code: error?.code || 'UNKNOWN',
        },
        { status: 500 }
      )
    }

    // 全期間の訪問回数を取得（累計用）
    const allTimeVisitCounts: Record<number, number> = {}
    try {
      const allTimeWhere: any = {
        companyId: effectiveCompanyId,
        entryTime: { not: null }, // 入店時刻があるもののみ
      }
      if (employeeId) {
        allTimeWhere.employeeId = employeeId
      }

      const allTimeVisits = await prisma.salesVisit.findMany({
        where: allTimeWhere,
        select: {
          employeeId: true,
        },
      })

      allTimeVisits.forEach((visit) => {
        allTimeVisitCounts[visit.employeeId] = (allTimeVisitCounts[visit.employeeId] || 0) + 1
      })
    } catch (error: any) {
      console.error('[Sales Visit Reports] Error fetching all-time visit counts:', error)
      // エラーが発生しても期間内のデータは返す
    }

    // 従業員ごとに集計
    const employeeReports: Record<
      number,
      {
        employee: any
        totalVisits: number // 全期間累計
        totalVisitMinutes: number
        visits: any[]
      }
    > = {}

    salesVisits.forEach((visit) => {
      if (!visit.entryTime) {
        return // 入店時刻がない場合はスキップ
      }

      const empId = visit.employeeId
      if (!employeeReports[empId]) {
        employeeReports[empId] = {
          employee: visit.employee,
          totalVisits: allTimeVisitCounts[empId] || 0, // 全期間累計を設定
          totalVisitMinutes: 0,
          visits: [],
        }
      }

      const report = employeeReports[empId]

      // 時刻を文字列形式に変換
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

      const entryTimeStr = formatTime(visit.entryTime)
      const exitTimeStr = formatTime(visit.exitTime)

      // 滞在時間を計算（退店時刻がある場合のみ）
      let visitMinutes = 0
      if (entryTimeStr && exitTimeStr) {
        const [entryHours, entryMinutes] = entryTimeStr.split(':').map(Number)
        const [exitHours, exitMinutes] = exitTimeStr.split(':').map(Number)
        
        const entryTime = new Date(`2000-01-01T${String(entryHours).padStart(2, '0')}:${String(entryMinutes).padStart(2, '0')}:00`)
        const exitTime = new Date(`2000-01-01T${String(exitHours).padStart(2, '0')}:${String(exitMinutes).padStart(2, '0')}:00`)
        
        // 日をまたぐ場合を考慮
        let exitTimeAdjusted = exitTime
        if (exitTime.getTime() < entryTime.getTime()) {
          exitTimeAdjusted = new Date(`2000-01-02T${String(exitHours).padStart(2, '0')}:${String(exitMinutes).padStart(2, '0')}:00`)
        }
        
        const diffMs = exitTimeAdjusted.getTime() - entryTime.getTime()
        visitMinutes = Math.floor(diffMs / (1000 * 60))
      }

      report.totalVisitMinutes += visitMinutes

      report.visits.push({
        id: visit.id,
        date: visit.date.toISOString().split('T')[0],
        companyName: visit.companyName,
        contactPersonName: visit.contactPersonName,
        purpose: visit.purpose,
        entryTime: entryTimeStr,
        exitTime: exitTimeStr,
        meetingNotes: visit.meetingNotes,
      })
    })

    // 期間内に訪問記録がない従業員も全期間累計を表示するために追加
    // 期間内に訪問記録がない従業員の情報を取得
    if (employeeId) {
      // 特定の従業員が指定されている場合、その従業員の全期間累計を取得
      if (!employeeReports[employeeId] && allTimeVisitCounts[employeeId]) {
        const employee = await prisma.employee.findUnique({
          where: { id: employeeId },
          select: {
            id: true,
            name: true,
            employeeNumber: true,
            department: true,
            position: true,
          },
        })
        if (employee) {
          employeeReports[employeeId] = {
            employee,
            totalVisits: allTimeVisitCounts[employeeId],
            totalVisitMinutes: 0,
            visits: [],
          }
        }
      }
    }

    // 配列形式に変換
    const reports = Object.values(employeeReports).map((report) => ({
      employee: report.employee,
      totalVisits: report.totalVisits, // 全期間累計
      totalVisitHours: Math.floor(report.totalVisitMinutes / 60),
      totalVisitMinutes: report.totalVisitMinutes % 60,
      visits: report.visits,
    }))

    console.log('[Sales Visit Reports] Returning reports:', reports.length)
    return NextResponse.json({
      reports,
      period: {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
      },
    })
  } catch (error: any) {
    console.error('[Sales Visit Reports] Get reports error:', error)
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
