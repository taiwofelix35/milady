import { useEffect, useState } from "react";

export interface MarketplaceCollection {
  slug: string;
  name: string;
  description: string;
  nftContract: `0x${string}`;
  marketContract: `0x${string}`;
  supply: number;
  coverImage: string;
  imageUrlTemplate: string;
  imageExtension: string;
  startTokenId?: number;
  explorer: string;
  twitter?: string;
  metadataBase?: string;
}

interface StoredDynamicCollection {
  nftContract: `0x${string}`;
  marketContract: `0x${string}`;
  name?: string;
  description?: string;
  supply?: number;
  coverImage?: string;
  imageUrlTemplate?: string;
  imageExtension?: string;
  startTokenId?: number;
  explorer?: string;
}

const DYNAMIC_COLLECTIONS_STORAGE_KEY = "milady:dynamic-collections:v1";
const COLLECTIONS_UPDATED_EVENT = "milady:collections-updated";
const EVM_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
const DEFAULT_MARKET_CONTRACT = (
  process.env.NEXT_PUBLIC_MARKETPLACE_CONTRACT ?? "0x0000000000000000000000000000000000000000"
) as `0x${string}`;
const DEFAULT_PRIMARY_NFT_CONTRACT = (
  process.env.NEXT_PUBLIC_NFT_CONTRACT ?? "0x16787D83DaE7A50BE671b44e06342d57cC017a9a"
) as `0x${string}`;

