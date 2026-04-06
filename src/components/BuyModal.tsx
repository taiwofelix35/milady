'use client'

import { useState } from 'react'
import { useAccount, useWriteContract } from 'wagmi'
import { parseEther } from 'viem'
import { SEAPORT_ABI, toFulfillOrderInput } from '@/lib/seaport'
import { SEAPORT_ADDRESS, CONDUIT_KEY } from '@/config/seaport'
import type { NFT } from '@/types'

interface BuyModalProps {
  nft: NFT
  onClose: () => void
}

export default function BuyModal({ nft, onClose }: BuyModalProps) {
  const { address, isConnected } = useAccount()
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const { writeContractAsync } = useWriteContract()

  if (!nft.listing) return null

  async function handleBuy() {
    if (!isConnected || !address) {
      setErrorMsg('Please connect your wallet first.')
      setStatus('error')
      return
    }

    try {
      setStatus('pending')
      setErrorMsg('')

      const order = toFulfillOrderInput(nft.listing!.protocolData)

      await writeContractAsync({
        address: SEAPORT_ADDRESS,
        abi: SEAPORT_ABI,
        functionName: 'fulfillOrder',
        args: [order, CONDUIT_KEY as `0x${string}`],
        value: parseEther(nft.listing!.price),
      })

      setStatus('success')
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Transaction failed')
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

        <h2 className="text-xl font-bold text-gray-800 mb-1">Complete Purchase</h2>
        <p className="text-sm text-gray-500 mb-6">You are about to buy this NFT via Seaport</p>

        {/* NFT Summary */}
        <div className="bg-milady-gradient rounded-2xl p-4 mb-6 flex items-center gap-3">
          <div className="w-16 h-16 rounded-xl overflow-hidden bg-milady-blush flex-shrink-0">
            <img src={nft.image} alt={nft.name} className="w-full h-full object-cover" />
          </div>
          <div>
            <p className="text-xs text-milady-pink font-medium">{nft.collection.name}</p>
            <p className="font-semibold text-gray-800">{nft.name}</p>
            <p className="text-lg font-bold text-milady-pink-dark mt-0.5">{nft.listing.price} ETH</p>
          </div>
        </div>

        {/* Breakdown */}
        <div className="space-y-2 mb-6 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Item price</span>
            <span className="font-medium">{nft.listing.price} ETH</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>OpenSea fee (2.5%)</span>
            <span>{(parseFloat(nft.listing.price) * 0.025).toFixed(4)} ETH</span>
          </div>
          <div className="flex justify-between text-gray-800 font-bold pt-2 border-t border-milady-blush">
            <span>Total</span>
            <span>{nft.listing.price} ETH</span>
          </div>
        </div>

        {status === 'error' && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-200">
            {errorMsg}
          </div>
        )}

        {status === 'success' ? (
          <div className="text-center">
            <div className="text-4xl mb-2">🎀</div>
            <p className="font-bold text-milady-pink-dark">Purchase complete!</p>
            <p className="text-sm text-gray-500 mt-1">The NFT will appear in your wallet shortly.</p>
            <button
              onClick={onClose}
              className="mt-4 w-full py-3 bg-milady-button text-white font-semibold rounded-full shadow-milady hover:opacity-90 transition-opacity"
            >
              Done ♡
            </button>
          </div>
        ) : (
          <button
            onClick={handleBuy}
            disabled={status === 'pending'}
            className="w-full py-3 bg-milady-button text-white font-semibold rounded-full shadow-milady hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {status === 'pending' ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Confirming…
              </>
            ) : (
              'Confirm Purchase ♡'
            )}
          </button>
        )}
      </div>
    </div>
  )
}
