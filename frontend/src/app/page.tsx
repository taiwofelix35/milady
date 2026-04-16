"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { NFTCard } from "@/components/NFTCard";
import { useTotalSupply } from "@/hooks/useNFT";
import { useTrackedCollections, PRIMARY_COLLECTION } from "@/lib/collections";
import { fetchCollectionStats } from "@/lib/backendApi";
import { PAYMENT_TOKEN_DECIMALS, PAYMENT_TOKEN_SYMBOL } from "@/lib/chain";
import { formatTokenAmount } from "@/lib/utils";

// Generates an array [0n, 1n, ..., n-1n]
function range(n: number): bigint[] {
  return Array.from({ length: n }, (_, i) => BigInt(i));
}

const MAX_DISPLAY = 48;
const MAX_STATS_SCAN = 120;
const MAX_STATS_COLLECTIONS = 6;

function shortContract(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function HomePage() {
  const trackedCollections = useTrackedCollections();
  const { data: totalSupply, isLoading } = useTotalSupply();
  const supply = Number(totalSupply ?? 0n);
  const tokenIds = range(Math.min(supply, MAX_DISPLAY));
  const [collectionStats, setCollectionStats] = useState<Record<string, { activeListings: number; totalVolume: bigint }>>({});

  useEffect(() => {
    let cancelled = false;
    const isVisible = () => document.visibilityState === "visible";

    async function loadCollectionStats() {
      if (!isVisible()) return;
      const rows = await Promise.all(
        trackedCollections.slice(0, MAX_STATS_COLLECTIONS).map(async (collection) => {
          const cappedSupply = Math.max(1, Math.min(collection.supply, MAX_STATS_SCAN));
          const stats = await fetchCollectionStats({
            nftContract: collection.nftContract,
            supply: cappedSupply,
            startTokenId: collection.startTokenId ?? 1,
            scan: cappedSupply,
          });
          return [collection.slug, stats] as const;
        })
      );

      if (!cancelled) {
        const next = {} as Record<string, { activeListings: number; totalVolume: bigint }>;
        for (const [slug, stats] of rows) {
          if (!stats) continue;
          next[slug] = {
            activeListings: stats.activeListings,
            totalVolume: stats.totalVolume,
          };
        }
        setCollectionStats(next);
      }
    }

    loadCollectionStats();
    const intervalId = window.setInterval(loadCollectionStats, 30_000);
    const onVisibilityChange = () => {
      if (isVisible()) {
        void loadCollectionStats();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [trackedCollections]);

  return (
    <div>
      {/* Hero */}
      <section className="text-center py-16 mb-12 relative">
        <div className="absolute inset-0 bg-pink-gradient opacity-5 rounded-3xl" />
        <h1 className="font-milady text-4xl md:text-6xl text-milady-pink drop-shadow-lg mb-4">
          ✦ Tempo Market ✦
        </h1>
        <p className="text-milady-cream/70 text-lg max-w-xl mx-auto mb-8">
          Buy, sell, and collect NFTs across Tempo collections.
        </p>
      </section>

      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title">Collections</h2>
          <span className="text-milady-cream/40 text-sm">{trackedCollections.length} tracked</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {trackedCollections.map((collection) => (
            <Link
              key={collection.slug}
              href={`/collection/${collection.slug}`}
              className="card overflow-hidden hover:border-milady-pink/40 hover:-translate-y-0.5 transition-all duration-200"
            >
              <div className="relative aspect-video w-full bg-milady-charcoal-light">
                <img
                  src={collection.coverImage || "/placeholder.svg"}
                  alt={`${collection.name} cover`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  onError={(event) => {
                    event.currentTarget.src = "/placeholder.svg";
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-milady-charcoal/90 via-milady-charcoal/20 to-transparent" />
                <div className="absolute top-2 left-2 text-[10px] px-2 py-1 rounded-full border border-milady-pink/30 bg-milady-charcoal/80 text-milady-cream/80">
                  Tempo
                </div>
                <div className="absolute top-2 right-2 text-[10px] px-2 py-1 rounded-full border border-milady-pink/30 bg-milady-charcoal/80 text-milady-pink">
                  {collection.supply.toLocaleString()} supply
                </div>
              </div>
              <div className="p-4">
                {(() => {
                  const stats = collectionStats[collection.slug];
                  const listedText = stats ? stats.activeListings.toLocaleString() : "...";
                  const volumeText = stats
                    ? `${formatTokenAmount(stats.totalVolume, PAYMENT_TOKEN_DECIMALS)} ${PAYMENT_TOKEN_SYMBOL}`
                    : "...";
                  return (
                    <div className="mb-2 text-[11px] text-milady-cream/60 flex items-center justify-between gap-3">
                      <span>Listed: {listedText}</span>
                      <span>Volume: {volumeText}</span>
                    </div>
                  );
                })()}
                <div className="flex items-center justify-between gap-2">
                  <p className="text-milady-pink font-semibold truncate">{collection.name}</p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full border border-milady-pink/20 text-milady-cream/60 uppercase tracking-wide">
                    {collection.slug}
                  </span>
                </div>
                <p className="text-milady-cream/60 text-sm mt-1 line-clamp-2">{collection.description}</p>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <p className="text-milady-cream/40 font-mono">{shortContract(collection.nftContract)}</p>
                  <span className="text-milady-pink/80">Collection</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Stats bar */}
      <div className="flex items-center justify-between mb-8 border-b border-milady-pink/10 pb-4">
        <h2 className="section-title">Gallery</h2>
        <span className="text-milady-cream/40 text-sm">
          {isLoading ? "Loading…" : `${supply.toLocaleString()} minted`}
        </span>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card aspect-square animate-pulse bg-milady-charcoal-light" />
          ))}
        </div>
      ) : supply === 0 ? (
        <div className="text-center py-24 text-milady-cream/40">
          <p className="text-4xl mb-4">🌸</p>
          <p className="font-milady text-lg text-milady-pink/60">No NFTs minted yet</p>
          <p className="text-sm mt-2">Be the first to mint a Milady!</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
          {tokenIds.map((id) => (
            <NFTCard
              key={id.toString()}
              tokenId={id}
              collectionSlug={PRIMARY_COLLECTION.slug}
              tokenLabelPrefix={PRIMARY_COLLECTION.name}
            />
          ))}
        </div>
      )}

      {supply > MAX_DISPLAY && (
        <p className="text-center text-milady-cream/40 text-sm mt-8">
          Showing first {MAX_DISPLAY} of {supply.toLocaleString()} NFTs
        </p>
      )}
    </div>
  );
}
