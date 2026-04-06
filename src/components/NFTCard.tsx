import Link from 'next/link'
import Image from 'next/image'
import type { NFT } from '@/types'

interface NFTCardProps {
  nft: NFT
}

export default function NFTCard({ nft }: NFTCardProps) {
  return (
    <Link
      href={`/nft/${nft.contractAddress}/${nft.tokenId}`}
      className="group block bg-white rounded-2xl overflow-hidden shadow-milady hover:shadow-milady-hover transition-all duration-300 hover:-translate-y-1 border border-milady-blush/50"
    >
      {/* Image */}
      <div className="relative aspect-square bg-milady-gradient overflow-hidden">
        <Image
          src={nft.image}
          alt={nft.name}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-500"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          unoptimized
        />
        {nft.listing && (
          <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm rounded-full px-2 py-1 text-xs font-medium text-milady-pink-dark shadow-milady">
            For Sale
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-milady-pink font-medium truncate">{nft.collection.name}</p>
          {nft.collection.verified && (
            <span className="text-milady-purple" title="Verified collection">✓</span>
          )}
        </div>
        <h3 className="font-semibold text-gray-800 truncate group-hover:text-milady-pink-dark transition-colors">
          {nft.name}
        </h3>

        <div className="mt-3 flex items-end justify-between">
          {nft.listing ? (
            <div>
              <p className="text-xs text-gray-400">Price</p>
              <p className="font-bold text-gray-800">{nft.listing.price} ETH</p>
            </div>
          ) : (
            <div>
              <p className="text-xs text-gray-400">Not listed</p>
              <p className="text-sm text-gray-500">—</p>
            </div>
          )}

          {nft.listing && (
            <button className="px-4 py-1.5 bg-milady-button text-white text-sm font-medium rounded-full hover:opacity-90 transition-opacity shadow-milady">
              Buy
            </button>
          )}
        </div>
      </div>
    </Link>
  )
}
