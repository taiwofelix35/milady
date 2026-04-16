const EXPLICIT_BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "") ?? null;
const FALLBACK_BACKEND_URLS = [4000, 4001, 4002, 4003, 4004, 4005].map(
  (port) => `http://localhost:${port}`
);

let resolvedBackendUrlPromise: Promise<string | null> | null = null;
const EVM_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
const BACKEND_FETCH_RETRY_ATTEMPTS = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetryStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function isValidEvmAddress(value: unknown): value is `0x${string}` {
  return typeof value === "string" && EVM_ADDRESS_REGEX.test(value);
}

export interface BackendListing {
  seller: `0x${string}`;
  price: bigint;
  active: boolean;
  source?: string | null;
  sourceLabel?: string | null;
  marketplace?: `0x${string}` | null;
}

export interface BackendCollectionStats {
  nft: `0x${string}`;
  scanned: number;
  activeListings: number;
  floorPrice: bigint | null;
  totalSales: number;
  totalVolume: bigint;
}

export interface BackendActivityEvent {
  type: "ItemListed" | "ItemSold" | "OfferMade" | "ItemCancelled";
  source?: string;
  sourceLabel?: string;
  marketplace?: `0x${string}`;
  nft?: `0x${string}` | null;
  tokenId?: string;
  blockNumber: string | null;
  transactionHash: `0x${string}` | null;
  seller?: `0x${string}`;
  buyer?: `0x${string}`;
  offerer?: `0x${string}`;
  price?: string;
  expiry?: string;
}

export interface BackendMarketplaceActivityPage {
  events: BackendActivityEvent[];
  count: number;
  total: number;
  limit: number;
  offset: number;
  hasNext: boolean;
}

export interface BackendActiveOfferEvent {
  type: "OfferMade";
  source?: string;
  sourceLabel?: string;
  marketplace?: `0x${string}`;
  nft?: `0x${string}` | null;
  tokenId?: string;
  offerer?: `0x${string}`;
  price?: string;
  expiry?: string;
  blockNumber: string | null;
  transactionHash: `0x${string}` | null;
}

export interface BackendActiveOffersPage {
  offers: BackendActiveOfferEvent[];
  count: number;
  total: number;
  limit: number;
  offset: number;
  hasNext: boolean;
}

export interface BackendSearchListing {
  nft: `0x${string}`;
  tokenId: string;
  seller: `0x${string}`;
  price: string;
  active: boolean;
  source?: string | null;
  sourceLabel?: string | null;
  marketplace?: `0x${string}` | null;
  inferred?: boolean;
}

export interface BackendMarketplaceSearchResponse {
  query: string;
  queryType: "tx" | "address" | "token" | "text";
  fromBlock: string;
  limit: number;
  offset: number;
  count: number;
  totalEvents: number;
  hasNext: boolean;
  events: BackendActivityEvent[];
  listings: BackendSearchListing[];
}

export interface BackendActiveListingsPage {
  nft: `0x${string}`;
  scanned: number;
  sort: "price-asc" | "price-desc" | "token-asc" | "token-desc";
  offset: number;
  limit: number;
  count: number;
  total: number;
  hasNext: boolean;
  listings: Array<{
    tokenId: string;
    seller: `0x${string}`;
    price: string;
    active: boolean;
    source?: string | null;
    sourceLabel?: string | null;
    marketplace?: `0x${string}` | null;
  }>;
}

export interface BackendRarityTokenRow {
  tokenId: string;
  rank: number | null;
  score: number | null;
}

export interface BackendRarityRanksResponse {
  metadataBase: string;
  supply: number;
  startTokenId: number;
  scanCount: number;
  sampledTokens: number;
  rankedTokens: number;
  results: BackendRarityTokenRow[];
}

export interface BackendCollectionHolderRow {
  address: `0x${string}`;
  balance: number;
  share: number;
}

export interface BackendCollectionHoldersResponse {
  nft: `0x${string}`;
  supply: number;
  startTokenId: number;
  scanCount: number;
  resolvedOwners: number;
  totalHolders: number;
  offset: number;
  limit: number;
  count: number;
  hasNext: boolean;
  holders: BackendCollectionHolderRow[];
}

