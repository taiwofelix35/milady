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

// MiladyMarketplace ABI (Remix deployed)
export const MILADY_MARKETPLACE_ABI = [
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
    name: "feeBps",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "createListing",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "nft", type: "address" },
      { name: "tokenId", type: "uint256" },
      { name: "price", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "cancelListing",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "nft", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "buyListing",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "nft", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "makeOffer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "nft", type: "address" },
      { name: "tokenId", type: "uint256" },
      { name: "price", type: "uint256" },
      { name: "duration", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "cancelOffer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "nft", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "acceptOffer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "nft", type: "address" },
      { name: "tokenId", type: "uint256" },
      { name: "offerer", type: "address" },
    ],
    outputs: [],
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
] as const;

// MiladyMarketplaceV2 (Seaport-lite) ABI – OpenSea-style order lifecycle
export const MILADY_MARKETPLACE_V2_ABI = [
  {
    name: "name",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "contractName", type: "string" }],
  },
  {
    name: "information",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "version", type: "string" },
      { name: "domainSeparator", type: "bytes32" },
      { name: "conduitController", type: "address" },
    ],
  },
  {
    name: "getCounter",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "offerer", type: "address" }],
    outputs: [{ name: "counter", type: "uint256" }],
  },
  {
    name: "incrementCounter",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [{ name: "newCounter", type: "uint256" }],
  },
  {
    name: "getOrderHash",
    type: "function",
    stateMutability: "view",
    inputs: [
      {
        name: "order",
        type: "tuple",
        components: [
          { name: "offerer", type: "address" },
          {
            name: "offer",
            type: "tuple[]",
            components: [
              { name: "itemType", type: "uint8" },
              { name: "token", type: "address" },
              { name: "identifier", type: "uint256" },
              { name: "amount", type: "uint256" },
            ],
          },
          {
            name: "consideration",
            type: "tuple[]",
            components: [
              { name: "itemType", type: "uint8" },
              { name: "token", type: "address" },
              { name: "identifier", type: "uint256" },
              { name: "amount", type: "uint256" },
              { name: "recipient", type: "address" },
            ],
          },
          { name: "startTime", type: "uint256" },
          { name: "endTime", type: "uint256" },
          { name: "salt", type: "uint256" },
          { name: "counter", type: "uint256" },
        ],
      },
    ],
    outputs: [{ name: "orderHash", type: "bytes32" }],
  },
  {
    name: "getOrderStatus",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "orderHash", type: "bytes32" }],
    outputs: [
      { name: "isValidated", type: "bool" },
      { name: "isCancelled", type: "bool" },
      { name: "totalFilled", type: "uint256" },
      { name: "totalSize", type: "uint256" },
    ],
  },
  {
    name: "cancel",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "orders",
        type: "tuple[]",
        components: [
          { name: "offerer", type: "address" },
          {
            name: "offer",
            type: "tuple[]",
            components: [
              { name: "itemType", type: "uint8" },
              { name: "token", type: "address" },
              { name: "identifier", type: "uint256" },
              { name: "amount", type: "uint256" },
            ],
          },
          {
            name: "consideration",
            type: "tuple[]",
            components: [
              { name: "itemType", type: "uint8" },
              { name: "token", type: "address" },
              { name: "identifier", type: "uint256" },
              { name: "amount", type: "uint256" },
              { name: "recipient", type: "address" },
            ],
          },
          { name: "startTime", type: "uint256" },
          { name: "endTime", type: "uint256" },
          { name: "salt", type: "uint256" },
          { name: "counter", type: "uint256" },
        ],
      },
    ],
    outputs: [{ name: "cancelled", type: "bool" }],
  },
] as const;

