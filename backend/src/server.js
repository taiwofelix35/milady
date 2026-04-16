import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createPublicClient, encodeFunctionData, getAddress, http, isAddress } from "viem";
import {
  MARKETPLACE_ABI,
  MARKETPLACE_LEGACY_EVENT_ABI,
  MARKETPLACE_COMPAT_EVENT_ABI,
  LAUNCHPAD_ABI,
} from "./abis.js";
import {
  getAllowlist,
  getMerkleTreeMode,
  getProof,
  getProofsByPhase,
  rebuildAllowlist,
  upsertAllowlist,
  verifyProofAgainstRoot,
} from "./whitelistStore.js";
import { listPublishedCollections, upsertPublishedCollection } from "./collectionRegistryStore.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultEnvPath = path.resolve(__dirname, "..", ".env");
dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || defaultEnvPath });

const PORT = Number(process.env.PORT ?? 4000);
const RPC_URL = process.env.RPC_URL ?? "https://rpc.tempo.xyz";
const LOG_RPC_URL = process.env.LOG_RPC_URL?.trim() || RPC_URL;
const RPC_FALLBACK_URLS = (process.env.RPC_FALLBACK_URLS ?? "")
  .split(",")
  .map((url) => url.trim())
  .filter((url) => url.length > 0);
const RPC_HTTP_TIMEOUT_MS = Number(process.env.RPC_HTTP_TIMEOUT_MS ?? 12000);
const RPC_CANDIDATES = Array.from(new Set([RPC_URL, ...RPC_FALLBACK_URLS]));
const INDEXER_LOOKBACK_BLOCKS = Number(process.env.INDEXER_LOOKBACK_BLOCKS ?? 500000);
const ACTIVITY_DEFAULT_LOOKBACK_BLOCKS = Number(
  process.env.ACTIVITY_DEFAULT_LOOKBACK_BLOCKS ?? 120000
);
const ACTIVITY_TOKEN_LOOKBACK_BLOCKS = Number(
  process.env.ACTIVITY_TOKEN_LOOKBACK_BLOCKS ?? 30000
);
const BATCH_INFER_LOOKBACK_BLOCKS = Number(process.env.BATCH_INFER_LOOKBACK_BLOCKS ?? 10000);
const MAX_LOG_BLOCK_RANGE = Number(process.env.MAX_LOG_BLOCK_RANGE ?? 99000);
const LOG_REQUEST_TIMEOUT_MS = Number(process.env.LOG_REQUEST_TIMEOUT_MS ?? 12000);
const MARKET_SOURCE_READ_TIMEOUT_MS = Number(process.env.MARKET_SOURCE_READ_TIMEOUT_MS ?? 2500);
const MARKET_SOURCE_PREFERRED_READ_TIMEOUT_MS = Number(
  process.env.MARKET_SOURCE_PREFERRED_READ_TIMEOUT_MS ?? 4000
);
const STABLEWHEL_PREFETCH_TIMEOUT_MS = Number(
  process.env.STABLEWHEL_PREFETCH_TIMEOUT_MS ?? 60000
);
const STABLEWHEL_CHUNK_READ_TIMEOUT_MS = Number(
  process.env.STABLEWHEL_CHUNK_READ_TIMEOUT_MS ?? 12000
);
const ACTIVITY_SOURCE_TIMEOUT_MS = Number(process.env.ACTIVITY_SOURCE_TIMEOUT_MS ?? 8000);
const ACTIVITY_HINT_EXPANSION_MAX_BLOCKS = Number(
  process.env.ACTIVITY_HINT_EXPANSION_MAX_BLOCKS ?? 90000
);
const ACTIVITY_SYNTHETIC_SCAN_DEFAULT = Number(process.env.ACTIVITY_SYNTHETIC_SCAN_DEFAULT ?? 200);
const ACTIVITY_SYNTHETIC_SCAN_MAX = Number(process.env.ACTIVITY_SYNTHETIC_SCAN_MAX ?? 200);
const LAUNCHPAD_READ_TIMEOUT_MS = Number(process.env.LAUNCHPAD_READ_TIMEOUT_MS ?? 5000);
const COLLECTION_STATS_CACHE_TTL_MS = Number(process.env.COLLECTION_STATS_CACHE_TTL_MS ?? 45000);
const MARKETPLACE_CONTRACT = process.env.MARKETPLACE_CONTRACT ?? "0x0000000000000000000000000000000000000000";
const STABLEWHEL_MARKETPLACE_CONTRACT =
  process.env.STABLEWHEL_MARKETPLACE_CONTRACT ?? "0x0000000000000000000000000000000000000000";
const TEMPPUNKS_MARKETPLACE_CONTRACT =
  process.env.TEMPPUNKS_MARKETPLACE_CONTRACT ?? "0x0000000000000000000000000000000000000000";
const TEMPPUNKS_MARKETPLACE_V4_CONTRACT =
  process.env.TEMPPUNKS_MARKETPLACE_V4_CONTRACT ?? "0x0000000000000000000000000000000000000000";
const TEMPPUNKS_MARKETPLACE_V2_CONTRACT =
  process.env.TEMPPUNKS_MARKETPLACE_V2_CONTRACT ?? "0x0000000000000000000000000000000000000000";
const LAUNCHPAD_CONTRACT = process.env.LAUNCHPAD_CONTRACT ?? "0x0000000000000000000000000000000000000000";
const NFT_CONTRACT = process.env.NFT_CONTRACT ?? "0x0000000000000000000000000000000000000000";
const BACKGROUND_INDEXER_ENABLED =
  (process.env.BACKGROUND_INDEXER_ENABLED ?? "1").toLowerCase() !== "0";
const BACKGROUND_INDEXER_INTERVAL_MS = Number(process.env.BACKGROUND_INDEXER_INTERVAL_MS ?? 45000);
const BACKGROUND_INDEXER_REQUEST_TIMEOUT_MS = Number(
  process.env.BACKGROUND_INDEXER_REQUEST_TIMEOUT_MS ?? 15000
);
const BACKGROUND_INDEXER_PREWARM_ENABLED =
  (process.env.BACKGROUND_INDEXER_PREWARM_ENABLED ?? "0").toLowerCase() !== "0";
const BACKGROUND_INDEXER_SUPPLY = Number(process.env.BACKGROUND_INDEXER_SUPPLY ?? 3333);
const BACKGROUND_INDEXER_START_TOKEN_ID = Number(process.env.BACKGROUND_INDEXER_START_TOKEN_ID ?? 1);
const BACKGROUND_INDEXER_SCAN = Number(process.env.BACKGROUND_INDEXER_SCAN ?? 200);
const FULL_LISTINGS_INDEX_ENABLED =
  (process.env.FULL_LISTINGS_INDEX_ENABLED ?? "1").toLowerCase() !== "0";
const FULL_LISTINGS_INDEX_SUPPLY = Number(
  process.env.FULL_LISTINGS_INDEX_SUPPLY ?? BACKGROUND_INDEXER_SUPPLY
);
const FULL_LISTINGS_INDEX_START_TOKEN_ID = Number(
  process.env.FULL_LISTINGS_INDEX_START_TOKEN_ID ?? BACKGROUND_INDEXER_START_TOKEN_ID
);
const FULL_LISTINGS_INDEX_BATCH_SIZE = Number(process.env.FULL_LISTINGS_INDEX_BATCH_SIZE ?? 50);
const FULL_LISTINGS_INDEX_PERSIST_INTERVAL_MS = Number(
  process.env.FULL_LISTINGS_INDEX_PERSIST_INTERVAL_MS ?? 30000
);
const FULL_LISTINGS_INDEX_MAX_TARGETS = Number(process.env.FULL_LISTINGS_INDEX_MAX_TARGETS ?? 8);
const FULL_LISTINGS_INDEX_TARGET_TTL_MS = Number(
  process.env.FULL_LISTINGS_INDEX_TARGET_TTL_MS ?? 30 * 60 * 1000
);
const FULL_LISTINGS_INDEX_MAX_SUPPLY = Number(
  process.env.FULL_LISTINGS_INDEX_MAX_SUPPLY ?? Math.max(FULL_LISTINGS_INDEX_SUPPLY, 3333)
);
const FULL_LISTINGS_INDEX_FILE = path.resolve(__dirname, "..", "data", "full-listings-index.json");

const app = express();
app.use(cors());
app.use(express.json());

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const rpcTransports = RPC_CANDIDATES.map((url) =>
  http(url, {
    timeout: RPC_HTTP_TIMEOUT_MS,
    retryCount: 0,
  })
);

const client = createPublicClient({
  transport: rpcTransports[0],
});

const logClient =
  LOG_RPC_URL === RPC_URL
    ? client
    : createPublicClient({
        transport: http(LOG_RPC_URL, {
          timeout: RPC_HTTP_TIMEOUT_MS,
          retryCount: 0,
        }),
      });

function badRequest(res, message) {
  return res.status(400).json({ error: message });
}

function isConfiguredAddress(address) {
  return isAddress(address) && address.toLowerCase() !== ZERO_ADDRESS;
}

const ITEM_LISTED_EVENT = MARKETPLACE_ABI.find((x) => x.type === "event" && x.name === "ItemListed");
const ITEM_SOLD_EVENT = MARKETPLACE_ABI.find((x) => x.type === "event" && x.name === "ItemSold");
const OFFER_MADE_EVENT = MARKETPLACE_ABI.find((x) => x.type === "event" && x.name === "OfferMade");
const LEGACY_LISTED_EVENT = MARKETPLACE_LEGACY_EVENT_ABI.find((x) => x.type === "event" && x.name === "Listed");
const LEGACY_SALE_EVENT = MARKETPLACE_LEGACY_EVENT_ABI.find((x) => x.type === "event" && x.name === "Sale");
const LEGACY_OFFER_MADE_EVENT = MARKETPLACE_LEGACY_EVENT_ABI.find(
  (x) => x.type === "event" && x.name === "OfferMade"
);
const ERC721_OWNER_OF_ABI = [
  {
    name: "ownerOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "owner", type: "address" }],
  },
];
const COMPAT_LISTED_EVENTS = MARKETPLACE_COMPAT_EVENT_ABI.filter(
  (x) => x.type === "event" && x.name === "Listed"
);
const COMPAT_SALE_EVENTS = MARKETPLACE_COMPAT_EVENT_ABI.filter(
  (x) => x.type === "event" && x.name === "Sale"
);
const COMPAT_OFFER_EVENTS = MARKETPLACE_COMPAT_EVENT_ABI.filter(
  (x) => x.type === "event" && x.name === "OfferMade"
);
const SET_PHASE_MERKLE_ROOT_ABI = [
  {
    name: "creatorSetPhaseMerkleRoot",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "collection", type: "address" },
      { name: "phaseId", type: "uint256" },
      { name: "merkleRoot", type: "bytes32" },
    ],
    outputs: [],
  },
];
const UPDATE_PHASE_ABI = [
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
];
const LAUNCHPAD_COLLECTION_PHASE_ABI = [
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
];

const HAS_GET_PROJECT = LAUNCHPAD_ABI.some((item) => item.type === "function" && item.name === "getProject");
const HAS_SET_PHASE_MERKLE_ROOT = LAUNCHPAD_ABI.some(
  (item) => item.type === "function" && item.name === "creatorSetPhaseMerkleRoot"
);
const HAS_UPDATE_PHASE = LAUNCHPAD_ABI.some(
  (item) => item.type === "function" && item.name === "creatorUpdatePhase"
);

function parseBigIntField(value, fieldName) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw new Error(`${fieldName} must be a non-negative integer string`);
  }
  return BigInt(value);
}

function parseIntegerField(value, fieldName, max) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > max) {
    throw new Error(`${fieldName} must be an integer between 0 and ${max}`);
  }
  return value;
}

const MARKET_SOURCES = [
  { key: "milady", label: "Milady Market", address: MARKETPLACE_CONTRACT },
  { key: "stablewhel", label: "StableWhel", address: STABLEWHEL_MARKETPLACE_CONTRACT },
  { key: "temppunks", label: "TempPunks", address: TEMPPUNKS_MARKETPLACE_CONTRACT },
  { key: "temppunks-v4", label: "TempPunks V4", address: TEMPPUNKS_MARKETPLACE_V4_CONTRACT },
  { key: "temppunks-v2", label: "TempPunks V2", address: TEMPPUNKS_MARKETPLACE_V2_CONTRACT },
];

const TEMPPUNKS_LISTED_TOPIC = "0xa341efc69114c3da3ff578feb52a253af179f46dfa81376572cdd94d43e47c16";
const TEMPPUNKS_CANCELLED_TOPIC = "0x411aee90354c51b1b04cd563fcab2617142a9d50da19232d888547c8a1b7fd8a";
const ACTIVITY_DEPLOY_BLOCK_HINTS = new Map([
  ["0x16787dae7a50be671b44e06342d57cc017a9a", 13352314n],
]);
let latestBlockCache = null;
let latestBlockCacheAt = 0;
const STABLEWHEL_LISTING_CACHE_TTL_MS = Number(process.env.STABLEWHEL_LISTING_CACHE_TTL_MS ?? 15000);
const LISTING_READ_CACHE_TTL_MS = Number(process.env.LISTING_READ_CACHE_TTL_MS ?? 45000);
const ACTIVE_LISTINGS_CACHE_TTL_MS = Number(process.env.ACTIVE_LISTINGS_CACHE_TTL_MS ?? 45000);
const ACTIVE_LISTINGS_REQUEST_BUDGET_MS = Number(process.env.ACTIVE_LISTINGS_REQUEST_BUDGET_MS ?? 8000);
const SCAN_CAP = 200;
const SCAN_BATCH_SIZE = 50;
const SCAN_BATCH_CONCURRENCY = 1;
const ACTIVE_OFFERS_CACHE_TTL_MS = Number(process.env.ACTIVE_OFFERS_CACHE_TTL_MS ?? 20000);
const ACTIVITY_CACHE_TTL_MS = Number(process.env.ACTIVITY_CACHE_TTL_MS ?? 12000);
const ACTIVITY_CACHE_MAX_ENTRIES = Number(process.env.ACTIVITY_CACHE_MAX_ENTRIES ?? 300);
const COLLECTION_STATS_REQUEST_BUDGET_MS = Number(process.env.COLLECTION_STATS_REQUEST_BUDGET_MS ?? 8000);
const SALES_STATS_CACHE_TTL_MS = Number(process.env.SALES_STATS_CACHE_TTL_MS ?? 120000);
const RARITY_CACHE_TTL_MS = Number(process.env.RARITY_CACHE_TTL_MS ?? 15 * 60 * 1000);
const RARITY_SCAN_HARD_MAX = SCAN_CAP;
const RARITY_FETCH_CONCURRENCY = SCAN_BATCH_CONCURRENCY;
const HOLDERS_CACHE_TTL_MS = Number(process.env.HOLDERS_CACHE_TTL_MS ?? 5 * 60 * 1000);
const HOLDERS_SCAN_HARD_MAX = SCAN_CAP;
const HOLDERS_READ_TIMEOUT_MS = Number(process.env.HOLDERS_READ_TIMEOUT_MS ?? 7000);
const HOLDERS_CHUNK_SIZE = SCAN_BATCH_CONCURRENCY;
const LATEST_BLOCK_FAST_TIMEOUT_MS = Number(process.env.LATEST_BLOCK_FAST_TIMEOUT_MS ?? 4500);
const SALES_STATS_COMPUTE_TIMEOUT_MS = Number(process.env.SALES_STATS_COMPUTE_TIMEOUT_MS ?? 7000);
const stableWhelListingsCache = new Map();
const collectionStatsCache = new Map();
const listingReadCache = new Map();
const activeListingsCache = new Map();
const activeListingsRefreshInFlight = new Set();
const activeOffersCache = new Map();
const activityCollectionCache = new Map();
const activityTokenCache = new Map();
const salesStatsCache = new Map();
const salesStatsRefreshInFlight = new Set();
const rarityIndexCache = new Map();
const rarityIndexInFlight = new Map();
const holdersIndexCache = new Map();
const holdersIndexInFlight = new Map();
let backgroundIndexerPort = null;
let backgroundIndexerTimer = null;
let backgroundIndexerRunning = false;
let backgroundIndexerLastRunAt = 0;
let backgroundIndexerLastDurationMs = null;
let backgroundIndexerLastError = null;
let fullListingsIndexLoaded = false;
const fullListingsIndexStates = new Map();
let fullListingsIndexActiveKey = null;
let fullListingsIndexStateCursor = 0;
let fullListingsIndexRunning = false;
let fullListingsIndexLastPersistAt = 0;
let fullListingsIndexLastPruneAt = 0;
let fullListingsIndexLastPrunedCount = 0;
let fullListingsIndexRequestedNft = null;
let fullListingsIndexRequestedSupply = 0;
let fullListingsIndexRequestedStartTokenId = 1;

function getListingReadCacheKey(marketAddress, nftAddress, tokenId) {
  return `${String(marketAddress).toLowerCase()}:${String(nftAddress).toLowerCase()}:${BigInt(tokenId).toString()}`;
}

function setCachedListingRead(marketAddress, nftAddress, tokenId, row) {
  if (!row) return;
  const key = getListingReadCacheKey(marketAddress, nftAddress, tokenId);
  listingReadCache.set(key, { at: Date.now(), row });
}

function getCachedListingRead(marketAddress, nftAddress, tokenId) {
  const key = getListingReadCacheKey(marketAddress, nftAddress, tokenId);
  const cached = listingReadCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.at > LISTING_READ_CACHE_TTL_MS) {
    listingReadCache.delete(key);
    return null;
  }
  return cached.row;
}

function getCachedValue(cache, key, ttlMs) {
  const cached = cache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.at > ttlMs) {
    cache.delete(key);
    return null;
  }
  return cached.value;
}

function setCachedValue(cache, key, value, maxEntries = ACTIVITY_CACHE_MAX_ENTRIES) {
  if (cache.size >= maxEntries) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) {
      cache.delete(oldestKey);
    }
  }
  cache.set(key, { at: Date.now(), value });
}

function getCachedStaleValue(cache, key) {
  const cached = cache.get(key);
  return cached ? cached.value : null;
}

function createFullListingsIndexKey({ nftAddress, supply, startTokenId }) {
  return `${String(nftAddress).toLowerCase()}:${Math.max(1, Number(supply) || 1)}:${Math.max(1, Number(startTokenId) || 1)}`;
}

function createFullListingsIndexState({ nftAddress, supply, startTokenId }) {
  return {
    key: createFullListingsIndexKey({ nftAddress, supply, startTokenId }),
    nftAddress: getAddress(nftAddress),
    supply: Math.max(1, Number(supply) || 1),
    startTokenId: Math.max(1, Number(startTokenId) || 1),
    byToken: new Map(),
    cursor: 0,
    sweepCount: 0,
    running: false,
    lastRunAt: 0,
    lastDurationMs: null,
    lastPersistAt: 0,
    lastError: null,
    requestedAt: Date.now(),
  };
}

function normalizeFullListingsIndexTarget({ nftAddress, supply, startTokenId }) {
  if (!nftAddress || !isAddress(nftAddress)) return null;

  const supplyNum = Number(supply);
  if (!Number.isFinite(supplyNum) || supplyNum <= 0) return null;

  const startTokenNum = Number(startTokenId);
  const normalizedSupply = Math.max(1, Math.min(Math.floor(supplyNum), Math.max(1, FULL_LISTINGS_INDEX_MAX_SUPPLY)));
  const normalizedStartTokenId = Math.max(1, Number.isFinite(startTokenNum) ? Math.floor(startTokenNum) : 1);

  return {
    nftAddress: getAddress(nftAddress),
    supply: normalizedSupply,
    startTokenId: normalizedStartTokenId,
  };
}

function ensureFullListingsIndexState({ nftAddress, supply, startTokenId }) {
  const normalized = normalizeFullListingsIndexTarget({ nftAddress, supply, startTokenId });
  if (!normalized) return null;
  const key = createFullListingsIndexKey(normalized);
  let state = fullListingsIndexStates.get(key);
  if (!state) {
    state = createFullListingsIndexState(normalized);
    fullListingsIndexStates.set(key, state);
  }
  state.requestedAt = Date.now();
  return state;
}

function pruneFullListingsIndexStates() {
  const now = Date.now();
  let prunedCount = 0;

  for (const [key, state] of fullListingsIndexStates.entries()) {
    if (state.running) continue;
    if (now - state.requestedAt <= Math.max(1000, FULL_LISTINGS_INDEX_TARGET_TTL_MS)) continue;
    fullListingsIndexStates.delete(key);
    prunedCount += 1;
  }

  while (fullListingsIndexStates.size > Math.max(1, FULL_LISTINGS_INDEX_MAX_TARGETS)) {
    const candidates = Array.from(fullListingsIndexStates.values())
      .filter((state) => !state.running)
      .sort((a, b) => {
        // Keep the currently active target when possible to reduce churn.
        const aIsActive = a.key === fullListingsIndexActiveKey ? 1 : 0;
        const bIsActive = b.key === fullListingsIndexActiveKey ? 1 : 0;
        if (aIsActive !== bIsActive) return aIsActive - bIsActive;

        // Prefer evicting low-value targets first.
        if (a.supply !== b.supply) return a.supply - b.supply;

        // Then evict the one least recently refreshed.
        const aLastRun = a.lastRunAt > 0 ? a.lastRunAt : 0;
        const bLastRun = b.lastRunAt > 0 ? b.lastRunAt : 0;
        if (aLastRun !== bLastRun) return aLastRun - bLastRun;

        // Final fallback: oldest request timestamp.
        return a.requestedAt - b.requestedAt;
      });

    const victim = candidates[0] ?? null;
    if (!victim) break;
    fullListingsIndexStates.delete(victim.key);
    prunedCount += 1;
  }

  if (prunedCount > 0 || fullListingsIndexLastPruneAt === 0) {
    const activeState = getActiveFullListingsIndexState();
    if (!activeState) {
      const firstState = Array.from(fullListingsIndexStates.values())[0] ?? null;
      fullListingsIndexActiveKey = firstState ? firstState.key : null;
    }
    fullListingsIndexStateCursor = Math.min(fullListingsIndexStateCursor, Math.max(0, fullListingsIndexStates.size - 1));
  }

  fullListingsIndexLastPruneAt = now;
  fullListingsIndexLastPrunedCount = prunedCount;
}