const SYNTHETIC_TX_HASH = `0x${"0".repeat(64)}` as const;

function mapListingsToActivityEvents(
  listings:
    | BackendActiveListingsPage["listings"]
    | Array<{ tokenId: bigint; listing: BackendListing }>,
  nftContract?: `0x${string}`
): BackendActivityEvent[] {
  return listings.map((row) => {
    if ("listing" in row) {
      return {
        type: "ItemListed" as const,
        source: row.listing.source ?? undefined,
        sourceLabel: row.listing.sourceLabel ?? undefined,
        marketplace: row.listing.marketplace ?? undefined,
        nft: nftContract ?? null,
        tokenId: row.tokenId.toString(),
        blockNumber: null,
        transactionHash: SYNTHETIC_TX_HASH,
        seller: row.listing.seller,
        price: row.listing.price.toString(),
      };
    }

    return {
      type: "ItemListed" as const,
      source: row.source ?? undefined,
      sourceLabel: row.sourceLabel ?? undefined,
      marketplace: row.marketplace ?? undefined,
      nft: nftContract ?? null,
      tokenId: row.tokenId,
      blockNumber: null,
      transactionHash: SYNTHETIC_TX_HASH,
      seller: row.seller,
      price: row.price,
    };
  });
}

export interface BackendAllowlist {
  collection: `0x${string}`;
  phaseId: string;
  addresses: `0x${string}`[];
  merkleRoot: `0x${string}`;
  proofsByAddress: Record<string, `0x${string}`[]>;
  count: number;
  updatedAt: string | null;
}

export interface BackendSyncPayload {
  launchpadContract: `0x${string}` | null;
  functionName: "creatorSetPhaseMerkleRoot";
  args: [
    `0x${string}`,
    string,
    `0x${string}`,
  ];
  calldata: `0x${string}`;
  merkleRoot: `0x${string}`;
  count: number;
  updatedAt: string | null;
}

export interface BackendUpdatePhaseSyncPayload {
  launchpadContract: `0x${string}` | null;
  functionName: "creatorUpdatePhase";
  args: [
    `0x${string}`,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    `0x${string}`,
    boolean,
    boolean,
  ];
  calldata: `0x${string}`;
  merkleRoot: `0x${string}`;
  count: number;
  updatedAt: string | null;
}

