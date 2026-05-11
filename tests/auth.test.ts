import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    set: vi.fn(),
    delete: vi.fn(),
    get: vi.fn(),
  })),
}))

describe('verifyPassword', () => {
  beforeEach(() => {
    process.env.APP_PASSWORD = 'test-password'
    process.env.JWT_SECRET = 'test-secret-32-chars-minimum-ok!'
  })

  it('returns true for correct password', async () => {
    const { verifyPassword } = await import('@/lib/auth')
    expect(verifyPassword('test-password')).toBe(true)
  })

  it('returns false for wrong password', async () => {
    const { verifyPassword } = await import('@/lib/auth')
    expect(verifyPassword('wrong')).toBe(false)
  })
})
