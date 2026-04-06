"use client";

import { useParams } from "next/navigation";
import Image from "next/image";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther, zeroAddress } from "viem";
import { useState } from "react";
import { useTokenMetadata, useIsApprovedForMarketplace } from "@/hooks/useNFT";
import { MILADY_NFT_ABI, MILADY_MARKETPLACE_ABI } from "@/lib/abis";
import { NFT_CONTRACT_ADDRESS, MARKETPLACE_CONTRACT_ADDRESS } from "@/lib/chain";
import { resolveIPFS, formatEther, shortAddress } from "@/lib/utils";
import { useReadContract } from "wagmi";

// ─── Sub-component: Buy panel ───────────────────────────────────────────────
function BuyPanel({
  listingId,
  price,
  paymentToken,
}: {
  listingId: `0x${string}`;
  price: bigint;
  paymentToken: string;
}) {
  const isNative = paymentToken === zeroAddress;
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function handleBuy() {
    writeContract({
      address: MARKETPLACE_CONTRACT_ADDRESS,
      abi: MILADY_MARKETPLACE_ABI,
      functionName: "buy",
      args: [listingId],
      value: isNative ? price : 0n,
    });
  }

  if (isSuccess) {
    return <p className="text-green-400 font-semibold">✓ Purchase complete!</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-milady-cream/60 text-sm">
        Price:{" "}
        <span className="text-milady-pink font-bold text-lg">
          {formatEther(price)} {isNative ? "TEMPO" : shortAddress(paymentToken)}
        </span>
      </p>
      <button
        onClick={handleBuy}
        disabled={isPending || isConfirming}
        className="btn-primary w-full"
      >
        {isPending || isConfirming ? "Processing…" : "Buy Now"}
      </button>
    </div>
  );
}

// ─── Sub-component: List panel ───────────────────────────────────────────────
function ListPanel({ tokenId }: { tokenId: bigint }) {
  const { address } = useAccount();
  const [price, setPrice] = useState("");
  const [expiry, setExpiry] = useState("");

  const { data: isApproved, refetch: refetchApproval } = useIsApprovedForMarketplace(address);
  const { writeContract: approve, data: approveHash, isPending: approving } = useWriteContract();
  const { writeContract: list, data: listHash, isPending: listing } = useWriteContract();
  const { isLoading: approvingConfirm, isSuccess: approveSuccess } = useWaitForTransactionReceipt({
    hash: approveHash,
  });
  const { isLoading: listingConfirm, isSuccess: listSuccess } = useWaitForTransactionReceipt({
    hash: listHash,
  });

  if (approveSuccess) refetchApproval();

  const expiryTimestamp =
    expiry ? BigInt(Math.floor(new Date(expiry).getTime() / 1000)) : 0n;

  function handleApprove() {
    approve({
      address: NFT_CONTRACT_ADDRESS,
      abi: MILADY_NFT_ABI,
      functionName: "setApprovalForAll",
      args: [MARKETPLACE_CONTRACT_ADDRESS, true],
    });
  }

  function handleList() {
    if (!price) return;
    list({
      address: MARKETPLACE_CONTRACT_ADDRESS,
      abi: MILADY_MARKETPLACE_ABI,
      functionName: "list",
      args: [
        NFT_CONTRACT_ADDRESS,
        tokenId,
        parseEther(price),
        zeroAddress,
        expiryTimestamp,
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
        placeholder="Price in TEMPO"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        className="input"
        min="0"
        step="0.001"
      />
      <input
        type="datetime-local"
        value={expiry}
        onChange={(e) => setExpiry(e.target.value)}
        className="input text-sm"
        title="Optional expiry date"
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

// ─── Sub-component: Make Offer panel ─────────────────────────────────────────
function MakeOfferPanel({ tokenId }: { tokenId: bigint }) {
  const [amount, setAmount] = useState("");
  const [expiry, setExpiry] = useState("");

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const expiryTimestamp =
    expiry ? BigInt(Math.floor(new Date(expiry).getTime() / 1000)) : 0n;

  // Uses a well-known WETH address (update per network); falls back to zero for native
  const WETH = (process.env.NEXT_PUBLIC_WETH_ADDRESS ?? zeroAddress) as `0x${string}`;

  function handleOffer() {
    if (!amount) return;
    writeContract({
      address: MARKETPLACE_CONTRACT_ADDRESS,
      abi: MILADY_MARKETPLACE_ABI,
      functionName: "makeOffer",
      args: [
        NFT_CONTRACT_ADDRESS,
        tokenId,
        parseEther(amount),
        WETH,
        expiryTimestamp,
      ],
    });
  }

  if (isSuccess) {
    return <p className="text-green-400 font-semibold">✓ Offer submitted!</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-milady-cream/50 text-xs">
        Offer uses WETH. Make sure you have enough WETH approved for the marketplace.
      </p>
      <input
        type="number"
        placeholder="Offer amount in WETH"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="input"
        min="0"
        step="0.001"
      />
      <input
        type="datetime-local"
        value={expiry}
        onChange={(e) => setExpiry(e.target.value)}
        className="input text-sm"
        title="Optional offer expiry"
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
  const tokenId = BigInt(params.tokenId as string);
  const { address } = useAccount();

  const { metadata, loading } = useTokenMetadata(tokenId);

  const { data: owner } = useReadContract({
    address: NFT_CONTRACT_ADDRESS,
    abi: MILADY_NFT_ABI,
    functionName: "ownerOf",
    args: [tokenId],
  });

  const isOwner = address && owner && address.toLowerCase() === (owner as string).toLowerCase();
  const imageSrc = metadata?.image ? resolveIPFS(metadata.image) : "/placeholder.png";
  const displayName = metadata?.name ?? `Milady #${tokenId.toString()}`;

  const [activeTab, setActiveTab] = useState<"buy" | "offer" | "list">("buy");

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
                unoptimized={imageSrc.startsWith("https://ipfs.io")}
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
        </div>

        {/* Right: Details & actions */}
        <div className="space-y-6">
          <div>
            <p className="text-milady-pink/60 text-sm font-medium mb-1">Milady NFT</p>
            <h1 className="font-milady text-3xl text-milady-cream">{displayName}</h1>
            {owner && (
              <p className="text-milady-cream/50 text-sm mt-2">
                Owned by{" "}
                <a
                  href={`/profile/${owner}`}
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

            {activeTab === "buy" && (
              <p className="text-milady-cream/50 text-sm">
                No active listing. Check back later or make an offer.
              </p>
            )}

            {activeTab === "offer" && (
              address ? (
                <MakeOfferPanel tokenId={tokenId} />
              ) : (
                <p className="text-milady-cream/50 text-sm">Connect your wallet to make an offer.</p>
              )
            )}

            {activeTab === "list" && isOwner && (
              <ListPanel tokenId={tokenId} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
