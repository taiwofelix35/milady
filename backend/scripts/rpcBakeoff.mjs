import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, "..", ".env");
dotenv.config({ path: envPath });

const ITEM_LISTED_TOPIC = "0x3fd5016119b4f9f3f0f2e3f3ff8bc81554f8a57f4ce5f58a9302468ce95f2c14";

const timeoutMs = Number(process.env.RPC_BAKEOFF_TIMEOUT_MS ?? 8000);
const runs = Number(process.env.RPC_BAKEOFF_RUNS ?? 10);
const logLookbackBlocks = Number(process.env.RPC_BAKEOFF_LOG_BLOCKS ?? 3000);
const nftContract = process.env.NFT_CONTRACT ?? "";
const marketplaceContract = process.env.MARKETPLACE_CONTRACT ?? "";
const tokenId = BigInt(Number(process.env.RPC_BAKEOFF_TOKEN_ID ?? 1));
const writeEnv = (process.env.RPC_BAKEOFF_WRITE_ENV ?? "0").toLowerCase() === "1";

function parseUrls() {
  const explicit = (process.env.RPC_BAKEOFF_URLS ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  if (explicit.length > 0) return explicit;

  const primary = process.env.RPC_URL?.trim();
  const fallback = (process.env.RPC_FALLBACK_URLS ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

  return Array.from(new Set([primary, ...fallback].filter(Boolean)));
}

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)));
  return sorted[idx];
}

function formatMs(v) {
  return v === null ? "-" : `${v}ms`;
}

function isTimeoutError(errorText) {
  const text = String(errorText).toLowerCase();
  return text.includes("timeout") || text.includes("aborted") || text.includes("abort");
}

function isRateLimitError(errorText) {
  const text = String(errorText).toLowerCase();
  return text.includes("429") || text.includes("rate") || text.includes("limit");
}

function upsertEnvVar(text, key, value) {
  const line = `${key}=${value}`;
  const matcher = new RegExp(`^${key}=.*$`, "m");
  if (matcher.test(text)) {
    return text.replace(matcher, line);
  }

  const normalized = text.endsWith("\n") ? text : `${text}\n`;
  return `${normalized}${line}\n`;
}

function writeRecommendedToEnv({ primaryUrl, fallbackCsv }) {
  let current = "";
  try {
    current = fs.readFileSync(envPath, "utf8");
  } catch {
    current = "";
  }

  let next = upsertEnvVar(current, "RPC_URL", primaryUrl);
  next = upsertEnvVar(next, "RPC_FALLBACK_URLS", fallbackCsv);
  fs.writeFileSync(envPath, next, "utf8");
}

async function rpcCall(url, method, params, timeout) {
  const controller = new AbortController();
  const started = Date.now();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: controller.signal,
    });

    const text = await res.text();
    const elapsedMs = Date.now() - started;

    if (!res.ok) {
      return { ok: false, elapsedMs, error: `http ${res.status}: ${text.slice(0, 300)}` };
    }

    let json;
    try {
      json = JSON.parse(text);
    } catch {
      return { ok: false, elapsedMs, error: `invalid json: ${text.slice(0, 300)}` };
    }

    if (json.error) {
      return {
        ok: false,
        elapsedMs,
        error: `${json.error.code ?? "rpc"}: ${json.error.message ?? JSON.stringify(json.error)}`,
      };
    }

    return { ok: true, elapsedMs, result: json.result };
  } catch (error) {
    const elapsedMs = Date.now() - started;
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, elapsedMs, error: message };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function buildTests(url) {
  const tests = [
    {
      name: "eth_blockNumber",
      run: () => rpcCall(url, "eth_blockNumber", [], timeoutMs),
    },
  ];

  if (nftContract) {
    const tokenHex = `0x${tokenId.toString(16)}`;
    const data = `0x6352211e${tokenId.toString(16).padStart(64, "0")}`;
    tests.push({
      name: `eth_call ownerOf(${tokenHex})`,
      run: () =>
        rpcCall(
          url,
          "eth_call",
          [
            {
              to: nftContract,
              data,
            },
            "latest",
          ],
          timeoutMs
        ),
    });
  }

  if (marketplaceContract) {
    const latest = await rpcCall(url, "eth_blockNumber", [], timeoutMs);
    if (latest.ok && typeof latest.result === "string") {
      const latestBlock = BigInt(latest.result);
      const fromBlock = latestBlock > BigInt(logLookbackBlocks)
        ? latestBlock - BigInt(logLookbackBlocks)
        : 0n;

      tests.push({
        name: `eth_getLogs ItemListed (${logLookbackBlocks} blocks)`,
        run: () =>
          rpcCall(
            url,
            "eth_getLogs",
            [
              {
                address: marketplaceContract,
                fromBlock: `0x${fromBlock.toString(16)}`,
                toBlock: `0x${latestBlock.toString(16)}`,
                topics: [ITEM_LISTED_TOPIC],
              },
            ],
            timeoutMs
          ),
      });
    }
  }

  return tests;
}

