import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Tauri Code Base Analyzer',
  description: 'Analyze frontend repositories and generate base_entity.json',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}