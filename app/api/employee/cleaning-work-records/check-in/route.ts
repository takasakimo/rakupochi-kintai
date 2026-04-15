import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { uploadCleaningPhoto } from '@/lib/cleaning-photo-upload'

export const dynamic = 'force-dynamic'

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
      photoBase64,
      handoverConfirmed = false,
    } = body as {
      propertyId: number
      workDate: string
      time: string
      date: string
      location?: { latitude: number; longitude: number }
      photoBase64?: string
      handoverConfirmed?: boolean
    }

    if (!propertyId || !workDate || !time || !date) {
      return NextResponse.json(
        { error: 'propertyId, workDate, time, date は必須です' },
        { status: 400 }
      )
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) {
      return NextResponse.json({ error: '無効なworkDateです（YYYY-MM-DD形式）' }, { status: 400 })
    }

    // アサインメント検索（PostgreSQL DATE比較を生SQLで確実に）
    type RawAssignment = { id: number; company_id: number; employee_id: number; property_id: number; assignment_date: Date; sort_order: number }
    const assignments = await prisma.$queryRaw<RawAssignment[]>`
      SELECT id, company_id, employee_id, property_id, assignment_date, sort_order
      FROM cleaning_assignments
      WHERE company_id = ${companyId} AND employee_id = ${employeeId} AND property_id = ${propertyId}
        AND assignment_date = ${workDate}::date
    `
    const assignment = assignments[0]
    if (!assignment) {
      return NextResponse.json(
        { error: 'この物件・日付へのアサインメントがありません' },
        { status: 403 }
      )
    }

    // 既存レコード検索（PostgreSQL DATE比較を生SQLで確実に）
    type RawRecord = { id: number; check_out_at: Date | null }
    const existingRows = await prisma.$queryRaw<RawRecord[]>`
      SELECT id, check_out_at FROM cleaning_work_records
      WHERE company_id = ${companyId} AND employee_id = ${employeeId} AND property_id = ${propertyId}
        AND work_date = ${workDate}::date
    `
    const existingRecord = existingRows[0]
    if (existingRecord?.check_out_at) {
      return NextResponse.json(
        { error: 'すでに退場済みです' },
        { status: 400 }
      )
    }

    let checkInPhotoUrl: string | null = null
    if (photoBase64) {
      try {
        const url = await uploadCleaningPhoto(
          photoBase64,
          `check-in/${companyId}/${employeeId}/${propertyId}`
        )
        checkInPhotoUrl = url
      } catch (photoErr) {
        console.error('Photo upload failed (check-in continues without photo):', photoErr)
      }
    }

    // 勤怠打刻と同様: date+time は JST として解釈（クライアントがローカルで送るため）
    const [datePart] = date.split('T')
    const checkInAtStr = `${datePart}T${time}:00+09:00`
    const locationJson = location ? JSON.stringify(location) : null

    if (existingRecord) {
      await prisma.$executeRawUnsafe(
        `UPDATE cleaning_work_records SET
          check_in_at = $1::timestamptz,
          check_in_location = $2::jsonb,
          check_in_photo_url = $3,
          handover_confirmed = $4,
          updated_at = NOW()
        WHERE id = $5`,
        checkInAtStr,
        locationJson,
        checkInPhotoUrl,
        handoverConfirmed,
        existingRecord.id
      )
    } else {
      await prisma.$executeRawUnsafe(
        `INSERT INTO cleaning_work_records
          (company_id, employee_id, property_id, work_date, check_in_at, check_in_location, check_in_photo_url, handover_confirmed, work_type, created_at, updated_at)
        VALUES ($1, $2, $3, $4::date, $5::timestamptz, $6::jsonb, $7, $8, '定期清掃', NOW(), NOW())`,
        companyId,
        employeeId,
        propertyId,
        workDate,
        checkInAtStr,
        locationJson,
        checkInPhotoUrl,
        handoverConfirmed
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const err = error as Error & { code?: string; meta?: unknown }
    console.error('Cleaning check-in error:', {
      message: err.message,
      code: err.code,
      meta: err.meta,
      stack: err.stack,
    })
    return NextResponse.json(
      { error: 'Internal server error', detail: process.env.NODE_ENV === 'development' ? err.message : undefined },
      { status: 500 }
    )
  }
}