function pickNextFullListingsIndexState() {
  pruneFullListingsIndexStates();
  const states = Array.from(fullListingsIndexStates.values());
  if (!states.length) return null;
  if (fullListingsIndexStateCursor >= states.length) {
    fullListingsIndexStateCursor = 0;
  }
  const state = states[fullListingsIndexStateCursor];
  fullListingsIndexStateCursor = (fullListingsIndexStateCursor + 1) % states.length;
  return state;
}

function getFullListingsIndexStateByRequest({ nftAddress, supply, startTokenId }) {
  const normalized = normalizeFullListingsIndexTarget({ nftAddress, supply, startTokenId });
  if (!normalized) return null;
  const key = createFullListingsIndexKey(normalized);
  return fullListingsIndexStates.get(key) ?? null;
}

function getActiveFullListingsIndexState() {
  if (!fullListingsIndexActiveKey) return null;
  return fullListingsIndexStates.get(fullListingsIndexActiveKey) ?? null;
}

function getFullListingsIndexConfig() {
  if (!FULL_LISTINGS_INDEX_ENABLED) {
    return null;
  }

  if (fullListingsIndexStates.size === 0 && isConfiguredAddress(NFT_CONTRACT)) {
    const seeded = ensureFullListingsIndexState({
      nftAddress: NFT_CONTRACT,
      supply: Math.max(1, FULL_LISTINGS_INDEX_SUPPLY),
      startTokenId: Math.max(1, FULL_LISTINGS_INDEX_START_TOKEN_ID),
    });
    if (!seeded) return null;
  }

  const state = pickNextFullListingsIndexState();
  if (!state) return null;
  return {
    state,
    nftAddress: state.nftAddress,
    supply: state.supply,
    startTokenId: state.startTokenId,
    batchSize: Math.max(1, FULL_LISTINGS_INDEX_BATCH_SIZE),
  };
}

function registerFullListingsIndexTarget({ nftAddress, supply, startTokenId }) {
  if (!FULL_LISTINGS_INDEX_ENABLED) {
    return;
  }

  const normalized = normalizeFullListingsIndexTarget({ nftAddress, supply, startTokenId });
  if (!normalized) return;

  const normalizedNft = normalized.nftAddress;
  const normalizedSupply = normalized.supply;
  const normalizedStartTokenId = normalized.startTokenId;

  fullListingsIndexRequestedNft = normalizedNft;
  fullListingsIndexRequestedSupply = normalizedSupply;
  fullListingsIndexRequestedStartTokenId = normalizedStartTokenId;

  const state = ensureFullListingsIndexState({
    nftAddress: normalizedNft,
    supply: normalizedSupply,
    startTokenId: normalizedStartTokenId,
  });
  pruneFullListingsIndexStates();
  if (!state) return;
  if (!fullListingsIndexActiveKey) {
    fullListingsIndexActiveKey = state.key;
  }
}

function serializeFullListingRow(row) {
  return {
    tokenId: row.tokenId,
    seller: row.seller,
    price: row.price.toString(),
    active: true,
    source: row.source,
    sourceLabel: row.sourceLabel,
    marketplace: row.marketplace,
  };
}

function deserializeFullListingRow(row) {
  if (!row || typeof row !== "object") return null;
  if (!row.tokenId || !row.seller || !row.price || !row.source || !row.marketplace) return null;
  return {
    tokenId: String(row.tokenId),
    seller: row.seller,
    price: BigInt(row.price),
    active: true,
    source: row.source,
    sourceLabel: row.sourceLabel ?? row.source,
    marketplace: row.marketplace,
  };
}

async function persistFullListingsIndexSnapshot(force = false) {
  if (!FULL_LISTINGS_INDEX_ENABLED) return;
  if (!force && Date.now() - fullListingsIndexLastPersistAt < FULL_LISTINGS_INDEX_PERSIST_INTERVAL_MS) {
    return;
  }

  const payload = {
    updatedAt: Date.now(),
    states: Array.from(fullListingsIndexStates.values()).map((state) => ({
      key: state.key,
      nftAddress: state.nftAddress,
      supply: state.supply,
      startTokenId: state.startTokenId,
      cursor: state.cursor,
      sweepCount: state.sweepCount,
      lastRunAt: state.lastRunAt,
      lastDurationMs: state.lastDurationMs,
      lastPersistAt: state.lastPersistAt,
      lastError: state.lastError,
      rows: Array.from(state.byToken.values()).map(serializeFullListingRow),
    })),
  };

  await writeFile(FULL_LISTINGS_INDEX_FILE, JSON.stringify(payload, null, 2), "utf8");
  fullListingsIndexLastPersistAt = Date.now();
}

async function loadFullListingsIndexSnapshot() {
  if (fullListingsIndexLoaded || !FULL_LISTINGS_INDEX_ENABLED) {
    return;
  }

  fullListingsIndexLoaded = true;
  try {
    const raw = await readFile(FULL_LISTINGS_INDEX_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return;
    }

    fullListingsIndexStates.clear();

    const statePayloads = Array.isArray(parsed.states)
      ? parsed.states
      : (parsed.nftAddress && parsed.supply
        ? [parsed]
        : []);

    for (const statePayload of statePayloads) {
      if (!statePayload || typeof statePayload !== "object") continue;
      if (typeof statePayload.nftAddress !== "string" || !isAddress(statePayload.nftAddress)) continue;

      const nftAddress = getAddress(statePayload.nftAddress);
      const supply = Math.max(1, Number(statePayload.supply) || 1);
      const startTokenId = Math.max(1, Number(statePayload.startTokenId) || 1);
      const state = createFullListingsIndexState({ nftAddress, supply, startTokenId });
      state.cursor = Math.max(0, Number(statePayload.cursor) || 0);
      state.sweepCount = Math.max(0, Number(statePayload.sweepCount) || 0);
      state.lastRunAt = Math.max(0, Number(statePayload.lastRunAt) || 0);
      state.lastDurationMs =
        statePayload.lastDurationMs === null || statePayload.lastDurationMs === undefined
          ? null
          : Number(statePayload.lastDurationMs);
      state.lastPersistAt = Math.max(0, Number(statePayload.lastPersistAt) || 0);
      state.lastError =
        typeof statePayload.lastError === "string" ? statePayload.lastError : null;

      const rows = Array.isArray(statePayload.rows) ? statePayload.rows : [];
      for (const row of rows) {
        const decoded = deserializeFullListingRow(row);
        if (!decoded) continue;
        state.byToken.set(decoded.tokenId, decoded);
      }

      fullListingsIndexStates.set(state.key, state);
    }

    const firstState = Array.from(fullListingsIndexStates.values())[0] ?? null;
    fullListingsIndexActiveKey = firstState ? firstState.key : null;
  } catch {
    // First boot without a snapshot file is expected.
  }
}

function sortListingRows(rows, sort) {
  return [...rows].sort((a, b) => {
    const tokenA = BigInt(a.tokenId);
    const tokenB = BigInt(b.tokenId);
    if (sort === "token-asc") return tokenA < tokenB ? -1 : tokenA > tokenB ? 1 : 0;
    if (sort === "token-desc") return tokenA > tokenB ? -1 : tokenA < tokenB ? 1 : 0;
    if (sort === "price-desc") {
      if (a.price > b.price) return -1;
      if (a.price < b.price) return 1;
      return tokenA < tokenB ? -1 : tokenA > tokenB ? 1 : 0;
    }
    if (a.price < b.price) return -1;
    if (a.price > b.price) return 1;
    return tokenA < tokenB ? -1 : tokenA > tokenB ? 1 : 0;
  });
}

function getFullListingsSnapshotForNft(
  nftAddress,
  requestedSupply = 0,
  requestedStartTokenId = 1,
  options = {}
) {
  const { allowPartial = false } = options;
  const state = getFullListingsIndexStateByRequest({
    nftAddress,
    supply: requestedSupply,
    startTokenId: requestedStartTokenId,
  });
  if (!state) return null;
  if (state.sweepCount < 1 && (!allowPartial || state.byToken.size === 0)) return null;

  return {
    rows: Array.from(state.byToken.values()),
    scanned: state.supply,
    ready: state.sweepCount >= 1,
    sweepCount: state.sweepCount,
    cursor: state.cursor,
    updatedAt: state.lastRunAt || null,
  };
}

async function runFullListingsIndexTick() {
  if (!FULL_LISTINGS_INDEX_ENABLED || fullListingsIndexRunning) {
    return;
  }

  const config = getFullListingsIndexConfig();
  if (!config) {
    return;
  }

  await loadFullListingsIndexSnapshot();

  const state = config.state;

  fullListingsIndexRunning = true;
  state.running = true;
  fullListingsIndexActiveKey = state.key;
  const startedAt = Date.now();

  try {
    const marketSources = getConfiguredMarketSources();
    if (!marketSources.length) {
      throw new Error("No configured market sources for full listings index");
    }

    const remaining = Math.max(0, config.supply - state.cursor);
    const take = Math.max(1, Math.min(config.batchSize, remaining || config.batchSize));
    const tokenIds = Array.from(
      { length: take },
      (_, idx) => BigInt(config.startTokenId + state.cursor + idx)
    );

    const rowsBySource = await Promise.all(
      marketSources.map(async (source) => {
        const rows = await withTimeout(
          readListingsBySourceBulk({
            marketAddress: source.address,
            nftAddress: config.nftAddress,
            tokenIds,
          }),
          isStableWhelSource(source)
            ? STABLEWHEL_CHUNK_READ_TIMEOUT_MS
            : MARKET_SOURCE_PREFERRED_READ_TIMEOUT_MS
        );

        return {
          source,
          rows: rows instanceof Map ? rows : new Map(),
        };
      })
    );

    for (const tokenId of tokenIds) {
      const tokenKey = tokenId.toString();
      let best = null;

      for (const { source, rows } of rowsBySource) {
        const row = rows.get(tokenKey);
        if (!row || !row.active || row.price <= 0n) continue;
        if (String(row.seller || "").toLowerCase() === ZERO_ADDRESS) continue;

        if (!best || row.price < best.price) {
          best = {
            tokenId: tokenKey,
            seller: row.seller,
            price: row.price,
            active: true,
            source: source.key,
            sourceLabel: source.label,
            marketplace: source.address,
          };
        }
      }

      if (best) {
        state.byToken.set(tokenKey, best);
      } else {
        state.byToken.delete(tokenKey);
      }
    }

    state.cursor += tokenIds.length;
    if (state.cursor >= config.supply) {
      state.cursor = 0;
      state.sweepCount += 1;
      await persistFullListingsIndexSnapshot(true);
    } else {
      await persistFullListingsIndexSnapshot(false);
    }

    state.lastError = null;
  } catch (error) {
    state.lastError = error instanceof Error ? error.message : String(error);
  } finally {
    state.lastRunAt = Date.now();
    state.lastDurationMs = state.lastRunAt - startedAt;
    state.lastPersistAt = fullListingsIndexLastPersistAt;
    state.running = false;
    fullListingsIndexRunning = false;
  }
}

async function fetchJsonWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`indexer request failed: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

async function runBackgroundIndexerTick() {
  if (!BACKGROUND_INDEXER_ENABLED || !backgroundIndexerPort || backgroundIndexerRunning) {
    return;
  }
  if (!isConfiguredAddress(NFT_CONTRACT)) {
    return;
  }

  backgroundIndexerRunning = true;
  const startedAt = Date.now();

  try {
    const errors = [];

    if (BACKGROUND_INDEXER_PREWARM_ENABLED) {
      try {
        const base = `http://127.0.0.1:${backgroundIndexerPort}`;
        const nft = NFT_CONTRACT;
        const supply = Math.max(1, BACKGROUND_INDEXER_SUPPLY);
        const startTokenId = Math.max(1, BACKGROUND_INDEXER_START_TOKEN_ID);
        const scan = Math.max(1, BACKGROUND_INDEXER_SCAN);

        const listingsUrl =
          `${base}/marketplace/active-listings?nft=${encodeURIComponent(nft)}` +
          `&supply=${supply}&startTokenId=${startTokenId}&scan=${scan}&limit=1&offset=0`;
        const statsUrl =
          `${base}/marketplace/collection-stats?nft=${encodeURIComponent(nft)}` +
          `&supply=${supply}&startTokenId=${startTokenId}&scan=${scan}&includeSales=1`;

        await fetchJsonWithTimeout(listingsUrl, BACKGROUND_INDEXER_REQUEST_TIMEOUT_MS);
        await fetchJsonWithTimeout(statsUrl, BACKGROUND_INDEXER_REQUEST_TIMEOUT_MS);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }

    await runFullListingsIndexTick();
    const activeState = getActiveFullListingsIndexState();
    if (activeState?.lastError) {
      errors.push(`fullListingsIndex(${activeState.key}): ${activeState.lastError}`);
    }

    backgroundIndexerLastError = errors.length ? errors.join(" | ") : null;
  } finally {
    backgroundIndexerLastRunAt = Date.now();
    backgroundIndexerLastDurationMs = backgroundIndexerLastRunAt - startedAt;
    backgroundIndexerRunning = false;
  }
}

function startBackgroundIndexer(port) {
  if (!BACKGROUND_INDEXER_ENABLED) {
    return;
  }

  backgroundIndexerPort = port;
  if (backgroundIndexerTimer) {
    clearInterval(backgroundIndexerTimer);
  }

  void loadFullListingsIndexSnapshot();
  void runBackgroundIndexerTick();
  backgroundIndexerTimer = setInterval(() => {
    void runBackgroundIndexerTick();
  }, Math.max(5000, BACKGROUND_INDEXER_INTERVAL_MS));
}

function getFreshestActiveListingsSnapshotForNft(nftAddress) {
  if (!nftAddress) return null;
  const prefix = `${String(nftAddress).toLowerCase()}:`;
  let freshest = null;
  for (const [entryKey, entryValue] of activeListingsCache.entries()) {
    if (!entryKey.startsWith(prefix)) continue;
    if (!entryValue || !Array.isArray(entryValue.rows)) continue;
    if (!freshest || entryValue.at > freshest.at) {
      freshest = entryValue;
    }
  }
  return freshest;
}

function getLatestBlockCached(maxAgeMs = 5 * 60 * 1000) {
  if (latestBlockCache !== null && Date.now() - latestBlockCacheAt < maxAgeMs) {
    return latestBlockCache;
  }
  return undefined;
}

async function getLatestBlockFast() {
  const fast = await withTimeout(getLatestBlockWithRetry(3), LATEST_BLOCK_FAST_TIMEOUT_MS);
  if (typeof fast === "bigint") {
    return fast;
  }
  return getLatestBlockCached();
}

async function computeSalesStatsForCollection(nftAddress) {
  const effectiveFromBlock = await resolveEffectiveFromBlock(undefined);
  const timedOutSources = [];
  let totalSales = 0;
  let totalVolume = 0n;

  for (const source of getConfiguredMarketSources()) {
    const soldLogs = await withTimeout(
      getLogsForEvents({
        address: source.address,
        fromBlock: effectiveFromBlock,
        events: [ITEM_SOLD_EVENT, LEGACY_SALE_EVENT, ...COMPAT_SALE_EVENTS],
      }),
      ACTIVITY_SOURCE_TIMEOUT_MS
    );

    if (!Array.isArray(soldLogs)) {
      timedOutSources.push(source.key);
      continue;
    }

    const filtered = soldLogs.filter((log) => sameAddress(extractNft(log.args), nftAddress));
    totalSales += filtered.length;
    totalVolume += filtered.reduce((sum, log) => sum + extractPrice(log.args), 0n);
  }

  return {
    totalSales,
    totalVolume,
    timedOutSources,
    fromBlock: effectiveFromBlock,
    computedAt: Date.now(),
  };
}

async function getSalesStatsCached(nftAddress) {
  const key = String(nftAddress).toLowerCase();
  const now = Date.now();
  const cached = salesStatsCache.get(key);

  if (cached && now - cached.computedAt < SALES_STATS_CACHE_TTL_MS) {
    return { stats: cached, fromCache: true, stale: false };
  }

  const inFlight = salesStatsRefreshInFlight.has(key);
  if (cached) {
    if (!inFlight) {
      salesStatsRefreshInFlight.add(key);
      void (async () => {
        try {
          const fresh = await computeSalesStatsForCollection(nftAddress);
          salesStatsCache.set(key, fresh);
        } catch {
          // keep stale snapshot
        } finally {
          salesStatsRefreshInFlight.delete(key);
        }
      })();
    }
    return { stats: cached, fromCache: true, stale: true };
  }

  try {
    const fresh = await withTimeout(
      computeSalesStatsForCollection(nftAddress),
      SALES_STATS_COMPUTE_TIMEOUT_MS
    );
    if (!fresh) {
      throw new Error("sales stats timed out");
    }
    salesStatsCache.set(key, fresh);
    return { stats: fresh, fromCache: false, stale: false };
  } catch {
    return {
      stats: {
        totalSales: 0,
        totalVolume: 0n,
        timedOutSources: [],
        fromBlock: 0n,
        computedAt: Date.now(),
      },
      fromCache: false,
      stale: false,
    };
  }
}

function getConfiguredMarketSources() {
  return MARKET_SOURCES.filter((source) => isConfiguredAddress(source.address));
}

function getSourcesForActivity(allSources, nftAddress) {
  if (!nftAddress) {
    return allSources;
  }

  const stableWhel = allSources.find((source) => isStableWhelSource(source));
  if (!stableWhel) {
    return allSources;
  }

  return [stableWhel, ...allSources.filter((source) => source !== stableWhel)];
}

function getMarketSourcesForRead(preferredMarketAddress) {
  const configured = getConfiguredMarketSources();
  if (!preferredMarketAddress || !isConfiguredAddress(preferredMarketAddress)) {
    return configured;
  }

  const normalizedPreferred = preferredMarketAddress.toLowerCase();
  const alreadyConfigured = configured.some(
    (source) => source.address.toLowerCase() === normalizedPreferred
  );

  if (alreadyConfigured) {
    return configured;
  }

  return [
    {
      key: "preferred",
      label: "Preferred Marketplace",
      address: preferredMarketAddress,
    },
    ...configured,
  ];
}

function isTempPunksSource(source) {
  return source.key.startsWith("temppunks");
}

function isStableWhelSource(source) {
  return source.key === "stablewhel";
}

async function readStableWhelListingsMap(marketAddress, nftAddress) {
  const cacheKey = `${String(marketAddress).toLowerCase()}:${String(nftAddress).toLowerCase()}`;
  const now = Date.now();
  const cached = stableWhelListingsCache.get(cacheKey);
  if (cached && now - cached.at < STABLEWHEL_LISTING_CACHE_TTL_MS) {
    return cached.rowsByToken;
  }

  try {
    const rows = await client.readContract({
      address: marketAddress,
      abi: MARKETPLACE_ABI,
      functionName: "getAllListings",
      args: [nftAddress],
    });

    const rowsByToken = new Map();
    for (const row of rows ?? []) {
      const tokenId = row?.tokenId ?? row?.[0];
      const seller = row?.seller ?? row?.[1];
      const price = row?.price ?? row?.[2] ?? 0n;
      if (tokenId === undefined || !seller || BigInt(price || 0) <= 0n) continue;
      if (String(seller).toLowerCase() === ZERO_ADDRESS) continue;
      rowsByToken.set(BigInt(tokenId).toString(), {
        seller,
        price: BigInt(price),
        active: true,
      });
    }

    stableWhelListingsCache.set(cacheKey, { at: now, rowsByToken });
    return rowsByToken;
  } catch {
    return new Map();
  }
}