export const COLLECTIONS: MarketplaceCollection[] = [
  {
    slug: "tempo-milady",
    name: "Tempo Milady",
    description: "3,333 generative neochibi pfp NFTs on Tempo chain.",
    nftContract: DEFAULT_PRIMARY_NFT_CONTRACT,
    marketContract: DEFAULT_MARKET_CONTRACT,
    supply: 3333,
    coverImage:
      "https://i2c.seadn.io/ethereum/0x5af0d9827e0c53e4799bb226655a1de152a425a5/66c805b911d22f68585de94620ac6c/1e66c805b911d22f68585de94620ac6c.png",
    imageUrlTemplate: "https://www.stablewhel.xyz/api/milady/{id}.png",
    imageExtension: "png",
    startTokenId: 1,
    explorer: `https://explore.tempo.xyz/address/${DEFAULT_PRIMARY_NFT_CONTRACT}`,
    twitter: "https://x.com/TempoMilady",
    metadataBase: "https://arweave.net/HcEvrLaaw7hOedXEiPf0ghjUX5yWup6hK_rltHm7mFU",
  },
  {
    slug: "punk-on-tempo",
    name: "Punk On Tempo",
    description: "CryptoPunks-inspired collection on Tempo chain.",
    nftContract: "0xf5084BACA3bDdf7efF5f7d25FAB8A1618b5a9ABc",
    marketContract: DEFAULT_MARKET_CONTRACT,
    supply: 3348,
    coverImage: "https://gateway.irys.xyz/8UaAsH44pJ3b7GN5PVk8j4ucRr273Efcum6p44m4E41F/0.png",
    imageUrlTemplate: "https://gateway.irys.xyz/8UaAsH44pJ3b7GN5PVk8j4ucRr273Efcum6p44m4E41F/{id}.png",
    imageExtension: "png",
    startTokenId: 0,
    explorer: "https://explore.tempo.xyz/address/0xf5084BACA3bDdf7efF5f7d25FAB8A1618b5a9ABc",
  },
  {
    slug: "stable-whale",
    name: "Stable Whale",
    description: "3,333 whales swimming across Tempo chain.",
    nftContract: "0x3e12fcb20ad532f653f2907d2ae511364e2ae696",
    marketContract: DEFAULT_MARKET_CONTRACT,
    supply: 3333,
    coverImage: "https://ipfs.io/ipfs/QmTqeCVVSkAN9HhUKb9rXAERLuSkDVEStPQpCgFLrbS2rE/1.png",
    imageUrlTemplate: "https://ipfs.io/ipfs/QmTqeCVVSkAN9HhUKb9rXAERLuSkDVEStPQpCgFLrbS2rE/{id}.png",
    imageExtension: "png",
    startTokenId: 1,
    explorer: "https://explore.tempo.xyz/address/0x3e12fcb20ad532f653f2907d2ae511364e2ae696",
  },
  {
    slug: "citcat",
    name: "Citcat",
    description: "3,000 cats taking over the city on Tempo chain.",
    nftContract: "0x0E3D1e74A49ba5b3F5c1E746d2bcaaB2dee8C62B",
    marketContract: DEFAULT_MARKET_CONTRACT,
    supply: 3000,
    coverImage: "https://ipfs.io/ipfs/bafybeihljpxlo467nzfksymuzaf6jt25mhqa47zy5rcbpk4lefcben3iza/1.png",
    imageUrlTemplate:
      "https://ipfs.io/ipfs/bafybeihljpxlo467nzfksymuzaf6jt25mhqa47zy5rcbpk4lefcben3iza/{id}.png",
    imageExtension: "png",
    startTokenId: 1,
    explorer: "https://explore.tempo.xyz/address/0x0E3D1e74A49ba5b3F5c1E746d2bcaaB2dee8C62B",
  },
  {
    slug: "temponyaw",
    name: "TempoNyaw",
    description: "2,000 creatures from the Tempo multiverse.",
    nftContract: "0x1Ee82CC5946EdBD88eaf90D6d3c2B5baA4f9966C",
    marketContract: DEFAULT_MARKET_CONTRACT,
    supply: 2000,
    coverImage:
      "https://gateway.lighthouse.storage/ipfs/bafybeif7rmlug3oonqpivn5fqmeghhkglzlooy76hk5kpg4yrps6c6ruuu/1.png",
    imageUrlTemplate:
      "https://gateway.lighthouse.storage/ipfs/bafybeif7rmlug3oonqpivn5fqmeghhkglzlooy76hk5kpg4yrps6c6ruuu/{id}.png",
    imageExtension: "png",
    startTokenId: 1,
    explorer: "https://explore.tempo.xyz/address/0x1Ee82CC5946EdBD88eaf90D6d3c2B5baA4f9966C",
  },
  {
    slug: "tempo-baby",
    name: "Tempo Baby",
    description: "3,333 collectibles built for trait-maxi collectors.",
    nftContract: "0xaa660aaf454bd534298304535141588bbe5d7566",
    marketContract: DEFAULT_MARKET_CONTRACT,
    supply: 3333,
    coverImage: "https://gateway.irys.xyz/JP4Bs9Gwg958J_QPLX1B7HF0qoPAV_j2IISopCmNwFg/1.webp",
    imageUrlTemplate: "https://node1.irys.xyz/JP4Bs9Gwg958J_QPLX1B7HF0qoPAV_j2IISopCmNwFg/{id}.webp",
    imageExtension: "webp",
    startTokenId: 1,
    explorer: "https://explore.tempo.xyz/address/0xaa660aaf454bd534298304535141588bbe5d7566",
  },
  {
    slug: "totem-wild",
    name: "Totem Wild",
    description: "4,444 totemic creatures roaming the Tempo chain.",
    nftContract: "0xaf17A98575051D2D26f2C494CF11dB5420835908",
    marketContract: DEFAULT_MARKET_CONTRACT,
    supply: 4444,
    coverImage: "https://arweave.net/4CXLbx4dGGA4AUHil0FHmp5Q1WVPrmCfEhfuuagpc3U/1.webp",
    imageUrlTemplate: "https://arweave.net/4CXLbx4dGGA4AUHil0FHmp5Q1WVPrmCfEhfuuagpc3U/{id}.webp",
    imageExtension: "webp",
    startTokenId: 1,
    explorer: "https://explore.tempo.xyz/address/0xaf17A98575051D2D26f2C494CF11dB5420835908",
  },
  {
    slug: "fuds",
    name: "FUDS",
    description: "Pixel art NFT collection inspired by crypto fear, uncertainty, and doubt.",
    nftContract: "0x86F093B6aC61133F76aA36271FE9BA2f9CA56093",
    marketContract: DEFAULT_MARKET_CONTRACT,
    supply: 2222,
    coverImage:
      "https://azure-hollow-koi-794.mypinata.cloud/ipfs/bafybeigwgwp5si5wrgfxcejei7a3kjt53smonqwmyqtozxedpa5fcdh5sy",
    imageUrlTemplate:
      "https://fa4f5822295d6f0213552e471fbdcff4.ipfscdn.io/ipfs/bafybeicsutby52ukx7wggvrnr67o4yjbbnz32gctqijdia5q7ikh2hez4m/{id}.gif",
    imageExtension: "gif",
    startTokenId: 1,
    explorer: "https://explore.tempo.xyz/address/0x86F093B6aC61133F76aA36271FE9BA2f9CA56093",
  },
  {
    slug: "honorary-whel",
    name: "Honorary Whel",
    description: "Exclusive honorary collection for ecosystem partners.",
    nftContract: "0xF4658FbCB4a0221DABe3928EA6EA6A40edB475de",
    marketContract: DEFAULT_MARKET_CONTRACT,
    supply: 0,
    coverImage: "https://ipfs.io/ipfs/bafkreign53gaotnxakbki6mkpzc7lngcbzy5frgvsup7v7gqsg2ol4mmzu",
    imageUrlTemplate: "https://ipfs.io/ipfs/bafkreign53gaotnxakbki6mkpzc7lngcbzy5frgvsup7v7gqsg2ol4mmzu/{id}.png",
    imageExtension: "png",
    startTokenId: 1,
    explorer: "https://explore.tempo.xyz/address/0xF4658FbCB4a0221DABe3928EA6EA6A40edB475de",
  },
  {
    slug: "metronome",
    name: "Metronome",
    description:
      "5,555 keepers of the hour, hand-drawn on Tempo. The metronome ticks. The sand falls. The Mochi smiles.",
    nftContract: "0x0f31E02C2b60F4926236ABd33c2cd68BEe454B9A",
    marketContract: DEFAULT_MARKET_CONTRACT,
    supply: 5555,
    coverImage:
      "https://fa4f5822295d6f0213552e471fbdcff4.ipfscdn.io/ipfs/bafybeids4ljfrqek3ku4jqwenkmhgosbtzt3sthi7gmhsb46z2blcdjhxi/1468.png",
    imageUrlTemplate:
      "https://fa4f5822295d6f0213552e471fbdcff4.ipfscdn.io/ipfs/bafybeids4ljfrqek3ku4jqwenkmhgosbtzt3sthi7gmhsb46z2blcdjhxi/{id}.png",
    imageExtension: "png",
    startTokenId: 1,
    explorer: "https://explore.tempo.xyz/address/0x0f31E02C2b60F4926236ABd33c2cd68BEe454B9A",
  },
  {
    slug: "farmcats",
    name: "FarmCats",
    description: "10,000 unique pixel cats on Tempo. Stake to earn $MEOW.",
    nftContract: "0x7702Cd58a25D718755029aad00dbC92999dea65e",
    marketContract: DEFAULT_MARKET_CONTRACT,
    supply: 10000,
    coverImage:
      "https://gateway.lighthouse.storage/ipfs/bafybeidsnvp47dxgox7hui3tzjbm232wan7ilpateqsj25s6jhzxrj64bm/129.png",
    imageUrlTemplate:
      "https://gateway.lighthouse.storage/ipfs/bafybeidsnvp47dxgox7hui3tzjbm232wan7ilpateqsj25s6jhzxrj64bm/{id}.png",
    imageExtension: "png",
    startTokenId: 1,
    explorer: "https://explore.tempo.xyz/address/0x7702Cd58a25D718755029aad00dbC92999dea65e",
  },
];

