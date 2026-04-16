"use client";

import Image from "next/image";
import Link from "next/link";
import { resolveIPFS, formatTokenAmount } from "@/lib/utils";
import { PAYMENT_TOKEN_DECIMALS, PAYMENT_TOKEN_SYMBOL } from "@/lib/chain";

export interface NFTCardProps {
  tokenId: bigint;
  name?: string;
  image?: string;
  price?: bigint;
  paymentSymbol?: string;
  seller?: string;
  isListed?: boolean;
  collectionSlug?: string;
  tokenLabelPrefix?: string;
  rarityRank?: number | null;
  rarityTotal?: number | null;
  isOwnedByViewer?: boolean;
  onClick?: () => void;
  onAction?: () => void;
  actionLabel?: string;
  actionDisabled?: boolean;
  actionLoading?: boolean;
}

export function NFTCard({
  tokenId,
  name,
  image,
  price,
  paymentSymbol = PAYMENT_TOKEN_SYMBOL,
  isListed,
  collectionSlug,
  tokenLabelPrefix,
  rarityRank = null,
  rarityTotal = null,
  isOwnedByViewer = false,
  onClick,
  onAction,
  actionLabel,
  actionDisabled = false,
  actionLoading = false,
}: NFTCardProps) {
  const imageSrc = image ? resolveIPFS(image) : "/placeholder.svg";
  const isRemoteImage = imageSrc.startsWith("http://") || imageSrc.startsWith("https://");
  const displayName = name ?? `${tokenLabelPrefix ?? "NFT"} #${tokenId.toString()}`;
  const targetTab = isOwnedByViewer ? "list" : isListed ? "buy" : "offer";
  const query = new URLSearchParams();
  if (collectionSlug) {
    query.set("collection", collectionSlug);
  }
  query.set("tab", targetTab);
  const href = `/nft/${tokenId}?${query.toString()}`;
  const ctaLabel = actionLabel ?? (isOwnedByViewer ? (isListed ? "Manage listing" : "List") : isListed ? "Buy now" : "Make offer");

  const imageBlock = (
    <>
      <Image
        src={imageSrc}
        alt={displayName}
        fill
        className="object-cover group-hover:scale-105 transition-transform duration-500"
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
        unoptimized={isRemoteImage}
        onError={(event) => {
          event.currentTarget.src = "/placeholder.svg";
        }}
      />
      {isListed && (
        <div className="absolute top-2 right-2 badge">Listed</div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200">
        <div className="rounded-lg border border-milady-pink/30 bg-milady-charcoal/85 backdrop-blur-sm px-3 py-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-milady-pink">
            {onAction ? ctaLabel : onClick ? "View" : ctaLabel}
          </p>
        </div>
      </div>
    </>
  );

  return (
    <div className="group block">
      <div className="card overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-glow">
        <div className="relative aspect-square w-full overflow-hidden bg-milady-charcoal">
          {onClick ? (
            <button
              type="button"
              onClick={onClick}
              className="absolute inset-0 block w-full h-full text-left"
              aria-label={`View ${displayName}`}
            >
              {imageBlock}
            </button>
          ) : (
            <Link href={href} className="absolute inset-0 block w-full h-full">
              {imageBlock}
            </Link>
          )}
        </div>

        <div className="p-4 space-y-2">
          <h3 className="font-semibold text-milady-cream truncate">{displayName}</h3>
          {typeof rarityRank === "number" && rarityRank > 0 && (
            <p className="text-milady-cream/60 text-xs mt-1">
              Rarity #{rarityRank}
              {typeof rarityTotal === "number" && rarityTotal > 0 ? ` / ${rarityTotal}` : ""}
            </p>
          )}
          {isListed && price !== undefined && (
            <p className="text-milady-pink font-bold mt-1">
              {formatTokenAmount(price, PAYMENT_TOKEN_DECIMALS)} {paymentSymbol}
            </p>
          )}
          {!isListed && (
            <p className="text-milady-cream/40 text-sm mt-1">{isOwnedByViewer ? "You own this" : "Not listed"}</p>
          )}

          {onAction ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onAction();
              }}
              disabled={actionDisabled || actionLoading}
              className="btn-primary w-full"
            >
              {actionLoading ? "Processing..." : ctaLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
