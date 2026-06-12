import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Speckle PoC ダッシュボード',
  description: 'Speckle self-host + オリジナルダッシュボード PoC'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  )
}