export const PRIMARY_COLLECTION = COLLECTIONS[0];

function defaultExplorerForCollection(nftContract: string) {
  return `https://explore.tempo.xyz/address/${nftContract}`;
}

function normalizeDynamicCollection(input: StoredDynamicCollection): MarketplaceCollection {
  const nftLower = input.nftContract.toLowerCase();
  const short = nftLower.slice(2, 10);
  const slug = `launchpad-${short}`;
  return {
    slug,
    name: input.name?.trim() || `Launchpad ${input.nftContract.slice(0, 6)}...${input.nftContract.slice(-4)}`,
    description: input.description?.trim() || "Launchpad deployed collection.",
    nftContract: input.nftContract,
    marketContract: input.marketContract,
    supply: Math.max(0, Number(input.supply ?? 0)),
    coverImage: input.coverImage || "/placeholder.svg",
    imageUrlTemplate: input.imageUrlTemplate || "/placeholder.svg",
    imageExtension: input.imageExtension || "png",
    startTokenId: input.startTokenId ?? 1,
    explorer: input.explorer || defaultExplorerForCollection(input.nftContract),
  };
}

function isValidEvmAddress(value: unknown): value is `0x${string}` {
  return typeof value === "string" && EVM_ADDRESS_REGEX.test(value);
}

function loadDynamicCollections(): MarketplaceCollection[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DYNAMIC_COLLECTIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredDynamicCollection[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => isValidEvmAddress(item?.nftContract) && isValidEvmAddress(item?.marketContract))
      .map(normalizeDynamicCollection);
  } catch {
    return [];
  }
}

function saveDynamicCollections(collections: StoredDynamicCollection[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DYNAMIC_COLLECTIONS_STORAGE_KEY, JSON.stringify(collections));
  window.dispatchEvent(new Event(COLLECTIONS_UPDATED_EVENT));
}

