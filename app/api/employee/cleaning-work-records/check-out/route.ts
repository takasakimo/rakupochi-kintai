import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { uploadCleaningPhoto } from '@/lib/cleaning-photo-upload'

export const dynamic = 'force-dynamic'

const WORK_TYPES = ['定期清掃', '追加清掃', '特別清掃', 'その他']

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const employeeId = parseInt(session.user.id, 10)
    if (isNaN(employeeId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 自分の打刻時は必ずEmployeeのcompanyIdを使用（スーパー管理者でもselectedCompanyIdに依存しない）
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { companyId: true },
    })
    const companyId = employee?.companyId
    if (!companyId) {
      return NextResponse.json(
        { error: '所属企業が設定されていません' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      propertyId,
      workDate,
      time,
      date,
      location,
      photoExteriorBase64,
      photoGarbageBase64s,
      workType = '定期清掃',
      workTypeOtherComment,
      impression,
      dirtyAreas,
      handoverNotes,
    } = body as {
      propertyId: number
      workDate: string
      time: string
      date: string
      location?: { latitude: number; longitude: number }
      photoExteriorBase64?: string
      photoGarbageBase64s?: string[]
      workType?: string
      workTypeOtherComment?: string
      impression?: string
      dirtyAreas?: string
      handoverNotes?: string
    }

    if (!propertyId || !workDate || !time || !date) {
      return NextResponse.json(
        { error: 'propertyId, workDate, time, date は必須です' },
        { status: 400 }
      )
    }

    if (!WORK_TYPES.includes(workType)) {
      return NextResponse.json(
        { error: `workType は ${WORK_TYPES.join(', ')} のいずれかです` },
        { status: 400 }
      )
    }

    const workDateObj = new Date(workDate)
    if (isNaN(workDateObj.getTime())) {
      return NextResponse.json({ error: '無効なworkDateです' }, { status: 400 })
    }

    const existing = await prisma.cleaningWorkRecord.findUnique({
      where: {
        companyId_employeeId_propertyId_workDate: {
          companyId,
          employeeId,
          propertyId,
          workDate: workDateObj,
        },
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'チェックイン記録が見つかりません' },
        { status: 404 }
      )
    }
    if (!existing.checkInAt) {
      return NextResponse.json(
        { error: '先にチェックインしてください' },
        { status: 400 }
      )
    }
    if (existing.checkOutAt) {
      return NextResponse.json(
        { error: 'すでにチェックアウト済みです' },
        { status: 400 }
      )
    }

    const prefix = `check-out/${companyId}/${employeeId}/${propertyId}`

    let exteriorUrl: string | null = null
    if (photoExteriorBase64) {
      exteriorUrl = await uploadCleaningPhoto(photoExteriorBase64, `${prefix}/exterior`)
    }

    const garbageUrls: string[] = []
    if (Array.isArray(photoGarbageBase64s)) {
      for (let i = 0; i < photoGarbageBase64s.length; i++) {
        const url = await uploadCleaningPhoto(photoGarbageBase64s[i], `${prefix}/garbage`)
        if (url) garbageUrls.push(url)
      }
    }

    const [datePart] = date.split('T')
    const checkOutAt = new Date(`${datePart}T${time}:00`)

    const durationMinutes = existing.checkInAt
      ? Math.round((checkOutAt.getTime() - existing.checkInAt.getTime()) / 60000)
      : null

    const checkOutPhotoUrls: { exterior: string | null; garbage: string[] } = {
      exterior: exteriorUrl,
      garbage: garbageUrls,
    }

    await prisma.cleaningWorkRecord.update({
      where: { id: existing.id },
      data: {
        checkOutAt,
        checkOutLocation: location ?? undefined,
        checkOutPhotoUrls,
        workType,
        workTypeOtherComment: workTypeOtherComment || undefined,
        impression: impression || undefined,
        dirtyAreas: dirtyAreas || undefined,
        handoverNotes: handoverNotes || undefined,
        durationMinutes,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Cleaning check-out error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
