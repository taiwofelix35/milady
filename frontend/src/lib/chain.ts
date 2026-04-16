/**
 * Tempo network configuration.
 * Update TEMPO_CHAIN_ID, rpcUrls, and blockExplorers when you have
 * the final Tempo network details.
 */
import { defineChain } from "viem";
import { PRIMARY_COLLECTION } from "./collections";

export const TEMPO_CHAIN_ID = Number(process.env.NEXT_PUBLIC_TEMPO_CHAIN_ID ?? "4217");

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
      http: [process.env.NEXT_PUBLIC_TEMPO_RPC_URL ?? "https://rpc.tempo.xyz"],
    },
  },
  blockExplorers: {
    default: {
      name: "Tempo Explorer",
      url: process.env.NEXT_PUBLIC_TEMPO_EXPLORER ?? "https://explore.tempo.xyz",
    },
  },
});

export const NFT_CONTRACT_ADDRESS = (
  process.env.NEXT_PUBLIC_NFT_CONTRACT ?? PRIMARY_COLLECTION.nftContract
) as `0x${string}`;

export const MARKETPLACE_CONTRACT_ADDRESS = (
  process.env.NEXT_PUBLIC_MARKETPLACE_CONTRACT ?? PRIMARY_COLLECTION.marketContract
) as `0x${string}`;

export const LAUNCHPAD_CONTRACT_ADDRESS = (
  process.env.NEXT_PUBLIC_LAUNCHPAD_CONTRACT ?? "0x0000000000000000000000000000000000000000"
) as `0x${string}`;

export const PAYMENT_TOKEN_ADDRESS = (
  process.env.NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS ?? "0x20c0000000000000000000000000000000000000"
) as `0x${string}`;

export const PAYMENT_TOKEN_SYMBOL = process.env.NEXT_PUBLIC_PAYMENT_TOKEN_SYMBOL ?? "pathUSD";

export const PAYMENT_TOKEN_DECIMALS = Number(process.env.NEXT_PUBLIC_PAYMENT_TOKEN_DECIMALS ?? "6");
