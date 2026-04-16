export const MARKETPLACE_ABI = [
  {
    name: "getAllListings",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "nft", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "tokenId", type: "uint256" },
          { name: "seller", type: "address" },
          { name: "price", type: "uint256" },
        ],
      },
    ],
  },
  {
    name: "listings",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "nft", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [
      { name: "seller", type: "address" },
      { name: "price", type: "uint256" },
      { name: "active", type: "bool" },
    ],
  },
  {
    name: "getListing",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "nft", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [
      { name: "seller", type: "address" },
      { name: "price", type: "uint256" },
      { name: "active", type: "bool" },
    ],
  },
  {
    name: "getOffer",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "nft", type: "address" },
      { name: "tokenId", type: "uint256" },
      { name: "offerer", type: "address" },
    ],
    outputs: [
      { name: "price", type: "uint256" },
      { name: "expiry", type: "uint256" },
      { name: "active", type: "bool" },
    ],
  },
  {
    name: "ItemListed",
    type: "event",
    inputs: [
      { name: "nft", type: "address", indexed: true },
      { name: "seller", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "price", type: "uint256", indexed: false },
    ],
  },
  {
    name: "ItemSold",
    type: "event",
    inputs: [
      { name: "nft", type: "address", indexed: true },
      { name: "seller", type: "address", indexed: true },
      { name: "buyer", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: false },
      { name: "price", type: "uint256", indexed: false },
    ],
  },
  {
    name: "OfferMade",
    type: "event",
    inputs: [
      { name: "nft", type: "address", indexed: true },
      { name: "offerer", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "price", type: "uint256", indexed: false },
      { name: "expiry", type: "uint256", indexed: false },
    ],
  },
] ;

export const MARKETPLACE_LEGACY_EVENT_ABI = [
  {
    name: "Listed",
    type: "event",
    inputs: [
      { name: "listingId", type: "bytes32", indexed: true },
      { name: "seller", type: "address", indexed: true },
      { name: "nftContract", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: false },
      { name: "price", type: "uint256", indexed: false },
      { name: "paymentToken", type: "address", indexed: false },
      { name: "expiry", type: "uint256", indexed: false },
    ],
  },
  {
    name: "Sale",
    type: "event",
    inputs: [
      { name: "listingId", type: "bytes32", indexed: true },
      { name: "seller", type: "address", indexed: true },
      { name: "buyer", type: "address", indexed: true },
      { name: "nftContract", type: "address", indexed: false },
      { name: "tokenId", type: "uint256", indexed: false },
      { name: "price", type: "uint256", indexed: false },
      { name: "paymentToken", type: "address", indexed: false },
    ],
  },
  {
    name: "OfferMade",
    type: "event",
    inputs: [
      { name: "offerId", type: "bytes32", indexed: true },
      { name: "buyer", type: "address", indexed: true },
      { name: "nftContract", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
      { name: "paymentToken", type: "address", indexed: false },
      { name: "expiry", type: "uint256", indexed: false },
    ],
  },
];

// Additional event variants seen on external Tempo marketplaces.
// These keep indexing resilient when contracts use alternate signatures.
export const MARKETPLACE_COMPAT_EVENT_ABI = [
  {
    name: "Listed",
    type: "event",
    inputs: [
      { name: "nft", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "seller", type: "address", indexed: false },
      { name: "price", type: "uint256", indexed: false },
    ],
  },
  {
    name: "Listed",
    type: "event",
    inputs: [
      { name: "seller", type: "address", indexed: true },
      { name: "nft", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "price", type: "uint256", indexed: false },
    ],
  },
  {
    name: "Sale",
    type: "event",
    inputs: [
      { name: "nft", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "seller", type: "address", indexed: false },
      { name: "buyer", type: "address", indexed: false },
      { name: "price", type: "uint256", indexed: false },
    ],
  },
  {
    name: "Sale",
    type: "event",
    inputs: [
      { name: "seller", type: "address", indexed: true },
      { name: "buyer", type: "address", indexed: true },
      { name: "nft", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: false },
      { name: "price", type: "uint256", indexed: false },
    ],
  },
  {
    name: "OfferMade",
    type: "event",
    inputs: [
      { name: "nft", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "offerer", type: "address", indexed: false },
      { name: "price", type: "uint256", indexed: false },
      { name: "expiry", type: "uint256", indexed: false },
    ],
  },
  {
    name: "OfferMade",
    type: "event",
    inputs: [
      { name: "offerer", type: "address", indexed: true },
      { name: "nft", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "price", type: "uint256", indexed: false },
      { name: "expiry", type: "uint256", indexed: false },
    ],
  },
];

export const LAUNCHPAD_ABI = [
  {
    name: "creatorUpdatePhase",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "collection", type: "address" },
      { name: "phaseId", type: "uint256" },
      { name: "name_", type: "string" },
      { name: "startTime_", type: "uint64" },
      { name: "endTime_", type: "uint64" },
      { name: "price_", type: "uint256" },
      { name: "maxPerWallet_", type: "uint32" },
      { name: "phaseSupply_", type: "uint32" },
      { name: "merkleRoot_", type: "bytes32" },
      { name: "isPublic_", type: "bool" },
      { name: "active_", type: "bool" },
    ],
    outputs: [],
  },
  {
    name: "collectionCreator",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "getCreatorCollections",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "creator", type: "address" }],
    outputs: [{ name: "", type: "address[]" }],
  },
  {
    name: "isLaunchpadCollection",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
];
