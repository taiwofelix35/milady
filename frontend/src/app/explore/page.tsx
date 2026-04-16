"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAccount, useWriteContract } from "wagmi";
import { NFTCard } from "@/components/NFTCard";
import { fetchActiveListingsPage, type BackendListing } from "@/lib/backendApi";
import { useTrackedCollections, tokenImageFromTemplate } from "@/lib/collections";
import { PAYMENT_TOKEN_DECIMALS, PAYMENT_TOKEN_SYMBOL } from "@/lib/chain";
import { formatTokenAmount } from "@/lib/utils";
import { MILADY_MARKETPLACE_ABI } from "@/lib/abis";

const EXPLORE_SCAN_PER_COLLECTION = Number(
  process.env.NEXT_PUBLIC_EXPLORE_SCAN_PER_COLLECTION ?? "400"
);
const EXPLORE_MAX_RESULTS = 120;
const EXPLORE_FETCH_PER_COLLECTION = Number(
  process.env.NEXT_PUBLIC_EXPLORE_FETCH_PER_COLLECTION ?? "120"
);

type ExploreSort = "price-asc" | "price-desc" | "token-asc" | "token-desc";

type ExploreItem = {
  collectionSlug: string;
  collectionName: string;
  nftContract: `0x${string}`;
  marketContract: `0x${string}`;
  tokenId: bigint;
  listing: BackendListing;
  image: string;
};

