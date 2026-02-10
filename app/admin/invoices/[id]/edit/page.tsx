'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

interface BillingClient {
  id: number
  name: string
  taxRate: number
}

interface Employee {
  id: number
  name: string
  employeeNumber: string
  billingRateType?: string | null
  baseWorkDays?: number | null
  workLocation?: string | null
  invoiceItemName?: string | null
  businessName?: string | null
}

interface InvoiceDetail {
  id: number
  employeeId: number | null
  itemName?: string | null // 費目名（手動追加の費目項目の場合）
  workDays: number
  basicRate: number
  basicAmount: number
  overtimeHours: number | null
  overtimeRate: number | null
  overtimeAmount: number | null
  absenceDays: number | null
  absenceDeduction: number | null
  lateEarlyDeduction: number | null
  subtotal: number
  notes?: string | null // 備考
  employee?: Employee | null
}

interface Company {
  id: number
  name: string
  taxId: string | null
  invoiceItemNameTemplate: string | null
}

interface Invoice {
  id: number
  invoiceNumber: string
  subject: string
  periodStart: string
  periodEnd: string
  paymentTerms: string
  dueDate: string
  subtotal: number
  taxAmount: number
  totalAmount: number
  transportationCost: number | null
  adjustmentAmount: number | null
  billingClientName: string | null
  status: string
  issuedAt: string | null
  createdAt: string
  company: Company
  billingClient: BillingClient
  details: InvoiceDetail[]
}

