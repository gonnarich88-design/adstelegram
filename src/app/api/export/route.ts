import { NextRequest, NextResponse } from 'next/server'
import { exportData, importData } from '@/lib/export'

export async function GET() {
  const data = await exportData()
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="ads-backup-${new Date().toISOString().split('T')[0]}.json"`,
    },
  })
}

export async function POST(req: NextRequest) {
  const data = await req.json()
  if (data.version !== 1) {
    return NextResponse.json({ error: 'Unsupported version' }, { status: 400 })
  }
  await importData(data)
  return NextResponse.json({ ok: true })
}
