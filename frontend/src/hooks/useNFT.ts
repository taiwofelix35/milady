"use client";

import { useReadContract, useReadContracts } from "wagmi";
import { MILADY_NFT_ABI, MILADY_MARKETPLACE_ABI } from "@/lib/abis";
import { NFT_CONTRACT_ADDRESS, MARKETPLACE_CONTRACT_ADDRESS } from "@/lib/chain";
import { useEffect, useState } from "react";
import { fetchMetadata } from "@/lib/utils";

export interface TokenMetadata {
  name?: string;
  description?: string;
  image?: string;
  attributes?: Array<{ trait_type: string; value: string }>;
}

export function useTokenMetadata(tokenId: bigint) {
  const [metadata, setMetadata] = useState<TokenMetadata | null>(null);
  const [loading, setLoading] = useState(true);

  const { data: uri } = useReadContract({
    address: NFT_CONTRACT_ADDRESS,
    abi: MILADY_NFT_ABI,
    functionName: "tokenURI",
    args: [tokenId],
  });

  useEffect(() => {
    if (!uri) return;
    setLoading(true);
    fetchMetadata(uri)
      .then(setMetadata)
      .finally(() => setLoading(false));
  }, [uri]);

  return { metadata, loading, uri };
}

export function useTotalSupply() {
  return useReadContract({
    address: NFT_CONTRACT_ADDRESS,
    abi: MILADY_NFT_ABI,
    functionName: "totalSupply",
  });
}

export function useOwnerTokens(owner?: string) {
  const { data: balance } = useReadContract({
    address: NFT_CONTRACT_ADDRESS,
    abi: MILADY_NFT_ABI,
    functionName: "balanceOf",
    args: [owner as `0x${string}`],
    query: { enabled: !!owner },
  });

  const tokenCount = Number(balance ?? 0n);
  const indices = Array.from({ length: tokenCount }, (_, i) => BigInt(i));

  const { data: tokenIds } = useReadContracts({
    contracts: indices.map((idx) => ({
      address: NFT_CONTRACT_ADDRESS,
      abi: MILADY_NFT_ABI,
      functionName: "tokenOfOwnerByIndex" as const,
      args: [owner as `0x${string}`, idx],
    })),
    query: { enabled: tokenCount > 0 },
  });

  return {
    tokenIds: (tokenIds ?? []).map((r) => (r.status === "success" ? r.result as bigint : null)).filter(Boolean) as bigint[],
    balance: tokenCount,
  };
}

export function useListing(listingId?: `0x${string}`) {
  return useReadContract({
    address: MARKETPLACE_CONTRACT_ADDRESS,
    abi: MILADY_MARKETPLACE_ABI,
    functionName: "listings",
    args: [listingId!],
    query: { enabled: !!listingId },
  });
}

export function useOffer(offerId?: `0x${string}`) {
  return useReadContract({
    address: MARKETPLACE_CONTRACT_ADDRESS,
    abi: MILADY_MARKETPLACE_ABI,
    functionName: "offers",
    args: [offerId!],
    query: { enabled: !!offerId },
  });
}

export function useIsApprovedForMarketplace(owner?: string) {
  return useReadContract({
    address: NFT_CONTRACT_ADDRESS,
    abi: MILADY_NFT_ABI,
    functionName: "isApprovedForAll",
    args: [owner as `0x${string}`, MARKETPLACE_CONTRACT_ADDRESS],
    query: { enabled: !!owner },
  });
}
