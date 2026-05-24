import { NextRequest, NextResponse } from 'next/server'
import { exportData, importData } from '@/lib/export'

export async function GET() {
  try {
    const data = await exportData()
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="ads-backup-${new Date().toISOString().split('T')[0]}.json"`,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json()
    if (data.version !== 1 && data.version !== 2) {
      return NextResponse.json({ error: 'Unsupported version' }, { status: 400 })
    }
    if (!Array.isArray(data.campaigns)) {
      return NextResponse.json({ error: 'Invalid data shape' }, { status: 400 })
    }
    await importData(data)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Import failed' }, { status: 500 })
  }
}
