import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { date, registrations, depositCount, depositTxCount, depositAmountThb, note, breakdowns } = body

    if (date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 })
    }
    if (registrations !== undefined && (typeof registrations !== 'number' || !Number.isInteger(registrations) || registrations < 0)) {
      return NextResponse.json({ error: 'registrations must be non-negative integer' }, { status: 400 })
    }
    if (depositCount !== undefined && (typeof depositCount !== 'number' || !Number.isInteger(depositCount) || depositCount < 0)) {
      return NextResponse.json({ error: 'depositCount must be non-negative integer' }, { status: 400 })
    }
    if (depositTxCount !== undefined && (typeof depositTxCount !== 'number' || !Number.isInteger(depositTxCount) || depositTxCount < 0)) {
      return NextResponse.json({ error: 'depositTxCount must be non-negative integer' }, { status: 400 })
    }
    if (
      depositAmountThb !== undefined &&
      (typeof depositAmountThb !== 'number' || isNaN(depositAmountThb) || depositAmountThb < 0)
    ) {
      return NextResponse.json({ error: 'depositAmountThb must be non-negative' }, { status: 400 })
    }

    await prisma.$transaction(async tx => {
      await tx.dailyConversion.update({
        where: { id },
        data: {
          ...(date !== undefined && { date: new Date(date) }),
          ...(registrations !== undefined && { registrations }),
          ...(depositCount !== undefined && { depositCount }),
          ...(depositTxCount !== undefined && { depositTxCount }),
          ...(depositAmountThb !== undefined && { depositAmountThb }),
          ...(note !== undefined && { note: note ?? null }),
        },
      })
      if (Array.isArray(breakdowns)) {
        await tx.dailyConversionBreakdown.deleteMany({ where: { conversionId: id } })
        const validBreakdowns = breakdowns.filter((b: any) => b.channelName)
        if (validBreakdowns.length > 0) {
          await tx.dailyConversionBreakdown.createMany({
            data: validBreakdowns.map((b: any) => ({
              conversionId: id,
              channelName: b.channelName,
              campaignId: b.campaignId ?? null,
              registrations: b.registrations ?? 0,
              depositCount: b.depositCount ?? 0,
              depositTxCount: b.depositTxCount ?? 0,
              depositAmountThb: b.depositAmountThb ?? 0,
            })),
          })
        }
      }
    })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'DUPLICATE_DATE' }, { status: 409 })
    }
    if (e?.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.dailyConversion.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    if (e?.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
