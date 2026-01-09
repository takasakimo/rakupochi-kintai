import { getServerSession } from 'next-auth'
import { authOptions } from './auth'

/**
 * スーパー管理者が選択した企業IDを取得
 * スーパー管理者の場合はselectedCompanyIdを返し、
 * 通常の管理者の場合はcompanyIdを返す
 */
export async function getEffectiveCompanyId(): Promise<number | null> {
  const session = await getServerSession(authOptions)
  if (!session || !session.user) {
    return null
  }

  const isSuperAdmin = session.user.role === 'super_admin' || 
                       session.user.email === 'superadmin@rakupochi.com'

  if (isSuperAdmin) {
    // スーパー管理者の場合は選択された企業IDを使用
    return session.user.selectedCompanyId || null
  }

  // 通常の管理者の場合はcompanyIdを使用
  return session.user.companyId || null
}

/**
 * スーパー管理者かどうかを判定
 */
export async function isSuperAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions)
  if (!session || !session.user) {
    return false
  }

  return session.user.role === 'super_admin' || 
         session.user.email === 'superadmin@rakupochi.com'
}

/**
 * スーパー管理者または管理者かどうかを判定
 */
export async function isAdminOrSuperAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions)
  if (!session || !session.user) {
    return false
  }

  const isSuperAdmin = session.user.role === 'super_admin' || 
                       session.user.email === 'superadmin@rakupochi.com'
  const isAdmin = session.user.role === 'admin'

  return isSuperAdmin || isAdmin
}

