import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// 申請承認・却下・修正
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { status, rejectionReason, type, title, content, reason, employeeId } = body

    // 申請の存在確認
    const existingApplication = await prisma.application.findUnique({
      where: {
        id: parseInt(params.id),
        companyId: session.user.companyId,
      },
    })

    if (!existingApplication) {
      return NextResponse.json(
        { error: 'Application not found' },
        { status: 404 }
      )
    }

    // 承認・却下の場合
    if (status && ['approved', 'rejected'].includes(status)) {
      if (session.user.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      const updateData: any = {
        status,
        approverId: parseInt(session.user.id),
      }

      if (status === 'approved') {
        updateData.approvedAt = new Date()
        updateData.rejectedAt = null
        updateData.rejectionReason = null
      } else {
        updateData.rejectedAt = new Date()
        updateData.approvedAt = null
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
    }

    // 申請内容の修正の場合（管理者のみ）
    if (type || content || title !== undefined || reason !== undefined) {
      if (session.user.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      const updateData: any = {}

      if (type) updateData.type = type
      if (title !== undefined) updateData.title = title || null
      if (content) updateData.content = JSON.stringify(content)
      if (reason !== undefined) updateData.reason = reason || null
      if (employeeId) {
        // 従業員IDの変更時は、指定された従業員が自社のものであることを確認
        const employee = await prisma.employee.findUnique({
          where: { id: parseInt(employeeId) },
        })
        if (!employee || employee.companyId !== session.user.companyId) {
          return NextResponse.json(
            { error: '指定された従業員が見つからないか、権限がありません' },
            { status: 403 }
          )
        }
        updateData.employeeId = parseInt(employeeId)
      }

      // 修正時は承認状態をリセット
      updateData.status = 'pending'
      updateData.approverId = null
      updateData.approvedAt = null
      updateData.rejectedAt = null
      updateData.rejectionReason = null

      const application = await prisma.application.update({
        where: {
          id: parseInt(params.id),
          companyId: session.user.companyId,
        },
        data: updateData,
      })

      return NextResponse.json({ success: true, application })
    }

    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Update application error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

