import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getAddress, isAddress } from "viem";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, "../data");
const dbPath = path.resolve(dataDir, "collections-db.json");
const tempPath = `${dbPath}.tmp`;

async function ensureDb() {
  await mkdir(dataDir, { recursive: true });
  try {
    await readFile(dbPath, "utf8");
  } catch {
    await writeFile(dbPath, JSON.stringify({ collections: [] }, null, 2), "utf8");
  }
}

async function readDb() {
  await ensureDb();
  const raw = await readFile(dbPath, "utf8");
  const parsed = JSON.parse(raw);
  return {
    collections: Array.isArray(parsed.collections) ? parsed.collections : [],
  };
}

async function writeDb(db) {
  await ensureDb();
  await writeFile(tempPath, JSON.stringify(db, null, 2), "utf8");
  await rename(tempPath, dbPath);
}

function normalizeText(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function normalizeNumber(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
}

function normalizeCollection(input) {
  if (!isAddress(input?.nftContract)) {
    throw new Error("nftContract must be a valid address");
  }
  if (!isAddress(input?.marketContract)) {
    throw new Error("marketContract must be a valid address");
  }

  const nftContract = getAddress(input.nftContract);
  const marketContract = getAddress(input.marketContract);
  const name = normalizeText(input.name, `Launchpad ${nftContract.slice(0, 6)}...${nftContract.slice(-4)}`);

  return {
    nftContract,
    marketContract,
    name,
    description: normalizeText(input.description, "Launchpad deployed collection."),
    supply: normalizeNumber(input.supply, 0),
    coverImage: normalizeText(input.coverImage, ""),
    imageUrlTemplate: normalizeText(input.imageUrlTemplate, ""),
    imageExtension: normalizeText(input.imageExtension, "png"),
    startTokenId: normalizeNumber(input.startTokenId, 1),
    explorer: normalizeText(input.explorer, `https://explore.tempo.xyz/address/${nftContract}`),
  };
}

export async function listPublishedCollections() {
  const db = await readDb();
  return db.collections;
}

export async function upsertPublishedCollection(input) {
  const normalized = normalizeCollection(input);
  const db = await readDb();
  const key = normalized.nftContract.toLowerCase();
  const idx = db.collections.findIndex((entry) => entry.nftContract.toLowerCase() === key);

  const record = {
    ...normalized,
    updatedAt: new Date().toISOString(),
    createdAt: idx >= 0 ? db.collections[idx].createdAt : new Date().toISOString(),
  };

  if (idx >= 0) {
    db.collections[idx] = record;
  } else {
    db.collections.push(record);
  }

  await writeDb(db);
  return record;
}