export default function ExplorePage() {
  const { isConnected } = useAccount();
  const { writeContractAsync: writeMarketplaceAction } = useWriteContract();
  const trackedCollections = useTrackedCollections();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ExploreItem[]>([]);
  const [buyingKey, setBuyingKey] = useState<string | null>(null);
  const [hasNextByCollection, setHasNextByCollection] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const [selectedCollection, setSelectedCollection] = useState("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState<ExploreSort>("price-asc");
  const [fetchDepth, setFetchDepth] = useState(1);
  const [resultLimit, setResultLimit] = useState(EXPLORE_MAX_RESULTS);

  useEffect(() => {
    setResultLimit(EXPLORE_MAX_RESULTS);
  }, [search, selectedCollection, minPrice, maxPrice, sort]);

  useEffect(() => {
    let cancelled = false;
    const isVisible = () => document.visibilityState === "visible";

    async function load() {
      if (!isVisible()) return;
      setLoading(true);
      try {
        const fetchLimit = EXPLORE_FETCH_PER_COLLECTION * fetchDepth;
        const batches = await Promise.all(
          trackedCollections.map(async (collection) => {
            const page = await fetchActiveListingsPage({
              nftContract: collection.nftContract,
              marketContract: collection.marketContract,
              supply: collection.supply,
              startTokenId: collection.startTokenId ?? 1,
              scan: Math.min(collection.supply || EXPLORE_SCAN_PER_COLLECTION, EXPLORE_SCAN_PER_COLLECTION),
              limit: fetchLimit,
              offset: 0,
              sort: "price-asc",
            });
            return {
              slug: collection.slug,
              hasNext: page?.hasNext ?? false,
              items:
                page?.listings.map(({ tokenId, listing }) => ({
                  collectionSlug: collection.slug,
                  collectionName: collection.name,
                  nftContract: collection.nftContract,
                  marketContract: collection.marketContract,
                  tokenId,
                  listing,
                  image: tokenImageFromTemplate(collection, tokenId),
                })) ?? ([] as ExploreItem[]),
            };
          })
        );

        const nextHasMore = {} as Record<string, boolean>;
        for (const batch of batches) {
          nextHasMore[batch.slug] = batch.hasNext;
        }

        if (!cancelled) {
          setHasNextByCollection(nextHasMore);
          setItems(batches.flatMap((batch) => batch.items));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    const intervalId = window.setInterval(load, 30_000);
    const onVisibilityChange = () => {
      if (isVisible()) {
        void load();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [trackedCollections, fetchDepth]);

  const filteredSortedItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    const parsePrice = (value: string): bigint | null => {
      const normalized = value.trim();
      if (!normalized) return null;
      const [whole, fraction = ""] = normalized.split(".");
      if (!/^\d+$/.test(whole || "0") || !/^\d*$/.test(fraction)) {
        return null;
      }
      const paddedFraction = (fraction + "0".repeat(PAYMENT_TOKEN_DECIMALS)).slice(0, PAYMENT_TOKEN_DECIMALS);
      return BigInt(whole || "0") * 10n ** BigInt(PAYMENT_TOKEN_DECIMALS) + BigInt(paddedFraction || "0");
    };

    const min = parsePrice(minPrice);
    const max = parsePrice(maxPrice);

    const filtered = items.filter((item) => {
      if (selectedCollection !== "all" && item.collectionSlug !== selectedCollection) {
        return false;
      }

      if (normalizedSearch) {
        const haystack = `${item.collectionName.toLowerCase()} #${item.tokenId.toString()}`;
        if (!haystack.includes(normalizedSearch)) {
          return false;
        }
      }

      if (min !== null && item.listing.price < min) return false;
      if (max !== null && item.listing.price > max) return false;

      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      if (sort === "price-asc") {
        if (a.listing.price < b.listing.price) return -1;
        if (a.listing.price > b.listing.price) return 1;
        return a.tokenId < b.tokenId ? -1 : a.tokenId > b.tokenId ? 1 : 0;
      }
      if (sort === "price-desc") {
        if (a.listing.price > b.listing.price) return -1;
        if (a.listing.price < b.listing.price) return 1;
        return a.tokenId < b.tokenId ? -1 : a.tokenId > b.tokenId ? 1 : 0;
      }
      if (sort === "token-asc") {
        return a.tokenId < b.tokenId ? -1 : a.tokenId > b.tokenId ? 1 : 0;
      }
      return a.tokenId > b.tokenId ? -1 : a.tokenId < b.tokenId ? 1 : 0;
    });

    return sorted;
  }, [items, search, selectedCollection, minPrice, maxPrice, sort]);

  const visibleItems = useMemo(
    () => filteredSortedItems.slice(0, resultLimit),
    [filteredSortedItems, resultLimit]
  );

  const hasMoreInCurrentView = useMemo(() => {
    if (selectedCollection === "all") {
      return trackedCollections.some((collection) => hasNextByCollection[collection.slug]);
    }
    return !!hasNextByCollection[selectedCollection];
  }, [selectedCollection, trackedCollections, hasNextByCollection]);

  const canLoadMore = visibleItems.length < filteredSortedItems.length || hasMoreInCurrentView;

  function handleLoadMore() {
    if (visibleItems.length < filteredSortedItems.length) {
      setResultLimit((prev) => prev + EXPLORE_MAX_RESULTS);
      return;
    }
    if (hasMoreInCurrentView) {
      setFetchDepth((prev) => prev + 1);
      setResultLimit((prev) => prev + EXPLORE_MAX_RESULTS);
    }
  }

  async function buyListedItem(item: ExploreItem) {
    if (!isConnected) return;
    if (!item.listing.active) return;
    if ((item.listing.source ?? "milady") !== "milady") return;

    const key = `${item.collectionSlug}-${item.tokenId.toString()}`;
    try {
      setBuyingKey(key);
      await writeMarketplaceAction({
        address: item.marketContract,
        abi: MILADY_MARKETPLACE_ABI,
        functionName: "buyListing",
        args: [item.nftContract, item.tokenId],
      });
    } finally {
      setBuyingKey(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="card p-6 space-y-3">
        <h1 className="font-milady text-3xl text-milady-pink">Explore Listings</h1>
        <p className="text-milady-cream/70 text-sm">
          Cross-collection discovery for listed NFTs with backend pagination.
        </p>
        <p className="text-milady-cream/50 text-xs">
          Data source: backend active listings index with up to {EXPLORE_FETCH_PER_COLLECTION} rows per collection.
        </p>
      </section>

      <section className="card p-4 grid md:grid-cols-2 lg:grid-cols-5 gap-2">
        <input
          className="input"
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search collection or token"
        />

        <select
          className="input"
          value={selectedCollection}
          onChange={(event) => setSelectedCollection(event.target.value)}
        >
          <option value="all">All collections</option>
          {trackedCollections.map((collection) => (
            <option key={collection.slug} value={collection.slug}>
              {collection.name}
            </option>
          ))}
        </select>

        <input
          className="input"
          type="number"
          min="0"
          step="0.001"
          value={minPrice}
          onChange={(event) => setMinPrice(event.target.value)}
          placeholder={`Min ${PAYMENT_TOKEN_SYMBOL}`}
        />

        <input
          className="input"
          type="number"
          min="0"
          step="0.001"
          value={maxPrice}
          onChange={(event) => setMaxPrice(event.target.value)}
          placeholder={`Max ${PAYMENT_TOKEN_SYMBOL}`}
        />

        <select className="input" value={sort} onChange={(event) => setSort(event.target.value as ExploreSort)}>
          <option value="price-asc">Sort: Price low-high</option>
          <option value="price-desc">Sort: Price high-low</option>
          <option value="token-asc">Sort: Token asc</option>
          <option value="token-desc">Sort: Token desc</option>
        </select>
      </section>

      {loading ? (
        <section className="card p-6 text-milady-cream/60">Loading listings...</section>
      ) : visibleItems.length === 0 ? (
        <section className="card p-6 text-milady-cream/60">No listings match your filters.</section>
      ) : (
        <>
          <section className="flex items-center justify-between">
            <p className="text-milady-cream/60 text-sm">{visibleItems.length.toLocaleString()} listing(s) shown</p>
            <p className="text-milady-cream/50 text-xs">
              Lowest shown: {formatTokenAmount(visibleItems[0].listing.price, PAYMENT_TOKEN_DECIMALS)} {PAYMENT_TOKEN_SYMBOL}
            </p>
          </section>

          <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
            {visibleItems.map((item) => (
              <div key={`${item.collectionSlug}-${item.tokenId.toString()}`} className="space-y-2">
                <NFTCard
                  tokenId={item.tokenId}
                  image={item.image}
                  isListed
                  price={item.listing.price}
                  paymentSymbol={PAYMENT_TOKEN_SYMBOL}
                  collectionSlug={item.collectionSlug}
                  tokenLabelPrefix={item.collectionName}
                  onAction={
                    (item.listing.source ?? "milady") === "milady"
                      ? () => buyListedItem(item)
                      : undefined
                  }
                  actionLabel="Buy now"
                  actionDisabled={!isConnected || buyingKey === `${item.collectionSlug}-${item.tokenId.toString()}`}
                  actionLoading={buyingKey === `${item.collectionSlug}-${item.tokenId.toString()}`}
                />
                <div className="px-1 flex items-center justify-between text-xs text-milady-cream/60">
                  <span>{item.collectionName}</span>
                  <Link href={`/collection/${item.collectionSlug}`} className="text-milady-pink hover:underline">
                    Collection
                  </Link>
                </div>
              </div>
            ))}
          </section>

          {canLoadMore && (
            <section className="flex justify-center pt-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={handleLoadMore}
                disabled={loading}
              >
                {loading ? "Loading more..." : "Load More Listings"}
              </button>
            </section>
          )}
        </>
      )}
    </div>
  );
}
