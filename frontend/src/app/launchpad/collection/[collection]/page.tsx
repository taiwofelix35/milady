"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { formatUnits, isAddress, parseUnits } from "viem";
import { useConnect, useReadContract, useReadContracts, useSwitchChain, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { MILADY_LAUNCHPAD_ABI, MILADY_LAUNCHPAD_COLLECTION_ABI } from "@/lib/abis";
import {
  addAllowlistAddresses,
  fetchAllowlist,
  fetchAllowlistProofVerification,
  fetchLaunchpadProject,
  fetchUpdatePhaseSyncPayload,
  importAllowlistCsv,
  rebuildAllowlistTree,
  removeAllowlistAddresses,
  upsertPublishedCollection,
  type BackendAllowlist,
} from "@/lib/backendApi";
import { LAUNCHPAD_CONTRACT_ADDRESS, PAYMENT_TOKEN_DECIMALS, PAYMENT_TOKEN_SYMBOL, TEMPO_CHAIN_ID } from "@/lib/chain";
import { upsertDynamicCollections } from "@/lib/collections";
import { useUnifiedWallet } from "@/hooks/useUnifiedWallet";
import { shortAddress } from "@/lib/utils";

type StudioTab = "overview" | "phases" | "mint" | "metadata";
type SavedPhaseRecord = {
  action: "create" | "update";
  phaseId: string;
  name: string;
  startTime: string;
  endTime: string;
  price: string;
  maxPerWallet: string;
  phaseSupply: string;
  isPublic: boolean;
  isActive: boolean;
  at: string;
};

type OnchainPhase = {
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

const STUDIO_TABS: StudioTab[] = ["overview", "phases", "mint", "metadata"];
const ZERO_MERKLE_ROOT = "0x0000000000000000000000000000000000000000000000000000000000000000";

function isStudioTab(value: string | null): value is StudioTab {
  return value === "overview" || value === "phases" || value === "mint" || value === "metadata";
}

function toBigIntSafe(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  if (typeof value === "string") return BigInt(value);
  return 0n;
}

function parsePhase(result: unknown, id: bigint): OnchainPhase | null {
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

export default function LaunchpadCollectionStudioPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const collectionAddress = String(params.collection || "");
  const collection = isAddress(collectionAddress) ? (collectionAddress as `0x${string}`) : null;
  const { address, canTransact, isThirdwebOnlyConnected, isWrongChain, chainId } = useUnifiedWallet();
  const { connect, connectors, isPending: isConnectingSigner } = useConnect();
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain();
  const preferredSignerConnector = useMemo(
    () =>
      connectors.find((connector) => connector.id === "metaMask") ??
      connectors.find((connector) => connector.id === "walletConnect") ??
      connectors[0],
    [connectors]
  );

  const activeTab = isStudioTab(searchParams.get("tab")) ? searchParams.get("tab") : "overview";
  const [project, setProject] = useState<{
    creator: `0x${string}`;
    collection: `0x${string}`;
    payoutRecipient: `0x${string}` | null;
    active: boolean | null;
    registeredToMarketplace: boolean;
    platformFeeBps: string | null;
    createdAt: string | null;
    warning?: string;
  } | null>(null);

  const [phaseName, setPhaseName] = useState("");
  const [phaseStart, setPhaseStart] = useState("");
  const [phaseEnd, setPhaseEnd] = useState("");
  const [phasePrice, setPhasePrice] = useState("");
  const [phaseMaxPerWallet, setPhaseMaxPerWallet] = useState("");
  const [phaseSupply, setPhaseSupply] = useState("");
  const [phaseId, setPhaseId] = useState("0");
  const [phaseIsPublic, setPhaseIsPublic] = useState(true);
  const [phaseIsActive, setPhaseIsActive] = useState(true);
  const [allowlist, setAllowlist] = useState<BackendAllowlist | null>(null);
  const [allowlistInput, setAllowlistInput] = useState("");
  const [allowlistCsv, setAllowlistCsv] = useState("");
  const [allowlistBusy, setAllowlistBusy] = useState(false);
  const [showAllowlistWallets, setShowAllowlistWallets] = useState(false);
  const [verifyWalletInput, setVerifyWalletInput] = useState("");
  const [verifyingProof, setVerifyingProof] = useState(false);
  const [proofVerification, setProofVerification] = useState<{
    account: `0x${string}`;
    includedInBackendAllowlist: boolean;
    onchainMerkleRoot: `0x${string}`;
    backendMerkleRoot: `0x${string}`;
    rootsMatch: boolean;
    isProofValidForOnchainRoot: boolean;
  } | null>(null);

  const [reserveMintTo, setReserveMintTo] = useState("");
  const [reserveMintQty, setReserveMintQty] = useState("");

  const [publishName, setPublishName] = useState("");
  const [publishDescription, setPublishDescription] = useState("Launchpad deployed collection.");
  const [publishSupply, setPublishSupply] = useState("0");
  const [publishCoverImage, setPublishCoverImage] = useState("");
  const [publishImageTemplate, setPublishImageTemplate] = useState("");
  const [publishImageExtension, setPublishImageExtension] = useState("png");
  const [publishStartTokenId, setPublishStartTokenId] = useState("1");
  const [publishExplorer, setPublishExplorer] = useState("");

  const [status, setStatus] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [savedPhases, setSavedPhases] = useState<SavedPhaseRecord[]>([]);
  const explorerBase = process.env.NEXT_PUBLIC_TEMPO_EXPLORER ?? "https://explore.tempo.xyz";

  const isLaunchpadConfigured =
    isAddress(LAUNCHPAD_CONTRACT_ADDRESS) &&
    LAUNCHPAD_CONTRACT_ADDRESS !== "0x0000000000000000000000000000000000000000";

  const { data: phaseCountRaw } = useReadContract({
    address: collection ?? undefined,
    abi: MILADY_LAUNCHPAD_COLLECTION_ABI,
    functionName: "phaseCount",
    query: { enabled: !!collection },
  });
  const phaseCount = Number(phaseCountRaw ?? 0n);
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
  const onchainPhases = useMemo(() => {
    return (phaseResults ?? [])
      .map((entry, index) => parsePhase(entry?.result, BigInt(index)))
      .filter((item): item is OnchainPhase => !!item);
  }, [phaseResults]);

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    let cancelled = false;

    async function loadProject() {
      if (!collection) return;
      const data = await fetchLaunchpadProject(collection);
      if (!cancelled) {
        setProject(data);
      }
    }

    loadProject();
    const intervalId = window.setInterval(loadProject, 20_000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [collection]);

  useEffect(() => {
    if (!collection) return;
    setPublishName(`Launchpad ${collection.slice(0, 6)}...${collection.slice(-4)}`);
    setPublishExplorer(`https://explore.tempo.xyz/address/${collection}`);
  }, [collection]);

  useEffect(() => {
    if (!collection || typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(`milady:phase-history:${collection.toLowerCase()}`);
      if (!raw) {
        setSavedPhases([]);
        return;
      }
      const parsed = JSON.parse(raw) as SavedPhaseRecord[];
      setSavedPhases(Array.isArray(parsed) ? parsed : []);
    } catch {
      setSavedPhases([]);
    }
  }, [collection]);

  useEffect(() => {
    if (isSuccess) {
      setStatus("Transaction confirmed.");
    }
  }, [isSuccess]);

  useEffect(() => {
    let cancelled = false;

    async function loadAllowlistSnapshot() {
      if (!collection || !/^\d+$/.test(phaseId)) {
        if (!cancelled) {
          setAllowlist(null);
        }
        return;
      }

      const data = await fetchAllowlist(collection, phaseId);
      if (!cancelled) {
        setAllowlist(data);
      }
    }

    loadAllowlistSnapshot();
    return () => {
      cancelled = true;
    };
  }, [collection, phaseId]);

  const creatorLabel = useMemo(() => {
    if (!project?.creator) return "-";
    return shortAddress(project.creator);
  }, [project]);

  const phaseConfigured =
    phaseName.trim().length > 0 &&
    phaseStart.length > 0 &&
    phaseEnd.length > 0 &&
    Number(phaseMaxPerWallet || "0") > 0 &&
    Number(phaseSupply || "0") > 0;

  const mintConfigured =
    Number.isInteger(Number(reserveMintQty || "0")) &&
    Number(reserveMintQty || "0") > 0;

  const metadataConfigured =
    publishName.trim().length > 0 &&
    publishImageTemplate.trim().includes("{id}") &&
    publishExplorer.trim().length > 0;

  function tabHref(tab: StudioTab) {
    return `/launchpad/collection/${collection}?tab=${tab}`;
  }

  function persistPhaseRecord(record: SavedPhaseRecord) {
    if (!collection || typeof window === "undefined") return;
    const next = [record, ...savedPhases].slice(0, 25);
    setSavedPhases(next);
    window.localStorage.setItem(`milady:phase-history:${collection.toLowerCase()}`, JSON.stringify(next));
  }

  function loadPhaseIntoForm(phase: OnchainPhase) {
    setPhaseId(phase.id.toString());
    setPhaseName(phase.name);
    setPhaseStart(new Date(Number(phase.startTime) * 1000).toISOString().slice(0, 16));
    setPhaseEnd(new Date(Number(phase.endTime) * 1000).toISOString().slice(0, 16));
    setPhasePrice(formatUnits(phase.price, PAYMENT_TOKEN_DECIMALS));
    setPhaseMaxPerWallet(String(phase.maxPerWallet));
    setPhaseSupply(String(phase.phaseSupply));
    setPhaseIsPublic(phase.isPublic);
    setPhaseIsActive(phase.active);
    setStatus(`Loaded phase #${phase.id.toString()} into editor.`);
  }

  function quickSetPhaseActive(phase: OnchainPhase, nextActive: boolean) {
    if (!ensureSignerReady()) return;
    if (!collection || !isLaunchpadConfigured) {
      setStatus("Launchpad is not configured.");
      return;
    }

    setStatus(`${nextActive ? "Activating" : "Pausing"} phase #${phase.id.toString()}...`);
    writeContract({
      address: LAUNCHPAD_CONTRACT_ADDRESS,
      abi: MILADY_LAUNCHPAD_ABI,
      functionName: "creatorUpdatePhase",
      args: [
        collection,
        phase.id,
        phase.name,
        phase.startTime,
        phase.endTime,
        phase.price,
        phase.maxPerWallet,
        phase.phaseSupply,
        phase.merkleRoot,
        phase.isPublic,
        nextActive,
      ],
    });
  }

  function clearPhaseEditor() {
    setPhaseId("0");
    setPhaseName("");
    setPhaseStart("");
    setPhaseEnd("");
    setPhasePrice("");
    setPhaseMaxPerWallet("");
    setPhaseSupply("");
    setPhaseIsPublic(true);
    setPhaseIsActive(true);
    setAllowlistInput("");
    setAllowlistCsv("");
    setStatus("Phase form cleared (frontend only).");
  }

  function deleteSavedPhase(index: number) {
    if (!collection || typeof window === "undefined") return;
    const next = savedPhases.filter((_, idx) => idx !== index);
    setSavedPhases(next);
    window.localStorage.setItem(`milady:phase-history:${collection.toLowerCase()}`, JSON.stringify(next));
    setStatus("Removed phase record from local history.");
  }

  function parseAddresses(input: string): `0x${string}`[] {
    const parts = input
      .split(/[\s,\n\r\t]+/g)
      .map((value) => value.trim())
      .filter(Boolean);

    const unique = Array.from(new Set(parts.map((value) => value.toLowerCase())));
    return unique.filter((value): value is `0x${string}` => isAddress(value));
  }

  async function refreshAllowlist() {
    if (!collection || !/^\d+$/.test(phaseId)) return;
    const data = await fetchAllowlist(collection, phaseId);
    setAllowlist(data);
  }

  async function verifyAllowlistProofOnchain() {
    if (!collection || !/^\d+$/.test(phaseId)) {
      setStatus("Enter a numeric phase ID first.");
      return;
    }

    const candidate = (verifyWalletInput || address || "").trim();
    if (!candidate || !isAddress(candidate)) {
      setStatus("Enter a valid wallet address to verify proof.");
      return;
    }

    setVerifyingProof(true);
    setStatus("Verifying allowlist proof against onchain merkle root...");

    const result = await fetchAllowlistProofVerification(collection, phaseId, candidate as `0x${string}`);
    setVerifyingProof(false);

    if (!result) {
      setProofVerification(null);
      setStatus("Proof verification failed. Check backend/API and try again.");
      return;
    }

    setProofVerification({
      account: candidate as `0x${string}`,
      includedInBackendAllowlist: result.includedInBackendAllowlist,
      onchainMerkleRoot: result.onchainMerkleRoot,
      backendMerkleRoot: result.backendMerkleRoot,
      rootsMatch: result.rootsMatch,
      isProofValidForOnchainRoot: result.isProofValidForOnchainRoot,
    });

    if (result.isProofValidForOnchainRoot) {
      setStatus("Proof is valid for onchain root. Mint should pass allowlist check.");
      return;
    }

    if (!result.rootsMatch) {
      setStatus("Proof invalid onchain because roots mismatch. Run Update + Sync for this phase.");
      return;
    }

    setStatus("Proof invalid for onchain root. Rebuild allowlist/proof for this wallet and retry.");
  }

  async function addWalletsToAllowlist() {
    if (!collection || !/^\d+$/.test(phaseId)) {
      setStatus("Enter a numeric phase ID first.");
      return;
    }

    const addresses = parseAddresses(allowlistInput);
    if (!addresses.length) {
      setStatus("Paste at least one valid wallet address to add.");
      return;
    }

    setAllowlistBusy(true);
    setStatus(`Adding ${addresses.length} wallet(s) to allowlist...`);
    const updated = await addAllowlistAddresses(collection, phaseId, addresses);
    setAllowlistBusy(false);

    if (!updated) {
      setStatus("Failed to add wallets to allowlist.");
      return;
    }

    setAllowlistInput("");
    setAllowlist(updated);
    setStatus(`Allowlist updated. ${updated.count} wallet(s), root ${updated.merkleRoot.slice(0, 10)}...`);
  }

  async function removeWalletsFromAllowlist() {
    if (!collection || !/^\d+$/.test(phaseId)) {
      setStatus("Enter a numeric phase ID first.");
      return;
    }

    const addresses = parseAddresses(allowlistInput);
    if (!addresses.length) {
      setStatus("Paste at least one valid wallet address to remove.");
      return;
    }

    setAllowlistBusy(true);
    setStatus(`Removing ${addresses.length} wallet(s) from allowlist...`);
    const updated = await removeAllowlistAddresses(collection, phaseId, addresses);
    setAllowlistBusy(false);

    if (!updated) {
      setStatus("Failed to remove wallets from allowlist.");
      return;
    }

    setAllowlistInput("");
    setAllowlist(updated);
    setStatus(`Allowlist updated. ${updated.count} wallet(s), root ${updated.merkleRoot.slice(0, 10)}...`);
  }

  async function importAllowlistFromCsvText() {
    if (!collection || !/^\d+$/.test(phaseId)) {
      setStatus("Enter a numeric phase ID first.");
      return;
    }
    if (!allowlistCsv.trim()) {
      setStatus("Paste CSV text or upload a CSV file first.");
      return;
    }

    setAllowlistBusy(true);
    setStatus("Importing CSV into allowlist...");
    const updated = await importAllowlistCsv(collection, phaseId, allowlistCsv);
    setAllowlistBusy(false);

    if (!updated) {
      setStatus("CSV import failed.");
      return;
    }

    setAllowlist(updated);
    setStatus(`CSV imported. ${updated.count} wallet(s), root ${updated.merkleRoot.slice(0, 10)}...`);
  }

  async function rebuildPhaseAllowlistTree() {
    if (!collection || !/^\d+$/.test(phaseId)) {
      setStatus("Enter a numeric phase ID first.");
      return;
    }

    setAllowlistBusy(true);
    setStatus("Rebuilding allowlist tree/proofs for current phase...");
    const rebuilt = await rebuildAllowlistTree(collection, phaseId);
    setAllowlistBusy(false);

    if (!rebuilt) {
      setStatus("Failed to rebuild allowlist tree for this phase.");
      return;
    }

    const refreshed = await fetchAllowlist(collection, phaseId);
    setAllowlist(refreshed ?? rebuilt);
    setStatus(`Allowlist tree rebuilt. Root ${rebuilt.merkleRoot.slice(0, 10)}... Run Update + Sync next.`);
  }

  async function onAllowlistCsvFileSelected(file: File | null) {
    if (!file) return;
    try {
      const text = await file.text();
      setAllowlistCsv(text);
      setStatus(`CSV loaded from ${file.name}.`);
    } catch {
      setStatus("Failed to read CSV file.");
    }
  }

  function registerCollection() {
    if (!ensureSignerReady()) return;
    if (!collection || !isLaunchpadConfigured) {
      setStatus("Launchpad is not configured.");
      return;
    }

    setStatus("Registering collection...");
    writeContract({
      address: LAUNCHPAD_CONTRACT_ADDRESS,
      abi: MILADY_LAUNCHPAD_ABI,
      functionName: "registerCollectionToMarketplace",
      args: [collection],
    });
  }

  function createPhase() {
    if (!ensureSignerReady()) return;
    if (!collection || !isLaunchpadConfigured) {
      setStatus("Launchpad is not configured.");
      return;
    }
    if (!phaseName.trim() || !phaseStart || !phaseEnd) {
      setStatus("Phase name/start/end are required.");
      return;
    }
    if (!phasePrice || Number(phasePrice) < 0 || !phaseMaxPerWallet || Number(phaseMaxPerWallet) < 1 || !phaseSupply || Number(phaseSupply) < 1) {
      setStatus("Price, max per wallet, and phase supply are required.");
      return;
    }

    const start = Math.floor(new Date(phaseStart).getTime() / 1000);
    const end = Math.floor(new Date(phaseEnd).getTime() / 1000);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      setStatus("End date must be after start date.");
      return;
    }

    setStatus("Submitting create phase...");
    const selectedMerkleRoot = phaseIsPublic ? ZERO_MERKLE_ROOT : allowlist?.merkleRoot ?? ZERO_MERKLE_ROOT;

    if (!phaseIsPublic && selectedMerkleRoot === ZERO_MERKLE_ROOT) {
      setStatus("This phase is allowlist-only, but no wallets are uploaded yet for this phase ID.");
      return;
    }

    writeContract({
      address: LAUNCHPAD_CONTRACT_ADDRESS,
      abi: MILADY_LAUNCHPAD_ABI,
      functionName: "creatorCreatePhase",
      args: [
        collection,
        phaseName,
        BigInt(start),
        BigInt(end),
        parseUnits(phasePrice || "0", PAYMENT_TOKEN_DECIMALS),
        Number(phaseMaxPerWallet),
        Number(phaseSupply),
        selectedMerkleRoot,
        phaseIsPublic,
      ],
    });

    persistPhaseRecord({
      action: "create",
      phaseId,
      name: phaseName,
      startTime: phaseStart,
      endTime: phaseEnd,
      price: phasePrice,
      maxPerWallet: phaseMaxPerWallet,
      phaseSupply: phaseSupply,
      isPublic: phaseIsPublic,
      isActive: true,
      at: new Date().toISOString(),
    });
  }

  async function updatePhaseAndSyncRoot() {
    if (!ensureSignerReady()) return;
    if (!collection || !isLaunchpadConfigured) {
      setStatus("Launchpad is not configured.");
      return;
    }
    if (!/^\d+$/.test(phaseId)) {
      setStatus("Phase ID must be numeric.");
      return;
    }
    if (!phaseName.trim() || !phaseStart || !phaseEnd) {
      setStatus("Phase name/start/end are required.");
      return;
    }
    if (!phasePrice || Number(phasePrice) < 0 || !phaseMaxPerWallet || Number(phaseMaxPerWallet) < 1 || !phaseSupply || Number(phaseSupply) < 1) {
      setStatus("Price, max per wallet, and phase supply are required.");
      return;
    }

    const start = Math.floor(new Date(phaseStart).getTime() / 1000);
    const end = Math.floor(new Date(phaseEnd).getTime() / 1000);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      setStatus("End date must be after start date.");
      return;
    }

    setStatus("Building synced update payload...");
    const payload = await fetchUpdatePhaseSyncPayload(collection, phaseId, {
      name: phaseName,
      startTime: String(start),
      endTime: String(end),
      priceWei: parseUnits(phasePrice || "0", PAYMENT_TOKEN_DECIMALS).toString(),
      maxPerWallet: Number(phaseMaxPerWallet),
      phaseSupply: Number(phaseSupply),
      isPublic: phaseIsPublic,
      active: phaseIsActive,
    });

    if (!payload) {
      setStatus("Failed to build payload. Check allowlist data and try again.");
      return;
    }

    setStatus("Submitting update phase...");
    writeContract({
      address: LAUNCHPAD_CONTRACT_ADDRESS,
      abi: MILADY_LAUNCHPAD_ABI,
      functionName: "creatorUpdatePhase",
      args: [
        collection,
        BigInt(phaseId),
        phaseName,
        BigInt(start),
        BigInt(end),
        parseUnits(phasePrice || "0", PAYMENT_TOKEN_DECIMALS),
        Number(phaseMaxPerWallet),
        Number(phaseSupply),
        payload.merkleRoot,
        phaseIsPublic,
        phaseIsActive,
      ],
    });

    persistPhaseRecord({
      action: "update",
      phaseId,
      name: phaseName,
      startTime: phaseStart,
      endTime: phaseEnd,
      price: phasePrice,
      maxPerWallet: phaseMaxPerWallet,
      phaseSupply: phaseSupply,
      isPublic: phaseIsPublic,
      isActive: phaseIsActive,
      at: new Date().toISOString(),
    });

    await refreshAllowlist();
  }

  function reserveMint() {
    if (!ensureSignerReady()) return;
    if (!collection || !isLaunchpadConfigured) {
      setStatus("Launchpad is not configured.");
      return;
    }

    const target = reserveMintTo || address;
    const qty = Number(reserveMintQty);
    if (!target || !isAddress(target)) {
      setStatus("Enter valid recipient address.");
      return;
    }
    if (!Number.isInteger(qty) || qty < 1) {
      setStatus("Quantity must be >= 1.");
      return;
    }

    setStatus("Submitting reserve mint...");
    writeContract({
      address: LAUNCHPAD_CONTRACT_ADDRESS,
      abi: MILADY_LAUNCHPAD_ABI,
      functionName: "creatorReserveMint",
      args: [collection, target as `0x${string}`, BigInt(qty)],
    });
  }

  async function publishCollectionMetadata() {
    if (!collection) {
      setStatus("Invalid collection address.");
      return;
    }

    const defaultMarket = (process.env.NEXT_PUBLIC_MARKETPLACE_CONTRACT ?? "0x0000000000000000000000000000000000000000") as `0x${string}`;
    if (!isAddress(defaultMarket)) {
      setStatus("NEXT_PUBLIC_MARKETPLACE_CONTRACT is missing/invalid.");
      return;
    }

    if (!publishImageTemplate.trim().includes("{id}")) {
      setStatus("Image template must include {id} placeholder.");
      return;
    }

    setPublishing(true);
    setStatus("Publishing collection metadata...");

    const record = await upsertPublishedCollection({
      nftContract: collection,
      marketContract: defaultMarket,
      name: publishName.trim() || `Launchpad ${collection.slice(0, 6)}...${collection.slice(-4)}`,
      description: publishDescription.trim() || "Launchpad deployed collection.",
      supply: Math.max(0, Number(publishSupply || "0")),
      coverImage: publishCoverImage.trim(),
      imageUrlTemplate: publishImageTemplate.trim(),
      imageExtension: publishImageExtension.trim() || "png",
      startTokenId: Math.max(0, Number(publishStartTokenId || "1")),
      explorer: publishExplorer.trim() || `https://explore.tempo.xyz/address/${collection}`,
    });

    if (!record) {
      setPublishing(false);
      setStatus("Publish failed. Check backend and retry.");
      return;
    }

    upsertDynamicCollections({
      collections: [
        {
          nftContract: record.nftContract,
          marketContract: record.marketContract,
          name: record.name,
          description: record.description,
          supply: record.supply,
          coverImage: record.coverImage,
          imageUrlTemplate: record.imageUrlTemplate,
          imageExtension: record.imageExtension,
          startTokenId: record.startTokenId,
          explorer: record.explorer,
        },
      ],
    });

    setPublishing(false);
    setStatus("Collection metadata published.");
  }

  function connectSignerWallet() {
    if (!preferredSignerConnector) {
      setStatus("No signer wallet connector available in this browser.");
      return;
    }

    setStatus(`Connecting signer wallet with ${preferredSignerConnector.name}...`);
    connect({ connector: preferredSignerConnector });
  }

  function ensureSignerReady() {
    if (canTransact) return true;

    if (isThirdwebOnlyConnected) {
      setStatus("Connect a signer wallet (MetaMask/WalletConnect) to submit Launchpad transactions.");
      return false;
    }

    if (isWrongChain) {
      setStatus(`Wrong network. Switch signer wallet from chain ${chainId} to Tempo (${TEMPO_CHAIN_ID}).`);
      return false;
    }

    setStatus("Connect a wagmi signer wallet to submit Launchpad transactions.");
    return false;
  }

  function switchToTempoChain() {
    switchChain({ chainId: TEMPO_CHAIN_ID });
    setStatus(`Switching wallet network to Tempo (${TEMPO_CHAIN_ID})...`);
  }

  if (!collection) {
    return (
      <div className="card p-6">
        <p className="text-milady-cream/70">Invalid collection address.</p>
        <Link href="/launchpad" className="btn-ghost inline-flex mt-3">Back to Launchpad</Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <section className="card p-6 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-milady-cream/50 text-xs uppercase tracking-wide">Studio</p>
            <h1 className="font-milady text-3xl text-milady-pink">Collection Studio</h1>
            <p className="text-milady-cream/70 text-sm mt-1">{collection}</p>
          </div>
          <Link href="/launchpad" className="btn-ghost text-sm">Back</Link>
        </div>
        {isThirdwebOnlyConnected && (
          <div className="rounded-xl border border-yellow-300/30 bg-yellow-300/10 p-3 space-y-2">
            <p className="text-yellow-300/90 text-xs">
              Connected via thirdweb only. Launchpad write actions require a wagmi wallet connection (MetaMask/WalletConnect).
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
          <div className="rounded-xl border border-yellow-300/30 bg-yellow-300/10 p-3 space-y-2">
            <p className="text-yellow-300/90 text-xs">
              Wrong network for Launchpad writes. Connected signer chain: {chainId}. Required: Tempo ({TEMPO_CHAIN_ID}).
            </p>
            <button
              type="button"
              className="btn-secondary text-xs"
              onClick={switchToTempoChain}
              disabled={isSwitchingChain}
            >
              {isSwitchingChain ? "Switching network..." : "Switch To Tempo"}
            </button>
          </div>
        )}
      </section>

      <section className="grid lg:grid-cols-[240px_minmax(0,1fr)] gap-4">
        <aside className="card p-3 h-fit lg:sticky lg:top-20">
          <p className="text-milady-cream/50 text-xs uppercase tracking-wide px-2 pb-2">Manage</p>
          <div className="space-y-1">
            {STUDIO_TABS.map((tab) => {
              const isActive = activeTab === tab;
              const label =
                tab === "overview"
                  ? "Overview"
                  : tab === "phases"
                    ? "Phases"
                    : tab === "mint"
                      ? "Reserve Mint"
                      : "Metadata";

              const badge =
                tab === "overview"
                  ? project?.registeredToMarketplace
                    ? "Ready"
                    : "Setup"
                  : tab === "phases"
                    ? phaseConfigured
                      ? "Ready"
                      : "Draft"
                    : tab === "mint"
                      ? mintConfigured
                        ? "Ready"
                        : "Draft"
                      : metadataConfigured
                        ? "Ready"
                        : "Draft";

              return (
                <Link
                  key={tab}
                  href={tabHref(tab)}
                  className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive
                      ? "border border-milady-pink/40 bg-milady-pink/10 text-milady-pink"
                      : "text-milady-cream/80 hover:bg-milady-pink/10"
                  }`}
                >
                  <span>{label}</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full border ${
                      badge === "Ready"
                        ? "border-green-400/40 text-green-300"
                        : "border-milady-pink/30 text-milady-cream/60"
                    }`}
                  >
                    {badge}
                  </span>
                </Link>
              );
            })}
          </div>
        </aside>

        <div className="space-y-4">
      <section className="card p-4 sticky top-20 z-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-milady-cream/70">
            {activeTab === "overview"
              ? "Overview actions"
              : activeTab === "phases"
                ? "Phase actions"
                : activeTab === "mint"
                  ? "Reserve mint actions"
                  : "Metadata actions"}
          </p>

          <div className="flex flex-wrap gap-2">
            {activeTab === "overview" && (
              <button
                type="button"
                onClick={registerCollection}
                disabled={!isLaunchpadConfigured || isPending || isConfirming}
                className="btn-secondary text-sm"
              >
                {isPending || isConfirming ? "Submitting..." : "Register Collection"}
              </button>
            )}

            {activeTab === "phases" && (
              <>
                <button
                  type="button"
                  className="btn-primary text-sm"
                  onClick={createPhase}
                  disabled={!isLaunchpadConfigured || isPending || isConfirming}
                >
                  {isPending || isConfirming ? "Submitting..." : "Create Phase"}
                </button>
                <button
                  type="button"
                  className="btn-secondary text-sm"
                  onClick={updatePhaseAndSyncRoot}
                  disabled={!isLaunchpadConfigured || isPending || isConfirming}
                >
                  {isPending || isConfirming ? "Submitting..." : "Update + Sync"}
                </button>
                <button
                  type="button"
                  className="btn-ghost text-sm"
                  onClick={clearPhaseEditor}
                  title="Delete phase draft"
                >
                  <span className="inline-flex items-center gap-1" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18" />
                      <path d="M8 6V4h8v2" />
                      <path d="M19 6l-1 14H6L5 6" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                    </svg>
                    Delete Draft
                  </span>
                </button>
              </>
            )}

            {activeTab === "mint" && (
              <button
                type="button"
                className="btn-primary text-sm"
                onClick={reserveMint}
                disabled={!isLaunchpadConfigured || isPending || isConfirming}
              >
                {isPending || isConfirming ? "Submitting..." : "Reserve Mint"}
              </button>
            )}

            {activeTab === "metadata" && (
              <button
                type="button"
                className="btn-primary text-sm"
                onClick={publishCollectionMetadata}
                disabled={publishing}
              >
                {publishing ? "Publishing..." : "Publish Metadata"}
              </button>
            )}
          </div>
        </div>
      </section>

      {activeTab === "overview" && (
        <section className="card p-6 space-y-4">
          <h2 className="section-title">Overview</h2>
          <div className="grid md:grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border border-milady-pink/10 p-3">
              <p className="text-milady-cream/50 text-xs uppercase tracking-wide">Creator</p>
              <p className="text-milady-cream mt-1">{creatorLabel}</p>
            </div>
            <div className="rounded-lg border border-milady-pink/10 p-3">
              <p className="text-milady-cream/50 text-xs uppercase tracking-wide">Marketplace Registration</p>
              <p className="text-milady-cream mt-1">{project?.registeredToMarketplace ? "Registered" : "Not registered"}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={registerCollection}
            disabled={!isLaunchpadConfigured || isPending || isConfirming}
            className="btn-secondary"
          >
            {isPending || isConfirming ? "Submitting..." : "Register Collection To Marketplace"}
          </button>
        </section>
      )}

      {activeTab === "phases" && (
        <section className="card p-6 space-y-4">
          <h2 className="section-title">Create / Edit Phase</h2>
          <p className="text-milady-cream/60 text-xs">
            Existing phases are loaded directly from chain. Click a phase to load it into the editor, then update and sync.
          </p>

          {onchainPhases.length > 0 && (
            <div className="rounded-lg border border-milady-pink/10 p-3 space-y-2">
              <p className="text-milady-cream/60 text-xs uppercase tracking-wide">Existing Onchain Phases</p>
              {onchainPhases.map((phase) => (
                <div
                  key={phase.id.toString()}
                  className="w-full text-left border border-milady-pink/10 hover:border-milady-pink/30 rounded-lg p-2 text-xs text-milady-cream/80"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-milady-pink">Phase #{phase.id.toString()} {phase.name}</span>
                    <span>{phase.isPublic ? "Public" : "Allowlist"} | {phase.active ? "Active" : "Inactive"}</span>
                  </div>
                  <p className="mt-1">Price {formatUnits(phase.price, PAYMENT_TOKEN_DECIMALS)} {PAYMENT_TOKEN_SYMBOL} | Minted {phase.minted}/{phase.phaseSupply} | Max/wallet {phase.maxPerWallet}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      onClick={() => loadPhaseIntoForm(phase)}
                    >
                      Load In Editor
                    </button>
                    <span className="text-[11px] px-2 py-0.5 rounded-full border border-milady-pink/20">
                      {phase.active ? "Live" : "Paused"}
                    </span>
                    <button
                      type="button"
                      className="btn-ghost text-xs"
                      onClick={(event) => {
                        event.stopPropagation();
                        quickSetPhaseActive(phase, !phase.active);
                      }}
                      disabled={!isLaunchpadConfigured || isPending || isConfirming}
                    >
                      {phase.active ? "Pause Now" : "Activate Now"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="grid md:grid-cols-2 gap-4">
            <input type="number" className="input" min="0" step="1" value={phaseId} onChange={(e) => setPhaseId(e.target.value)} placeholder="Phase ID" />
            <input className="input" value={phaseName} onChange={(e) => setPhaseName(e.target.value)} placeholder="Phase name" />
            <input type="datetime-local" className="input" value={phaseStart} onChange={(e) => setPhaseStart(e.target.value)} />
            <input type="datetime-local" className="input" value={phaseEnd} onChange={(e) => setPhaseEnd(e.target.value)} />
            <input type="number" className="input" min="0" step="0.001" value={phasePrice} onChange={(e) => setPhasePrice(e.target.value)} placeholder={`Mint price (${PAYMENT_TOKEN_SYMBOL})`} />
            <input type="number" className="input" min="1" step="1" value={phaseMaxPerWallet} onChange={(e) => setPhaseMaxPerWallet(e.target.value)} placeholder="Max per wallet" />
            <input type="number" className="input" min="1" step="1" value={phaseSupply} onChange={(e) => setPhaseSupply(e.target.value)} placeholder="Phase supply" />
          </div>
          <label className="flex items-center gap-2 text-sm text-milady-cream/70"><input type="checkbox" checked={phaseIsPublic} onChange={(e) => setPhaseIsPublic(e.target.checked)} />Public phase</label>
          <label className="flex items-center gap-2 text-sm text-milady-cream/70"><input type="checkbox" checked={phaseIsActive} onChange={(e) => setPhaseIsActive(e.target.checked)} />Active phase</label>

          <div className="rounded-lg border border-milady-pink/10 p-4 space-y-3">
            <p className="text-milady-cream/70 text-xs uppercase tracking-wide">Allowlist Wallet Upload (Per Phase ID)</p>
            <p className="text-milady-cream/60 text-xs">
              Use the same Phase ID above. For non-public phases, upload wallets here before creating/updating the phase.
            </p>
            <div className="grid md:grid-cols-2 gap-3 text-xs text-milady-cream/70">
              <p>Current wallets: <span className="text-milady-cream">{allowlist?.count ?? 0}</span></p>
              <p className="break-all">Merkle root: <span className="text-milady-cream">{allowlist?.merkleRoot ?? ZERO_MERKLE_ROOT}</span></p>
            </div>

            <div className="rounded-lg border border-milady-pink/10 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-milady-cream/60 text-xs uppercase tracking-wide">Wallets In This Phase Allowlist</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="btn-ghost text-xs"
                    onClick={() => setShowAllowlistWallets((prev) => !prev)}
                  >
                    {showAllowlistWallets ? "Hide" : "Show"}
                  </button>
                  <button
                    type="button"
                    className="btn-ghost text-xs"
                    onClick={refreshAllowlist}
                    disabled={allowlistBusy}
                  >
                    Refresh
                  </button>
                </div>
              </div>

              {!allowlist?.addresses?.length ? (
                <p className="text-xs text-milady-cream/60">No wallets stored yet for this phase ID.</p>
              ) : showAllowlistWallets ? (
                <div className="max-h-48 overflow-auto space-y-1">
                  {allowlist.addresses.map((wallet) => (
                    <p key={wallet} className="text-xs text-milady-cream/80 font-mono break-all">
                      {wallet}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-milady-cream/60">Wallet list hidden. Click Show to view addresses.</p>
              )}
            </div>

            <textarea
              className="input min-h-[96px]"
              value={allowlistInput}
              onChange={(e) => setAllowlistInput(e.target.value)}
              placeholder="Paste wallet addresses (comma/newline separated)"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={addWalletsToAllowlist}
                disabled={allowlistBusy}
              >
                {allowlistBusy ? "Working..." : "Add Wallets"}
              </button>
              <button
                type="button"
                className="btn-ghost text-sm"
                onClick={removeWalletsFromAllowlist}
                disabled={allowlistBusy}
              >
                {allowlistBusy ? "Working..." : "Remove Wallets"}
              </button>
            </div>

            <textarea
              className="input min-h-[96px]"
              value={allowlistCsv}
              onChange={(e) => setAllowlistCsv(e.target.value)}
              placeholder="Paste CSV content (first column should contain addresses)"
            />

            <div className="flex flex-wrap gap-2 items-center">
              <label className="btn-ghost text-sm cursor-pointer">
                Upload CSV
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(event) => onAllowlistCsvFileSelected(event.target.files?.[0] ?? null)}
                />
              </label>
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={importAllowlistFromCsvText}
                disabled={allowlistBusy}
              >
                {allowlistBusy ? "Working..." : "Import CSV"}
              </button>
              <button
                type="button"
                className="btn-ghost text-sm"
                onClick={rebuildPhaseAllowlistTree}
                disabled={allowlistBusy}
              >
                {allowlistBusy ? "Working..." : "Rebuild Tree/Proofs"}
              </button>
            </div>

            <div className="rounded-lg border border-milady-pink/10 p-3 space-y-2">
              <p className="text-milady-cream/60 text-xs uppercase tracking-wide">Verify Proof Against Onchain Root</p>
              <div className="flex flex-wrap gap-2">
                <input
                  className="input flex-1 min-w-[260px]"
                  value={verifyWalletInput}
                  onChange={(e) => setVerifyWalletInput(e.target.value)}
                  placeholder="Wallet to verify (defaults to connected wallet)"
                />
                <button
                  type="button"
                  className="btn-secondary text-sm"
                  onClick={verifyAllowlistProofOnchain}
                  disabled={verifyingProof}
                >
                  {verifyingProof ? "Verifying..." : "Verify Onchain Proof"}
                </button>
              </div>
              {proofVerification && (
                <div className="space-y-1 text-xs text-milady-cream/75">
                  <p className="break-all">Wallet: <span className="text-milady-cream">{proofVerification.account}</span></p>
                  <p>Backend included: <span className="text-milady-cream">{proofVerification.includedInBackendAllowlist ? "Yes" : "No"}</span></p>
                  <p>Roots match: <span className="text-milady-cream">{proofVerification.rootsMatch ? "Yes" : "No"}</span></p>
                  <p>Proof valid for onchain root: <span className={proofVerification.isProofValidForOnchainRoot ? "text-green-300" : "text-red-300"}>{proofVerification.isProofValidForOnchainRoot ? "Yes" : "No"}</span></p>
                  <p className="break-all">Onchain root: <span className="text-milady-cream">{proofVerification.onchainMerkleRoot}</span></p>
                  <p className="break-all">Backend root: <span className="text-milady-cream">{proofVerification.backendMerkleRoot}</span></p>
                </div>
              )}
            </div>
          </div>

          {savedPhases.length > 0 && (
            <div className="rounded-lg border border-milady-pink/10 p-3 space-y-2">
              <p className="text-milady-cream/60 text-xs uppercase tracking-wide">Recent Phase Submissions</p>
              {savedPhases.map((phase, idx) => (
                <div key={`${phase.phaseId}-${phase.at}-${idx}`} className="border border-milady-pink/10 rounded-lg p-2 text-xs text-milady-cream/80">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-milady-pink">{phase.action.toUpperCase()} Phase #{phase.phaseId}</span>
                    <div className="flex items-center gap-2">
                      <span>{new Date(phase.at).toLocaleString()}</span>
                      <button
                        type="button"
                        className="btn-ghost text-xs"
                        onClick={() => deleteSavedPhase(idx)}
                        title="Delete local phase record"
                      >
                        <span className="inline-flex items-center gap-1" aria-hidden="true">
                          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18" />
                            <path d="M8 6V4h8v2" />
                            <path d="M19 6l-1 14H6L5 6" />
                            <path d="M10 11v6" />
                            <path d="M14 11v6" />
                          </svg>
                        </span>
                      </button>
                    </div>
                  </div>
                  <p className="mt-1">{phase.name} | {phase.price} {PAYMENT_TOKEN_SYMBOL} | max {phase.maxPerWallet} | supply {phase.phaseSupply}</p>
                  <p className="mt-1 text-milady-cream/60">{phase.isPublic ? "Public" : "Allowlist"} | {phase.isActive ? "Active" : "Inactive"}</p>
                </div>
              ))}
            </div>
          )}

        </section>
      )}

      {activeTab === "mint" && (
        <section className="card p-6 space-y-4">
          <h2 className="section-title">Reserve Mint</h2>
          <div className="rounded-lg border border-milady-pink/10 p-3 text-sm text-milady-cream/80">
            <p>Mint tab lets creator mint directly to any wallet for team/reserve allocation.</p>
            <p className="text-milady-cream/60 text-xs mt-1">Set recipient and quantity, then submit Reserve Mint.</p>
            <p className="text-milady-cream/60 text-xs mt-1">
              Public mint page for users: <Link href={`/mint/${collection}`} className="text-milady-pink hover:underline">/mint/{collection}</Link>
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <input className="input" value={reserveMintTo} onChange={(e) => setReserveMintTo(e.target.value)} placeholder="Recipient address (defaults to wallet)" />
            <input className="input" type="number" min="1" step="1" value={reserveMintQty} onChange={(e) => setReserveMintQty(e.target.value)} placeholder="Quantity" />
          </div>
          <button type="button" className="btn-primary" onClick={reserveMint} disabled={!isLaunchpadConfigured || isPending || isConfirming}>
            {isPending || isConfirming ? "Submitting..." : "Reserve Mint"}
          </button>
        </section>
      )}

      {activeTab === "metadata" && (
        <section className="card p-6 space-y-4">
          <h2 className="section-title">Collection Metadata</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <input className="input" value={publishName} onChange={(e) => setPublishName(e.target.value)} placeholder="Display name" />
            <input className="input" type="number" min="0" step="1" value={publishSupply} onChange={(e) => setPublishSupply(e.target.value)} placeholder="Supply" />
            <input className="input" value={publishCoverImage} onChange={(e) => setPublishCoverImage(e.target.value)} placeholder="Cover image URL" />
            <input className="input" value={publishImageTemplate} onChange={(e) => setPublishImageTemplate(e.target.value)} placeholder="Image URL template (.../{id}.png)" />
            <input className="input" value={publishImageExtension} onChange={(e) => setPublishImageExtension(e.target.value)} placeholder="Image extension" />
            <input className="input" type="number" min="0" step="1" value={publishStartTokenId} onChange={(e) => setPublishStartTokenId(e.target.value)} placeholder="Start token ID" />
            <input className="input md:col-span-2" value={publishExplorer} onChange={(e) => setPublishExplorer(e.target.value)} placeholder="Explorer URL" />
            <textarea className="input md:col-span-2 min-h-[96px]" value={publishDescription} onChange={(e) => setPublishDescription(e.target.value)} placeholder="Description" />
          </div>
          <button type="button" className="btn-primary" onClick={publishCollectionMetadata} disabled={publishing}>
            {publishing ? "Publishing..." : "Publish Metadata"}
          </button>
        </section>
      )}

        </div>
      </section>

      {status && <section className="card p-4 text-sm text-milady-cream/80">{status}</section>}

      {hash && (
        <section className="card p-4 space-y-2">
          <p className="text-xs text-milady-cream/60 uppercase tracking-wide">Latest Transaction</p>
          <p className="text-sm text-milady-cream break-all font-mono">{hash}</p>
          <a
            href={`${explorerBase}/tx/${hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-milady-pink hover:underline"
          >
            View on Explorer
          </a>
        </section>
      )}
    </div>
  );
}
