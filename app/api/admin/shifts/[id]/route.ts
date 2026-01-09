import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// シフト更新
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const id = parseInt(params.id)
    const body = await request.json()

    const shift = await prisma.shift.findFirst({
      where: {
        id,
        companyId: session.user.companyId!
      },
    })

    if (!shift) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
    }

    // 日付をUTCで処理
    let shiftDate: Date | undefined
    if (body.date) {
      const dateStr = typeof body.date === 'string' ? body.date : body.date
      const [year, month, day] = dateStr.split('-').map(Number)
      shiftDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
    }

    // 公休に設定する場合は、時間関連のフィールドを自動的にクリア
    // workTypeが'公休'の場合もisPublicHolidayをtrueにする
    const isPublicHoliday = body.isPublicHoliday !== undefined 
      ? body.isPublicHoliday 
      : body.workType === '公休'
      ? true
      : shift.isPublicHoliday

    const updateData: any = {
      ...(shiftDate && { date: shiftDate }),
      ...(body.notes !== undefined && { notes: body.notes }),
      ...(body.status && { status: body.status }),
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

    // workTypeが'公休'の場合はisPublicHolidayもtrueにする
    if (body.workType === '公休') {
      updateData.isPublicHoliday = true
    }

    // 公休の場合は時間関連を強制的にnull/0にする
    if (isPublicHoliday === true || body.workType === '公休') {
      // マイグレーションを確実に実行（エラーを無視して続行）
      try {
        await prisma.$executeRawUnsafe(`
          ALTER TABLE shifts ALTER COLUMN "startTime" DROP NOT NULL;
        `)
      } catch (e: any) {
        // 既に実行済みの場合はエラーを無視
      }
      try {
        await prisma.$executeRawUnsafe(`
          ALTER TABLE shifts ALTER COLUMN "endTime" DROP NOT NULL;
        `)
      } catch (e: any) {
        // 既に実行済みの場合はエラーを無視
      }
      
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
          // 再試行も失敗した場合は元のエラーを返す
          throw updateError
        }
      } else {
        // その他のエラーはそのまま再スロー
        throw updateError
      }
    }
  } catch (error: any) {
    console.error('Update shift error:', error)
    console.error('Error details:', {
      name: error?.name,
      message: error?.message,
      code: error?.code,
      stack: error?.stack,
    })
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

// シフト削除
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const id = parseInt(params.id)

    const shift = await prisma.shift.findFirst({
      where: {
        id,
        companyId: session.user.companyId!
      },
    })

    if (!shift) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
    }

    await prisma.shift.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error('Delete shift error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

