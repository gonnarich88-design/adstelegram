import { NextRequest, NextResponse } from 'next/server'
import { fetchHistoricalRates } from '@/lib/rates'

export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get('from')
  const to = req.nextUrl.searchParams.get('to')

  if (!from || !to) {
    return NextResponse.json({ error: 'from and to required' }, { status: 400 })
  }

  try {
    const rates = await fetchHistoricalRates(from, to)
    return NextResponse.json(rates)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch historical rates' }, { status: 502 })
  }
}