// Launchpad ABI (Remix deployed) – common functions used by frontend/admin screens
export const MILADY_LAUNCHPAD_ABI = [
  {
    name: "deployCollection",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "name_", type: "string" },
      { name: "symbol_", type: "string" },
      { name: "maxSupply_", type: "uint256" },
      { name: "prerevealURI_", type: "string" },
      { name: "contractURI_", type: "string" },
      { name: "payoutRecipient_", type: "address" },
    ],
    outputs: [{ name: "collection", type: "address" }],
  },
  {
    name: "getCreatorCollections",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "creator", type: "address" }],
    outputs: [{ name: "", type: "address[]" }],
  },
  {
    name: "registerCollectionToMarketplace",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "collection", type: "address" }],
    outputs: [],
  },
  {
    name: "creatorCreatePhase",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "collection", type: "address" },
      { name: "phaseName", type: "string" },
      { name: "startTime", type: "uint64" },
      { name: "endTime", type: "uint64" },
      { name: "price", type: "uint256" },
      { name: "maxPerWallet", type: "uint32" },
      { name: "phaseSupply", type: "uint32" },
      { name: "merkleRoot", type: "bytes32" },
      { name: "isPublic", type: "bool" },
    ],
    outputs: [],
  },
  {
    name: "creatorReserveMint",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "collection", type: "address" },
      { name: "to", type: "address" },
      { name: "quantity", type: "uint256" },
    ],
    outputs: [],
  },
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
    name: "creatorSetBaseURI",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "collection", type: "address" },
      { name: "uri", type: "string" },
    ],
    outputs: [],
  },
  {
    name: "creatorSetContractURI",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "collection", type: "address" },
      { name: "contractURI_", type: "string" },
    ],
    outputs: [],
  },
  {
    name: "creatorSetPrerevealURI",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "collection", type: "address" },
      { name: "prerevealURI_", type: "string" },
    ],
    outputs: [],
  },
  {
    name: "creatorSetRevealed",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "collection", type: "address" },
      { name: "status", type: "bool" },
    ],
    outputs: [],
  },
  {
    name: "pauseLaunch",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "collection", type: "address" },
      { name: "paused", type: "bool" },
    ],
    outputs: [],
  },
  {
    name: "setMarketplace",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "marketplace_", type: "address" }],
    outputs: [],
  },
  {
    name: "updatePayoutRecipient",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "collection", type: "address" },
      { name: "newRecipient", type: "address" },
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
    name: "isLaunchpadCollection",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "marketplace",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "owner",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "paymentToken",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "creatorWithdraw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "collection", type: "address" }],
    outputs: [],
  },
  {
    name: "CollectionDeployed",
    type: "event",
    inputs: [
      { indexed: true, name: "creator", type: "address" },
      { indexed: true, name: "collection", type: "address" },
      { indexed: false, name: "name", type: "string" },
      { indexed: false, name: "symbol", type: "string" },
    ],
  },
  {
    name: "CollectionRegistered",
    type: "event",
    inputs: [{ indexed: true, name: "collection", type: "address" }],
  },
  {
    name: "MarketplaceSet",
    type: "event",
    inputs: [{ indexed: true, name: "marketplace", type: "address" }],
  },
] as const;

// Deployed launchpad collection ABI subset used by public mint page.
export const MILADY_LAUNCHPAD_COLLECTION_ABI = [
  {
    name: "name",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "maxSupply",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "paymentToken",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "contractURI",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "tokenURI",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "phaseCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "phases",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "name", type: "string" },
      { name: "startTime", type: "uint64" },
      { name: "endTime", type: "uint64" },
      { name: "price", type: "uint256" },
      { name: "maxPerWallet", type: "uint32" },
      { name: "phaseSupply", type: "uint32" },
      { name: "minted", type: "uint32" },
      { name: "merkleRoot", type: "bytes32" },
      { name: "isPublic", type: "bool" },
      { name: "active", type: "bool" },
    ],
  },
  {
    name: "mint",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "phaseId", type: "uint256" },
      { name: "quantity", type: "uint256" },
      { name: "proof", type: "bytes32[]" },
    ],
    outputs: [],
  },
  {
    name: "mintedPerWallet",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "", type: "uint256" },
      { name: "", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export const ERC20_ABI = [
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
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
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;
