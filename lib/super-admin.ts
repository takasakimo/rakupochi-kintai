import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { Session } from 'next-auth'
import { isSuperAdminEmail } from './super-admin-helper'

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
                       isSuperAdminEmail(session.user.email)

  if (isSuperAdmin) {
    // スーパー管理者の場合は選択された企業IDを使用
    return session.user.selectedCompanyId || null
  }

  // 通常の管理者の場合はcompanyIdを使用
  return session.user.companyId || null
}

/**
 * セッションから有効な企業IDを取得（ヘルパー関数）
 * スーパー管理者の場合はselectedCompanyIdを使用、通常の管理者の場合はcompanyIdを使用
 * エラーハンドリングも含む
 */
export function getEffectiveCompanyIdFromSession(session: Session | null): number {
  if (!session || !session.user) {
    throw new Error('Unauthorized')
  }

  const isSuperAdmin = session.user.role === 'super_admin' || 
                       isSuperAdminEmail(session.user.email)

  const effectiveCompanyId = isSuperAdmin 
    ? session.user.selectedCompanyId 
    : session.user.companyId

  if (!effectiveCompanyId) {
    throw new Error(isSuperAdmin ? '企業が選択されていません' : 'Company ID not found')
  }

  return effectiveCompanyId
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
         isSuperAdminEmail(session.user.email)
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
                       isSuperAdminEmail(session.user.email)
  const isAdmin = session.user.role === 'admin'

  return isSuperAdmin || isAdmin
}