function normalizeMarketplaceEvents(listed, sold, offers, source, cancelled = []) {
  return [
    ...listed.map((log) => ({
      type: "ItemListed",
      source: source.key,
      sourceLabel: source.label,
      marketplace: source.address,
      nft: extractNft(log.args),
      blockNumber: log.blockNumber?.toString() ?? null,
      transactionHash: log.transactionHash,
      seller: log.args.seller,
      tokenId: extractTokenId(log.args)?.toString() ?? null,
      price: extractPrice(log.args)?.toString() ?? "0",
    })),
    ...sold.map((log) => ({
      type: "ItemSold",
      source: source.key,
      sourceLabel: source.label,
      marketplace: source.address,
      nft: extractNft(log.args),
      blockNumber: log.blockNumber?.toString() ?? null,
      transactionHash: log.transactionHash,
      seller: log.args.seller,
      buyer: log.args.buyer,
      tokenId: extractTokenId(log.args)?.toString() ?? null,
      price: extractPrice(log.args)?.toString() ?? "0",
    })),
    ...offers.map((log) => ({
      type: "OfferMade",
      source: source.key,
      sourceLabel: source.label,
      marketplace: source.address,
      nft: extractNft(log.args),
      blockNumber: log.blockNumber?.toString() ?? null,
      transactionHash: log.transactionHash,
      offerer: extractOfferer(log.args),
      tokenId: extractTokenId(log.args)?.toString() ?? null,
      price: extractPrice(log.args)?.toString() ?? "0",
      expiry: log.args.expiry?.toString() ?? "0",
    })),
    ...cancelled.map((log) => ({
      type: "ItemCancelled",
      source: source.key,
      sourceLabel: source.label,
      marketplace: source.address,
      nft: extractNft(log.args),
      blockNumber: log.blockNumber?.toString() ?? null,
      transactionHash: log.transactionHash,
      seller: extractSeller(log.args),
      tokenId: extractTokenId(log.args)?.toString() ?? null,
    })),
  ].sort((a, b) => {
    const blockA = a.blockNumber ? BigInt(a.blockNumber) : 0n;
    const blockB = b.blockNumber ? BigInt(b.blockNumber) : 0n;
    return Number(blockB - blockA);
  });
}

async function resolveBestListingForToken({
  nftAddress,
  tokenId,
  inferFromLogs = true,
  effectiveFromBlock,
  preferredMarketAddress,
}) {
  const marketSources = getMarketSourcesForRead(preferredMarketAddress);
  if (!marketSources.length) {
    throw new Error("No configured marketplace sources");
  }

  const listingResults = await Promise.all(
    marketSources.map(async (source) => {
      const row = await withTimeout(
        readListingBySource(source.address, nftAddress, tokenId),
        MARKET_SOURCE_READ_TIMEOUT_MS
      );
      if (!row) return null;
      return { source, ...row };
    })
  );

  let activeListings = listingResults
    .filter(Boolean)
    .filter((row) => row.active && row.price > 0n);

  if (activeListings.length === 0 && inferFromLogs) {
    const inferredFromBlock =
      effectiveFromBlock !== undefined
        ? effectiveFromBlock
        : await resolveEffectiveFromBlock(undefined);

    const inferredListings = await Promise.all(
      marketSources.map(async (source) => {
        try {
          const [listed, sold] = await Promise.all([
            getLogsForEvents({
              address: source.address,
              fromBlock: inferredFromBlock,
              events: [ITEM_LISTED_EVENT, LEGACY_LISTED_EVENT, ...COMPAT_LISTED_EVENTS],
            }),
            getLogsForEvents({
              address: source.address,
              fromBlock: inferredFromBlock,
              events: [ITEM_SOLD_EVENT, LEGACY_SALE_EVENT, ...COMPAT_SALE_EVENTS],
            }),
          ]);

          const customListed = isTempPunksSource(source)
            ? (await getLogsByTopicSafe({
                address: source.address,
                fromBlock: inferredFromBlock,
                topic0: TEMPPUNKS_LISTED_TOPIC,
              }))
                .map(parseTempPunksListedLog)
                .filter(Boolean)
            : [];

          const customCancelled = isTempPunksSource(source)
            ? (await getLogsByTopicSafe({
                address: source.address,
                fromBlock: inferredFromBlock,
                topic0: TEMPPUNKS_CANCELLED_TOPIC,
              }))
                .map(parseTempPunksCancelledLog)
                .filter(Boolean)
            : [];

          const listedForToken = [...listed, ...customListed].filter(
            (log) => sameAddress(extractNft(log.args), nftAddress) && extractTokenId(log.args) === tokenId
          );
          if (!listedForToken.length) {
            return null;
          }

          const soldForToken = sold.filter(
            (log) => sameAddress(extractNft(log.args), nftAddress) && extractTokenId(log.args) === tokenId
          );

          const cancelledForToken = customCancelled.filter(
            (log) => extractTokenId(log.args) === tokenId
          );

          const latestListed = pickLatestLog(listedForToken);
          const latestSold = pickLatestLog(soldForToken);
          const latestCancelled = pickLatestLog(cancelledForToken);

          if (!latestListed) {
            return null;
          }
          if (latestSold && isLogAtOrAfter(latestSold, latestListed)) {
            return null;
          }
          if (latestCancelled && isLogAtOrAfter(latestCancelled, latestListed)) {
            return null;
          }

          const seller = extractSeller(latestListed.args);
          const price = extractPrice(latestListed.args);
          if (!seller || seller.toLowerCase() === ZERO_ADDRESS || !price || price <= 0n) {
            return null;
          }

          return {
            source,
            seller,
            price,
            active: true,
            inferred: true,
          };
        } catch {
          return null;
        }
      })
    );

    activeListings = inferredListings.filter(Boolean);
  }

  if (activeListings.length > 0) {
    activeListings.sort((a, b) => (a.price < b.price ? -1 : a.price > b.price ? 1 : 0));
    const best = activeListings[0];
    return {
      seller: best.seller,
      price: best.price,
      active: true,
      source: best.source.key,
      sourceLabel: best.source.label,
      marketplace: best.source.address,
      inferred: best.inferred ?? false,
    };
  }

  return {
    seller: ZERO_ADDRESS,
    price: 0n,
    active: false,
    source: null,
    sourceLabel: null,
    marketplace: null,
    inferred: false,
  };
}

async function readListingBySource(marketAddress, nftAddress, tokenId) {
  const cached = getCachedListingRead(marketAddress, nftAddress, tokenId);

  const stableWhelConfigured = isConfiguredAddress(STABLEWHEL_MARKETPLACE_CONTRACT)
    ? STABLEWHEL_MARKETPLACE_CONTRACT.toLowerCase()
    : null;
  if (stableWhelConfigured && String(marketAddress).toLowerCase() === stableWhelConfigured) {
    const rowsByToken = await readStableWhelListingsMap(marketAddress, nftAddress);
    const row = rowsByToken.get(BigInt(tokenId).toString());
    if (row) {
      setCachedListingRead(marketAddress, nftAddress, tokenId, row);
      return row;
    }
    if (cached) return cached;
    return { seller: ZERO_ADDRESS, price: 0n, active: false };
  }

  const functionNames = ["getListing", "listings"];

  for (const functionName of functionNames) {
    try {
      const result = await readContractWithRetry({
        address: marketAddress,
        abi: MARKETPLACE_ABI,
        functionName,
        args: [nftAddress, tokenId],
      });
      const [seller, price, active] = result;
      const row = { seller, price, active };
      setCachedListingRead(marketAddress, nftAddress, tokenId, row);
      return row;
    } catch {
      // Try next reader shape.
    }
  }

  if (cached) {
    return cached;
  }

  return null;
}

async function readListingsBySourceBulk({ marketAddress, nftAddress, tokenIds }) {
  const miladyConfigured = isConfiguredAddress(MARKETPLACE_CONTRACT)
    ? MARKETPLACE_CONTRACT.toLowerCase()
    : null;
  if (miladyConfigured && String(marketAddress).toLowerCase() === miladyConfigured) {
    const rowsByToken = new Map();
    const CHUNK_SIZE = 8;
    for (let i = 0; i < tokenIds.length; i += CHUNK_SIZE) {
      const chunk = tokenIds.slice(i, i + CHUNK_SIZE);
      const results = await Promise.all(
        chunk.map(async (tokenId) => {
          const row = await withTimeout(
            readListingBySource(marketAddress, nftAddress, tokenId),
            MARKET_SOURCE_PREFERRED_READ_TIMEOUT_MS
          );
          return [tokenId.toString(), row];
        })
      );

      for (const [tokenKey, row] of results) {
        if (row) {
          rowsByToken.set(tokenKey, row);
        }
      }
    }
    return rowsByToken;
  }

  const stableWhelConfigured = isConfiguredAddress(STABLEWHEL_MARKETPLACE_CONTRACT)
    ? STABLEWHEL_MARKETPLACE_CONTRACT.toLowerCase()
    : null;
  if (stableWhelConfigured && String(marketAddress).toLowerCase() === stableWhelConfigured) {
    const allRows = await readStableWhelListingsMap(marketAddress, nftAddress);
    const filtered = new Map();
    for (const tokenId of tokenIds) {
      const tokenKey = BigInt(tokenId).toString();
      const row = allRows.get(tokenKey);
      if (row) filtered.set(tokenKey, row);
    }
    return filtered;
  }

  const rowsByToken = new Map();
  let unresolved = [...tokenIds];
  const functionNames = ["getListing", "listings"];

  for (const functionName of functionNames) {
    if (!unresolved.length) break;

    try {
      const contracts = unresolved.map((tokenId) => ({
        address: marketAddress,
        abi: MARKETPLACE_ABI,
        functionName,
        args: [nftAddress, tokenId],
      }));

      const results = await client.multicall({
        contracts,
        allowFailure: true,
      });

      const nextUnresolved = [];
      results.forEach((result, idx) => {
        const tokenId = unresolved[idx];
        if (result.status === "success") {
          const [seller, price, active] = result.result;
          rowsByToken.set(tokenId.toString(), { seller, price, active });
        } else {
          nextUnresolved.push(tokenId);
        }
      });

      unresolved = nextUnresolved;
    } catch {
      // Try the next function shape.
    }
  }

  // Fallback: some marketplaces fail multicall decoding for this shape but
  // still support per-token reads. Fill any unresolved tokens individually.
  if (unresolved.length) {
    for (const tokenId of unresolved) {
      try {
        const row = await readListingBySource(marketAddress, nftAddress, tokenId);
        if (row) {
          rowsByToken.set(tokenId.toString(), row);
        }
      } catch {
        // Leave token unresolved.
      }
    }
  }

  return rowsByToken;
}

function getConfiguredMarketSourceByAddress(address) {
  if (!address || !isAddress(address)) return null;
  const normalized = address.toLowerCase();
  return getConfiguredMarketSources().find((source) => source.address.toLowerCase() === normalized) ?? null;
}

async function inferListingsFromLogsForSource({ source, nftAddress, tokenIds, fromBlock }) {
  const tokenSet = new Set(tokenIds.map((id) => id.toString()));
  if (!tokenSet.size) return new Map();

  const [listed, sold] = await Promise.all([
    getLogsForEvents({
      address: source.address,
      fromBlock,
      events: [ITEM_LISTED_EVENT, LEGACY_LISTED_EVENT, ...COMPAT_LISTED_EVENTS],
    }),
    getLogsForEvents({
      address: source.address,
      fromBlock,
      events: [ITEM_SOLD_EVENT, LEGACY_SALE_EVENT, ...COMPAT_SALE_EVENTS],
    }),
  ]);

  const customListed = isTempPunksSource(source)
    ? (await getLogsByTopicSafe({
        address: source.address,
        fromBlock,
        topic0: TEMPPUNKS_LISTED_TOPIC,
      }))
        .map(parseTempPunksListedLog)
        .filter(Boolean)
    : [];

  const customCancelled = isTempPunksSource(source)
    ? (await getLogsByTopicSafe({
        address: source.address,
        fromBlock,
        topic0: TEMPPUNKS_CANCELLED_TOPIC,
      }))
        .map(parseTempPunksCancelledLog)
        .filter(Boolean)
    : [];

  const relevantListed = [...listed, ...customListed]
    .filter((log) => {
      const tokenId = extractTokenId(log.args);
      return sameAddress(extractNft(log.args), nftAddress) && tokenId !== null && tokenSet.has(tokenId.toString());
    })
    .sort(compareLogsDesc);

  const relevantSold = sold
    .filter((log) => {
      const tokenId = extractTokenId(log.args);
      return sameAddress(extractNft(log.args), nftAddress) && tokenId !== null && tokenSet.has(tokenId.toString());
    })
    .sort(compareLogsDesc);

  const relevantCancelled = customCancelled
    .filter((log) => {
      const tokenId = extractTokenId(log.args);
      return tokenId !== null && tokenSet.has(tokenId.toString());
    })
    .sort(compareLogsDesc);

  const latestListedByToken = new Map();
  for (const log of relevantListed) {
    const tokenId = extractTokenId(log.args);
    const tokenKey = tokenId.toString();
    if (!latestListedByToken.has(tokenKey)) {
      latestListedByToken.set(tokenKey, log);
    }
  }

  const latestSoldByToken = new Map();
  for (const log of relevantSold) {
    const tokenId = extractTokenId(log.args);
    const tokenKey = tokenId.toString();
    if (!latestSoldByToken.has(tokenKey)) {
      latestSoldByToken.set(tokenKey, log);
    }
  }

  const latestCancelledByToken = new Map();
  for (const log of relevantCancelled) {
    const tokenId = extractTokenId(log.args);
    const tokenKey = tokenId.toString();
    if (!latestCancelledByToken.has(tokenKey)) {
      latestCancelledByToken.set(tokenKey, log);
    }
  }

  const inferredByToken = new Map();
  for (const tokenId of tokenIds) {
    const tokenKey = tokenId.toString();
    const latestListed = latestListedByToken.get(tokenKey);
    if (!latestListed) continue;

    const latestSold = latestSoldByToken.get(tokenKey);
    const latestCancelled = latestCancelledByToken.get(tokenKey);
    if (latestSold && isLogAtOrAfter(latestSold, latestListed)) continue;
    if (latestCancelled && isLogAtOrAfter(latestCancelled, latestListed)) continue;

    const seller = extractSeller(latestListed.args);
    const price = extractPrice(latestListed.args);
    if (!seller || seller.toLowerCase() === ZERO_ADDRESS || !price || price <= 0n) continue;

    inferredByToken.set(tokenKey, {
      seller,
      price,
      active: true,
      source: source.key,
      sourceLabel: source.label,
      marketplace: source.address,
      inferred: true,
    });
  }

  return inferredByToken;
}

function parseAddressesFromCsv(csvText) {
  if (typeof csvText !== "string") {
    return [];
  }

  return csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(",")[0].trim())
    .filter((value) => isAddress(value))
    .map((value) => getAddress(value));
}

function isTxHash(value) {
  return typeof value === "string" && /^0x[a-fA-F0-9]{64}$/.test(value);
}

function resolveNftAddress(nftQueryValue) {
  if (typeof nftQueryValue !== "string" || !nftQueryValue.trim()) {
    return NFT_CONTRACT;
  }
  if (!isAddress(nftQueryValue)) {
    return null;
  }
  return getAddress(nftQueryValue);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitedError(error) {
  const message = String(error instanceof Error ? error.message : error).toLowerCase();
  return (
    message.includes("rate limited") ||
    message.includes("request exceeds defined limit") ||
    message.includes("limit exceeded") ||
    message.includes("429")
  );
}

async function readContractWithRetry(params, maxRetries = 10) {
  let lastError = null;
  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    try {
      return await client.readContract(params);
    } catch (error) {
      lastError = error;
      if (!isRateLimitedError(error) || attempt === maxRetries - 1) {
        break;
      }
      await sleep(120 * (attempt + 1));
    }
  }
  throw lastError;
}

async function getLatestBlockWithRetry(maxRetries = 10) {
  let lastError = null;
  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    try {
      const latest = await client.getBlockNumber();
      latestBlockCache = latest;
      latestBlockCacheAt = Date.now();
      return latest;
    } catch (error) {
      lastError = error;
      const message = String(error instanceof Error ? error.message : error).toLowerCase();
      const retryable = message.includes("rate") || message.includes("429") || message.includes("timeout") || message.includes("network");
      if (!retryable || attempt === maxRetries - 1) {
        break;
      }
      await sleep(400 * (attempt + 1));
    }
  }

  if (latestBlockCache !== null && Date.now() - latestBlockCacheAt < 5 * 60 * 1000) {
    return latestBlockCache;
  }

  throw lastError;
}

async function resolveEffectiveFromBlock(fromBlockOverride, latestBlockOverride) {
  if (fromBlockOverride !== undefined) {
    return fromBlockOverride;
  }

  const latest = latestBlockOverride ?? (await getLatestBlockWithRetry());
  const lookback = BigInt(Math.max(1_000, INDEXER_LOOKBACK_BLOCKS));
  return latest > lookback ? latest - lookback : 0n;
}

function resolveActivityFromBlock(fromBlockOverride, nftAddress, latestBlock) {
  if (fromBlockOverride !== undefined) {
    return fromBlockOverride;
  }

  if (!nftAddress) {
    const lookback = BigInt(Math.max(1_000, INDEXER_LOOKBACK_BLOCKS));
    return latestBlock > lookback ? latestBlock - lookback : 0n;
  }

  const hinted = ACTIVITY_DEPLOY_BLOCK_HINTS.get(String(nftAddress).toLowerCase());
  const lookback = BigInt(Math.max(1_000, ACTIVITY_DEFAULT_LOOKBACK_BLOCKS));
  const fallbackFromBlock = latestBlock > lookback ? latestBlock - lookback : 0n;
  if (hinted !== undefined) {
    if (hinted > latestBlock) {
      return fallbackFromBlock;
    }

    // Keep activity requests responsive by scanning at most the default lookback window.
    return hinted > fallbackFromBlock ? hinted : fallbackFromBlock;
  }

  return fallbackFromBlock;
}

function resolveHintedActivityFromBlock(nftAddress, latestBlock) {
  if (!nftAddress) return null;
  const hinted = ACTIVITY_DEPLOY_BLOCK_HINTS.get(String(nftAddress).toLowerCase());
  if (hinted === undefined) return null;
  if (latestBlock !== undefined && hinted > latestBlock) return null;
  return hinted;
}

function boundHintedFromBlock(hintedFromBlock, effectiveFromBlock) {
  if (hintedFromBlock === null) {
    return null;
  }
  if (hintedFromBlock >= effectiveFromBlock) {
    return null;
  }

  const expansionWindow = BigInt(Math.max(1_000, ACTIVITY_HINT_EXPANSION_MAX_BLOCKS));
  const minFromBlock =
    effectiveFromBlock > expansionWindow ? effectiveFromBlock - expansionWindow : 0n;
  return hintedFromBlock > minFromBlock ? hintedFromBlock : minFromBlock;
}

function sameAddress(a, b) {
  if (!a || !b) return false;
  return a.toLowerCase() === b.toLowerCase();
}

function extractNft(args) {
  return args.nft ?? args.nftContract ?? args.collection ?? args.collectionAddress ?? args.tokenContract ?? null;
}

function extractTokenId(args) {
  return args.tokenId ?? args.id ?? args.nftId ?? null;
}

function extractPrice(args) {
  return args.price ?? args.amount ?? args.value ?? args.listPrice ?? 0n;
}

function extractOfferer(args) {
  return args.offerer ?? args.buyer ?? args.bidder ?? args.maker ?? null;
}

function extractSeller(args) {
  return args.seller ?? args.owner ?? args.maker ?? null;
}

function compareLogsDesc(a, b) {
  const blockA = a.blockNumber ?? 0n;
  const blockB = b.blockNumber ?? 0n;
  if (blockA !== blockB) return blockB > blockA ? 1 : -1;

  const txIndexA = BigInt(a.transactionIndex ?? 0);
  const txIndexB = BigInt(b.transactionIndex ?? 0);
  if (txIndexA !== txIndexB) return txIndexB > txIndexA ? 1 : -1;

  const logIndexA = BigInt(a.logIndex ?? 0);
  const logIndexB = BigInt(b.logIndex ?? 0);
  if (logIndexA === logIndexB) return 0;
  return logIndexB > logIndexA ? 1 : -1;
}

function isLogAtOrAfter(left, right) {
  if (!left || !right) return false;
  return compareLogsDesc(left, right) <= 0;
}

function pickLatestLog(logs) {
  if (!logs.length) return null;
  return logs.slice().sort(compareLogsDesc)[0];
}

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((resolve) => {
      setTimeout(() => resolve(null), timeoutMs);
    }),
  ]);
}

async function runBatchedWithControlledConcurrency({
  items,
  batchSize,
  concurrency,
  processBatch,
}) {
  const normalizedBatchSize = Math.max(1, Number(batchSize) || 1);
  const normalizedConcurrency = Math.max(1, Number(concurrency) || 1);
  const batches = [];
  for (let i = 0; i < items.length; i += normalizedBatchSize) {
    batches.push(items.slice(i, i + normalizedBatchSize));
  }

  let nextBatchIndex = 0;
  let stopRequested = false;
  let processedBatches = 0;

  const workers = Array.from({ length: Math.min(normalizedConcurrency, batches.length) }, () =>
    (async () => {
      while (true) {
        if (stopRequested) {
          break;
        }

        const batchIndex = nextBatchIndex;
        nextBatchIndex += 1;
        if (batchIndex >= batches.length) {
          break;
        }

        const keepGoing = await processBatch(batches[batchIndex], batchIndex);
        if (keepGoing === false) {
          stopRequested = true;
          break;
        }

        processedBatches += 1;
      }
    })()
  );

  await Promise.all(workers);

  return {
    processedBatches,
    totalBatches: batches.length,
    stoppedEarly: stopRequested,
  };
}

