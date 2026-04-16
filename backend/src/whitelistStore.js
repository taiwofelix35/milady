import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { concat, encodePacked, getAddress, isAddress, keccak256 } from "viem";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, "../data");
const dbPath = path.resolve(dataDir, "whitelist-db.json");
const tempPath = `${dbPath}.tmp`;
let dbCache = null;

const ZERO_BYTES32 = `0x${"0".repeat(64)}`;
const MERKLE_TREE_MODE = String(process.env.WHITELIST_TREE_MODE ?? "simple").toLowerCase() === "standard"
  ? "standard"
  : "simple";

function keyFor(collection, phaseId) {
  return `${collection.toLowerCase()}:${phaseId}`;
}

function normalizeAddresses(addresses) {
  const valid = addresses.filter((value) => isAddress(value)).map((value) => getAddress(value));
  return Array.from(new Set(valid));
}

function sortHex(a, b) {
  const aNorm = String(a).toLowerCase();
  const bNorm = String(b).toLowerCase();
  if (aNorm < bNorm) return -1;
  if (aNorm > bNorm) return 1;
  return 0;
}

function hashAddressLeaf(address) {
  return keccak256(encodePacked(["address"], [address]));
}

function hashSimplePair(a, b) {
  const ordered = sortHex(a, b) <= 0 ? [a, b] : [b, a];
  return keccak256(concat(ordered));
}

function buildSimpleMerkleData(addresses) {
  const normalized = normalizeAddresses(addresses).sort((a, b) => a.localeCompare(b));
  if (normalized.length === 0) {
    return {
      treeMode: "simple",
      addresses: [],
      merkleRoot: ZERO_BYTES32,
      proofsByAddress: {},
    };
  }

  const leaves = normalized.map((address) => hashAddressLeaf(address));
  const levels = [leaves];

  while (levels[levels.length - 1].length > 1) {
    const current = levels[levels.length - 1];
    const next = [];

    for (let i = 0; i < current.length; i += 2) {
      const left = current[i];
      const right = current[i + 1];
      next.push(right ? hashSimplePair(left, right) : left);
    }

    levels.push(next);
  }

  const proofsByAddress = {};
  for (let index = 0; index < normalized.length; index += 1) {
    const proof = [];
    let cursor = index;

    for (let levelIndex = 0; levelIndex < levels.length - 1; levelIndex += 1) {
      const level = levels[levelIndex];
      const siblingIndex = cursor % 2 === 0 ? cursor + 1 : cursor - 1;
      if (siblingIndex < level.length) {
        proof.push(level[siblingIndex]);
      }
      cursor = Math.floor(cursor / 2);
    }

    proofsByAddress[normalized[index]] = proof;
  }

  return {
    treeMode: "simple",
    addresses: normalized,
    merkleRoot: levels[levels.length - 1][0],
    proofsByAddress,
  };
}

function buildStandardMerkleData(addresses) {
  const normalized = normalizeAddresses(addresses);
  if (normalized.length === 0) {
    return {
      treeMode: "standard",
      addresses: [],
      merkleRoot: ZERO_BYTES32,
      proofsByAddress: {},
    };
  }

  const values = normalized.map((address) => [address]);
  const tree = StandardMerkleTree.of(values, ["address"]);

  const proofsByAddress = {};
  for (const address of normalized) {
    proofsByAddress[address] = tree.getProof([address]);
  }

  return {
    treeMode: "standard",
    addresses: normalized,
    merkleRoot: tree.root,
    proofsByAddress,
  };
}

function buildMerkleData(addresses) {
  return MERKLE_TREE_MODE === "standard"
    ? buildStandardMerkleData(addresses)
    : buildSimpleMerkleData(addresses);
}

function verifySimpleProof(root, account, proof) {
  if (!root || !isAddress(account)) return false;
  if (String(root).toLowerCase() === ZERO_BYTES32.toLowerCase()) return false;
  if (!Array.isArray(proof)) return false;

  let computed = hashAddressLeaf(getAddress(account));
  for (const sibling of proof) {
    if (typeof sibling !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(sibling)) {
      return false;
    }
    computed = hashSimplePair(computed, sibling);
  }

  return computed.toLowerCase() === String(root).toLowerCase();
}

