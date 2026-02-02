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

    // スーパー管理者または管理者の判定
    const isSuperAdmin = session.user.role === 'super_admin' || 
                         session.user.email === 'superadmin@rakupochi.com'
    const isAdmin = session.user.role === 'admin'
    
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

    console.log('[Applications] Company ID:', effectiveCompanyId, 'Role:', session.user.role)

    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type')
    const status = searchParams.get('status')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const category = searchParams.get('category')

    console.log('[Applications] Search params:', { type, status, startDate, endDate, category })

    const where: any = {
      companyId: effectiveCompanyId,
    }

    // 従業員は自分の申請のみ閲覧可能（管理者・スーパー管理者は全申請を閲覧可能）
    if (!isAdmin && !isSuperAdmin) {
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

    // ページネーション対応（デフォルト: 最新100件）
    const limit = parseInt(searchParams.get('limit') || '100')
    const skip = parseInt(searchParams.get('skip') || '0')
    const maxLimit = 1000 // 最大1000件まで
    
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
              department: true,
            },
            // 従業員登録申請の場合、employeeIdが0のためemployeeが存在しない可能性がある
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: Math.min(limit, maxLimit),
        skip: skip,
      })
      
      // 従業員登録申請の場合、employeeIdが0のためemployeeがnullになる可能性がある
      // その場合は、contentから申請者情報を取得してemployeeオブジェクトを構築
      applications = applications.map((app) => {
        if (app.type === 'employee_registration' && (!app.employee || app.employeeId === 0)) {
          try {
            const content = JSON.parse(app.content)
            return {
              ...app,
              employee: {
                id: 0,
                name: content.name || '申請者情報なし',
                employeeNumber: '',
                department: null,
              },
            }
          } catch {
            return {
              ...app,
              employee: {
                id: 0,
                name: '申請者情報なし',
                employeeNumber: '',
                department: null,
              },
            }
          }
        }
        return app
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

    // 総件数を取得（ページネーション用）
    const totalCount = await prisma.application.count({ where })
    
    return NextResponse.json({ 
      applications,
      pagination: {
        total: totalCount,
        limit: Math.min(limit, maxLimit),
        skip: skip,
        hasMore: skip + applications.length < totalCount,
      },
    })
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
    const { type, title, content, reason, employeeId, approverId } = body

    if (!type || !content) {
      return NextResponse.json(
        { error: '申請タイプと内容は必須です' },
        { status: 400 }
      )
    }

    // 打刻修正申請の場合は理由が必須
    if (type === 'attendance_correction' && !reason) {
      return NextResponse.json(
        { error: '打刻修正申請の場合は理由を入力してください' },
        { status: 400 }
      )
    }

    // スーパー管理者または管理者の判定
    const isSuperAdmin = session.user.role === 'super_admin' || 
                         session.user.email === 'superadmin@rakupochi.com'
    const isAdmin = session.user.role === 'admin'
    
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

    // 管理者・スーパー管理者は従業員IDを指定可能、従業員は自分のIDのみ
    let targetEmployeeId = parseInt(session.user.id)
    if ((isAdmin || isSuperAdmin) && employeeId) {
      // 管理者が指定した従業員が自社のものであることを確認
      const employee = await prisma.employee.findUnique({
        where: { id: parseInt(employeeId) },
      })
      if (!employee || employee.companyId !== effectiveCompanyId) {
        return NextResponse.json(
          { error: '指定された従業員が見つからないか、権限がありません' },
          { status: 403 }
        )
      }
      targetEmployeeId = parseInt(employeeId)
    }

    // approverIdが指定されている場合、その従業員が自社の管理者であることを確認
    let validatedApproverId = null
    if (approverId) {
      const approver = await prisma.employee.findFirst({
        where: {
          id: parseInt(approverId),
          companyId: effectiveCompanyId,
          role: { in: ['admin', 'super_admin'] },
        },
      })
      if (approver) {
        validatedApproverId = parseInt(approverId)
      }
    }

    const application = await prisma.application.create({
      data: {
        companyId: effectiveCompanyId,
        employeeId: targetEmployeeId,
        type,
        title: title || null,
        content: JSON.stringify(content),
        reason: reason || null,
        approverId: validatedApproverId,
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

