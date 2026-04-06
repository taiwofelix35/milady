import { notFound } from 'next/navigation'
import Image from 'next/image'
import NFTCard from '@/components/NFTCard'
import { MOCK_COLLECTIONS, MOCK_NFTS } from '@/lib/mockData'
import type { Metadata } from 'next'

interface PageProps {
  params: { slug: string }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const collection = MOCK_COLLECTIONS.find((c) => c.slug === params.slug)
  if (!collection) return { title: 'Collection Not Found' }
  return {
    title: `${collection.name} — Milady Market`,
    description: collection.description,
  }
}

export default function CollectionPage({ params }: PageProps) {
  const collection = MOCK_COLLECTIONS.find((c) => c.slug === params.slug)
  if (!collection) notFound()

  const nfts = MOCK_NFTS.filter(
    (n) => n.contractAddress.toLowerCase() === collection.contractAddress.toLowerCase()
  )

  return (
    <div>
      {/* Banner */}
      <div className="relative h-48 sm:h-64 bg-milady-gradient overflow-hidden">
        {collection.bannerImage && (
          <Image
            src={collection.bannerImage}
            alt={collection.name}
            fill
            className="object-cover opacity-50"
            unoptimized
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-milady-cream/80" />
      </div>

      {/* Collection Info */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative -mt-12 mb-6">
          <div className="w-24 h-24 rounded-2xl overflow-hidden border-4 border-white shadow-milady-lg bg-milady-gradient">
            <Image
              src={collection.image}
              alt={collection.name}
              width={96}
              height={96}
              className="object-cover w-full h-full"
              unoptimized
            />
          </div>
        </div>

        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-3xl font-bold text-gray-800">{collection.name}</h1>
            {collection.verified && (
              <span className="text-milady-purple text-xl" title="Verified">✓</span>
            )}
          </div>
          <p className="text-gray-600 max-w-2xl mb-6">{collection.description}</p>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Floor Price', value: collection.floorPrice ? `${collection.floorPrice} ETH` : '—' },
              { label: 'Total Volume', value: collection.totalVolume ? `${collection.totalVolume} ETH` : '—' },
              { label: 'Items', value: collection.totalSupply.toLocaleString() },
              { label: 'Owners', value: collection.owners ? collection.owners.toLocaleString() : '—' },
            ].map((stat) => (
              <div
                key={stat.label}
                className="bg-white rounded-2xl p-4 shadow-milady border border-milady-blush/50 text-center"
              >
                <p className="text-xl font-bold text-gray-800">{stat.value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Contract */}
        <div className="mb-8 flex items-center gap-2 text-sm text-gray-500">
          <span>Contract:</span>
          <a
            href={`https://explorer.tempo.xyz/address/${collection.contractAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-milady-pink hover:text-milady-pink-dark transition-colors underline"
          >
            {collection.contractAddress.slice(0, 10)}…{collection.contractAddress.slice(-8)}
          </a>
        </div>

        {/* NFT Grid */}
        <div className="pb-16">
          <h2 className="text-xl font-bold text-gray-800 mb-6">
            Items ({nfts.length})
          </h2>
          {nfts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {nfts.map((nft) => (
                <NFTCard key={`${nft.contractAddress}-${nft.tokenId}`} nft={nft} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20 text-gray-400">
              <div className="text-4xl mb-3">🌸</div>
              <p>No items found in this collection yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
