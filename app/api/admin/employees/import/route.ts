import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

// CSVパース処理（手動実装）
function parseCSV(csvText: string): string[][] {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentCell = ''
  let inQuotes = false
  
  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i]
    const nextChar = csvText[i + 1]
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"'
        i++ // 次の"をスキップ
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentCell.trim())
      currentCell = ''
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++ // \r\nをスキップ
      }
      if (currentCell || currentRow.length > 0) {
        currentRow.push(currentCell.trim())
        rows.push(currentRow)
        currentRow = []
        currentCell = ''
      }
    } else {
      currentCell += char
    }
  }
  
  // 最後の行を追加
  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell.trim())
    rows.push(currentRow)
  }
  
  return rows.filter(row => row.some(cell => cell.length > 0))
}

// フォーマット検出
type FormatType = 'rakupochi' | 'general' | 'simple' | 'custom'

function detectFormat(headers: string[]): FormatType {
  const headerStr = headers.join(',')
  
  // らくポチ形式: 勤続年数、有給付与日、有給残数などがある
  if (headers.includes('勤続年数') || headers.includes('有給付与日') || headers.includes('有給残数')) {
    return 'rakupochi'
  }
  
  // 一般的な形式: 社員番号、メールアドレス、部署、役職がある
  if (headers.includes('社員番号') && headers.includes('メールアドレス') && headers.includes('部署')) {
    return 'general'
  }
  
  // シンプル形式: 列数が少ない
  if (headers.length <= 5 && headers.includes('社員番号') && headers.includes('氏名')) {
    return 'simple'
  }
  
  return 'custom'
}

// 列マッピング
const columnMappings = {
  rakupochi: {
    employeeNumber: ['社員番号', 'employeeNumber', '社員No', '社員NO'],
    name: ['氏名', 'name', '名前'],
    department: ['部署', 'department', '所属'],
    position: ['役職', 'position', '職位'],
    email: ['メールアドレス', 'email', 'メール', 'Eメール'],
    phone: ['電話番号', 'phone', '電話', 'TEL'],
    birthDate: ['生年月日', 'birthDate', '誕生日'],
    address: ['住所', 'address'],
    hireDate: ['入社日', 'hireDate', '入社年月日'],
    yearsOfService: ['勤続年数', 'yearsOfService', '勤続'],
    paidLeaveGrantDate: ['有給付与日', 'paidLeaveGrantDate'],
    paidLeaveBalance: ['有給残数', 'paidLeaveBalance', '有給'],
    bankAccount: ['振込先口座', 'bankAccount', '口座'],
    transportationCost: ['交通費', 'transportationCost', '交通'],
    workLocation: ['店舗', 'workLocation', '勤務先'],
    workLocationAddress: ['勤務先住所', 'workLocationAddress'],
    role: ['権限', 'role'],
  },
  general: {
    employeeNumber: ['社員番号', 'employeeNumber', '社員No'],
    name: ['氏名', 'name', '名前'],
    email: ['メールアドレス', 'email', 'メール'],
    phone: ['電話番号', 'phone', '電話'],
    department: ['部署', 'department', '所属'],
    position: ['役職', 'position', '職位'],
    birthDate: ['生年月日', 'birthDate', '誕生日'],
    address: ['住所', 'address'],
    hireDate: ['入社日', 'hireDate'],
    role: ['権限', 'role'],
  },
  simple: {
    employeeNumber: ['社員番号', 'employeeNumber', '社員No'],
    name: ['氏名', 'name', '名前'],
    email: ['メールアドレス', 'email', 'メール'],
    phone: ['電話番号', 'phone', '電話'],
    address: ['住所', 'address'],
  },
}

// 列インデックスを取得
function getColumnIndex(headers: string[], mapping: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i].trim()
    if (mapping.some(m => header === m || header.toLowerCase() === m.toLowerCase())) {
      return i
    }
  }
  return -1
}

// 日付文字列をDateに変換
function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr || dateStr.trim() === '') return null
  
  // 様々な日付形式に対応
  const formats = [
    /^(\d{4})\/(\d{1,2})\/(\d{1,2})/, // YYYY/MM/DD
    /^(\d{4})-(\d{1,2})-(\d{1,2})/, // YYYY-MM-DD
    /^(\d{4})(\d{2})(\d{2})/, // YYYYMMDD
  ]
  
  for (const format of formats) {
    const match = dateStr.match(format)
    if (match) {
      const year = parseInt(match[1])
      const month = parseInt(match[2]) - 1
      const day = parseInt(match[3])
      const date = new Date(year, month, day)
      if (!isNaN(date.getTime())) {
        return date
      }
    }
  }
  
  return null
}

