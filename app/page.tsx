import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const session = await getSession()

  if (!session) {
    redirect('/auth/signin')
  }

  // ロールに応じてリダイレクト
  if (session.user.role === 'admin') {
    redirect('/admin/dashboard')
  } else {
    redirect('/employee/clock')
  }
}
