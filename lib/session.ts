import { getServerSession } from 'next-auth'
import { authOptions } from './auth'

export async function getSession() {
  const session = await getServerSession(authOptions)
  if (!session || !session.user) {
    return null
  }
  return session as {
    user: {
      id: string
      email: string
      name: string
      role: string
      companyId: number
    }
  }
}

