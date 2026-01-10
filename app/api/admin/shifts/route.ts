import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// シフト一覧取得
export async function GET(request: NextRequest) {
  try {
    console.log('[Shifts] GET /api/admin/shifts - Starting')
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      console.log('[Shifts] Unauthorized: no session')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // スーパー管理者または管理者のみアクセス可能
    const isSuperAdmin = session.user.role === 'super_admin' || 
                         session.user.email === 'superadmin@rakupochi.com'
    const isAdmin = session.user.role === 'admin'

    if (!isSuperAdmin && !isAdmin) {
      console.log('[Shifts] Forbidden: not admin or super admin')
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

    console.log('[Shifts] Query params:', { employeeId, startDate, endDate, companyId: effectiveCompanyId})

    const where: any = {
      companyId: effectiveCompanyId
    }

    if (employeeId) {
      where.employeeId = employeeId
    }

    if (startDate || endDate) {
      where.date = {}
      if (startDate) {
        // 日付文字列からUTCの正午に設定（タイムゾーンの問題を回避）
        const [year, month, day] = startDate.split('-').map(Number)
        where.date.gte = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0))
      }
      if (endDate) {
        // 日付文字列からUTCの正午に設定（タイムゾーンの問題を回避）
        const [year, month, day] = endDate.split('-').map(Number)
        where.date.lte = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999))
      }
    }
    // 日付範囲が指定されていない場合は全期間を取得（過去履歴も含む）

    console.log('[Shifts] Where clause:', JSON.stringify(where, null, 2))

    const shifts = await prisma.shift.findMany({
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
        date: 'asc',
      },
    })

    // startTimeとendTimeをHH:mm形式の文字列に変換
    // 日付も文字列形式に変換（タイムゾーンの問題を回避）
    const formattedShifts = shifts.map((shift) => {
      let startTimeStr = ''
      let endTimeStr = ''
      
      // startTimeの処理
      if (shift.startTime) {
        const startTime = shift.startTime as any
        if (startTime instanceof Date) {
          const hours = startTime.getUTCHours()
          const minutes = startTime.getUTCMinutes()
          startTimeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
        } else if (typeof startTime === 'string') {
          startTimeStr = startTime.slice(0, 5)
        }
      }
      
      // endTimeの処理
      if (shift.endTime) {
        const endTime = shift.endTime as any
        if (endTime instanceof Date) {
          const hours = endTime.getUTCHours()
          const minutes = endTime.getUTCMinutes()
          endTimeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
        } else if (typeof endTime === 'string') {
          endTimeStr = endTime.slice(0, 5)
        }
      }

      // 日付を文字列形式に変換
      // 重要: PostgreSQLのDATE型はタイムゾーン情報を持たない
      // PrismaはDateTimeとして扱うが、実際の値はDATE型なので、UTCの00:00:00として解釈される
      // しかし、toISOString()を使うとUTC時間で変換されるため、JSTで見ると1日前になる可能性がある
      // 解決策: データベースから取得したDateオブジェクトのUTC日付をそのまま使用
      let dateStr = ''
      const shiftDate = shift.date as any
      if (shiftDate instanceof Date) {
        const date = shiftDate
        // UTC時間で日付を取得（データベースのDATE型はUTCの00:00:00として保存される）
        const year = date.getUTCFullYear()
        const month = date.getUTCMonth() + 1
        const day = date.getUTCDate()
        dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      } else if (typeof shiftDate === 'string') {
        dateStr = shiftDate.split('T')[0]
      }

      return {
        ...shift,
        date: dateStr,
        startTime: startTimeStr,
        endTime: endTimeStr,
        directDestination: shift.directDestination || null,
      }
    })

    console.log('[Shifts] Found shifts:', formattedShifts.length)
    return NextResponse.json({ shifts: formattedShifts })
  } catch (error: any) {
    console.error('[Shifts] Get shifts error:', error)
    console.error('[Shifts] Error name:', error?.name)
    console.error('[Shifts] Error message:', error?.message)
    console.error('[Shifts] Error stack:', error?.stack)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error?.message || 'Unknown error',
        name: error?.name || 'Unknown',
      },
      { status: 500 }
    )
  }
}

