import Link from 'next/link'
import Image from 'next/image'
import NFTCard from '@/components/NFTCard'
import CollectionCard from '@/components/CollectionCard'
import { MOCK_NFTS, MOCK_COLLECTIONS, MOCK_STATS } from '@/lib/mockData'

export default function HomePage() {
  const featuredNFTs = MOCK_NFTS.filter((n) => n.listing).slice(0, 4)
  const trendingCollections = MOCK_COLLECTIONS.slice(0, 3)

  return (
    <div>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-milady-hero py-20 px-4 sm:px-6 lg:px-8">
        {/* Decorative blobs */}
        <div className="absolute top-10 left-10 w-64 h-64 bg-milady-pink/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-80 h-80 bg-milady-purple/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto relative">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Text */}
            <div>
              <div className="inline-flex items-center gap-2 bg-white/60 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-medium text-milady-pink-dark border border-milady-blush mb-6">
                <span>🎀</span>
                <span>Built on Tempo · OpenSea Seaport Standard</span>
              </div>
              <h1 className="font-display text-5xl sm:text-6xl font-bold leading-tight mb-6">
                <span className="bg-gradient-to-r from-milady-pink-dark via-milady-purple to-milady-pink-dark bg-clip-text text-transparent">
                  Milady Market
                </span>
              </h1>
              <p className="text-lg text-gray-600 mb-8 max-w-lg">
                The kawaii NFT marketplace on Tempo. Discover, collect, and trade NFTs using
                OpenSea's Seaport protocol — fully decentralized. ♡
              </p>
              <div className="flex flex-wrap gap-4">
                <Link
                  href="/collections"
                  className="px-8 py-3 bg-milady-button text-white font-semibold rounded-full shadow-milady hover:shadow-milady-hover hover:opacity-90 transition-all"
                >
                  Explore Collections
                </Link>
                <Link
                  href="/"
                  className="px-8 py-3 bg-white text-milady-pink-dark font-semibold rounded-full shadow-milady hover:shadow-milady-hover border border-milady-blush transition-all"
                >
                  Browse NFTs
                </Link>
              </div>
            </div>

            {/* Featured NFT preview */}
            <div className="hidden lg:block">
              <div className="relative">
                <div className="absolute inset-0 bg-milady-gradient rounded-3xl blur-xl opacity-60" />
                <div className="relative bg-white rounded-3xl p-4 shadow-milady-lg border border-milady-blush">
                  <div className="grid grid-cols-2 gap-3">
                    {featuredNFTs.slice(0, 4).map((nft, i) => (
                      <div
                        key={`${nft.contractAddress}-${nft.tokenId}`}
                        className={`rounded-2xl overflow-hidden bg-milady-gradient aspect-square ${i === 0 ? 'col-span-2 max-h-[200px]' : 'max-h-[100px]'}`}
                      >
                        <img
                          src={nft.image}
                          alt={nft.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-milady-pink font-medium">Featured</p>
                      <p className="font-bold text-gray-800">{featuredNFTs[0]?.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Floor Price</p>
                      <p className="font-bold text-milady-pink-dark">{featuredNFTs[0]?.listing?.price} ETH</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="bg-white border-y border-milady-blush py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {[
              { label: 'Total Volume', value: `${MOCK_STATS.totalVolume} ETH` },
              { label: 'NFTs', value: MOCK_STATS.totalNFTs.toLocaleString() },
              { label: 'Collections', value: MOCK_STATS.totalCollections.toLocaleString() },
              { label: 'Owners', value: MOCK_STATS.totalOwners.toLocaleString() },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-2xl font-bold bg-gradient-to-r from-milady-pink-dark to-milady-purple-dark bg-clip-text text-transparent">
                  {stat.value}
                </p>
                <p className="text-sm text-gray-500 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trending Collections */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-gray-800">
            Trending Collections{' '}
            <span className="text-milady-pink">♡</span>
          </h2>
          <Link
            href="/collections"
            className="text-sm font-medium text-milady-pink-dark hover:underline"
          >
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {trendingCollections.map((collection) => (
            <CollectionCard key={collection.slug} collection={collection} />
          ))}
        </div>
      </section>

      {/* Featured Listings */}
      <section className="bg-milady-gradient py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-gray-800">
              Live Listings{' '}
              <span className="text-milady-pink">✨</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredNFTs.map((nft) => (
              <NFTCard key={`${nft.contractAddress}-${nft.tokenId}`} nft={nft} />
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-2xl font-bold text-gray-800 text-center mb-12">
          How it works{' '}
          <span className="text-milady-pink">🌸</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {[
            {
              icon: '👛',
              title: 'Connect Wallet',
              description: 'Connect your wallet to Tempo network. We support MetaMask, WalletConnect, and more.',
            },
            {
              icon: '🛒',
              title: 'Browse & Buy',
              description: 'Discover NFTs, browse collections, and purchase using the OpenSea Seaport protocol.',
            },
            {
              icon: '🎀',
              title: 'List & Earn',
              description: 'List your NFTs for sale with custom prices. Earn ETH with minimal fees.',
            },
          ].map((step) => (
            <div
              key={step.title}
              className="text-center p-6 bg-white rounded-2xl shadow-milady border border-milady-blush/50"
            >
              <div className="text-5xl mb-4">{step.icon}</div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">{step.title}</h3>
              <p className="text-sm text-gray-500">{step.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
