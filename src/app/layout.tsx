import type { Metadata } from 'next'
import './globals.css'
import { Providers } from '@/components/Providers'
import Header from '@/components/Header'
import Footer from '@/components/Footer'

export const metadata: Metadata = {
  title: 'Milady Market — NFT Marketplace on Tempo',
  description:
    'The premier NFT marketplace on Tempo chain. Buy, sell, and discover NFTs with OpenSea-standard Seaport protocol. Kawaii aesthetic. ♡',
  openGraph: {
    title: 'Milady Market',
    description: 'NFT Marketplace on Tempo — powered by OpenSea Seaport protocol',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <Providers>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  )
}
