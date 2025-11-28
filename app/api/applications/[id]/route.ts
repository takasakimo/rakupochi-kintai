import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// 申請承認・却下
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { status, rejectionReason } = body

    if (!status || !['approved', 'rejected'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      )
    }

    const updateData: any = {
      status,
      approverId: parseInt(session.user.id),
    }

    if (status === 'approved') {
      updateData.approvedAt = new Date()
    } else {
      updateData.rejectedAt = new Date()
      updateData.rejectionReason = rejectionReason || null
    }

    const application = await prisma.application.update({
      where: {
        id: parseInt(params.id),
        companyId: session.user.companyId,
      },
      data: updateData,
    })

    return NextResponse.json({ success: true, application })
  } catch (error) {
    console.error('Update application error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