function verifyStandardProof(root, account, proof) {
  if (!root || !isAddress(account) || !Array.isArray(proof)) return false;
  if (String(root).toLowerCase() === ZERO_BYTES32.toLowerCase()) return false;
  try {
    return StandardMerkleTree.verify(root, ["address"], [getAddress(account)], proof);
  } catch {
    return false;
  }
}

export function verifyProofAgainstRoot(root, account, proof, mode = MERKLE_TREE_MODE) {
  if (mode === "standard") {
    return verifyStandardProof(root, account, proof);
  }
  return verifySimpleProof(root, account, proof);
}

export function getMerkleTreeMode() {
  return MERKLE_TREE_MODE;
}

async function ensureDb() {
  await mkdir(dataDir, { recursive: true });
  try {
    await readFile(dbPath, "utf8");
  } catch {
    await writeFile(dbPath, JSON.stringify({ allowlists: {} }, null, 2), "utf8");
  }
}

async function readDb() {
  if (dbCache) {
    return dbCache;
  }

  await ensureDb();
  const raw = await readFile(dbPath, "utf8");
  const parsed = JSON.parse(raw);
  dbCache = {
    allowlists: parsed.allowlists ?? {},
  };
  return dbCache;
}

async function writeDb(db) {
  await ensureDb();
  await writeFile(tempPath, JSON.stringify(db, null, 2), "utf8");
  await rename(tempPath, dbPath);
  dbCache = db;
}

function parsePhaseId(rawPhaseId) {
  if (!/^\d+$/.test(rawPhaseId)) {
    throw new Error("phaseId must be a non-negative integer");
  }
  return String(BigInt(rawPhaseId));
}

export async function getAllowlist(collection, rawPhaseId) {
  if (!isAddress(collection)) {
    throw new Error("collection must be a valid address");
  }

  const phaseId = parsePhaseId(rawPhaseId);
  const db = await readDb();
  const key = keyFor(collection, phaseId);
  let entry = db.allowlists[key];

  if (!entry) {
    return {
      collection: getAddress(collection),
      phaseId,
      addresses: [],
      merkleRoot: ZERO_BYTES32,
      proofsByAddress: {},
      treeMode: MERKLE_TREE_MODE,
      count: 0,
      updatedAt: null,
    };
  }

  // Legacy entries may have roots/proofs built with older mode.
  // Rebuild once using current configured mode so studio sync can push compatible roots.
  const entryMode = entry.treeMode === "standard" ? "standard" : "simple";
  if (entryMode !== MERKLE_TREE_MODE) {
    const rebuilt = buildMerkleData(entry.addresses ?? []);
    entry = {
      collection: getAddress(collection),
      phaseId,
      addresses: rebuilt.addresses,
      merkleRoot: rebuilt.merkleRoot,
      proofsByAddress: rebuilt.proofsByAddress,
      treeMode: rebuilt.treeMode,
      updatedAt: new Date().toISOString(),
    };
    db.allowlists[key] = entry;
    await writeDb(db);
  }

  return {
    collection: getAddress(collection),
    phaseId,
    addresses: entry.addresses,
    merkleRoot: entry.merkleRoot,
    proofsByAddress: entry.proofsByAddress,
    treeMode: entry.treeMode ?? MERKLE_TREE_MODE,
    count: entry.addresses.length,
    updatedAt: entry.updatedAt,
  };
}

export async function rebuildAllowlist(collection, rawPhaseId) {
  if (!isAddress(collection)) {
    throw new Error("collection must be a valid address");
  }

  const phaseId = parsePhaseId(rawPhaseId);
  const normalizedCollection = getAddress(collection);
  const db = await readDb();
  const key = keyFor(normalizedCollection, phaseId);
  const current = db.allowlists[key];

  if (!current) {
    return {
      collection: normalizedCollection,
      phaseId,
      count: 0,
      merkleRoot: ZERO_BYTES32,
      treeMode: MERKLE_TREE_MODE,
      updatedAt: null,
    };
  }

  const rebuilt = buildMerkleData(current.addresses ?? []);
  const nextEntry = {
    collection: normalizedCollection,
    phaseId,
    addresses: rebuilt.addresses,
    merkleRoot: rebuilt.merkleRoot,
    proofsByAddress: rebuilt.proofsByAddress,
    treeMode: rebuilt.treeMode,
    updatedAt: new Date().toISOString(),
  };

  db.allowlists[key] = nextEntry;
  await writeDb(db);

  return {
    collection: normalizedCollection,
    phaseId,
    count: nextEntry.addresses.length,
    merkleRoot: nextEntry.merkleRoot,
    treeMode: nextEntry.treeMode,
    updatedAt: nextEntry.updatedAt,
  };
}

