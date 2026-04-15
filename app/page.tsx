import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const session = await getSession()

  // 未ログイン時はログイン画面へ
  if (!session) {
    redirect('/auth/signin')
  }

  // ロールに応じてリダイレクト
  const isSuperAdmin = session.user.role === 'super_admin' || 
                       session.user.email === 'superadmin@rakupochi.com'
  
  if (isSuperAdmin) {
    redirect('/super-admin/select-company')
  } else if (session.user.role === 'admin') {
    redirect('/admin/dashboard')
  } else {
    redirect('/employee/clock')
  }
}
