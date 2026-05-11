import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Nav } from '@/components/nav'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Telegram Ads Tracker',
  description: 'Personal Telegram Ads campaign tracker',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className="dark">
      <body className={inter.className}>
        <Nav />
        <main className="container mx-auto px-6 py-8 max-w-6xl">
          {children}
        </main>
      </body>
    </html>
  )
}
