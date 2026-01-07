import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// 申請一覧取得
export async function GET(request: NextRequest) {
  try {
    console.log('[Applications] GET /api/applications - Starting')
    
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      console.log('[Applications] Unauthorized: no session or user')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[Applications] Company ID:', session.user.companyId, 'Role:', session.user.role)

    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type')
    const status = searchParams.get('status')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const category = searchParams.get('category')

    console.log('[Applications] Search params:', { type, status, startDate, endDate, category })

    const where: any = {
      companyId: session.user.companyId,
    }

    // 従業員は自分の申請のみ閲覧可能
    if (session.user.role !== 'admin') {
      where.employeeId = parseInt(session.user.id)
      console.log('[Applications] Employee ID filter:', where.employeeId)
    }

    if (type) {
      where.type = type
    }

    if (status) {
      where.status = status
    }

    // 申請日の範囲検索（指定がない場合は全期間を取得）
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) {
        where.createdAt.gte = new Date(startDate)
      }
      if (endDate) {
        // 終了日は23:59:59まで含める
        const endDateTime = new Date(endDate)
        endDateTime.setHours(23, 59, 59, 999)
        where.createdAt.lte = endDateTime
      }
    }
    // 日付範囲が指定されていない場合は全期間を取得（過去履歴も含む）

    console.log('[Applications] Where clause:', JSON.stringify(where))

    let applications
    try {
      applications = await prisma.application.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              name: true,
              employeeNumber: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      })
      console.log('[Applications] Found applications:', applications.length)
    } catch (error: any) {
      console.error('[Applications] Error fetching applications:', error)
      console.error('[Applications] Error name:', error?.name)
      console.error('[Applications] Error code:', error?.code)
      console.error('[Applications] Error message:', error?.message)
      if (error?.stack) {
        console.error('[Applications] Error stack:', error.stack.substring(0, 500))
      }
      return NextResponse.json(
        { 
          error: 'Failed to fetch applications',
          details: error?.message || 'Unknown error',
          code: error?.code || 'UNKNOWN',
        },
        { status: 500 }
      )
    }

    // カテゴリ検索（JSONフィールドのため、取得後にフィルタリング）
    if (category && (type === 'expense_advance' || !type)) {
      applications = applications.filter((app) => {
        try {
          const content = JSON.parse(app.content)
          return content.category === category
        } catch {
          return false
        }
      })
      console.log('[Applications] After category filter:', applications.length)
    }

    return NextResponse.json({ applications })
  } catch (error: any) {
    console.error('[Applications] Get applications error:', error)
    console.error('[Applications] Error name:', error?.name)
    console.error('[Applications] Error message:', error?.message)
    console.error('[Applications] Error code:', error?.code)
    if (error?.stack) {
      console.error('[Applications] Error stack:', error.stack.substring(0, 500))
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

// 申請作成
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { type, title, content, reason, employeeId } = body

    if (!type || !content) {
      return NextResponse.json(
        { error: '申請タイプと内容は必須です' },
        { status: 400 }
      )
    }

    // 打刻修正申請の場合は理由が必須
    if (type === 'attendance_correction' && (!reason || reason.length < 10)) {
      return NextResponse.json(
        { error: '打刻修正申請の場合は理由を10文字以上入力してください' },
        { status: 400 }
      )
    }

    // 管理者は従業員IDを指定可能、従業員は自分のIDのみ
    let targetEmployeeId = parseInt(session.user.id)
    if (session.user.role === 'admin' && employeeId) {
      // 管理者が指定した従業員が自社のものであることを確認
      const employee = await prisma.employee.findUnique({
        where: { id: parseInt(employeeId) },
      })
      if (!employee || employee.companyId !== session.user.companyId) {
        return NextResponse.json(
          { error: '指定された従業員が見つからないか、権限がありません' },
          { status: 403 }
        )
      }
      targetEmployeeId = parseInt(employeeId)
    }

    const application = await prisma.application.create({
      data: {
        companyId: session.user.companyId,
        employeeId: targetEmployeeId,
        type,
        title: title || null,
        content: JSON.stringify(content),
        reason: reason || null,
        status: 'pending',
      },
    })

    return NextResponse.json({ success: true, application })
  } catch (error) {
    console.error('Create application error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

