import { NextRequest, NextResponse } from 'next/server'
import { verifyPassword, createSession } from '@/lib/auth'

export async function POST(req: NextRequest) {
  let password: string
  try {
    const body = await req.json()
    password = body.password
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  if (!verifyPassword(password)) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }

  await createSession()
  return NextResponse.json({ ok: true })
}
