import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: string
      companyId: number | null // スーパー管理者の場合はnull
      selectedCompanyId?: number | null // スーパー管理者が選択した企業ID
    }
  }

  interface User {
    id: string
    email: string
    name: string
    role: string
    companyId: number | null // スーパー管理者の場合はnull
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: string
    companyId: number | null // スーパー管理者の場合はnull
    selectedCompanyId?: number | null // スーパー管理者が選択した企業ID
  }
}

