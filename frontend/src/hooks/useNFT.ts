"use client";

import { useReadContract, useReadContracts } from "wagmi";
import { MILADY_NFT_ABI, MILADY_MARKETPLACE_ABI } from "@/lib/abis";
import { NFT_CONTRACT_ADDRESS, MARKETPLACE_CONTRACT_ADDRESS } from "@/lib/chain";
import { useEffect, useMemo, useState } from "react";
import { fetchMetadata } from "@/lib/utils";

export interface TokenMetadata {
  name?: string;
  description?: string;
  image?: string;
  attributes?: Array<{ trait_type: string; value: string }>;
}

export function useTokenMetadata(tokenId: bigint, nftContract: `0x${string}` = NFT_CONTRACT_ADDRESS) {
  const [metadata, setMetadata] = useState<TokenMetadata | null>(null);
  const [loading, setLoading] = useState(true);

  const { data: uri } = useReadContract({
    address: nftContract,
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

export function useTotalSupply(nftContract: `0x${string}` = NFT_CONTRACT_ADDRESS) {
  return useReadContract({
    address: nftContract,
    abi: MILADY_NFT_ABI,
    functionName: "totalSupply",
  });
}

export function useOwnerTokens(owner?: string, nftContract: `0x${string}` = NFT_CONTRACT_ADDRESS) {
  const { data: balance } = useReadContract({
    address: nftContract,
    abi: MILADY_NFT_ABI,
    functionName: "balanceOf",
    args: [owner as `0x${string}`],
    query: { enabled: !!owner, refetchInterval: 20_000 },
  });

  const tokenCount = Number(balance ?? 0n);
  const indices = Array.from({ length: tokenCount }, (_, i) => BigInt(i));

  const { data: tokenIds } = useReadContracts({
    contracts: indices.map((idx) => ({
      address: nftContract,
      abi: MILADY_NFT_ABI,
      functionName: "tokenOfOwnerByIndex" as const,
      args: [owner as `0x${string}`, idx],
    })),
    query: { enabled: tokenCount > 0, refetchInterval: 20_000 },
  });

  return {
    tokenIds: (tokenIds ?? []).map((r) => (r.status === "success" ? r.result as bigint : null)).filter(Boolean) as bigint[],
    balance: tokenCount,
  };
}

export function useOwnerTokensMulti(owner: string | undefined, nftContracts: `0x${string}`[]) {
  const { data: balancesData, isLoading: balancesLoading } = useReadContracts({
    contracts: nftContracts.map((contract) => ({
      address: contract,
      abi: MILADY_NFT_ABI,
      functionName: "balanceOf" as const,
      args: [owner as `0x${string}`],
    })),
    query: { enabled: !!owner && nftContracts.length > 0, refetchInterval: 20_000 },
  });

  const tokenCounts = useMemo(
    () =>
      nftContracts.map((_, idx) => {
        const row = balancesData?.[idx];
        if (!row || row.status !== "success") return 0;
        return Number(row.result as bigint);
      }),
    [balancesData, nftContracts]
  );

  const tokenQueries = useMemo(
    () =>
      nftContracts.flatMap((contract, contractIndex) => {
        const count = tokenCounts[contractIndex] ?? 0;
        return Array.from({ length: count }, (_, i) => ({
          contract,
          index: BigInt(i),
        }));
      }),
    [nftContracts, tokenCounts]
  );

  const { data: tokenIdsData, isLoading: tokenIdsLoading } = useReadContracts({
    contracts: tokenQueries.map((query) => ({
      address: query.contract,
      abi: MILADY_NFT_ABI,
      functionName: "tokenOfOwnerByIndex" as const,
      args: [owner as `0x${string}`, query.index],
    })),
    query: { enabled: !!owner && tokenQueries.length > 0, refetchInterval: 20_000 },
  });

  const tokensByContract = useMemo(() => {
    const mapping = new Map<string, bigint[]>();
    nftContracts.forEach((contract) => {
      mapping.set(contract.toLowerCase(), []);
    });

    tokenQueries.forEach((query, idx) => {
      const row = tokenIdsData?.[idx];
      if (!row || row.status !== "success") return;
      const key = query.contract.toLowerCase();
      const existing = mapping.get(key) ?? [];
      existing.push(row.result as bigint);
      mapping.set(key, existing);
    });

    return mapping;
  }, [nftContracts, tokenIdsData, tokenQueries]);

  return {
    tokensByContract,
    totalBalance: tokenCounts.reduce((sum, value) => sum + value, 0),
    isLoading: balancesLoading || tokenIdsLoading,
  };
}

export function useListing(tokenId?: bigint) {
  return useListingByContracts(tokenId, NFT_CONTRACT_ADDRESS, MARKETPLACE_CONTRACT_ADDRESS);
}

export function useListingByContracts(
  tokenId: bigint | undefined,
  nftContract: `0x${string}`,
  marketplaceContract: `0x${string}`
) {
  return useReadContract({
    address: marketplaceContract,
    abi: MILADY_MARKETPLACE_ABI,
    functionName: "getListing",
    args: [nftContract, tokenId!],
    query: { enabled: tokenId !== undefined },
  });
}

export function useOffer(tokenId?: bigint, offerer?: `0x${string}`) {
  return useOfferByContracts(tokenId, offerer, NFT_CONTRACT_ADDRESS, MARKETPLACE_CONTRACT_ADDRESS);
}

export function useOfferByContracts(
  tokenId: bigint | undefined,
  offerer: `0x${string}` | undefined,
  nftContract: `0x${string}`,
  marketplaceContract: `0x${string}`
) {
  return useReadContract({
    address: marketplaceContract,
    abi: MILADY_MARKETPLACE_ABI,
    functionName: "getOffer",
    args: [nftContract, tokenId!, offerer!],
    query: { enabled: tokenId !== undefined && !!offerer },
  });
}

export function useIsApprovedForMarketplace(owner?: string) {
  return useIsApprovedForMarketplaceByContracts(owner, NFT_CONTRACT_ADDRESS, MARKETPLACE_CONTRACT_ADDRESS);
}

export function useIsApprovedForMarketplaceByContracts(
  owner: string | undefined,
  nftContract: `0x${string}`,
  marketplaceContract: `0x${string}`
) {
  return useReadContract({
    address: nftContract,
    abi: MILADY_NFT_ABI,
    functionName: "isApprovedForAll",
    args: [owner as `0x${string}`, marketplaceContract],
    query: { enabled: !!owner },
  });
}
