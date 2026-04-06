export interface NFT {
  tokenId: string
  contractAddress: string
  name: string
  description: string
  image: string
  animationUrl?: string
  attributes: NFTAttribute[]
  owner: string
  creator: string
  collection: Collection
  listing?: Listing
  lastSale?: Sale
}

export interface NFTAttribute {
  traitType: string
  value: string | number
  displayType?: string
  maxValue?: number
}

export interface Collection {
  slug: string
  name: string
  description: string
  image: string
  bannerImage?: string
  contractAddress: string
  chainId: number
  totalSupply: number
  floorPrice?: string
  totalVolume?: string
  owners?: number
  verified?: boolean
  royaltyBps?: number
  royaltyRecipient?: string
}

export interface Listing {
  orderId: string
  price: string
  currency: string
  seller: string
  expiration: number
  createdAt: number
  protocolData: SeaportOrder
}

export interface Sale {
  price: string
  currency: string
  buyer: string
  seller: string
  timestamp: number
  transactionHash: string
}

export interface SeaportOrder {
  parameters: {
    offerer: string
    zone: string
    offer: OrderItem[]
    consideration: OrderItem[]
    orderType: number
    startTime: number
    endTime: number
    zoneHash: string
    salt: string
    conduitKey: string
    totalOriginalConsiderationItems: number
  }
  signature: string
}

export interface OrderItem {
  itemType: number
  token: string
  identifierOrCriteria: string
  startAmount: string
  endAmount: string
  recipient?: string
}

export interface MarketplaceStats {
  totalVolume: string
  totalNFTs: number
  totalCollections: number
  totalOwners: number
}