export interface BackendPublishedCollection {
  nftContract: `0x${string}`;
  marketContract: `0x${string}`;
  name: string;
  description: string;
  supply: number;
  coverImage?: string;
  imageUrlTemplate?: string;
  imageExtension?: string;
  startTokenId?: number;
  explorer?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BackendLaunchpadProject {
  creator: `0x${string}`;
  collection: `0x${string}`;
  payoutRecipient: `0x${string}` | null;
  active: boolean | null;
  registeredToMarketplace: boolean;
  platformFeeBps: string | null;
  createdAt: string | null;
  warning?: string;
}

async function fetchJson<T>(path: string): Promise<T> {
  let backendUrl = await getBackendUrl();
  if (!backendUrl) {
    backendUrl = await getBackendUrl(true);
    if (!backendUrl) {
      throw new Error("No reachable backend URL found. Set NEXT_PUBLIC_BACKEND_URL or start backend on localhost:4000-4005.");
    }
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < BACKEND_FETCH_RETRY_ATTEMPTS; attempt += 1) {
    try {
      const res = await fetch(`${backendUrl}${path}`, { cache: "no-store" });
      if (res.ok) {
        return (await res.json()) as T;
      }

      const retryable = shouldRetryStatus(res.status);
      if (!retryable || attempt === BACKEND_FETCH_RETRY_ATTEMPTS - 1) {
        throw new Error(`Backend request failed: ${res.status} ${res.statusText}`);
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt === BACKEND_FETCH_RETRY_ATTEMPTS - 1) {
        break;
      }
    }

    resolvedBackendUrlPromise = detectBackendUrl();
    backendUrl = await resolvedBackendUrlPromise;
    if (!backendUrl) {
      break;
    }

    await sleep(200 * (attempt + 1));
  }

  throw (
    lastError ??
    new Error("No reachable backend URL found. Set NEXT_PUBLIC_BACKEND_URL or start backend on localhost:4000-4005.")
  );
}

async function detectBackendUrl(): Promise<string | null> {
  const candidates = EXPLICIT_BACKEND_URL
    ? [EXPLICIT_BACKEND_URL, ...FALLBACK_BACKEND_URLS.filter((url) => url !== EXPLICIT_BACKEND_URL)]
    : FALLBACK_BACKEND_URLS;

  for (const candidate of candidates) {
    try {
      const res = await fetch(`${candidate}/health`, { cache: "no-store" });
      if (res.ok) {
        return candidate;
      }
    } catch {
      // Try next candidate
    }
  }

  return null;
}

async function getBackendUrl(forceRefresh = false): Promise<string | null> {
  if (forceRefresh || !resolvedBackendUrlPromise) {
    resolvedBackendUrlPromise = detectBackendUrl();
  }

  const url = await resolvedBackendUrlPromise;
  if (!url) {
    // Allow future calls to retry detection instead of permanently caching null.
    resolvedBackendUrlPromise = null;
  }

  return url;
}

export async function fetchListingByToken(
  tokenId: bigint,
  nftContract?: `0x${string}`,
  marketContract?: `0x${string}`
): Promise<BackendListing | null> {
  try {
    const query = new URLSearchParams();
    if (nftContract && isValidEvmAddress(nftContract)) {
      query.set("nft", nftContract);
    }
    if (
      marketContract &&
      isValidEvmAddress(marketContract) &&
      marketContract.toLowerCase() !== "0x0000000000000000000000000000000000000000"
    ) {
      query.set("market", marketContract);
    }
    const queryString = query.toString();
    const data = await fetchJson<{ seller: `0x${string}`; price: string; active: boolean }>(
      `/marketplace/listing/${tokenId.toString()}${queryString ? `?${queryString}` : ""}`
    );

    return {
      seller: data.seller,
      price: BigInt(data.price),
      active: data.active,
      source: (data as { source?: string | null }).source ?? null,
      sourceLabel: (data as { sourceLabel?: string | null }).sourceLabel ?? null,
      marketplace: (data as { marketplace?: `0x${string}` | null }).marketplace ?? null,
    };
  } catch {
    return null;
  }
}

export async function fetchListingsByTokens(
  tokenIds: bigint[],
  nftContract?: `0x${string}`,
  marketContract?: `0x${string}`
): Promise<Map<string, BackendListing>> {
  if (tokenIds.length === 0) {
    return new Map();
  }

  const tokenIdsCsv = tokenIds.map((tokenId) => tokenId.toString()).join(",");
  try {
    const query = new URLSearchParams();
    if (nftContract && isValidEvmAddress(nftContract)) {
      query.set("nft", nftContract);
    }
    if (
      marketContract &&
      isValidEvmAddress(marketContract) &&
      marketContract.toLowerCase() !== "0x0000000000000000000000000000000000000000"
    ) {
      query.set("market", marketContract);
    }
    query.set("tokenIds", tokenIdsCsv);

    const data = await fetchJson<{
      listings: Array<{
        tokenId: string;
        seller: `0x${string}`;
        price: string;
        active: boolean;
        source?: string | null;
        sourceLabel?: string | null;
        marketplace?: `0x${string}` | null;
      }>;
    }>(`/marketplace/listings?${query.toString()}`);

    const listingMap = new Map<string, BackendListing>();
    for (const row of data.listings ?? []) {
      listingMap.set(row.tokenId, {
        seller: row.seller,
        price: BigInt(row.price),
        active: row.active,
        source: row.source ?? null,
        sourceLabel: row.sourceLabel ?? null,
        marketplace: row.marketplace ?? null,
      });
    }

    return listingMap;
  } catch {
    // Fallback to legacy per-token endpoint for compatibility.
  }

  const pairs = await Promise.all(
    tokenIds.map(async (tokenId) => {
      const listing = await fetchListingByToken(tokenId, nftContract, marketContract);
      return [tokenId.toString(), listing] as const;
    })
  );

  const listingMap = new Map<string, BackendListing>();
  for (const [tokenKey, listing] of pairs) {
    if (listing) {
      listingMap.set(tokenKey, listing);
    }
  }
  return listingMap;
}

export async function fetchActiveListingsPage(options: {
  nftContract: `0x${string}`;
  marketContract?: `0x${string}`;
  supply?: number;
  startTokenId?: number;
  scan?: number;
  limit?: number;
  offset?: number;
  sort?: "price-asc" | "price-desc" | "token-asc" | "token-desc";
}): Promise<{
  count: number;
  total: number;
  hasNext: boolean;
  listings: Array<{
    tokenId: bigint;
    listing: BackendListing;
  }>;
} | null> {
  if (!isValidEvmAddress(options.nftContract)) {
    return null;
  }
  try {
    const query = new URLSearchParams();
    query.set("nft", options.nftContract);
    if (options.marketContract && isValidEvmAddress(options.marketContract)) {
      query.set("market", options.marketContract);
    }
    if (options.supply !== undefined) {
      query.set("supply", String(Math.max(0, options.supply)));
    }
    if (options.startTokenId !== undefined) {
      query.set("startTokenId", String(Math.max(0, options.startTokenId)));
    }
    if (options.scan !== undefined) {
      query.set("scan", String(Math.max(1, options.scan)));
    }
    query.set("limit", String(Math.max(1, Math.min(300, options.limit ?? 120))));
    query.set("offset", String(Math.max(0, options.offset ?? 0)));
    query.set("sort", options.sort ?? "price-asc");

    const data = await fetchJson<BackendActiveListingsPage>(`/marketplace/active-listings?${query.toString()}`);

    return {
      count: data.count,
      total: data.total,
      hasNext: data.hasNext,
      listings: (data.listings ?? [])
        .filter((row) => row.active)
        .map((row) => ({
          tokenId: BigInt(row.tokenId),
          listing: {
            seller: row.seller,
            price: BigInt(row.price),
            active: true,
            source: row.source ?? null,
            sourceLabel: row.sourceLabel ?? null,
            marketplace: row.marketplace ?? null,
          },
        })),
    };
  } catch {
    return null;
  }
}

export async function fetchActivityByToken(
  tokenId: bigint,
  nftContract?: `0x${string}`
): Promise<BackendActivityEvent[]> {
  const nftQuery = nftContract && isValidEvmAddress(nftContract)
    ? `?nft=${encodeURIComponent(nftContract)}`
    : "";

  try {
    const data = await fetchJson<{ events: BackendActivityEvent[] }>(
      `/marketplace/activity/${tokenId.toString()}${nftQuery}`
    );
    return data.events ?? [];
  } catch {
    try {
      const fallback = await fetchJson<{ events: BackendActivityEvent[] }>(
        `/marketplace/activity?limit=250${nftQuery ? `&${nftQuery.slice(1)}` : ""}`
      );
      return (fallback.events ?? []).filter((event) => event.tokenId === tokenId.toString());
    } catch {
      return [];
    }
  }
}

export async function fetchMarketplaceActivity(
  limit = 100,
  nftContract?: `0x${string}`,
  options?: {
    supply?: number;
    startTokenId?: number;
  }
): Promise<BackendActivityEvent[]> {
  try {
    const nftParam = nftContract && isValidEvmAddress(nftContract)
      ? `&nft=${encodeURIComponent(nftContract)}`
      : "";
    const data = await fetchJson<{ events: BackendActivityEvent[] }>(
      `/marketplace/activity?limit=${limit}${nftParam}`
    );
    const events = data.events ?? [];
    if (!events.length && nftContract && isValidEvmAddress(nftContract)) {
      const listingsFallback = await fetchActiveListingsPage({
        nftContract,
        supply: options?.supply,
        startTokenId: options?.startTokenId,
        limit,
        offset: 0,
      });
      if (listingsFallback) {
        return mapListingsToActivityEvents(listingsFallback.listings, nftContract);
      }
    }
    return events;
  } catch {
    return [];
  }
}

export async function fetchMarketplaceActivityPage(
  options?: {
    limit?: number;
    offset?: number;
    nftContract?: `0x${string}`;
    eventType?: "ItemListed" | "ItemSold" | "OfferMade" | "ItemCancelled";
    supply?: number;
    startTokenId?: number;
  }
): Promise<BackendMarketplaceActivityPage> {
  const limit = Math.max(1, Math.min(500, options?.limit ?? 100));
  const offset = Math.max(0, options?.offset ?? 0);
  const nftParam = options?.nftContract && isValidEvmAddress(options.nftContract)
    ? `&nft=${encodeURIComponent(options.nftContract)}`
    : "";
  const typeParam = options?.eventType ? `&type=${encodeURIComponent(options.eventType)}` : "";
  const supplyParam = options?.supply !== undefined ? `&supply=${Math.max(0, options.supply)}` : "";
  const startTokenParam =
    options?.startTokenId !== undefined ? `&startTokenId=${Math.max(1, options.startTokenId)}` : "";

  try {
    const data = await fetchJson<{
      events: BackendActivityEvent[];
      count?: number;
      total?: number;
      limit?: number;
      offset?: number;
      hasNext?: boolean;
    }>(`/marketplace/activity?limit=${limit}&offset=${offset}${nftParam}${typeParam}${supplyParam}${startTokenParam}`);

    const events = data.events ?? [];
    if (!events.length && options?.nftContract && isValidEvmAddress(options.nftContract)) {
      const listingsFallback = await fetchActiveListingsPage({
        nftContract: options.nftContract,
        supply: options.supply,
        startTokenId: options.startTokenId,
        limit,
        offset,
      });
      if (!listingsFallback) {
        return {
          events: [],
          count: 0,
          total: 0,
          limit,
          offset,
          hasNext: false,
        };
      }
      const fallbackEvents = mapListingsToActivityEvents(
        listingsFallback.listings,
        options.nftContract
      );
      return {
        events: fallbackEvents,
        count: fallbackEvents.length,
        total: listingsFallback.total,
        limit,
        offset,
        hasNext: listingsFallback.hasNext,
      };
    }
    return {
      events,
      count: data.count ?? events.length,
      total: data.total ?? events.length,
      limit: data.limit ?? limit,
      offset: data.offset ?? offset,
      hasNext: data.hasNext ?? offset + events.length < (data.total ?? events.length),
    };
  } catch {
    if (options?.nftContract && isValidEvmAddress(options.nftContract)) {
      const listingsFallback = await fetchActiveListingsPage({
        nftContract: options.nftContract,
        supply: options.supply,
        startTokenId: options.startTokenId,
        limit,
        offset,
      });
      if (listingsFallback) {
        const fallbackEvents = mapListingsToActivityEvents(
          listingsFallback.listings,
          options.nftContract
        );
        return {
          events: fallbackEvents,
          count: fallbackEvents.length,
          total: listingsFallback.total,
          limit,
          offset,
          hasNext: listingsFallback.hasNext,
        };
      }
    }

    return {
      events: [],
      count: 0,
      total: 0,
      limit,
      offset,
      hasNext: false,
    };
  }
}

export async function fetchActiveOffersPage(options: {
  nftContract: `0x${string}`;
  limit?: number;
  offset?: number;
}): Promise<BackendActiveOffersPage> {
  if (!isValidEvmAddress(options.nftContract)) {
    return {
      offers: [],
      count: 0,
      total: 0,
      limit: Math.max(1, Math.min(200, options.limit ?? 50)),
      offset: Math.max(0, options.offset ?? 0),
      hasNext: false,
    };
  }

  const limit = Math.max(1, Math.min(200, options.limit ?? 50));
  const offset = Math.max(0, options.offset ?? 0);
  const query = new URLSearchParams({
    nft: options.nftContract,
    limit: String(limit),
    offset: String(offset),
  });

  try {
    const data = await fetchJson<BackendActiveOffersPage>(`/marketplace/active-offers?${query.toString()}`);
    return {
      offers: data.offers ?? [],
      count: data.count ?? 0,
      total: data.total ?? 0,
      limit: data.limit ?? limit,
      offset: data.offset ?? offset,
      hasNext: data.hasNext ?? false,
    };
  } catch {
    return {
      offers: [],
      count: 0,
      total: 0,
      limit,
      offset,
      hasNext: false,
    };
  }
}

export async function fetchMarketplaceSearch(options: {
  q: string;
  limit?: number;
  offset?: number;
  fromBlock?: string;
  nftContract?: `0x${string}`;
}): Promise<BackendMarketplaceSearchResponse | null> {
  const query = new URLSearchParams();
  query.set("q", options.q);
  if (options.limit !== undefined) {
    query.set("limit", String(Math.max(1, Math.min(200, options.limit))));
  }
  if (options.offset !== undefined) {
    query.set("offset", String(Math.max(0, options.offset)));
  }
  if (options.fromBlock) {
    query.set("fromBlock", options.fromBlock);
  }
  if (options.nftContract && isValidEvmAddress(options.nftContract)) {
    query.set("nft", options.nftContract);
  }

  try {
    return await fetchJson<BackendMarketplaceSearchResponse>(`/marketplace/search?${query.toString()}`);
  } catch {
    return null;
  }
}

export async function fetchCollectionStats(options: {
  nftContract: `0x${string}`;
  supply: number;
  startTokenId?: number;
  scan?: number;
  includeSales?: boolean;
}): Promise<BackendCollectionStats | null> {
  const { nftContract, supply, startTokenId = 1, scan = 300, includeSales = true } = options;
  if (!isValidEvmAddress(nftContract)) {
    return null;
  }
  try {
    const params = new URLSearchParams({
      nft: nftContract,
      supply: String(Math.max(0, supply)),
      startTokenId: String(Math.max(0, startTokenId)),
      scan: String(Math.max(1, scan)),
      includeSales: includeSales ? "1" : "0",
    });

    const data = await fetchJson<{
      nft: `0x${string}`;
      scanned: number;
      activeListings: number;
      floorPrice: string | null;
      totalSales: number;
      totalVolume: string;
    }>(`/marketplace/collection-stats?${params.toString()}`);

    return {
      nft: data.nft,
      scanned: data.scanned,
      activeListings: data.activeListings,
      floorPrice: data.floorPrice ? BigInt(data.floorPrice) : null,
      totalSales: data.totalSales,
      totalVolume: BigInt(data.totalVolume),
    };
  } catch {
    return null;
  }
}

export async function fetchRarityRanks(options: {
  metadataBase: string;
  supply: number;
  tokenIds: bigint[];
  startTokenId?: number;
  scan?: number;
}): Promise<{
  sampledTokens: number;
  rankedTokens: number;
  ranksByToken: Map<string, { rank: number; score: number }>;
} | null> {
  const metadataBase = options.metadataBase.trim();
  if (!metadataBase || options.supply <= 0 || options.tokenIds.length === 0) {
    return null;
  }

  const uniqueTokenIds = Array.from(new Set(options.tokenIds.map((tokenId) => tokenId.toString())));
  if (!uniqueTokenIds.length) {
    return null;
  }

  try {
    const query = new URLSearchParams();
    query.set("metadataBase", metadataBase);
    query.set("supply", String(Math.max(1, options.supply)));
    query.set("startTokenId", String(Math.max(0, options.startTokenId ?? 1)));
    if (options.scan !== undefined) {
      query.set("scan", String(Math.max(1, options.scan)));
    }
    query.set("tokenIds", uniqueTokenIds.join(","));

    const data = await fetchJson<BackendRarityRanksResponse>(`/marketplace/rarity/ranks?${query.toString()}`);
    const ranksByToken = new Map<string, { rank: number; score: number }>();
    for (const row of data.results ?? []) {
      if (typeof row.rank === "number" && typeof row.score === "number") {
        ranksByToken.set(row.tokenId, {
          rank: row.rank,
          score: row.score,
        });
      }
    }

    return {
      sampledTokens: data.sampledTokens ?? 0,
      rankedTokens: data.rankedTokens ?? 0,
      ranksByToken,
    };
  } catch {
    return null;
  }
}

export async function fetchCollectionHolders(options: {
  nftContract: `0x${string}`;
  supply: number;
  startTokenId?: number;
  scan?: number;
  limit?: number;
  offset?: number;
}): Promise<BackendCollectionHoldersResponse | null> {
  const { nftContract, supply, startTokenId = 1, scan = supply, limit = 200, offset = 0 } = options;
  if (!isValidEvmAddress(nftContract) || supply <= 0) {
    return null;
  }

  try {
    const query = new URLSearchParams();
    query.set("nft", nftContract);
    query.set("supply", String(Math.max(1, supply)));
    query.set("startTokenId", String(Math.max(0, startTokenId)));
    query.set("scan", String(Math.max(1, scan)));
    query.set("limit", String(Math.max(1, Math.min(500, limit))));
    query.set("offset", String(Math.max(0, offset)));

    return await fetchJson<BackendCollectionHoldersResponse>(`/marketplace/holders?${query.toString()}`);
  } catch {
    return null;
  }
}

export async function fetchAllowlist(collection: `0x${string}`, phaseId: string): Promise<BackendAllowlist | null> {
  try {
    return await fetchJson<BackendAllowlist>(`/wl/${collection}/${phaseId}`);
  } catch {
    return null;
  }
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const backendUrl = await getBackendUrl();
  if (!backendUrl) {
    throw new Error("No reachable backend URL found");
  }

  const res = await fetch(`${backendUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Backend POST failed: ${res.status} ${res.statusText}`);
  }

