/**
 * Resolves an IPFS URI to an HTTP gateway URL.
 */
export function resolveIPFS(uri: string): string {
  if (!uri) return "/placeholder.png";
  if (uri.startsWith("ipfs://")) {
    return `https://ipfs.io/ipfs/${uri.slice(7)}`;
  }
  return uri;
}

/**
 * Fetches token metadata from a URI.
 */
export async function fetchMetadata(tokenURI: string): Promise<{
  name?: string;
  description?: string;
  image?: string;
  attributes?: Array<{ trait_type: string; value: string }>;
}> {
  try {
    const url = resolveIPFS(tokenURI);
    const res = await fetch(url);
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}

/**
 * Formats a wei value as a human-readable string.
 */
export function formatEther(wei: bigint, decimals = 4): string {
  const value = Number(wei) / 1e18;
  return value.toFixed(decimals).replace(/\.?0+$/, "");
}

/**
 * Shortens an Ethereum address.
 */
export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/**
 * Formats a Unix timestamp as a relative time string.
 */
export function formatExpiry(expiry: bigint): string {
  if (expiry === 0n) return "No expiry";
  const now = Math.floor(Date.now() / 1000);
  const diff = Number(expiry) - now;
  if (diff <= 0) return "Expired";
  if (diff < 3600) return `${Math.floor(diff / 60)}m remaining`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h remaining`;
  return `${Math.floor(diff / 86400)}d remaining`;
}