// シフト作成（個別・一括）
export async function POST(request: NextRequest) {
  try {
    console.log('[Shifts] POST /api/admin/shifts - Starting')
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      console.log('[Shifts] Unauthorized: no session')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // スーパー管理者または管理者のみアクセス可能
    const isSuperAdmin = session.user.role === 'super_admin' || 
                         session.user.email === 'superadmin@rakupochi.com'
    const isAdmin = session.user.role === 'admin'

    if (!isSuperAdmin && !isAdmin) {
      console.log('[Shifts] Forbidden: not admin or super admin')
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
    console.log('[Shifts] Request body:', JSON.stringify(body, null, 2))
    const { shifts } = body // 配列形式で複数のシフトを受け取る

    if (!Array.isArray(shifts) || shifts.length === 0) {
      console.log('[Shifts] Invalid shifts array')
      return NextResponse.json(
        { error: 'Shifts array is required' },
        { status: 400 }
      )
    }

    // バリデーション
    for (const shift of shifts) {
      if (!shift.employeeId || !shift.date) {
        console.log('[Shifts] Missing required fields:', shift)
        return NextResponse.json(
          { error: 'Missing required fields: employeeId and date are required' },
          { status: 400 }
        )
      }
      // 公休の場合はstartTimeとendTimeは不要
      if (!shift.isPublicHoliday && (!shift.startTime || !shift.endTime)) {
        console.log('[Shifts] Missing time fields for non-holiday shift:', shift)
        return NextResponse.json(
          { error: 'Missing required fields: startTime and endTime are required for non-holiday shifts' },
          { status: 400 }
        )
      }
    }

    // 一括作成（既存のシフトを更新、新規は作成）
    const createdShifts = await Promise.all(
      shifts.map(async (shift, index) => {
        try {
          console.log(`[Shifts] Processing shift ${index + 1}/${shifts.length}:`, shift)
          
          // 日付文字列を直接使用（タイムゾーンの問題を回避）
          const shiftDateStr = shift.date // YYYY-MM-DD形式
          const [year, month, day] = shiftDateStr.split('-').map(Number)
          // 重要: PostgreSQLのDATE型は時刻情報を持たない
          // PrismaはDateTimeとして扱うため、UTCの00:00:00として保存される
          // 日付のみを保存するため、UTCの00:00:00に設定（時刻は無視される）
          const shiftDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
          
          const existingShift = await prisma.shift.findFirst({
            where: {
              companyId: effectiveCompanyId,
              employeeId: shift.employeeId,
              date: shiftDate,
            },
          })

          const shiftData: any = {
            breakMinutes: shift.breakMinutes || 0,
            notes: shift.notes || null,
            status: shift.status || 'confirmed',
            isPublicHoliday: shift.isPublicHoliday || false,
            workLocation: shift.workLocation || null,
            workType: shift.workType || null,
            workingHours: shift.workingHours || null,
            timeSlot: shift.timeSlot || null,
            directDestination: shift.directDestination || null,
            approvalNumber: shift.approvalNumber || null,
            leavingLocation: shift.leavingLocation || null,
          }

          // startTimeとendTimeは必須なので、公休の場合でもデフォルト値を設定
          if (shift.isPublicHoliday) {
            // 公休の場合は00:00を設定
            shiftData.startTime = new Date(`2000-01-01T00:00:00`)
            shiftData.endTime = new Date(`2000-01-01T00:00:00`)
          } else {
            // 通常のシフトの場合
            if (shift.startTime) {
              shiftData.startTime = new Date(`2000-01-01T${shift.startTime}`)
            } else {
              shiftData.startTime = new Date(`2000-01-01T00:00:00`)
            }
            if (shift.endTime) {
              shiftData.endTime = new Date(`2000-01-01T${shift.endTime}`)
            } else {
              shiftData.endTime = new Date(`2000-01-01T00:00:00`)
            }
          }

          if (existingShift) {
            return prisma.shift.update({
              where: { id: existingShift.id },
              data: shiftData,
            })
          } else {
            console.log(`[Shifts] Creating new shift`)
            // 日付をDateオブジェクトに変換（UTC時間で作成）
            // 重要: PostgreSQLのDATE型は時刻情報を持たない
            // PrismaはDateTimeとして扱うため、UTCの00:00:00として保存される
            // 日付のみを保存するため、UTCの00:00:00に設定（時刻は無視される）
            const [createYear, createMonth, createDay] = shift.date.split('-').map(Number)
            const createDate = new Date(Date.UTC(createYear, createMonth - 1, createDay, 0, 0, 0, 0))
            
            return prisma.shift.create({
              data: {
                companyId: effectiveCompanyId,
                employeeId: shift.employeeId,
                date: createDate,
                ...shiftData,
              },
            })
          }
        } catch (shiftError: any) {
          console.error(`[Shifts] Error processing shift ${index + 1}:`, shiftError)
          throw shiftError
        }
      })
    )

    console.log('[Shifts] Successfully created/updated shifts:', createdShifts.length)
    return NextResponse.json({
      success: true,
      shifts: createdShifts,
    })
  } catch (error: any) {
    console.error('[Shifts] Create shifts error:', error)
    console.error('[Shifts] Error name:', error?.name)
    console.error('[Shifts] Error message:', error?.message)
    console.error('[Shifts] Error code:', error?.code)
    console.error('[Shifts] Error stack:', error?.stack)
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Duplicate shift entry' },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error?.message || 'Unknown error',
        name: error?.name || 'Unknown',
        code: error?.code || 'Unknown',
      },
      { status: 500 }
    )
  }
}

