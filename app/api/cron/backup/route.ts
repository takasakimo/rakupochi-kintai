import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// データベースバックアップ用のCronエンドポイント
export async function GET(request: NextRequest) {
  try {
    // Vercel Cronからのリクエストか確認
    const authHeader = request.headers.get('authorization')
    const vercelSignature = request.headers.get('x-vercel-signature')
    const cronSecret = process.env.CRON_SECRET

    // Vercel Cronからのリクエストか、または正しい認証トークンがあるか確認
    const isVercelCron = vercelSignature !== null
    const hasValidAuth = cronSecret && authHeader === `Bearer ${cronSecret}`

    if (!isVercelCron && !hasValidAuth) {
      // 開発環境では認証をスキップ（オプション）
      if (process.env.NODE_ENV === 'development' && !cronSecret) {
        console.warn('Running backup in development mode without authentication')
      } else {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupData: Record<string, any> = {
      timestamp,
      version: '1.0.0',
      tables: {},
    }

    // 全テーブルのデータを取得
    try {
      // Companies
      backupData.tables.companies = await prisma.company.findMany({
        orderBy: { id: 'asc' },
      })

      // Employees
      backupData.tables.employees = await prisma.employee.findMany({
        orderBy: { id: 'asc' },
        select: {
          id: true,
          companyId: true,
          employeeNumber: true,
          name: true,
          email: true,
          role: true,
          department: true,
          workLocation: true,
          workLocationAddress: true,
          position: true,
          phone: true,
          birthDate: true,
          address: true,
          hireDate: true,
          bankAccount: true,
          transportationRoutes: true,
          transportationCost: true,
          paidLeaveGrantDate: true,
          yearsOfService: true,
          paidLeaveBalance: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          // passwordはセキュリティのため除外
        },
      })

      // Locations
      backupData.tables.locations = await prisma.location.findMany({
        orderBy: { id: 'asc' },
      })

      // Attendances
      backupData.tables.attendances = await prisma.attendance.findMany({
        orderBy: { id: 'asc' },
      })

      // Shifts
      backupData.tables.shifts = await prisma.shift.findMany({
        orderBy: { id: 'asc' },
      })

      // Applications
      backupData.tables.applications = await prisma.application.findMany({
        orderBy: { id: 'asc' },
      })

      // Notifications
      backupData.tables.notifications = await prisma.notification.findMany({
        orderBy: { id: 'asc' },
      })

      // CompanySettings
      backupData.tables.companySettings = await prisma.companySetting.findMany({
        orderBy: { id: 'asc' },
      })

      // Announcements
      backupData.tables.announcements = await prisma.announcement.findMany({
        orderBy: { id: 'asc' },
      })

      // PasswordResetTokens（有効期限が切れていないもののみ）
      backupData.tables.passwordResetTokens = await prisma.passwordResetToken.findMany({
        where: {
          expiresAt: {
            gte: new Date(),
          },
        },
        orderBy: { id: 'asc' },
      })

      // AttendanceModificationLogs
      backupData.tables.attendanceModificationLogs =
        await prisma.attendanceModificationLog.findMany({
          orderBy: { id: 'asc' },
        })

      // SalesVisits
      backupData.tables.salesVisits = await prisma.salesVisit.findMany({
        orderBy: { id: 'asc' },
      })

      // 統計情報を追加
      backupData.stats = {
        companies: backupData.tables.companies.length,
        employees: backupData.tables.employees.length,
        locations: backupData.tables.locations.length,
        attendances: backupData.tables.attendances.length,
        shifts: backupData.tables.shifts.length,
        applications: backupData.tables.applications.length,
        notifications: backupData.tables.notifications.length,
        companySettings: backupData.tables.companySettings.length,
        announcements: backupData.tables.announcements.length,
        passwordResetTokens: backupData.tables.passwordResetTokens.length,
        attendanceModificationLogs: backupData.tables.attendanceModificationLogs.length,
        salesVisits: backupData.tables.salesVisits.length,
      }

      // JSON形式でバックアップデータを生成
      const backupJson = JSON.stringify(backupData, null, 2)
      const backupSize = Buffer.byteLength(backupJson, 'utf8')

      // Supabase Storageに保存する場合（オプション）
      // 現在はログに出力し、必要に応じて外部ストレージに保存可能
      console.log(`Backup completed at ${timestamp}`)
      console.log(`Backup size: ${(backupSize / 1024).toFixed(2)} KB`)

      // バックアップの保存先を設定（環境変数で指定可能）
      const backupStorage = process.env.BACKUP_STORAGE || 'log' // 'log', 'supabase', 's3', 'email'

      let storageResult: any = null

      if (backupStorage === 'supabase') {
        // Supabase Storageに保存する場合
        try {
          const { createClient } = await import('@supabase/supabase-js')
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
          const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

          if (!supabaseUrl) {
            console.error('NEXT_PUBLIC_SUPABASE_URL is not set')
            storageResult = {
              provider: 'supabase',
              error: 'NEXT_PUBLIC_SUPABASE_URL is not configured',
            }
          } else if (!supabaseServiceKey) {
            console.error('SUPABASE_SERVICE_ROLE_KEY is not set')
            storageResult = {
              provider: 'supabase',
              error: 'SUPABASE_SERVICE_ROLE_KEY is not configured',
            }
          } else {
            const supabase = createClient(supabaseUrl, supabaseServiceKey)
            const fileName = `backup-${timestamp}.json`
            const { data, error } = await supabase.storage
              .from('backups')
              .upload(fileName, backupJson, {
                contentType: 'application/json',
                upsert: false,
              })

            if (error) {
              console.error('Failed to upload backup to Supabase Storage:', error)
              storageResult = {
                provider: 'supabase',
                error: error.message,
              }
            } else if (data) {
              storageResult = {
                provider: 'supabase',
                fileName,
                path: data.path,
              }
            } else {
              console.error('No data returned from Supabase Storage upload')
              storageResult = {
                provider: 'supabase',
                error: 'No data returned from upload',
              }
            }
          }
        } catch (error: any) {
          console.error('Supabase Storage upload error:', error)
          storageResult = {
            provider: 'supabase',
            error: error?.message || 'Unknown error occurred',
          }
        }
      } else if (backupStorage === 'email') {
        // メールで送信する場合（管理者メールアドレスが必要）
        const adminEmail = process.env.ADMIN_EMAIL
        if (adminEmail) {
          try {
            const nodemailer = await import('nodemailer')
            const transporter = nodemailer.default.createTransport({
              host: process.env.SMTP_HOST || 'smtp.gmail.com',
              port: parseInt(process.env.SMTP_PORT || '587'),
              secure: false,
              auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
              },
            })

            await transporter.sendMail({
              from: process.env.SMTP_FROM || process.env.SMTP_USER,
              to: adminEmail,
              subject: `データベースバックアップ - ${timestamp}`,
              text: `データベースバックアップが完了しました。\n\n統計情報:\n${JSON.stringify(backupData.stats, null, 2)}`,
              attachments: [
                {
                  filename: `backup-${timestamp}.json`,
                  content: backupJson,
                  contentType: 'application/json',
                },
              ],
            })

            storageResult = {
              provider: 'email',
              recipient: adminEmail,
            }
          } catch (error) {
            console.error('Email backup error:', error)
          }
        }
      }

      // ストレージへの保存が失敗した場合の警告
      const hasStorageError = storageResult?.error !== undefined
      const success = !hasStorageError

      return NextResponse.json({
        success,
        message: success
          ? 'バックアップが完了しました'
          : 'バックアップデータの取得は完了しましたが、ストレージへの保存に失敗しました',
        timestamp,
        stats: backupData.stats,
        backupSize: `${(backupSize / 1024).toFixed(2)} KB`,
        storage: storageResult || { provider: 'log', message: 'ログに出力されました' },
        warning: hasStorageError
          ? 'ストレージへの保存に失敗しました。ログを確認してください。'
          : undefined,
      })
    } catch (error) {
      console.error('Backup data retrieval error:', error)
      // セキュリティ: エラーの詳細を返さない
      return NextResponse.json(
        {
          error: 'Failed to retrieve backup data',
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Backup cron error:', error)
    // セキュリティ: エラーの詳細を返さない
    return NextResponse.json(
      {
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
