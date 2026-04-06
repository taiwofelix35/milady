/**
 * Tempo network configuration.
 * Update TEMPO_CHAIN_ID, rpcUrls, and blockExplorers when you have
 * the final Tempo network details.
 */
import { defineChain } from "viem";

export const TEMPO_CHAIN_ID = Number(process.env.NEXT_PUBLIC_TEMPO_CHAIN_ID ?? "1007");

export const tempo = defineChain({
  id: TEMPO_CHAIN_ID,
  name: "Tempo",
  nativeCurrency: {
    decimals: 18,
    name: "Tempo",
    symbol: "TEMPO",
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_TEMPO_RPC_URL ?? "https://rpc.tempo.network"],
    },
  },
  blockExplorers: {
    default: {
      name: "Tempo Explorer",
      url: process.env.NEXT_PUBLIC_TEMPO_EXPLORER ?? "https://explorer.tempo.network",
    },
  },
});

export const NFT_CONTRACT_ADDRESS = (
  process.env.NEXT_PUBLIC_NFT_CONTRACT ?? "0x0000000000000000000000000000000000000000"
) as `0x${string}`;

export const MARKETPLACE_CONTRACT_ADDRESS = (
  process.env.NEXT_PUBLIC_MARKETPLACE_CONTRACT ?? "0x0000000000000000000000000000000000000000"
) as `0x${string}`;