  return (await res.json()) as T;
}

export async function addAllowlistAddresses(
  collection: `0x${string}`,
  phaseId: string,
  addresses: string[]
): Promise<BackendAllowlist | null> {
  try {
    const response = await postJson<{ collection: `0x${string}`; phaseId: string; count: number; merkleRoot: `0x${string}`; updatedAt: string | null }>(
      `/wl/${collection}/${phaseId}/add`,
      { addresses }
    );
    return {
      collection: response.collection,
      phaseId: response.phaseId,
      addresses: [],
      merkleRoot: response.merkleRoot,
      proofsByAddress: {},
      count: response.count,
      updatedAt: response.updatedAt,
    };
  } catch {
    return null;
  }
}

export async function removeAllowlistAddresses(
  collection: `0x${string}`,
  phaseId: string,
  addresses: string[]
): Promise<BackendAllowlist | null> {
  try {
    const response = await postJson<{ collection: `0x${string}`; phaseId: string; count: number; merkleRoot: `0x${string}`; updatedAt: string | null }>(
      `/wl/${collection}/${phaseId}/remove`,
      { addresses }
    );
    return {
      collection: response.collection,
      phaseId: response.phaseId,
      addresses: [],
      merkleRoot: response.merkleRoot,
      proofsByAddress: {},
      count: response.count,
      updatedAt: response.updatedAt,
    };
  } catch {
    return null;
  }
}