async function runOneUrl(url) {
  const tests = await buildTests(url);
  const result = {
    url,
    tests: {},
    summary: {
      totalCalls: 0,
      success: 0,
      failed: 0,
      timeoutErrors: 0,
      rateLimitErrors: 0,
      p50: null,
      p95: null,
      avg: null,
    },
  };

  const allSuccessLatencies = [];

  for (const test of tests) {
    const latencies = [];
    const errors = [];

    for (let i = 0; i < runs; i += 1) {
      const r = await test.run();
      result.summary.totalCalls += 1;
      if (r.ok) {
        result.summary.success += 1;
        latencies.push(r.elapsedMs);
        allSuccessLatencies.push(r.elapsedMs);
      } else {
        result.summary.failed += 1;
        if (isTimeoutError(r.error)) result.summary.timeoutErrors += 1;
        if (isRateLimitError(r.error)) result.summary.rateLimitErrors += 1;
        errors.push(r.error);
      }
    }

    result.tests[test.name] = {
      runs,
      success: latencies.length,
      failed: errors.length,
      p50: percentile(latencies, 50),
      p95: percentile(latencies, 95),
      avg: latencies.length
        ? Math.round(latencies.reduce((sum, n) => sum + n, 0) / latencies.length)
        : null,
      sampleError: errors[0] ?? null,
    };
  }

  result.summary.p50 = percentile(allSuccessLatencies, 50);
  result.summary.p95 = percentile(allSuccessLatencies, 95);
  result.summary.avg = allSuccessLatencies.length
    ? Math.round(allSuccessLatencies.reduce((sum, n) => sum + n, 0) / allSuccessLatencies.length)
    : null;

  return result;
}

async function main() {
  const urls = parseUrls();
  if (!urls.length) {
    console.error("No RPC urls found. Set RPC_BAKEOFF_URLS or RPC_URL.");
    process.exit(1);
  }

  console.log(`RPC bakeoff starting: ${urls.length} endpoint(s), ${runs} run(s)/test, timeout ${timeoutMs}ms`);
  if (nftContract) {
    console.log(`- NFT contract probe enabled: ${nftContract} tokenId=${tokenId.toString()}`);
  }
  if (marketplaceContract) {
    console.log(`- Logs probe enabled: ${marketplaceContract} lookback=${logLookbackBlocks}`);
  }

  const results = [];
  for (const url of urls) {
    console.log(`\nTesting: ${url}`);
    const r = await runOneUrl(url);
    results.push(r);

    const s = r.summary;
    console.log(
      `  summary: ok=${s.success}/${s.totalCalls} fail=${s.failed} timeouts=${s.timeoutErrors} 429/rate=${s.rateLimitErrors} p50=${formatMs(s.p50)} p95=${formatMs(s.p95)} avg=${formatMs(s.avg)}`
    );

    for (const [name, t] of Object.entries(r.tests)) {
      console.log(
        `  - ${name}: ok=${t.success}/${t.runs} p50=${formatMs(t.p50)} p95=${formatMs(t.p95)} avg=${formatMs(t.avg)}${t.sampleError ? ` sampleErr=${t.sampleError}` : ""}`
      );
    }
  }

  const ranked = [...results].sort((a, b) => {
    const af = a.summary.failed;
    const bf = b.summary.failed;
    if (af !== bf) return af - bf;

    const ap95 = a.summary.p95 ?? Number.MAX_SAFE_INTEGER;
    const bp95 = b.summary.p95 ?? Number.MAX_SAFE_INTEGER;
    return ap95 - bp95;
  });

  console.log("\nRecommended order (best first):");
  ranked.forEach((r, i) => {
    console.log(
      `${i + 1}. ${r.url} | fail=${r.summary.failed}/${r.summary.totalCalls} p95=${formatMs(r.summary.p95)} avg=${formatMs(r.summary.avg)}`
    );
  });

  const primaryUrl = ranked[0]?.url ?? "";
  const fallbackCsv = ranked
    .slice(1)
    .map((r) => r.url)
    .join(",");
  console.log("\nUse these env values:");
  console.log(`RPC_URL=${primaryUrl}`);
  console.log(`RPC_FALLBACK_URLS=${fallbackCsv}`);

  if (writeEnv && primaryUrl) {
    writeRecommendedToEnv({ primaryUrl, fallbackCsv });
    console.log(`\nApplied to ${envPath}`);
  }
}

void main();
