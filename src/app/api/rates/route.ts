import { NextResponse } from 'next/server'
import { fetchRates } from '@/lib/rates'

export async function GET() {
  try {
    const rates = await fetchRates()
    return NextResponse.json(rates)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch rates' }, { status: 502 })
  }
}
