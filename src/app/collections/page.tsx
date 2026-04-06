import CollectionCard from '@/components/CollectionCard'
import { MOCK_COLLECTIONS } from '@/lib/mockData'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Collections — Milady Market',
  description: 'Browse all NFT collections on Milady Market, the premier NFT marketplace on Tempo.',
}

export default function CollectionsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-4xl font-bold text-gray-800 mb-3">
          Collections{' '}
          <span className="text-milady-pink">🎀</span>
        </h1>
        <p className="text-gray-500 max-w-xl">
          Discover and explore NFT collections on Tempo. All collections use the OpenSea Seaport standard.
        </p>
      </div>

      {/* Collection Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {MOCK_COLLECTIONS.map((collection) => (
          <CollectionCard key={collection.slug} collection={collection} />
        ))}
      </div>
    </div>
  )
}
