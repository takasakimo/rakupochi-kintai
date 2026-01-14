import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function parseBase64Data(input: string): { mimeType?: string; base64: string } {
  // data:<mime>;base64,<payload>
  if (input.startsWith('data:')) {
    const commaIndex = input.indexOf(',')
    const meta = input.slice(5, commaIndex) // after "data:"
    const payload = input.slice(commaIndex + 1)
    const mimeType = meta.split(';')[0]
    return { mimeType, base64: payload }
  }
  return { base64: input }
}

// 添付ファイルのダウンロード（管理者のみ）
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string; fileIndex: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isSuperAdmin =
      session.user.role === 'super_admin' ||
      session.user.email === 'superadmin@rakupochi.com'
    const isAdmin = session.user.role === 'admin'
    if (!isAdmin && !isSuperAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const effectiveCompanyId = isSuperAdmin
      ? session.user.selectedCompanyId
      : session.user.companyId
    if (!effectiveCompanyId) {
      return NextResponse.json(
        { error: isSuperAdmin ? '企業が選択されていません' : 'Company ID not found' },
        { status: 400 }
      )
    }

    const applicationId = Number(params.id)
    const fileIndex = Number(params.fileIndex)
    if (!Number.isFinite(applicationId) || !Number.isFinite(fileIndex) || fileIndex < 0) {
      return NextResponse.json({ error: 'Invalid params' }, { status: 400 })
    }

    const application = await prisma.application.findFirst({
      where: { id: applicationId, companyId: effectiveCompanyId },
      select: { id: true, content: true },
    })
    if (!application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    let content: any
    try {
      content = JSON.parse(application.content)
    } catch {
      return NextResponse.json({ error: 'Invalid application content' }, { status: 500 })
    }

    const files: Array<{ name?: string; type?: string; data?: string }> = Array.isArray(
      content?.files
    )
      ? content.files
      : []

    const file = files[fileIndex]
    if (!file?.data) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const { mimeType, base64 } = parseBase64Data(file.data)
    const contentType = file.type || mimeType || 'application/octet-stream'
    const filename = (file.name || `attachment_${applicationId}_${fileIndex}`).replaceAll(
      /[\\/:*?"<>|]/g,
      '_'
    )

    const bytes = Buffer.from(base64, 'base64')
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Download application file error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

