'use client'

import { use, useState } from 'react'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { useAccount } from 'wagmi'
import BuyModal from '@/components/BuyModal'
import ListingModal from '@/components/ListingModal'
import { MOCK_NFTS } from '@/lib/mockData'
import { shortenAddress } from '@/lib/seaport'

interface PageProps {
  params: Promise<{ contract: string; tokenId: string }>
}

export default function NFTDetailPage({ params }: PageProps) {
  const { contract, tokenId } = use(params)
  const nft = MOCK_NFTS.find(
    (n) =>
      n.contractAddress.toLowerCase() === contract.toLowerCase() &&
      n.tokenId === tokenId
  )

  const { address } = useAccount()
  const [showBuy, setShowBuy] = useState(false)
  const [showList, setShowList] = useState(false)

  if (!nft) notFound()

  const isOwner = address && nft.owner.toLowerCase() === address.toLowerCase()
  const expiresIn = nft.listing
    ? Math.max(0, Math.floor((nft.listing.expiration - Date.now() / 1000) / 86400))
    : null

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:text-milady-pink-dark transition-colors">Home</Link>
        <span>/</span>
        <Link
          href={`/collections/${nft.collection.slug}`}
          className="hover:text-milady-pink-dark transition-colors"
        >
          {nft.collection.name}
        </Link>
        <span>/</span>
        <span className="text-gray-800 font-medium">{nft.name}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Image */}
        <div>
          <div className="relative aspect-square rounded-3xl overflow-hidden bg-milady-gradient shadow-milady-lg border border-milady-blush">
            <Image
              src={nft.image}
              alt={nft.name}
              fill
              className="object-cover"
              priority
              unoptimized
            />
          </div>
        </div>

        {/* Details */}
        <div>
          {/* Collection */}
          <Link
            href={`/collections/${nft.collection.slug}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-milady-pink hover:text-milady-pink-dark transition-colors mb-2"
          >
            {nft.collection.name}
            {nft.collection.verified && <span>✓</span>}
          </Link>

          <h1 className="text-3xl font-bold text-gray-800 mb-4">{nft.name}</h1>

          {/* Owner */}
          <div className="flex items-center gap-4 mb-6 text-sm text-gray-500">
            <span>
              Owned by{' '}
              <a
                href={`https://explorer.tempo.xyz/address/${nft.owner}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-milady-pink hover:text-milady-pink-dark underline transition-colors"
              >
                {shortenAddress(nft.owner)}
              </a>
            </span>
          </div>

          {/* Listing Card */}
          <div className="bg-white rounded-2xl p-6 shadow-milady border border-milady-blush mb-6">
            {nft.listing ? (
              <>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-500">Current price</p>
                  {expiresIn !== null && (
                    <p className="text-xs text-gray-400">Expires in {expiresIn}d</p>
                  )}
                </div>
                <p className="text-3xl font-bold text-gray-800 mb-1">{nft.listing.price} ETH</p>
                <p className="text-sm text-gray-400 mb-6">
                  Listed by {shortenAddress(nft.listing.seller)}
                </p>

                {isOwner ? (
                  <button
                    className="w-full py-3 bg-gray-100 text-gray-700 font-semibold rounded-full hover:bg-gray-200 transition-colors"
                    onClick={() => {}}
                  >
                    Cancel Listing
                  </button>
                ) : (
                  <button
                    onClick={() => setShowBuy(true)}
                    className="w-full py-3 bg-milady-button text-white font-semibold rounded-full shadow-milady hover:shadow-milady-hover hover:opacity-90 transition-all"
                  >
                    Buy Now — {nft.listing.price} ETH ♡
                  </button>
                )}
              </>
            ) : (
              <>
                <p className="text-gray-500 mb-4">This item is not currently for sale.</p>
                {isOwner && (
                  <button
                    onClick={() => setShowList(true)}
                    className="w-full py-3 bg-milady-button text-white font-semibold rounded-full shadow-milady hover:opacity-90 transition-opacity"
                  >
                    List for Sale ♡
                  </button>
                )}
              </>
            )}
          </div>

          {/* Description */}
          {nft.description && (
            <div className="mb-6">
              <h3 className="font-semibold text-gray-700 mb-2">Description</h3>
              <p className="text-sm text-gray-600">{nft.description}</p>
            </div>
          )}

          {/* Attributes */}
          {nft.attributes.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-700 mb-3">Properties</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {nft.attributes.map((attr) => (
                  <div
                    key={attr.traitType}
                    className="bg-milady-purple-light rounded-xl p-3 border border-milady-lavender text-center"
                  >
                    <p className="text-xs font-medium text-milady-purple-dark uppercase tracking-wider mb-1">
                      {attr.traitType}
                    </p>
                    <p className="text-sm font-semibold text-gray-700 truncate">{attr.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* On-chain info */}
          <div className="mt-6 pt-6 border-t border-milady-blush space-y-2 text-sm text-gray-500">
            <div className="flex justify-between">
              <span>Contract</span>
              <a
                href={`https://explorer.tempo.xyz/address/${nft.contractAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-milady-pink hover:text-milady-pink-dark underline font-mono"
              >
                {nft.contractAddress.slice(0, 10)}…{nft.contractAddress.slice(-8)}
              </a>
            </div>
            <div className="flex justify-between">
              <span>Token ID</span>
              <span className="font-mono text-gray-700">#{nft.tokenId}</span>
            </div>
            <div className="flex justify-between">
              <span>Chain</span>
              <span className="text-gray-700">Tempo (7364)</span>
            </div>
            <div className="flex justify-between">
              <span>Standard</span>
              <span className="text-gray-700">ERC-721</span>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showBuy && nft.listing && (
        <BuyModal nft={nft} onClose={() => setShowBuy(false)} />
      )}
      {showList && (
        <ListingModal nft={nft} onClose={() => setShowList(false)} />
      )}
    </div>
  )
}
