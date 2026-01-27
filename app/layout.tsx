import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Providers } from './providers'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'らくっぽ勤怠',
  description: '勤怠管理と経費管理を一元化。中小企業向けWebベースの統合管理システム',
  openGraph: {
    title: 'らくっぽ勤怠',
    description: '勤怠管理と経費管理を一元化。中小企業向けWebベースの統合管理システム',
    url: 'https://rakupochi-kintai.com',
    siteName: 'らくっぽ勤怠',
    locale: 'ja_JP',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'らくっぽ勤怠',
    description: '勤怠管理と経費管理を一元化。中小企業向けWebベースの統合管理システム',
  },
  icons: {
    icon: '/icon.png',
    apple: '/icon.png',
    shortcut: '/favicon.ico',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
