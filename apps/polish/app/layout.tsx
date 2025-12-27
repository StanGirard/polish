import type { Metadata } from 'next'
import { JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { ApiConfigProvider } from './context/ApiConfigContext'
import { ProviderProvider } from './context/ProviderContext'

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-jetbrains-mono'
})

export const metadata: Metadata = {
  title: 'POLISH.RUN // Code Quality Enhancement System',
  description: 'Autonomous LLM-driven code quality improvement loop',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${jetbrainsMono.className} crt-screen`}>
        <ApiConfigProvider>
          <ProviderProvider>
            {children}
          </ProviderProvider>
        </ApiConfigProvider>
      </body>
    </html>
  )
}
