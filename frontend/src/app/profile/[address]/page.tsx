"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { NFTCard } from "@/components/NFTCard";
import { useOwnerTokensMulti } from "@/hooks/useNFT";
import { fetchListingsByTokens, fetchMarketplaceActivityPage } from "@/lib/backendApi";
import { useTrackedCollections } from "@/lib/collections";
import { PAYMENT_TOKEN_DECIMALS, PAYMENT_TOKEN_SYMBOL } from "@/lib/chain";
import { formatTokenAmount, shortAddress } from "@/lib/utils";

type ProfileTab = "owned" | "listed" | "offers" | "activity";
type SortMode = "token-asc" | "token-desc" | "price-asc" | "price-desc";

type OwnedItem = {
  collectionSlug: string;
  collectionName: string;
  collectionNftContract: `0x${string}`;
  tokenId: bigint;
  listing: { price: bigint; active: boolean } | null;
};

type WalletActivityItem = {
  type: "ItemListed" | "ItemSold" | "OfferMade";
  sourceLabel?: string;
  tokenId?: string | null;
  nft?: `0x${string}` | null;
  blockNumber: string | null;
  transactionHash: `0x${string}`;
  seller?: `0x${string}`;
  buyer?: `0x${string}`;
  offerer?: `0x${string}`;
  price?: string;
};

function sameAddress(a?: string | null, b?: string | null) {
  if (!a || !b) return false;
  return a.toLowerCase() === b.toLowerCase();
}

