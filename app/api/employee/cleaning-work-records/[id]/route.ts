import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { uploadCleaningPhoto } from '@/lib/cleaning-photo-upload'

export const dynamic = 'force-dynamic'

/**
 * 報告内容編集（作業当日・日付が変わるまで）
 * 写真追加・コメント（所感・汚れ箇所・引き継ぎ）の修正のみ可。打刻時刻は変更不可。
 * 自分のレコード編集時は必ずEmployeeのcompanyIdを使用（スーパー管理者でもselectedCompanyIdに依存しない）
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const employeeId = parseInt(session.user.id, 10)
    if (isNaN(employeeId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { companyId: true },
    })
    const companyId = employee?.companyId
    if (!companyId) {
      return NextResponse.json({ error: '所属企業が設定されていません' }, { status: 403 })
    }

    const id = parseInt((await params).id, 10)
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid record id' }, { status: 400 })
    }

    const existing = await prisma.cleaningWorkRecord.findUnique({
      where: { id },
    })

    if (!existing || existing.companyId !== companyId || existing.employeeId !== employeeId) {
      return NextResponse.json({ error: 'レコードが見つかりません' }, { status: 404 })
    }

    if (!existing.checkOutAt) {
      return NextResponse.json({ error: 'チェックアウト完了後にのみ編集できます' }, { status: 400 })
    }

    const today = new Date()
    const workDate = new Date(existing.workDate)
    if (
      workDate.getFullYear() !== today.getFullYear() ||
      workDate.getMonth() !== today.getMonth() ||
      workDate.getDate() !== today.getDate()
    ) {
      return NextResponse.json({ error: '報告内容の編集は作業当日のみ可能です' }, { status: 400 })
    }

    const body = await request.json()
    const {
      impression,
      dirtyAreas,
      handoverNotes,
      photoExteriorBase64,
      photoGarbageBase64s,
    } = body as {
      impression?: string
      dirtyAreas?: string
      handoverNotes?: string
      photoExteriorBase64?: string
      photoGarbageBase64s?: string[]
    }

    const updateData: Record<string, unknown> = {}
    if (impression !== undefined) updateData.impression = impression || null
    if (dirtyAreas !== undefined) updateData.dirtyAreas = dirtyAreas || null
    if (handoverNotes !== undefined) updateData.handoverNotes = handoverNotes || null

    const prefix = `check-out/${companyId}/${employeeId}/${existing.propertyId}`

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

    if (exteriorUrl || garbageUrls.length > 0) {
      const current = (existing.checkOutPhotoUrls ?? {}) as { exterior?: string | null; garbage?: string[] }
      const newUrls = {
        exterior: exteriorUrl ?? current.exterior ?? null,
        garbage: garbageUrls.length > 0 ? [...(current.garbage ?? []), ...garbageUrls] : (current.garbage ?? []),
      }
      updateData.checkOutPhotoUrls = newUrls
    }

    await prisma.cleaningWorkRecord.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Cleaning report edit error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
