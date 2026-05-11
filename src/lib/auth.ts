import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { timingSafeEqual } from 'crypto'

function getSecret() {
  const s = process.env.JWT_SECRET
  if (!s || s.length < 32) throw new Error('JWT_SECRET must be at least 32 characters')
  return new TextEncoder().encode(s)
}

export function verifyPassword(input: string): boolean {
  const enc = new TextEncoder()
  const a = enc.encode(input)
  const b = enc.encode(process.env.APP_PASSWORD ?? '')
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function createSession(): Promise<void> {
  const token = await new SignJWT({ auth: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .sign(getSecret())

  const jar = await cookies()
  jar.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })
}

export async function verifySession(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, getSecret())
    return true
  } catch {
    return false
  }
}

export async function destroySession(): Promise<void> {
  const jar = await cookies()
  jar.delete('session')
}
