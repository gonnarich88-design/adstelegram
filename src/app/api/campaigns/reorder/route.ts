import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    if (!Array.isArray(body) || body.length === 0) {
      return NextResponse.json({ error: 'Expected non-empty array' }, { status: 400 })
    }
    await prisma.$transaction(
      body.map(({ id, sortOrder }: { id: string; sortOrder: number }) =>
        prisma.campaign.update({ where: { id }, data: { sortOrder } })
      )
    )
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
