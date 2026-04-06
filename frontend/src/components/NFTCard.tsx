"use client";

import Image from "next/image";
import Link from "next/link";
import { resolveIPFS, formatEther } from "@/lib/utils";

export interface NFTCardProps {
  tokenId: bigint;
  name?: string;
  image?: string;
  price?: bigint;
  paymentSymbol?: string;
  seller?: string;
  isListed?: boolean;
}

export function NFTCard({
  tokenId,
  name,
  image,
  price,
  paymentSymbol = "TEMPO",
  isListed,
}: NFTCardProps) {
  const imageSrc = image ? resolveIPFS(image) : "/placeholder.png";
  const displayName = name ?? `Milady #${tokenId.toString()}`;

  return (
    <Link href={`/nft/${tokenId}`} className="group block">
      <div className="card overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-glow">
        {/* Image */}
        <div className="relative aspect-square w-full overflow-hidden bg-milady-charcoal">
          <Image
            src={imageSrc}
            alt={displayName}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            unoptimized={imageSrc.startsWith("https://ipfs.io")}
          />
          {isListed && (
            <div className="absolute top-2 right-2 badge">Listed</div>
          )}
        </div>

        {/* Info */}
        <div className="p-4">
          <h3 className="font-semibold text-milady-cream truncate">{displayName}</h3>
          {isListed && price !== undefined && (
            <p className="text-milady-pink font-bold mt-1">
              {formatEther(price)} {paymentSymbol}
            </p>
          )}
          {!isListed && (
            <p className="text-milady-cream/40 text-sm mt-1">Not listed</p>
          )}
        </div>
      </div>
    </Link>
  );
}
