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
            issuerName: true,
            taxId: true,
            bankName: true,
            bankBranch: true,
            accountNumber: true,
            accountHolder: true,
            invoiceItemNameTemplate: true,
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
                invoiceItemName: true,
                billingRate: true,
                billingRateType: true,
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

    // 請求番号と適格番号
    doc.setFontSize(9)
    doc.text(`請求番号: ${invoice.invoiceNumber}`, 20, yPos)
    if (invoice.company.taxId) {
      doc.text(`適格番号: ${invoice.company.taxId}`, 120, yPos)
    }
    yPos += 10

    // 明細テーブル（費目、単価(税抜)、数量、金額(税抜)、適用税率、補足）
    // 従業員ごとに基本請求金額、遅刻早退減算、欠勤減算を別行で表示
    const tableData: any[] = []
    
    // 費目テンプレートを取得（デフォルトは「{employeeName}委託費用」）
    const itemNameTemplate = invoice.company.invoiceItemNameTemplate || '{employeeName}委託費用'
    const taxRate = Math.round((invoice.billingClient.taxRate || 0.1) * 100)
    
    invoice.details.forEach((detail) => {
      // 従業員名と店舗情報を補足に含める
      const employeeNote = detail.employee.workLocation 
        ? `${detail.employee.workLocation} ${detail.employee.name}`
        : detail.employee.name
      
      // 費目を決定（従業員の設定 > テンプレート）
      let itemName: string
      if (detail.employee.invoiceItemName) {
        // 従業員に設定された費目を使用
        itemName = detail.employee.invoiceItemName
      } else {
        // テンプレートから生成
        itemName = itemNameTemplate.replace(/{employeeName}/g, detail.employee.name)
      }
      
      // 基本請求金額行を追加（減算前の基本金額 + 残業金額）
      // basicAmountは減算後の金額なので、減算額を加算して減算前の金額を計算
      // 残業金額も含める
      const basicAmountBeforeDeduction = detail.basicAmount + (detail.absenceDeduction || 0) + (detail.lateEarlyDeduction || 0)
      const totalAmountBeforeDeduction = basicAmountBeforeDeduction + (detail.overtimeAmount || 0)
      tableData.push([
        itemName, // 費目
        formatAmountNoSymbol(detail.basicRate), // 単価(税抜)
        '1', // 数量
        formatAmountNoSymbol(totalAmountBeforeDeduction), // 金額(税抜) - 減算前の金額（残業含む）
        `${taxRate}%`, // 適用税率
        employeeNote, // 補足（従業員情報）
      ])
      
      // 遅刻早退減算がある場合は別行で追加
      if (detail.lateEarlyDeduction && detail.lateEarlyDeduction > 0) {
        // 備考から遅刻・早退の詳細を抽出
        let lateEarlyNote = employeeNote
        if (detail.notes) {
          const lateEarlyMatch = detail.notes.match(/遅刻・早退: ([^/]+)/)
          if (lateEarlyMatch) {
            lateEarlyNote = `${employeeNote} ${lateEarlyMatch[1]}`
          }
        }
        
        tableData.push([
          '遅刻早退', // 費目
          '', // 単価(税抜) - 空欄
          '', // 数量 - 空欄
          `-${formatAmountNoSymbol(detail.lateEarlyDeduction)}`, // 金額(税抜) - 減算額（マイナス表示）
          `${taxRate}%`, // 適用税率
          lateEarlyNote, // 補足（従業員情報 + 詳細）
        ])
      }
      
      // 欠勤減算がある場合は別行で追加
      if (detail.absenceDeduction && detail.absenceDeduction > 0) {
        // 備考から欠勤の詳細を抽出
        let absenceNote = employeeNote
        if (detail.notes) {
          const absenceMatch = detail.notes.match(/欠勤: ([^/]+)/)
          if (absenceMatch) {
            absenceNote = `${employeeNote} ${absenceMatch[1]}`
          }
        }
        
        tableData.push([
          '欠勤', // 費目
          '', // 単価(税抜) - 空欄
          '', // 数量 - 空欄
          `-${formatAmountNoSymbol(detail.absenceDeduction)}`, // 金額(税抜) - 減算額（マイナス表示）
          `${taxRate}%`, // 適用税率
          absenceNote, // 補足（従業員情報 + 詳細）
        ])
      }
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
        overflow: 'linebreak', // セル内の改行を有効にする
        cellPadding: 2, // セルのパディング
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
        overflow: 'linebreak', // セル内の改行を有効にする
      },
      columnStyles: {
        0: { cellWidth: 50, valign: 'top' }, // 費目（上揃え）
        1: { cellWidth: 25, halign: 'right', valign: 'middle' }, // 単価(税抜)
        2: { cellWidth: 15, halign: 'center', valign: 'middle' }, // 数量
        3: { cellWidth: 30, halign: 'right', valign: 'middle' }, // 金額(税抜)
        4: { cellWidth: 20, halign: 'center', valign: 'middle' }, // 適用税率
        5: { cellWidth: 50, valign: 'top' }, // 補足（上揃え）
      },
      margin: { left: 20, right: 20 },
      didParseCell: (data: any) => {
        // 費目欄（0列目）のセル高さを自動調整
        if (data.column.index === 0 && data.cell.text && data.cell.text.length > 0) {
          const text = Array.isArray(data.cell.text) ? data.cell.text.join('\n') : data.cell.text
          const lines = text.split('\n').length
          if (lines > 1) {
            // 複数行の場合はセルの高さを調整
            data.cell.styles.minCellHeight = lines * 5 // 1行あたり5mm
          }
        }
      },
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
    if (invoice.company.issuerName) {
      doc.text(`担当: ${invoice.company.issuerName}`, 20, yPos)
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