export default function EditInvoicePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const invoiceId = params?.id as string

  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [issuing, setIssuing] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [formData, setFormData] = useState({
    subject: '',
    periodStart: '',
    periodEnd: '',
    paymentTerms: '',
    dueDate: '',
    transportationCost: '0',
    adjustmentAmount: '0',
    billingClientName: '',
    taxRate: '10', // 税率（%）
  })
  const [details, setDetails] = useState<InvoiceDetail[]>([])
  const [employeeInfo, setEmployeeInfo] = useState<Map<number, { billingRateType: string | null, baseWorkDays: number | null }>>(new Map())

  useEffect(() => {
    if (status === 'authenticated') {
      const isAdmin = session?.user.role === 'admin'
      const isSuperAdmin = session?.user.role === 'super_admin' || 
                          session?.user.email === 'superadmin@rakupochi.com'
      
      if (isAdmin || (isSuperAdmin && session?.user.selectedCompanyId)) {
        fetchSettings()
      }
    }
  }, [status, session])

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/admin/settings')
      if (response.ok) {
        const data = await response.json()
        const invoiceEnabled = data.settings?.enableInvoice ?? false
        if (invoiceEnabled && invoiceId) {
          fetchInvoice()
        } else {
          // enableInvoiceがfalseの場合はダッシュボードにリダイレクト
          router.push('/admin/dashboard')
        }
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err)
    }
  }

  const fetchInvoice = async () => {
    try {
      const response = await fetch(`/api/admin/invoices/${invoiceId}`)
      if (response.ok) {
        const data = await response.json()
        const invoiceData = data.invoice as Invoice
        
        // 日付をフォーマット（YYYY-MM-DD形式）
        const formatDate = (dateStr: string | Date) => {
          if (!dateStr) return ''
          const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr
          return date.toISOString().split('T')[0]
        }

        setInvoice(invoiceData)
        setFormData({
          subject: invoiceData.subject,
          periodStart: formatDate(invoiceData.periodStart),
          periodEnd: formatDate(invoiceData.periodEnd),
          paymentTerms: invoiceData.paymentTerms,
          dueDate: formatDate(invoiceData.dueDate),
          transportationCost: String(invoiceData.transportationCost || 0),
          adjustmentAmount: String(invoiceData.adjustmentAmount || 0),
          billingClientName: invoiceData.billingClientName || invoiceData.billingClient.name || '',
          taxRate: String(Math.round((invoiceData.billingClient.taxRate || 0.1) * 100)),
        })
        setDetails(invoiceData.details || [])
        
        // 従業員情報を取得（請求単価タイプと標準稼働日数）
        const employeeIds = invoiceData.details
          .map(d => d.employeeId)
          .filter((id): id is number => id !== null)
        if (employeeIds.length > 0) {
          fetchEmployeeInfo(employeeIds)
        }
      } else {
        alert('請求書の取得に失敗しました')
        router.push('/admin/invoices')
      }
    } catch (err) {
      console.error('Failed to fetch invoice:', err)
      alert('請求書の取得に失敗しました')
      router.push('/admin/invoices')
    } finally {
      setLoading(false)
    }
  }

  const fetchEmployeeInfo = async (employeeIds: number[]) => {
    try {
      const response = await fetch('/api/admin/employees')
      if (response.ok) {
        const data = await response.json()
        const employees = data.employees || []
        const infoMap = new Map<number, { billingRateType: string | null, baseWorkDays: number | null }>()
        
        employees.forEach((emp: any) => {
          if (employeeIds.includes(emp.id)) {
            infoMap.set(emp.id, {
              billingRateType: emp.billingRateType || 'daily',
              baseWorkDays: emp.baseWorkDays || 21,
            })
          }
        })
        
        setEmployeeInfo(infoMap)
      }
    } catch (err) {
      console.error('Failed to fetch employee info:', err)
    }
  }

  const handleDetailChange = (index: number, field: string, value: string | number) => {
    const updatedDetails = [...details]
    const detail = updatedDetails[index]
    
    // 手動追加の費目項目（employeeIdがnull）の場合の処理
    if (field === 'itemName') {
      detail.itemName = String(value) || null
    } else if (field === 'workDays') {
      detail.workDays = parseInt(String(value)) || 0
      // 基本金額を再計算（請求単価タイプに応じて）
      if (detail.employeeId && detail.employeeId !== null) {
        const empInfo = employeeInfo.get(detail.employeeId)
        const billingRateType = empInfo?.billingRateType || 'daily'
        const baseWorkDays = empInfo?.baseWorkDays || 21
        
        if (billingRateType === 'monthly') {
          // 月給の場合：実際の勤務日数で按分
          detail.basicAmount = Math.round((detail.basicRate / baseWorkDays) * detail.workDays)
        } else {
          // 日給・時給の場合：勤務日数 × 単価
          detail.basicAmount = detail.workDays * detail.basicRate
        }
      } else {
        // 手動追加の費目項目の場合：数量 × 単価
        detail.basicAmount = detail.workDays * detail.basicRate
      }
    } else if (field === 'basicRate') {
      detail.basicRate = parseInt(String(value)) || 0
      // 基本金額を再計算（請求単価タイプに応じて）
      if (detail.employeeId && detail.employeeId !== null) {
        const empInfo = employeeInfo.get(detail.employeeId)
        const billingRateType = empInfo?.billingRateType || 'daily'
        const baseWorkDays = empInfo?.baseWorkDays || 21
        
        if (billingRateType === 'monthly') {
          // 月給の場合：実際の勤務日数で按分
          detail.basicAmount = Math.round((detail.basicRate / baseWorkDays) * detail.workDays)
        } else {
          // 日給・時給の場合：勤務日数 × 単価
          detail.basicAmount = detail.workDays * detail.basicRate
        }
      } else {
        // 手動追加の費目項目の場合：数量 × 単価
        detail.basicAmount = detail.workDays * detail.basicRate
      }
    } else if (field === 'basicAmount') {
      detail.basicAmount = parseInt(String(value)) || 0
    } else if (field === 'overtimeHours') {
      detail.overtimeHours = parseFloat(String(value)) || 0
      // 残業金額を再計算
      if (detail.overtimeRate && detail.basicRate) {
        detail.overtimeAmount = Math.round(detail.overtimeHours * detail.basicRate * detail.overtimeRate)
      }
    } else if (field === 'overtimeAmount') {
      detail.overtimeAmount = parseInt(String(value)) || 0
    } else if (field === 'absenceDays') {
      detail.absenceDays = parseInt(String(value)) || 0
      // 欠勤減算額を再計算（請求単価タイプに応じて）
      if (detail.employeeId && detail.employeeId !== null) {
        const empInfo = employeeInfo.get(detail.employeeId)
        const billingRateType = empInfo?.billingRateType || 'daily'
        const baseWorkDays = empInfo?.baseWorkDays || 21
        
        let dailyRate = 0
        if (billingRateType === 'hourly') {
          // 時給の場合：1日8時間として日額を計算
          dailyRate = detail.basicRate * 8
        } else if (billingRateType === 'daily') {
          // 日給の場合：基本単価そのまま
          dailyRate = detail.basicRate
        } else if (billingRateType === 'monthly') {
          // 月給の場合：月給を標準稼働日数で割った日額
          dailyRate = detail.basicRate / baseWorkDays
        } else {
          // デフォルトは日給
          dailyRate = detail.basicRate
        }
        
        detail.absenceDeduction = Math.round(detail.absenceDays * dailyRate)
      }
    } else if (field === 'absenceDeduction') {
      detail.absenceDeduction = parseInt(String(value)) || 0
    } else if (field === 'lateEarlyDeduction') {
      detail.lateEarlyDeduction = parseInt(String(value)) || 0
    } else if (field === 'notes') {
      detail.notes = String(value) || null
    }

    // 小計を再計算
    detail.subtotal = Math.max(0, 
      (detail.basicAmount || 0) + 
      (detail.overtimeAmount || 0) - 
      (detail.absenceDeduction || 0) - 
      (detail.lateEarlyDeduction || 0)
    )

    updatedDetails[index] = detail
    setDetails(updatedDetails)
  }

  // 費目項目を手動で追加
  const handleAddManualItem = () => {
    const newItem: InvoiceDetail = {
      id: Date.now(), // 一時的なID
      employeeId: null,
      itemName: '',
      workDays: 1, // 数量として使用
      basicRate: 0,
      basicAmount: 0,
      overtimeHours: null,
      overtimeRate: null,
      overtimeAmount: null,
      absenceDays: null,
      absenceDeduction: null,
      lateEarlyDeduction: null,
      subtotal: 0,
      notes: null,
      employee: null,
    }
    setDetails([...details, newItem])
  }

  // 費目項目を削除
  const handleDeleteItem = (index: number) => {
    if (confirm('この費目項目を削除しますか？')) {
      const updatedDetails = [...details]
      updatedDetails.splice(index, 1)
      setDetails(updatedDetails)
    }
  }

  const calculateTotals = () => {
    if (!invoice) return { subtotal: 0, taxAmount: 0, totalAmount: 0 }

    // 明細の小計の合計
    const detailsSubtotal = details.reduce((sum, detail) => sum + (detail.subtotal || 0), 0)
    
    // 交通費と調整金額を加算
    const transportationCost = parseInt(formData.transportationCost) || 0
    const adjustmentAmount = parseInt(formData.adjustmentAmount) || 0
    const subtotal = detailsSubtotal + transportationCost + adjustmentAmount

    // 消費税を計算（フォームの税率を使用）
    const taxRate = (parseInt(formData.taxRate) || 10) / 100
    const taxAmount = Math.round(subtotal * taxRate)
    const totalAmount = subtotal + taxAmount

    return { subtotal, taxAmount, totalAmount }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!invoice) return

    // バリデーション
    if (!formData.periodStart || !formData.periodEnd || !formData.dueDate) {
      alert('請求期間とお支払い期日を入力してください')
      return
    }

    // 日付の妥当性チェック
    const periodStart = new Date(formData.periodStart)
    const periodEnd = new Date(formData.periodEnd)
    const dueDate = new Date(formData.dueDate)

    if (periodStart > periodEnd) {
      alert('請求期間開始日は請求期間終了日より前である必要があります')
      return
    }

    if (dueDate < periodEnd) {
      alert('お支払い期日は請求期間終了日以降である必要があります')
      return
    }

    // 明細のバリデーション
    if (details.length === 0) {
      alert('請求明細がありません')
      return
    }

    for (const detail of details) {
      if (detail.workDays < 0) {
        const itemName = detail.itemName || detail.employee?.name || '費目項目'
        alert(`${itemName}の数量が不正です`)
        return
      }
      if (detail.basicRate < 0) {
        const itemName = detail.itemName || detail.employee?.name || '費目項目'
        alert(`${itemName}の単価が不正です`)
        return
      }
      // 手動追加の費目項目の場合、費目名が必須
      if (!detail.employeeId && !detail.itemName) {
        alert('費目名を入力してください')
        return
      }
    }

    setSaving(true)
    try {
      const { subtotal, taxAmount, totalAmount } = calculateTotals()

      // 明細データを準備
      const detailsData = details.map(detail => ({
        employeeId: detail.employeeId || null,
        itemName: detail.itemName || null,
        workDays: detail.workDays,
        basicRate: detail.basicRate,
        basicAmount: detail.basicAmount,
        overtimeHours: detail.overtimeHours || 0,
        overtimeRate: detail.overtimeRate,
        overtimeAmount: detail.overtimeAmount || 0,
        absenceDays: detail.absenceDays || 0,
        absenceDeduction: detail.absenceDeduction || 0,
        lateEarlyDeduction: detail.lateEarlyDeduction || 0,
        subtotal: detail.subtotal,
        notes: detail.notes || null,
      }))

      // 請求書を更新
      const response = await fetch(`/api/admin/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: formData.subject,
          periodStart: formData.periodStart,
          periodEnd: formData.periodEnd,
          paymentTerms: formData.paymentTerms,
          dueDate: formData.dueDate,
          subtotal,
          taxAmount,
          totalAmount,
          transportationCost: parseInt(formData.transportationCost) || 0,
          adjustmentAmount: parseInt(formData.adjustmentAmount) || 0,
          billingClientName: formData.billingClientName || null,
          status: invoice.status, // 現在のステータスを維持
          details: detailsData,
        }),
      })

      const data = await response.json()
      if (data.success) {
        alert('請求書を保存しました')
        // データを再取得して最新の状態を反映
        fetchInvoice()
      } else {
        const errorMessage = data.error || '請求書の保存に失敗しました'
        console.error('Failed to save invoice:', errorMessage)
        alert(errorMessage)
      }
    } catch (err: any) {
      console.error('Failed to save invoice:', err)
      const errorMessage = err?.message || 'ネットワークエラーが発生しました。接続を確認してください。'
      alert(`請求書の保存に失敗しました: ${errorMessage}`)
    } finally {
      setSaving(false)
    }
  }

  const handlePreviewPDF = async () => {
    if (!invoice) return

    // まず現在の変更を保存
    const { subtotal, taxAmount, totalAmount } = calculateTotals()
    const detailsData = details.map(detail => ({
      employeeId: detail.employeeId,
      workDays: detail.workDays,
      basicRate: detail.basicRate,
      basicAmount: detail.basicAmount,
      overtimeHours: detail.overtimeHours || 0,
      overtimeRate: detail.overtimeRate,
      overtimeAmount: detail.overtimeAmount || 0,
      absenceDays: detail.absenceDays || 0,
      absenceDeduction: detail.absenceDeduction || 0,
      lateEarlyDeduction: detail.lateEarlyDeduction || 0,
      subtotal: detail.subtotal,
      notes: detail.notes || null,
    }))

    try {
      // 一時的に保存（プレビュー用）
      const saveResponse = await fetch(`/api/admin/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: formData.subject,
          periodStart: formData.periodStart,
          periodEnd: formData.periodEnd,
          paymentTerms: formData.paymentTerms,
          dueDate: formData.dueDate,
          subtotal,
          taxAmount,
          totalAmount,
          transportationCost: parseInt(formData.transportationCost) || 0,
          adjustmentAmount: parseInt(formData.adjustmentAmount) || 0,
          status: invoice.status, // ステータスは変更しない
          details: detailsData,
        }),
      })

      if (!saveResponse.ok) {
        const errorData = await saveResponse.json().catch(() => ({}))
        const errorMessage = errorData.error || 'データの保存に失敗しました'
        alert(errorMessage)
        return
      }

      // PDFを新しいウィンドウで開く
      const pdfUrl = `/api/admin/invoices/${invoiceId}/pdf`
      window.open(pdfUrl, '_blank')
    } catch (err: any) {
      console.error('Failed to preview PDF:', err)
      const errorMessage = err?.message || 'ネットワークエラーが発生しました。接続を確認してください。'
      alert(`PDFのプレビューに失敗しました: ${errorMessage}`)
    }
  }

  const handleDownloadPDF = async () => {
    if (!invoice) return

    setDownloading(true)
    try {
      const response = await fetch(`/api/admin/invoices/${invoiceId}/pdf`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `invoice-${invoice.invoiceNumber}.pdf`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error || 'PDFのダウンロードに失敗しました'
        console.error('Failed to download PDF:', errorMessage)
        alert(errorMessage)
      }
    } catch (err: any) {
      console.error('Failed to download PDF:', err)
      const errorMessage = err?.message || 'ネットワークエラーが発生しました。接続を確認してください。'
      alert(`PDFのダウンロードに失敗しました: ${errorMessage}`)
    } finally {
      setDownloading(false)
    }
  }

  const handleIssue = async () => {
    if (!invoice) return

    if (!confirm('請求書を発行しますか？発行後はステータスが「発行済み」に変更されます。')) {
      return
    }

    setIssuing(true)
    try {
      // まず保存
      const { subtotal, taxAmount, totalAmount } = calculateTotals()

      const detailsData = details.map(detail => ({
        employeeId: detail.employeeId,
        workDays: detail.workDays,
        basicRate: detail.basicRate,
        basicAmount: detail.basicAmount,
        overtimeHours: detail.overtimeHours || 0,
        overtimeRate: detail.overtimeRate,
        overtimeAmount: detail.overtimeAmount || 0,
        absenceDays: detail.absenceDays || 0,
        absenceDeduction: detail.absenceDeduction || 0,
        lateEarlyDeduction: detail.lateEarlyDeduction || 0,
        subtotal: detail.subtotal,
        notes: detail.notes || null,
      }))

      // 請求書を発行済みに更新
      const response = await fetch(`/api/admin/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: formData.subject,
          periodStart: formData.periodStart,
          periodEnd: formData.periodEnd,
          paymentTerms: formData.paymentTerms,
          dueDate: formData.dueDate,
          subtotal,
          taxAmount,
          totalAmount,
          transportationCost: parseInt(formData.transportationCost) || 0,
          adjustmentAmount: parseInt(formData.adjustmentAmount) || 0,
          status: 'issued', // 発行済みに変更
          details: detailsData,
        }),
      })

      const data = await response.json()
      if (data.success) {
        alert('請求書を発行しました')
        // データを再取得
        await fetchInvoice()
        // PDFをダウンロード
        await handleDownloadPDF()
      } else {
        const errorMessage = data.error || '請求書の発行に失敗しました'
        console.error('Failed to issue invoice:', errorMessage)
        alert(errorMessage)
      }
    } catch (err: any) {
      console.error('Failed to issue invoice:', err)
      const errorMessage = err?.message || 'ネットワークエラーが発生しました。接続を確認してください。'
      alert(`請求書の発行に失敗しました: ${errorMessage}`)
    } finally {
      setIssuing(false)
    }
  }

  const { subtotal, taxAmount, totalAmount } = calculateTotals()

  if (status === 'loading' || loading) {
    return <div className="p-8 text-center text-gray-900">読み込み中...</div>
  }

  if (!invoice) {
    return <div className="p-8 text-center text-gray-900">請求書が見つかりません</div>
  }

  // PDFと同じ形式で明細データを生成する関数
  const getInvoiceItems = () => {
    const items: Array<{
      id: number
      detailIndex: number
      type: 'basic' | 'lateEarly' | 'absence' | 'manual'
      itemName: string
      unitPrice: number
      quantity: number
      amount: number
      taxRate: number
      note: string
      detail: InvoiceDetail
    }> = []

    const itemNameTemplate = invoice.company.invoiceItemNameTemplate || '{businessName}委託費用'
    const taxRate = parseInt(formData.taxRate) || Math.round((invoice.billingClient.taxRate || 0.1) * 100)

    details.forEach((detail, detailIndex) => {
      // 費目を決定（手動追加の費目項目 > 従業員の設定 > 業務名 > テンプレート）
      let itemName: string
      if (detail.itemName) {
        // 手動で追加された費目名を使用
        itemName = detail.itemName
      } else if (detail.employee) {
        // 従業員の設定から取得
        if (detail.employee.invoiceItemName) {
          itemName = detail.employee.invoiceItemName
        } else if (detail.employee.businessName) {
          // 業務名を使用して「{業務名}委託費用」という形式で生成
          itemName = `${detail.employee.businessName}委託費用`
        } else {
          // テンプレートから生成（{businessName}を業務名で置換、業務名がない場合は従業員名でフォールバック）
          const businessName = detail.employee.businessName || detail.employee.name
          itemName = itemNameTemplate.replace(/{businessName}/g, businessName)
        }
      } else {
        // 従業員がnullの場合は費目名を使用（空文字列も許可）
        itemName = detail.itemName || ''
      }

      // 従業員名と店舗情報を補足に含める
      const employeeNote = detail.employee 
        ? (detail.employee.workLocation 
          ? `${detail.employee.workLocation} ${detail.employee.name}`
          : detail.employee.name)
        : detail.notes || ''

      // 手動追加の費目項目の場合
      if (!detail.employeeId) {
        const basicInvoiceAmount = detail.basicAmount + (detail.overtimeAmount || 0)
        items.push({
          id: detail.id,
          detailIndex,
          type: 'manual',
          itemName: itemName,
          unitPrice: detail.basicRate,
          quantity: detail.workDays,
          amount: basicInvoiceAmount,
          taxRate,
          note: detail.notes || '',
          detail,
        })
      } else {
        // 基本請求金額行を追加（基本単価 × 勤務日数 + 残業金額）
        const basicInvoiceAmount = detail.basicAmount + (detail.overtimeAmount || 0)
        items.push({
          id: detail.id * 1000 + 1, // 一意のIDを生成
          detailIndex,
          type: 'basic',
          itemName: itemName,
          unitPrice: detail.basicRate,
          quantity: 1,
          amount: basicInvoiceAmount,
          taxRate,
          note: employeeNote,
          detail,
        })

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
          
          items.push({
            id: detail.id * 1000 + 2,
            detailIndex,
            type: 'lateEarly',
            itemName: '遅刻早退',
            unitPrice: 0,
            quantity: 0,
            amount: -detail.lateEarlyDeduction,
            taxRate,
            note: lateEarlyNote,
            detail,
          })
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
          
          items.push({
            id: detail.id * 1000 + 3,
            detailIndex,
            type: 'absence',
            itemName: '欠勤',
            unitPrice: 0,
            quantity: 0,
            amount: -detail.absenceDeduction,
            taxRate,
            note: absenceNote,
            detail,
          })
        }
      }
    })

    return items
  }

  const invoiceItems = getInvoiceItems()

  // 日付フォーマット関数
  const formatDate = (dateStr: string | Date) => {
    if (!dateStr) return ''
    const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}/${month}/${day}`
  }

  const createdDate = invoice.issuedAt ? new Date(invoice.issuedAt) : new Date(invoice.createdAt)
  const billingClientName = formData.billingClientName || invoice.billingClient.name || ''

  return (
    <div className="p-4 bg-gray-100 min-h-screen">
      <div className="max-w-4xl mx-auto">
        {/* ヘッダー（編集用） */}
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-bold text-gray-900">請求書編集</h1>
          <Link
            href="/admin/invoices"
            className="px-4 py-2 bg-gray-200 text-gray-900 rounded-md hover:bg-gray-300 font-medium text-sm"
          >
            一覧に戻る
          </Link>
        </div>

        <form onSubmit={handleSubmit}>
          {/* 請求書フォーマット（PDFと同じレイアウト） */}
          <div className="bg-white shadow-lg p-8 mb-6" style={{ minHeight: '297mm' }}>
            {/* 作成日（右上） */}
            <div className="text-right text-sm text-gray-600 mb-4">
              作成日: {formatDate(createdDate)}
            </div>

            {/* タイトル「請求書」（中央、大きめ） */}
            <h1 className="text-4xl font-bold text-center mb-8 text-gray-900">請求書</h1>

            {/* 請求先企業名 + 「御中」 */}
            <div className="mb-4">
              <input
                type="text"
                value={billingClientName}
                onChange={(e) => setFormData({ ...formData, billingClientName: e.target.value })}
                placeholder={invoice.billingClient.name || ''}
                className="text-xl font-medium text-gray-900 border-b-2 border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none bg-transparent"
                style={{ minWidth: '300px' }}
              />
              <span className="text-xl font-medium text-gray-900 ml-2">御中</span>
            </div>

            {/* 「下記の通りご請求致しますのでご査収下さい。」 */}
            <p className="text-base mb-6 text-gray-900">下記の通りご請求致しますのでご査収下さい。</p>

            {/* 「ご請求金額」+ 大きな金額表示 */}
            <div className="mb-8">
              <p className="text-base text-gray-900 mb-2">ご請求金額</p>
              <p className="text-3xl font-bold text-gray-900">¥{totalAmount.toLocaleString()}</p>
            </div>

            {/* 件名、代金決済条件、お支払い期日 */}
            <div className="mb-6 space-y-2 text-sm text-gray-900">
              <div className="flex">
                <span className="w-24 font-medium">件名</span>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="flex-1 border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none bg-transparent"
                />
              </div>
              <div className="flex">
                <span className="w-24 font-medium">代金決済条件</span>
                <input
                  type="text"
                  value={formData.paymentTerms}
                  onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                  className="flex-1 border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none bg-transparent"
                />
              </div>
              <div className="flex">
                <span className="w-24 font-medium">お支払い期日</span>
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  className="flex-1 border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none bg-transparent"
                />
              </div>
            </div>

            {/* 請求番号と適格番号 */}
            <div className="mb-4 text-xs text-gray-600 flex justify-between">
              <span>請求番号: {invoice.invoiceNumber}</span>
              {invoice.company.taxId && <span>適格番号: {invoice.company.taxId}</span>}
            </div>

            {/* 請求期間 */}
            <div className="mb-4 text-xs text-gray-600">
              <span>請求期間: {formatDate(formData.periodStart)} ～ {formatDate(formData.periodEnd)}</span>
            </div>

            {/* 明細テーブル（費目、単価、数量、金額、適用税率、補足） */}
            <div className="mb-6">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300 text-sm table-fixed">
                  <colgroup>
                    <col className="w-[25%]" /> {/* 費目 */}
                    <col className="w-[12%]" /> {/* 単価(税抜) */}
                    <col className="w-[6%]" /> {/* 数量 */}
                    <col className="w-[12%]" /> {/* 金額(税抜) */}
                    <col className="w-[8%]" /> {/* 適用税率 */}
                    <col className="w-[30%]" /> {/* 補足 */}
                    <col className="w-[7%]" /> {/* 削除ボタン */}
                  </colgroup>
                  <thead>
                    <tr className="bg-blue-600 text-white">
                      <th className="border border-gray-300 px-2 py-2 text-left">費目</th>
                      <th className="border border-gray-300 px-2 py-2 text-right">単価(税抜)</th>
                      <th className="border border-gray-300 px-2 py-2 text-center">数量</th>
                      <th className="border border-gray-300 px-2 py-2 text-right">金額(税抜)</th>
                      <th className="border border-gray-300 px-2 py-2 text-center">適用税率</th>
                      <th className="border border-gray-300 px-2 py-2 text-left" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>補足</th>
                      <th className="border border-gray-300 px-2 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceItems.map((item, itemIndex) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="border border-gray-300 px-2 py-2">
                          {item.type === 'manual' ? (
                            <input
                              type="text"
                              value={item.itemName || ''}
                              onChange={(e) => {
                                const detail = details[item.detailIndex]
                                handleDetailChange(item.detailIndex, 'itemName', e.target.value)
                              }}
                              className="w-full border-none focus:outline-none focus:ring-1 focus:ring-blue-500 bg-transparent text-gray-900"
                              placeholder="費目名を入力"
                            />
                          ) : (
                            <span className="text-gray-900">{item.itemName}</span>
                          )}
                        </td>
                        <td className="border border-gray-300 px-2 py-2 text-right">
                          {item.type === 'manual' || item.type === 'basic' ? (
                            <input
                              type="number"
                              value={item.unitPrice}
                              onChange={(e) => {
                                const detail = details[item.detailIndex]
                                if (item.type === 'manual') {
                                  handleDetailChange(item.detailIndex, 'basicRate', e.target.value)
                                } else {
                                  handleDetailChange(item.detailIndex, 'basicRate', e.target.value)
                                }
                              }}
                              className="w-full border-none focus:outline-none focus:ring-1 focus:ring-blue-500 bg-transparent text-right text-gray-900"
                              min="0"
                            />
                          ) : (
                            <span className="text-gray-900">-</span>
                          )}
                        </td>
                        <td className="border border-gray-300 px-2 py-2 text-center">
                          {item.type === 'manual' || item.type === 'basic' ? (
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => {
                                const detail = details[item.detailIndex]
                                if (item.type === 'manual') {
                                  handleDetailChange(item.detailIndex, 'workDays', e.target.value)
                                }
                              }}
                              className="w-full border-none focus:outline-none focus:ring-1 focus:ring-blue-500 bg-transparent text-center text-gray-900"
                              min="0"
                            />
                          ) : (
                            <span className="text-gray-900">-</span>
                          )}
                        </td>
                        <td className="border border-gray-300 px-2 py-2 text-right">
                          {item.amount < 0 ? (
                            <span className="text-red-600">{item.amount.toLocaleString()}</span>
                          ) : (
                            <input
                              type="number"
                              value={Math.abs(item.amount)}
                              onChange={(e) => {
                                const detail = details[item.detailIndex]
                                if (item.type === 'manual') {
                                  handleDetailChange(item.detailIndex, 'basicAmount', e.target.value)
                                } else if (item.type === 'basic') {
                                  // 基本金額を変更する場合は、basicAmountとovertimeAmountの合計を調整
                                  const newAmount = parseInt(e.target.value) || 0
                                  const currentOvertime = detail.overtimeAmount || 0
                                  handleDetailChange(item.detailIndex, 'basicAmount', newAmount - currentOvertime)
                                }
                              }}
                              className="w-full border-none focus:outline-none focus:ring-1 focus:ring-blue-500 bg-transparent text-right text-gray-900"
                              min="0"
                            />
                          )}
                        </td>
                        <td className="border border-gray-300 px-2 py-2 text-center">
                          {item.type === 'manual' ? (
                            <input
                              type="number"
                              value={item.taxRate}
                              onChange={(e) => {
                                const newTaxRate = parseInt(e.target.value) || 0
                                // 税率を更新するために、formDataのtaxRateを更新
                                // ただし、各明細行ごとに税率を変更できるようにするには、detailに税率フィールドが必要
                                // 今回は請求先企業の税率を編集可能にする
                                setFormData({ ...formData, taxRate: String(newTaxRate) })
                              }}
                              className="w-full border-none focus:outline-none focus:ring-1 focus:ring-blue-500 bg-transparent text-center text-gray-900"
                              min="0"
                              max="100"
                            />
                          ) : (
                            <span className="text-gray-900">{item.taxRate}%</span>
                          )}
                        </td>
                        <td className="border border-gray-300 px-2 py-2 align-top" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                          <textarea
                            value={item.note || ''}
                            onChange={(e) => {
                              const detail = details[item.detailIndex]
                              handleDetailChange(item.detailIndex, 'notes', e.target.value)
                            }}
                            className="w-full border-none focus:outline-none focus:ring-1 focus:ring-blue-500 bg-transparent text-gray-900 resize-none"
                            placeholder="補足を入力"
                            rows={1}
                            style={{ 
                              minHeight: '1.5rem',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                              overflowWrap: 'break-word',
                              lineHeight: '1.5',
                              width: '100%',
                              overflow: 'visible'
                            }}
                            onInput={(e) => {
                              const target = e.target as HTMLTextAreaElement
                              target.style.height = 'auto'
                              target.style.height = `${Math.max(target.scrollHeight, 24)}px`
                            }}
                          />
                        </td>
                        <td className="border border-gray-300 px-2 py-2 text-center">
                          {item.type === 'manual' && (
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(item.detailIndex)}
                              className="text-red-600 hover:text-red-800 text-xs"
                            >
                              削除
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {/* 小計行 */}
                    <tr className="bg-gray-100 font-medium">
                      <td colSpan={3} className="border border-gray-300 px-2 py-2 text-right text-gray-900">
                        {parseInt(formData.taxRate) || Math.round((invoice.billingClient.taxRate || 0.1) * 100)}%対象小計
                      </td>
                      <td className="border border-gray-300 px-2 py-2 text-right text-gray-900">
                        {subtotal.toLocaleString()}
                      </td>
                      <td colSpan={3} className="border border-gray-300"></td>
                    </tr>
                    {/* 調整金額 */}
                    <tr className="hover:bg-gray-50">
                      <td colSpan={3} className="border border-gray-300 px-2 py-2 text-gray-900">
                        調整金額
                      </td>
                      <td className="border border-gray-300 px-2 py-2 text-right">
                        <input
                          type="number"
                          value={formData.adjustmentAmount}
                          onChange={(e) => setFormData({ ...formData, adjustmentAmount: e.target.value })}
                          className="w-full border-none focus:outline-none focus:ring-1 focus:ring-blue-500 bg-transparent text-right text-gray-900"
                        />
                      </td>
                      <td colSpan={3} className="border border-gray-300"></td>
                    </tr>
                    {/* 交通費 */}
                    <tr className="hover:bg-gray-50">
                      <td colSpan={3} className="border border-gray-300 px-2 py-2 text-gray-900">
                        交通費
                      </td>
                      <td className="border border-gray-300 px-2 py-2 text-right">
                        <input
                          type="number"
                          value={formData.transportationCost}
                          onChange={(e) => setFormData({ ...formData, transportationCost: e.target.value })}
                          min="0"
                          className="w-full border-none focus:outline-none focus:ring-1 focus:ring-blue-500 bg-transparent text-right text-gray-900"
                        />
                      </td>
                      <td colSpan={3} className="border border-gray-300"></td>
                    </tr>
                    {/* 消費税 */}
                    <tr>
                      <td colSpan={3} className="border border-gray-300 px-2 py-2 text-gray-900">
                        消費税({parseInt(formData.taxRate) || Math.round((invoice.billingClient.taxRate || 0.1) * 100)}%対象)
                      </td>
                      <td className="border border-gray-300 px-2 py-2 text-right text-gray-900">
                        {taxAmount.toLocaleString()}
                      </td>
                      <td colSpan={3} className="border border-gray-300"></td>
                    </tr>
                    {/* 合計金額 */}
                    <tr className="bg-gray-200 font-bold">
                      <td colSpan={3} className="border border-gray-300 px-2 py-2 text-gray-900">
                        合計金額
                      </td>
                      <td className="border border-gray-300 px-2 py-2 text-right text-gray-900">
                        {totalAmount.toLocaleString()}
                      </td>
                      <td colSpan={3} className="border border-gray-300"></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 費目追加ボタン */}
              <div className="mt-4">
                <button
                  type="button"
                  onClick={handleAddManualItem}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 font-medium text-sm"
                >
                  + 費目を追加
                </button>
              </div>
            </div>

            {/* 交通費・調整金額入力（非表示、テーブル内で表示） */}
            <div className="hidden">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">交通費</label>
                  <input
                    type="number"
                    value={formData.transportationCost}
                    onChange={(e) => setFormData({ ...formData, transportationCost: e.target.value })}
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">調整金額</label>
                  <input
                    type="number"
                    value={formData.adjustmentAmount}
                    onChange={(e) => setFormData({ ...formData, adjustmentAmount: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ステータス表示と操作ボタン */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm font-medium text-gray-700">ステータス:</span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                invoice.status === 'draft' ? 'bg-gray-200 text-gray-800' :
                invoice.status === 'issued' ? 'bg-blue-200 text-blue-800' :
                invoice.status === 'billed' ? 'bg-yellow-200 text-yellow-800' :
                'bg-green-200 text-green-800'
              }`}>
                {invoice.status === 'draft' ? '下書き' :
                 invoice.status === 'issued' ? '発行済み' :
                 invoice.status === 'billed' ? '請求済み' :
                 '支払済み'}
              </span>
            </div>

            {/* 操作ボタン */}
            <div className="flex gap-4 flex-wrap">
              <button
                type="submit"
                disabled={saving || invoice.status !== 'draft'}
                className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? '保存中...' : '保存'}
              </button>
              {invoice.status === 'draft' && (
                <button
                  type="button"
                  onClick={handleIssue}
                  disabled={issuing}
                  className="px-6 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {issuing ? '発行中...' : '発行する'}
                </button>
              )}
              <button
                type="button"
                onClick={handlePreviewPDF}
                className="px-6 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 font-medium"
              >
                PDFプレビュー
              </button>
              <button
                type="button"
                onClick={handleDownloadPDF}
                disabled={downloading}
                className="px-6 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {downloading ? 'ダウンロード中...' : 'PDFダウンロード'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
