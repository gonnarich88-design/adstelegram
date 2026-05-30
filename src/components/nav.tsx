'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function Nav() {
  const pathname = usePathname()
  const router = useRouter()

  if (pathname === '/login') return null

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  const links = [
    { href: '/', label: 'Dashboard' },
    { href: '/campaigns', label: 'Campaigns' },
    { href: '/goals', label: 'เป้าหมาย' },
    { href: '/wallet', label: 'Wallet' },
    { href: '/conversions', label: 'Conversions' },
    { href: '/settings', label: 'Settings' },
  ]

  function isActive(href: string) {
    if (href === '/campaigns') return pathname.startsWith('/campaigns')
    if (href === '/conversions') return pathname.startsWith('/conversions')
    if (href === '/goals') return pathname.startsWith('/goals')
    return pathname === href
  }

  return (
    <nav className="border-b px-6 py-3 flex items-center gap-6">
      <span className="font-semibold text-sm">Ads Tracker</span>
      <div className="flex items-center gap-4 flex-1">
        {links.map(l => (
          <Link
            key={l.href}
            href={l.href}
            className={`text-sm ${isActive(l.href) ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {l.label}
          </Link>
        ))}
      </div>
      <Button variant="ghost" size="sm" onClick={handleLogout}>
        Logout
      </Button>
    </nav>
  )
}
