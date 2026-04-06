'use client'

import { useState } from 'react'
import { useAccount, useWriteContract } from 'wagmi'
import { parseEther } from 'viem'
import { SEAPORT_ADDRESS, CONDUIT_KEY } from '@/config/seaport'
import { SEAPORT_ABI, toFulfillOrderInput, shortenAddress } from '@/lib/seaport'
import type { NFT, Offer } from '@/types'

interface OffersTableProps {
  nft: NFT
}

function timeLeft(expiration: number): string {
  const secs = expiration - Math.floor(Date.now() / 1000)
  if (secs <= 0) return 'Expired'
  if (secs < 3600) return `${Math.floor(secs / 60)}m`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h`
  return `${Math.floor(secs / 86400)}d`
}

interface AcceptState {
  [orderId: string]: 'idle' | 'pending' | 'success' | 'error'
}

export default function OffersTable({ nft }: OffersTableProps) {
  const { address } = useAccount()
  const [acceptState, setAcceptState] = useState<AcceptState>({})
  const [errorMsg, setErrorMsg] = useState<{ [orderId: string]: string }>({})

  const { writeContractAsync } = useWriteContract()

  const isOwner = address && nft.owner.toLowerCase() === address.toLowerCase()
  const activeOffers = (nft.offers ?? []).filter((o) => {
    return o.status === 'active' && o.expiration > Math.floor(Date.now() / 1000)
  })

  if (activeOffers.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">
        <div className="text-3xl mb-2">💌</div>
        <p>No offers yet. Be the first to make one!</p>
      </div>
    )
  }

  async function handleAccept(offer: Offer) {
    if (!address) return
    try {
      setAcceptState((s) => ({ ...s, [offer.orderId]: 'pending' }))
      setErrorMsg((m) => ({ ...m, [offer.orderId]: '' }))

      const order = {
        parameters: offer.protocolData.parameters,
        signature: offer.protocolData.signature as `0x${string}`,
      }

      await writeContractAsync({
        address: SEAPORT_ADDRESS,
        abi: SEAPORT_ABI,
        functionName: 'fulfillOrder',
        args: [order as never, CONDUIT_KEY as `0x${string}`],
      })

      setAcceptState((s) => ({ ...s, [offer.orderId]: 'success' }))
    } catch (err: unknown) {
      setErrorMsg((m) => ({
        ...m,
        [offer.orderId]: err instanceof Error ? err.message : 'Transaction failed',
      }))
      setAcceptState((s) => ({ ...s, [offer.orderId]: 'error' }))
    }
  }

  const isOfferor = (offer: Offer) =>
    address && offer.offeror.toLowerCase() === address.toLowerCase()

  return (
    <div className="overflow-x-auto rounded-2xl border border-milady-blush">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-milady-pink-light text-left">
            <th className="px-4 py-3 font-semibold text-milady-pink-dark">Price</th>
            <th className="px-4 py-3 font-semibold text-milady-pink-dark hidden sm:table-cell">
              Floor Diff
            </th>
            <th className="px-4 py-3 font-semibold text-milady-pink-dark hidden md:table-cell">
              Expires
            </th>
            <th className="px-4 py-3 font-semibold text-milady-pink-dark">From</th>
            <th className="px-4 py-3 font-semibold text-milady-pink-dark text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-milady-blush/60">
          {activeOffers.map((offer) => {
            const state = acceptState[offer.orderId] ?? 'idle'
            const floorDiff =
              nft.collection.floorPrice
                ? ((parseFloat(offer.price) / parseFloat(nft.collection.floorPrice) - 1) * 100).toFixed(0)
                : null

            return (
              <tr key={offer.orderId} className="bg-white hover:bg-milady-cream transition-colors">
                <td className="px-4 py-3 font-bold text-gray-800 whitespace-nowrap">
                  {offer.price}{' '}
                  <span className="text-xs font-normal text-gray-400">{offer.currency}</span>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell whitespace-nowrap">
                  {floorDiff !== null ? (
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        parseFloat(floorDiff) >= 0
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-600'
                      }`}
                    >
                      {parseFloat(floorDiff) >= 0 ? '+' : ''}
                      {floorDiff}%
                    </span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 hidden md:table-cell text-gray-500">
                  {timeLeft(offer.expiration)}
                </td>
                <td className="px-4 py-3">
                  <a
                    href={`https://explorer.tempo.xyz/address/${offer.offeror}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-milady-pink hover:text-milady-pink-dark underline transition-colors"
                  >
                    {shortenAddress(offer.offeror)}
                  </a>
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {state === 'success' ? (
                    <span className="text-green-600 font-medium text-xs">Accepted ✓</span>
                  ) : isOwner ? (
                    <>
                      <button
                        onClick={() => handleAccept(offer)}
                        disabled={state === 'pending'}
                        className="px-3 py-1.5 bg-milady-button text-white text-xs font-semibold rounded-full hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {state === 'pending' ? (
                          <span className="flex items-center gap-1">
                            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Wait…
                          </span>
                        ) : (
                          'Accept'
                        )}
                      </button>
                      {state === 'error' && errorMsg[offer.orderId] && (
                        <p className="text-red-500 text-xs mt-1 max-w-[120px] text-right">
                          {errorMsg[offer.orderId].slice(0, 40)}…
                        </p>
                      )}
                    </>
                  ) : isOfferor(offer) ? (
                    <span className="text-xs text-milady-purple font-medium">Your offer</span>
                  ) : (
                    <span className="text-gray-300 text-xs">—</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
