import { createPublicClient, http, parseEther, formatEther } from 'viem'
import { tempo } from '@/config/chains'
import {
  SEAPORT_ADDRESS,
  FEE_RECIPIENT,
  OPENSEA_FEE_BPS,
  CONDUIT_KEY,
  ItemType,
  OrderType,
} from '@/config/seaport'
import type { SeaportOrder, OrderItem } from '@/types'

export const publicClient = createPublicClient({
  chain: tempo,
  transport: http(),
})

export function formatPrice(priceInEth: string): string {
  return `${parseFloat(priceInEth).toFixed(4)} ETH`
}

export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

export function buildListingOrder(params: {
  offerer: string
  nftContract: string
  tokenId: string
  priceEth: string
  royaltyRecipient?: string
  royaltyBps?: number
  durationDays?: number
}): SeaportOrder['parameters'] {
  const now = Math.floor(Date.now() / 1000)
  const duration = (params.durationDays ?? 30) * 86400
  const priceWei = parseEther(params.priceEth)
  const openseaFee = (priceWei * BigInt(OPENSEA_FEE_BPS)) / BigInt(10000)
  const royaltyBps = params.royaltyBps ?? 0
  const royaltyFee = (priceWei * BigInt(royaltyBps)) / BigInt(10000)
  const sellerProceeds = priceWei - openseaFee - royaltyFee

  const consideration: OrderItem[] = [
    {
      itemType: ItemType.NATIVE,
      token: '0x0000000000000000000000000000000000000000',
      identifierOrCriteria: '0',
      startAmount: sellerProceeds.toString(),
      endAmount: sellerProceeds.toString(),
      recipient: params.offerer,
    },
    {
      itemType: ItemType.NATIVE,
      token: '0x0000000000000000000000000000000000000000',
      identifierOrCriteria: '0',
      startAmount: openseaFee.toString(),
      endAmount: openseaFee.toString(),
      recipient: FEE_RECIPIENT,
    },
  ]

  if (royaltyBps > 0 && params.royaltyRecipient) {
    consideration.push({
      itemType: ItemType.NATIVE,
      token: '0x0000000000000000000000000000000000000000',
      identifierOrCriteria: '0',
      startAmount: royaltyFee.toString(),
      endAmount: royaltyFee.toString(),
      recipient: params.royaltyRecipient,
    })
  }

  return {
    offerer: params.offerer,
    zone: '0x004C00500000aD104D7DBd00e3ae0A5C00560C00',
    offer: [
      {
        itemType: ItemType.ERC721,
        token: params.nftContract,
        identifierOrCriteria: params.tokenId,
        startAmount: '1',
        endAmount: '1',
      },
    ],
    consideration,
    orderType: OrderType.FULL_OPEN,
    startTime: now,
    endTime: now + duration,
    zoneHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
    salt: `0x${Array.from(crypto.getRandomValues(new Uint8Array(6))).map((b) => b.toString(16).padStart(2, '0')).join('')}`,
    conduitKey: CONDUIT_KEY,
    totalOriginalConsiderationItems: consideration.length,
  }
}

export const SEAPORT_ABI = [
  {
    inputs: [
      {
        components: [
          {
            components: [
              { internalType: 'address', name: 'offerer', type: 'address' },
              { internalType: 'address', name: 'zone', type: 'address' },
              {
                components: [
                  { internalType: 'uint8', name: 'itemType', type: 'uint8' },
                  { internalType: 'address', name: 'token', type: 'address' },
                  { internalType: 'uint256', name: 'identifierOrCriteria', type: 'uint256' },
                  { internalType: 'uint256', name: 'startAmount', type: 'uint256' },
                  { internalType: 'uint256', name: 'endAmount', type: 'uint256' },
                ],
                internalType: 'struct OfferItem[]',
                name: 'offer',
                type: 'tuple[]',
              },
              {
                components: [
                  { internalType: 'uint8', name: 'itemType', type: 'uint8' },
                  { internalType: 'address', name: 'token', type: 'address' },
                  { internalType: 'uint256', name: 'identifierOrCriteria', type: 'uint256' },
                  { internalType: 'uint256', name: 'startAmount', type: 'uint256' },
                  { internalType: 'uint256', name: 'endAmount', type: 'uint256' },
                  { internalType: 'address payable', name: 'recipient', type: 'address' },
                ],
                internalType: 'struct ConsiderationItem[]',
                name: 'consideration',
                type: 'tuple[]',
              },
              { internalType: 'uint8', name: 'orderType', type: 'uint8' },
              { internalType: 'uint256', name: 'startTime', type: 'uint256' },
              { internalType: 'uint256', name: 'endTime', type: 'uint256' },
              { internalType: 'bytes32', name: 'zoneHash', type: 'bytes32' },
              { internalType: 'uint256', name: 'salt', type: 'uint256' },
              { internalType: 'bytes32', name: 'conduitKey', type: 'bytes32' },
              { internalType: 'uint256', name: 'totalOriginalConsiderationItems', type: 'uint256' },
            ],
            internalType: 'struct OrderParameters',
            name: 'parameters',
            type: 'tuple',
          },
          { internalType: 'bytes', name: 'signature', type: 'bytes' },
        ],
        internalType: 'struct Order',
        name: 'order',
        type: 'tuple',
      },
      { internalType: 'bytes32', name: 'fulfillerConduitKey', type: 'bytes32' },
    ],
    name: 'fulfillOrder',
    outputs: [{ internalType: 'bool', name: 'fulfilled', type: 'bool' }],
    stateMutability: 'payable',
    type: 'function',
  },
] as const
