import nodemailer from 'nodemailer'

// メール送信が有効かどうか（環境変数で制御）
const EMAIL_ENABLED = process.env.EMAIL_ENABLED === 'true'

// メール送信設定（メール送信が有効な場合のみ）
let transporter: nodemailer.Transporter | null = null

if (EMAIL_ENABLED) {
  try {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    })
  } catch (error) {
    console.warn('Failed to initialize email transporter:', error)
  }
}

export async function sendPasswordResetEmail(
  email: string,
  name: string,
  resetToken: string
): Promise<{ success: boolean; resetUrl?: string }> {
  const resetUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/auth/reset-password?token=${resetToken}`

  // メール送信が無効な場合は、URLを返すだけ（開発・テスト用）
  if (!EMAIL_ENABLED || !transporter) {
    console.log('📧 メール送信が無効です。パスワードリセットURL:', resetUrl)
    return { success: true, resetUrl }
  }

  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: '【らくポチ勤怠】パスワードリセットのご案内',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background-color: #3b82f6;
              color: white;
              padding: 20px;
              text-align: center;
              border-radius: 8px 8px 0 0;
            }
            .content {
              background-color: #f9fafb;
              padding: 30px;
              border-radius: 0 0 8px 8px;
            }
            .button {
              display: inline-block;
              padding: 12px 24px;
              background-color: #3b82f6;
              color: white;
              text-decoration: none;
              border-radius: 6px;
              margin: 20px 0;
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              font-size: 12px;
              color: #6b7280;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>らくポチ勤怠</h1>
            </div>
            <div class="content">
              <p>${name} 様</p>
              <p>パスワードリセットのリクエストを受け付けました。</p>
              <p>以下のボタンをクリックして、新しいパスワードを設定してください。</p>
              <p style="text-align: center;">
                <a href="${resetUrl}" class="button">パスワードをリセット</a>
              </p>
              <p>このリンクは24時間有効です。</p>
              <p>もしこのリクエストをしていない場合は、このメールを無視してください。</p>
              <div class="footer">
                <p>このメールは自動送信されています。返信はできません。</p>
                <p>© らくポチ勤怠</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
らくポチ勤怠

${name} 様

パスワードリセットのリクエストを受け付けました。

以下のURLをクリックして、新しいパスワードを設定してください。

${resetUrl}

このリンクは24時間有効です。

もしこのリクエストをしていない場合は、このメールを無視してください。

このメールは自動送信されています。返信はできません。
© らくポチ勤怠
    `,
  }

  try {
    await transporter.sendMail(mailOptions)
    return { success: true }
  } catch (error) {
    console.error('Email send error:', error)
    // メール送信に失敗した場合でも、URLを返す（開発用）
    console.log('📧 メール送信に失敗しました。パスワードリセットURL:', resetUrl)
    return { success: false, resetUrl }
  }
}

