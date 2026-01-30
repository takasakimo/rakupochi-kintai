import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// 管理者による営業先入店記録
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // スーパー管理者または管理者のみアクセス可能
    const isSuperAdmin = session.user.role === 'super_admin' || 
                         session.user.email === 'superadmin@rakupochi.com'
    const isAdmin = session.user.role === 'admin'

    if (!isSuperAdmin && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

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
    const { employeeId, time, date, companyName, purpose, location } = body

    if (!employeeId || !time || !date) {
      return NextResponse.json(
        { error: 'Employee ID, time and date are required' },
        { status: 400 }
      )
    }

    if (!companyName || companyName.trim() === '') {
      return NextResponse.json(
        { error: 'Company name is required' },
        { status: 400 }
      )
    }

    if (!purpose) {
      return NextResponse.json(
        { error: 'Purpose is required' },
        { status: 400 }
      )
    }

    const validPurposes = ['商談', '見積', 'アフターサービス', 'その他']
    if (!validPurposes.includes(purpose)) {
      return NextResponse.json(
        { error: 'Invalid purpose' },
        { status: 400 }
      )
    }

    // 従業員が自社のものであることを確認
    const employee = await prisma.employee.findUnique({
      where: { id: parseInt(employeeId) },
    })

    if (!employee || employee.companyId !== effectiveCompanyId) {
      return NextResponse.json(
        { error: 'Employee not found or unauthorized' },
        { status: 404 }
      )
    }

    const visitDate = new Date(date)
    const entryTime = new Date(`2000-01-01T${time}`)

    // 位置情報を保存（オプション）
    const locationData = location && location.latitude && location.longitude
      ? {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy || null,
        }
      : null

    // 営業先訪問レコードを作成
    const salesVisit = await prisma.salesVisit.create({
      data: {
        companyId: effectiveCompanyId,
        employeeId: parseInt(employeeId),
        date: visitDate,
        companyName: companyName.trim(),
        purpose,
        entryTime,
        entryLocation: locationData as any,
      },
    })

    return NextResponse.json({
      success: true,
      salesVisit,
      location: locationData,
    })
  } catch (error) {
    console.error('Admin sales visit entry error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
