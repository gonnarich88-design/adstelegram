import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const settings = await prisma.appSettings.findUnique({ where: { id: 1 } })
    return NextResponse.json({
      walletBalanceTon: settings ? Number(settings.walletBalanceTon) : 0,
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const walletBalanceTon = Number(body.walletBalanceTon)
    if (isNaN(walletBalanceTon) || walletBalanceTon < 0) {
      return NextResponse.json({ error: 'Invalid walletBalanceTon' }, { status: 400 })
    }
    const settings = await prisma.appSettings.upsert({
      where: { id: 1 },
      create: { id: 1, walletBalanceTon },
      update: { walletBalanceTon },
    })
    return NextResponse.json({ walletBalanceTon: Number(settings.walletBalanceTon) })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
