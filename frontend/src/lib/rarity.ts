export interface RarityAttribute {
  trait_type?: string;
  value?: string | number;
}

interface RarityIndex {
  sampledTokens: number;
  traitCounts: Record<string, number>;
}

export interface TraitRarityRow {
  traitType: string;
  value: string;
  count: number;
  frequency: number;
  information: number;
}

export interface RarityResult {
  score: number;
  sampledTokens: number;
  traits: TraitRarityRow[];
}

const CACHE_PREFIX = "milady:rarity:index:";

function attrKey(traitType: string, value: string) {
  return `${traitType}::${value}`;
}

function toText(value: unknown) {
  return String(value ?? "").trim();
}

function parseAttributes(metadata: unknown): Array<{ traitType: string; value: string }> {
  const attributes = (metadata as { attributes?: RarityAttribute[] })?.attributes;
  if (!Array.isArray(attributes)) return [];

  return attributes
    .map((entry) => ({
      traitType: toText(entry?.trait_type),
      value: toText(entry?.value),
    }))
    .filter((entry) => entry.traitType.length > 0 && entry.value.length > 0);
}

function loadCachedIndex(cacheKey: string): RarityIndex | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RarityIndex;
    if (!parsed || typeof parsed.sampledTokens !== "number" || !parsed.traitCounts) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveCachedIndex(cacheKey: string, index: RarityIndex) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(cacheKey, JSON.stringify(index));
  } catch {
    // Ignore localStorage failures.
  }
}

async function buildIndex(metadataBase: string, supply: number, sampleSize: number): Promise<RarityIndex> {
  const upperBound = Math.max(0, Math.min(supply, sampleSize));
  const traitCounts: Record<string, number> = {};
  let sampledTokens = 0;

  for (let tokenId = 1; tokenId <= upperBound; tokenId += 1) {
    try {
      const res = await fetch(`${metadataBase}/${tokenId}.json`, { cache: "force-cache" });
      if (!res.ok) continue;
      const metadata = await res.json();
      const attrs = parseAttributes(metadata);
      if (!attrs.length) continue;

      sampledTokens += 1;
      for (const attr of attrs) {
        const key = attrKey(attr.traitType, attr.value);
        traitCounts[key] = (traitCounts[key] ?? 0) + 1;
      }
    } catch {
      // Ignore fetch errors for sparse token sets.
    }
  }

  return {
    sampledTokens,
    traitCounts,
  };
}

export async function getRarityResult(options: {
  collectionSlug: string;
  metadataBase?: string;
  supply: number;
  attributes?: RarityAttribute[];
  sampleSize?: number;
}): Promise<RarityResult | null> {
  const { collectionSlug, metadataBase, supply, attributes = [], sampleSize = 500 } = options;
  if (!metadataBase || !attributes.length || supply <= 0) return null;

  const cacheKey = `${CACHE_PREFIX}${collectionSlug}:${sampleSize}`;
  let index = loadCachedIndex(cacheKey);
  if (!index) {
    index = await buildIndex(metadataBase, supply, sampleSize);
    saveCachedIndex(cacheKey, index);
  }

  if (!index.sampledTokens) return null;

  const rows: TraitRarityRow[] = parseAttributes({ attributes }).map((attr) => {
    const key = attrKey(attr.traitType, attr.value);
    const count = index!.traitCounts[key] ?? 0;
    const frequency = count > 0 ? count / index!.sampledTokens : 1 / index!.sampledTokens;
    const information = -Math.log2(Math.max(frequency, 1 / index!.sampledTokens));
    return {
      traitType: attr.traitType,
      value: attr.value,
      count,
      frequency,
      information,
    };
  });

  const score = rows.reduce((sum, row) => sum + row.information, 0);

  return {
    score,
    sampledTokens: index.sampledTokens,
    traits: rows.sort((a, b) => b.information - a.information),
  };
}
