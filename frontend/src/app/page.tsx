"use client";

import { NFTCard } from "@/components/NFTCard";
import { useTotalSupply } from "@/hooks/useNFT";
import { NFT_CONTRACT_ADDRESS, MARKETPLACE_CONTRACT_ADDRESS } from "@/lib/chain";

// Generates an array [0n, 1n, ..., n-1n]
function range(n: number): bigint[] {
  return Array.from({ length: n }, (_, i) => BigInt(i));
}

const MAX_DISPLAY = 48;

export default function HomePage() {
  const { data: totalSupply, isLoading } = useTotalSupply();
  const supply = Number(totalSupply ?? 0n);
  const tokenIds = range(Math.min(supply, MAX_DISPLAY));

  return (
    <div>
      {/* Hero */}
      <section className="text-center py-16 mb-12 relative">
        <div className="absolute inset-0 bg-pink-gradient opacity-5 rounded-3xl" />
        <h1 className="font-milady text-4xl md:text-6xl text-milady-pink drop-shadow-lg mb-4">
          ✦ Milady Market ✦
        </h1>
        <p className="text-milady-cream/70 text-lg max-w-xl mx-auto mb-8">
          Buy, sell, and collect Milady NFTs on the Tempo blockchain.
          Every trade is on-chain, royalties are enforced.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <a
            href={`https://explorer.tempo.network/address/${NFT_CONTRACT_ADDRESS}`}
            target="_blank"
            rel="noopener noreferrer"
            className="badge hover:bg-milady-pink/30 transition-colors cursor-pointer"
          >
            NFT Contract
          </a>
          <a
            href={`https://explorer.tempo.network/address/${MARKETPLACE_CONTRACT_ADDRESS}`}
            target="_blank"
            rel="noopener noreferrer"
            className="badge hover:bg-milady-pink/30 transition-colors cursor-pointer"
          >
            Marketplace Contract
          </a>
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
            <NFTCard key={id.toString()} tokenId={id} />
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
