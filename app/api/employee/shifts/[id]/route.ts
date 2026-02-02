import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// 従業員が自分のシフトを更新
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const id = parseInt(params.id)
    const employeeId = parseInt(session.user.id)
    const body = await request.json()

    // シフトが存在し、かつ自分のシフトであることを確認
    const shift = await prisma.shift.findFirst({
      where: {
        id,
        companyId: session.user.companyId,
        employeeId: employeeId, // 自分のシフトのみ
      },
    })

    if (!shift) {
      return NextResponse.json({ 
        error: 'Shift not found or you do not have permission to edit this shift' 
      }, { status: 404 })
    }

    // 日付をUTCで処理
    let shiftDate: Date | undefined
    if (body.date) {
      const dateStr = typeof body.date === 'string' ? body.date : body.date
      const [year, month, day] = dateStr.split('-').map(Number)
      shiftDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
    }

    // 公休に設定する場合は、時間関連のフィールドを自動的にクリア
    const isPublicHoliday = body.isPublicHoliday !== undefined 
      ? body.isPublicHoliday 
      : body.workType === '公休'
      ? true
      : shift.isPublicHoliday

    const updateData: any = {
      ...(shiftDate && { date: shiftDate }),
      ...(body.notes !== undefined && { notes: body.notes }),
      ...(body.isPublicHoliday !== undefined && {
        isPublicHoliday: body.isPublicHoliday,
      }),
      ...(body.workLocation !== undefined && {
        workLocation: body.workLocation,
      }),
      ...(body.workType !== undefined && {
        workType: body.workType,
      }),
      ...(body.directDestination !== undefined && {
        directDestination: body.directDestination,
      }),
      ...(body.approvalNumber !== undefined && {
        approvalNumber: body.approvalNumber,
      }),
      ...(body.leavingLocation !== undefined && {
        leavingLocation: body.leavingLocation,
      }),
    }

    // 有給休暇の使用状況を確認
    const isPaidLeave = body.workType === '有給休暇'
    const wasPaidLeave = shift.workType === '有給休暇'

    // workTypeが'公休'の場合はisPublicHolidayもtrueにする
    if (body.workType === '公休') {
      updateData.isPublicHoliday = true
    }

    // 公休・有給休暇の場合は時間関連を強制的にnull/0にする
    if (isPublicHoliday === true || body.workType === '公休' || body.workType === '有給休暇') {
      updateData.startTime = null
      updateData.endTime = null
      updateData.breakMinutes = 0
      updateData.workingHours = null
      updateData.timeSlot = null
    } else {
      // 公休でない場合のみ時間関連を更新
      if (body.startTime !== undefined) {
        updateData.startTime = body.startTime === null || body.startTime === '' 
          ? null 
          : new Date(`2000-01-01T${body.startTime}`)
      }
      if (body.endTime !== undefined) {
        updateData.endTime = body.endTime === null || body.endTime === '' 
          ? null 
          : new Date(`2000-01-01T${body.endTime}`)
      }
      if (body.breakMinutes !== undefined) {
        updateData.breakMinutes = body.breakMinutes
      }
      if (body.workingHours !== undefined) {
        updateData.workingHours = body.workingHours
      }
      if (body.timeSlot !== undefined) {
        updateData.timeSlot = body.timeSlot
      }
    }

    // 更新を実行
    try {
      const updatedShift = await prisma.shift.update({
        where: { id },
        data: updateData,
      })

      // 有給残数の更新処理
      if (isPaidLeave && !wasPaidLeave) {
        // 新規に有給休暇を使用する場合：残数を1日減らす
        const employee = await prisma.employee.findUnique({
          where: { id: shift.employeeId },
          select: { id: true, paidLeaveBalance: true },
        })
        if (employee) {
          const newBalance = Math.max(0, employee.paidLeaveBalance - 1)
          await prisma.employee.update({
            where: { id: shift.employeeId },
            data: { paidLeaveBalance: newBalance },
          })
          console.log(`[Employee Shifts] Reduced paid leave balance for employee ${shift.employeeId}: ${employee.paidLeaveBalance} -> ${newBalance}`)
        }
      } else if (!isPaidLeave && wasPaidLeave) {
        // 有給休暇を解除する場合：残数を1日戻す
        const employee = await prisma.employee.findUnique({
          where: { id: shift.employeeId },
          select: { id: true, paidLeaveBalance: true },
        })
        if (employee) {
          const newBalance = employee.paidLeaveBalance + 1
          await prisma.employee.update({
            where: { id: shift.employeeId },
            data: { paidLeaveBalance: newBalance },
          })
          console.log(`[Employee Shifts] Restored paid leave balance for employee ${shift.employeeId}: ${employee.paidLeaveBalance} -> ${newBalance}`)
        }
      }

      return NextResponse.json({
        success: true,
        shift: updatedShift,
      })
    } catch (updateError: any) {
      // Null制約違反エラー（P2011）の場合、マイグレーションを実行して再試行
      if (updateError?.code === 'P2011') {
        console.log('Null constraint violation detected (P2011), running migration and retrying...')
        try {
          // マイグレーションを実行（エラーを無視）
          try {
            await prisma.$executeRawUnsafe(`ALTER TABLE shifts ALTER COLUMN "startTime" DROP NOT NULL;`)
          } catch (e: any) {}
          try {
            await prisma.$executeRawUnsafe(`ALTER TABLE shifts ALTER COLUMN "endTime" DROP NOT NULL;`)
          } catch (e: any) {}
          
          console.log('Migration completed, retrying update...')
          
          // マイグレーション後、再度更新を試みる
          const updatedShift = await prisma.shift.update({
            where: { id },
            data: updateData,
          })

          return NextResponse.json({
            success: true,
            shift: updatedShift,
            migrationApplied: true,
          })
        } catch (retryError: any) {
          console.error('Retry after migration failed:', retryError)
          throw updateError
        }
      } else {
        throw updateError
      }
    }
  } catch (error: any) {
    console.error('Update employee shift error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error?.message || 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// 従業員が自分のシフトを削除
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const id = parseInt(params.id)
    const employeeId = parseInt(session.user.id)

    // シフトが存在し、かつ自分のシフトであることを確認
    const shift = await prisma.shift.findFirst({
      where: {
        id,
        companyId: session.user.companyId,
        employeeId: employeeId, // 自分のシフトのみ
      },
    })

    if (!shift) {
      return NextResponse.json({ 
        error: 'Shift not found or you do not have permission to delete this shift' 
      }, { status: 404 })
    }

    // 有給休暇のシフトを削除する場合は残数を戻す
    if (shift.workType === '有給休暇') {
      const employee = await prisma.employee.findUnique({
        where: { id: shift.employeeId },
        select: { id: true, paidLeaveBalance: true },
      })
      if (employee) {
        const newBalance = employee.paidLeaveBalance + 1
        await prisma.employee.update({
          where: { id: shift.employeeId },
          data: { paidLeaveBalance: newBalance },
        })
        console.log(`[Employee Shifts] Restored paid leave balance for employee ${shift.employeeId} after shift deletion: ${employee.paidLeaveBalance} -> ${newBalance}`)
      }
    }

    await prisma.shift.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error('Delete employee shift error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
