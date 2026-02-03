import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// 従業員のシフト一覧取得
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    const where: any = {
      companyId: session.user.companyId,
      employeeId: parseInt(session.user.id),
    }

    if (startDate || endDate) {
      where.date = {}
      if (startDate) {
        where.date.gte = new Date(startDate)
      }
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        where.date.lte = end
      }
    }
    // 日付範囲が指定されていない場合は全期間を取得（過去履歴も含む）

    const shifts = await prisma.shift.findMany({
      where,
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
        isPublicHoliday: shift.isPublicHoliday || false,
        workLocation: shift.workLocation || null,
        workType: shift.workType || null,
        approvalNumber: shift.approvalNumber || null,
        leavingLocation: shift.leavingLocation || null,
      }
    })

    return NextResponse.json({ shifts: formattedShifts })
  } catch (error) {
    console.error('Get employee shifts error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// 従業員が自分のシフトを作成
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 従業員のみアクセス可能（管理者は管理者用APIを使用）
    const isSuperAdmin = session.user.role === 'super_admin' || 
                         session.user.email === 'superadmin@rakupochi.com'
    const isAdmin = session.user.role === 'admin'

    if (isSuperAdmin || isAdmin) {
      return NextResponse.json({ 
        error: '管理者は管理者用APIを使用してください' 
      }, { status: 403 })
    }

    if (!session.user.companyId) {
      return NextResponse.json(
        { error: 'Company ID not found' },
        { status: 400 }
      )
    }

    const employeeId = parseInt(session.user.id)
    const body = await request.json()

    // 一括登録対応: shifts配列が送られてきた場合
    if (body.shifts && Array.isArray(body.shifts)) {
      return await handleBulkCreate(session, employeeId, body.shifts)
    }

    // 単一登録の場合
    // バリデーション
    if (!body.date) {
      return NextResponse.json(
        { error: '日付は必須です' },
        { status: 400 }
      )
    }

    // 公休・有給休暇でない場合は時間が必要
    if (!body.isPublicHoliday && body.workType !== '公休' && body.workType !== '有給休暇') {
      if (!body.startTime || !body.endTime) {
        return NextResponse.json(
          { error: '開始時刻と終了時刻は必須です（公休・有給休暇以外の場合）' },
          { status: 400 }
        )
      }
    }

    // 日付文字列をDateオブジェクトに変換（UTC時間で作成）
    const [year, month, day] = body.date.split('-').map(Number)
    const shiftDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))

    // 既存のシフトを確認
    const existingShift = await prisma.shift.findFirst({
      where: {
        companyId: session.user.companyId,
        employeeId: employeeId,
        date: shiftDate,
      },
    })

    if (existingShift) {
      return NextResponse.json(
        { error: 'この日付のシフトは既に存在します' },
        { status: 409 }
      )
    }

    // 有給休暇の使用状況を確認
    const isPaidLeave = body.workType === '有給休暇'

    // 従業員情報を取得（有給残数の更新用）
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, paidLeaveBalance: true },
    })

    if (!employee) {
      return NextResponse.json(
        { error: '従業員情報が見つかりません' },
        { status: 404 }
      )
    }

    // 有給休暇を使用する場合、残数が0以上であることを確認
    if (isPaidLeave && employee.paidLeaveBalance <= 0) {
      return NextResponse.json(
        { error: '有給休暇の残数が不足しています' },
        { status: 400 }
      )
    }

    const shiftData: any = {
      companyId: session.user.companyId,
      employeeId: employeeId,
      date: shiftDate,
      breakMinutes: body.breakMinutes || 0,
      notes: body.notes || null,
      status: body.status || 'requested', // 従業員が作成したシフトは申請中として扱う
      isPublicHoliday: body.isPublicHoliday || false,
      workLocation: body.workLocation || null,
      workType: body.workType || null,
      workingHours: body.workingHours || null,
      timeSlot: body.timeSlot || null,
      directDestination: body.directDestination || null,
      approvalNumber: body.approvalNumber || null,
      leavingLocation: body.leavingLocation || null,
    }

    // 公休・有給休暇の場合は時間関連をnullにする
    if (body.isPublicHoliday || body.workType === '公休' || isPaidLeave) {
      shiftData.startTime = null
      shiftData.endTime = null
      shiftData.breakMinutes = 0
    } else {
      // 通常のシフトの場合
      if (body.startTime) {
        shiftData.startTime = new Date(`2000-01-01T${body.startTime}`)
      }
      if (body.endTime) {
        shiftData.endTime = new Date(`2000-01-01T${body.endTime}`)
      }
    }

    // シフトを作成
    const createdShift = await prisma.shift.create({
      data: shiftData,
    })

    // 有給残数の更新処理
    if (isPaidLeave) {
      const newBalance = Math.max(0, employee.paidLeaveBalance - 1)
      await prisma.employee.update({
        where: { id: employeeId },
        data: { paidLeaveBalance: newBalance },
      })
      console.log(`[Employee Shifts] Reduced paid leave balance for employee ${employeeId}: ${employee.paidLeaveBalance} -> ${newBalance}`)
    }

    return NextResponse.json({
      success: true,
      shift: createdShift,
    })
  } catch (error: any) {
    console.error('Create employee shift error:', error)
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'この日付のシフトは既に存在します' },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error?.message || 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// 一括登録ハンドラー
async function handleBulkCreate(session: any, employeeId: number, shifts: any[]) {
  try {
    if (!shifts || shifts.length === 0) {
      return NextResponse.json(
        { error: 'Shifts array is required' },
        { status: 400 }
      )
    }

    // 従業員情報を取得（有給残数の更新用）
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, paidLeaveBalance: true },
    })

    if (!employee) {
      return NextResponse.json(
        { error: '従業員情報が見つかりません' },
        { status: 404 }
      )
    }

    // 有給休暇の使用日数をカウント
    const paidLeaveDays = shifts.filter(s => s.workType === '有給休暇').length

    // 有給残数が不足している場合
    if (paidLeaveDays > employee.paidLeaveBalance) {
      return NextResponse.json(
        { error: `有給休暇の残数が不足しています（残数: ${employee.paidLeaveBalance}日、申請: ${paidLeaveDays}日）` },
        { status: 400 }
      )
    }

    // 一括作成（既存のシフトを更新、新規は作成）
    // 有給残数の増減を追跡するため、各シフトを個別に処理
    let currentBalance = employee.paidLeaveBalance
    const createdShifts = await Promise.all(
      shifts.map(async (shift) => {
        try {
          // 日付文字列をDateオブジェクトに変換（UTC時間で作成）
          const [year, month, day] = shift.date.split('-').map(Number)
          const shiftDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))

          // 既存のシフトを確認
          const existingShift = await prisma.shift.findFirst({
            where: {
              companyId: session.user.companyId,
              employeeId: employeeId,
              date: shiftDate,
            },
          })

          // 有給休暇の使用状況を確認
          const isPaidLeave = shift.workType === '有給休暇'
          const wasPaidLeave = existingShift?.workType === '有給休暇'

          const shiftData: any = {
            companyId: session.user.companyId,
            employeeId: employeeId,
            date: shiftDate,
            breakMinutes: shift.breakMinutes || 0,
            notes: shift.notes || null,
            status: 'requested', // 従業員が作成したシフトは申請中として扱う
            isPublicHoliday: shift.isPublicHoliday || false,
            workLocation: shift.workLocation || null,
            workType: shift.workType || null,
            workingHours: shift.workingHours || null,
            timeSlot: shift.timeSlot || null,
            directDestination: shift.directDestination || null,
            approvalNumber: shift.approvalNumber || null,
            leavingLocation: shift.leavingLocation || null,
          }

          // 公休・有給休暇の場合は時間関連をnullにする
          if (shift.isPublicHoliday || shift.workType === '公休' || isPaidLeave) {
            shiftData.startTime = null
            shiftData.endTime = null
            shiftData.breakMinutes = 0
          } else {
            // 通常のシフトの場合
            if (shift.startTime) {
              shiftData.startTime = new Date(`2000-01-01T${shift.startTime}`)
            }
            if (shift.endTime) {
              shiftData.endTime = new Date(`2000-01-01T${shift.endTime}`)
            }
          }

          let updatedShift
          if (existingShift) {
            // 既存のシフトを更新
            updatedShift = await prisma.shift.update({
              where: { id: existingShift.id },
              data: shiftData,
            })

            // 有給残数の更新処理（既存シフトの更新時）
            if (isPaidLeave && !wasPaidLeave) {
              // 新規に有給休暇を使用する場合：残数を1日減らす
              currentBalance = Math.max(0, currentBalance - 1)
            } else if (!isPaidLeave && wasPaidLeave) {
              // 有給休暇を解除する場合：残数を1日戻す
              currentBalance = currentBalance + 1
            }
          } else {
            // 新規シフトを作成
            updatedShift = await prisma.shift.create({
              data: shiftData,
            })

            // 有給残数の更新処理（新規シフト作成時）
            if (isPaidLeave) {
              // 新規に有給休暇を使用する場合：残数を1日減らす
              currentBalance = Math.max(0, currentBalance - 1)
            }
          }

          return updatedShift
        } catch (error: any) {
          console.error('Error creating/updating shift:', error)
          throw error
        }
      })
    )

    // 有給残数を一括で更新
    if (currentBalance !== employee.paidLeaveBalance) {
      await prisma.employee.update({
        where: { id: employeeId },
        data: { paidLeaveBalance: currentBalance },
      })
      console.log(`[Employee Shifts] Updated paid leave balance for employee ${employeeId}: ${employee.paidLeaveBalance} -> ${currentBalance}`)
    }

    return NextResponse.json({
      success: true,
      shifts: createdShifts,
    })
  } catch (error: any) {
    console.error('Bulk create employee shifts error:', error)
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'この日付のシフトは既に存在します' },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error?.message || 'Unknown error',
      },
      { status: 500 }
    )
  }
}
