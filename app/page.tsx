import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const session = await getSession()

  if (!session) {
    redirect('/auth/signin')
  }

  // ロールに応じてリダイレクト
  const isSuperAdmin = session.user.role === 'super_admin' || 
                       session.user.email === 'superadmin@rakupochi.com'
  
  if (isSuperAdmin) {
    // スーパー管理者の場合は企業管理画面へ
    redirect('/super-admin/companies')
  } else if (session.user.role === 'admin') {
    redirect('/admin/dashboard')
  } else {
    redirect('/employee/clock')
  }
}
