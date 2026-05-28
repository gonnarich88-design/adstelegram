import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const records = await prisma.dailyConversion.findMany({
      orderBy: { date: 'desc' },
    })
    return NextResponse.json(
      records.map(r => ({
        id: r.id,
        date: r.date.toISOString().slice(0, 10),
        registrations: r.registrations,
        depositCount: r.depositCount,
        depositAmountThb: Number(r.depositAmountThb),
        note: r.note,
        createdAt: r.createdAt.toISOString(),
      }))
    )
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { date, registrations, depositCount, depositAmountThb, note } = body

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 })
    }
    if (typeof registrations !== 'number' || !Number.isInteger(registrations) || registrations < 0) {
      return NextResponse.json({ error: 'registrations must be non-negative integer' }, { status: 400 })
    }
    if (typeof depositCount !== 'number' || !Number.isInteger(depositCount) || depositCount < 0) {
      return NextResponse.json({ error: 'depositCount must be non-negative integer' }, { status: 400 })
    }
    if (typeof depositAmountThb !== 'number' || isNaN(depositAmountThb) || depositAmountThb < 0) {
      return NextResponse.json({ error: 'depositAmountThb must be non-negative number' }, { status: 400 })
    }

    const record = await prisma.dailyConversion.create({
      data: {
        date: new Date(date),
        registrations,
        depositCount,
        depositAmountThb,
        note: note ?? null,
      },
    })
    return NextResponse.json({ id: record.id }, { status: 201 })
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'DUPLICATE_DATE' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
