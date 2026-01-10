import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

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

    const body = await request.json()
    const { status, rejectionReason, type, title, content, reason, employeeId, employeeNumber } = body

    // 申請の存在確認
    const existingApplication = await prisma.application.findUnique({
      where: {
        id: parseInt(params.id),
        companyId: effectiveCompanyId,
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
      if (!isAdmin && !isSuperAdmin) {
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

        // 従業員登録申請が承認された場合、従業員を作成
        if (existingApplication.type === 'employee_registration') {
          try {
            if (!employeeNumber) {
              return NextResponse.json(
                { error: '従業員登録申請を承認するには従業員番号が必要です' },
                { status: 400 }
              )
            }

            const applicationContent = JSON.parse(existingApplication.content)
            const { name, email, phone, address, transportationRoutes } = applicationContent

            // メールアドレスの重複チェック
            const existingEmployee = await prisma.employee.findUnique({
              where: { email },
            })

            if (existingEmployee) {
              return NextResponse.json(
                { error: 'このメールアドレスは既に使用されています' },
                { status: 409 }
              )
            }

            // 社員番号の重複チェック（同じ企業内）
            const existingEmployeeNumber = await prisma.employee.findFirst({
              where: {
                employeeNumber,
                companyId: effectiveCompanyId,
              },
            })

            if (existingEmployeeNumber) {
              return NextResponse.json(
                { error: 'この社員番号は既に使用されています' },
                { status: 409 }
              )
            }

            // 一時的な従業員レコードを取得
            const tempEmployee = await prisma.employee.findUnique({
              where: { id: existingApplication.employeeId },
            })

            // 一時的なパスワードを生成
            const tempPassword = crypto.randomBytes(16).toString('hex')
            const hashedPassword = await bcrypt.hash(tempPassword, 10)

            // 一時的な従業員レコードを更新して実際の従業員情報に置き換え
            const newEmployee = await prisma.employee.update({
              where: { id: existingApplication.employeeId },
              data: {
                employeeNumber,
                name,
                email,
                password: hashedPassword,
                phone: phone || null,
                address: address || null,
                transportationRoutes: transportationRoutes || null,
                isActive: true,
              },
            })

            // 申請のemployeeIdは既に正しいので更新不要
          } catch (error) {
            console.error('Failed to create employee for registration application:', error)
            return NextResponse.json(
              { error: '従業員の作成に失敗しました' },
              { status: 500 }
            )
          }
        }

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
                  companyId: effectiveCompanyId,
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
                    companyId: effectiveCompanyId,
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
          companyId: effectiveCompanyId,
        },
        data: updateData,
      })

      return NextResponse.json({ success: true, application })
    }

    // 申請内容の修正の場合（管理者・スーパー管理者のみ）
    if (type || content || title !== undefined || reason !== undefined) {
      if (!isAdmin && !isSuperAdmin) {
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
        if (!employee || employee.companyId !== effectiveCompanyId) {
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

