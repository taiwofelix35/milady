'use client'

import { useState } from 'react'
import { useAccount, useSignTypedData } from 'wagmi'
import { parseEther } from 'viem'
import { buildListingOrder } from '@/lib/seaport'
import { CHAIN_ID } from '@/config/chains'
import { SEAPORT_ADDRESS } from '@/config/seaport'
import type { NFT } from '@/types'

interface ListingModalProps {
  nft: NFT
  onClose: () => void
}

export default function ListingModal({ nft, onClose }: ListingModalProps) {
  const { address, isConnected } = useAccount()
  const [priceEth, setPriceEth] = useState('')
  const [durationDays, setDurationDays] = useState(30)
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const { signTypedDataAsync } = useSignTypedData()

  async function handleList() {
    if (!isConnected || !address) {
      setErrorMsg('Please connect your wallet first.')
      setStatus('error')
      return
    }
    if (!priceEth || parseFloat(priceEth) <= 0) {
      setErrorMsg('Please enter a valid price.')
      setStatus('error')
      return
    }

    try {
      setStatus('pending')
      setErrorMsg('')

      const orderParams = buildListingOrder({
        offerer: address,
        nftContract: nft.contractAddress,
        tokenId: nft.tokenId,
        priceEth,
        royaltyRecipient: nft.collection.royaltyRecipient,
        royaltyBps: nft.collection.royaltyBps,
        durationDays,
      })

      const domain = {
        name: 'Seaport',
        version: '1.6',
        chainId: CHAIN_ID,
        verifyingContract: SEAPORT_ADDRESS,
      }

      const types = {
        OrderComponents: [
          { name: 'offerer', type: 'address' },
          { name: 'zone', type: 'address' },
          { name: 'offer', type: 'OfferItem[]' },
          { name: 'consideration', type: 'ConsiderationItem[]' },
          { name: 'orderType', type: 'uint8' },
          { name: 'startTime', type: 'uint256' },
          { name: 'endTime', type: 'uint256' },
          { name: 'zoneHash', type: 'bytes32' },
          { name: 'salt', type: 'uint256' },
          { name: 'conduitKey', type: 'bytes32' },
          { name: 'counter', type: 'uint256' },
        ],
        OfferItem: [
          { name: 'itemType', type: 'uint8' },
          { name: 'token', type: 'address' },
          { name: 'identifierOrCriteria', type: 'uint256' },
          { name: 'startAmount', type: 'uint256' },
          { name: 'endAmount', type: 'uint256' },
        ],
        ConsiderationItem: [
          { name: 'itemType', type: 'uint8' },
          { name: 'token', type: 'address' },
          { name: 'identifierOrCriteria', type: 'uint256' },
          { name: 'startAmount', type: 'uint256' },
          { name: 'endAmount', type: 'uint256' },
          { name: 'recipient', type: 'address' },
        ],
      }

      await signTypedDataAsync({
        domain,
        types,
        primaryType: 'OrderComponents',
        message: {
          ...orderParams,
          counter: BigInt(0),
        },
      })

      setStatus('success')
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Signing failed')
      setStatus('error')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-milady-lg max-w-sm w-full p-6 border border-milady-blush">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-milady-pink-dark transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h2 className="text-xl font-bold text-gray-800 mb-1">List for Sale</h2>
        <p className="text-sm text-gray-500 mb-6">Create a Seaport listing on Tempo</p>

        {/* NFT summary */}
        <div className="bg-milady-gradient rounded-2xl p-4 mb-6 flex items-center gap-3">
          <div className="w-16 h-16 rounded-xl overflow-hidden bg-milady-blush flex-shrink-0">
            <img src={nft.image} alt={nft.name} className="w-full h-full object-cover" />
          </div>
          <div>
            <p className="text-xs text-milady-pink font-medium">{nft.collection.name}</p>
            <p className="font-semibold text-gray-800">{nft.name}</p>
          </div>
        </div>

        {/* Price input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Price (ETH)</label>
          <div className="relative">
            <input
              type="number"
              min="0"
              step="0.0001"
              value={priceEth}
              onChange={(e) => setPriceEth(e.target.value)}
              placeholder="0.00"
              className="w-full px-4 py-3 rounded-xl border border-milady-blush bg-milady-cream focus:outline-none focus:ring-2 focus:ring-milady-pink/50 focus:border-milady-pink text-gray-800 pr-16"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">ETH</span>
          </div>
        </div>

        {/* Duration */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Duration</label>
          <select
            value={durationDays}
            onChange={(e) => setDurationDays(Number(e.target.value))}
            className="w-full px-4 py-3 rounded-xl border border-milady-blush bg-milady-cream focus:outline-none focus:ring-2 focus:ring-milady-pink/50 focus:border-milady-pink text-gray-800"
          >
            <option value={1}>1 day</option>
            <option value={3}>3 days</option>
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
            <option value={180}>6 months</option>
          </select>
        </div>

        {/* Fee breakdown */}
        {priceEth && parseFloat(priceEth) > 0 && (
          <div className="mb-6 space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>OpenSea fee (2.5%)</span>
              <span>-{(parseFloat(priceEth) * 0.025).toFixed(4)} ETH</span>
            </div>
            {(nft.collection.royaltyBps ?? 0) > 0 && (
              <div className="flex justify-between text-gray-500">
                <span>Creator royalty ({((nft.collection.royaltyBps ?? 0) / 100).toFixed(1)}%)</span>
                <span>-{(parseFloat(priceEth) * (nft.collection.royaltyBps ?? 0) / 10000).toFixed(4)} ETH</span>
              </div>
            )}
            <div className="flex justify-between text-gray-800 font-bold pt-1.5 border-t border-milady-blush">
              <span>You receive</span>
              <span>{(parseFloat(priceEth) * (1 - 0.025 - (nft.collection.royaltyBps ?? 0) / 10000)).toFixed(4)} ETH</span>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-200">
            {errorMsg}
          </div>
        )}

        {status === 'success' ? (
          <div className="text-center">
            <div className="text-4xl mb-2">🎀</div>
            <p className="font-bold text-milady-pink-dark">Listing created!</p>
            <p className="text-sm text-gray-500 mt-1">Your NFT is now listed on Milady Market.</p>
            <button
              onClick={onClose}
              className="mt-4 w-full py-3 bg-milady-button text-white font-semibold rounded-full shadow-milady hover:opacity-90 transition-opacity"
            >
              Done ♡
            </button>
          </div>
        ) : (
          <button
            onClick={handleList}
            disabled={status === 'pending'}
            className="w-full py-3 bg-milady-button text-white font-semibold rounded-full shadow-milady hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {status === 'pending' ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Signing…
              </>
            ) : (
              'List NFT ♡'
            )}
          </button>
        )}
      </div>
    </div>
  )
}
