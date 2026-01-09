import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// CSVテンプレート生成
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'rakupochi'

    let csvContent = ''
    let filename = ''

    switch (format) {
      case 'rakupochi':
        csvContent = '社員番号,氏名,部署,役職,メールアドレス,電話番号,生年月日,住所,入社日,勤続年数,有給付与日,有給残数,振込先口座,交通費,店舗,勤務先住所,権限\n'
        csvContent += '0001,山田太郎,営業部,主任,tanaka@example.com,090-1234-5678,1990-01-01,東京都渋谷区,2020-04-01,3.5,2023-10-01,10,1234567,15000,本店,東京都渋谷区,employee\n'
        filename = 'employee_template_rakupochi.csv'
        break

      case 'general':
        csvContent = '社員番号,氏名,メールアドレス,電話番号,部署,役職,生年月日,住所,入社日,権限\n'
        csvContent += '0001,山田太郎,tanaka@example.com,090-1234-5678,営業部,主任,1990-01-01,東京都渋谷区,2020-04-01,employee\n'
        filename = 'employee_template_general.csv'
        break

      case 'simple':
        csvContent = '社員番号,氏名,メールアドレス,電話番号,住所\n'
        csvContent += '0001,山田太郎,tanaka@example.com,090-1234-5678,東京都渋谷区\n'
        filename = 'employee_template_simple.csv'
        break

      default:
        csvContent = '社員番号,氏名,部署,役職,メールアドレス,電話番号,生年月日,住所,入社日,勤続年数,有給付与日,有給残数,振込先口座,交通費,店舗,勤務先住所,権限\n'
        csvContent += '0001,山田太郎,営業部,主任,tanaka@example.com,090-1234-5678,1990-01-01,東京都渋谷区,2020-04-01,3.5,2023-10-01,10,1234567,15000,本店,東京都渋谷区,employee\n'
        filename = 'employee_template_rakupochi.csv'
    }

    // UTF-8 BOM付きで返す（Excel対応）
    const bom = '\uFEFF'
    const response = new NextResponse(bom + csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })

    return response
  } catch (error: any) {
    console.error('Template generation error:', error)
    return NextResponse.json(
      { error: 'テンプレート生成中にエラーが発生しました', details: error.message },
      { status: 500 }
    )
  }
}



