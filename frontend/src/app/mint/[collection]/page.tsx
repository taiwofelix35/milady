"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BaseError, formatUnits, isAddress, parseAbiItem } from "viem";
import { useConnect, usePublicClient, useReadContract, useReadContracts, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { ERC20_ABI, MILADY_LAUNCHPAD_COLLECTION_ABI } from "@/lib/abis";
import {
  fetchAllowlistProof,
  fetchAllowlistProofsByPhase,
  fetchPublishedCollections,
  type BackendPublishedCollection,
} from "@/lib/backendApi";
import { PAYMENT_TOKEN_ADDRESS, PAYMENT_TOKEN_DECIMALS, PAYMENT_TOKEN_SYMBOL, TEMPO_CHAIN_ID } from "@/lib/chain";
import { useUnifiedWallet } from "@/hooks/useUnifiedWallet";
import { formatTokenAmount, resolveIPFS } from "@/lib/utils";

type MintPhase = {
  id: bigint;
  name: string;
  startTime: bigint;
  endTime: bigint;
  price: bigint;
  maxPerWallet: number;
  phaseSupply: number;
  minted: number;
  merkleRoot: `0x${string}`;
  isPublic: boolean;
  active: boolean;
};

type PhaseEligibility = {
  phaseId: bigint;
  phaseName: string;
  allowlisted: boolean | null;
  canMintNow: boolean;
  reason: string;
};

type MintEventRow = {
  txHash: `0x${string}`;
  minter: `0x${string}`;
  phaseId: bigint;
  quantity: number;
  totalCost: bigint;
  blockNumber: bigint;
};

type MintTab = "overview" | "mint" | "checker";

const ZERO_MERKLE_ROOT = "0x0000000000000000000000000000000000000000000000000000000000000000";

function toBigIntSafe(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  if (typeof value === "string") return BigInt(value);
  return 0n;
}

function parsePhase(result: unknown, id: bigint): MintPhase | null {
  if (!Array.isArray(result) || result.length < 10) return null;
  return {
    id,
    name: String(result[0] ?? ""),
    startTime: toBigIntSafe(result[1]),
    endTime: toBigIntSafe(result[2]),
    price: toBigIntSafe(result[3]),
    maxPerWallet: Number(result[4] ?? 0),
    phaseSupply: Number(result[5] ?? 0),
    minted: Number(result[6] ?? 0),
    merkleRoot: String(result[7] ?? ZERO_MERKLE_ROOT) as `0x${string}`,
    isPublic: Boolean(result[8]),
    active: Boolean(result[9]),
  };
}

function formatCountdown(totalSeconds: number): string {
  if (totalSeconds <= 0) return "0s";
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  if (minutes > 0 || hours > 0 || days > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return parts.join(" ");
}

const RECENT_MINT_SCAN_BLOCKS = 50_000n;

export default function PublicMintCollectionPage() {
  const params = useParams();
  const collectionAddress = String(params.collection || "");
  const collection = isAddress(collectionAddress) ? (collectionAddress as `0x${string}`) : null;
  const { address, isConnected, canTransact, isThirdwebOnlyConnected, isWrongChain, chainId } = useUnifiedWallet();
  const { connect, connectors, isPending: isConnectingSigner } = useConnect();
  const preferredSignerConnector = useMemo(
    () =>
      connectors.find((connector) => connector.id === "metaMask") ??
      connectors.find((connector) => connector.id === "walletConnect") ??
      connectors[0],
    [connectors]
  );

  const [selectedPhaseId, setSelectedPhaseId] = useState<bigint | null>(null);
  const [quantity, setQuantity] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [allowlistProof, setAllowlistProof] = useState<`0x${string}`[]>([]);
  const [proofIncluded, setProofIncluded] = useState(false);
  const [proofLoading, setProofLoading] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [activeTab, setActiveTab] = useState<MintTab>("overview");
  const [checkerInput, setCheckerInput] = useState("");
  const [checkerTarget, setCheckerTarget] = useState<`0x${string}` | null>(null);
  const [connectedProofByPhase, setConnectedProofByPhase] = useState<Record<string, boolean>>({});
  const [connectedChecking, setConnectedChecking] = useState(false);
  const [customProofByPhase, setCustomProofByPhase] = useState<Record<string, boolean>>({});
  const [customChecking, setCustomChecking] = useState(false);
  const [checkerError, setCheckerError] = useState<string | null>(null);
  const [collectionMeta, setCollectionMeta] = useState<BackendPublishedCollection | null>(null);
  const [mintEvents, setMintEvents] = useState<MintEventRow[]>([]);
  const [mintEventsLoading, setMintEventsLoading] = useState(false);
  const publicClient = usePublicClient();

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const { data: phaseCountRaw } = useReadContract({
    address: collection ?? undefined,
    abi: MILADY_LAUNCHPAD_COLLECTION_ABI,
    functionName: "phaseCount",
    query: { enabled: !!collection },
  });

  const { data: onchainPaymentTokenRaw } = useReadContract({
    address: collection ?? undefined,
    abi: MILADY_LAUNCHPAD_COLLECTION_ABI,
    functionName: "paymentToken",
    query: { enabled: !!collection },
  });

  const paymentTokenAddress = isAddress(String(onchainPaymentTokenRaw ?? ""))
    ? (onchainPaymentTokenRaw as `0x${string}`)
    : PAYMENT_TOKEN_ADDRESS;

  const { data: onchainCollectionNameRaw } = useReadContract({
    address: collection ?? undefined,
    abi: MILADY_LAUNCHPAD_COLLECTION_ABI,
    functionName: "name",
    query: { enabled: !!collection },
  });

  const phaseCount = Number(phaseCountRaw ?? 0n);

  useEffect(() => {
    let cancelled = false;

    async function loadCollectionMeta() {
      if (!collection) return;
      const published = await fetchPublishedCollections();
      if (cancelled) return;
      const found = published.find(
        (entry) => entry.nftContract.toLowerCase() === collection.toLowerCase()
      );
      setCollectionMeta(found ?? null);
    }

    loadCollectionMeta();
    return () => {
      cancelled = true;
    };
  }, [collection]);

  const phaseContracts = useMemo(
    () =>
      collection
        ? Array.from({ length: phaseCount }, (_, index) => ({
            address: collection,
            abi: MILADY_LAUNCHPAD_COLLECTION_ABI,
            functionName: "phases" as const,
            args: [BigInt(index)] as const,
          }))
        : [],
    [collection, phaseCount]
  );

  const { data: phaseResults } = useReadContracts({
    contracts: phaseContracts,
    query: { enabled: !!collection && phaseContracts.length > 0 },
  });

  const phases = useMemo(() => {
    return (phaseResults ?? [])
      .map((entry, index) => {
        const result = entry?.result;
        return parsePhase(result, BigInt(index));
      })
      .filter((item): item is MintPhase => !!item);
  }, [phaseResults]);

  const allowlistPhases = useMemo(() => phases.filter((phase) => !phase.isPublic), [phases]);

  const nowSec = BigInt(Math.floor(nowMs / 1000));
  const livePhase = useMemo(
    () => phases.find((phase) => phase.active && phase.startTime <= nowSec && nowSec <= phase.endTime) ?? null,
    [phases, nowSec]
  );

  const selectedPhase = useMemo(() => {
    if (selectedPhaseId === null) return livePhase;
    return phases.find((phase) => phase.id === selectedPhaseId) ?? null;
  }, [phases, selectedPhaseId, livePhase]);

  const { data: mintedPerWalletRaw } = useReadContract({
    address: collection ?? undefined,
    abi: MILADY_LAUNCHPAD_COLLECTION_ABI,
    functionName: "mintedPerWallet",
    args: selectedPhase && address ? [selectedPhase.id, address] : undefined,
    query: { enabled: !!collection && !!selectedPhase && !!address },
  });

  useEffect(() => {
    if (!phases.length) return;
    if (selectedPhaseId !== null) return;
    if (livePhase) {
      setSelectedPhaseId(livePhase.id);
      return;
    }
    setSelectedPhaseId(phases[0].id);
  }, [phases, livePhase, selectedPhaseId]);

  useEffect(() => {
    let cancelled = false;
    async function loadProofIfNeeded() {
      if (!collection || !address || !selectedPhase || selectedPhase.isPublic) {
        if (!cancelled) {
          setAllowlistProof([]);
          setProofIncluded(false);
        }
        return;
      }

      setProofLoading(true);
      const response = await fetchAllowlistProof(collection, String(selectedPhase.id), address);
      if (!cancelled) {
        setProofLoading(false);
        if (!response) {
          setAllowlistProof([]);
          setProofIncluded(false);
          return;
        }
        setAllowlistProof(response.proof ?? []);
        setProofIncluded(Boolean(response.included));
      }
    }

    loadProofIfNeeded();
    return () => {
      cancelled = true;
    };
  }, [collection, address, selectedPhase]);

  const qtyRaw = Number(quantity);
  const qtyValid = Number.isInteger(qtyRaw) && qtyRaw >= 1;
  const qty = qtyValid ? qtyRaw : 0;
  const totalCost = useMemo(() => {
    if (!selectedPhase || !qtyValid) return 0n;
    return selectedPhase.price * BigInt(qty);
  }, [selectedPhase, qty, qtyValid]);

  const selectedPhaseTimingLabel = useMemo(() => {
    if (!selectedPhase) return null;
    const now = Number(nowSec);
    const start = Number(selectedPhase.startTime);
    const end = Number(selectedPhase.endTime);
    if (now < start) return `Starts in ${formatCountdown(start - now)}`;
    if (now > end) return "Ended";
    return `Ends in ${formatCountdown(end - now)}`;
  }, [selectedPhase, nowSec]);

  function phaseTimingReason(phase: MintPhase): string {
    if (!phase.active) return "Phase inactive";
    if (nowSec < phase.startTime) return `Starts in ${formatCountdown(Number(phase.startTime - nowSec))}`;
    if (nowSec > phase.endTime) return "Phase ended";
    return "Live now";
  }

  function computeEligibility(target: `0x${string}` | null, proofByPhase: Record<string, boolean>): PhaseEligibility[] {
    if (!target) return [];

    return phases.map((phase) => {
      const included = phase.isPublic ? null : Boolean(proofByPhase[phase.id.toString()]);
      const timing = phaseTimingReason(phase);
      const canMintNow = timing === "Live now" && (phase.isPublic || included === true);

      return {
        phaseId: phase.id,
        phaseName: phase.name,
        allowlisted: included,
        canMintNow,
        reason:
          timing !== "Live now"
            ? timing
            : phase.isPublic
              ? "Public live"
              : included
                ? "Allowlisted and live"
                : "Not in allowlist",
      };
    });
  }

  async function fetchProofMapForAddress(target: `0x${string}`): Promise<Record<string, boolean>> {
    if (!collection || !allowlistPhases.length) return {};
    const phaseIds = allowlistPhases.map((phase) => phase.id.toString());
    const response = await fetchAllowlistProofsByPhase(collection, phaseIds, target);
    if (!response) return {};

    const map = {} as Record<string, boolean>;
    for (const phaseId of phaseIds) {
      map[phaseId] = Boolean(response[phaseId]?.included);
    }

    return map;
  }

  useEffect(() => {
    let cancelled = false;

    async function loadConnectedEligibility() {
      if (!address) {
        setConnectedProofByPhase({});
        return;
      }
      setConnectedChecking(true);
      const map = await fetchProofMapForAddress(address);
      if (!cancelled) {
        setConnectedProofByPhase(map);
        setConnectedChecking(false);
      }
    }

    loadConnectedEligibility();
    return () => {
      cancelled = true;
    };
  }, [address, collection, allowlistPhases]);

  const connectedEligibility = useMemo(
    () => computeEligibility(address ?? null, connectedProofByPhase),
    [address, phases, nowSec, connectedProofByPhase]
  );

  const customEligibility = useMemo(
    () => computeEligibility(checkerTarget, customProofByPhase),
    [checkerTarget, phases, nowSec, customProofByPhase]
  );

  const { data: allowanceRaw, refetch: refetchAllowance } = useReadContract({
    address: paymentTokenAddress,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address && collection ? [address, collection] : undefined,
    query: { enabled: !!address && !!collection },
  });

  const { data: balanceRaw } = useReadContract({
    abi: ERC20_ABI,
    address: paymentTokenAddress,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const allowance = allowanceRaw ?? 0n;
  const balance = balanceRaw ?? 0n;
  const isFreeMint = totalCost === 0n;
  const needsApproval = totalCost > allowance;
  const mintedPerWallet = mintedPerWalletRaw ?? 0n;

  const { writeContract: writeApprove, data: approveHash, isPending: approvePending, error: approveError } = useWriteContract();
  const { writeContract: writeMint, data: mintHash, isPending: mintPending, error: mintError } = useWriteContract();
  const { isLoading: approveConfirming, isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveHash });
  const { isLoading: mintConfirming, isSuccess: mintSuccess } = useWaitForTransactionReceipt({ hash: mintHash });

  function explainWriteError(error: unknown, fallback: string): string {
    if (!error) return fallback;
    if (error instanceof BaseError) {
      const detail = error.shortMessage || error.details || error.message;
      return detail ? `${fallback}: ${detail}` : fallback;
    }
    if (error instanceof Error && error.message) {
      return `${fallback}: ${error.message}`;
    }
    return fallback;
  }

  useEffect(() => {
    if (!approveSuccess) return;
    setStatus("Approval confirmed. You can mint now.");
    refetchAllowance();
  }, [approveSuccess, refetchAllowance]);

  useEffect(() => {
    if (!approveError) return;
    setStatus(explainWriteError(approveError, "Approval failed"));
  }, [approveError]);

  useEffect(() => {
    if (!mintSuccess) return;
    setStatus("Mint confirmed.");
    refetchAllowance();
  }, [mintSuccess, refetchAllowance]);

  useEffect(() => {
    if (!mintError) return;
    setStatus(explainWriteError(mintError, "Mint failed"));
  }, [mintError]);

  function handleApprove() {
    if (!collection) return;
    if (!selectedPhase) {
      setStatus("No phase selected.");
      return;
    }
    if (isFreeMint) {
      setStatus("No approval needed for free mint.");
      return;
    }
    if (!qtyValid || totalCost <= 0n) {
      setStatus("Invalid total mint cost.");
      return;
    }

    setStatus(`Approving ${formatTokenAmount(totalCost, PAYMENT_TOKEN_DECIMALS)} ${PAYMENT_TOKEN_SYMBOL}...`);
    writeApprove({
      address: paymentTokenAddress,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [collection, totalCost],
    });
  }

  async function handleMint() {
    if (!collection || !selectedPhase) {
      setStatus("Select a phase first.");
      return;
    }

    if (!selectedPhase.active) {
      setStatus("Selected phase is not active.");
      return;
    }

    if (nowSec < selectedPhase.startTime || nowSec > selectedPhase.endTime) {
      setStatus("Selected phase is outside its mint window.");
      return;
    }

    if (!selectedPhase.isPublic && !proofIncluded) {
      setStatus("Wallet is not allowlisted for this phase.");
      return;
    }

    if (!qtyValid) {
      setStatus("Enter a valid quantity (>= 1).");
      return;
    }

    if (selectedPhase.minted + qty > selectedPhase.phaseSupply) {
      setStatus("Not enough remaining phase supply for that quantity.");
      return;
    }

    if (mintedPerWallet + BigInt(qty) > BigInt(selectedPhase.maxPerWallet)) {
      setStatus("Quantity exceeds max per wallet for this phase.");
      return;
    }

    if (totalCost > balance) {
      setStatus("Insufficient payment token balance for this mint.");
      return;
    }

    if (needsApproval) {
      setStatus("Approve payment token first.");
      return;
    }

    if (!publicClient || !address) {
      setStatus("Wallet client not ready. Reconnect wallet and try again.");
      return;
    }

    try {
      await publicClient.simulateContract({
        account: address,
        address: collection,
        abi: MILADY_LAUNCHPAD_COLLECTION_ABI,
        functionName: "mint",
        args: [selectedPhase.id, BigInt(qty), selectedPhase.isPublic ? [] : allowlistProof],
      });
    } catch (error) {
      setStatus(explainWriteError(error, "Mint simulation failed"));
      return;
    }

    setStatus("Submitting mint transaction...");
    writeMint({
      address: collection,
      abi: MILADY_LAUNCHPAD_COLLECTION_ABI,
      functionName: "mint",
      args: [selectedPhase.id, BigInt(qty), selectedPhase.isPublic ? [] : allowlistProof],
    });
  }

  async function runCustomWalletCheck() {
    setCheckerError(null);
    const normalized = checkerInput.trim();
    if (!normalized) {
      setCheckerError("Paste a wallet address first.");
      return;
    }
    if (!isAddress(normalized)) {
      setCheckerError("Invalid wallet address.");
      return;
    }

    const target = normalized as `0x${string}`;
    setCheckerTarget(target);
    setCustomChecking(true);
    const map = await fetchProofMapForAddress(target);
    setCustomProofByPhase(map);
    setCustomChecking(false);
  }

  const livePhaseCount = useMemo(
    () => phases.filter((phase) => phase.active && phase.startTime <= nowSec && nowSec <= phase.endTime).length,
    [phases, nowSec]
  );

  const publicPhaseCount = useMemo(() => phases.filter((phase) => phase.isPublic).length, [phases]);

  const mintStatusLabel = livePhase
    ? livePhase.isPublic
      ? "Public Mint Live"
      : "Allowlist Mint Live"
    : "No Live Mint";

  const collectionLabel = collection ? `${collection.slice(0, 6)}...${collection.slice(-4)}` : "Unknown";
  const onchainCollectionName = String(onchainCollectionNameRaw ?? "").trim();
  const displayTitle = collectionMeta?.name?.trim() || onchainCollectionName || collectionLabel;
  const displayCoverImage = collectionMeta?.coverImage ? resolveIPFS(collectionMeta.coverImage) : "";
  const displayDescription = collectionMeta?.description?.trim() || "Mint phases and eligibility overview.";

  useEffect(() => {
    let cancelled = false;

    async function loadRecentMints() {
      if (!collection || !publicClient || activeTab !== "overview") return;
      setMintEventsLoading(true);

      try {
        const latest = await publicClient.getBlockNumber();
        const fromBlock = latest > RECENT_MINT_SCAN_BLOCKS ? latest - RECENT_MINT_SCAN_BLOCKS : 0n;
        const logs = await publicClient.getLogs({
          address: collection,
          event: parseAbiItem(
            "event Minted(address indexed minter, uint256 indexed phaseId, uint256 quantity, uint256 totalCost)"
          ),
          fromBlock,
          toBlock: latest,
        });

        if (cancelled) return;

        const next = logs
          .slice(-20)
          .reverse()
          .map((log) => ({
            txHash: log.transactionHash,
            minter: (log.args.minter ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
            phaseId: (log.args.phaseId ?? 0n) as bigint,
            quantity: Number(log.args.quantity ?? 0n),
            totalCost: (log.args.totalCost ?? 0n) as bigint,
            blockNumber: log.blockNumber ?? 0n,
          }));

        setMintEvents(next);
      } catch {
        if (!cancelled) {
          setMintEvents([]);
        }
      } finally {
        if (!cancelled) {
          setMintEventsLoading(false);
        }
      }
    }

    loadRecentMints();
    return () => {
      cancelled = true;
    };
  }, [collection, publicClient, activeTab]);

  function eligibilityTone(row: PhaseEligibility): string {
    if (row.canMintNow) return "border-green-400/40 bg-green-400/10 text-green-200";
    if (row.allowlisted === true) return "border-yellow-400/40 bg-yellow-400/10 text-yellow-200";
    if (row.reason.includes("Starts in")) return "border-yellow-400/40 bg-yellow-400/10 text-yellow-200";
    return "border-red-400/40 bg-red-400/10 text-red-200";
  }

  function connectSignerWallet() {
    if (!preferredSignerConnector) {
      setStatus("No signer wallet connector available in this browser.");
      return;
    }

    setStatus(`Connecting signer wallet with ${preferredSignerConnector.name}...`);
    connect({ connector: preferredSignerConnector });
  }

  if (!collection) {
    return (
      <div className="max-w-4xl mx-auto">
        <section className="card p-6 space-y-3">
          <h1 className="font-milady text-3xl text-milady-pink">Public Mint</h1>
          <p className="text-milady-cream/70">Invalid collection address.</p>
          <Link href="/launchpad" className="btn-ghost inline-flex">Back to Launchpad</Link>
        </section>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-milady-pink/20 bg-gradient-to-br from-[#1a1a2e] via-[#1f223f] to-[#2a1731] p-6 md:p-8">
        {displayCoverImage && (
          <div
            className="absolute inset-0 opacity-20 bg-cover bg-center"
            style={{ backgroundImage: `url(${displayCoverImage})` }}
          />
        )}
        <div className="absolute -top-24 -right-24 h-56 w-56 rounded-full bg-milady-pink/20 blur-3xl" />
        <div className="absolute -bottom-20 -left-16 h-48 w-48 rounded-full bg-sky-400/10 blur-3xl" />
        <div className="relative grid gap-6 md:grid-cols-[auto_minmax(0,1fr)] md:items-end">
          {displayCoverImage ? (
            <img
              src={displayCoverImage}
              alt="Collection cover"
              className="h-24 w-24 rounded-2xl border border-milady-pink/40 object-cover"
            />
          ) : (
            <div className="h-24 w-24 rounded-2xl border border-milady-pink/40 bg-milady-pink/10 flex items-center justify-center text-3xl font-milady text-milady-pink">
              M
            </div>
          )}
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-milady-cream/60">Collection Mint</p>
            <h1 className="font-milady text-4xl text-milady-cream mt-1">{displayTitle}</h1>
            <p className="text-sm text-milady-cream/70 mt-2 break-all">{collection}</p>
            <p className="text-sm text-milady-cream/65 mt-2 max-w-3xl">{displayDescription}</p>
            <div className="flex flex-wrap gap-2 mt-4">
              <span className="badge">{mintStatusLabel}</span>
              <span className="badge">{phases.length} Total Phases</span>
              <span className="badge">{publicPhaseCount} Public</span>
              <span className="badge">{livePhaseCount} Live Now</span>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="card p-4">
          <p className="text-xs uppercase tracking-wide text-milady-cream/50">Status</p>
          <p className="text-xl font-semibold text-milady-cream mt-2">{mintStatusLabel}</p>
        </article>
        <article className="card p-4">
          <p className="text-xs uppercase tracking-wide text-milady-cream/50">Current Price</p>
          <p className="text-xl font-semibold text-milady-cream mt-2">
            {livePhase ? `${formatTokenAmount(livePhase.price, PAYMENT_TOKEN_DECIMALS)} ${PAYMENT_TOKEN_SYMBOL}` : "-"}
          </p>
        </article>
        <article className="card p-4">
          <p className="text-xs uppercase tracking-wide text-milady-cream/50">Live Window</p>
          <p className="text-xl font-semibold text-milady-cream mt-2">{selectedPhaseTimingLabel ?? "Not live"}</p>
        </article>
        <article className="card p-4">
          <p className="text-xs uppercase tracking-wide text-milady-cream/50">Selected Phase</p>
          <p className="text-xl font-semibold text-milady-cream mt-2">
            {selectedPhase ? `#${selectedPhase.id.toString()}` : "-"}
          </p>
        </article>
      </section>

      <section className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
        <div className="space-y-6">
          <section className="card p-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("overview")}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  activeTab === "overview"
                    ? "border-milady-pink/50 bg-milady-pink/15 text-milady-pink"
                    : "border-milady-pink/20 text-milady-cream/70 hover:border-milady-pink/35"
                }`}
              >
                Overview
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("mint")}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  activeTab === "mint"
                    ? "border-milady-pink/50 bg-milady-pink/15 text-milady-pink"
                    : "border-milady-pink/20 text-milady-cream/70 hover:border-milady-pink/35"
                }`}
              >
                Mint
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("checker")}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  activeTab === "checker"
                    ? "border-milady-pink/50 bg-milady-pink/15 text-milady-pink"
                    : "border-milady-pink/20 text-milady-cream/70 hover:border-milady-pink/35"
                }`}
              >
                Wallet Checker
              </button>
            </div>
          </section>

          {activeTab === "overview" && (
          <section className="card p-6 space-y-4">
            <h2 className="section-title">Overview</h2>
            {livePhase ? (
              <div className="rounded-xl border border-green-400/30 bg-green-400/5 p-3 text-sm text-green-200">
                Live now: Phase #{livePhase.id.toString()} {livePhase.name || "Mint Phase"} ({livePhase.isPublic ? "Public" : "Allowlist"})
              </div>
            ) : (
              <div className="rounded-xl border border-yellow-300/30 bg-yellow-300/5 p-3 text-sm text-yellow-200">
                No live mint phase is currently active.
              </div>
            )}
            <div className="grid gap-2 text-sm text-milady-cream/80">
              <p>Total phases: {phases.length}</p>
              <p>Public phases: {publicPhaseCount}</p>
              <p>Allowlist phases: {Math.max(0, phases.length - publicPhaseCount)}</p>
            </div>

            <div className="rounded-xl border border-milady-pink/10 p-4 space-y-3">
              <p className="text-xs uppercase tracking-wide text-milady-cream/50">Phase Timeline</p>
              {!phases.length ? (
                <p className="text-sm text-milady-cream/60">No phases configured yet.</p>
              ) : (
                <div className="space-y-2">
                  {phases.map((phase) => {
                    const timing = phaseTimingReason(phase);
                    const live = timing === "Live now";
                    const upcoming = timing.startsWith("Starts in");
                    return (
                      <div key={`timeline-${phase.id.toString()}`} className="rounded-lg border border-milady-pink/10 p-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-milady-cream">#{phase.id.toString()} {phase.name || "Unnamed Phase"}</p>
                          <span
                            className={`px-2 py-0.5 rounded-full border ${
                              live
                                ? "border-green-400/40 text-green-200"
                                : upcoming
                                  ? "border-yellow-400/40 text-yellow-200"
                                  : "border-milady-pink/30 text-milady-cream/70"
                            }`}
                          >
                            {timing}
                          </span>
                        </div>
                        <p className="text-milady-cream/70 mt-1">
                          {phase.isPublic ? "Public" : "Allowlist"} | {formatTokenAmount(phase.price, PAYMENT_TOKEN_DECIMALS)} {PAYMENT_TOKEN_SYMBOL} | Max/wallet {phase.maxPerWallet}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-milady-pink/10 p-4 space-y-3">
              <p className="text-xs uppercase tracking-wide text-milady-cream/50">Recent Mints</p>
              {mintEventsLoading ? (
                <p className="text-sm text-milady-cream/60">Loading recent mint activity...</p>
              ) : !mintEvents.length ? (
                <p className="text-sm text-milady-cream/60">No recent mint events found.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-auto">
                  {mintEvents.map((row) => (
                    <div key={`${row.txHash}-${row.phaseId.toString()}-${row.blockNumber.toString()}`} className="rounded-lg border border-milady-pink/10 p-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-milady-cream">Phase #{row.phaseId.toString()} | Qty {row.quantity}</p>
                        <p className="text-milady-cream/70">{formatTokenAmount(row.totalCost, PAYMENT_TOKEN_DECIMALS)} {PAYMENT_TOKEN_SYMBOL}</p>
                      </div>
                      <p className="text-milady-cream/60 mt-1 break-all">Minter: {row.minter}</p>
                      <a
                        href={`https://explore.tempo.xyz/tx/${row.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-milady-pink hover:underline mt-1 inline-block"
                      >
                        View Tx
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
          )}

          {(activeTab === "overview" || activeTab === "mint") && (
          <section className="card p-6 space-y-3">
            <h2 className="section-title">Phases</h2>
            {!phases.length ? (
              <p className="text-milady-cream/70 text-sm">No phases found onchain yet.</p>
            ) : (
              <div className="space-y-2">
                {phases.map((phase) => {
                  const isSelected = selectedPhase?.id === phase.id;
                  const isLive = phase.active && phase.startTime <= nowSec && nowSec <= phase.endTime;
                  return (
                    <button
                      key={phase.id.toString()}
                      type="button"
                      onClick={() => setSelectedPhaseId(phase.id)}
                      className={`w-full text-left rounded-xl border px-4 py-3 text-sm transition-colors ${
                        isSelected
                          ? "border-milady-pink/50 bg-milady-pink/10"
                          : "border-milady-pink/15 hover:border-milady-pink/35"
                      }`}
                    >
                      <p className="text-milady-cream font-medium">#{phase.id.toString()} {phase.name || "Unnamed Phase"}</p>
                      <p className="text-xs text-milady-cream/70 mt-1">
                        {phase.isPublic ? "Public" : "Allowlist"} | {phase.active ? "Active" : "Inactive"} {isLive ? "| Live" : ""}
                      </p>
                      <p className="text-xs text-milady-cream/70 mt-1">
                        Price {formatTokenAmount(phase.price, PAYMENT_TOKEN_DECIMALS)} {PAYMENT_TOKEN_SYMBOL} | Minted {phase.minted}/{phase.phaseSupply} | Max {phase.maxPerWallet}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
          )}

          {(activeTab === "overview" || activeTab === "checker") && (
          <section className="card p-6 space-y-4">
            <h2 className="section-title">Wallet Checker</h2>
            <p className="text-xs text-milady-cream/60">
              Check which phases a wallet can mint right now. Connected wallet checks automatically; you can also paste any wallet.
            </p>

            <div className="rounded-xl border border-milady-pink/10 p-3 space-y-2">
              <p className="text-milady-cream/70 text-sm">Connected Wallet</p>
              {!address ? (
                <p className="text-xs text-milady-cream/60">Connect wallet to auto-check eligibility.</p>
              ) : connectedChecking ? (
                <p className="text-xs text-milady-cream/60">Checking connected wallet...</p>
              ) : (
                <div className="space-y-1">
                  {connectedEligibility.map((row) => (
                    <div key={`connected-${row.phaseId.toString()}`} className={`text-xs rounded-md border px-2 py-1 ${eligibilityTone(row)}`}>
                      Phase #{row.phaseId.toString()} {row.phaseName || "Unnamed"}: Allowlist {row.allowlisted === null ? "N/A (Public)" : row.allowlisted ? "Yes" : "No"} | Can mint now {row.canMintNow ? "Yes" : "No"} | Max/wallet {phases.find((p) => p.id === row.phaseId)?.maxPerWallet ?? "-"} ({row.reason})
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-milady-pink/10 p-3 space-y-2">
              <p className="text-milady-cream/70 text-sm">Check Any Wallet</p>
              <div className="flex flex-wrap gap-2">
                <input
                  className="input flex-1 min-w-[260px]"
                  value={checkerInput}
                  onChange={(event) => setCheckerInput(event.target.value)}
                  placeholder="Paste wallet address"
                />
                <button type="button" className="btn-secondary text-sm" onClick={runCustomWalletCheck} disabled={customChecking}>
                  {customChecking ? "Checking..." : "Check Wallet"}
                </button>
              </div>
              {checkerError && <p className="text-xs text-red-300/90">{checkerError}</p>}
              {checkerTarget && !customChecking && (
                <div className="space-y-1">
                  {customEligibility.map((row) => (
                        <div key={`custom-${row.phaseId.toString()}`} className={`text-xs rounded-md border px-2 py-1 ${eligibilityTone(row)}`}>
                      Phase #{row.phaseId.toString()} {row.phaseName || "Unnamed"}: Allowlist {row.allowlisted === null ? "N/A (Public)" : row.allowlisted ? "Yes" : "No"} | Can mint now {row.canMintNow ? "Yes" : "No"} | Max/wallet {phases.find((p) => p.id === row.phaseId)?.maxPerWallet ?? "-"} ({row.reason})
                        </div>
                  ))}
                </div>
              )}
            </div>
          </section>
              )}
        </div>

        <aside className="card p-6 space-y-3 lg:sticky lg:top-24">
          <h2 className="section-title">Mint</h2>
          {isThirdwebOnlyConnected && (
            <div className="rounded-xl border border-yellow-300/30 bg-yellow-300/10 p-3 space-y-2">
              <p className="text-xs text-yellow-300/90">
                Connected via thirdweb only. Mint/approve actions require a wagmi wallet connection.
              </p>
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={connectSignerWallet}
                disabled={isConnectingSigner || !preferredSignerConnector}
              >
                {isConnectingSigner ? "Connecting signer..." : "Connect Signer Wallet"}
              </button>
            </div>
          )}
          {isWrongChain && (
            <p className="text-xs text-yellow-300/90">
              Wrong network for minting. Switch signer wallet from chain {chainId} to Tempo ({TEMPO_CHAIN_ID}).
            </p>
          )}
          {!selectedPhase ? (
            <p className="text-sm text-milady-cream/70">Select a phase to mint.</p>
          ) : (
            <>
              <p className="text-sm text-milady-cream/80">Phase #{selectedPhase.id.toString()} {selectedPhase.name || "Mint Phase"}</p>
              <p className="text-sm text-milady-cream/80">Price: {formatTokenAmount(selectedPhase.price, PAYMENT_TOKEN_DECIMALS)} {PAYMENT_TOKEN_SYMBOL}</p>
              {selectedPhaseTimingLabel && <p className="text-sm text-milady-cream/80">{selectedPhaseTimingLabel}</p>}
              <p className="text-xs text-milady-cream/70">Wallet balance: {formatUnits(balance, PAYMENT_TOKEN_DECIMALS)} {PAYMENT_TOKEN_SYMBOL}</p>
              <p className="text-xs text-milady-cream/70">Allowance: {formatUnits(allowance, PAYMENT_TOKEN_DECIMALS)} {PAYMENT_TOKEN_SYMBOL}</p>
                <p className="text-xs text-milady-cream/70">Minted by wallet: {mintedPerWallet.toString()} / {selectedPhase.maxPerWallet}</p>
                <p className="text-xs text-milady-cream/70">Remaining in phase: {Math.max(0, selectedPhase.phaseSupply - selectedPhase.minted)}</p>
                <p className="text-xs text-milady-cream/70 break-all">Payment token: {paymentTokenAddress}</p>

              {!selectedPhase.isPublic && (
                <div className="space-y-1">
                  <p className="text-xs text-milady-cream/70">
                    Allowlist proof: {proofLoading ? "Checking..." : proofIncluded ? "Wallet is included" : "Wallet not included"}
                  </p>
                  <p className={`text-xs ${proofIncluded ? "text-green-300/90" : "text-yellow-300/90"}`}>
                    {proofIncluded
                      ? "Eligible for this allowlist phase."
                      : "Not eligible for this allowlist phase yet."}
                  </p>
                </div>
              )}

              <input
                type="number"
                className="input"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Enter quantity"
              />

              <p className="text-xs text-milady-cream/70">Total: {formatTokenAmount(totalCost, PAYMENT_TOKEN_DECIMALS)} {PAYMENT_TOKEN_SYMBOL}</p>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-secondary text-sm"
                  onClick={handleApprove}
                  disabled={!canTransact || isFreeMint || !needsApproval || approvePending || approveConfirming || !selectedPhase}
                >
                  {approvePending || approveConfirming
                    ? "Approving..."
                    : isFreeMint
                      ? "No Approval Needed"
                      : needsApproval
                        ? "Approve Token"
                        : "Approved"}
                </button>
                <button
                  type="button"
                  className="btn-primary text-sm"
                  onClick={handleMint}
                  disabled={!canTransact || mintPending || mintConfirming || !qtyValid || (needsApproval && totalCost > 0n)}
                >
                  {mintPending || mintConfirming ? "Minting..." : "Mint"}
                </button>
              </div>
            </>
          )}

          {!isConnected && <p className="text-xs text-milady-cream/60">Connect wallet to approve token and mint.</p>}
          {isConnected && !canTransact && (
            <p className="text-xs text-milady-cream/60">
              {isWrongChain
                ? `Switch wallet network to Tempo (${TEMPO_CHAIN_ID}) to sign mint transactions.`
                : "Connect MetaMask or WalletConnect to sign mint transactions on this page."}
            </p>
          )}
          {status && <p className="text-xs text-milady-cream/70">{status}</p>}

          <div className="pt-2 flex flex-wrap gap-2">
            <Link href={`/launchpad/collection/${collection}?tab=phases`} className="btn-secondary text-sm">Open Creator Phases</Link>
            <Link href="/launchpad" className="btn-ghost text-sm">Back to Launchpad</Link>
          </div>
        </aside>
      </section>
    </div>
  );
}
