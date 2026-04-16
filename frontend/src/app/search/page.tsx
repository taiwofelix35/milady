"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { fetchMarketplaceSearch } from "@/lib/backendApi";
import { formatTokenAmount, shortAddress } from "@/lib/utils";
import { PAYMENT_TOKEN_DECIMALS, PAYMENT_TOKEN_SYMBOL } from "@/lib/chain";
import { getCollectionByNftContract } from "@/lib/collections";

function SearchPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const q = (searchParams.get("q") ?? "").trim();
  const [page, setPage] = useState(1);
  const [queryInput, setQueryInput] = useState("");
  const pageSize = 30;
  const offset = (page - 1) * pageSize;

  useEffect(() => {
    setPage(1);
  }, [q]);

  useEffect(() => {
    setQueryInput(q);
  }, [q]);

  const { data, isLoading } = useQuery({
    queryKey: ["marketplace-search", q, page],
    queryFn: () => fetchMarketplaceSearch({ q, limit: pageSize, offset }),
    enabled: q.length > 0,
    staleTime: 20_000,
  });

  const events = data?.events ?? [];
  const listings = data?.listings ?? [];

  const title = useMemo(() => {
    if (!q) return "Search";
    return `Search results for \"${q}\"`;
  }, [q]);

  return (
    <div className="space-y-6">
      <section className="card p-6 space-y-2">
        <h1 className="font-milady text-3xl text-milady-pink">{title}</h1>
        <p className="text-milady-cream/70 text-sm">
          Search tokens, wallets, transaction hashes, and marketplace event types.
        </p>
        <form
          className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 pt-1"
          onSubmit={(event) => {
            event.preventDefault();
            const nextQuery = queryInput.trim();
            if (!nextQuery) {
              router.push("/search");
              return;
            }
            router.push(`/search?q=${encodeURIComponent(nextQuery)}`);
          }}
        >
          <input
            className="input"
            type="search"
            value={queryInput}
            onChange={(event) => setQueryInput(event.target.value)}
            placeholder="Search token ID, wallet, tx hash, event"
          />
          <button type="submit" className="btn-primary w-full sm:w-auto">Search</button>
        </form>
        {!q && <p className="text-milady-cream/50 text-sm">Type a query above to search the marketplace index.</p>}
      </section>

      {q && isLoading && <section className="card p-6 text-milady-cream/60">Searching marketplace index...</section>}

      {q && !isLoading && !data && (
        <section className="card p-6 text-milady-cream/60">Search is currently unavailable.</section>
      )}

      {q && data && (
        <>
          <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="card p-4">
              <p className="text-milady-cream/50 text-xs uppercase tracking-wide">Query Type</p>
              <p className="text-milady-pink text-lg font-semibold mt-1">{data.queryType}</p>
            </div>
            <div className="card p-4">
              <p className="text-milady-cream/50 text-xs uppercase tracking-wide">Matched Events</p>
              <p className="text-milady-pink text-lg font-semibold mt-1">{data.totalEvents.toLocaleString()}</p>
            </div>
            <div className="card p-4">
              <p className="text-milady-cream/50 text-xs uppercase tracking-wide">Token Listings</p>
              <p className="text-milady-pink text-lg font-semibold mt-1">{listings.length.toLocaleString()}</p>
            </div>
          </section>

          <section className="card p-5 space-y-3">
            <h2 className="section-title">Listings</h2>
            {listings.length === 0 ? (
              <p className="text-milady-cream/60 text-sm">No listing matches for this query.</p>
            ) : (
              <div className="space-y-3">
                {listings.map((listing, idx) => {
                  const collection = getCollectionByNftContract(listing.nft);
                  return (
                    <div key={`${listing.nft}-${listing.tokenId}-${idx}`} className="rounded-lg border border-milady-pink/10 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-milady-cream text-sm font-medium">
                          {collection?.name ?? listing.nft} #{listing.tokenId}
                        </p>
                        <p className="text-milady-pink text-sm font-semibold">
                          {formatTokenAmount(BigInt(listing.price), PAYMENT_TOKEN_DECIMALS)} {PAYMENT_TOKEN_SYMBOL}
                        </p>
                      </div>
                      <p className="text-milady-cream/50 text-xs mt-1">Seller: {shortAddress(listing.seller)}</p>
                      <div className="mt-2 flex items-center gap-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${listing.active ? "border-green-500/40 text-green-300" : "border-milady-cream/20 text-milady-cream/60"}`}>
                          {listing.active ? "Active" : "Inactive"}
                        </span>
                        {collection && (
                          <Link
                            href={`/nft/${listing.tokenId}?collection=${encodeURIComponent(collection.slug)}`}
                            className="text-milady-pink text-xs hover:underline"
                          >
                            Open NFT
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="card p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="section-title">Events</h2>
              <p className="text-milady-cream/50 text-xs text-right">
                Page {page} · Showing {events.length.toLocaleString()} / {data.totalEvents.toLocaleString()}
              </p>
            </div>
            {events.length === 0 ? (
              <p className="text-milady-cream/60 text-sm">No event matches for this query.</p>
            ) : (
              <div className="space-y-3">
                {events.map((event, idx) => (
                  <div key={`${event.transactionHash}-${idx}`} className="rounded-lg border border-milady-pink/10 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <p className="text-milady-cream text-sm font-medium">{event.type}</p>
                        {event.sourceLabel && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full border border-milady-pink/25 text-milady-pink">
                            {event.sourceLabel}
                          </span>
                        )}
                      </div>
                      {event.price && (
                        <p className="text-milady-pink text-sm font-semibold">
                          {formatTokenAmount(BigInt(event.price), PAYMENT_TOKEN_DECIMALS)} {PAYMENT_TOKEN_SYMBOL}
                        </p>
                      )}
                    </div>
                    <p className="text-milady-cream/50 text-xs mt-1">Token: {(event as { tokenId?: string | null }).tokenId ?? "-"} · Block: {event.blockNumber ?? "-"}</p>
                    <div className="text-milady-cream/60 text-xs mt-2 space-y-1">
                      {event.seller && <p>Seller: {shortAddress(event.seller)}</p>}
                      {event.buyer && <p>Buyer: {shortAddress(event.buyer)}</p>}
                      {event.offerer && <p>Offerer: {shortAddress(event.offerer)}</p>}
                    </div>
                    <a
                      href={`https://explore.tempo.xyz/tx/${event.transactionHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-milady-pink text-xs hover:underline mt-2 inline-block"
                    >
                      View transaction
                    </a>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-milady-pink/10 sticky bottom-0 bg-milady-charcoal-light/95 backdrop-blur-sm">
              <button
                type="button"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={isLoading || page <= 1}
                className="text-xs px-3 py-2 rounded-md border border-milady-pink/20 text-milady-cream/70 hover:text-milady-cream disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((prev) => prev + 1)}
                disabled={isLoading || !data.hasNext}
                className="text-xs px-3 py-2 rounded-md border border-milady-pink/20 text-milady-cream/70 hover:text-milady-cream disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<section className="card p-6 text-milady-cream/60">Loading search...</section>}>
      <SearchPageContent />
    </Suspense>
  );
}
