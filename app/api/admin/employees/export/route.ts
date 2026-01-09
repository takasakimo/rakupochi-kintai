import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// CSVエクスポート処理
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 従業員一覧を取得
    const employees = await prisma.employee.findMany({
      where: {
        companyId: session.user.companyId,
      },
      select: {
        employeeNumber: true,
        name: true,
        department: true,
        position: true,
        email: true,
        phone: true,
        birthDate: true,
        address: true,
        hireDate: true,
        yearsOfService: true,
        paidLeaveGrantDate: true,
        paidLeaveBalance: true,
        bankAccount: true,
        transportationCost: true,
        workLocation: true,
        workLocationAddress: true,
        role: true,
      },
      orderBy: {
        employeeNumber: 'asc',
      },
    })

    // CSVヘッダー
    const headers = [
      '社員番号',
      '氏名',
      '部署',
      '役職',
      'メールアドレス',
      '電話番号',
      '生年月日',
      '住所',
      '入社日',
      '勤続年数',
      '有給付与日',
      '有給残数',
      '振込先口座',
      '交通費',
      '店舗',
      '勤務先住所',
      '権限',
    ]

    // CSV行を生成
    const csvRows: string[] = []
    csvRows.push(headers.join(','))

    for (const employee of employees) {
      const row = [
        employee.employeeNumber || '',
        employee.name || '',
        employee.department || '',
        employee.position || '',
        employee.email || '',
        employee.phone || '',
        employee.birthDate
          ? new Date(employee.birthDate).toISOString().split('T')[0]
          : '',
        employee.address || '',
        employee.hireDate
          ? new Date(employee.hireDate).toISOString().split('T')[0]
          : '',
        employee.yearsOfService?.toString() || '',
        employee.paidLeaveGrantDate
          ? new Date(employee.paidLeaveGrantDate).toISOString().split('T')[0]
          : '',
        employee.paidLeaveBalance?.toString() || '0',
        employee.bankAccount || '',
        employee.transportationCost?.toString() || '',
        employee.workLocation || '',
        employee.workLocationAddress || '',
        employee.role || 'employee',
      ]

      // カンマや改行が含まれる場合はダブルクォートで囲む
      const escapedRow = row.map((cell) => {
        const cellStr = String(cell)
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return `"${cellStr.replace(/"/g, '""')}"`
        }
        return cellStr
      })

      csvRows.push(escapedRow.join(','))
    }

    const csvContent = csvRows.join('\n')

    // UTF-8 BOM付きで返す（Excel対応）
    const bom = '\uFEFF'
    const response = new NextResponse(bom + csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="employees_export_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })

    return response
  } catch (error: any) {
    console.error('CSV export error:', error)
    return NextResponse.json(
      { error: 'CSVエクスポート処理中にエラーが発生しました', details: error.message },
      { status: 500 }
    )
  }
}

