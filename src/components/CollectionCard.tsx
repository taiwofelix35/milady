import Link from 'next/link'
import Image from 'next/image'
import type { Collection } from '@/types'

interface CollectionCardProps {
  collection: Collection
}

export default function CollectionCard({ collection }: CollectionCardProps) {
  return (
    <Link
      href={`/collections/${collection.slug}`}
      className="group block bg-white rounded-2xl overflow-hidden shadow-milady hover:shadow-milady-hover transition-all duration-300 hover:-translate-y-1 border border-milady-blush/50"
    >
      {/* Banner */}
      <div className="relative h-24 bg-milady-gradient overflow-hidden">
        {collection.bannerImage && (
          <Image
            src={collection.bannerImage}
            alt={collection.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500 opacity-60"
            unoptimized
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white/20" />
      </div>

      {/* Collection Avatar */}
      <div className="px-4 pb-4">
        <div className="relative -mt-8 mb-3">
          <div className="w-16 h-16 rounded-2xl overflow-hidden border-4 border-white shadow-milady bg-milady-gradient">
            <Image
              src={collection.image}
              alt={collection.name}
              width={64}
              height={64}
              className="object-cover w-full h-full"
              unoptimized
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5 mb-1">
          <h3 className="font-bold text-gray-800 group-hover:text-milady-pink-dark transition-colors truncate">
            {collection.name}
          </h3>
          {collection.verified && (
            <span className="text-milady-purple text-sm" title="Verified">✓</span>
          )}
        </div>

        <p className="text-xs text-gray-500 line-clamp-2 mb-4">{collection.description}</p>

        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-milady-blush/50">
          <div className="text-center">
            <p className="text-xs text-gray-400">Floor</p>
            <p className="text-sm font-semibold text-gray-700">
              {collection.floorPrice ? `${collection.floorPrice} ETH` : '—'}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-400">Volume</p>
            <p className="text-sm font-semibold text-gray-700">
              {collection.totalVolume ? `${collection.totalVolume} ETH` : '—'}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-400">Items</p>
            <p className="text-sm font-semibold text-gray-700">
              {collection.totalSupply.toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </Link>
  )
}
