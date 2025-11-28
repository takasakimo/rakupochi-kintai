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
        companyId: session.user.companyId,
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

    const updatedShift = await prisma.shift.update({
      where: { id },
      data: {
        ...(shiftDate && { date: shiftDate }),
        ...(body.startTime && {
          startTime: new Date(`2000-01-01T${body.startTime}`),
        }),
        ...(body.endTime && {
          endTime: new Date(`2000-01-01T${body.endTime}`),
        }),
        ...(body.breakMinutes !== undefined && {
          breakMinutes: body.breakMinutes,
        }),
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
        ...(body.workingHours !== undefined && {
          workingHours: body.workingHours,
        }),
        ...(body.timeSlot !== undefined && {
          timeSlot: body.timeSlot,
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
      },
    })

    return NextResponse.json({
      success: true,
      shift: updatedShift,
    })
  } catch (error) {
    console.error('Update shift error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
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
        companyId: session.user.companyId,
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

