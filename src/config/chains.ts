import { defineChain } from 'viem'

export const tempo = defineChain({
  id: 7364,
  name: 'Tempo',
  nativeCurrency: {
    decimals: 18,
    name: 'ETH',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_TEMPO_RPC_URL || 'https://rpc.tempo.xyz'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Tempo Explorer',
      url: 'https://explorer.tempo.xyz',
    },
  },
})

export const SUPPORTED_CHAINS = [tempo]

export const CHAIN_ID = tempo.id