function topicToAddress(topic) {
  if (typeof topic !== "string" || topic.length < 42) return null;
  const candidate = `0x${topic.slice(-40)}`;
  return isAddress(candidate) ? getAddress(candidate) : null;
}

function dataWordToBigInt(data, index) {
  if (typeof data !== "string" || !data.startsWith("0x")) return 0n;
  const start = 2 + index * 64;
  const end = start + 64;
  if (data.length < end) return 0n;
  return BigInt(`0x${data.slice(start, end)}`);
}

function parseTempPunksListedLog(log) {
  if (!log?.topics?.length || log.topics[0]?.toLowerCase() !== TEMPPUNKS_LISTED_TOPIC) {
    return null;
  }

  const tokenId = log.topics[1] ? BigInt(log.topics[1]) : null;
  const nft = topicToAddress(log.topics[2]);
  const sellerWord = dataWordToBigInt(log.data, 0);
  const sellerHex = `0x${sellerWord.toString(16).padStart(40, "0")}`;
  const seller = isAddress(sellerHex) ? getAddress(sellerHex) : null;
  const price = dataWordToBigInt(log.data, 1);

  if (!tokenId || !nft || !seller) {
    return null;
  }

  return {
    ...log,
    args: {
      nft,
      tokenId,
      seller,
      price,
    },
  };
}

function parseTempPunksCancelledLog(log) {
  if (!log?.topics?.length || log.topics[0]?.toLowerCase() !== TEMPPUNKS_CANCELLED_TOPIC) {
    return null;
  }
  const tokenId = log.topics[1] ? BigInt(log.topics[1]) : null;
  if (tokenId === null) return null;

  return {
    ...log,
    args: {
      tokenId,
    },
  };
}

async function fetchLogsRangeSafe({ address, fromBlock, toBlock, event }) {
  try {
    const logs = await withTimeout(
      logClient.getLogs({ address, fromBlock, toBlock, event }),
      LOG_REQUEST_TIMEOUT_MS
    );
    return logs ?? [];
  } catch {
    if (fromBlock >= toBlock) {
      return [];
    }

    const mid = fromBlock + (toBlock - fromBlock) / 2n;
    const [left, right] = await Promise.all([
      fetchLogsRangeSafe({ address, fromBlock, toBlock: mid, event }),
      fetchLogsRangeSafe({ address, fromBlock: mid + 1n, toBlock, event }),
    ]);
    return [...left, ...right];
  }
}

async function fetchTopicLogsRangeSafe({ address, fromBlock, toBlock, topic0 }) {
  try {
    const logs = await withTimeout(
      logClient.getLogs({ address, fromBlock, toBlock, topics: [topic0] }),
      LOG_REQUEST_TIMEOUT_MS
    );
    return logs ?? [];
  } catch {
    if (fromBlock >= toBlock) {
      return [];
    }

    const mid = fromBlock + (toBlock - fromBlock) / 2n;
    const [left, right] = await Promise.all([
      fetchTopicLogsRangeSafe({ address, fromBlock, toBlock: mid, topic0 }),
      fetchTopicLogsRangeSafe({ address, fromBlock: mid + 1n, toBlock, topic0 }),
    ]);
    return [...left, ...right];
  }
}

async function getLogsSafe({ address, fromBlock, event, latestBlock }) {
  try {
    let latest = latestBlock;
    if (latest === undefined) {
      try {
        latest = await client.getBlockNumber();
      } catch {
        const directLogs = await withTimeout(
          logClient.getLogs({ address, fromBlock, event }),
          LOG_REQUEST_TIMEOUT_MS
        );
        return directLogs ?? [];
      }
    }
    if (fromBlock > latest) {
      return [];
    }

    const chunkSize = BigInt(Math.max(1_000, MAX_LOG_BLOCK_RANGE));
    const combined = [];

    for (let start = fromBlock; start <= latest; ) {
      const end = start + chunkSize - 1n > latest ? latest : start + chunkSize - 1n;
      const chunkLogs = await fetchLogsRangeSafe({
        address,
        fromBlock: start,
        toBlock: end,
        event,
      });
      combined.push(...chunkLogs);
      start = end + 1n;
    }

    return combined;
  } catch {
    return [];
  }
}

async function getLogsForEvents({ address, fromBlock, events, latestBlock }) {
  const validEvents = events.filter(Boolean);
  if (!validEvents.length) {
    return [];
  }

  const grouped = [];
  for (const event of validEvents) {
    const logs = await getLogsSafe({ address, fromBlock, event, latestBlock });
    grouped.push(logs);
  }
  return grouped.flat();
}

async function getLogsByTopicSafe({ address, fromBlock, topic0, latestBlock }) {
  try {
    let latest = latestBlock;
    if (latest === undefined) {
      try {
        latest = await client.getBlockNumber();
      } catch {
        const directLogs = await withTimeout(
          logClient.getLogs({ address, fromBlock, topics: [topic0] }),
          LOG_REQUEST_TIMEOUT_MS
        );
        return directLogs ?? [];
      }
    }
    if (fromBlock > latest) {
      return [];
    }

    const chunkSize = BigInt(Math.max(1_000, MAX_LOG_BLOCK_RANGE));
    const combined = [];

    for (let start = fromBlock; start <= latest; ) {
      const end = start + chunkSize - 1n > latest ? latest : start + chunkSize - 1n;
      const chunkLogs = await fetchTopicLogsRangeSafe({
        address,
        fromBlock: start,
        toBlock: end,
        topic0,
      });
      combined.push(...chunkLogs);
      start = end + 1n;
    }

    return combined;
  } catch {
    return [];
  }
}

async function fetchActivityRowsForSource({
  source,
  fromBlock,
  latestBlock,
  nftAddress,
  tokenId,
}) {
  try {
    const listed = await getLogsForEvents({
      address: source.address,
      fromBlock,
      events: [ITEM_LISTED_EVENT, LEGACY_LISTED_EVENT, ...COMPAT_LISTED_EVENTS],
      latestBlock,
    });
    const sold = await getLogsForEvents({
      address: source.address,
      fromBlock,
      events: [ITEM_SOLD_EVENT, LEGACY_SALE_EVENT, ...COMPAT_SALE_EVENTS],
      latestBlock,
    });
    const offers = await getLogsForEvents({
      address: source.address,
      fromBlock,
      events: [OFFER_MADE_EVENT, LEGACY_OFFER_MADE_EVENT, ...COMPAT_OFFER_EVENTS],
      latestBlock,
    });

    const customListed = isTempPunksSource(source)
      ? (await getLogsByTopicSafe({
          address: source.address,
          fromBlock,
          topic0: TEMPPUNKS_LISTED_TOPIC,
          latestBlock,
        }))
          .map(parseTempPunksListedLog)
          .filter(Boolean)
      : [];

    const customCancelled = isTempPunksSource(source)
      ? (await getLogsByTopicSafe({
          address: source.address,
          fromBlock,
          topic0: TEMPPUNKS_CANCELLED_TOPIC,
          latestBlock,
        }))
          .map(parseTempPunksCancelledLog)
          .filter(Boolean)
      : [];

    const listedForScope = [...listed, ...customListed].filter((log) => {
      if (nftAddress && !sameAddress(extractNft(log.args), nftAddress)) return false;
      if (tokenId !== undefined && extractTokenId(log.args) !== tokenId) return false;
      return true;
    });

    const soldForScope = sold.filter((log) => {
      if (nftAddress && !sameAddress(extractNft(log.args), nftAddress)) return false;
      if (tokenId !== undefined && extractTokenId(log.args) !== tokenId) return false;
      return true;
    });

    const offersForScope = offers.filter((log) => {
      if (nftAddress && !sameAddress(extractNft(log.args), nftAddress)) return false;
      if (tokenId !== undefined && extractTokenId(log.args) !== tokenId) return false;
      return true;
    });

    const cancelledForScope = customCancelled.filter((log) => {
      if (tokenId !== undefined && extractTokenId(log.args) !== tokenId) return false;
      return true;
    });

    return normalizeMarketplaceEvents(
      listedForScope,
      soldForScope,
      offersForScope,
      source,
      cancelledForScope
    );
  } catch {
    return [];
  }
}

async function synthesizeListingActivityRows({
  marketSources,
  nftAddress,
  supply,
  startTokenId,
  scan,
}) {
  if (!nftAddress || !Array.isArray(marketSources) || !marketSources.length) {
    return [];
  }

  // Prefer full listings index snapshots for this collection when available.
  const indexedStatesForNft = Array.from(fullListingsIndexStates.values())
    .filter((state) => state.nftAddress.toLowerCase() === nftAddress.toLowerCase())
    .filter((state) => state.byToken.size > 0)
    .sort((a, b) => {
      if (a.sweepCount !== b.sweepCount) return b.sweepCount - a.sweepCount;
      if (a.byToken.size !== b.byToken.size) return b.byToken.size - a.byToken.size;
      return (b.lastRunAt || 0) - (a.lastRunAt || 0);
    });

  const bestIndexedState = indexedStatesForNft[0] ?? null;
  if (bestIndexedState) {
    return Array.from(bestIndexedState.byToken.values()).map((row) => ({
      type: "ItemListed",
      source: row.source,
      sourceLabel: row.sourceLabel,
      marketplace: row.marketplace,
      nft: nftAddress,
      blockNumber: null,
      transactionHash: null,
      seller: row.seller,
      tokenId: row.tokenId,
      price: row.price?.toString?.() ?? "0",
    }));
  }

  const requestedSupply = Number.isFinite(supply) ? Number(supply) : 0;
  const requestedScan = Number.isFinite(scan) ? Number(scan) : ACTIVITY_SYNTHETIC_SCAN_DEFAULT;
  const scanCountRaw = requestedSupply > 0 ? requestedSupply : requestedScan;
  const scanCount = Math.min(
    Math.max(1, scanCountRaw),
    Math.max(1, ACTIVITY_SYNTHETIC_SCAN_MAX)
  );
  const startToken = Number.isFinite(startTokenId) ? Number(startTokenId) : 1;
  const cacheKey = `${nftAddress.toLowerCase()}:${startToken}:${scanCount}:all`;
  const cached = activeListingsCache.get(cacheKey);
  if (cached && Date.now() - cached.at < ACTIVE_LISTINGS_CACHE_TTL_MS && Array.isArray(cached.rows)) {
    return cached.rows.map((row) => ({
      type: "ItemListed",
      source: row.source,
      sourceLabel: row.sourceLabel,
      marketplace: row.marketplace,
      nft: nftAddress,
      blockNumber: null,
      transactionHash: null,
      seller: row.seller,
      tokenId: row.tokenId,
      price: row.price?.toString?.() ?? "0",
    }));
  }

  // Reuse the freshest in-memory snapshot for this collection even when
  // activity request params differ from active-listings request params.
  const nftPrefix = `${nftAddress.toLowerCase()}:`;
  let freshestSnapshot = null;
  for (const [entryKey, entryValue] of activeListingsCache.entries()) {
    if (!entryKey.startsWith(nftPrefix)) continue;
    if (!entryValue || !Array.isArray(entryValue.rows)) continue;
    if (Date.now() - entryValue.at > ACTIVE_LISTINGS_CACHE_TTL_MS) continue;
    if (!freshestSnapshot || entryValue.at > freshestSnapshot.at) {
      freshestSnapshot = entryValue;
    }
  }
  if (freshestSnapshot) {
    return freshestSnapshot.rows.map((row) => ({
      type: "ItemListed",
      source: row.source,
      sourceLabel: row.sourceLabel,
      marketplace: row.marketplace,
      nft: nftAddress,
      blockNumber: null,
      transactionHash: null,
      seller: row.seller,
      tokenId: row.tokenId,
      price: row.price?.toString?.() ?? "0",
    }));
  }

  const stableWhelSource = marketSources.find((source) => isStableWhelSource(source));
  if (!stableWhelSource) {
    return [];
  }

  const stableWhelRows = await withTimeout(
    readStableWhelListingsMap(stableWhelSource.address, nftAddress),
    STABLEWHEL_PREFETCH_TIMEOUT_MS
  );
  if (!(stableWhelRows instanceof Map)) {
    return [];
  }

  return Array.from(stableWhelRows.entries()).map(([tokenKey, row]) => ({
    type: "ItemListed",
    source: stableWhelSource.key,
    sourceLabel: stableWhelSource.label,
    marketplace: stableWhelSource.address,
    nft: nftAddress,
    blockNumber: null,
    transactionHash: null,
    seller: row.seller,
    tokenId: tokenKey,
    price: row.price?.toString?.() ?? "0",
  }));
}

