import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

// 請求書PDF生成
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
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

    const invoiceId = parseInt(params.id)

    // 請求書データを取得
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        companyId: effectiveCompanyId,
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            address: true,
            phone: true,
            email: true,
          },
        },
        billingClient: {
          select: {
            id: true,
            name: true,
            address: true,
            phone: true,
            fax: true,
            contactPerson: true,
            code: true,
            taxRate: true,
            bankName: true,
            bankBranch: true,
            accountNumber: true,
            accountHolder: true,
          },
        },
        details: {
          include: {
            employee: {
              select: {
                id: true,
                name: true,
                employeeNumber: true,
                workLocation: true,
              },
            },
          },
          orderBy: {
            employee: {
              employeeNumber: 'asc',
            },
          },
        },
      },
    })

    if (!invoice) {
      return NextResponse.json(
        { error: '請求書が見つかりません' },
        { status: 404 }
      )
    }

    // PDF生成
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    })

    // 日本語フォントの設定
    // jsPDFで日本語を表示するには、日本語フォントを追加する必要があります
    // デフォルトのhelveticaフォントは日本語をサポートしていないため、文字化けが発生します
    
    // 日本語フォントファイルのパスを確認
    const fontPaths = [
      path.join(process.cwd(), 'public', 'fonts', 'NotoSansJP-Regular.ttf'),
      path.join(process.cwd(), 'fonts', 'NotoSansJP-Regular.ttf'),
      path.join(process.cwd(), 'lib', 'fonts', 'NotoSansJP-Regular.ttf'),
    ]
    
    let japaneseFontLoaded = false
    let fontPathUsed = ''
    
    for (const fontPath of fontPaths) {
      try {
        if (fs.existsSync(fontPath)) {
          fontPathUsed = fontPath
          console.log(`Loading Japanese font from: ${fontPath}`)
          const fontData = fs.readFileSync(fontPath)
          const base64Font = fontData.toString('base64')
          
          // VFSにフォントファイルを追加
          doc.addFileToVFS('NotoSansJP-Regular.ttf', base64Font)
          
          // フォントを登録（normal）
          doc.addFont('NotoSansJP-Regular.ttf', 'NotoSansJP', 'normal')
          
          // フォントを設定
          doc.setFont('NotoSansJP', 'normal')
          
          japaneseFontLoaded = true
          console.log('Japanese font loaded successfully')
          break
        }
      } catch (error) {
        console.error(`Failed to load font from ${fontPath}:`, error)
      }
    }
    
    if (!japaneseFontLoaded) {
      // フォントファイルが見つからない場合、デフォルトのhelveticaを使用
      // ただし、日本語は文字化けします
      doc.setFont('helvetica', 'normal')
      console.warn('Japanese font file not found. Japanese text will be garbled.')
      console.warn('Searched paths:', fontPaths)
    } else {
      console.log(`Japanese font successfully loaded from: ${fontPathUsed}`)
    }

    // 日付フォーマット関数
    const formatDate = (date: Date | string) => {
      const d = typeof date === 'string' ? new Date(date) : date
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${year}/${month}/${day}`
    }

    const formatDateJapanese = (date: Date | string) => {
      const d = typeof date === 'string' ? new Date(date) : date
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${year}年${month}月${day}日`
    }

    // 金額フォーマット関数
    const formatAmount = (amount: number) => {
      return `¥${amount.toLocaleString()}`
    }

    const formatAmountNoSymbol = (amount: number) => {
      return amount.toLocaleString()
    }

    // 日本語フォントが読み込まれている場合はそれを使用
    const fontName = japaneseFontLoaded ? 'NotoSansJP' : 'helvetica'
    
    let yPos = 20

    // 作成日（右上）
    doc.setFontSize(9)
    doc.setFont(fontName, 'normal')
    const createdDate = invoice.issuedAt || invoice.createdAt
    doc.text(`作成日:${formatDate(createdDate)}`, 190, yPos, { align: 'right' })
    yPos += 10

    // タイトル「請求書」（中央、大きめ）
    doc.setFontSize(24)
    doc.setFont(fontName, 'normal') // boldフォントがない場合はnormalを使用
    doc.text('請求書', 105, yPos, { align: 'center' })
    yPos += 15

    // 「御中」+ 請求先企業名
    doc.setFontSize(12)
    doc.setFont(fontName, 'normal')
    doc.text('御中', 20, yPos)
    doc.text(invoice.billingClient.name || '', 35, yPos)
    yPos += 10

    // 「下記の通りご請求致しますのでご査収下さい。」
    doc.setFontSize(10)
    doc.text('下記の通りご請求致しますのでご査収下さい。', 20, yPos)
    yPos += 12

    // 「ご請求金額」+ 大きな金額表示
    doc.setFontSize(10)
    doc.text('ご請求金額', 20, yPos)
    doc.setFontSize(20)
    doc.setFont(fontName, 'normal') // boldフォントがない場合はnormalを使用
    doc.text(formatAmount(invoice.totalAmount), 20, yPos + 8)
    yPos += 20

    // 件名、代金決済条件、お支払い期日（リスト形式）
    doc.setFontSize(10)
    doc.setFont(fontName, 'normal')
    doc.text(`件名`, 20, yPos)
    doc.text(invoice.subject, 50, yPos)
    yPos += 8
    
    doc.text(`代金決済条件`, 20, yPos)
    doc.text(invoice.paymentTerms, 50, yPos)
    yPos += 8
    
    doc.text(`お支払い期日`, 20, yPos)
    doc.text(formatDate(invoice.dueDate), 50, yPos)
    yPos += 12

    // 請求番号（適格番号は後で追加可能）
    doc.setFontSize(9)
    doc.text(`請求番号: ${invoice.invoiceNumber}`, 20, yPos)
    // TODO: 適格番号を追加する場合は、Companyテーブルに適格番号フィールドを追加
    // doc.text(`適格番号: ${invoice.company.taxId || ''}`, 120, yPos)
    yPos += 10

    // 明細テーブル（費目、単価(税抜)、数量、金額(税抜)、適用税率、補足）
    // 従業員ごとの明細を費目として表示
    const tableData: any[] = []
    
    invoice.details.forEach((detail) => {
      // 従業員名と店舗情報を補足に含める
      const note = detail.employee.workLocation 
        ? `${detail.employee.workLocation} ${detail.employee.name}`
        : detail.employee.name
      
      // 基本金額を費目として表示
      const unitPrice = detail.basicAmount
      const quantity = 1
      const amount = detail.basicAmount
      const taxRate = Math.round((invoice.billingClient.taxRate || 0.1) * 100)
      
      tableData.push([
        `${detail.employee.name}委託費用`, // 費目
        formatAmountNoSymbol(unitPrice), // 単価(税抜)
        quantity.toString(), // 数量
        formatAmountNoSymbol(amount), // 金額(税抜)
        `${taxRate}%`, // 適用税率
        note, // 補足
      ])
    })

    // 空行を追加（PDFサンプルに合わせて）
    for (let i = 0; i < Math.max(0, 8 - invoice.details.length); i++) {
      tableData.push(['', '', '', '', '', ''])
    }

    // 小計行を追加（10%対象小計）
    const taxRatePercent = Math.round((invoice.billingClient.taxRate || 0.1) * 100)
    tableData.push([
      `${taxRatePercent}%対象小計`,
      '',
      '',
      formatAmountNoSymbol(invoice.subtotal),
      '',
      '',
    ])

    // 調整金額がある場合は追加
    if (invoice.adjustmentAmount && invoice.adjustmentAmount !== 0) {
      tableData.push([
        '調整金額',
        '',
        '',
        invoice.adjustmentAmount > 0 ? formatAmountNoSymbol(invoice.adjustmentAmount) : `-${formatAmountNoSymbol(Math.abs(invoice.adjustmentAmount))}`,
        '',
        '',
      ])
    } else {
      tableData.push([
        '調整金額',
        '',
        '',
        '',
        '',
        '',
      ])
    }

    // 交通費がある場合は追加
    if (invoice.transportationCost && invoice.transportationCost > 0) {
      tableData.push([
        '交通費',
        '',
        '',
        formatAmountNoSymbol(invoice.transportationCost),
        '',
        '',
      ])
    } else {
      tableData.push([
        '交通費',
        '',
        '',
        '',
        '',
        '',
      ])
    }

    // 消費税行を追加
    tableData.push([
      `消費税(${taxRatePercent}%対象)`,
      '',
      '',
      formatAmountNoSymbol(invoice.taxAmount),
      '',
      '',
    ])

    // 8%対象の消費税は0なので空行
    tableData.push([
      '消費税(8%対象)',
      '',
      '',
      '',
      '',
      '',
    ])

    // 合計金額行を追加
    tableData.push([
      '合計金額',
      '',
      '',
      formatAmountNoSymbol(invoice.totalAmount),
      '',
      '',
    ])

    // autoTableでも日本語フォントを使用
    const currentFont = japaneseFontLoaded ? 'NotoSansJP' : 'helvetica'
    
    // autoTableの設定でフォントを明示的に指定
    autoTable(doc, {
      startY: yPos,
      head: [['費目', '単価(税抜)', '数量', '金額(税抜)', '適用税率', '補足']],
      body: tableData,
      theme: 'grid',
      styles: {
        font: currentFont,
        fontSize: 9,
      },
      headStyles: {
        fillColor: [66, 139, 202],
        textColor: 255,
        fontStyle: 'normal', // boldフォントがない場合はnormalを使用
        fontSize: 9,
        font: currentFont,
      },
      bodyStyles: {
        fontSize: 9,
        font: currentFont,
      },
      columnStyles: {
        0: { cellWidth: 50 }, // 費目
        1: { cellWidth: 25, halign: 'right' }, // 単価(税抜)
        2: { cellWidth: 15, halign: 'center' }, // 数量
        3: { cellWidth: 30, halign: 'right' }, // 金額(税抜)
        4: { cellWidth: 20, halign: 'center' }, // 適用税率
        5: { cellWidth: 50 }, // 補足
      },
      margin: { left: 20, right: 20 },
    })

    // 合計金額の行を強調
    const finalY = (doc as any).lastAutoTable?.finalY || yPos + 50
    yPos = finalY + 15

    // 振込先情報の説明
    doc.setFontSize(9)
    doc.setFont(fontName, 'normal')
    doc.text('※お手数ですが、お支払いは下記の銀行口座へお振込みくださいます様、お願い申し上げます。', 20, yPos)
    yPos += 8

    // 振込先情報（BillingClientから取得、なければCompanyから取得）
    doc.setFontSize(10)
    doc.setFont(fontName, 'normal') // boldフォントがない場合はnormalを使用
    doc.text('お振込み先', 20, yPos)
    yPos += 8
    
    doc.setFontSize(9)
    doc.setFont(fontName, 'normal')
    
    // 振込先情報はBillingClientに保存されている（請求先企業の振込先）
    // ただし、PDFサンプルでは請求元企業の振込先が表示されている
    // ここではBillingClientの振込先情報を使用（必要に応じてCompanyから取得可能）
    const bankInfo = invoice.billingClient
    if (bankInfo.bankName) {
      doc.text(`- 銀行名: ${bankInfo.bankName}`, 20, yPos)
      yPos += 6
    }
    if (bankInfo.bankBranch) {
      doc.text(`- 支店名: ${bankInfo.bankBranch}`, 20, yPos)
      yPos += 6
    }
    if (bankInfo.accountNumber) {
      doc.text(`- 普通口座: ${bankInfo.accountNumber}`, 20, yPos)
      yPos += 6
    }
    if (bankInfo.accountHolder) {
      doc.text(`- 口座名義: ${bankInfo.accountHolder}`, 20, yPos)
      yPos += 6
    }

    // 請求元企業情報（下部）
    yPos += 10
    doc.setFontSize(9)
    doc.setFont(fontName, 'normal')
    if (invoice.company.name) {
      doc.text(invoice.company.name, 20, yPos)
      yPos += 5
    }
    if (invoice.company.address) {
      doc.text(invoice.company.address, 20, yPos)
      yPos += 5
    }
    if (invoice.company.phone) {
      doc.text(`TEL: ${invoice.company.phone}`, 20, yPos)
      yPos += 5
    }
    if (invoice.company.email) {
      doc.text(`Email: ${invoice.company.email}`, 20, yPos)
      yPos += 5
    }
    if (invoice.billingClient.fax) {
      doc.text(`FAX: ${invoice.billingClient.fax}`, 20, yPos)
      yPos += 5
    }
    if (invoice.billingClient.contactPerson) {
      doc.text(`担当: ${invoice.billingClient.contactPerson}`, 20, yPos)
    }

    // PDFを生成
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'))

    // レスポンスを返す
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`,
      },
    })
  } catch (error: any) {
    console.error('Failed to generate PDF:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message },
      { status: 500 }
    )
  }
}