export default function ProfilePage() {
  const trackedCollections = useTrackedCollections();
  const params = useParams();
  const wallet = params.address as `0x${string}`;
  const { tokensByContract, totalBalance, isLoading } = useOwnerTokensMulti(
    wallet,
    trackedCollections.map((collection) => collection.nftContract)
  );
  const [listingsByToken, setListingsByToken] = useState<Map<string, { price: bigint; active: boolean }>>(new Map());
  const [loadingListings, setLoadingListings] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>("owned");
  const [search, setSearch] = useState("");
  const [collectionFilter, setCollectionFilter] = useState("all");
  const [sortMode, setSortMode] = useState<SortMode>("token-desc");
  const [walletActivity, setWalletActivity] = useState<WalletActivityItem[]>([]);
  const [loadingWalletActivity, setLoadingWalletActivity] = useState(false);

  const ownedCollections = useMemo(
    () =>
      trackedCollections.map((collection) => ({
        collection,
        tokenIds: tokensByContract.get(collection.nftContract.toLowerCase()) ?? [],
      })).filter((entry) => entry.tokenIds.length > 0),
    [tokensByContract, trackedCollections]
  );

  const ownedItems = useMemo<OwnedItem[]>(
    () =>
      ownedCollections.flatMap(({ collection, tokenIds }) =>
        tokenIds.map((tokenId) => {
          const key = `${collection.nftContract.toLowerCase()}:${tokenId.toString()}`;
          return {
            collectionSlug: collection.slug,
            collectionName: collection.name,
            collectionNftContract: collection.nftContract,
            tokenId,
            listing: listingsByToken.get(key) ?? null,
          };
        })
      ),
    [ownedCollections, listingsByToken]
  );

  const listedItems = useMemo(
    () => ownedItems.filter((item) => !!item.listing?.active),
    [ownedItems]
  );

  const offerEvents = useMemo(
    () => walletActivity.filter((event) => event.type === "OfferMade" && sameAddress(event.offerer, wallet)),
    [walletActivity, wallet]
  );

  useEffect(() => {
    let cancelled = false;
    const isVisible = () => document.visibilityState === "visible";

    async function loadListings() {
      if (!isVisible()) return;
      if (ownedCollections.length === 0) {
        setListingsByToken(new Map());
        return;
      }

      setLoadingListings(true);
      const listingEntries = await Promise.all(
        ownedCollections.map(async (entry) => {
          const listingMap = await fetchListingsByTokens(
            entry.tokenIds,
            entry.collection.nftContract,
            entry.collection.marketContract
          );
          return Array.from(listingMap.entries()).map(([tokenKey, listing]) => [
            `${entry.collection.nftContract.toLowerCase()}:${tokenKey}`,
            { price: listing.price, active: listing.active },
          ] as const);
        })
      );

      if (!cancelled) {
        setListingsByToken(new Map(listingEntries.flat()));
        setLoadingListings(false);
      }
    }

    loadListings();
    const intervalId = window.setInterval(loadListings, 20_000);
    const onVisibilityChange = () => {
      if (isVisible()) {
        void loadListings();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [ownedCollections]);

  useEffect(() => {
    let cancelled = false;
    const isVisible = () => document.visibilityState === "visible";

    async function loadWalletActivity() {
      if (!isVisible()) return;
      setLoadingWalletActivity(true);
      const data = await fetchMarketplaceActivityPage({
        limit: 500,
        offset: 0,
      });

      const filtered = data.events
        .filter((event) => {
          return (
            sameAddress(event.seller, wallet) ||
            sameAddress(event.buyer, wallet) ||
            sameAddress(event.offerer, wallet)
          );
        })
        .map((event) => ({
          type: event.type,
          sourceLabel: event.sourceLabel,
          tokenId: (event as { tokenId?: string | null }).tokenId,
          nft: event.nft,
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
          seller: event.seller,
          buyer: event.buyer,
          offerer: event.offerer,
          price: event.price,
        }));

      if (!cancelled) {
        setWalletActivity(filtered);
        setLoadingWalletActivity(false);
      }
    }

    loadWalletActivity();
    const intervalId = window.setInterval(loadWalletActivity, 20_000);
    const onVisibilityChange = () => {
      if (isVisible()) {
        void loadWalletActivity();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [wallet]);

  const displayedItems = useMemo(() => {
    const source = activeTab === "listed" ? listedItems : ownedItems;
    const normalizedSearch = search.trim().toLowerCase();

    const filtered = source.filter((item) => {
      if (collectionFilter !== "all" && item.collectionSlug !== collectionFilter) {
        return false;
      }
      if (!normalizedSearch) return true;

      const haystack = `${item.collectionName.toLowerCase()} #${item.tokenId.toString()}`;
      return haystack.includes(normalizedSearch);
    });

    return [...filtered].sort((a, b) => {
      if (sortMode === "token-asc") {
        return a.tokenId < b.tokenId ? -1 : a.tokenId > b.tokenId ? 1 : 0;
      }
      if (sortMode === "token-desc") {
        return a.tokenId > b.tokenId ? -1 : a.tokenId < b.tokenId ? 1 : 0;
      }

      const priceA = a.listing?.active ? a.listing.price : null;
      const priceB = b.listing?.active ? b.listing.price : null;
      const nullRankA = priceA === null ? 1 : 0;
      const nullRankB = priceB === null ? 1 : 0;
      if (nullRankA !== nullRankB) {
        return nullRankA - nullRankB;
      }
      if (priceA === null || priceB === null) {
        return a.tokenId < b.tokenId ? -1 : a.tokenId > b.tokenId ? 1 : 0;
      }
      if (sortMode === "price-asc") {
        if (priceA < priceB) return -1;
        if (priceA > priceB) return 1;
        return a.tokenId < b.tokenId ? -1 : a.tokenId > b.tokenId ? 1 : 0;
      }
      if (priceA > priceB) return -1;
      if (priceA < priceB) return 1;
      return a.tokenId < b.tokenId ? -1 : a.tokenId > b.tokenId ? 1 : 0;
    });
  }, [activeTab, listedItems, ownedItems, search, collectionFilter, sortMode]);

  return (
    <div className="space-y-8">
      <section className="card p-6">
        <h1 className="font-milady text-3xl text-milady-pink">Profile</h1>
        <p className="text-milady-cream/70 mt-2">Wallet: {shortAddress(wallet)}</p>
        <p className="text-milady-cream/50 text-sm mt-1">All collections view</p>
        <p className="text-milady-cream/50 text-sm mt-1">{totalBalance} NFT(s) owned</p>
        {isLoading && <p className="text-milady-cream/40 text-xs mt-1">Loading wallet holdings...</p>}
        {loadingListings && <p className="text-milady-cream/40 text-xs mt-1">Loading listing states from backend...</p>}
        {loadingWalletActivity && <p className="text-milady-cream/40 text-xs mt-1">Loading wallet activity...</p>}
      </section>

      <section className="card p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {[
            ["owned", `Owned (${ownedItems.length})`],
            ["listed", `Listed (${listedItems.length})`],
            ["offers", `Offers (${offerEvents.length})`],
            ["activity", `Activity (${walletActivity.length})`],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setActiveTab(value as ProfileTab)}
              className={`text-xs px-3 py-1.5 rounded-md border ${
                activeTab === value
                  ? "border-milady-pink text-milady-pink bg-milady-pink/10"
                  : "border-milady-pink/20 text-milady-cream/70"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {(activeTab === "owned" || activeTab === "listed") && (
          <div className="grid md:grid-cols-3 gap-2">
            <input
              className="input"
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search collection or token"
            />
            <select
              className="input"
              value={collectionFilter}
              onChange={(event) => setCollectionFilter(event.target.value)}
            >
              <option value="all">All collections</option>
              {trackedCollections.map((collection) => (
                <option key={collection.slug} value={collection.slug}>
                  {collection.name}
                </option>
              ))}
            </select>
            <select
              className="input"
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
            >
              <option value="token-desc">Sort: Token desc</option>
              <option value="token-asc">Sort: Token asc</option>
              <option value="price-asc">Sort: Price low-high</option>
              <option value="price-desc">Sort: Price high-low</option>
            </select>
          </div>
        )}
      </section>

      {(activeTab === "owned" || activeTab === "listed") && displayedItems.length === 0 ? (
        <section className="card p-6 text-milady-cream/60">
          {activeTab === "listed" ? "No listed NFTs match this view." : "No NFTs found for this wallet."}
        </section>
      ) : null}

      {(activeTab === "owned" || activeTab === "listed") && displayedItems.length > 0 && (
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
          {displayedItems.map((item) => (
            <NFTCard
              key={`${item.collectionSlug}-${item.tokenId.toString()}`}
              tokenId={item.tokenId}
              isListed={item.listing?.active}
              price={item.listing?.price}
              isOwnedByViewer={true}
              paymentSymbol={PAYMENT_TOKEN_SYMBOL}
              collectionSlug={item.collectionSlug}
              tokenLabelPrefix={item.collectionName}
            />
          ))}
        </section>
      )}

      {activeTab === "offers" && (
        <section className="card p-5 space-y-3">
          {offerEvents.length === 0 ? (
            <p className="text-milady-cream/60 text-sm">No offer events found for this wallet in current index window.</p>
          ) : (
            offerEvents.map((event, idx) => (
              <div key={`${event.transactionHash}-${idx}`} className="rounded-lg border border-milady-pink/10 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <p className="text-milady-cream text-sm font-medium">OfferMade</p>
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
                <p className="text-milady-cream/50 text-xs mt-1">Token: {event.tokenId ?? "-"} · Block: {event.blockNumber ?? "-"}</p>
                <a
                  href={`https://explore.tempo.xyz/tx/${event.transactionHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-milady-pink text-xs hover:underline mt-2 inline-block"
                >
                  View transaction
                </a>
              </div>
            ))
          )}
        </section>
      )}

      {activeTab === "activity" && (
        <section className="card p-5 space-y-3">
          {walletActivity.length === 0 ? (
            <p className="text-milady-cream/60 text-sm">No wallet activity found in current index window.</p>
          ) : (
            walletActivity.map((event, idx) => (
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
                <p className="text-milady-cream/50 text-xs mt-1">Token: {event.tokenId ?? "-"} · Block: {event.blockNumber ?? "-"}</p>
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
            ))
          )}
        </section>
      )}
    </div>
  );
}