export async function importAllowlistCsv(
  collection: `0x${string}`,
  phaseId: string,
  csv: string
): Promise<BackendAllowlist | null> {
  try {
    const response = await postJson<{ collection: `0x${string}`; phaseId: string; count: number; merkleRoot: `0x${string}`; updatedAt: string | null }>(
      `/wl/${collection}/${phaseId}/import-csv`,
      { csv }
    );
    return {
      collection: response.collection,
      phaseId: response.phaseId,
      addresses: [],
      merkleRoot: response.merkleRoot,
      proofsByAddress: {},
      count: response.count,
      updatedAt: response.updatedAt,
    };
  } catch {
    return null;
  }
}

export async function rebuildAllowlistTree(
  collection: `0x${string}`,
  phaseId: string
): Promise<BackendAllowlist | null> {
  try {
    const response = await postJson<{
      collection: `0x${string}`;
      phaseId: string;
      count: number;
      merkleRoot: `0x${string}`;
      updatedAt: string | null;
    }>(`/wl/${collection}/${phaseId}/rebuild`, {});

    return {
      collection: response.collection,
      phaseId: response.phaseId,
      addresses: [],
      merkleRoot: response.merkleRoot,
      proofsByAddress: {},
      count: response.count,
      updatedAt: response.updatedAt,
    };
  } catch {
    return null;
  }
}

