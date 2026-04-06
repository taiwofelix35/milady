'use client'

import { ConnectButton } from '@rainbow-me/rainbowkit'
import Link from 'next/link'
import { useState } from 'react'

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-milady-blush shadow-milady">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-full bg-milady-button flex items-center justify-center shadow-milady group-hover:shadow-milady-hover transition-shadow">
              <span className="text-white text-lg">🎀</span>
            </div>
            <span className="font-display text-xl font-bold bg-gradient-to-r from-milady-pink-dark to-milady-purple-dark bg-clip-text text-transparent">
              Milady Market
            </span>
          </Link>

          {/* Nav */}
          <nav className="hidden md:flex items-center gap-6">
            <Link
              href="/"
              className="text-sm font-medium text-gray-600 hover:text-milady-pink-dark transition-colors"
            >
              Explore
            </Link>
            <Link
              href="/collections"
              className="text-sm font-medium text-gray-600 hover:text-milady-pink-dark transition-colors"
            >
              Collections
            </Link>
          </nav>

          {/* Wallet Connect */}
          <div className="flex items-center gap-3">
            <ConnectButton
              chainStatus="icon"
              showBalance={false}
              accountStatus="avatar"
            />
            <button
              className="md:hidden p-2 rounded-lg text-gray-500 hover:text-milady-pink hover:bg-milady-pink-light transition-colors"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {menuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden py-3 border-t border-milady-blush">
            <nav className="flex flex-col gap-3">
              <Link
                href="/"
                className="text-sm font-medium text-gray-600 hover:text-milady-pink-dark transition-colors px-2 py-1"
                onClick={() => setMenuOpen(false)}
              >
                Explore
              </Link>
              <Link
                href="/collections"
                className="text-sm font-medium text-gray-600 hover:text-milady-pink-dark transition-colors px-2 py-1"
                onClick={() => setMenuOpen(false)}
              >
                Collections
              </Link>
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}
