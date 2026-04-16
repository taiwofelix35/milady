"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { parseUnits } from "viem";
import { NFTCard } from "@/components/NFTCard";
import { useIsApprovedForMarketplaceByContracts, useOwnerTokens, useTokenMetadata, useTotalSupply } from "@/hooks/useNFT";
import { getCollectionBySlug, tokenImageFromTemplate } from "@/lib/collections";
import { saveSelectedCollectionSlug } from "@/lib/collectionContext";
import {
  BackendListing,
  fetchActiveListingsPage,
  fetchActiveOffersPage,
  fetchCollectionHolders,
  fetchCollectionStats,
  fetchListingsByTokens,
  fetchMarketplaceActivityPage,
  fetchRarityRanks,
} from "@/lib/backendApi";
import { formatTokenAmount, resolveIPFS, shortAddress } from "@/lib/utils";
import { PAYMENT_TOKEN_ADDRESS, PAYMENT_TOKEN_DECIMALS, PAYMENT_TOKEN_SYMBOL } from "@/lib/chain";
import { ERC20_ABI, MILADY_MARKETPLACE_ABI, MILADY_NFT_ABI } from "@/lib/abis";

function range(start: number, n: number): bigint[] {
  return Array.from({ length: n }, (_, i) => BigInt(start + i));
}

const COLLECTION_PAGE_SIZE = 60;
const COLLECTION_ACTIVITY_PAGE_SIZE = 20;
const COLLECTION_OFFERS_PAGE_SIZE = 20;
const COLLECTION_STATS_SCAN_CAP = 200;
const MAX_UINT256 = (1n << 256n) - 1n;

type OwnershipFilter = "all" | "owned" | "not-owned";
type SortMode = "price-asc" | "price-desc" | "token-asc" | "token-desc";

