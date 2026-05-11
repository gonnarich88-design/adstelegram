import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

function getSecret() {
  return new TextEncoder().encode(process.env.JWT_SECRET!)
}

export function verifyPassword(input: string): boolean {
  return input === process.env.APP_PASSWORD
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