export async function fetchAllowlistProof(
  collection: `0x${string}`,
  phaseId: string,
  account: `0x${string}`
): Promise<{ included: boolean; proof: `0x${string}`[]; merkleRoot: `0x${string}` } | null> {
  try {
    return await fetchJson(`/wl/${collection}/${phaseId}/proof/${account}`);
  } catch {
    return null;
  }
}

export async function fetchAllowlistProofVerification(
  collection: `0x${string}`,
  phaseId: string,
  account: `0x${string}`
): Promise<{
  includedInBackendAllowlist: boolean;
  onchainMerkleRoot: `0x${string}`;
  backendMerkleRoot: `0x${string}`;
  rootsMatch: boolean;
  proof: `0x${string}`[];
  isProofValidForOnchainRoot: boolean;
} | null> {
  try {
    return await fetchJson(`/wl/${collection}/${phaseId}/verify/${account}`);
  } catch {
    return null;
  }
}

export async function fetchAllowlistProofsByPhase(
  collection: `0x${string}`,
  phaseIds: string[],
  account: `0x${string}`
): Promise<Record<string, { included: boolean; proof: `0x${string}`[]; merkleRoot: `0x${string}` }> | null> {
  if (!phaseIds.length) {
    return {};
  }

  try {
    const query = new URLSearchParams({ phaseIds: phaseIds.join(",") });
    const data = await fetchJson<{
      collection: `0x${string}`;
      account: `0x${string}`;
      proofsByPhase: Record<string, { included: boolean; proof: `0x${string}`[]; merkleRoot: `0x${string}` }>;
    }>(`/wl/${collection}/proofs/${account}?${query.toString()}`);
    return data.proofsByPhase ?? {};
  } catch {
    return null;
  }
}