function NFTQuickViewModal({
  tokenId,
  collectionSlug,
  onClose,
}: {
  tokenId: bigint;
  collectionSlug: string;
  onClose: () => void;
}) {
  const { address } = useAccount();
  const collection = getCollectionBySlug(collectionSlug);
  const [offerPrice, setOfferPrice] = useState("");
  const [offerHours, setOfferHours] = useState("24");
  const [listPrice, setListPrice] = useState("");
  const [offererAddress, setOffererAddress] = useState("");

  const [listing, setListing] = useState<{
    seller: `0x${string}`;
    price: bigint;
    active: boolean;
    source?: string | null;
    sourceLabel?: string | null;
  } | null>(null);
  const [listingLoading, setListingLoading] = useState(true);

  const { metadata, loading: metadataLoading } = useTokenMetadata(
    tokenId,
    collection?.nftContract ?? "0x0000000000000000000000000000000000000000"
  );

  const { data: owner, refetch: refetchOwner } = useReadContract({
    address: collection?.nftContract ?? "0x0000000000000000000000000000000000000000",
    abi: MILADY_NFT_ABI,
    functionName: "ownerOf",
    args: [tokenId],
    query: { enabled: !!collection },
  });

  const { data: isApproved, refetch: refetchApproval } = useIsApprovedForMarketplaceByContracts(
    address,
    collection?.nftContract ?? "0x0000000000000000000000000000000000000000",
    collection?.marketContract ?? "0x0000000000000000000000000000000000000000"
  );

  const isOwner =
    !!address &&
    !!owner &&
    address.toLowerCase() === (owner as string).toLowerCase();

  const hasActiveListing = !!listing?.active;
  const listingIsExternal = !!listing?.active && (listing?.source ?? "milady") !== "milady";

  const imageSrc = metadata?.image
    ? resolveIPFS(metadata.image)
    : collection
      ? tokenImageFromTemplate(collection, tokenId)
      : "/placeholder.svg";
  const isRemoteImage = imageSrc.startsWith("http://") || imageSrc.startsWith("https://");
  const displayName = metadata?.name ?? `${collection?.name ?? "NFT"} #${tokenId.toString()}`;

  const { writeContract: writeApprove, data: approveHash, isPending: approving } = useWriteContract();
  const { isLoading: approveConfirming, isSuccess: approveSuccess } = useWaitForTransactionReceipt({
    hash: approveHash,
  });

  const { writeContract: writeBuy, data: buyHash, isPending: buying } = useWriteContract();
  const { isLoading: buyConfirming, isSuccess: buySuccess } = useWaitForTransactionReceipt({
    hash: buyHash,
  });

  const { writeContract: writeList, data: listHash, isPending: listingPending } = useWriteContract();
  const { isLoading: listConfirming, isSuccess: listSuccess } = useWaitForTransactionReceipt({
    hash: listHash,
  });

  const { writeContract: writeCancelListing, data: cancelListingHash, isPending: cancelListingPending } = useWriteContract();
  const { isLoading: cancelListingConfirming, isSuccess: cancelListingSuccess } = useWaitForTransactionReceipt({
    hash: cancelListingHash,
  });

  const { writeContract: writeOffer, data: offerHash, isPending: offerPending } = useWriteContract();
  const { isLoading: offerConfirming, isSuccess: offerSuccess } = useWaitForTransactionReceipt({
    hash: offerHash,
  });

  const { writeContract: writeAcceptOffer, data: acceptOfferHash, isPending: acceptOfferPending } = useWriteContract();
  const { isLoading: acceptOfferConfirming, isSuccess: acceptOfferSuccess } = useWaitForTransactionReceipt({
    hash: acceptOfferHash,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadListing() {
      if (!collection) return;
      setListingLoading(true);
      const data = await fetchListingsByTokens([tokenId], collection.nftContract);
      if (!cancelled) {
        setListing(data.get(tokenId.toString()) ?? null);
        setListingLoading(false);
      }
    }

    loadListing();
    const intervalId = window.setInterval(loadListing, 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [collection, tokenId]);

  useEffect(() => {
    if (approveSuccess) {
      refetchApproval();
    }
  }, [approveSuccess, refetchApproval]);

  useEffect(() => {
    if (buySuccess || listSuccess || cancelListingSuccess || offerSuccess || acceptOfferSuccess) {
      setListingLoading(true);
      refetchOwner();
      if (collection) {
        fetchListingsByTokens([tokenId], collection.nftContract).then((next) => {
          setListing(next.get(tokenId.toString()) ?? null);
          setListingLoading(false);
        });
      }
    }
  }, [
    acceptOfferSuccess,
    buySuccess,
    cancelListingSuccess,
    collection,
    listSuccess,
    offerSuccess,
    refetchOwner,
    tokenId,
  ]);

  useEffect(() => {
    function handleEsc(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleEsc);
    return () => {
      window.removeEventListener("keydown", handleEsc);
    };
  }, [onClose]);

  if (!collection) return null;

  const isWalletConnected = !!address;
  const sourceLabel = listing?.sourceLabel ?? (listing?.source ? listing.source.toUpperCase() : null);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm p-4 md:p-8 overflow-y-auto" onClick={onClose}>
      <div className="max-w-5xl mx-auto card p-4 md:p-6" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-end mb-4">
          <button type="button" onClick={onClose} className="btn-ghost">Close</button>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="relative w-full aspect-square rounded-2xl overflow-hidden border border-milady-pink/20 bg-milady-charcoal">
              {metadataLoading ? (
                <div className="w-full h-full animate-pulse bg-milady-charcoal-light" />
              ) : (
                <Image
                  src={imageSrc}
                  alt={displayName}
                  fill
                  className="object-cover"
                  unoptimized={isRemoteImage}
                />
              )}
            </div>
            {metadata?.attributes?.length ? (
              <div className="card p-3">
                <p className="text-milady-pink text-sm font-medium mb-2">Traits</p>
                <div className="grid grid-cols-2 gap-2">
                  {metadata.attributes.slice(0, 8).map((attr) => (
                    <div key={`${attr.trait_type}-${attr.value}`} className="rounded-lg border border-milady-pink/20 px-2 py-1">
                      <p className="text-[11px] text-milady-cream/50">{attr.trait_type}</p>
                      <p className="text-xs text-milady-cream truncate">{String(attr.value)}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-milady-pink/70 text-xs uppercase tracking-wide">{collection.name}</p>
              <h2 className="font-milady text-3xl text-milady-cream">{displayName}</h2>
              <p className="text-milady-cream/60 text-sm mt-2">
                Owner: {owner ? shortAddress(owner as string) : "-"}
              </p>
              {sourceLabel && hasActiveListing && (
                <span className="badge mt-2">Source: {sourceLabel}</span>
              )}
              {metadata?.description && (
                <p className="text-milady-cream/70 text-sm mt-3">{metadata.description}</p>
              )}
            </div>

            <div className="card p-4 space-y-3">
              <p className="text-sm text-milady-cream/70">Marketplace Actions</p>

              {!isWalletConnected && (
                <p className="text-yellow-300/90 text-sm">Connect wallet to buy, list, sell, or accept offers.</p>
              )}

              {listingLoading ? (
                <p className="text-milady-cream/50 text-sm">Loading listing status...</p>
              ) : hasActiveListing ? (
                <div className="space-y-2">
                  <p className="text-milady-cream/70 text-sm">
                    Listed at <span className="text-milady-pink font-semibold">{formatTokenAmount(listing!.price, PAYMENT_TOKEN_DECIMALS)} {PAYMENT_TOKEN_SYMBOL}</span>
                  </p>
                  {listingIsExternal ? (
                    <p className="text-yellow-300/90 text-xs">
                      Active on external marketplace. Buy there for best execution.
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-milady-cream/50 text-sm">Not currently listed.</p>
              )}

              {isWalletConnected && hasActiveListing && !isOwner && !listingIsExternal && (
                <button
                  type="button"
                  className="btn-primary w-full"
                  disabled={buying || buyConfirming}
                  onClick={() => {
                    writeBuy({
                      address: collection.marketContract,
                      abi: MILADY_MARKETPLACE_ABI,
                      functionName: "buyListing",
                      args: [collection.nftContract, tokenId],
                    });
                  }}
                >
                  {buying || buyConfirming ? "Buying..." : "Buy Now"}
                </button>
              )}

              {isWalletConnected && isOwner && (
                <div className="space-y-2">
                  {!isApproved ? (
                    <button
                      type="button"
                      className="btn-secondary w-full"
                      disabled={approving || approveConfirming}
                      onClick={() => {
                        writeApprove({
                          address: collection.nftContract,
                          abi: MILADY_NFT_ABI,
                          functionName: "setApprovalForAll",
                          args: [collection.marketContract, true],
                        });
                      }}
                    >
                      {approving || approveConfirming ? "Approving..." : "Approve Marketplace"}
                    </button>
                  ) : null}

                  {!hasActiveListing && (
                    <div className="space-y-2">
                      <input
                        className="input"
                        type="number"
                        min="0"
                        step="0.001"
                        placeholder={`List price in ${PAYMENT_TOKEN_SYMBOL}`}
                        value={listPrice}
                        onChange={(event) => setListPrice(event.target.value)}
                      />
                      <button
                        type="button"
                        className="btn-primary w-full"
                        disabled={listingPending || listConfirming || !listPrice || !isApproved}
                        onClick={() => {
                          writeList({
                            address: collection.marketContract,
                            abi: MILADY_MARKETPLACE_ABI,
                            functionName: "createListing",
                            args: [collection.nftContract, tokenId, parseUnits(listPrice, PAYMENT_TOKEN_DECIMALS)],
                          });
                        }}
                      >
                        {listingPending || listConfirming ? "Listing..." : "List for Sale"}
                      </button>
                    </div>
                  )}

                  {hasActiveListing && !listingIsExternal && (
                    <button
                      type="button"
                      className="btn-secondary w-full"
                      disabled={cancelListingPending || cancelListingConfirming}
                      onClick={() => {
                        writeCancelListing({
                          address: collection.marketContract,
                          abi: MILADY_MARKETPLACE_ABI,
                          functionName: "cancelListing",
                          args: [collection.nftContract, tokenId],
                        });
                      }}
                    >
                      {cancelListingPending || cancelListingConfirming ? "Cancelling..." : "Cancel Listing"}
                    </button>
                  )}
                </div>
              )}

              {isWalletConnected && !isOwner && (
                <div className="space-y-2 border-t border-milady-pink/10 pt-3">
                  <p className="text-milady-cream/60 text-xs">Make Offer</p>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.001"
                    placeholder={`Offer amount in ${PAYMENT_TOKEN_SYMBOL}`}
                    value={offerPrice}
                    onChange={(event) => setOfferPrice(event.target.value)}
                  />
                  <input
                    className="input"
                    type="number"
                    min="1"
                    step="1"
                    placeholder="Duration hours"
                    value={offerHours}
                    onChange={(event) => setOfferHours(event.target.value)}
                  />
                  <button
                    type="button"
                    className="btn-primary w-full"
                    disabled={offerPending || offerConfirming || !offerPrice}
                    onClick={() => {
                      const hours = Math.max(1, Number(offerHours || "1"));
                      writeOffer({
                        address: collection.marketContract,
                        abi: MILADY_MARKETPLACE_ABI,
                        functionName: "makeOffer",
                        args: [collection.nftContract, tokenId, parseUnits(offerPrice, PAYMENT_TOKEN_DECIMALS), BigInt(hours * 3600)],
                      });
                    }}
                  >
                    {offerPending || offerConfirming ? "Submitting..." : "Make Offer"}
                  </button>
                </div>
              )}

              {isWalletConnected && isOwner && (
                <div className="space-y-2 border-t border-milady-pink/10 pt-3">
                  <p className="text-milady-cream/60 text-xs">Accept Offer (by offerer wallet)</p>
                  <input
                    className="input"
                    type="text"
                    placeholder="Offerer address (0x...)"
                    value={offererAddress}
                    onChange={(event) => setOffererAddress(event.target.value)}
                  />
                  <button
                    type="button"
                    className="btn-secondary w-full"
                    disabled={acceptOfferPending || acceptOfferConfirming || !offererAddress.startsWith("0x")}
                    onClick={() => {
                      writeAcceptOffer({
                        address: collection.marketContract,
                        abi: MILADY_MARKETPLACE_ABI,
                        functionName: "acceptOffer",
                        args: [collection.nftContract, tokenId, offererAddress as `0x${string}`],
                      });
                    }}
                  >
                    {acceptOfferPending || acceptOfferConfirming ? "Accepting..." : "Accept Offer"}
                  </button>
                </div>
              )}
            </div>

            <Link
              href={`/nft/${tokenId.toString()}?collection=${encodeURIComponent(collection.slug)}`}
              className="btn-ghost inline-flex"
            >
              Open Full NFT Page
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CollectionPage() {
  const { address: viewerAddress, isConnected } = useAccount();
  const params = useParams();
  const slug = params.slug as string;
  const collection = getCollectionBySlug(slug);

  useEffect(() => {
    if (collection?.slug) {
      saveSelectedCollectionSlug(collection.slug);
    }
  }, [collection?.slug]);

  const { data: totalSupply, isLoading } = useTotalSupply(
    collection?.nftContract ?? "0x0000000000000000000000000000000000000000"
  );
  const [stats, setStats] = useState<{
    floorPrice: bigint | null;
    activeListings: number;
    totalSales: number;
    totalVolume: bigint;
  } | null>(null);
  const [fullListedByToken, setFullListedByToken] = useState<Map<string, BackendListing>>(new Map());
  const [fullListedLoading, setFullListedLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsUpdatedAt, setStatsUpdatedAt] = useState<number | null>(null);
  const [listingsByToken, setListingsByToken] = useState<Map<string, BackendListing>>(new Map());
  const [rarityByToken, setRarityByToken] = useState<Map<string, { rank: number; score: number }>>(new Map());
  const [rarityRankedTotal, setRarityRankedTotal] = useState<number | null>(null);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [listingsUpdatedAt, setListingsUpdatedAt] = useState<number | null>(null);
  const [selectedTokenId, setSelectedTokenId] = useState<bigint | null>(null);
  const [directBuyTokenId, setDirectBuyTokenId] = useState<bigint | null>(null);
  const [collectionNavTab, setCollectionNavTab] = useState<
    "Items" | "Listings" | "My Items" | "Offers" | "Activity" | "Analytics" | "Owners"
  >("Items");
  const [page, setPage] = useState(1);
  const [itemTab, setItemTab] = useState<"all" | "listed">("all");
  const [tokenSearch, setTokenSearch] = useState("");
  const [ownershipFilter, setOwnershipFilter] = useState<OwnershipFilter>("all");
  const [minPriceFilter, setMinPriceFilter] = useState("");
  const [maxPriceFilter, setMaxPriceFilter] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("price-asc");
  const [sweepStatus, setSweepStatus] = useState<string | null>(null);
  const [sweeping, setSweeping] = useState(false);
  const [bulkListPrice, setBulkListPrice] = useState("");
  const [bulkListStatus, setBulkListStatus] = useState<string | null>(null);
  const [bulkListing, setBulkListing] = useState(false);
  const [collectionOfferPrice, setCollectionOfferPrice] = useState("");
  const [collectionOfferHours, setCollectionOfferHours] = useState("");
  const [collectionOfferStatus, setCollectionOfferStatus] = useState<string | null>(null);
  const [collectionOffering, setCollectionOffering] = useState(false);
  const [offerModalOpen, setOfferModalOpen] = useState(false);
  const [bulkMaxTx, setBulkMaxTx] = useState("10");
  const [sweepMaxBuys, setSweepMaxBuys] = useState("10");
  const [offerMaxTx, setOfferMaxTx] = useState("");
  const [continueOnError, setContinueOnError] = useState(true);
  const [activityEvents, setActivityEvents] = useState<
    Array<{
      type: "ItemListed" | "ItemSold" | "OfferMade" | "ItemCancelled";
      sourceLabel?: string;
      tokenId?: string | null;
      blockNumber: string | null;
      transactionHash: `0x${string}` | null;
      seller?: `0x${string}`;
      buyer?: `0x${string}`;
      offerer?: `0x${string}`;
      price?: string;
    }>
  >([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityPage, setActivityPage] = useState(1);
  const [activityHasNext, setActivityHasNext] = useState(false);
  const [offerEvents, setOfferEvents] = useState<
    Array<{
      type: "OfferMade";
      sourceLabel?: string;
      tokenId?: string | null;
      blockNumber: string | null;
      transactionHash: `0x${string}` | null;
      offerer?: `0x${string}`;
      price?: string;
      expiry?: string;
    }>
  >([]);
  const [offersLoading, setOffersLoading] = useState(false);
  const [offersUpdatedAt, setOffersUpdatedAt] = useState<number | null>(null);
  const [offersPage, setOffersPage] = useState(1);
  const [offersHasNext, setOffersHasNext] = useState(false);
  const [holderRows, setHolderRows] = useState<Array<{ address: `0x${string}`; balance: number; share: number }>>([]);
  const [holdersLoading, setHoldersLoading] = useState(false);
  const [holdersError, setHoldersError] = useState<string | null>(null);
  const [holdersSummary, setHoldersSummary] = useState<{
    totalHolders: number;
    scanCount: number;
    resolvedOwners: number;
  } | null>(null);
  const {
    writeContractAsync: writeMarketplaceAction,
    writeContract: writeBulkApprove,
    data: bulkApproveHash,
    isPending: bulkApprovePending,
  } = useWriteContract();
  const { isLoading: bulkApproveConfirming, isSuccess: bulkApproveSuccess } = useWaitForTransactionReceipt({
    hash: bulkApproveHash,
  });
  const { data: paymentAllowance, refetch: refetchPaymentAllowance } = useReadContract({
    address: PAYMENT_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [
      (viewerAddress ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
      (collection?.marketContract ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
    ],
    query: {
      enabled: !!viewerAddress && isConnected,
    },
  });

  if (!collection) {
    return (
      <div className="card p-6">
        <p className="text-milady-cream/70">Collection not found.</p>
        <Link href="/" className="text-milady-pink hover:underline text-sm mt-2 inline-block">
          Back to collections
        </Link>
      </div>
    );
  }

  const supply = Number(totalSupply ?? BigInt(collection.supply));
  const totalItems = Math.max(0, supply || collection.supply);
  const startTokenId = collection.startTokenId ?? 1;
  const allTokenIds = useMemo(() => range(startTokenId, totalItems), [startTokenId, totalItems]);
  const listedTokenIds = useMemo(
    () => {
      const rows = Array.from(fullListedByToken.entries()).map(([tokenId, listing]) => ({
        tokenId: BigInt(tokenId),
        price: listing.price,
      }));

      rows.sort((a, b) => {
        if (a.price < b.price) return -1;
        if (a.price > b.price) return 1;
        return a.tokenId < b.tokenId ? -1 : a.tokenId > b.tokenId ? 1 : 0;
      });

      return rows.map((row) => row.tokenId);
    },
    [fullListedByToken]
  );
  const tabAllTokenIds = itemTab === "listed" ? listedTokenIds : allTokenIds;
  const totalPages = Math.max(1, Math.ceil(tabAllTokenIds.length / COLLECTION_PAGE_SIZE));
  const pageStartIndex = (page - 1) * COLLECTION_PAGE_SIZE;
  const tokenIds = useMemo(
    () => tabAllTokenIds.slice(pageStartIndex, pageStartIndex + COLLECTION_PAGE_SIZE),
    [tabAllTokenIds, pageStartIndex]
  );

  const { tokenIds: viewerOwnedTokenIds } = useOwnerTokens(viewerAddress, collection.nftContract);
  const { data: isApprovedForBulkListing, refetch: refetchBulkApproval } = useIsApprovedForMarketplaceByContracts(
    viewerAddress,
    collection.nftContract,
    collection.marketContract
  );
  const viewerOwnedSet = useMemo(
    () => new Set(viewerOwnedTokenIds.map((id) => id.toString())),
    [viewerOwnedTokenIds]
  );
  const tabTokenIds = useMemo(
    () => tokenIds,
    [tokenIds]
  );
  const visibleTokenIds = useMemo(() => {
    const tokenSearchTrimmed = tokenSearch.trim();
    const safeParsePrice = (value: string): bigint | null => {
      const normalized = value.trim();
      if (!normalized) return null;
      try {
        return parseUnits(normalized, PAYMENT_TOKEN_DECIMALS);
      } catch {
        return null;
      }
    };
    const minPrice = safeParsePrice(minPriceFilter);
    const maxPrice = safeParsePrice(maxPriceFilter);

    const filtered = tabTokenIds.filter((id) => {
      const idString = id.toString();
      const listing = listingsByToken.get(idString);
      const listedPrice = listing?.active ? listing.price : null;
      const isOwnedByViewer = viewerOwnedSet.has(idString);

      if (tokenSearchTrimmed && !idString.includes(tokenSearchTrimmed)) {
        return false;
      }

      if (ownershipFilter === "owned" && !isOwnedByViewer) {
        return false;
      }
      if (ownershipFilter === "not-owned" && isOwnedByViewer) {
        return false;
      }

      if (minPrice !== null) {
        if (!listedPrice || listedPrice < minPrice) {
          return false;
        }
      }

      if (maxPrice !== null) {
        if (!listedPrice || listedPrice > maxPrice) {
          return false;
        }
      }

      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      const listingA = listingsByToken.get(a.toString());
      const listingB = listingsByToken.get(b.toString());
      const priceA = listingA?.active ? listingA.price : null;
      const priceB = listingB?.active ? listingB.price : null;

      if (itemTab === "listed") {
        const nullRankA = priceA === null ? 1 : 0;
        const nullRankB = priceB === null ? 1 : 0;
        if (nullRankA !== nullRankB) {
          return nullRankA - nullRankB;
        }
        if (priceA === null || priceB === null) {
          return a < b ? -1 : a > b ? 1 : 0;
        }
        if (priceA < priceB) return -1;
        if (priceA > priceB) return 1;
        return a < b ? -1 : a > b ? 1 : 0;
      }

      if (sortMode === "token-asc") {
        return a < b ? -1 : a > b ? 1 : 0;
      }
      if (sortMode === "token-desc") {
        return a > b ? -1 : a < b ? 1 : 0;
      }

      const nullRankA = priceA === null ? 1 : 0;
      const nullRankB = priceB === null ? 1 : 0;
      if (nullRankA !== nullRankB) {
        return nullRankA - nullRankB;
      }
      if (priceA === null || priceB === null) {
        return a < b ? -1 : a > b ? 1 : 0;
      }

      if (sortMode === "price-asc") {
        if (priceA < priceB) return -1;
        if (priceA > priceB) return 1;
        return a < b ? -1 : a > b ? 1 : 0;
      }

      if (priceA > priceB) return -1;
      if (priceA < priceB) return 1;
      return a < b ? -1 : a > b ? 1 : 0;
    });

    return sorted;
  }, [
    tabTokenIds,
    tokenSearch,
    minPriceFilter,
    maxPriceFilter,
    ownershipFilter,
    sortMode,
    itemTab,
    listingsByToken,
    viewerOwnedSet,
  ]);
  const listedItemsCount = useMemo(
    () => listedTokenIds.length,
    [listedTokenIds]
  );
  const bulkListableTokenIds = useMemo(
    () =>
      visibleTokenIds.filter((id) => {
        if (!viewerOwnedSet.has(id.toString())) return false;
        const listing = listingsByToken.get(id.toString());
        return !listing?.active;
      }),
    [visibleTokenIds, viewerOwnedSet, listingsByToken]
  );
  const collectionOfferTokenIds = useMemo(
    () => visibleTokenIds.filter((id) => !viewerOwnedSet.has(id.toString())),
    [visibleTokenIds, viewerOwnedSet]
  );

  const parsedBulkMaxTx = Math.max(1, Number(bulkMaxTx || "1"));
  const parsedSweepMaxBuys = Math.max(1, Number(sweepMaxBuys || "1"));
  const parsedOfferMaxTx = Math.max(1, Number(offerMaxTx || "1"));

  function scrollToSection(sectionId: string) {
    const target = document.getElementById(sectionId);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleCollectionTabClick(tab: "Items" | "Listings" | "My Items" | "Offers" | "Activity" | "Analytics" | "Owners") {
    setCollectionNavTab(tab);
    if (tab === "Items") {
      setItemTab("all");
      setOwnershipFilter("all");
      scrollToSection("collection-items");
      return;
    }
    if (tab === "Listings") {
      setItemTab("listed");
      setOwnershipFilter("all");
      scrollToSection("collection-items");
      return;
    }
    if (tab === "My Items") {
      setItemTab("all");
      setOwnershipFilter("owned");
      scrollToSection("collection-items");
      return;
    }
    if (tab === "Offers") {
      setItemTab("all");
      setOwnershipFilter("all");
      scrollToSection("collection-offers");
      return;
    }
    if (tab === "Activity") {
      scrollToSection("collection-activity");
      return;
    }
    if (tab === "Analytics") {
      scrollToSection("collection-analytics");
      return;
    }
    if (tab === "Owners") {
      scrollToSection("collection-owner");
    }
  }

  function applyLimit(base: bigint[], maxTx: number): bigint[] {
    return base.slice(0, maxTx);
  }

  async function buyListedFromCard(tokenId: bigint) {
    const activeCollection = collection;
    if (!activeCollection || !isConnected || !viewerAddress) {
      return;
    }

    const listing = listingsByToken.get(tokenId.toString());
    if (!listing?.active) {
      return;
    }
    if ((listing.source ?? "milady") !== "milady") {
      return;
    }

    try {
      setDirectBuyTokenId(tokenId);
      await writeMarketplaceAction({
        address: activeCollection.marketContract,
        abi: MILADY_MARKETPLACE_ABI,
        functionName: "buyListing",
        args: [activeCollection.nftContract, tokenId],
      });
    } finally {
      setDirectBuyTokenId(null);
    }
  }
  const sweepableTokenIds = useMemo(
    () =>
      visibleTokenIds.filter((id) => {
        const listing = listingsByToken.get(id.toString());
        if (!listing?.active) return false;
        if ((listing.source ?? "milady") !== "milady") return false;
        if (viewerOwnedSet.has(id.toString())) return false;
        return true;
      }),
    [visibleTokenIds, listingsByToken, viewerOwnedSet]
  );
  const floorSweepTokenIds = useMemo(
    () =>
      [...sweepableTokenIds].sort((a, b) => {
        const priceA = listingsByToken.get(a.toString())?.price ?? 0n;
        const priceB = listingsByToken.get(b.toString())?.price ?? 0n;
        if (priceA < priceB) return -1;
        if (priceA > priceB) return 1;
        return 0;
      }),
    [sweepableTokenIds, listingsByToken]
  );

  async function sweepVisibleListings() {
    const activeCollection = collection;
    if (!activeCollection) {
      setSweepStatus("Collection not found.");
      return;
    }
    if (!isConnected || !viewerAddress) {
      setSweepStatus("Connect wallet to sweep listed NFTs.");
      return;
    }
    const targetTokenIds = applyLimit(floorSweepTokenIds, parsedSweepMaxBuys);
    if (targetTokenIds.length === 0) {
      setSweepStatus("No sweepable listed NFTs in current tab/page.");
      return;
    }

    setSweeping(true);
    setSweepStatus(`Starting sweep for ${targetTokenIds.length} listed NFT(s)...`);

    let submitted = 0;
    let failed = 0;
    try {
      for (let i = 0; i < targetTokenIds.length; i += 1) {
        const tokenId = targetTokenIds[i];
        setSweepStatus(`Submitting ${i + 1}/${targetTokenIds.length}: #${tokenId.toString()}`);
        try {
          await writeMarketplaceAction({
            address: activeCollection.marketContract,
            abi: MILADY_MARKETPLACE_ABI,
            functionName: "buyListing",
            args: [activeCollection.nftContract, tokenId],
          });
          submitted += 1;
        } catch (error) {
          failed += 1;
          if (!continueOnError) {
            throw error;
          }
        }
      }

      setSweepStatus(`Sweep submitted: ${submitted} success, ${failed} failed.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSweepStatus(`Sweep stopped after ${submitted} success (${failed} failed): ${message}`);
    } finally {
      setSweeping(false);
    }
  }

  async function approveMarketplaceForBulkListing() {
    const activeCollection = collection;
    if (!activeCollection) {
      setBulkListStatus("Collection not found.");
      return;
    }
    writeBulkApprove({
      address: activeCollection.nftContract,
      abi: MILADY_NFT_ABI,
      functionName: "setApprovalForAll",
      args: [activeCollection.marketContract, true],
    });
  }

  async function bulkListVisibleOwned() {
    const activeCollection = collection;
    if (!activeCollection) {
      setBulkListStatus("Collection not found.");
      return;
    }
    if (!isConnected || !viewerAddress) {
      setBulkListStatus("Connect wallet to bulk list NFTs.");
      return;
    }
    if (!isApprovedForBulkListing) {
      setBulkListStatus("Approve marketplace first, then run bulk listing.");
      return;
    }
    if (!bulkListPrice || Number(bulkListPrice) <= 0) {
      setBulkListStatus(`Enter a valid bulk list price in ${PAYMENT_TOKEN_SYMBOL}.`);
      return;
    }
    const targetTokenIds = applyLimit(bulkListableTokenIds, parsedBulkMaxTx);
    if (targetTokenIds.length === 0) {
      setBulkListStatus("No owned unlisted NFTs in current tab/page to bulk list.");
      return;
    }

    setBulkListing(true);
    setBulkListStatus(`Starting bulk listing for ${targetTokenIds.length} NFT(s)...`);

    let submitted = 0;
    let failed = 0;
    try {
      const price = parseUnits(bulkListPrice, PAYMENT_TOKEN_DECIMALS);
      for (let i = 0; i < targetTokenIds.length; i += 1) {
        const tokenId = targetTokenIds[i];
        setBulkListStatus(`Submitting ${i + 1}/${targetTokenIds.length}: list #${tokenId.toString()}`);
        try {
          await writeMarketplaceAction({
            address: activeCollection.marketContract,
            abi: MILADY_MARKETPLACE_ABI,
            functionName: "createListing",
            args: [activeCollection.nftContract, tokenId, price],
          });
          submitted += 1;
        } catch (error) {
          failed += 1;
          if (!continueOnError) {
            throw error;
          }
        }
      }
      setBulkListStatus(`Bulk listing submitted: ${submitted} success, ${failed} failed.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setBulkListStatus(`Bulk listing stopped after ${submitted} success (${failed} failed): ${message}`);
    } finally {
      setBulkListing(false);
    }
  }

  async function makeCollectionOfferVisible() {
    const activeCollection = collection;
    if (!activeCollection) {
      setCollectionOfferStatus("Collection not found.");
      return;
    }
    if (!isConnected || !viewerAddress) {
      setCollectionOfferStatus("Connect wallet to place collection offers.");
      return;
    }
    if (!collectionOfferPrice || Number(collectionOfferPrice) <= 0) {
      setCollectionOfferStatus(`Enter a valid offer amount in ${PAYMENT_TOKEN_SYMBOL}.`);
      return;
    }
    const targetTokenIds = applyLimit(collectionOfferTokenIds, parsedOfferMaxTx);
    if (targetTokenIds.length === 0) {
      setCollectionOfferStatus("No non-owned NFTs in current tab/page to target with offers.");
      return;
    }

    const hours = Math.max(1, Number(collectionOfferHours || "1"));
    const duration = BigInt(hours * 3600);
    setCollectionOffering(true);
    setCollectionOfferStatus(`Starting batch collection offer for ${targetTokenIds.length} NFT(s)...`);

    let submitted = 0;
    let failed = 0;
    try {
      const price = parseUnits(collectionOfferPrice, PAYMENT_TOKEN_DECIMALS);
      const totalRequiredAllowance = price * BigInt(targetTokenIds.length);
      const currentAllowance = typeof paymentAllowance === "bigint" ? paymentAllowance : 0n;

      if (currentAllowance < totalRequiredAllowance) {
        setCollectionOfferStatus("Submitting one-time max payment token approval...");
        await writeMarketplaceAction({
          address: PAYMENT_TOKEN_ADDRESS,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [activeCollection.marketContract, MAX_UINT256],
        });
        refetchPaymentAllowance();
      }

      for (let i = 0; i < targetTokenIds.length; i += 1) {
        const tokenId = targetTokenIds[i];
        setCollectionOfferStatus(`Submitting ${i + 1}/${targetTokenIds.length}: offer on #${tokenId.toString()}`);
        try {
          await writeMarketplaceAction({
            address: activeCollection.marketContract,
            abi: MILADY_MARKETPLACE_ABI,
            functionName: "makeOffer",
            args: [activeCollection.nftContract, tokenId, price, duration],
          });
          submitted += 1;
        } catch (error) {
          failed += 1;
          if (!continueOnError) {
            throw error;
          }
        }
      }
      setCollectionOfferStatus(`Collection offer submitted: ${submitted} success, ${failed} failed.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setCollectionOfferStatus(`Collection offer stopped after ${submitted} success (${failed} failed): ${message}`);
    } finally {
      setCollectionOffering(false);
    }
  }

  useEffect(() => {
    setPage(1);
  }, [collection.slug]);

  useEffect(() => {
    setActivityPage(1);
  }, [collection.slug]);

  useEffect(() => {
    setOffersPage(1);
  }, [collection.slug]);

  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  useEffect(() => {
    let cancelled = false;

    async function loadStats() {
      if (!collection) return;
      setStatsLoading(true);
      const fullSupply = Math.max(1, supply || collection.supply);
      const data = await fetchCollectionStats({
        nftContract: collection.nftContract,
        supply: fullSupply,
        startTokenId,
        scan: fullSupply,
        includeSales: true,
      });
      if (!cancelled) {
        setStats(
          data
            ? {
                floorPrice: data.floorPrice,
                activeListings: data.activeListings,
                totalSales: data.totalSales,
                totalVolume: data.totalVolume,
              }
            : null
        );
        setStatsUpdatedAt(Date.now());
        setStatsLoading(false);
      }
    }

    loadStats();
    return () => {
      cancelled = true;
    };
  }, [collection, supply, startTokenId]);

  useEffect(() => {
    let cancelled = false;
    const isVisible = () => document.visibilityState === "visible";

    async function loadAllListedTokens() {
      if (!isVisible()) return;
      if (!collection || itemTab !== "listed") {
        if (!cancelled) {
          setFullListedLoading(false);
        }
        return;
      }

      if (allTokenIds.length === 0) {
        if (!cancelled) {
          setFullListedByToken(new Map());
          setFullListedLoading(false);
        }
        return;
      }

      setFullListedLoading(true);
      const listedMap = new Map<string, BackendListing>();
      let offset = 0;
      const pageLimit = 300;
      let hadFetchFailure = false;

      while (true) {
        const page = await fetchActiveListingsPage({
          nftContract: collection.nftContract,
          supply: totalItems,
          startTokenId,
          limit: pageLimit,
          offset,
          sort: "price-asc",
        });

        if (!page) {
          hadFetchFailure = true;
          break;
        }

        for (const row of page.listings) {
          if (row.listing.active && row.listing.price > 0n) {
            listedMap.set(row.tokenId.toString(), row.listing);
          }
        }

        if (cancelled || !page.hasNext || page.listings.length === 0) {
          break;
        }

        offset += pageLimit;
      }

      if (!cancelled) {
        setFullListedByToken((prev) => {
          if (hadFetchFailure && listedMap.size === 0) {
            // Preserve previous successful snapshot when current refresh fails.
            return prev;
          }
          return listedMap;
        });
        setFullListedLoading(false);
      }
    }

    loadAllListedTokens();
    const intervalId = window.setInterval(loadAllListedTokens, 30_000);
    const onVisibilityChange = () => {
      if (isVisible()) {
        void loadAllListedTokens();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [allTokenIds, collection, itemTab, tabAllTokenIds.length]);

  useEffect(() => {
    let cancelled = false;
    const isVisible = () => document.visibilityState === "visible";

    async function loadListings() {
      if (!isVisible()) return;
      if (!collection || tokenIds.length === 0) {
        setListingsByToken(new Map());
        setListingsLoading(false);
        return;
      }

      if (itemTab === "listed") {
        const pageMap = new Map<string, BackendListing>();
        for (const tokenId of tokenIds) {
          const listing = fullListedByToken.get(tokenId.toString());
          if (listing) {
            pageMap.set(tokenId.toString(), listing);
          }
        }
        setListingsByToken(pageMap);
        setListingsLoading(fullListedLoading);
        if (!fullListedLoading) {
          setListingsUpdatedAt(Date.now());
        }
        return;
      }

      setListingsLoading(true);
      const listingMap = await fetchListingsByTokens(tokenIds, collection.nftContract);
      if (!cancelled) {
        setListingsByToken(listingMap);
        setListingsLoading(false);
        setListingsUpdatedAt(Date.now());
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
  }, [collection, tokenIds, itemTab, fullListedByToken, fullListedLoading]);

  useEffect(() => {
    if (bulkApproveSuccess) {
      refetchBulkApproval();
      setBulkListStatus("Marketplace approved. You can now run bulk listing.");
    }
  }, [bulkApproveSuccess, refetchBulkApproval]);

  useEffect(() => {
    let cancelled = false;

    async function loadRarityRanks() {
      if (!collection?.metadataBase || visibleTokenIds.length === 0 || totalItems <= 0) {
        if (!cancelled) {
          setRarityByToken(new Map());
          setRarityRankedTotal(null);
        }
        return;
      }

      const response = await fetchRarityRanks({
        metadataBase: collection.metadataBase,
        supply: totalItems,
        startTokenId,
        tokenIds: visibleTokenIds,
      });

      if (!cancelled) {
        if (!response) {
          setRarityByToken(new Map());
          setRarityRankedTotal(null);
          return;
        }
        setRarityByToken(response.ranksByToken);
        setRarityRankedTotal(response.rankedTokens);
      }
    }

    void loadRarityRanks();
    return () => {
      cancelled = true;
    };
  }, [collection?.metadataBase, totalItems, startTokenId, visibleTokenIds]);

  useEffect(() => {
    let cancelled = false;
    const isVisible = () => document.visibilityState === "visible";

    async function loadCollectionActivity(silent = false) {
      if (!isVisible()) return;
      const activeCollection = collection;
      if (!activeCollection) {
        setActivityEvents([]);
        setActivityHasNext(false);
        setActivityLoading(false);
        return;
      }

      if (!silent) {
        setActivityLoading(true);
      }
      const offset = (activityPage - 1) * COLLECTION_ACTIVITY_PAGE_SIZE;
      const activityPageData = await fetchMarketplaceActivityPage({
        nftContract: activeCollection.nftContract,
        supply: activeCollection.supply,
        startTokenId: activeCollection.startTokenId ?? 1,
        limit: COLLECTION_ACTIVITY_PAGE_SIZE,
        offset,
      });

      if (!cancelled) {
        setActivityEvents(activityPageData.events ?? []);
        setActivityHasNext(activityPageData.hasNext ?? false);
        setActivityLoading(false);
      }
    }

    loadCollectionActivity(false);
    const intervalId = window.setInterval(() => {
      void loadCollectionActivity(true);
    }, 20_000);
    const onVisibilityChange = () => {
      if (isVisible()) {
        void loadCollectionActivity(true);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [activityPage, collection.nftContract]);

  useEffect(() => {
    let cancelled = false;
    const isVisible = () => document.visibilityState === "visible";

    async function loadCollectionOffers(silent = false) {
      if (!isVisible()) return;
      if (collectionNavTab !== "Offers") {
        return;
      }

      const activeCollection = collection;
      if (!activeCollection) {
        setOfferEvents([]);
        setOffersHasNext(false);
        setOffersLoading(false);
        return;
      }

      if (!silent) {
        setOffersLoading(true);
      }

      const offset = (offersPage - 1) * COLLECTION_OFFERS_PAGE_SIZE;
      const pageData = await fetchActiveOffersPage({
        nftContract: activeCollection.nftContract,
        limit: COLLECTION_OFFERS_PAGE_SIZE,
        offset,
      });

      if (!cancelled) {
        const events = (pageData.offers ?? []).filter((row) => row.type === "OfferMade") as Array<{
          type: "OfferMade";
          sourceLabel?: string;
          tokenId?: string | null;
          blockNumber: string | null;
          transactionHash: `0x${string}` | null;
          offerer?: `0x${string}`;
          price?: string;
          expiry?: string;
        }>;
        setOfferEvents(events);
        setOffersHasNext(pageData.hasNext ?? false);
        setOffersLoading(false);
        setOffersUpdatedAt(Date.now());
      }
    }

    void loadCollectionOffers(false);
    const intervalId = window.setInterval(() => {
      void loadCollectionOffers(true);
    }, 20_000);
    const onVisibilityChange = () => {
      if (isVisible()) {
        void loadCollectionOffers(true);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [collection.nftContract, collectionNavTab, offersPage]);

  useEffect(() => {
    let cancelled = false;

    async function loadHolders() {
      const activeCollection = collection;
      if (collectionNavTab !== "Owners") {
        return;
      }
      if (!activeCollection) {
        return;
      }

      setHoldersLoading(true);
      setHoldersError(null);
      const response = await fetchCollectionHolders({
        nftContract: activeCollection.nftContract,
        supply: Math.max(1, totalItems),
        startTokenId,
        scan: Math.max(1, totalItems),
        limit: 200,
        offset: 0,
      });

      if (cancelled) return;

      if (!response) {
        setHolderRows([]);
        setHoldersSummary(null);
        setHoldersError("Unable to load holders right now.");
        setHoldersLoading(false);
        return;
      }

      setHolderRows(response.holders ?? []);
      setHoldersSummary({
        totalHolders: response.totalHolders,
        scanCount: response.scanCount,
        resolvedOwners: response.resolvedOwners,
      });
      setHoldersLoading(false);
    }

    void loadHolders();
    return () => {
      cancelled = true;
    };
  }, [collection?.nftContract, collectionNavTab, startTokenId, totalItems]);

  return (
    <div className="space-y-8">
      <section className="card p-6">
        <p className="text-milady-pink/70 text-xs uppercase tracking-wider">Collection</p>
        <h1 className="font-milady text-3xl text-milady-pink mt-1">{collection.name}</h1>
        <p className="text-milady-cream/70 text-sm mt-2">{collection.description}</p>
        <div className="flex flex-wrap gap-3 mt-4">
          <a
            href={collection.explorer}
            target="_blank"
            rel="noopener noreferrer"
            className="badge hover:bg-milady-pink/30 transition-colors"
          >
            Contract Explorer
          </a>
          {collection.twitter && (
            <a
              href={collection.twitter}
              target="_blank"
              rel="noopener noreferrer"
              className="badge hover:bg-milady-pink/30 transition-colors"
            >
              Twitter
            </a>
          )}
        </div>
      </section>

      <section id="collection-analytics" className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card p-4">
          <p className="text-milady-cream/40 text-xs uppercase tracking-wide">Floor</p>
          <p className="text-milady-pink text-lg font-semibold mt-1">
            {statsLoading ? "..." : stats?.floorPrice ? `${formatTokenAmount(stats.floorPrice, PAYMENT_TOKEN_DECIMALS)} ${PAYMENT_TOKEN_SYMBOL}` : "-"}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-milady-cream/40 text-xs uppercase tracking-wide">Volume</p>
          <p className="text-milady-pink text-lg font-semibold mt-1">
            {statsLoading ? "..." : stats ? `${formatTokenAmount(stats.totalVolume, PAYMENT_TOKEN_DECIMALS)} ${PAYMENT_TOKEN_SYMBOL}` : "-"}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-milady-cream/40 text-xs uppercase tracking-wide">Sales</p>
          <p className="text-milady-pink text-lg font-semibold mt-1">
            {statsLoading ? "..." : stats?.totalSales ?? "-"}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-milady-cream/40 text-xs uppercase tracking-wide">Listed</p>
          <p className="text-milady-pink text-lg font-semibold mt-1">
            {statsLoading ? "..." : stats?.activeListings ?? "-"}
          </p>
        </div>
      </section>
      {statsUpdatedAt && (
        <p className="text-milady-cream/50 text-xs -mt-6">
          Stats updated: {new Date(statsUpdatedAt).toLocaleTimeString()}
        </p>
      )}

      <section className="card p-3">
        <div className="flex flex-wrap items-center gap-2">
          {(["Items", "Listings", "My Items", "Offers", "Activity", "Analytics", "Owners"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => handleCollectionTabClick(tab)}
              className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
                collectionNavTab === tab
                  ? "border-milady-pink text-milady-pink bg-milady-pink/10"
                  : "border-milady-pink/20 text-milady-cream/70 hover:text-milady-cream"
              }`}
            >
              {tab}
            </button>
          ))}
          <input
            className="input ml-auto w-full sm:w-64"
            type="text"
            value={tokenSearch}
            onChange={(event) => setTokenSearch(event.target.value)}
            placeholder="Search token ID"
          />
          <select
            className="input w-full sm:w-52"
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as SortMode)}
          >
            <option value="price-asc">Price: Low to high</option>
            <option value="price-desc">Price: High to low</option>
            <option value="token-asc">Token ID: Low to high</option>
            <option value="token-desc">Token ID: High to low</option>
          </select>
        </div>
      </section>

      <section id="collection-owner" className={collectionNavTab === "Owners" ? "card p-6" : "hidden"}>
        <div className="rounded-xl border border-milady-pink/20 bg-milady-black/20 p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <p className="text-milady-cream text-sm font-medium">Top Holders</p>
            {holdersSummary && (
              <p className="text-milady-cream/50 text-xs">
                {holdersSummary.totalHolders.toLocaleString()} wallets · {holdersSummary.resolvedOwners.toLocaleString()} owned tokens
              </p>
            )}
          </div>

          {holdersLoading ? (
            <p className="text-milady-cream/50 text-sm">Loading holders...</p>
          ) : holdersError ? (
            <p className="text-red-300 text-sm">{holdersError}</p>
          ) : holderRows.length === 0 ? (
            <p className="text-milady-cream/50 text-sm">No holder data available yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-milady-cream/50 border-b border-milady-pink/10">
                    <th className="py-2 pr-3">Rank</th>
                    <th className="py-2 pr-3">Holder</th>
                    <th className="py-2 pr-3">Count</th>
                    <th className="py-2">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {holderRows.map((holder, index) => (
                    <tr key={holder.address} className="border-b border-milady-pink/5 last:border-b-0">
                      <td className="py-2 pr-3 text-milady-cream/70">{index + 1}</td>
                      <td className="py-2 pr-3">
                        <a
                          href={`https://explore.tempo.xyz/address/${holder.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-milady-pink hover:underline"
                        >
                          {shortAddress(holder.address)}
                        </a>
                      </td>
                      <td className="py-2 pr-3 text-milady-cream">{holder.balance.toLocaleString()}</td>
                      <td className="py-2 text-milady-cream/70">{holder.share.toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section id="collection-offers" className={collectionNavTab === "Offers" ? "card p-6" : "hidden"}>
        <div className="rounded-xl border border-milady-pink/20 bg-milady-black/20 p-4 space-y-4">
          <button
            type="button"
            onClick={() => setOfferModalOpen(true)}
            disabled={!isConnected || collectionOfferTokenIds.length === 0}
            className="btn-primary w-full"
          >
            Make Offer
          </button>
          {collectionOfferStatus && <p className="text-milady-cream/50 text-xs">{collectionOfferStatus}</p>}
          {offersUpdatedAt && (
            <p className="text-milady-cream/50 text-xs">
              Updated: {new Date(offersUpdatedAt).toLocaleTimeString()}
            </p>
          )}

          <div className="border-t border-milady-pink/10 pt-4 space-y-3">
            {offersLoading ? (
              <p className="text-milady-cream/50 text-sm">Loading offers...</p>
            ) : offerEvents.length === 0 ? (
              <p className="text-milady-cream/50 text-sm">No available offers for this collection yet.</p>
            ) : (
              <div className="space-y-2">
                {offerEvents.map((event, idx) => (
                  <div key={`${event.transactionHash}-${idx}`} className="rounded-lg border border-milady-pink/10 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-milady-cream text-sm font-medium">Offer</p>
                      {event.price && (
                        <p className="text-milady-pink text-sm font-semibold">
                          {formatTokenAmount(BigInt(event.price), PAYMENT_TOKEN_DECIMALS)} {PAYMENT_TOKEN_SYMBOL}
                        </p>
                      )}
                    </div>
                    <p className="text-milady-cream/50 text-xs mt-1">
                      Token: {event.tokenId ?? "-"} · Block: {event.blockNumber ?? "-"}
                    </p>
                    <div className="text-milady-cream/60 text-xs mt-2 space-y-1">
                      {event.offerer && <p>Offerer: {shortAddress(event.offerer)}</p>}
                      {event.sourceLabel && <p>Source: {event.sourceLabel}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setOffersPage((prev) => Math.max(1, prev - 1))}
                disabled={offersLoading || offersPage <= 1}
                className="text-xs px-3 py-1.5 rounded-md border border-milady-pink/20 text-milady-cream/70 hover:text-milady-cream disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setOffersPage((prev) => prev + 1)}
                disabled={offersLoading || !offersHasNext}
                className="text-xs px-3 py-1.5 rounded-md border border-milady-pink/20 text-milady-cream/70 hover:text-milady-cream disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </section>

      <section id="collection-items">
        {listingsLoading && (
          <p className="text-milady-cream/50 text-xs mb-3">Syncing listing states across marketplaces...</p>
        )}
        {!listingsLoading && listingsUpdatedAt && (
          <p className="text-milady-cream/50 text-xs mb-3">
            Listings updated: {new Date(listingsUpdatedAt).toLocaleTimeString()}
          </p>
        )}

        <div className="grid md:grid-cols-2 gap-3 mb-4">
          {collectionNavTab === "My Items" && (
            <div className="card p-3 space-y-2">
              <p className="text-milady-cream text-sm font-medium">Bulk List</p>
              <p className="text-milady-cream/50 text-xs">
                Lists up to {parsedBulkMaxTx} owned unlisted NFT(s) from this tab.
              </p>
              <input
                className="input"
                type="number"
                min="0"
                step="0.001"
                value={bulkListPrice}
                onChange={(event) => setBulkListPrice(event.target.value)}
                placeholder={`List price in ${PAYMENT_TOKEN_SYMBOL}`}
              />
              <input
                className="input"
                type="number"
                min="1"
                step="1"
                value={bulkMaxTx}
                onChange={(event) => setBulkMaxTx(event.target.value)}
                placeholder="Max tx per run"
              />
              {!isApprovedForBulkListing && (
                <button
                  type="button"
                  onClick={approveMarketplaceForBulkListing}
                  disabled={!isConnected || bulkApprovePending || bulkApproveConfirming}
                  className="btn-secondary w-full"
                >
                  {bulkApprovePending || bulkApproveConfirming ? "Approving..." : "Approve For Bulk Listing"}
                </button>
              )}
              <button
                type="button"
                onClick={bulkListVisibleOwned}
                disabled={!isConnected || bulkListing || bulkListableTokenIds.length === 0}
                className="btn-primary w-full"
              >
                {bulkListing ? "Bulk Listing..." : `Bulk List (${Math.min(parsedBulkMaxTx, bulkListableTokenIds.length)})`}
              </button>
              {bulkListStatus && <p className="text-milady-cream/50 text-xs">{bulkListStatus}</p>}
            </div>
          )}

          {collectionNavTab === "Listings" && (
          <div className="card p-3 space-y-2">
            <p className="text-milady-cream text-sm font-medium">Floor Sweep</p>
            <p className="text-milady-cream/50 text-xs">
              Buys up to {parsedSweepMaxBuys} cheapest sweepable listings in this tab.
            </p>
            <div className="space-y-1">
              <input
                type="range"
                min="1"
                max={Math.max(1, floorSweepTokenIds.length)}
                step="1"
                value={Math.min(parsedSweepMaxBuys, Math.max(1, floorSweepTokenIds.length))}
                onChange={(event) => setSweepMaxBuys(event.target.value)}
                className="w-full accent-pink-500"
              />
              <p className="text-milady-cream/50 text-xs">
                Sweep count: {Math.min(parsedSweepMaxBuys, Math.max(1, floorSweepTokenIds.length))}
              </p>
            </div>
            <button
              type="button"
              onClick={sweepVisibleListings}
              disabled={!isConnected || sweeping || sweepableTokenIds.length === 0}
              className="btn-primary w-full"
            >
              {sweeping ? "Sweeping..." : `Floor Sweep (${Math.min(parsedSweepMaxBuys, floorSweepTokenIds.length)})`}
            </button>
            {sweepStatus && <p className="text-milady-cream/50 text-xs">{sweepStatus}</p>}
          </div>
          )}

        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
          <p className="text-milady-cream/50 text-xs">
            Page {page} / {totalPages} · Showing {visibleTokenIds.length.toLocaleString()} items in {itemTab === "listed" ? "Listed" : "All"}
          </p>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page <= 1 || tabAllTokenIds.length === 0}
              className="text-xs px-3 py-2 rounded-md border border-milady-pink/20 text-milady-cream/70 hover:text-milady-cream disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages || tabAllTokenIds.length === 0}
              className="text-xs px-3 py-2 rounded-md border border-milady-pink/20 text-milady-cream/70 hover:text-milady-cream disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>

        {visibleTokenIds.length === 0 ? (
          <div className="card p-6 text-milady-cream/60">No items available for this collection yet.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {visibleTokenIds.map((id) => {
              const listing = listingsByToken.get(id.toString());
              const rarity = rarityByToken.get(id.toString());
              const isOwnedByViewer = viewerOwnedSet.has(id.toString());
              const canDirectBuy =
                !!listing?.active &&
                !isOwnedByViewer &&
                (listing.source ?? "milady") === "milady";
              return (
                <NFTCard
                  key={id.toString()}
                  tokenId={id}
                  image={tokenImageFromTemplate(collection, id)}
                  isListed={listing?.active}
                  price={listing?.price}
                  isOwnedByViewer={isOwnedByViewer}
                  paymentSymbol={PAYMENT_TOKEN_SYMBOL}
                  collectionSlug={collection.slug}
                  tokenLabelPrefix={collection.name}
                  rarityRank={rarity?.rank ?? null}
                  rarityTotal={rarityRankedTotal}
                  onClick={() => setSelectedTokenId(id)}
                  onAction={canDirectBuy ? () => buyListedFromCard(id) : undefined}
                  actionLabel="Buy now"
                  actionDisabled={!isConnected || directBuyTokenId === id}
                  actionLoading={directBuyTokenId === id}
                />
              );
            })}
          </div>
        )}
      </section>

      <section id="collection-activity" className={collectionNavTab === "Activity" ? "card p-5 space-y-4" : "hidden"}>
        <div className="flex items-center justify-between">
          <h3 className="section-title">Collection Activity</h3>
          <p className="text-milady-cream/50 text-xs">Only {collection.name} events</p>
        </div>

        {activityLoading ? (
          <p className="text-milady-cream/50 text-sm">Loading activity...</p>
        ) : activityEvents.length === 0 ? (
          <p className="text-milady-cream/50 text-sm">No activity for this collection yet.</p>
        ) : (
          <div className="space-y-3">
            {activityEvents.map((event, idx) => (
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
                <p className="text-milady-cream/50 text-xs mt-1">
                  Token: {event.tokenId ?? "-"} · Block: {event.blockNumber ?? "-"}
                </p>
                <div className="text-milady-cream/60 text-xs mt-2 space-y-1">
                  {event.seller && <p>Seller: {shortAddress(event.seller)}</p>}
                  {event.buyer && <p>Buyer: {shortAddress(event.buyer)}</p>}
                  {event.offerer && <p>Offerer: {shortAddress(event.offerer)}</p>}
                </div>
                {event.transactionHash && (
                  <a
                    href={`https://explore.tempo.xyz/tx/${event.transactionHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-milady-pink text-xs hover:underline mt-2 inline-block"
                  >
                    View transaction
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-milady-pink/10">
          <button
            type="button"
            onClick={() => setActivityPage((prev) => Math.max(1, prev - 1))}
            disabled={activityLoading || activityPage <= 1}
            className="text-xs px-3 py-1.5 rounded-md border border-milady-pink/20 text-milady-cream/70 hover:text-milady-cream disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => setActivityPage((prev) => prev + 1)}
            disabled={activityLoading || !activityHasNext}
            className="text-xs px-3 py-1.5 rounded-md border border-milady-pink/20 text-milady-cream/70 hover:text-milady-cream disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </section>

      {offerModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm p-4 md:p-8 overflow-y-auto"
          onClick={() => setOfferModalOpen(false)}
        >
          <div
            className="max-w-lg mx-auto card p-4 md:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <p className="text-milady-cream text-sm font-medium">Make Offer</p>
              <button
                type="button"
                onClick={() => setOfferModalOpen(false)}
                className="btn-ghost"
                disabled={collectionOffering}
              >
                Cancel
              </button>
            </div>

            <div className="space-y-3">
              <input
                className="input"
                type="number"
                min="0"
                step="0.001"
                value={collectionOfferPrice}
                onChange={(event) => setCollectionOfferPrice(event.target.value)}
                placeholder={`Price per NFT (${collection.name}) in ${PAYMENT_TOKEN_SYMBOL}`}
              />
              <input
                className="input"
                type="number"
                min="1"
                step="1"
                value={offerMaxTx}
                onChange={(event) => setOfferMaxTx(event.target.value)}
                placeholder="Quantity"
              />
              <input
                className="input"
                type="number"
                min="1"
                step="1"
                value={collectionOfferHours}
                onChange={(event) => setCollectionOfferHours(event.target.value)}
                placeholder="Duration (hours)"
              />
              <label className="flex items-center gap-2 text-sm text-milady-cream/70">
                <input
                  type="checkbox"
                  checked={continueOnError}
                  onChange={(event) => setContinueOnError(event.target.checked)}
                />
                Continue batch if one tx fails
              </label>
            </div>

            <div className="flex items-center gap-2 mt-5">
              <button
                type="button"
                onClick={async () => {
                  await makeCollectionOfferVisible();
                  setOfferModalOpen(false);
                }}
                disabled={!isConnected || collectionOffering || collectionOfferTokenIds.length === 0}
                className="btn-primary flex-1"
              >
                {collectionOffering ? "Placing Offer..." : "Place Offer"}
              </button>
              <button
                type="button"
                onClick={() => setOfferModalOpen(false)}
                className="btn-secondary flex-1"
                disabled={collectionOffering}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedTokenId !== null && (
        <NFTQuickViewModal
          tokenId={selectedTokenId}
          collectionSlug={collection.slug}
          onClose={() => setSelectedTokenId(null)}
        />
      )}
    </div>
  );
}