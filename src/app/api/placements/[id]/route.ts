import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const data: Record<string, unknown> = {}
  if (body.name?.trim()) data.name = body.name.trim()
  if ('type' in body) data.type = body.type ?? null
  if ('note' in body) data.note = body.note ?? null

  const placement = await prisma.placement.update({ where: { id }, data })
  return NextResponse.json(placement)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const count = await prisma.campaignPlacement.count({ where: { placementId: id } })
  if (count > 0) {
    return NextResponse.json(
      { error: `ไม่สามารถลบได้ — มี ${count} แคมเปญใช้ปลายทางนี้อยู่` },
      { status: 409 }
    )
  }
  await prisma.placement.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