// メールアドレスの形式チェック
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// CSVインポート処理
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'CSVファイルが指定されていません' }, { status: 400 })
    }

    // ファイルサイズチェック（10MB以下）
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'ファイルサイズが大きすぎます（10MB以下）' }, { status: 400 })
    }

    // ファイルタイプチェック
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      return NextResponse.json({ error: 'CSVファイルのみアップロード可能です' }, { status: 400 })
    }

    // CSVファイルを読み込み
    const csvText = await file.text()
    
    // UTF-8 BOM対応
    const cleanText = csvText.replace(/^\uFEFF/, '')
    
    // CSVパース
    const rows = parseCSV(cleanText)
    
    if (rows.length === 0) {
      return NextResponse.json({ error: 'CSVファイルが空です' }, { status: 400 })
    }

    // ヘッダー行の検出
    const firstRow = rows[0]
    const hasHeader = firstRow.some(cell => 
      ['社員番号', 'employeeNumber', '氏名', 'name', 'メールアドレス', 'email'].includes(cell)
    )

    let headers: string[] = []
    let dataRows: string[][] = []

    if (hasHeader) {
      headers = firstRow
      dataRows = rows.slice(1)
    } else {
      // ヘッダー行がない場合、デフォルトのらくポチ形式を想定
      headers = ['社員番号', '氏名', '部署', '役職', 'メールアドレス', '電話番号', '生年月日', '住所', '入社日', '勤続年数', '有給付与日', '有給残数', '振込先口座', '交通費', '店舗', '勤務先住所', '権限']
      dataRows = rows
    }

    // 行数制限チェック（1000行以下）
    if (dataRows.length > 1000) {
      return NextResponse.json({ error: '行数が多すぎます（1000行以下）' }, { status: 400 })
    }

    // フォーマット検出
    const format = detectFormat(headers)
    const mapping = (format === 'custom' ? columnMappings.rakupochi : columnMappings[format]) || columnMappings.rakupochi

    // 列インデックスの取得
    const columnIndices: Record<string, number> = {}
    for (const [key, values] of Object.entries(mapping)) {
      columnIndices[key] = getColumnIndex(headers, values)
    }

    // バリデーションとインポート処理
    const errors: Array<{
      row: number
      employeeNumber: string
      name: string
      error: string
    }> = []

    const successEmployees: Array<{
      employeeNumber: string
      name: string
    }> = []

    let successCount = 0
    let errorCount = 0

    // 既存のメールアドレスと社員番号を事前取得（重複チェック用）
    // メールアドレスはグローバルにユニーク、社員番号は企業ごとにユニーク
    const existingEmployees = await prisma.employee.findMany({
      where: { companyId: session.user.companyId },
      select: { email: true, employeeNumber: true },
    })
    const existingEmails = new Set(existingEmployees.map(e => e.email))
    const existingEmployeeNumbers = new Set(existingEmployees.map(e => e.employeeNumber))
    
    // メールアドレスのグローバルチェック用（他企業のメールアドレスもチェック）
    const allEmails = await prisma.employee.findMany({
      select: { email: true },
    })
    const globalEmails = new Set(allEmails.map(e => e.email))
    
    console.log(`[CSV Import] 既存データ取得完了 - 自社: ${existingEmployees.length}件`)

    // CSVファイル内での重複チェック用（処理中に追加される）
    const csvFileEmails = new Set<string>()
    const csvFileEmployeeNumbers = new Set<string>()

    // デフォルトパスワード生成
    const defaultPassword = 'Password123!' // 固定パスワード（初回ログイン時に変更を促す）

    // 各行を処理
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i]
      const rowNumber = hasHeader ? i + 2 : i + 1 // ヘッダー行を考慮

      // エラーハンドリング用に従業員番号と名前を事前に取得
      const employeeNumberIndex = columnIndices.employeeNumber
      const nameIndex = columnIndices.name
      let currentEmployeeNumber = ''
      let currentName = ''
      let currentEmail = ''
      
      if (employeeNumberIndex !== -1 && row[employeeNumberIndex]) {
        currentEmployeeNumber = row[employeeNumberIndex].trim()
      }
      if (nameIndex !== -1 && row[nameIndex]) {
        currentName = row[nameIndex].trim()
      }

      try {
        // 必須項目の取得
        const emailIndex = columnIndices.email
        const phoneIndex = columnIndices.phone
        const addressIndex = columnIndices.address

        if (employeeNumberIndex === -1 || !currentEmployeeNumber) {
          errors.push({
            row: rowNumber,
            employeeNumber: currentEmployeeNumber,
            name: currentName,
            error: '必須項目が不足しています: 社員番号',
          })
          errorCount++
          continue
        }

        if (nameIndex === -1 || !currentName) {
          errors.push({
            row: rowNumber,
            employeeNumber: currentEmployeeNumber,
            name: '',
            error: '必須項目が不足しています: 氏名',
          })
          errorCount++
          continue
        }

        if (emailIndex === -1 || !row[emailIndex] || row[emailIndex].trim() === '') {
          errors.push({
            row: rowNumber,
            employeeNumber: currentEmployeeNumber,
            name: currentName,
            error: '必須項目が不足しています: メールアドレス',
          })
          errorCount++
          continue
        }

        if (phoneIndex === -1 || !row[phoneIndex] || row[phoneIndex].trim() === '') {
          errors.push({
            row: rowNumber,
            employeeNumber: currentEmployeeNumber,
            name: currentName,
            error: '必須項目が不足しています: 電話番号',
          })
          errorCount++
          continue
        }

        if (addressIndex === -1 || !row[addressIndex] || row[addressIndex].trim() === '') {
          errors.push({
            row: rowNumber,
            employeeNumber: currentEmployeeNumber,
            name: currentName,
            error: '必須項目が不足しています: 住所',
          })
          errorCount++
          continue
        }

        const employeeNumber = currentEmployeeNumber
        const name = currentName
        const email = row[emailIndex].trim()
        currentEmail = email // エラーハンドリング用に保存
        const phone = row[phoneIndex].trim()
        const address = row[addressIndex].trim()

        // メールアドレスの形式チェック
        if (!isValidEmail(email)) {
          errors.push({
            row: rowNumber,
            employeeNumber,
            name,
            error: 'メールアドレスの形式が正しくありません',
          })
          errorCount++
          continue
        }

        // CSVファイル内での重複チェック
        if (csvFileEmails.has(email)) {
          console.log(`[CSV Import] Row ${rowNumber}: CSVファイル内でメールアドレスが重複 - ${email}`)
          errors.push({
            row: rowNumber,
            employeeNumber,
            name,
            error: 'CSVファイル内でメールアドレスが重複しています',
          })
          errorCount++
          continue
        }

        if (csvFileEmployeeNumbers.has(employeeNumber)) {
          console.log(`[CSV Import] Row ${rowNumber}: CSVファイル内で社員番号が重複 - ${employeeNumber}`)
          errors.push({
            row: rowNumber,
            employeeNumber,
            name,
            error: 'CSVファイル内で社員番号が重複しています',
          })
          errorCount++
          continue
        }

        // 既存データとの重複チェック
        // メールアドレスはグローバルにユニーク
        if (globalEmails.has(email)) {
          const isOwnCompany = existingEmails.has(email)
          console.log(`[CSV Import] Row ${rowNumber}: 既存データでメールアドレスが重複 - ${email} (自社: ${isOwnCompany})`)
          errors.push({
            row: rowNumber,
            employeeNumber,
            name,
            error: isOwnCompany 
              ? 'メールアドレスが既に登録されています（自社内）'
              : 'メールアドレスが既に登録されています（他社で使用中）',
          })
          errorCount++
          continue
        }

        // 社員番号は企業ごとにユニーク（自社内のみチェック）
        if (existingEmployeeNumbers.has(employeeNumber)) {
          console.log(`[CSV Import] Row ${rowNumber}: 既存データで社員番号が重複 - ${employeeNumber}`)
          errors.push({
            row: rowNumber,
            employeeNumber,
            name,
            error: '社員番号が既に登録されています（自社内）',
          })
          errorCount++
          continue
        }

        console.log(`[CSV Import] Row ${rowNumber}: 重複チェック通過 - 社員番号: ${employeeNumber}, メール: ${email}`)
        console.log(`[CSV Import] Row ${rowNumber}: 既存社員番号セット内容:`, Array.from(existingEmployeeNumbers))
        console.log(`[CSV Import] Row ${rowNumber}: チェック対象社員番号: ${employeeNumber}, 存在: ${existingEmployeeNumbers.has(employeeNumber)}`)

        // オプション項目の取得
        const department = columnIndices.department !== -1 ? (row[columnIndices.department] || '').trim() : ''
        const position = columnIndices.position !== -1 ? (row[columnIndices.position] || '').trim() : ''
        const birthDateStr = columnIndices.birthDate !== -1 ? row[columnIndices.birthDate] : null
        const hireDateStr = columnIndices.hireDate !== -1 ? row[columnIndices.hireDate] : null
        const yearsOfServiceStr = columnIndices.yearsOfService !== -1 ? row[columnIndices.yearsOfService] : null
        const paidLeaveGrantDateStr = columnIndices.paidLeaveGrantDate !== -1 ? row[columnIndices.paidLeaveGrantDate] : null
        const paidLeaveBalanceStr = columnIndices.paidLeaveBalance !== -1 ? row[columnIndices.paidLeaveBalance] : null
        const bankAccount = columnIndices.bankAccount !== -1 ? (row[columnIndices.bankAccount] || '').trim() : ''
        const transportationCostStr = columnIndices.transportationCost !== -1 ? row[columnIndices.transportationCost] : null
        const workLocation = columnIndices.workLocation !== -1 ? (row[columnIndices.workLocation] || '').trim() : ''
        const workLocationAddress = columnIndices.workLocationAddress !== -1 ? (row[columnIndices.workLocationAddress] || '').trim() : ''
        const role = columnIndices.role !== -1 ? (row[columnIndices.role] || '').trim() : 'employee'

        // 日付のパース
        const birthDate = parseDate(birthDateStr)
        const hireDate = parseDate(hireDateStr)
        const paidLeaveGrantDate = parseDate(paidLeaveGrantDateStr)

        // 数値のパース
        const yearsOfService = yearsOfServiceStr ? parseFloat(yearsOfServiceStr) : null
        const paidLeaveBalance = paidLeaveBalanceStr ? parseInt(paidLeaveBalanceStr) : 0
        const transportationCost = transportationCostStr ? parseInt(transportationCostStr) : null

        // 勤続年数から有給付与日を自動計算
        let calculatedGrantDate = paidLeaveGrantDate
        if (hireDate && yearsOfService && !paidLeaveGrantDate) {
          const grantDate = new Date(hireDate)
          grantDate.setFullYear(grantDate.getFullYear() + Math.floor(yearsOfService))
          grantDate.setMonth(grantDate.getMonth() + Math.floor((yearsOfService % 1) * 12))
          calculatedGrantDate = grantDate
        } else if (hireDate && !paidLeaveGrantDate) {
          calculatedGrantDate = hireDate
        }

        // パスワードのハッシュ化
        const hashedPassword = await bcrypt.hash(defaultPassword, 10)

        // 従業員の作成
        console.log(`[CSV Import] Row ${rowNumber}: 従業員作成開始 - 社員番号: ${employeeNumber}, メール: ${email}`)
        await prisma.employee.create({
          data: {
            companyId: session.user.companyId,
            employeeNumber,
            name,
            email,
            password: hashedPassword,
            role: role || 'employee',
            department: department || null,
            workLocation: workLocation || null,
            workLocationAddress: workLocationAddress || null,
            position: position || null,
            phone,
            birthDate,
            address,
            bankAccount: bankAccount || null,
            transportationCost,
            hireDate,
            paidLeaveGrantDate: calculatedGrantDate,
            yearsOfService,
            paidLeaveBalance,
            isActive: true,
          },
        })
        console.log(`[CSV Import] Row ${rowNumber}: 従業員作成成功 - 社員番号: ${employeeNumber}`)

        // 成功した従業員を記録
        successEmployees.push({ employeeNumber, name })
        successCount++

        // 既存リストに追加（重複チェック用）
        existingEmails.add(email)
        existingEmployeeNumbers.add(employeeNumber)
        // CSVファイル内の重複チェック用にも追加
        csvFileEmails.add(email)
        csvFileEmployeeNumbers.add(employeeNumber)

      } catch (error: any) {
        console.error(`Row ${rowNumber} error:`, error)
        console.error(`Row ${rowNumber} error details:`, {
          code: error.code,
          message: error.message,
          meta: error.meta,
          employeeNumber: currentEmployeeNumber,
          name: currentName,
        })
        
        let errorMessage = 'インポート処理中にエラーが発生しました'
        
        if (error.code === 'P2002') {
          // ユニーク制約違反
          const target = error.meta?.target || []
          console.log(`[CSV Import] Row ${rowNumber}: P2002エラー - target: ${target.join(', ')}, 社員番号: ${currentEmployeeNumber}, メール: ${currentEmail}`)
          
          if (target.includes('employeeNumber') || (target.length === 2 && target.includes('companyId') && target.includes('employeeNumber'))) {
            // データベースレベルでの制約違反
            // 重複チェックを通過したのにエラーが出た場合、実際にデータベースを再確認
            console.log(`[CSV Import] Row ${rowNumber}: 既存社員番号セット:`, Array.from(existingEmployeeNumbers))
            console.log(`[CSV Import] Row ${rowNumber}: チェック対象: ${currentEmployeeNumber}, 存在: ${existingEmployeeNumbers.has(currentEmployeeNumber)}`)
            
            // データベースに実際に存在するか確認（自社内）
            try {
              const dbCheck = await prisma.employee.findFirst({
                where: {
                  employeeNumber: currentEmployeeNumber,
                  companyId: session.user.companyId,
                },
                select: { employeeNumber: true, name: true },
              })
              
              if (dbCheck) {
                errorMessage = '社員番号が既に登録されています（自社内）'
                // 既存リストに追加して、次回のチェックで検出できるようにする
                existingEmployeeNumbers.add(currentEmployeeNumber)
                console.log(`[CSV Import] Row ${rowNumber}: データベース確認 - 自社内に存在: ${currentEmployeeNumber}`)
              } else {
                // データベースには存在しないが、制約違反が発生
                // これは、グローバルユニーク制約が残っている可能性がある
                // または、データベースの制約が正しく更新されていない可能性
                console.error(`[CSV Import] Row ${rowNumber}: データベース制約エラー - 自社内に存在しないのに制約違反`)
                console.error(`[CSV Import] Row ${rowNumber}: エラー詳細 - target: ${JSON.stringify(error.meta?.target)}`)
                
                // 他企業で同じ社員番号が使用されているか確認
                try {
                  const otherCompanyCheck = await prisma.employee.findFirst({
                    where: {
                      employeeNumber: currentEmployeeNumber,
                      companyId: { not: session.user.companyId },
                    },
                    select: { employeeNumber: true, companyId: true },
                  })
                  
                  if (otherCompanyCheck) {
                    // 他企業で同じ社員番号が使用されている
                    // これは、グローバルユニーク制約が残っていることを示す
                    console.error(`[CSV Import] Row ${rowNumber}: 他企業で同じ社員番号が使用されています - 企業ID: ${otherCompanyCheck.companyId}`)
                    errorMessage = `社員番号「${currentEmployeeNumber}」の登録に失敗しました。データベースにグローバルユニーク制約が残っている可能性があります。制約を修正してください。`
                  } else {
                    // より詳細なエラーメッセージ
                    if (error.meta?.target && error.meta.target.includes('companyId')) {
                      // 複合ユニーク制約のエラー（これは正常な動作）
                      errorMessage = `社員番号「${currentEmployeeNumber}」は既に登録されています（自社内）`
                    } else {
                      // グローバルユニーク制約のエラー（マイグレーション未完了の可能性）
                      errorMessage = `社員番号「${currentEmployeeNumber}」の登録に失敗しました。データベースの制約設定を確認してください。fix_employee_number_constraint.sqlを実行してください。`
                    }
                  }
                } catch (otherCompanyCheckError: any) {
                  console.error(`[CSV Import] Row ${rowNumber}: 他企業チェックエラー:`, otherCompanyCheckError)
                  errorMessage = `社員番号「${currentEmployeeNumber}」の登録に失敗しました。データベースの制約を確認してください。fix_employee_number_constraint.sqlを実行してください。`
                }
              }
            } catch (dbCheckError: any) {
              console.error(`[CSV Import] Row ${rowNumber}: データベース確認エラー:`, dbCheckError)
              errorMessage = `社員番号「${currentEmployeeNumber}」の登録に失敗しました。データベースの制約を確認してください。`
            }
          } else if (target.includes('email')) {
            if (currentEmail && globalEmails.has(currentEmail)) {
              errorMessage = 'メールアドレスが既に登録されています'
            } else {
              errorMessage = 'メールアドレスの登録に失敗しました。データベースの制約を確認してください。'
            }
          } else {
            errorMessage = `既に登録されているデータがあります（${target.join(', ')}）`
          }
        } else if (error.message) {
          errorMessage = `インポート処理中にエラーが発生しました: ${error.message}`
        }
        
        errors.push({
          row: rowNumber,
          employeeNumber: currentEmployeeNumber || '不明',
          name: currentName || '不明',
          error: errorMessage,
        })
        errorCount++
      }
    }

    return NextResponse.json({
      success: true,
      total: dataRows.length,
      successCount,
      errorCount,
      errors,
      successEmployees,
      format,
    })

  } catch (error: any) {
    console.error('CSV import error:', error)
    return NextResponse.json(
      { error: 'CSVインポート処理中にエラーが発生しました', details: error.message },
      { status: 500 }
    )
  }
}