export async function fetchSyncPayload(
  collection: `0x${string}`,
  phaseId: string
): Promise<BackendSyncPayload | null> {
  try {
    return await fetchJson<BackendSyncPayload>(`/wl/${collection}/${phaseId}/sync-payload`);
  } catch {
    return null;
  }
}

export async function fetchUpdatePhaseSyncPayload(
  collection: `0x${string}`,
  phaseId: string,
  body: {
    name: string;
    startTime: string;
    endTime: string;
    priceWei: string;
    maxPerWallet: number;
    phaseSupply: number;
    isPublic: boolean;
    active: boolean;
  }
): Promise<BackendUpdatePhaseSyncPayload | null> {
  try {
    return await postJson<BackendUpdatePhaseSyncPayload>(
      `/wl/${collection}/${phaseId}/sync-update-phase-payload`,
      body
    );
  } catch {
    return null;
  }
}

export async function fetchPublishedCollections(): Promise<BackendPublishedCollection[]> {
  try {
    const data = await fetchJson<{ collections: BackendPublishedCollection[] }>("/collections");
    return data.collections ?? [];
  } catch {
    return [];
  }
}

export async function fetchLaunchpadProject(
  collection: `0x${string}`
): Promise<BackendLaunchpadProject | null> {
  try {
    return await fetchJson<BackendLaunchpadProject>(`/launchpad/project/${collection}`);
  } catch {
    return null;
  }
}

export async function upsertPublishedCollection(options: {
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
}): Promise<BackendPublishedCollection | null> {
  try {
    const data = await postJson<{ collection: BackendPublishedCollection }>("/collections/upsert", options);
    return data.collection;
  } catch {
    return null;
  }
}