export async function upsertAllowlist(collection, rawPhaseId, addressesToAdd = [], addressesToRemove = []) {
  if (!isAddress(collection)) {
    throw new Error("collection must be a valid address");
  }

  const phaseId = parsePhaseId(rawPhaseId);
  const normalizedCollection = getAddress(collection);
  const db = await readDb();
  const key = keyFor(normalizedCollection, phaseId);

  const current = db.allowlists[key] ?? {
    collection: normalizedCollection,
    phaseId,
    addresses: [],
    merkleRoot: ZERO_BYTES32,
    proofsByAddress: {},
    treeMode: MERKLE_TREE_MODE,
    updatedAt: null,
  };

  const currentSet = new Set(normalizeAddresses(current.addresses));
  const toAdd = normalizeAddresses(addressesToAdd);
  const toRemove = new Set(normalizeAddresses(addressesToRemove));

  for (const address of toAdd) {
    currentSet.add(address);
  }
  for (const address of toRemove) {
    currentSet.delete(address);
  }

  const nextAddresses = Array.from(currentSet).sort((a, b) => a.localeCompare(b));
  const nextMerkle = buildMerkleData(nextAddresses);

  const nextEntry = {
    collection: normalizedCollection,
    phaseId,
    addresses: nextMerkle.addresses,
    merkleRoot: nextMerkle.merkleRoot,
    proofsByAddress: nextMerkle.proofsByAddress,
    treeMode: nextMerkle.treeMode,
    updatedAt: new Date().toISOString(),
  };

  db.allowlists[key] = nextEntry;
  await writeDb(db);

  return {
    collection: normalizedCollection,
    phaseId,
    count: nextEntry.addresses.length,
    merkleRoot: nextEntry.merkleRoot,
    treeMode: nextEntry.treeMode,
    updatedAt: nextEntry.updatedAt,
    added: toAdd,
    removed: Array.from(toRemove),
  };
}

export async function getProof(collection, rawPhaseId, account) {
  const allowlist = await getAllowlist(collection, rawPhaseId);
  if (!isAddress(account)) {
    throw new Error("account must be a valid address");
  }

  const normalized = getAddress(account);
  const proof = allowlist.proofsByAddress[normalized] ?? [];
  const included =
    Object.prototype.hasOwnProperty.call(allowlist.proofsByAddress, normalized) ||
    allowlist.addresses.includes(normalized);

  return {
    collection: allowlist.collection,
    phaseId: allowlist.phaseId,
    account: normalized,
    included,
    merkleRoot: allowlist.merkleRoot,
    treeMode: allowlist.treeMode ?? MERKLE_TREE_MODE,
    proof,
  };
}

export async function getProofsByPhase(collection, rawPhaseIds, account) {
  if (!isAddress(collection)) {
    throw new Error("collection must be a valid address");
  }
  if (!isAddress(account)) {
    throw new Error("account must be a valid address");
  }

  const phaseIds = Array.from(new Set((rawPhaseIds ?? []).map((phaseId) => parsePhaseId(String(phaseId)))));
  const normalizedCollection = getAddress(collection);
  const normalizedAccount = getAddress(account);
  const db = await readDb();

  const result = {};
  for (const phaseId of phaseIds) {
    const entry = db.allowlists[keyFor(normalizedCollection, phaseId)];
    const proofsByAddress = entry?.proofsByAddress ?? {};
    const proof = proofsByAddress[normalizedAccount] ?? [];
    const included =
      Object.prototype.hasOwnProperty.call(proofsByAddress, normalizedAccount) ||
      Boolean(entry?.addresses?.includes(normalizedAccount));

    result[phaseId] = {
      included,
      merkleRoot: entry?.merkleRoot ?? ZERO_BYTES32,
      treeMode: entry?.treeMode ?? MERKLE_TREE_MODE,
      proof,
    };
  }

  return {
    collection: normalizedCollection,
    account: normalizedAccount,
    proofsByPhase: result,
  };
}
