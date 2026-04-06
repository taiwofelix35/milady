import { createPublicClient, http, parseEther, parseUnits } from 'viem'
import { tempo } from '@/config/chains'
import {
  SEAPORT_ADDRESS,
  FEE_RECIPIENT,
  OPENSEA_FEE_BPS,
  CONDUIT_KEY,
  WETH_ADDRESS,
  ItemType,
  OrderType,
} from '@/config/seaport'
import type { SeaportOrder, OrderItem } from '@/types'

export const publicClient = createPublicClient({
  chain: tempo,
  transport: http(),
})

/** Generate a 32-byte (256-bit) cryptographically random hex salt for Seaport orders */
function generateSalt(): string {
  return `0x${Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')}`
}

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
    salt: generateSalt(),
    conduitKey: CONDUIT_KEY,
    totalOriginalConsiderationItems: consideration.length,
  }
}

 where the buyer offers WETH in exchange for an ERC-721.
 * The offeror (buyer) signs this order off-chain; the NFT owner fulfills it on-chain.
 */
export function buildOfferOrder(params: {
  offeror: string
  nftContract: string
  tokenId: string
  priceWeth: string
  royaltyRecipient?: string
  royaltyBps?: number
  durationDays?: number
}): SeaportOrder['parameters'] {
  const now = Math.floor(Date.now() / 1000)
  const duration = (params.durationDays ?? 7) * 86400
  const priceWei = parseEther(params.priceWeth)
  const openseaFee = (priceWei * BigInt(OPENSEA_FEE_BPS)) / BigInt(10000)
  const royaltyBps = params.royaltyBps ?? 0
  const royaltyFee = (priceWei * BigInt(royaltyBps)) / BigInt(10000)
  const sellerProceeds = priceWei - openseaFee - royaltyFee

  const consideration: OrderItem[] = [
    {
      itemType: ItemType.ERC721,
      token: params.nftContract,
      identifierOrCriteria: params.tokenId,
      startAmount: '1',
      endAmount: '1',
      recipient: params.offeror,
    },
    {
      itemType: ItemType.ERC20,
      token: WETH_ADDRESS,
      identifierOrCriteria: '0',
      startAmount: openseaFee.toString(),
      endAmount: openseaFee.toString(),
      recipient: FEE_RECIPIENT,
    },
  ]

  if (royaltyBps > 0 && params.royaltyRecipient) {
    consideration.push({
      itemType: ItemType.ERC20,
      token: WETH_ADDRESS,
      identifierOrCriteria: '0',
      startAmount: royaltyFee.toString(),
      endAmount: royaltyFee.toString(),
      recipient: params.royaltyRecipient,
    })
  }

  return {
    offerer: params.offeror,
    zone: '0x004C00500000aD104D7DBd00e3ae0A5C00560C00',
    offer: [
      {
        itemType: ItemType.ERC20,
        token: WETH_ADDRESS,
        identifierOrCriteria: '0',
        startAmount: sellerProceeds.toString(),
        endAmount: sellerProceeds.toString(),
      },
    ],
    consideration,
    orderType: OrderType.FULL_OPEN,
    startTime: now,
    endTime: now + duration,
    zoneHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
    salt: generateSalt(),
    conduitKey: CONDUIT_KEY,
    totalOriginalConsiderationItems: consideration.length,
  }
}

export const WETH_ABI = [
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

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

/** Strongly-typed args for the Seaport fulfillOrder call derived from SEAPORT_ABI */
export type SeaportOfferItem = {
  itemType: number
  token: `0x${string}`
  identifierOrCriteria: bigint
  startAmount: bigint
  endAmount: bigint
}

export type SeaportConsiderationItem = SeaportOfferItem & {
  recipient: `0x${string}`
}

export type SeaportOrderParameters = {
  offerer: `0x${string}`
  zone: `0x${string}`
  offer: SeaportOfferItem[]
  consideration: SeaportConsiderationItem[]
  orderType: number
  startTime: bigint
  endTime: bigint
  zoneHash: `0x${string}`
  salt: bigint
  conduitKey: `0x${string}`
  totalOriginalConsiderationItems: bigint
}

export type SeaportFulfillOrderInput = {
  parameters: SeaportOrderParameters
  signature: `0x${string}`
}

/** Convert a serialised SeaportOrder (string amounts) into the bigint form viem requires */
export function toFulfillOrderInput(protocolData: {
  parameters: {
    offerer: string
    zone: string
    offer: Array<{ itemType: number; token: string; identifierOrCriteria: string; startAmount: string; endAmount: string }>
    consideration: Array<{ itemType: number; token: string; identifierOrCriteria: string; startAmount: string; endAmount: string; recipient?: string }>
    orderType: number
    startTime: number
    endTime: number
    zoneHash: string
    salt: string
    conduitKey: string
    totalOriginalConsiderationItems: number
  }
  signature: string
}): SeaportFulfillOrderInput {
  const p = protocolData.parameters
  return {
    parameters: {
      offerer: p.offerer as `0x${string}`,
      zone: p.zone as `0x${string}`,
      offer: p.offer.map((o) => ({
        itemType: o.itemType,
        token: o.token as `0x${string}`,
        identifierOrCriteria: BigInt(o.identifierOrCriteria),
        startAmount: BigInt(o.startAmount),
        endAmount: BigInt(o.endAmount),
      })),
      consideration: p.consideration.map((c) => ({
        itemType: c.itemType,
        token: c.token as `0x${string}`,
        identifierOrCriteria: BigInt(c.identifierOrCriteria),
        startAmount: BigInt(c.startAmount),
        endAmount: BigInt(c.endAmount),
        recipient: (c.recipient ?? '0x0000000000000000000000000000000000000000') as `0x${string}`,
      })),
      orderType: p.orderType,
      startTime: BigInt(p.startTime),
      endTime: BigInt(p.endTime),
      zoneHash: p.zoneHash as `0x${string}`,
      salt: BigInt(p.salt),
      conduitKey: p.conduitKey as `0x${string}`,
      totalOriginalConsiderationItems: BigInt(p.totalOriginalConsiderationItems),
    },
    signature: protocolData.signature as `0x${string}`,
  }
}
