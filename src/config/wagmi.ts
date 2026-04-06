'use client'

import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { tempo } from './chains'

export const wagmiConfig = getDefaultConfig({
  appName: 'Milady Marketplace',
  projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || 'milady-marketplace',
  chains: [tempo],
  ssr: true,
})