async function getLogsWithError({ address, fromBlock, event }) {
  try {
    const logs = await client.getLogs({ address, fromBlock, event });
    return { logs, error: null };
  } catch (error) {
    return {
      logs: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function sanitizeMetadataBase(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function buildMetadataUrl(metadataBase, tokenId) {
  if (metadataBase.includes("{id}")) {
    return metadataBase.replaceAll("{id}", String(tokenId));
  }
  return `${metadataBase.replace(/\/$/, "")}/${tokenId}.json`;
}

function normalizeAttributeValue(value) {
  return String(value ?? "").trim();
}

function extractMetadataAttributes(metadata) {
  const attrs = metadata?.attributes;
  if (!Array.isArray(attrs)) return [];

  return attrs
    .map((entry) => ({
      traitType: normalizeAttributeValue(entry?.trait_type),
      value: normalizeAttributeValue(entry?.value),
    }))
    .filter((row) => row.traitType.length > 0 && row.value.length > 0);
}

function rarityTraitKey(traitType, value) {
  return `${traitType}::${value}`;
}

async function fetchMetadataJson(url) {
  async function fetchOne(targetUrl) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(targetUrl, {
        signal: controller.signal,
        headers: {
          accept: "application/json",
        },
      });
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  const primary = await fetchOne(url);
  if (primary) {
    return primary;
  }

  // Support collections that serve metadata as .../{id} instead of .../{id}.json.
  if (url.endsWith(".json")) {
    return await fetchOne(url.slice(0, -5));
  }

  return null;
}

async function buildRarityIndex({ metadataBase, supply, startTokenId = 1, scan }) {
  const requested = Number.isFinite(scan) && Number(scan) > 0 ? Number(scan) : Number(supply);
  const scanCount = Math.max(1, Math.min(requested, Number(supply), Math.max(1, RARITY_SCAN_HARD_MAX)));

  const traitCounts = new Map();
  const tokenTraits = new Map();
  let sampledTokens = 0;

  const concurrency = Math.max(1, Math.min(100, RARITY_FETCH_CONCURRENCY));
  for (let offset = 0; offset < scanCount; offset += concurrency) {
    const end = Math.min(scanCount, offset + concurrency);
    const tasks = [];

    for (let cursor = offset; cursor < end; cursor += 1) {
      const tokenId = startTokenId + cursor;
      tasks.push(
        (async () => {
          const metadataUrl = buildMetadataUrl(metadataBase, tokenId);
          const metadata = await fetchMetadataJson(metadataUrl);
          if (!metadata) return null;

          const attrs = extractMetadataAttributes(metadata);
          if (!attrs.length) return null;

          const uniqueTraitKeys = new Set();
          for (const attr of attrs) {
            uniqueTraitKeys.add(rarityTraitKey(attr.traitType, attr.value));
          }

          return {
            tokenId: String(tokenId),
            traitKeys: Array.from(uniqueTraitKeys),
          };
        })()
      );
    }

    const rows = await Promise.all(tasks);
    for (const row of rows) {
      if (!row) continue;
      sampledTokens += 1;
      tokenTraits.set(row.tokenId, row.traitKeys);
      for (const key of row.traitKeys) {
        traitCounts.set(key, (traitCounts.get(key) ?? 0) + 1);
      }
    }
  }

  if (!sampledTokens) {
    return {
      sampledTokens: 0,
      rankedTokens: 0,
      scanCount,
      tokenRankMap: new Map(),
      builtAt: Date.now(),
    };
  }

  const scored = [];
  const minFrequency = 1 / sampledTokens;
  for (const [tokenId, traitKeys] of tokenTraits.entries()) {
    let score = 0;
    for (const key of traitKeys) {
      const count = traitCounts.get(key) ?? 0;
      const frequency = count > 0 ? count / sampledTokens : minFrequency;
      const boundedFrequency = Math.max(minFrequency, frequency);
      score += -Math.log2(boundedFrequency);
    }
    scored.push({ tokenId, score });
  }

  scored.sort((a, b) => {
    if (a.score > b.score) return -1;
    if (a.score < b.score) return 1;
    const tokenA = BigInt(a.tokenId);
    const tokenB = BigInt(b.tokenId);
    return tokenA < tokenB ? -1 : tokenA > tokenB ? 1 : 0;
  });

  const tokenRankMap = new Map();
  for (let index = 0; index < scored.length; index += 1) {
    const row = scored[index];
    tokenRankMap.set(row.tokenId, {
      rank: index + 1,
      score: row.score,
    });
  }

  return {
    sampledTokens,
    rankedTokens: scored.length,
    scanCount,
    tokenRankMap,
    builtAt: Date.now(),
  };
}

async function getRarityIndexCached({ metadataBase, supply, startTokenId = 1, scan }) {
  const requested = Number.isFinite(scan) && Number(scan) > 0 ? Number(scan) : Number(supply);
  const normalizedScan = Math.max(1, Math.min(requested, Number(supply), Math.max(1, RARITY_SCAN_HARD_MAX)));
  const cacheKey = `${metadataBase}|${Number(supply)}|${Number(startTokenId)}|${normalizedScan}`;
  const now = Date.now();
  const cached = rarityIndexCache.get(cacheKey);
  if (cached && now - cached.builtAt < RARITY_CACHE_TTL_MS) {
    return cached;
  }

  const inFlight = rarityIndexInFlight.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const buildPromise = buildRarityIndex({
    metadataBase,
    supply,
    startTokenId,
    scan: normalizedScan,
  })
    .then((result) => {
      rarityIndexCache.set(cacheKey, result);
      return result;
    })
    .finally(() => {
      rarityIndexInFlight.delete(cacheKey);
    });

  rarityIndexInFlight.set(cacheKey, buildPromise);
  return buildPromise;
}

async function buildHoldersIndex({ nftAddress, supply, startTokenId = 1, scan }) {
  const normalizedSupply = Math.max(1, Number(supply));
  const requestedScan = Number.isFinite(scan) && Number(scan) > 0 ? Number(scan) : normalizedSupply;
  const scanCount = Math.max(
    1,
    Math.min(requestedScan, normalizedSupply, Math.max(1, HOLDERS_SCAN_HARD_MAX))
  );
  const normalizedStart = Math.max(0, Number(startTokenId));
  const ownerCounts = new Map();
  let resolvedOwners = 0;

  const chunkSize = Math.max(1, HOLDERS_CHUNK_SIZE);
  for (let offset = 0; offset < scanCount; offset += chunkSize) {
    const end = Math.min(scanCount, offset + chunkSize);
    const tasks = [];

    for (let index = offset; index < end; index += 1) {
      const tokenId = BigInt(normalizedStart + index);
      const ownerPromise = withTimeout(
        readContractWithRetry({
          address: nftAddress,
          abi: ERC721_OWNER_OF_ABI,
          functionName: "ownerOf",
          args: [tokenId],
        }),
        HOLDERS_READ_TIMEOUT_MS
      ).catch(() => null);
      tasks.push(ownerPromise);
    }

    const owners = await Promise.all(tasks);
    for (const rawOwner of owners) {
      if (typeof rawOwner !== "string" || !isAddress(rawOwner)) continue;
      const owner = getAddress(rawOwner);
      if (owner.toLowerCase() === ZERO_ADDRESS) continue;
      resolvedOwners += 1;
      ownerCounts.set(owner, (ownerCounts.get(owner) ?? 0) + 1);
    }
  }

  const holders = Array.from(ownerCounts.entries())
    .map(([address, balance]) => ({ address, balance }))
    .sort((a, b) => {
      if (b.balance !== a.balance) return b.balance - a.balance;
      return a.address.toLowerCase().localeCompare(b.address.toLowerCase());
    });

  return {
    nft: nftAddress,
    supply: normalizedSupply,
    startTokenId: normalizedStart,
    scanCount,
    resolvedOwners,
    totalHolders: holders.length,
    holders,
    builtAt: Date.now(),
  };
}

async function getHoldersIndexCached({ nftAddress, supply, startTokenId = 1, scan }) {
  const requested = Number.isFinite(scan) && Number(scan) > 0 ? Number(scan) : Number(supply);
  const normalizedScan = Math.max(
    1,
    Math.min(requested, Number(supply), Math.max(1, HOLDERS_SCAN_HARD_MAX))
  );
  const cacheKey = `${nftAddress.toLowerCase()}|${Number(supply)}|${Number(startTokenId)}|${normalizedScan}`;
  const now = Date.now();
  const cached = holdersIndexCache.get(cacheKey);
  if (cached && now - cached.builtAt < HOLDERS_CACHE_TTL_MS) {
    return cached;
  }

  const inFlight = holdersIndexInFlight.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const buildPromise = buildHoldersIndex({
    nftAddress,
    supply,
    startTokenId,
    scan: normalizedScan,
  })
    .then((result) => {
      holdersIndexCache.set(cacheKey, result);
      return result;
    })
    .finally(() => {
      holdersIndexInFlight.delete(cacheKey);
    });

  holdersIndexInFlight.set(cacheKey, buildPromise);
  return buildPromise;
}

function summarizeFullListingsIndexState(state) {
  if (!state) {
    return null;
  }
  const ageMs = Date.now() - state.requestedAt;
  const progress = state.supply > 0
    ? Math.min(1, state.cursor / state.supply)
    : 0;
  return {
    key: state.key,
    nft: state.nftAddress,
    supply: state.supply,
    startTokenId: state.startTokenId,
    ready: state.sweepCount >= 1,
    cursor: state.cursor,
    progress,
    sweepCount: state.sweepCount,
    activeListingCount: state.byToken.size,
    running: state.running,
    ageMs,
    lastRunAt: state.lastRunAt || null,
    lastDurationMs: state.lastDurationMs,
    lastPersistAt: state.lastPersistAt || null,
    lastError: state.lastError,
  };
}

app.get("/health", (_req, res) => {
  const configuredMarketSources = getConfiguredMarketSources().map((source) => ({
    key: source.key,
    label: source.label,
    address: source.address,
  }));
  const healthWarnings = [];
  if (!isConfiguredAddress(NFT_CONTRACT)) {
    healthWarnings.push("NFT_CONTRACT is not configured");
  }
  if (!configuredMarketSources.length) {
    healthWarnings.push("No marketplace contracts are configured");
  }
  if (!isConfiguredAddress(LAUNCHPAD_CONTRACT)) {
    healthWarnings.push("LAUNCHPAD_CONTRACT is not configured");
  }

  res.json({
    ok: true,
    service: "milady-backend",
    rpcUrl: RPC_URL,
    logRpcUrl: LOG_RPC_URL,
    rpcUrls: RPC_CANDIDATES,
    nftContract: isConfiguredAddress(NFT_CONTRACT) ? NFT_CONTRACT : null,
    launchpadContract: isConfiguredAddress(LAUNCHPAD_CONTRACT) ? LAUNCHPAD_CONTRACT : null,
    marketSources: configuredMarketSources,
    warnings: healthWarnings,
  });
});

app.get("/health/metrics", (_req, res) => {
  const now = Date.now();
  const latestBlockAgeMs = latestBlockCacheAt > 0 ? now - latestBlockCacheAt : null;

  function summarizeCacheAges(cache) {
    let newestAgeMs = null;
    let oldestAgeMs = null;
    for (const entry of cache.values()) {
      if (!entry || typeof entry.at !== "number") continue;
      const age = now - entry.at;
      if (newestAgeMs === null || age < newestAgeMs) newestAgeMs = age;
      if (oldestAgeMs === null || age > oldestAgeMs) oldestAgeMs = age;
    }
    return {
      size: cache.size,
      newestAgeMs,
      oldestAgeMs,
    };
  }

  return res.json({
    time: now,
    latestBlock: latestBlockCache !== null ? latestBlockCache.toString() : null,
    latestBlockAgeMs,
    timeouts: {
      latestBlockFast: LATEST_BLOCK_FAST_TIMEOUT_MS,
      salesStatsCompute: SALES_STATS_COMPUTE_TIMEOUT_MS,
      activitySource: ACTIVITY_SOURCE_TIMEOUT_MS,
      sourceRead: MARKET_SOURCE_READ_TIMEOUT_MS,
      sourcePreferredRead: MARKET_SOURCE_PREFERRED_READ_TIMEOUT_MS,
      stableWhelChunk: STABLEWHEL_CHUNK_READ_TIMEOUT_MS,
    },
    backgroundIndexer: {
      enabled: BACKGROUND_INDEXER_ENABLED,
      prewarmEnabled: BACKGROUND_INDEXER_PREWARM_ENABLED,
      port: backgroundIndexerPort,
      intervalMs: BACKGROUND_INDEXER_INTERVAL_MS,
      requestTimeoutMs: BACKGROUND_INDEXER_REQUEST_TIMEOUT_MS,
      supply: BACKGROUND_INDEXER_SUPPLY,
      startTokenId: BACKGROUND_INDEXER_START_TOKEN_ID,
      scan: BACKGROUND_INDEXER_SCAN,
      running: backgroundIndexerRunning,
      lastRunAt: backgroundIndexerLastRunAt || null,
      lastDurationMs: backgroundIndexerLastDurationMs,
      lastError: backgroundIndexerLastError,
    },
    fullListingsIndex: {
      enabled: FULL_LISTINGS_INDEX_ENABLED,
      file: FULL_LISTINGS_INDEX_FILE,
      maxTargets: Math.max(1, FULL_LISTINGS_INDEX_MAX_TARGETS),
      targetTtlMs: Math.max(1000, FULL_LISTINGS_INDEX_TARGET_TTL_MS),
      maxSupply: Math.max(1, FULL_LISTINGS_INDEX_MAX_SUPPLY),
      batchSize: Math.max(1, FULL_LISTINGS_INDEX_BATCH_SIZE),
      persistIntervalMs: FULL_LISTINGS_INDEX_PERSIST_INTERVAL_MS,
      running: fullListingsIndexRunning,
      targetCount: fullListingsIndexStates.size,
      lastPruneAt: fullListingsIndexLastPruneAt || null,
      lastPrunedCount: fullListingsIndexLastPrunedCount,
      active: summarizeFullListingsIndexState(getActiveFullListingsIndexState()),
    },
    caches: {
      activeListings: summarizeCacheAges(activeListingsCache),
      activeOffers: summarizeCacheAges(activeOffersCache),
      collectionStats: summarizeCacheAges(collectionStatsCache),
      activityCollection: summarizeCacheAges(activityCollectionCache),
      activityToken: summarizeCacheAges(activityTokenCache),
      salesStats: {
        size: salesStatsCache.size,
      },
      rarityIndex: {
        size: rarityIndexCache.size,
      },
      holdersIndex: {
        size: holdersIndexCache.size,
      },
    },
  });
});

app.get("/marketplace/index-status", (req, res) => {
  const nftParam = resolveNftAddress(req.query.nft);
  const supplyParam = typeof req.query.supply === "string" && /^\d+$/.test(req.query.supply)
    ? Number(req.query.supply)
    : 0;
  const startTokenParam = typeof req.query.startTokenId === "string" && /^\d+$/.test(req.query.startTokenId)
    ? Number(req.query.startTokenId)
    : 1;

  const selectedState = nftParam && supplyParam > 0
    ? getFullListingsIndexStateByRequest({
        nftAddress: nftParam,
        supply: supplyParam,
        startTokenId: startTokenParam,
      })
    : getActiveFullListingsIndexState();

  return res.json({
    ok: true,
    fullListingsIndex: {
      enabled: FULL_LISTINGS_INDEX_ENABLED,
      requestedNft: fullListingsIndexRequestedNft,
      requestedSupply: fullListingsIndexRequestedSupply,
      requestedStartTokenId: fullListingsIndexRequestedStartTokenId,
      maxTargets: Math.max(1, FULL_LISTINGS_INDEX_MAX_TARGETS),
      targetTtlMs: Math.max(1000, FULL_LISTINGS_INDEX_TARGET_TTL_MS),
      maxSupply: Math.max(1, FULL_LISTINGS_INDEX_MAX_SUPPLY),
      batchSize: Math.max(1, FULL_LISTINGS_INDEX_BATCH_SIZE),
      running: fullListingsIndexRunning,
      targetCount: fullListingsIndexStates.size,
      selected: summarizeFullListingsIndexState(selectedState),
      active: summarizeFullListingsIndexState(getActiveFullListingsIndexState()),
    },
  });
});

app.get("/config", (_req, res) => {
  res.json({
    marketplace: MARKETPLACE_CONTRACT,
    marketplaces: getConfiguredMarketSources().map((source) => ({
      key: source.key,
      label: source.label,
      address: source.address,
    })),
    launchpad: LAUNCHPAD_CONTRACT,
    nft: NFT_CONTRACT,
  });
});

app.get("/collections", async (_req, res) => {
  try {
    const collections = await listPublishedCollections();
    return res.json({ count: collections.length, collections });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.post("/collections/upsert", async (req, res) => {
  try {
    const record = await upsertPublishedCollection(req.body ?? {});
    return res.json({ ok: true, collection: record });
  } catch (error) {
    return badRequest(res, error instanceof Error ? error.message : String(error));
  }
});

app.get("/marketplace/rarity/ranks", async (req, res) => {
  const metadataBase = sanitizeMetadataBase(req.query.metadataBase);
  const supplyParam = req.query.supply;
  const startTokenIdParam = req.query.startTokenId;
  const scanParam = req.query.scan;
  const tokenIdsParam = req.query.tokenIds;

  if (!metadataBase) {
    return badRequest(res, "metadataBase query param is required");
  }
  if (typeof supplyParam !== "string" || !/^\d+$/.test(supplyParam) || Number(supplyParam) <= 0) {
    return badRequest(res, "supply query param must be a positive integer");
  }
  if (typeof tokenIdsParam !== "string" || tokenIdsParam.trim().length === 0) {
    return badRequest(res, "tokenIds query param is required");
  }

  const supply = Number(supplyParam);
  const startTokenId =
    typeof startTokenIdParam === "string" && /^\d+$/.test(startTokenIdParam)
      ? Number(startTokenIdParam)
      : 1;
  const scan =
    typeof scanParam === "string" && /^\d+$/.test(scanParam)
      ? Number(scanParam)
      : supply;

  const tokenIds = tokenIdsParam
    .split(",")
    .map((value) => value.trim())
    .filter((value) => /^\d+$/.test(value));

  if (!tokenIds.length) {
    return badRequest(res, "tokenIds must include at least one non-negative integer");
  }

  const uniqueTokenIds = Array.from(new Set(tokenIds));

  try {
    const index = await getRarityIndexCached({
      metadataBase,
      supply,
      startTokenId,
      scan,
    });

    const results = uniqueTokenIds.map((tokenId) => {
      const row = index.tokenRankMap.get(tokenId);
      return {
        tokenId,
        rank: row?.rank ?? null,
        score: row ? Number(row.score.toFixed(6)) : null,
      };
    });

    return res.json({
      metadataBase,
      supply,
      startTokenId,
      scanCount: index.scanCount,
      sampledTokens: index.sampledTokens,
      rankedTokens: index.rankedTokens,
      results,
    });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.get("/marketplace/holders", async (req, res) => {
  const nftAddress = resolveNftAddress(req.query.nft);
  const supplyParam = req.query.supply;
  const startTokenIdParam = req.query.startTokenId;
  const scanParam = req.query.scan;
  const limitParam = req.query.limit;
  const offsetParam = req.query.offset;

  if (!nftAddress || !isConfiguredAddress(nftAddress)) {
    return badRequest(res, "nft query param must be a valid configured address");
  }
  if (typeof supplyParam !== "string" || !/^\d+$/.test(supplyParam) || Number(supplyParam) <= 0) {
    return badRequest(res, "supply query param must be a positive integer");
  }

  const supply = Number(supplyParam);
  const startTokenId =
    typeof startTokenIdParam === "string" && /^\d+$/.test(startTokenIdParam)
      ? Number(startTokenIdParam)
      : 1;
  const scan =
    typeof scanParam === "string" && /^\d+$/.test(scanParam)
      ? Number(scanParam)
      : supply;
  const limit =
    typeof limitParam === "string" && /^\d+$/.test(limitParam)
      ? Math.max(1, Math.min(500, Number(limitParam)))
      : 200;
  const offset =
    typeof offsetParam === "string" && /^\d+$/.test(offsetParam)
      ? Math.max(0, Number(offsetParam))
      : 0;

  try {
    const index = await getHoldersIndexCached({
      nftAddress,
      supply,
      startTokenId,
      scan,
    });

    const paged = index.holders.slice(offset, offset + limit);
    const holders = paged.map((row) => ({
      address: row.address,
      balance: row.balance,
      share: index.scanCount > 0 ? Number(((row.balance / index.scanCount) * 100).toFixed(4)) : 0,
    }));

    return res.json({
      nft: index.nft,
      supply: index.supply,
      startTokenId: index.startTokenId,
      scanCount: index.scanCount,
      resolvedOwners: index.resolvedOwners,
      totalHolders: index.totalHolders,
      offset,
      limit,
      count: holders.length,
      hasNext: offset + holders.length < index.totalHolders,
      holders,
    });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.get("/marketplace/listing/:tokenId", async (req, res) => {
  const { tokenId } = req.params;
  const nftAddress = resolveNftAddress(req.query.nft);
  const preferredMarketAddress = typeof req.query.market === "string" ? req.query.market : null;
  if (!/^\d+$/.test(tokenId)) {
    return badRequest(res, "tokenId must be a non-negative integer");
  }
  if (!nftAddress) {
    return badRequest(res, "nft query param must be a valid address");
  }
  if (preferredMarketAddress && !isAddress(preferredMarketAddress)) {
    return badRequest(res, "market query param must be a valid address when provided");
  }
  const marketSources = getConfiguredMarketSources();
  if (!marketSources.length) {
    return badRequest(res, "invalid contract addresses in backend env config");
  }

  try {
    const tokenIdBigInt = BigInt(tokenId);
    const preferredSource = preferredMarketAddress
      ? (getConfiguredMarketSourceByAddress(preferredMarketAddress) ?? {
          key: "preferred",
          label: "Preferred Marketplace",
          address: preferredMarketAddress,
        })
      : null;

    let listing = null;

    if (preferredSource) {
      const direct = await readListingBySource(preferredSource.address, nftAddress, tokenIdBigInt);
      if (direct && direct.active && direct.price > 0n) {
        listing = {
          seller: direct.seller,
          price: direct.price,
          active: true,
          source: preferredSource.key,
          sourceLabel: preferredSource.label,
          marketplace: preferredSource.address,
          inferred: false,
        };
      } else {
        const effectiveFromBlock = await resolveEffectiveFromBlock(undefined);
        const inferred = await inferListingsFromLogsForSource({
          source: preferredSource,
          nftAddress,
          tokenIds: [tokenIdBigInt],
          fromBlock: effectiveFromBlock,
        });
        const preferredInferred = inferred.get(tokenIdBigInt.toString()) ?? null;

        // If preferred market has no active listing, fall back to best listing across configured sources.
        if (preferredInferred && preferredInferred.active && preferredInferred.price > 0n) {
          listing = preferredInferred;
        } else {
          listing = await resolveBestListingForToken({
            nftAddress,
            tokenId: tokenIdBigInt,
            inferFromLogs: true,
          });
        }
      }
    } else {
      listing = await resolveBestListingForToken({
        nftAddress,
        tokenId: tokenIdBigInt,
        inferFromLogs: true,
        preferredMarketAddress,
      });
    }

    return res.json({
      seller: listing.seller,
      price: listing.price.toString(),
      active: listing.active,
      source: listing.source,
      sourceLabel: listing.sourceLabel,
      marketplace: listing.marketplace,
      inferred: listing.inferred,
    });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.get("/marketplace/listings", async (req, res) => {
  const nftAddress = resolveNftAddress(req.query.nft);
  const tokenIdsParam = req.query.tokenIds;
  const inferParam = req.query.infer;
  const preferredMarketAddress = typeof req.query.market === "string" ? req.query.market : null;

  if (!nftAddress) {
    return badRequest(res, "nft query param must be a valid address");
  }
  if (preferredMarketAddress && !isAddress(preferredMarketAddress)) {
    return badRequest(res, "market query param must be a valid address when provided");
  }

  const marketSources = getConfiguredMarketSources();
  if (!marketSources.length) {
    return badRequest(res, "invalid contract addresses in backend env config");
  }

  if (typeof tokenIdsParam !== "string" || !tokenIdsParam.trim()) {
    return badRequest(res, "tokenIds query param is required (comma-separated integers)");
  }

  const tokenIds = tokenIdsParam
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (tokenIds.length === 0 || tokenIds.length > 200) {
    return badRequest(res, "tokenIds must contain between 1 and 200 items");
  }

  for (const tokenId of tokenIds) {
    if (!/^\d+$/.test(tokenId)) {
      return badRequest(res, "tokenIds must only contain non-negative integers");
    }
  }

  const preferredSource = preferredMarketAddress
    ? (getConfiguredMarketSourceByAddress(preferredMarketAddress) ?? {
        key: "preferred",
        label: "Preferred Marketplace",
        address: preferredMarketAddress,
      })
    : null;
  const inferFromLogs = typeof inferParam === "string"
    ? inferParam.toLowerCase() === "true"
    : !!preferredSource && isTempPunksSource(preferredSource);

  try {
    let effectiveFromBlock;
    let inferFromLogsResolved = inferFromLogs;

    if (inferFromLogsResolved) {
      try {
        const latest = await getLatestBlockFast();
        if (latest === undefined) {
          throw new Error("latest block unavailable");
        }
        const lookback = BigInt(Math.max(10_000, BATCH_INFER_LOOKBACK_BLOCKS));
        effectiveFromBlock = latest > lookback ? latest - lookback : 0n;
      } catch {
        // Gracefully degrade to direct listing reads when RPC is rate-limited.
        inferFromLogsResolved = false;
        effectiveFromBlock = undefined;
      }
    }

    const tokenIdBigInts = tokenIds.map((tokenIdText) => BigInt(tokenIdText));
    let inferredByToken = new Map();
    const inferredByTokenAcrossSources = new Map();
    const preferredDirectByToken = preferredSource
      ? ((await withTimeout(
          readListingsBySourceBulk({
            marketAddress: preferredSource.address,
            nftAddress,
            tokenIds: tokenIdBigInts,
          }),
          MARKET_SOURCE_PREFERRED_READ_TIMEOUT_MS
        )) ?? new Map())
      : new Map();

    const bestDirectByToken = new Map();
    const fallbackDirectByToken = new Map();
    if (!preferredSource) {
      const directBySource = await Promise.all(
        marketSources.map(async (source) => ({
          source,
          rows:
            (await withTimeout(
              readListingsBySourceBulk({
                marketAddress: source.address,
                nftAddress,
                tokenIds: tokenIdBigInts,
              }),
              MARKET_SOURCE_READ_TIMEOUT_MS
            )) ?? new Map(),
        }))
      );

      for (const { source, rows } of directBySource) {
        for (const tokenId of tokenIdBigInts) {
          const tokenKey = tokenId.toString();
          const row = rows.get(tokenKey);
          if (!row) continue;
          if (!row.active || row.price <= 0n || String(row.seller || "").toLowerCase() === ZERO_ADDRESS) continue;

          const current = bestDirectByToken.get(tokenKey);
          if (!current || row.price < current.price) {
            bestDirectByToken.set(tokenKey, {
              seller: row.seller,
              price: row.price,
              active: true,
              source: source.key,
              sourceLabel: source.label,
              marketplace: source.address,
              inferred: false,
            });
          }
        }
      }

    if (preferredSource) {
      const otherSources = marketSources.filter(
        (source) => source.address.toLowerCase() !== preferredSource.address.toLowerCase()
      );

      const directBySource = await Promise.all(
        otherSources.map(async (source) => ({
          source,
          rows:
            (await withTimeout(
              readListingsBySourceBulk({
                marketAddress: source.address,
                nftAddress,
                tokenIds: tokenIdBigInts,
              }),
              MARKET_SOURCE_READ_TIMEOUT_MS
            )) ?? new Map(),
        }))
      );

      for (const { source, rows } of directBySource) {
        for (const tokenId of tokenIdBigInts) {
          const tokenKey = tokenId.toString();
          const row = rows.get(tokenKey);
          if (!row || !row.active || row.price <= 0n || String(row.seller || "").toLowerCase() === ZERO_ADDRESS) {
            continue;
          }

          const current = fallbackDirectByToken.get(tokenKey);
          if (!current || row.price < current.price) {
            fallbackDirectByToken.set(tokenKey, {
              seller: row.seller,
              price: row.price,
              active: true,
              source: source.key,
              sourceLabel: source.label,
              marketplace: source.address,
              inferred: false,
            });
          }
        }
      }
    }
    }

    if (inferFromLogsResolved && preferredSource && effectiveFromBlock !== undefined) {
      inferredByToken = await inferListingsFromLogsForSource({
        source: preferredSource,
        nftAddress,
        tokenIds: tokenIdBigInts,
        fromBlock: effectiveFromBlock,
      });
    }

    if (inferFromLogsResolved && !preferredSource && effectiveFromBlock !== undefined) {
      const tempPunksSources = getConfiguredMarketSources().filter((source) => isTempPunksSource(source));
      for (const source of tempPunksSources) {
        const inferredForSource = await inferListingsFromLogsForSource({
          source,
          nftAddress,
          tokenIds: tokenIdBigInts,
          fromBlock: effectiveFromBlock,
        });

        for (const [tokenKey, listing] of inferredForSource.entries()) {
          const current = inferredByTokenAcrossSources.get(tokenKey);
          if (!current || listing.price < current.price) {
            inferredByTokenAcrossSources.set(tokenKey, listing);
          }
        }
      }
    }

    const rows = await Promise.all(
      tokenIdBigInts.map(async (tokenId) => {
        let listing = null;
        const tokenKey = tokenId.toString();

        if (preferredSource) {
          const row = preferredDirectByToken.get(tokenKey);
          if (row && row.active && row.price > 0n) {
            listing = {
              seller: row.seller,
              price: row.price,
              active: true,
              source: preferredSource.key,
              sourceLabel: preferredSource.label,
              marketplace: preferredSource.address,
              inferred: false,
            };
          }
        }

        if (!listing && !preferredSource) {
          listing = bestDirectByToken.get(tokenKey) ?? null;
        }

        if (!listing) {
          listing = inferredByToken.get(tokenKey) ?? null;
        }

        if (!listing && !preferredSource) {
          listing = inferredByTokenAcrossSources.get(tokenKey) ?? null;
        }

        if (!listing && preferredSource) {
          // Preferred market may not host this token; fall back to best listing across sources.
          listing =
            fallbackDirectByToken.get(tokenKey) ??
            bestDirectByToken.get(tokenKey) ??
            inferredByTokenAcrossSources.get(tokenKey) ??
            null;
        }

        if (!listing) {
          listing = {
            seller: ZERO_ADDRESS,
            price: 0n,
            active: false,
            source: null,
            sourceLabel: null,
            marketplace: null,
            inferred: false,
          };
        }

        return {
          tokenId: tokenId.toString(),
          seller: listing.seller,
          price: listing.price.toString(),
          active: listing.active,
          source: listing.source,
          sourceLabel: listing.sourceLabel,
          marketplace: listing.marketplace,
          inferred: listing.inferred,
        };
      })
    );

    return res.json({
      count: rows.length,
      nft: nftAddress,
      inferFromLogs: inferFromLogsResolved,
      listings: rows,
    });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.get("/marketplace/search", async (req, res) => {
  const queryParam = req.query.q;
  const nftAddress = resolveNftAddress(req.query.nft);
  const fromBlockParam = req.query.fromBlock;
  const limitParam = req.query.limit;
  const offsetParam = req.query.offset;

  if (typeof queryParam !== "string" || !queryParam.trim()) {
    return badRequest(res, "q query param is required");
  }

  if (typeof req.query.nft === "string" && !nftAddress) {
    return badRequest(res, "nft query param must be a valid address when provided");
  }

  const marketSources = getConfiguredMarketSources();
  if (!marketSources.length) {
    return badRequest(res, "invalid contract addresses in backend env config");
  }

  let fromBlock;
  if (typeof fromBlockParam === "string") {
    if (!/^\d+$/.test(fromBlockParam)) {
      return badRequest(res, "fromBlock must be a non-negative integer when provided");
    }
    fromBlock = BigInt(fromBlockParam);
  }

  let limit = 50;
  if (typeof limitParam === "string") {
    if (!/^\d+$/.test(limitParam)) {
      return badRequest(res, "limit must be a non-negative integer when provided");
    }
    limit = Math.min(200, Math.max(1, Number(limitParam)));
  }

  let offset = 0;
  if (typeof offsetParam === "string") {
    if (!/^\d+$/.test(offsetParam)) {
      return badRequest(res, "offset must be a non-negative integer when provided");
    }
    offset = Number(offsetParam);
  }

  const q = queryParam.trim();
  const qLower = q.toLowerCase();
  const qIsAddress = isAddress(q);
  const qIsTokenId = /^\d+$/.test(q);
  const qIsTxHash = isTxHash(q);

  try {
    const effectiveFromBlock = await resolveEffectiveFromBlock(fromBlock);

    const mappedBySource = await Promise.all(
      marketSources.map(async (source) => {
        try {
          const [listed, sold, offers] = await Promise.all([
            getLogsForEvents({
              address: source.address,
              fromBlock: effectiveFromBlock,
              events: [ITEM_LISTED_EVENT, LEGACY_LISTED_EVENT, ...COMPAT_LISTED_EVENTS],
            }),
            getLogsForEvents({
              address: source.address,
              fromBlock: effectiveFromBlock,
              events: [ITEM_SOLD_EVENT, LEGACY_SALE_EVENT, ...COMPAT_SALE_EVENTS],
            }),
            getLogsForEvents({
              address: source.address,
              fromBlock: effectiveFromBlock,
              events: [OFFER_MADE_EVENT, LEGACY_OFFER_MADE_EVENT, ...COMPAT_OFFER_EVENTS],
            }),
          ]);

          const customListed = isTempPunksSource(source)
            ? (await getLogsByTopicSafe({
                address: source.address,
                fromBlock: effectiveFromBlock,
                topic0: TEMPPUNKS_LISTED_TOPIC,
              }))
                .map(parseTempPunksListedLog)
                .filter(Boolean)
            : [];

          const listedForNft = [...listed, ...customListed].filter((log) =>
            nftAddress ? sameAddress(extractNft(log.args), nftAddress) : true
          );
          const soldForNft = sold.filter((log) =>
            nftAddress ? sameAddress(extractNft(log.args), nftAddress) : true
          );
          const offersForNft = offers.filter((log) =>
            nftAddress ? sameAddress(extractNft(log.args), nftAddress) : true
          );
          return normalizeMarketplaceEvents(listedForNft, soldForNft, offersForNft, source);
        } catch {
          return [];
        }
      })
    );

    const allEvents = mappedBySource
      .flat()
      .sort((a, b) => {
        const blockA = a.blockNumber ? BigInt(a.blockNumber) : 0n;
        const blockB = b.blockNumber ? BigInt(b.blockNumber) : 0n;
        return Number(blockB - blockA);
      });

    const tokenIdMatch = qIsTokenId ? q : null;

    const matchedEvents = allEvents.filter((event) => {
      if (qIsTxHash) {
        return event.transactionHash.toLowerCase() === qLower;
      }
      if (qIsAddress) {
        return (
          sameAddress(event.seller, q) ||
          sameAddress(event.buyer, q) ||
          sameAddress(event.offerer, q) ||
          sameAddress(event.nft, q) ||
          sameAddress(event.marketplace, q)
        );
      }
      if (tokenIdMatch) {
        return event.tokenId === tokenIdMatch;
      }

      const sourceText = `${event.source ?? ""} ${event.sourceLabel ?? ""}`.toLowerCase();
      return (
        event.type.toLowerCase().includes(qLower) ||
        sourceText.includes(qLower) ||
        (event.tokenId ?? "").includes(q)
      );
    });

    const listings = [];
    if (qIsTokenId) {
      const tokenId = BigInt(q);
      const targetNfts = nftAddress
        ? [nftAddress]
        : isConfiguredAddress(NFT_CONTRACT)
          ? [NFT_CONTRACT]
          : [];

      for (const targetNft of targetNfts) {
        const listing = await resolveBestListingForToken({
          nftAddress: targetNft,
          tokenId,
          inferFromLogs: false,
        });

        listings.push({
          nft: targetNft,
          tokenId: q,
          seller: listing.seller,
          price: listing.price.toString(),
          active: listing.active,
          source: listing.source,
          sourceLabel: listing.sourceLabel,
          marketplace: listing.marketplace,
          inferred: listing.inferred,
        });
      }
    }

    return res.json({
      query: q,
      queryType: qIsTxHash ? "tx" : qIsAddress ? "address" : qIsTokenId ? "token" : "text",
      fromBlock: effectiveFromBlock.toString(),
      limit,
      offset,
      count: Math.max(0, Math.min(limit, matchedEvents.length - offset)),
      totalEvents: matchedEvents.length,
      hasNext: offset + limit < matchedEvents.length,
      events: matchedEvents.slice(offset, offset + limit),
      listings,
    });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.get("/marketplace/active-listings", async (req, res) => {
  const nftAddress = resolveNftAddress(req.query.nft);
  const supplyParam = req.query.supply;
  const startTokenParam = req.query.startTokenId;
  const scanParam = req.query.scan;
  const limitParam = req.query.limit;
  const offsetParam = req.query.offset;
  const sortParam = typeof req.query.sort === "string" ? req.query.sort : "price-asc";
  const preferredMarketAddress = typeof req.query.market === "string" ? req.query.market : null;

  if (!nftAddress) {
    return badRequest(res, "nft query param must be a valid address");
  }
  if (preferredMarketAddress && !isAddress(preferredMarketAddress)) {
    return badRequest(res, "market query param must be a valid address when provided");
  }

  const marketSources = getConfiguredMarketSources();
  if (!marketSources.length) {
    return badRequest(res, "invalid contract addresses in backend env config");
  }

  const supply = typeof supplyParam === "string" && /^\d+$/.test(supplyParam)
    ? Number(supplyParam)
    : 0;
  const startTokenId = typeof startTokenParam === "string" && /^\d+$/.test(startTokenParam)
    ? Number(startTokenParam)
    : 1;
  const scan = typeof scanParam === "string" && /^\d+$/.test(scanParam)
    ? Math.max(1, Number(scanParam))
    : 300;
  const limit = typeof limitParam === "string" && /^\d+$/.test(limitParam)
    ? Math.max(1, Math.min(300, Number(limitParam)))
    : 120;
  const offset = typeof offsetParam === "string" && /^\d+$/.test(offsetParam)
    ? Math.max(0, Number(offsetParam))
    : 0;

  const sort = ["price-asc", "price-desc", "token-asc", "token-desc"].includes(sortParam)
    ? sortParam
    : "price-asc";

  try {
    registerFullListingsIndexTarget({
      nftAddress,
      supply,
      startTokenId,
    });

    const fullIndexSnapshot = getFullListingsSnapshotForNft(nftAddress, supply, startTokenId, {
      allowPartial: true,
    });
    if (fullIndexSnapshot) {
      const sourceFiltered = preferredMarketAddress
        ? fullIndexSnapshot.rows.filter(
            (row) => row.marketplace.toLowerCase() === preferredMarketAddress.toLowerCase()
          )
        : fullIndexSnapshot.rows;

      const sorted = sortListingRows(sourceFiltered, sort);
      const paged = sorted.slice(offset, offset + limit).map((row) => ({
        tokenId: row.tokenId,
        seller: row.seller,
        price: row.price.toString(),
        active: true,
        source: row.source,
        sourceLabel: row.sourceLabel,
        marketplace: row.marketplace,
      }));

      return res.json({
        nft: nftAddress,
        scanned: fullIndexSnapshot.scanned,
        effectiveScanCount: fullIndexSnapshot.scanned,
        sort,
        offset,
        limit,
        count: paged.length,
        total: sorted.length,
        hasNext: offset + limit < sorted.length,
        cache: {
          servedFromCache: true,
          servedStaleCache: false,
          backgroundRefreshStarted: false,
          rebuiltSynchronously: false,
          partial: false,
          processedChunks: null,
          totalChunks: null,
          timedOutSources: [],
          computeMs: null,
          fullIndex: {
            used: true,
            ready: fullIndexSnapshot.ready,
            sweepCount: fullIndexSnapshot.sweepCount,
            cursor: fullIndexSnapshot.cursor,
            updatedAt: fullIndexSnapshot.updatedAt,
          },
        },
        listings: paged,
      });
    }

    // Use collection-specific supply as the effective cap when provided,
    // while retaining a hard safety ceiling for pathological inputs.
    const effectiveCap = supply > 0 ? supply : scan;
    const requestedScanCount = supply > 0 ? supply : scan;
    const scanCount = Math.max(1, Math.min(requestedScanCount, effectiveCap, SCAN_CAP));
    const cacheKey = `${nftAddress.toLowerCase()}:${startTokenId}:${scanCount}:${preferredMarketAddress?.toLowerCase() ?? "all"}`;
    const now = Date.now();
    const cached = activeListingsCache.get(cacheKey);
    const previousCachedRows = Array.isArray(cached?.rows) ? cached.rows : null;
    const previousCachedMeta = cached?.meta ?? null;
    let servedFromCache = false;
    let servedStaleCache = false;
    let backgroundRefreshStarted = false;
    let rebuiltSynchronously = false;

    let activeRows = null;
    let activeRowsMeta = previousCachedMeta;
    if (cached && now - cached.at < ACTIVE_LISTINGS_CACHE_TTL_MS) {
      activeRows = cached.rows;
      servedFromCache = true;
    }

    async function rebuildActiveRows({ respectBudget = true } = {}) {
      const tokenIds = Array.from({ length: scanCount }, (_, idx) => BigInt(startTokenId + idx));
      const bestListingByToken = new Map();
      const CHUNK = SCAN_BATCH_SIZE;
      const CHUNK_CONCURRENCY = SCAN_BATCH_CONCURRENCY;
      const startedAt = Date.now();
      let partial = false;
      let processedChunks = 0;
      let totalChunks = 0;
      const timedOutSources = new Set();
      const preferredSource = preferredMarketAddress
        ? (getConfiguredMarketSourceByAddress(preferredMarketAddress) ?? {
            key: "preferred",
            label: "Preferred Marketplace",
            address: preferredMarketAddress,
          })
        : null;
      const miladySource = !preferredSource
        ? marketSources.find(
            (source) =>
              isConfiguredAddress(MARKETPLACE_CONTRACT) &&
              source.address.toLowerCase() === MARKETPLACE_CONTRACT.toLowerCase()
          )
        : null;
      const stableWhelSource = !preferredSource
        ? marketSources.find((source) => isStableWhelSource(source))
        : null;
      const stableWhelRowsByToken = stableWhelSource
        ? ((await withTimeout(
            readStableWhelListingsMap(stableWhelSource.address, nftAddress),
            STABLEWHEL_PREFETCH_TIMEOUT_MS
          )) ?? null)
        : null;
      let hadSourceTimeout = stableWhelSource ? !(stableWhelRowsByToken instanceof Map) : false;
      if (hadSourceTimeout && stableWhelSource) {
        timedOutSources.add(stableWhelSource.key);
      }

      async function processChunk(tokenChunk, chunkIndex) {
        if (
          respectBudget &&
          chunkIndex > 0 &&
          Date.now() - startedAt > ACTIVE_LISTINGS_REQUEST_BUDGET_MS
        ) {
          partial = true;
          return false;
        }

        if (preferredSource) {
          const rows = (await withTimeout(
            readListingsBySourceBulk({
              marketAddress: preferredSource.address,
              nftAddress,
              tokenIds: tokenChunk,
            }),
            MARKET_SOURCE_PREFERRED_READ_TIMEOUT_MS
          ));

          if (!(rows instanceof Map)) {
            hadSourceTimeout = true;
            timedOutSources.add(preferredSource.key);
          }
          const resolvedRows = rows instanceof Map ? rows : new Map();

          for (const tokenId of tokenChunk) {
            const tokenKey = tokenId.toString();
            const row = resolvedRows.get(tokenKey);
            if (!row || !row.active || row.price <= 0n || String(row.seller || "").toLowerCase() === ZERO_ADDRESS) continue;

            bestListingByToken.set(tokenKey, {
              tokenId: tokenKey,
              seller: row.seller,
              price: row.price,
              active: true,
              source: preferredSource.key,
              sourceLabel: preferredSource.label,
              marketplace: preferredSource.address,
            });
          }
          return true;
        }

        const rowsBySource = await Promise.all(
          marketSources.map(async (source) => {
            if (
              stableWhelSource &&
              source.address.toLowerCase() === stableWhelSource.address.toLowerCase() &&
              stableWhelRowsByToken instanceof Map
            ) {
              return { source, rows: stableWhelRowsByToken };
            }

            const rows =
              (await withTimeout(
                readListingsBySourceBulk({
                  marketAddress: source.address,
                  nftAddress,
                  tokenIds: tokenChunk,
                }),
                isStableWhelSource(source)
                  ? STABLEWHEL_CHUNK_READ_TIMEOUT_MS
                  : miladySource && source.address.toLowerCase() === miladySource.address.toLowerCase()
                    ? MARKET_SOURCE_PREFERRED_READ_TIMEOUT_MS
                  : MARKET_SOURCE_READ_TIMEOUT_MS
              ));

            if (!(rows instanceof Map)) {
              hadSourceTimeout = true;
              timedOutSources.add(source.key);
            }

            return { source, rows: rows instanceof Map ? rows : new Map() };
          })
        );

        for (const { source, rows } of rowsBySource) {
          for (const tokenId of tokenChunk) {
            const tokenKey = tokenId.toString();
            const row = rows.get(tokenKey);
            if (!row || !row.active || row.price <= 0n || String(row.seller || "").toLowerCase() === ZERO_ADDRESS) continue;

            const current = bestListingByToken.get(tokenKey);
            if (!current || row.price < current.price) {
              bestListingByToken.set(tokenKey, {
                tokenId: tokenKey,
                seller: row.seller,
                price: row.price,
                active: true,
                source: source.key,
                sourceLabel: source.label,
                marketplace: source.address,
              });
            }
          }
        }

        return true;
      }

      const batchRun = await runBatchedWithControlledConcurrency({
        items: tokenIds,
        batchSize: CHUNK,
        concurrency: CHUNK_CONCURRENCY,
        processBatch: processChunk,
      });
      processedChunks = batchRun.processedBatches;
      totalChunks = batchRun.totalBatches;

      let rebuiltRows = Array.from(bestListingByToken.values());
      if (hadSourceTimeout && previousCachedRows && previousCachedRows.length > rebuiltRows.length) {
        rebuiltRows = previousCachedRows;
      }
      return {
        rows: rebuiltRows,
        meta: {
          partial,
          processedChunks,
          totalChunks,
          timedOutSources: Array.from(timedOutSources),
          computeMs: Date.now() - startedAt,
        },
      };
    }

    // Serve stale cache immediately and refresh in the background to keep request latency low.
    if (!activeRows && previousCachedRows) {
      activeRows = previousCachedRows;
      servedFromCache = true;
      servedStaleCache = true;
      if (!activeListingsRefreshInFlight.has(cacheKey)) {
        activeListingsRefreshInFlight.add(cacheKey);
        backgroundRefreshStarted = true;
        void (async () => {
          try {
            const rebuilt = await rebuildActiveRows({ respectBudget: false });
            activeListingsCache.set(cacheKey, { at: Date.now(), rows: rebuilt.rows, meta: rebuilt.meta });
          } catch {
            // Keep previous snapshot on background refresh failure.
          } finally {
            activeListingsRefreshInFlight.delete(cacheKey);
          }
        })();
      }
    }

    if (!activeRows) {
      const rebuilt = await rebuildActiveRows({ respectBudget: true });
      activeRows = rebuilt.rows;
      activeRowsMeta = rebuilt.meta;
      activeListingsCache.set(cacheKey, { at: Date.now(), rows: activeRows, meta: activeRowsMeta });
      rebuiltSynchronously = true;
    }

    const sorted = sortListingRows(activeRows, sort);

    const paged = sorted.slice(offset, offset + limit).map((row) => ({
      tokenId: row.tokenId,
      seller: row.seller,
      price: row.price.toString(),
      active: true,
      source: row.source,
      sourceLabel: row.sourceLabel,
      marketplace: row.marketplace,
    }));

    return res.json({
      nft: nftAddress,
      scanned: supply > 0 ? supply : scan,
      effectiveScanCount: scanCount,
      sort,
      offset,
      limit,
      count: paged.length,
      total: sorted.length,
      hasNext: offset + limit < sorted.length,
      cache: {
        servedFromCache,
        servedStaleCache,
        backgroundRefreshStarted,
        rebuiltSynchronously,
        partial: Boolean(activeRowsMeta?.partial),
        processedChunks: activeRowsMeta?.processedChunks ?? null,
        totalChunks: activeRowsMeta?.totalChunks ?? null,
        timedOutSources: activeRowsMeta?.timedOutSources ?? [],
        computeMs: activeRowsMeta?.computeMs ?? null,
      },
      listings: paged,
    });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.get("/marketplace/offer/:tokenId/:offerer", async (req, res) => {
  const { tokenId, offerer } = req.params;
  if (!/^\d+$/.test(tokenId)) {
    return badRequest(res, "tokenId must be a non-negative integer");
  }
  if (!isAddress(offerer)) {
    return badRequest(res, "offerer must be a valid address");
  }
  if (!isConfiguredAddress(MARKETPLACE_CONTRACT) || !isConfiguredAddress(NFT_CONTRACT)) {
    return badRequest(res, "invalid contract addresses in backend env config");
  }

  try {
    const result = await client.readContract({
      address: MARKETPLACE_CONTRACT,
      abi: MARKETPLACE_ABI,
      functionName: "getOffer",
      args: [NFT_CONTRACT, BigInt(tokenId), offerer],
    });

    const [price, expiry, active] = result;
    return res.json({
      price: price.toString(),
      expiry: expiry.toString(),
      active,
    });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.get("/marketplace/activity/:tokenId", async (req, res) => {
  const { tokenId } = req.params;
  const fromBlockParam = req.query.fromBlock;
  const nftAddress = resolveNftAddress(req.query.nft);

  if (!/^\d+$/.test(tokenId)) {
    return badRequest(res, "tokenId must be a non-negative integer");
  }
  if (!nftAddress) {
    return badRequest(res, "nft query param must be a valid address");
  }
  const marketSources = getConfiguredMarketSources();
  if (!marketSources.length) {
    return badRequest(res, "invalid contract addresses in backend env config");
  }

  let fromBlock;
  if (typeof fromBlockParam === "string") {
    if (!/^\d+$/.test(fromBlockParam)) {
      return badRequest(res, "fromBlock must be a non-negative integer when provided");
    }
    fromBlock = BigInt(fromBlockParam);
  }

  const tokenCacheKey = [
    tokenId,
    String(nftAddress).toLowerCase(),
    fromBlock !== undefined ? fromBlock.toString() : "auto",
  ].join(":");
  const cachedTokenResponse = getCachedValue(activityTokenCache, tokenCacheKey, ACTIVITY_CACHE_TTL_MS);
  if (cachedTokenResponse) {
    return res.json(cachedTokenResponse);
  }

  try {
    let latestBlock;
    try {
      latestBlock = await getLatestBlockFast();
    } catch {
      latestBlock = undefined;
    }

    if (fromBlock === undefined && latestBlock === undefined) {
      return res.json({ tokenId, count: 0, events: [] });
    }

    const effectiveFromBlock =
      fromBlock !== undefined
        ? fromBlock
        : latestBlock !== undefined
          ? (latestBlock > BigInt(Math.max(1_000, ACTIVITY_TOKEN_LOOKBACK_BLOCKS))
              ? latestBlock - BigInt(Math.max(1_000, ACTIVITY_TOKEN_LOOKBACK_BLOCKS))
              : 0n)
          : resolveActivityFromBlock(fromBlock, nftAddress, latestBlock);
    const tokenIdBigInt = BigInt(tokenId);
    const sourcesForActivity = getSourcesForActivity(marketSources, nftAddress);
    const mappedBySource = await Promise.all(
      sourcesForActivity.map(async (source) => {
        const rows = await withTimeout(
          fetchActivityRowsForSource({
            source,
            fromBlock: effectiveFromBlock,
            latestBlock,
            nftAddress,
            tokenId: tokenIdBigInt,
          }),
          ACTIVITY_SOURCE_TIMEOUT_MS
        );
        return Array.isArray(rows) ? rows : [];
      })
    );

    let mapped = mappedBySource.flat().sort((a, b) => {
      const blockA = a.blockNumber ? BigInt(a.blockNumber) : 0n;
      const blockB = b.blockNumber ? BigInt(b.blockNumber) : 0n;
      return Number(blockB - blockA);
    });

    if (!mapped.length && fromBlock === undefined) {
      const hintedFromBlock = resolveHintedActivityFromBlock(nftAddress, latestBlock);
      const boundedHintedFromBlock = boundHintedFromBlock(hintedFromBlock, effectiveFromBlock);
      if (
        boundedHintedFromBlock !== null
      ) {
        const hintedBySource = await Promise.all(
          sourcesForActivity.map(async (source) => {
            const rows = await withTimeout(
              fetchActivityRowsForSource({
                source,
                fromBlock: boundedHintedFromBlock,
                latestBlock,
                nftAddress,
                tokenId: tokenIdBigInt,
              }),
              ACTIVITY_SOURCE_TIMEOUT_MS
            );
            return Array.isArray(rows) ? rows : [];
          })
        );

        mapped = hintedBySource.flat().sort((a, b) => {
          const blockA = a.blockNumber ? BigInt(a.blockNumber) : 0n;
          const blockB = b.blockNumber ? BigInt(b.blockNumber) : 0n;
          return Number(blockB - blockA);
        });
      }
    }

    const payload = { tokenId, count: mapped.length, events: mapped };
    setCachedValue(activityTokenCache, tokenCacheKey, payload);
    return res.json(payload);
  } catch (error) {
    const stalePayload = getCachedStaleValue(activityTokenCache, tokenCacheKey);
    if (stalePayload) {
      return res.json(stalePayload);
    }
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.get("/marketplace/activity", async (req, res) => {
  const fromBlockParam = req.query.fromBlock;
  const limitParam = req.query.limit;
  const offsetParam = req.query.offset;
  const typeParam = req.query.type;
  const nftParam = req.query.nft;
  const supplyParam = req.query.supply;
  const startTokenParam = req.query.startTokenId;
  const scanParam = req.query.scan;
  let nftAddress = null;
  let eventType = null;

  if (typeof typeParam === "string" && typeParam.trim().length > 0) {
    const normalizedType = typeParam.trim();
    if (!["ItemListed", "ItemSold", "OfferMade", "ItemCancelled"].includes(normalizedType)) {
      return badRequest(res, "type must be one of ItemListed, ItemSold, OfferMade, ItemCancelled when provided");
    }
    eventType = normalizedType;
  }

  if (typeof nftParam === "string" && nftParam.trim().length > 0) {
    if (!isAddress(nftParam)) {
      return badRequest(res, "nft query param must be a valid address when provided");
    }
    nftAddress = getAddress(nftParam);
  }

  const marketSources = getConfiguredMarketSources();
  if (!marketSources.length) {
    return badRequest(res, "invalid contract addresses in backend env config");
  }

  let fromBlock;
  if (typeof fromBlockParam === "string") {
    if (!/^\d+$/.test(fromBlockParam)) {
      return badRequest(res, "fromBlock must be a non-negative integer when provided");
    }
    fromBlock = BigInt(fromBlockParam);
  }

  let limit = 100;
  if (typeof limitParam === "string") {
    if (!/^\d+$/.test(limitParam)) {
      return badRequest(res, "limit must be a non-negative integer when provided");
    }
    limit = Math.min(Number(limitParam), 500);
  }

  let offset = 0;
  if (typeof offsetParam === "string") {
    if (!/^\d+$/.test(offsetParam)) {
      return badRequest(res, "offset must be a non-negative integer when provided");
    }
    offset = Number(offsetParam);
  }

  const supply = typeof supplyParam === "string" && /^\d+$/.test(supplyParam)
    ? Number(supplyParam)
    : 0;
  const startTokenId = typeof startTokenParam === "string" && /^\d+$/.test(startTokenParam)
    ? Number(startTokenParam)
    : 1;
  const scan = typeof scanParam === "string" && /^\d+$/.test(scanParam)
    ? Math.max(1, Number(scanParam))
    : ACTIVITY_SYNTHETIC_SCAN_DEFAULT;

  const collectionCacheKey = [
    nftAddress ? String(nftAddress).toLowerCase() : "all",
    eventType ?? "all",
    fromBlock !== undefined ? fromBlock.toString() : "auto",
    String(supply),
    String(startTokenId),
    String(scan),
    String(limit),
    String(offset),
  ].join(":");
  const cachedCollectionResponse = getCachedValue(
    activityCollectionCache,
    collectionCacheKey,
    ACTIVITY_CACHE_TTL_MS
  );
  if (cachedCollectionResponse) {
    return res.json(cachedCollectionResponse);
  }

  try {
    let latestBlock;
    try {
      latestBlock = await getLatestBlockFast();
    } catch {
      latestBlock = undefined;
    }

    if (fromBlock === undefined && latestBlock === undefined) {
      if (nftAddress) {
        const syntheticRows = await synthesizeListingActivityRows({
          marketSources,
          nftAddress,
          supply,
          startTokenId,
          scan,
        });
        const filtered = syntheticRows.filter((event) => (eventType ? event.type === eventType : true));
        const paged = filtered.slice(offset, offset + limit);
        const payload = {
          count: paged.length,
          total: filtered.length,
          nft: nftAddress,
          limit,
          offset,
          hasNext: offset + paged.length < filtered.length,
          events: paged,
        };
        setCachedValue(activityCollectionCache, collectionCacheKey, payload);
        return res.json(payload);
      }

      return res.json({
        count: 0,
        total: 0,
        nft: nftAddress,
        limit,
        offset,
        hasNext: false,
        events: [],
      });
    }

    const effectiveFromBlock = resolveActivityFromBlock(fromBlock, nftAddress, latestBlock);
    const sourcesForActivity = getSourcesForActivity(marketSources, nftAddress);
    const sourceResults = await Promise.all(
      sourcesForActivity.map(async (source) => {
        const startedAt = Date.now();
        const rows = await withTimeout(
          fetchActivityRowsForSource({
            source,
            fromBlock: effectiveFromBlock,
            latestBlock,
            nftAddress,
          }),
          ACTIVITY_SOURCE_TIMEOUT_MS
        );
        return {
          source,
          rows: Array.isArray(rows) ? rows : [],
          timedOut: rows === null,
          durationMs: Date.now() - startedAt,
        };
      })
    );
    const mappedBySource = sourceResults.map((result) => result.rows);
    const allSourcesTimedOut = sourceResults.length > 0 && sourceResults.every((result) => result.timedOut);

    let mapped = mappedBySource
      .flat()
      .filter((event) => (eventType ? event.type === eventType : true))
      .sort((a, b) => {
        const blockA = a.blockNumber ? BigInt(a.blockNumber) : 0n;
        const blockB = b.blockNumber ? BigInt(b.blockNumber) : 0n;
        return Number(blockB - blockA);
      });

    const hasSalesInMapped = mapped.some((event) => event.type === "ItemSold");
    const shouldExpandForSales = !eventType && nftAddress && !hasSalesInMapped;

    if ((!mapped.length || shouldExpandForSales) && fromBlock === undefined && nftAddress) {
      const hintedFromBlock = resolveHintedActivityFromBlock(nftAddress, latestBlock);
      const boundedHintedFromBlock = boundHintedFromBlock(hintedFromBlock, effectiveFromBlock);
      if (
        boundedHintedFromBlock !== null
      ) {
        const hintedBySource = await Promise.all(
          sourcesForActivity.map(async (source) => {
            const rows = await withTimeout(
              fetchActivityRowsForSource({
                source,
                fromBlock: boundedHintedFromBlock,
                latestBlock,
                nftAddress,
              }),
              ACTIVITY_SOURCE_TIMEOUT_MS
            );
            return Array.isArray(rows) ? rows : [];
          })
        );

        const hintedMapped = hintedBySource
          .flat()
          .filter((event) => (eventType ? event.type === eventType : true))
          .sort((a, b) => {
            const blockA = a.blockNumber ? BigInt(a.blockNumber) : 0n;
            const blockB = b.blockNumber ? BigInt(b.blockNumber) : 0n;
            return Number(blockB - blockA);
          });

        if (!mapped.length) {
          mapped = hintedMapped;
        } else if (hintedMapped.length) {
          const dedup = new Map();
          for (const event of [...mapped, ...hintedMapped]) {
            const key = `${event.type}:${event.marketplace ?? ""}:${event.transactionHash ?? ""}:${event.logIndex ?? ""}:${event.tokenId ?? ""}`;
            if (!dedup.has(key)) {
              dedup.set(key, event);
            }
          }
          mapped = Array.from(dedup.values()).sort((a, b) => {
            const blockA = a.blockNumber ? BigInt(a.blockNumber) : 0n;
            const blockB = b.blockNumber ? BigInt(b.blockNumber) : 0n;
            return Number(blockB - blockA);
          });
        }
      }
    }

    if (!mapped.length && nftAddress) {
      mapped = await synthesizeListingActivityRows({
        marketSources,
        nftAddress,
        supply,
        startTokenId,
        scan,
      });
    }

    if (!mapped.length && allSourcesTimedOut) {
      const stalePayload = getCachedStaleValue(activityCollectionCache, collectionCacheKey);
      if (stalePayload) {
        return res.json(stalePayload);
      }
    }

    const paged = mapped.slice(offset, offset + limit);
    const payload = {
      count: paged.length,
      total: mapped.length,
      nft: nftAddress,
      limit,
      offset,
      hasNext: offset + paged.length < mapped.length,
      events: paged,
    };
    setCachedValue(activityCollectionCache, collectionCacheKey, payload);
    return res.json(payload);
  } catch (error) {
    const stalePayload = getCachedStaleValue(activityCollectionCache, collectionCacheKey);
    if (stalePayload) {
      return res.json(stalePayload);
    }
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.get("/marketplace/active-offers", async (req, res) => {
  const nftAddress = resolveNftAddress(req.query.nft);
  const limitParam = req.query.limit;
  const offsetParam = req.query.offset;
  const fromBlockParam = req.query.fromBlock;

  if (!nftAddress) {
    return badRequest(res, "nft query param must be a valid address");
  }

  const marketSources = getConfiguredMarketSources();
  if (!marketSources.length) {
    return badRequest(res, "invalid marketplace contract address in backend env config");
  }

  const limit = typeof limitParam === "string" && /^\d+$/.test(limitParam)
    ? Math.max(1, Math.min(200, Number(limitParam)))
    : 50;
  const offset = typeof offsetParam === "string" && /^\d+$/.test(offsetParam)
    ? Math.max(0, Number(offsetParam))
    : 0;

  let fromBlock;
  if (typeof fromBlockParam === "string") {
    if (!/^\d+$/.test(fromBlockParam)) {
      return badRequest(res, "fromBlock must be a non-negative integer when provided");
    }
    fromBlock = BigInt(fromBlockParam);
  }

  const cacheKey = [
    String(nftAddress).toLowerCase(),
    fromBlock !== undefined ? fromBlock.toString() : "auto",
    String(limit),
    String(offset),
  ].join(":");

  const cached = getCachedValue(activeOffersCache, cacheKey, ACTIVE_OFFERS_CACHE_TTL_MS);
  if (cached) {
    return res.json(cached);
  }

  try {
    let latestBlock;
    try {
      latestBlock = await getLatestBlockFast();
    } catch {
      latestBlock = undefined;
    }

    if (fromBlock === undefined && latestBlock === undefined) {
      return res.json({
        nft: nftAddress,
        count: 0,
        total: 0,
        limit,
        offset,
        hasNext: false,
        offers: [],
        cache: { servedFromCache: false, stale: false },
      });
    }

    const effectiveFromBlock = resolveActivityFromBlock(fromBlock, nftAddress, latestBlock);
    const sourcesForActivity = getSourcesForActivity(marketSources, nftAddress);

    const sourceResults = await Promise.all(
      sourcesForActivity.map(async (source) => {
        const rows = await withTimeout(
          fetchActivityRowsForSource({
            source,
            fromBlock: effectiveFromBlock,
            latestBlock,
            nftAddress,
          }),
          ACTIVITY_SOURCE_TIMEOUT_MS
        );
        return {
          source,
          rows: Array.isArray(rows) ? rows : [],
          timedOut: rows === null,
        };
      })
    );

    const timedOutSources = sourceResults.filter((row) => row.timedOut).map((row) => row.source.key);
    const nowSec = Math.floor(Date.now() / 1000);
    const candidates = sourceResults
      .flatMap((row) => row.rows)
      .filter((event) => event.type === "OfferMade")
      .filter((event) => {
        if (!event.tokenId || !event.offerer) return false;
        if (!event.price || BigInt(event.price) <= 0n) return false;
        if (!event.expiry) return true;
        const expiry = Number(event.expiry);
        if (!Number.isFinite(expiry) || expiry <= 0) return true;
        return expiry > nowSec;
      })
      .sort((a, b) => {
        const blockA = a.blockNumber ? BigInt(a.blockNumber) : 0n;
        const blockB = b.blockNumber ? BigInt(b.blockNumber) : 0n;
        return Number(blockB - blockA);
      });

    const deduped = [];
    const seen = new Set();
    for (const event of candidates) {
      const key = `${String(event.marketplace || "").toLowerCase()}:${event.tokenId}:${String(event.offerer).toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(event);
    }

    const paged = deduped.slice(offset, offset + limit).map((event) => ({
      type: event.type,
      source: event.source,
      sourceLabel: event.sourceLabel,
      marketplace: event.marketplace,
      nft: event.nft,
      tokenId: event.tokenId,
      offerer: event.offerer,
      price: event.price,
      expiry: event.expiry,
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash,
    }));

    const payload = {
      nft: nftAddress,
      count: paged.length,
      total: deduped.length,
      limit,
      offset,
      hasNext: offset + paged.length < deduped.length,
      offers: paged,
      meta: {
        timedOutSources,
        fromBlock: effectiveFromBlock.toString(),
      },
      cache: {
        servedFromCache: false,
        stale: false,
      },
    };
    setCachedValue(activeOffersCache, cacheKey, payload, ACTIVITY_CACHE_MAX_ENTRIES);
    return res.json(payload);
  } catch (error) {
    const stale = getCachedStaleValue(activeOffersCache, cacheKey);
    if (stale) {
      return res.json({
        ...stale,
        cache: {
          servedFromCache: true,
          stale: true,
        },
      });
    }
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.get("/marketplace/debug/sources", async (req, res) => {
  const fromBlockParam = req.query.fromBlock;
  const lookbackParam = req.query.lookback;
  const nftAddress = resolveNftAddress(req.query.nft);
  const tokenIdParam = req.query.tokenId;

  if (!nftAddress) {
    return badRequest(res, "nft query param must be a valid address");
  }

  let tokenId;
  if (typeof tokenIdParam === "string" && tokenIdParam.length > 0) {
    if (!/^\d+$/.test(tokenIdParam)) {
      return badRequest(res, "tokenId must be a non-negative integer when provided");
    }
    tokenId = BigInt(tokenIdParam);
  }

  let fromBlock;
  if (typeof fromBlockParam === "string") {
    if (!/^\d+$/.test(fromBlockParam)) {
      return badRequest(res, "fromBlock must be a non-negative integer when provided");
    }
    fromBlock = BigInt(fromBlockParam);
  }

  const requestedLookback =
    typeof lookbackParam === "string" && /^\d+$/.test(lookbackParam)
      ? Number(lookbackParam)
      : INDEXER_LOOKBACK_BLOCKS;
  const lookback = Math.min(
    Math.max(1_000, requestedLookback),
    Math.max(1_000, MAX_LOG_BLOCK_RANGE)
  );

  const marketSources = getConfiguredMarketSources();
  if (!marketSources.length) {
    return badRequest(res, "invalid marketplace contract address in backend env config");
  }

  try {
    const latestBlock = await client.getBlockNumber();
    const effectiveFromBlock =
      fromBlock !== undefined
        ? fromBlock
        : latestBlock > BigInt(lookback)
          ? latestBlock - BigInt(lookback)
          : 0n;

    const sources = await Promise.all(
      marketSources.map(async (source) => {
        const result = {
          key: source.key,
          label: source.label,
          marketplace: source.address,
          raw: {
            listed: 0,
            sold: 0,
            offers: 0,
          },
          filtered: {
            listed: 0,
            sold: 0,
            offers: 0,
          },
          errors: {
            listed: null,
            sold: null,
            offers: null,
          },
        };

        try {
          const listedResults = await Promise.all(
            [ITEM_LISTED_EVENT, LEGACY_LISTED_EVENT, ...COMPAT_LISTED_EVENTS].filter(Boolean).map((event) =>
              getLogsWithError({
                address: source.address,
                fromBlock: effectiveFromBlock,
                event,
              })
            )
          );
          const listedAll = listedResults.flatMap((entry) => entry.logs);
          result.errors.listed = listedResults.map((entry) => entry.error).filter(Boolean).join(" | ") || null;
          result.raw.listed = listedAll.length;
          result.filtered.listed = listedAll.filter((log) => {
            if (!sameAddress(extractNft(log.args), nftAddress)) return false;
            return tokenId !== undefined ? extractTokenId(log.args) === tokenId : true;
          }).length;
        } catch {}

        try {
          const soldResults = await Promise.all(
            [ITEM_SOLD_EVENT, LEGACY_SALE_EVENT, ...COMPAT_SALE_EVENTS].filter(Boolean).map((event) =>
              getLogsWithError({
                address: source.address,
                fromBlock: effectiveFromBlock,
                event,
              })
            )
          );
          const soldAll = soldResults.flatMap((entry) => entry.logs);
          result.errors.sold = soldResults.map((entry) => entry.error).filter(Boolean).join(" | ") || null;
          result.raw.sold = soldAll.length;
          result.filtered.sold = soldAll.filter((log) => {
            if (!sameAddress(extractNft(log.args), nftAddress)) return false;
            return tokenId !== undefined ? extractTokenId(log.args) === tokenId : true;
          }).length;
        } catch {}

        try {
          const offerResults = await Promise.all(
            [OFFER_MADE_EVENT, LEGACY_OFFER_MADE_EVENT, ...COMPAT_OFFER_EVENTS].filter(Boolean).map((event) =>
              getLogsWithError({
                address: source.address,
                fromBlock: effectiveFromBlock,
                event,
              })
            )
          );
          const offerAll = offerResults.flatMap((entry) => entry.logs);
          result.errors.offers = offerResults.map((entry) => entry.error).filter(Boolean).join(" | ") || null;
          result.raw.offers = offerAll.length;
          result.filtered.offers = offerAll.filter((log) => {
            if (!sameAddress(extractNft(log.args), nftAddress)) return false;
            return tokenId !== undefined ? extractTokenId(log.args) === tokenId : true;
          }).length;
        } catch {}

        return result;
      })
    );

    return res.json({
      nft: nftAddress,
      tokenId: tokenId?.toString() ?? null,
      latestBlock: latestBlock.toString(),
      fromBlock: effectiveFromBlock.toString(),
      lookbackUsed: lookback,
      requestedLookback,
      maxLogBlockRange: MAX_LOG_BLOCK_RANGE,
      sources,
    });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.get("/marketplace/collection-stats", async (req, res) => {
  const nftAddress = resolveNftAddress(req.query.nft);
  const supplyParam = req.query.supply;
  const startTokenParam = req.query.startTokenId;
  const scanParam = req.query.scan;
  const includeSalesParam = req.query.includeSales;

  if (!nftAddress) {
    return badRequest(res, "nft query param must be a valid address");
  }
  const marketSources = getConfiguredMarketSources();
  if (!marketSources.length) {
    return badRequest(res, "invalid marketplace contract address in backend env config");
  }

  const supply = typeof supplyParam === "string" && /^\d+$/.test(supplyParam)
    ? Number(supplyParam)
    : 0;
  const startTokenId = typeof startTokenParam === "string" && /^\d+$/.test(startTokenParam)
    ? Number(startTokenParam)
    : 1;
  const scan = typeof scanParam === "string" && /^\d+$/.test(scanParam)
    ? Math.max(1, Number(scanParam))
    : 300;
  const includeSales =
    includeSalesParam === undefined
      ? true
      : includeSalesParam === "1" || includeSalesParam === "true";

  try {
    const scanCount = supply > 0 ? supply : scan;
    const cacheKey = `${nftAddress.toLowerCase()}:${startTokenId}:${scanCount}`;
    const cacheNow = Date.now();
    const cached = collectionStatsCache.get(cacheKey);
    if (cached && cacheNow - cached.at < COLLECTION_STATS_CACHE_TTL_MS) {
      return res.json(cached.payload);
    }

    const startedAt = Date.now();
    const boundedScanCount = Math.max(1, Math.min(scanCount, SCAN_CAP));
    const listingsBySource = {};
    const timedOutSources = new Set();

    let totalSales = 0;
    let totalVolume = 0n;
    let salesFromBlock = null;
    let salesFromCache = false;
    let salesStale = false;
    if (includeSales) {
      const salesSnapshot = await getSalesStatsCached(nftAddress);
      totalSales = salesSnapshot.stats.totalSales;
      totalVolume = salesSnapshot.stats.totalVolume;
      salesFromBlock = salesSnapshot.stats.fromBlock.toString();
      salesFromCache = salesSnapshot.fromCache;
      salesStale = salesSnapshot.stale;
      for (const key of salesSnapshot.stats.timedOutSources) {
        timedOutSources.add(key);
      }
    }

    const bestListingByToken = new Map();
    let usedFullListingsIndex = false;
    let usedActiveListingsSnapshot = false;
    let scanned = boundedScanCount;
    let partial = false;
    let processedChunks = 0;
    let totalChunks = 0;

    registerFullListingsIndexTarget({
      nftAddress,
      supply,
      startTokenId,
    });

    const fullIndexSnapshot = getFullListingsSnapshotForNft(nftAddress, supply, startTokenId, {
      allowPartial: true,
    });
    const freshestActiveSnapshot = getFreshestActiveListingsSnapshotForNft(nftAddress);
    if (fullIndexSnapshot && Array.isArray(fullIndexSnapshot.rows) && fullIndexSnapshot.rows.length) {
      usedFullListingsIndex = true;
      usedActiveListingsSnapshot = true;
      scanned = fullIndexSnapshot.scanned;
      for (const row of fullIndexSnapshot.rows) {
        if (!row || !row.active || row.price <= 0n) continue;
        if (String(row.seller || "").toLowerCase() === ZERO_ADDRESS) continue;

        listingsBySource[row.source] = (listingsBySource[row.source] ?? 0) + 1;
        bestListingByToken.set(row.tokenId, {
          seller: row.seller,
          price: row.price,
          active: true,
        });
      }
    } else if (freshestActiveSnapshot && Array.isArray(freshestActiveSnapshot.rows) && freshestActiveSnapshot.rows.length) {
      usedActiveListingsSnapshot = true;
      scanned = freshestActiveSnapshot.rows.length;
      for (const row of freshestActiveSnapshot.rows) {
        if (!row || !row.active || row.price <= 0n) continue;
        if (String(row.seller || "").toLowerCase() === ZERO_ADDRESS) continue;

        listingsBySource[row.source] = (listingsBySource[row.source] ?? 0) + 1;
        bestListingByToken.set(row.tokenId, {
          seller: row.seller,
          price: row.price,
          active: true,
        });
      }
    } else {
      const tokenIds = Array.from({ length: boundedScanCount }, (_, idx) => BigInt(startTokenId + idx));
      const CHUNK = SCAN_BATCH_SIZE;
      const CHUNK_CONCURRENCY = SCAN_BATCH_CONCURRENCY;
      scanned = 0;

      async function processChunk(tokenChunk) {
        const elapsedMs = Date.now() - startedAt;
        const remainingBudgetMs = COLLECTION_STATS_REQUEST_BUDGET_MS - elapsedMs;
        if (remainingBudgetMs <= 0 && scanned > 0) {
          partial = true;
          return false;
        }

        const rowsBySource = await Promise.all(
          marketSources.map(async (source) => {
            const sourceTimeoutMs = Math.max(
              500,
              Math.min(
                isStableWhelSource(source)
                  ? STABLEWHEL_CHUNK_READ_TIMEOUT_MS
                  : MARKET_SOURCE_PREFERRED_READ_TIMEOUT_MS,
                Math.max(500, COLLECTION_STATS_REQUEST_BUDGET_MS - (Date.now() - startedAt))
              )
            );
            const rows = await withTimeout(
              readListingsBySourceBulk({
                marketAddress: source.address,
                nftAddress,
                tokenIds: tokenChunk,
              }),
              sourceTimeoutMs
            );
            if (!(rows instanceof Map)) {
              timedOutSources.add(source.key);
            }
            return {
              source,
              rows: rows instanceof Map ? rows : new Map(),
            };
          })
        );

        for (const { source, rows } of rowsBySource) {
          if (listingsBySource[source.key] === undefined) {
            listingsBySource[source.key] = 0;
          }
          for (const tokenId of tokenChunk) {
            const tokenKey = tokenId.toString();
            const row = rows.get(tokenKey);
            if (!row || !row.active || row.price <= 0n) continue;
            if (String(row.seller || "").toLowerCase() === ZERO_ADDRESS) continue;

            listingsBySource[source.key] += 1;
            const current = bestListingByToken.get(tokenKey);
            if (!current || row.price < current.price) {
              bestListingByToken.set(tokenKey, {
                seller: row.seller,
                price: row.price,
                active: true,
              });
            }
          }
        }

        scanned += tokenChunk.length;

        return true;
      }

      const batchRun = await runBatchedWithControlledConcurrency({
        items: tokenIds,
        batchSize: CHUNK,
        concurrency: CHUNK_CONCURRENCY,
        processBatch: processChunk,
      });
      processedChunks = batchRun.processedBatches;
      totalChunks = batchRun.totalBatches;
      scanned = Math.min(boundedScanCount, scanned);
    }

    let activeListings = 0;
    let floorPrice = null;
    for (const row of bestListingByToken.values()) {
      if (!row || row.price <= 0n) continue;
      activeListings += 1;
      if (floorPrice === null || row.price < floorPrice) {
        floorPrice = row.price;
      }
    }

    const payload = {
      nft: nftAddress,
      scanned,
      activeListings,
      floorPrice: floorPrice ? floorPrice.toString() : null,
      totalSales,
      totalVolume: totalVolume.toString(),
      listingsBySource,
      meta: {
        usedFullListingsIndex,
        usedActiveListingsSnapshot,
        includeSales,
        salesFromBlock,
        salesFromCache,
        salesStale,
        partial,
        processedChunks,
        totalChunks,
        timedOutSources: Array.from(timedOutSources),
        computeMs: Date.now() - startedAt,
      },
    };

    collectionStatsCache.set(cacheKey, { at: cacheNow, payload });
    return res.json(payload);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.get("/launchpad/project/:collection", async (req, res) => {
  const { collection } = req.params;
  if (!isAddress(collection)) {
    return badRequest(res, "collection must be a valid address");
  }
  if (!isConfiguredAddress(LAUNCHPAD_CONTRACT)) {
    return badRequest(res, "invalid launchpad contract address in backend env config");
  }

  try {
    if (HAS_GET_PROJECT) {
      const result = await withTimeout(
        readContractWithRetry({
          address: LAUNCHPAD_CONTRACT,
          abi: LAUNCHPAD_ABI,
          functionName: "getProject",
          args: [collection],
        }),
        LAUNCHPAD_READ_TIMEOUT_MS
      );

      if (!result) {
        throw new Error("launchpad project read timed out");
      }

      const [creator, collectionAddress, payoutRecipient, active, registeredToMarketplace, platformFeeBps, createdAt] = result;
      return res.json({
        creator,
        collection: collectionAddress,
        payoutRecipient,
        active,
        registeredToMarketplace,
        platformFeeBps: platformFeeBps.toString(),
        createdAt: createdAt.toString(),
      });
    }

    const fallbackResult = await withTimeout(
      Promise.all([
        readContractWithRetry({
          address: LAUNCHPAD_CONTRACT,
          abi: LAUNCHPAD_ABI,
          functionName: "collectionCreator",
          args: [collection],
        }),
        readContractWithRetry({
          address: LAUNCHPAD_CONTRACT,
          abi: LAUNCHPAD_ABI,
          functionName: "isLaunchpadCollection",
          args: [collection],
        }),
      ]),
      LAUNCHPAD_READ_TIMEOUT_MS
    );

    if (!fallbackResult) {
      throw new Error("launchpad project fallback read timed out");
    }

    const [creator, registered] = fallbackResult;

    return res.json({
      creator,
      collection: getAddress(collection),
      payoutRecipient: null,
      active: null,
      registeredToMarketplace: registered,
      platformFeeBps: null,
      createdAt: null,
    });
  } catch {
    return res.json({
      creator: ZERO_ADDRESS,
      collection: getAddress(collection),
      payoutRecipient: null,
      active: null,
      registeredToMarketplace: false,
      platformFeeBps: null,
      createdAt: null,
      warning: "launchpad project read unavailable",
    });
  }
});

app.get("/launchpad/creator/:creator", async (req, res) => {
  const { creator } = req.params;
  if (!isAddress(creator)) {
    return badRequest(res, "creator must be a valid address");
  }
  if (!isConfiguredAddress(LAUNCHPAD_CONTRACT)) {
    return badRequest(res, "invalid launchpad contract address in backend env config");
  }

  try {
    const collections = await withTimeout(
      readContractWithRetry({
        address: LAUNCHPAD_CONTRACT,
        abi: LAUNCHPAD_ABI,
        functionName: "getCreatorCollections",
        args: [creator],
      }),
      LAUNCHPAD_READ_TIMEOUT_MS
    );

    if (!collections) {
      throw new Error("creator collections read timed out");
    }

    return res.json({ collections });
  } catch {
    return res.json({
      collections: [],
      warning: "creator collections read unavailable",
    });
  }
});

app.get("/wl/:collection/:phaseId", async (req, res) => {
  const { collection, phaseId } = req.params;

  try {
    const allowlist = await getAllowlist(collection, phaseId);
    return res.json(allowlist);
  } catch (error) {
    return badRequest(res, error instanceof Error ? error.message : String(error));
  }
});

app.post("/wl/:collection/:phaseId/add", async (req, res) => {
  const { collection, phaseId } = req.params;
  const addresses = Array.isArray(req.body?.addresses) ? req.body.addresses : null;

  if (!addresses) {
    return badRequest(res, "addresses array is required in request body");
  }

  try {
    const result = await upsertAllowlist(collection, phaseId, addresses, []);
    return res.json({ ok: true, ...result });
  } catch (error) {
    return badRequest(res, error instanceof Error ? error.message : String(error));
  }
});

app.post("/wl/:collection/:phaseId/remove", async (req, res) => {
  const { collection, phaseId } = req.params;
  const addresses = Array.isArray(req.body?.addresses) ? req.body.addresses : null;

  if (!addresses) {
    return badRequest(res, "addresses array is required in request body");
  }

  try {
    const result = await upsertAllowlist(collection, phaseId, [], addresses);
    return res.json({ ok: true, ...result });
  } catch (error) {
    return badRequest(res, error instanceof Error ? error.message : String(error));
  }
});

app.post("/wl/:collection/:phaseId/reset", async (req, res) => {
  const { collection, phaseId } = req.params;

  try {
    const current = await getAllowlist(collection, phaseId);
    const result = await upsertAllowlist(collection, phaseId, [], current.addresses);
    return res.json({ ok: true, ...result });
  } catch (error) {
    return badRequest(res, error instanceof Error ? error.message : String(error));
  }
});

app.post("/wl/:collection/:phaseId/rebuild", async (req, res) => {
  const { collection, phaseId } = req.params;

  try {
    const result = await rebuildAllowlist(collection, phaseId);
    return res.json({ ok: true, ...result });
  } catch (error) {
    return badRequest(res, error instanceof Error ? error.message : String(error));
  }
});

app.get("/wl/:collection/:phaseId/proof/:account", async (req, res) => {
  const { collection, phaseId, account } = req.params;

  try {
    const proof = await getProof(collection, phaseId, account);
    return res.json(proof);
  } catch (error) {
    return badRequest(res, error instanceof Error ? error.message : String(error));
  }
});

app.get("/wl/:collection/:phaseId/verify/:account", async (req, res) => {
  const { collection, phaseId, account } = req.params;

  if (!isAddress(collection)) {
    return badRequest(res, "collection must be a valid address");
  }
  if (!/^\d+$/.test(phaseId)) {
    return badRequest(res, "phaseId must be a non-negative integer");
  }
  if (!isAddress(account)) {
    return badRequest(res, "account must be a valid address");
  }

  try {
    const normalizedCollection = getAddress(collection);
    const normalizedAccount = getAddress(account);
    const phaseIdBigInt = BigInt(phaseId);

    const [proofRow, onchainPhase] = await Promise.all([
      getProof(normalizedCollection, phaseId, normalizedAccount),
      readContractWithRetry({
        address: normalizedCollection,
        abi: LAUNCHPAD_COLLECTION_PHASE_ABI,
        functionName: "phases",
        args: [phaseIdBigInt],
      }),
    ]);

    if (!onchainPhase || !Array.isArray(onchainPhase) || onchainPhase.length < 8) {
      return badRequest(res, "unable to read onchain phase data");
    }

    const onchainMerkleRoot = String(onchainPhase[7]);
    const backendMerkleRoot = proofRow.merkleRoot;
    const proof = Array.isArray(proofRow.proof) ? proofRow.proof : [];
    const treeMode = getMerkleTreeMode();
    const isProofValidForOnchainRoot = verifyProofAgainstRoot(
      onchainMerkleRoot,
      normalizedAccount,
      proof,
      treeMode
    );
    const isProofValidSimple = verifyProofAgainstRoot(
      onchainMerkleRoot,
      normalizedAccount,
      proof,
      "simple"
    );
    const isProofValidStandard = verifyProofAgainstRoot(
      onchainMerkleRoot,
      normalizedAccount,
      proof,
      "standard"
    );

    return res.json({
      collection: normalizedCollection,
      phaseId: phaseIdBigInt.toString(),
      account: normalizedAccount,
      treeMode,
      includedInBackendAllowlist: Boolean(proofRow.included),
      onchainMerkleRoot,
      backendMerkleRoot,
      rootsMatch: onchainMerkleRoot.toLowerCase() === backendMerkleRoot.toLowerCase(),
      proof,
      isProofValidForOnchainRoot,
      isProofValidSimple,
      isProofValidStandard,
    });
  } catch (error) {
    return badRequest(res, error instanceof Error ? error.message : String(error));
  }
});

app.get("/wl/:collection/proofs/:account", async (req, res) => {
  const { collection, account } = req.params;
  const rawPhaseIds = String(req.query?.phaseIds ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (!rawPhaseIds.length) {
    return badRequest(res, "phaseIds query param is required (comma-separated)");
  }

  try {
    const result = await getProofsByPhase(collection, rawPhaseIds, account);
    return res.json(result);
  } catch (error) {
    return badRequest(res, error instanceof Error ? error.message : String(error));
  }
});

app.post("/wl/:collection/:phaseId/import-csv", async (req, res) => {
  const { collection, phaseId } = req.params;
  const csv = req.body?.csv;

  if (typeof csv !== "string") {
    return badRequest(res, "csv string is required in request body");
  }

  try {
    const parsedAddresses = parseAddressesFromCsv(csv);
    const current = await getAllowlist(collection, phaseId);
    const result = await upsertAllowlist(collection, phaseId, parsedAddresses, current.addresses);
    return res.json({
      ok: true,
      mode: "replace",
      imported: parsedAddresses.length,
      ...result,
    });
  } catch (error) {
    return badRequest(res, error instanceof Error ? error.message : String(error));
  }
});

app.get("/wl/:collection/:phaseId/sync-payload", async (req, res) => {
  const { collection, phaseId } = req.params;

  if (!isAddress(collection)) {
    return badRequest(res, "collection must be a valid address");
  }
  if (!/^\d+$/.test(phaseId)) {
    return badRequest(res, "phaseId must be a non-negative integer");
  }

  try {
    if (!HAS_SET_PHASE_MERKLE_ROOT) {
      return badRequest(
        res,
        "creatorSetPhaseMerkleRoot is not available on current Launchpad manager ABI; use creatorUpdatePhase in your manager flow"
      );
    }

    const allowlist = await getAllowlist(collection, phaseId);
    const normalizedCollection = getAddress(collection);
    const phaseIdBigInt = BigInt(phaseId);
    const calldata = encodeFunctionData({
      abi: SET_PHASE_MERKLE_ROOT_ABI,
      functionName: "creatorSetPhaseMerkleRoot",
      args: [normalizedCollection, phaseIdBigInt, allowlist.merkleRoot],
    });

    return res.json({
      launchpadContract: isConfiguredAddress(LAUNCHPAD_CONTRACT) ? LAUNCHPAD_CONTRACT : null,
      functionName: "creatorSetPhaseMerkleRoot",
      args: [normalizedCollection, phaseIdBigInt.toString(), allowlist.merkleRoot],
      calldata,
      merkleRoot: allowlist.merkleRoot,
      count: allowlist.count,
      updatedAt: allowlist.updatedAt,
    });
  } catch (error) {
    return badRequest(res, error instanceof Error ? error.message : String(error));
  }
});

app.post("/wl/:collection/:phaseId/sync-update-phase-payload", async (req, res) => {
  const { collection, phaseId } = req.params;

  if (!isAddress(collection)) {
    return badRequest(res, "collection must be a valid address");
  }
  if (!/^\d+$/.test(phaseId)) {
    return badRequest(res, "phaseId must be a non-negative integer");
  }
  if (!HAS_UPDATE_PHASE) {
    return badRequest(res, "creatorUpdatePhase is not available on current Launchpad manager ABI");
  }

  const name = req.body?.name;
  const startTime = req.body?.startTime;
  const endTime = req.body?.endTime;
  const priceWei = req.body?.priceWei;
  const maxPerWallet = req.body?.maxPerWallet;
  const phaseSupply = req.body?.phaseSupply;
  const isPublic = req.body?.isPublic;
  const active = req.body?.active;

  if (typeof name !== "string" || !name.trim()) {
    return badRequest(res, "name is required");
  }
  if (typeof isPublic !== "boolean") {
    return badRequest(res, "isPublic must be a boolean");
  }
  if (typeof active !== "boolean") {
    return badRequest(res, "active must be a boolean");
  }

  try {
    const normalizedCollection = getAddress(collection);
    const phaseIdBigInt = BigInt(phaseId);
    const startTimeBigInt = parseBigIntField(startTime, "startTime");
    const endTimeBigInt = parseBigIntField(endTime, "endTime");
    const priceBigInt = parseBigIntField(priceWei, "priceWei");
    const maxPerWalletNumber = parseIntegerField(maxPerWallet, "maxPerWallet", 4294967295);
    const phaseSupplyNumber = parseIntegerField(phaseSupply, "phaseSupply", 4294967295);

    if (endTimeBigInt <= startTimeBigInt) {
      return badRequest(res, "endTime must be greater than startTime");
    }

    const allowlist = await getAllowlist(collection, phaseId);
    const calldata = encodeFunctionData({
      abi: UPDATE_PHASE_ABI,
      functionName: "creatorUpdatePhase",
      args: [
        normalizedCollection,
        phaseIdBigInt,
        name,
        startTimeBigInt,
        endTimeBigInt,
        priceBigInt,
        maxPerWalletNumber,
        phaseSupplyNumber,
        allowlist.merkleRoot,
        isPublic,
        active,
      ],
    });

    return res.json({
      launchpadContract: isConfiguredAddress(LAUNCHPAD_CONTRACT) ? LAUNCHPAD_CONTRACT : null,
      functionName: "creatorUpdatePhase",
      args: [
        normalizedCollection,
        phaseIdBigInt.toString(),
        name,
        startTimeBigInt.toString(),
        endTimeBigInt.toString(),
        priceBigInt.toString(),
        String(maxPerWalletNumber),
        String(phaseSupplyNumber),
        allowlist.merkleRoot,
        isPublic,
        active,
      ],
      calldata,
      merkleRoot: allowlist.merkleRoot,
      count: allowlist.count,
      updatedAt: allowlist.updatedAt,
    });
  } catch (error) {
    return badRequest(res, error instanceof Error ? error.message : String(error));
  }
});

function startServer(port, retriesLeft = 5) {
  const server = app.listen(port, () => {
    console.log(`milady-backend listening on http://localhost:${port}`);
    startBackgroundIndexer(port);
  });

  server.on("error", (error) => {
    if (error && error.code === "EADDRINUSE" && retriesLeft > 0) {
      const nextPort = port + 1;
      console.warn(`port ${port} is in use, retrying on ${nextPort}`);
      startServer(nextPort, retriesLeft - 1);
      return;
    }

    console.error("failed to start backend server", error);
    process.exit(1);
  });
}

startServer(PORT);
