"use client";

import { useParams, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits } from "viem";
import { useEffect, useState } from "react";
import { fetchActivityByToken, fetchListingByToken, fetchRarityRanks } from "@/lib/backendApi";
import { useTokenMetadata, useIsApprovedForMarketplaceByContracts } from "@/hooks/useNFT";
import { MILADY_NFT_ABI, MILADY_MARKETPLACE_ABI } from "@/lib/abis";
import {
  NFT_CONTRACT_ADDRESS,
  MARKETPLACE_CONTRACT_ADDRESS,
  PAYMENT_TOKEN_DECIMALS,
  PAYMENT_TOKEN_ADDRESS,
  PAYMENT_TOKEN_SYMBOL,
} from "@/lib/chain";
import { getSelectedCollectionSlug, saveSelectedCollectionSlug } from "@/lib/collectionContext";
import { getRarityResult, type RarityResult } from "@/lib/rarity";
import { resolveIPFS, formatTokenAmount, shortAddress } from "@/lib/utils";
import { useReadContract } from "wagmi";
import { getCollectionBySlug, tokenImageFromTemplate } from "@/lib/collections";

// ─── Sub-component: Buy panel ───────────────────────────────────────────────
function BuyPanel({
  tokenId,
  price,
  nftContract,
  marketplaceContract,
  listingSource,
}: {
  tokenId: bigint;
  price: bigint;
  nftContract: `0x${string}`;
  marketplaceContract: `0x${string}`;
  listingSource?: string | null;
}) {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function handleBuy() {
    writeContract({
      address: marketplaceContract,
      abi: MILADY_MARKETPLACE_ABI,
      functionName: "buyListing",
      args: [nftContract, tokenId],
    });
  }

  if (isSuccess) {
    return <p className="text-green-400 font-semibold">✓ Purchase complete!</p>;
  }

  const source = listingSource ?? "milady";
  const isExternalSource = source !== "milady";
  const externalUrl = source === "stablewhel"
    ? "https://www.stablewhel.xyz"
    : source === "temppunks"
      ? "https://temppunks.com"
      : null;

  return (
    <div className="space-y-3">
      {isExternalSource && (
        <p className="text-yellow-300/90 text-xs">
          This listing is active on {source === "stablewhel" ? "StableWhel" : "TempPunks"}. Buy from that marketplace.
        </p>
      )}
      <p className="text-milady-cream/60 text-sm">
        Price:{" "}
        <span className="text-milady-pink font-bold text-lg">
          {formatTokenAmount(price, PAYMENT_TOKEN_DECIMALS)} {PAYMENT_TOKEN_SYMBOL}
        </span>
      </p>
      {isExternalSource && externalUrl ? (
        <a
          href={externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary w-full inline-flex items-center justify-center"
        >
          Open {source === "stablewhel" ? "StableWhel" : "TempPunks"}
        </a>
      ) : (
        <button
          onClick={handleBuy}
          disabled={isPending || isConfirming}
          className="btn-primary w-full"
        >
          {isPending || isConfirming ? "Processing…" : "Buy Now"}
        </button>
      )}
    </div>
  );
}

// ─── Sub-component: List panel ───────────────────────────────────────────────
function ListPanel({
  tokenId,
  nftContract,
  marketplaceContract,
}: {
  tokenId: bigint;
  nftContract: `0x${string}`;
  marketplaceContract: `0x${string}`;
}) {
  const { address } = useAccount();
  const [price, setPrice] = useState("");

  const { data: isApproved, refetch: refetchApproval } = useIsApprovedForMarketplaceByContracts(
    address,
    nftContract,
    marketplaceContract
  );
  const { writeContract: approve, data: approveHash, isPending: approving } = useWriteContract();
  const { writeContract: list, data: listHash, isPending: listing } = useWriteContract();
  const { isLoading: approvingConfirm, isSuccess: approveSuccess } = useWaitForTransactionReceipt({
    hash: approveHash,
  });
  const { isLoading: listingConfirm, isSuccess: listSuccess } = useWaitForTransactionReceipt({
    hash: listHash,
  });

  if (approveSuccess) refetchApproval();

  function handleApprove() {
    approve({
      address: nftContract,
      abi: MILADY_NFT_ABI,
      functionName: "setApprovalForAll",
      args: [marketplaceContract, true],
    });
  }

  function handleList() {
    if (!price) return;
    list({
      address: marketplaceContract,
      abi: MILADY_MARKETPLACE_ABI,
      functionName: "createListing",
      args: [
        nftContract,
        tokenId,
        parseUnits(price, PAYMENT_TOKEN_DECIMALS),
      ],
    });
  }

  if (listSuccess) {
    return <p className="text-green-400 font-semibold">✓ Listed successfully!</p>;
  }

  if (!isApproved) {
    return (
      <div className="space-y-2">
        <p className="text-milady-cream/60 text-sm">
          First, approve the marketplace to transfer your NFTs.
        </p>
        <button
          onClick={handleApprove}
          disabled={approving || approvingConfirm}
          className="btn-primary w-full"
        >
          {approving || approvingConfirm ? "Approving…" : "Approve Marketplace"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <input
        type="number"
        placeholder={`Price in ${PAYMENT_TOKEN_SYMBOL}`}
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        className="input"
        min="0"
        step="0.001"
      />
      <button
        onClick={handleList}
        disabled={listing || listingConfirm || !price}
        className="btn-primary w-full"
      >
        {listing || listingConfirm ? "Listing…" : "List for Sale"}
      </button>
    </div>
  );
}

function CancelListingPanel({
  tokenId,
  nftContract,
  marketplaceContract,
}: {
  tokenId: bigint;
  nftContract: `0x${string}`;
  marketplaceContract: `0x${string}`;
}) {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  if (isSuccess) {
    return <p className="text-green-400 font-semibold">✓ Listing cancelled.</p>;
  }

  return (
    <button
      onClick={() => {
        writeContract({
          address: marketplaceContract,
          abi: MILADY_MARKETPLACE_ABI,
          functionName: "cancelListing",
          args: [nftContract, tokenId],
        });
      }}
      disabled={isPending || isConfirming}
      className="btn-secondary w-full"
    >
      {isPending || isConfirming ? "Cancelling…" : "Cancel Listing"}
    </button>
  );
}

// ─── Sub-component: Make Offer panel ─────────────────────────────────────────
function MakeOfferPanel({
  tokenId,
  nftContract,
  marketplaceContract,
}: {
  tokenId: bigint;
  nftContract: `0x${string}`;
  marketplaceContract: `0x${string}`;
}) {
  const [amount, setAmount] = useState("");
  const [durationHours, setDurationHours] = useState("24");

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const durationSeconds = BigInt(Math.max(1, Number(durationHours || "0")) * 3600);

  function handleOffer() {
    if (!amount) return;
    writeContract({
      address: marketplaceContract,
      abi: MILADY_MARKETPLACE_ABI,
      functionName: "makeOffer",
      args: [
        nftContract,
        tokenId,
        parseUnits(amount, PAYMENT_TOKEN_DECIMALS),
        durationSeconds,
      ],
    });
  }

  if (isSuccess) {
    return <p className="text-green-400 font-semibold">✓ Offer submitted!</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-milady-cream/50 text-xs">
        Offers are made in {PAYMENT_TOKEN_SYMBOL} token ({PAYMENT_TOKEN_ADDRESS}) configured in your marketplace contract.
      </p>
      <input
        type="number"
        placeholder={`Offer amount in ${PAYMENT_TOKEN_SYMBOL}`}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="input"
        min="0"
        step="0.001"
      />
      <input
        type="number"
        placeholder="Offer duration (hours)"
        value={durationHours}
        onChange={(e) => setDurationHours(e.target.value)}
        className="input"
        min="1"
        step="1"
      />
      <button
        onClick={handleOffer}
        disabled={isPending || isConfirming || !amount}
        className="btn-primary w-full"
      >
        {isPending || isConfirming ? "Submitting…" : "Make Offer"}
      </button>
    </div>
  );
}

// ─── Main NFT Detail page ─────────────────────────────────────────────────────
export default function NFTDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const tokenId = BigInt(params.tokenId as string);
  const { address } = useAccount();
  const [resolvedCollectionSlug, setResolvedCollectionSlug] = useState("");
  const collectionSlug = searchParams.get("collection") ?? resolvedCollectionSlug;
  const selectedCollection = getCollectionBySlug(collectionSlug);
  const activeNftContract = selectedCollection?.nftContract ?? NFT_CONTRACT_ADDRESS;
  const activeMarketplaceContract = selectedCollection?.marketContract ?? MARKETPLACE_CONTRACT_ADDRESS;

  useEffect(() => {
    const fromQuery = searchParams.get("collection") ?? "";
    const fallback = getSelectedCollectionSlug();
    const slug = fromQuery || fallback;
    setResolvedCollectionSlug(slug);
    if (slug) {
      saveSelectedCollectionSlug(slug);
    }
  }, [searchParams]);

  const { metadata, loading } = useTokenMetadata(tokenId, activeNftContract);

  const { data: owner } = useReadContract({
    address: activeNftContract,
    abi: MILADY_NFT_ABI,
    functionName: "ownerOf",
    args: [tokenId],
  });

  const isOwner = address && owner && address.toLowerCase() === (owner as string).toLowerCase();
  const imageSrc = metadata?.image
    ? resolveIPFS(metadata.image)
    : selectedCollection
      ? tokenImageFromTemplate(selectedCollection, tokenId)
      : "/placeholder.svg";
  const isRemoteImage = imageSrc.startsWith("http://") || imageSrc.startsWith("https://");
  const displayName = metadata?.name ?? `${selectedCollection?.name ?? "NFT"} #${tokenId.toString()}`;
  const [listing, setListing] = useState<
    | {
        seller: `0x${string}`;
        price: bigint;
        active: boolean;
        source?: string | null;
        sourceLabel?: string | null;
      }
    | null
  >(null);
  const [listingLoading, setListingLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(true);
  const [rarityLoading, setRarityLoading] = useState(false);
  const [rarity, setRarity] = useState<RarityResult | null>(null);
  const [rarityRank, setRarityRank] = useState<number | null>(null);
  const [rarityRankedTotal, setRarityRankedTotal] = useState<number | null>(null);
  const [activity, setActivity] = useState<
    Array<{
      type: "ItemListed" | "ItemSold" | "OfferMade";
      source?: string;
      sourceLabel?: string;
      marketplace?: `0x${string}`;
      blockNumber: string | null;
      transactionHash: `0x${string}` | null;
      seller?: `0x${string}`;
      buyer?: `0x${string}`;
      offerer?: `0x${string}`;
      price?: string;
      expiry?: string;
    }>
  >([]);
  const [activityFilter, setActivityFilter] = useState<"all" | "ItemListed" | "ItemSold" | "OfferMade">("all");

  useEffect(() => {
    let cancelled = false;

    async function loadListing() {
      setListingLoading(true);
      const nextListing = await fetchListingByToken(
        tokenId,
        activeNftContract,
        selectedCollection?.marketContract
      );
      if (!cancelled) {
        setListing(nextListing);
        setListingLoading(false);
      }
    }

    loadListing();
    const intervalId = window.setInterval(loadListing, 20_000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [tokenId, activeNftContract, selectedCollection?.marketContract]);

  useEffect(() => {
    let cancelled = false;

    async function loadRarity() {
      if (!selectedCollection?.metadataBase || !metadata?.attributes?.length) {
        setRarity(null);
        return;
      }

      setRarityLoading(true);
      const result = await getRarityResult({
        collectionSlug: selectedCollection.slug,
        metadataBase: selectedCollection.metadataBase,
        supply: selectedCollection.supply,
        attributes: metadata.attributes,
      });

      if (!cancelled) {
        setRarity(result);
        setRarityLoading(false);
      }
    }

    loadRarity();
    return () => {
      cancelled = true;
    };
  }, [selectedCollection?.slug, selectedCollection?.metadataBase, selectedCollection?.supply, metadata?.attributes]);

  useEffect(() => {
    let cancelled = false;

    async function loadRarityRank() {
      if (!selectedCollection?.metadataBase || selectedCollection.supply <= 0) {
        setRarityRank(null);
        setRarityRankedTotal(null);
        return;
      }

      const response = await fetchRarityRanks({
        metadataBase: selectedCollection.metadataBase,
        supply: selectedCollection.supply,
        startTokenId: selectedCollection.startTokenId ?? 1,
        tokenIds: [tokenId],
      });

      if (!cancelled) {
        const row = response?.ranksByToken.get(tokenId.toString());
        setRarityRank(row?.rank ?? null);
        setRarityRankedTotal(response?.rankedTokens ?? null);
      }
    }

    void loadRarityRank();
    return () => {
      cancelled = true;
    };
  }, [tokenId, selectedCollection?.metadataBase, selectedCollection?.supply, selectedCollection?.startTokenId]);

  useEffect(() => {
    let cancelled = false;

    async function loadActivity() {
      setActivityLoading(true);
      const events = await fetchActivityByToken(tokenId, activeNftContract);
      if (!cancelled) {
        setActivity(events);
        setActivityLoading(false);
      }
    }

    loadActivity();
    const intervalId = window.setInterval(loadActivity, 20_000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [tokenId, activeNftContract]);

  const hasActiveListing = !!listing && listing.active;

  const [activeTab, setActiveTab] = useState<"buy" | "offer" | "list">("buy");

  useEffect(() => {
    const requested = searchParams.get("tab");
    if (requested === "list" || requested === "offer" || requested === "buy") {
      setActiveTab(requested);
    }
  }, [searchParams]);
  const filteredActivity =
    activityFilter === "all"
      ? activity
      : activity.filter((event) => event.type === activityFilter);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="grid md:grid-cols-2 gap-10">
        {/* Left: Image */}
        <div className="space-y-4">
          <div className="card overflow-hidden aspect-square relative">
            {loading ? (
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

          {/* Attributes */}
          {metadata?.attributes && metadata.attributes.length > 0 && (
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-milady-pink mb-3">Attributes</h3>
              <div className="grid grid-cols-2 gap-2">
                {metadata.attributes.map((attr) => (
                  <div
                    key={attr.trait_type}
                    className="bg-milady-charcoal rounded-lg p-2 border border-milady-pink/10"
                  >
                    <p className="text-milady-cream/40 text-xs">{attr.trait_type}</p>
                    <p className="text-milady-cream text-sm font-medium truncate">{attr.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card p-4">
            <h3 className="text-sm font-semibold text-milady-pink mb-3">Rarity</h3>
            {rarityLoading ? (
              <p className="text-milady-cream/50 text-sm">Computing rarity from collection metadata...</p>
            ) : !rarity ? (
              <p className="text-milady-cream/50 text-sm">
                Rarity unavailable for this NFT. Add metadata base to the collection to enable scoring.
              </p>
            ) : (
              <div className="space-y-3">
                {typeof rarityRank === "number" && rarityRank > 0 && (
                  <p className="text-milady-cream text-sm">
                    Rank: <span className="text-milady-pink font-semibold">#{rarityRank}</span>
                    {typeof rarityRankedTotal === "number" && rarityRankedTotal > 0 ? ` / ${rarityRankedTotal}` : ""}
                  </p>
                )}
                <p className="text-milady-cream text-sm">
                  Score: <span className="text-milady-pink font-semibold">{rarity.score.toFixed(2)}</span>
                </p>
                <p className="text-milady-cream/50 text-xs">Based on {rarity.sampledTokens} sampled tokens.</p>
                <div className="space-y-2">
                  {rarity.traits.map((row) => (
                    <div
                      key={`${row.traitType}:${row.value}`}
                      className="flex items-center justify-between gap-3 text-xs border border-milady-pink/10 rounded-md px-2 py-1"
                    >
                      <span className="text-milady-cream/70 truncate">{row.traitType}: {row.value}</span>
                      <span className="text-milady-pink whitespace-nowrap">{(row.frequency * 100).toFixed(2)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Details & actions */}
        <div className="space-y-6">
          <div>
            <p className="text-milady-pink/60 text-sm font-medium mb-1">
              {selectedCollection?.name ?? "Milady"} NFT
            </p>
            {selectedCollection && (
              <Link
                href={`/collection/${selectedCollection.slug}`}
                className="inline-block text-xs px-2 py-1 rounded-md border border-milady-pink/30 text-milady-pink hover:bg-milady-pink/10 mb-2"
              >
                {selectedCollection.name}
              </Link>
            )}
            <h1 className="font-milady text-3xl text-milady-cream">{displayName}</h1>
            {owner && (
              <p className="text-milady-cream/50 text-sm mt-2">
                Owned by{" "}
                <a
                  href={`/profile/${owner}${selectedCollection ? `?collection=${selectedCollection.slug}` : ""}`}
                  className="text-milady-pink hover:underline"
                >
                  {isOwner ? "You" : shortAddress(owner as string)}
                </a>
              </p>
            )}
            {metadata?.description && (
              <p className="text-milady-cream/70 text-sm mt-4 leading-relaxed">
                {metadata.description}
              </p>
            )}
          </div>

          {/* Action tabs */}
          <div className="card p-5 space-y-4">
            <div className="flex gap-2 border-b border-milady-pink/10 pb-3">
              <button
                onClick={() => setActiveTab("buy")}
                className={`text-sm font-medium px-3 py-1 rounded-lg transition-colors ${
                  activeTab === "buy"
                    ? "bg-milady-pink/20 text-milady-pink"
                    : "text-milady-cream/40 hover:text-milady-cream/70"
                }`}
              >
                Buy
              </button>
              <button
                onClick={() => setActiveTab("offer")}
                className={`text-sm font-medium px-3 py-1 rounded-lg transition-colors ${
                  activeTab === "offer"
                    ? "bg-milady-pink/20 text-milady-pink"
                    : "text-milady-cream/40 hover:text-milady-cream/70"
                }`}
              >
                Make Offer
              </button>
              {isOwner && (
                <button
                  onClick={() => setActiveTab("list")}
                  className={`text-sm font-medium px-3 py-1 rounded-lg transition-colors ${
                    activeTab === "list"
                      ? "bg-milady-pink/20 text-milady-pink"
                      : "text-milady-cream/40 hover:text-milady-cream/70"
                  }`}
                >
                  List for Sale
                </button>
              )}
            </div>

            {activeTab === "buy" &&
              (hasActiveListing ? (
                <BuyPanel
                  tokenId={tokenId}
                  price={listing.price}
                  nftContract={activeNftContract}
                  marketplaceContract={activeMarketplaceContract}
                  listingSource={listing.source}
                />
              ) : listingLoading ? (
                <p className="text-milady-cream/50 text-sm">Loading listing data from backend...</p>
              ) : (
                <p className="text-milady-cream/50 text-sm">
                  No active listing found for this NFT.
                </p>
              ))}

            {activeTab === "offer" && (
              address ? (
                <MakeOfferPanel
                  tokenId={tokenId}
                  nftContract={activeNftContract}
                  marketplaceContract={activeMarketplaceContract}
                />
              ) : (
                <p className="text-milady-cream/50 text-sm">Connect your wallet to make an offer.</p>
              )
            )}

            {activeTab === "list" && isOwner && (
              listingLoading ? (
                <p className="text-milady-cream/50 text-sm">Loading listing data from backend...</p>
              ) : hasActiveListing ? (
                listing.source && listing.source !== "milady" ? (
                  <p className="text-milady-cream/50 text-sm">
                    This listing is from {listing.sourceLabel ?? listing.source}. Cancel it on that marketplace.
                  </p>
                ) : (
                  <div className="space-y-3">
                    <p className="text-milady-cream/60 text-sm">
                      Current listing: <span className="text-milady-pink font-semibold">{formatTokenAmount(listing.price, PAYMENT_TOKEN_DECIMALS)} {PAYMENT_TOKEN_SYMBOL}</span>
                    </p>
                    <CancelListingPanel
                      tokenId={tokenId}
                      nftContract={activeNftContract}
                      marketplaceContract={activeMarketplaceContract}
                    />
                  </div>
                )
              ) : (
                <ListPanel
                  tokenId={tokenId}
                  nftContract={activeNftContract}
                  marketplaceContract={activeMarketplaceContract}
                />
              )
            )}
          </div>

          <div className="card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-milady-pink">Activity</h3>
            <div className="flex flex-wrap gap-2">
              {[
                ["all", "All"],
                ["ItemListed", "Listings"],
                ["ItemSold", "Sales"],
                ["OfferMade", "Offers"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setActivityFilter(value as "all" | "ItemListed" | "ItemSold" | "OfferMade")}
                  className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                    activityFilter === value
                      ? "border-milady-pink text-milady-pink bg-milady-pink/10"
                      : "border-milady-pink/20 text-milady-cream/60 hover:text-milady-cream"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {activityLoading ? (
              <p className="text-milady-cream/50 text-sm">Loading activity from backend...</p>
            ) : filteredActivity.length === 0 ? (
              <p className="text-milady-cream/50 text-sm">No activity found for this NFT yet.</p>
            ) : (
              <div className="space-y-3">
                {filteredActivity.map((event, idx) => (
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
                        <p className="text-milady-pink text-sm font-semibold">{formatTokenAmount(BigInt(event.price), PAYMENT_TOKEN_DECIMALS)} {PAYMENT_TOKEN_SYMBOL}</p>
                      )}
                    </div>
                    <p className="text-milady-cream/50 text-xs mt-1">Block: {event.blockNumber ?? "-"}</p>
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
          </div>
        </div>
      </div>
    </div>
  );
}