function subscribeTrackedCollections(onChange: () => void) {
  if (typeof window === "undefined") return () => {};

  const handleStorage = (event: StorageEvent) => {
    if (event.key === DYNAMIC_COLLECTIONS_STORAGE_KEY) {
      onChange();
    }
  };

  window.addEventListener(COLLECTIONS_UPDATED_EVENT, onChange);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(COLLECTIONS_UPDATED_EVENT, onChange);
    window.removeEventListener("storage", handleStorage);
  };
}

export function upsertDynamicCollections(options: {
  collections: Array<{
    nftContract: `0x${string}`;
    marketContract: `0x${string}`;
    name?: string;
    description?: string;
    supply?: number;
    coverImage?: string;
    imageUrlTemplate?: string;
    imageExtension?: string;
    startTokenId?: number;
    explorer?: string;
  }>;
}) {
  if (typeof window === "undefined") return;
  const existingRaw = (() => {
    try {
      const raw = window.localStorage.getItem(DYNAMIC_COLLECTIONS_STORAGE_KEY);
      if (!raw) return [] as StoredDynamicCollection[];
      const parsed = JSON.parse(raw) as StoredDynamicCollection[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [] as StoredDynamicCollection[];
    }
  })();

  const validExisting = existingRaw.filter(
    (item) => isValidEvmAddress(item?.nftContract) && isValidEvmAddress(item?.marketContract)
  );
  const byNft = new Map(validExisting.map((item) => [item.nftContract.toLowerCase(), item]));

  for (const collection of options.collections) {
    if (!isValidEvmAddress(collection.nftContract) || !isValidEvmAddress(collection.marketContract)) {
      continue;
    }
    const key = collection.nftContract.toLowerCase();
    const prev = byNft.get(key);
    byNft.set(key, {
      nftContract: collection.nftContract,
      marketContract: collection.marketContract,
      name: collection.name ?? prev?.name,
      description: collection.description ?? prev?.description,
      supply: collection.supply ?? prev?.supply ?? 0,
      coverImage: collection.coverImage ?? prev?.coverImage,
      imageUrlTemplate: collection.imageUrlTemplate ?? prev?.imageUrlTemplate,
      imageExtension: collection.imageExtension ?? prev?.imageExtension,
      startTokenId: collection.startTokenId ?? prev?.startTokenId ?? 1,
      explorer:
        collection.explorer ??
        prev?.explorer ??
        defaultExplorerForCollection(collection.nftContract),
    });
  }

  saveDynamicCollections(Array.from(byNft.values()));
}

export function getTrackedCollections(): MarketplaceCollection[] {
  const dynamic = loadDynamicCollections();
  const dynamicByNft = new Map(dynamic.map((collection) => [collection.nftContract.toLowerCase(), collection]));

  const merged = COLLECTIONS.map((collection) => {
    const dynamicMatch = dynamicByNft.get(collection.nftContract.toLowerCase());
    if (!dynamicMatch) return collection;

    return {
      ...collection,
      marketContract: dynamicMatch.marketContract,
      name: dynamicMatch.name,
      description: dynamicMatch.description,
      supply: dynamicMatch.supply,
      coverImage: dynamicMatch.coverImage,
      imageUrlTemplate: dynamicMatch.imageUrlTemplate,
      imageExtension: dynamicMatch.imageExtension,
      startTokenId: dynamicMatch.startTokenId,
      explorer: dynamicMatch.explorer,
    };
  });

  const existingByNft = new Set(merged.map((collection) => collection.nftContract.toLowerCase()));
  for (const collection of dynamic) {
    if (existingByNft.has(collection.nftContract.toLowerCase())) continue;
    merged.push(collection);
  }

  return merged;
}

export function useTrackedCollections() {
  const [collections, setCollections] = useState<MarketplaceCollection[]>(() => getTrackedCollections());

  useEffect(() => {
    const refresh = () => {
      setCollections(getTrackedCollections());
    };

    refresh();
    return subscribeTrackedCollections(refresh);
  }, []);

  return collections;
}

export function getCollectionBySlug(slug: string) {
  return getTrackedCollections().find((collection) => collection.slug === slug) ?? null;
}

export function getCollectionByNftContract(nftContract: string) {
  return (
    getTrackedCollections().find(
      (collection) => collection.nftContract.toLowerCase() === nftContract.toLowerCase()
    ) ?? null
  );
}

export function tokenImageFromTemplate(collection: MarketplaceCollection, tokenId: bigint | number) {
  return collection.imageUrlTemplate.replace("{id}", String(tokenId));
}