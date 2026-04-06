'use client'

import { useState } from 'react'
import { useAccount, useSignTypedData } from 'wagmi'
import { buildOfferOrder } from '@/lib/seaport'
import { CHAIN_ID } from '@/config/chains'
import { SEAPORT_ADDRESS, WETH_ADDRESS } from '@/config/seaport'
import type { NFT } from '@/types'

interface MakeOfferModalProps {
  nft: NFT
  onClose: () => void
}

export default function MakeOfferModal({ nft, onClose }: MakeOfferModalProps) {
  const { address, isConnected } = useAccount()
  const [priceWeth, setPriceWeth] = useState('')
  const [durationDays, setDurationDays] = useState(7)
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const { signTypedDataAsync } = useSignTypedData()

  async function handleOffer() {
    if (!isConnected || !address) {
      setErrorMsg('Please connect your wallet first.')
      setStatus('error')
      return
    }
    if (!priceWeth || parseFloat(priceWeth) <= 0) {
      setErrorMsg('Please enter a valid offer price.')
      setStatus('error')
      return
    }

    try {
      setStatus('pending')
      setErrorMsg('')

      const orderParams = buildOfferOrder({
        offeror: address,
        nftContract: nft.contractAddress,
        tokenId: nft.tokenId,
        priceWeth,
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

  const floorDiff =
    nft.collection.floorPrice && priceWeth
      ? ((parseFloat(priceWeth) / parseFloat(nft.collection.floorPrice) - 1) * 100).toFixed(0)
      : null

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

        <h2 className="text-xl font-bold text-gray-800 mb-1">Make an Offer</h2>
        <p className="text-sm text-gray-500 mb-6">
          Offers use WETH and are fulfilled via Seaport when the owner accepts.
        </p>

        {/* NFT summary */}
        <div className="bg-milady-gradient rounded-2xl p-4 mb-6 flex items-center gap-3">
          <div className="w-16 h-16 rounded-xl overflow-hidden bg-milady-blush flex-shrink-0">
            <img src={nft.image} alt={nft.name} className="w-full h-full object-cover" />
          </div>
          <div>
            <p className="text-xs text-milady-pink font-medium">{nft.collection.name}</p>
            <p className="font-semibold text-gray-800">{nft.name}</p>
            {nft.collection.floorPrice && (
              <p className="text-xs text-gray-400 mt-0.5">
                Floor: {nft.collection.floorPrice} ETH
              </p>
            )}
          </div>
        </div>

        {/* Price input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Offer Price (WETH)
          </label>
          <div className="relative">
            <input
              type="number"
              min="0"
              step="0.0001"
              value={priceWeth}
              onChange={(e) => setPriceWeth(e.target.value)}
              placeholder="0.00"
              className="w-full px-4 py-3 rounded-xl border border-milady-blush bg-milady-cream focus:outline-none focus:ring-2 focus:ring-milady-pink/50 focus:border-milady-pink text-gray-800 pr-20"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">
              WETH
            </span>
          </div>
          {floorDiff !== null && priceWeth && (
            <p
              className={`text-xs mt-1.5 ${
                parseFloat(floorDiff) >= 0 ? 'text-green-600' : 'text-red-500'
              }`}
            >
              {parseFloat(floorDiff) >= 0 ? '+' : ''}
              {floorDiff}% {parseFloat(floorDiff) >= 0 ? 'above' : 'below'} floor
            </p>
          )}
        </div>

        {/* Duration */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Offer Expires In
          </label>
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
          </select>
        </div>

        {/* WETH note */}
        <div className="mb-6 p-3 bg-milady-purple-light rounded-xl text-xs text-milady-purple-dark border border-milady-lavender">
          <strong>ℹ️ WETH required:</strong> You need WETH in your wallet to place an offer.
          Your WETH will be locked via a Seaport order signature — no upfront payment until the
          owner accepts.
        </div>

        {status === 'error' && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-200">
            {errorMsg}
          </div>
        )}

        {status === 'success' ? (
          <div className="text-center">
            <div className="text-4xl mb-2">💌</div>
            <p className="font-bold text-milady-pink-dark">Offer submitted!</p>
            <p className="text-sm text-gray-500 mt-1">
              The owner will be notified. Your offer expires in {durationDays} day
              {durationDays !== 1 ? 's' : ''}.
            </p>
            <button
              onClick={onClose}
              className="mt-4 w-full py-3 bg-milady-button text-white font-semibold rounded-full shadow-milady hover:opacity-90 transition-opacity"
            >
              Done ♡
            </button>
          </div>
        ) : (
          <button
            onClick={handleOffer}
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
              'Submit Offer ♡'
            )}
          </button>
        )}
      </div>
    </div>
  )
}
