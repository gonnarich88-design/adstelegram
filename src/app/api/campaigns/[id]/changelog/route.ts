import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logCampaignChanges } from '@/lib/changelog'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const logs = await prisma.campaignChangeLog.findMany({
      where: { campaignId: id },
      orderBy: { changedAt: 'desc' },
    })
    return NextResponse.json(logs)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    if (!body.note || typeof body.note !== 'string' || body.note.trim() === '') {
      return NextResponse.json({ error: 'note is required' }, { status: 400 })
    }
    const campaign = await prisma.campaign.findUnique({ where: { id } })
    if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await logCampaignChanges(id, [{ field: null, note: body.note.trim() }])
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
