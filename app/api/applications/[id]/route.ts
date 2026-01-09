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
        companyId: session.user.companyId!,
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

        // 休暇申請が承認された場合、シフトを作成または更新
        if (existingApplication.type === 'leave') {
          try {
            const content = JSON.parse(existingApplication.content)
            const leaveTypeMap: Record<string, string> = {
              paid: '有給休暇',
              unpaid: '無給休暇',
              special: '特別休暇',
              bereavement: '慶弔休暇',
              childcare: '育児休暇',
              nursing: '介護休暇',
              sick: '病気休暇',
              menstrual: '生理休暇',
              marriage: '結婚休暇',
              maternity: '出産休暇',
              paternity: 'パートナー出産休暇',
              refresh: 'リフレッシュ休暇',
              volunteer: 'ボランティア休暇',
            }
            const leaveTypeName = leaveTypeMap[content.type] || '休暇'

            // 日付モードに応じて日付を取得
            let dates: Date[] = []
            if (content.dateMode === 'multiple' && content.selectedDates) {
              // 複数日選択の場合
              dates = content.selectedDates.map((dateStr: string) => new Date(dateStr))
            } else if (content.startDate && content.endDate) {
              // 開始日・終了日の場合
              const startDate = new Date(content.startDate)
              const endDate = new Date(content.endDate)
              for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                dates.push(new Date(d))
              }
            }

            for (const date of dates) {
              // 既存のシフトを確認
              const [year, month, day] = [
                date.getFullYear(),
                date.getMonth() + 1,
                date.getDate(),
              ]
              const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const shiftDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))

              const existingShift = await prisma.shift.findFirst({
                where: {
                  companyId: session.user.companyId!,
                  employeeId: existingApplication.employeeId,
                  date: shiftDate,
                },
              })

              const notes = `${leaveTypeName}${content.reason ? `: ${content.reason}` : ''}`

              if (existingShift) {
                // 既存のシフトを更新
                await prisma.shift.update({
                  where: { id: existingShift.id },
                  data: {
                    isPublicHoliday: true,
                    workType: leaveTypeName,
                    notes,
                    startTime: null,
                    endTime: null,
                    breakMinutes: 0,
                  },
                })
              } else {
                // 新規シフトを作成
                await prisma.shift.create({
                  data: {
                    companyId: session.user.companyId!,
                    employeeId: existingApplication.employeeId,
                    date: shiftDate,
                    isPublicHoliday: true,
                    workType: leaveTypeName,
                    notes,
                    startTime: null,
                    endTime: null,
                    breakMinutes: 0,
                    status: 'confirmed',
                  },
                })
              }
            }
          } catch (error) {
            console.error('Failed to create shifts for leave application:', error)
            // エラーが発生しても申請の承認は続行
          }
        }
      } else {
        updateData.rejectedAt = new Date()
        updateData.approvedAt = null
        updateData.rejectionReason = rejectionReason || null
      }

      const application = await prisma.application.update({
        where: {
          id: parseInt(params.id),
          companyId: session.user.companyId!,
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
          companyId: session.user.companyId!,
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

