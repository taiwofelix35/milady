// MiladyNFT ABI – only the functions used by the frontend
export const MILADY_NFT_ABI = [
  // Read
  {
    name: "ownerOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "tokenURI",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "totalSupply",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "tokenOfOwnerByIndex",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "index", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "isApprovedForAll",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "operator", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "getApproved",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "mintPrice",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "name",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "royaltyInfo",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "salePrice", type: "uint256" },
    ],
    outputs: [
      { name: "receiver", type: "address" },
      { name: "royaltyAmount", type: "uint256" },
    ],
  },
  // Write
  {
    name: "mint",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "to", type: "address" },
      { name: "uri", type: "string" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "setApprovalForAll",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "operator", type: "address" },
      { name: "approved", type: "bool" },
    ],
    outputs: [],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

// MiladyMarketplace ABI – only the functions used by the frontend
export const MILADY_MARKETPLACE_ABI = [
  // Read
  {
    name: "listings",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [
      { name: "seller", type: "address" },
      { name: "nftContract", type: "address" },
      { name: "tokenId", type: "uint256" },
      { name: "price", type: "uint256" },
      { name: "paymentToken", type: "address" },
      { name: "expiry", type: "uint256" },
      { name: "active", type: "bool" },
    ],
  },
  {
    name: "offers",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [
      { name: "buyer", type: "address" },
      { name: "nftContract", type: "address" },
      { name: "tokenId", type: "uint256" },
      { name: "amount", type: "uint256" },
      { name: "paymentToken", type: "address" },
      { name: "expiry", type: "uint256" },
      { name: "active", type: "bool" },
    ],
  },
  {
    name: "feeBps",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  // Write
  {
    name: "list",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "nftContract", type: "address" },
      { name: "tokenId", type: "uint256" },
      { name: "price", type: "uint256" },
      { name: "paymentToken", type: "address" },
      { name: "expiry", type: "uint256" },
    ],
    outputs: [{ name: "listingId", type: "bytes32" }],
  },
  {
    name: "cancelListing",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "listingId", type: "bytes32" }],
    outputs: [],
  },
  {
    name: "buy",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "listingId", type: "bytes32" }],
    outputs: [],
  },
  {
    name: "makeOffer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "nftContract", type: "address" },
      { name: "tokenId", type: "uint256" },
      { name: "amount", type: "uint256" },
      { name: "paymentToken", type: "address" },
      { name: "expiry", type: "uint256" },
    ],
    outputs: [{ name: "offerId", type: "bytes32" }],
  },
  {
    name: "cancelOffer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "offerId", type: "bytes32" }],
    outputs: [],
  },
  {
    name: "acceptOffer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "offerId", type: "bytes32" }],
    outputs: [],
  },
  // Events
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
  {
    name: "OfferAccepted",
    type: "event",
    inputs: [
      { name: "offerId", type: "bytes32", indexed: true },
      { name: "seller", type: "address", indexed: true },
      { name: "buyer", type: "address", indexed: true },
      { name: "nftContract", type: "address", indexed: false },
      { name: "tokenId", type: "uint256", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
      { name: "paymentToken", type: "address", indexed: false },
    ],
  },
  {
    name: "OfferCancelled",
    type: "event",
    inputs: [
      { name: "offerId", type: "bytes32", indexed: true },
    ],
  },
  {
    name: "ListingCancelled",
    type: "event",
    inputs: [
      { name: "listingId", type: "bytes32", indexed: true },
    ],
  },
] as const;
