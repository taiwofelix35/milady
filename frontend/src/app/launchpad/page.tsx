"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { isAddress } from "viem";
import { useConnect, usePublicClient, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { MILADY_LAUNCHPAD_ABI, MILADY_LAUNCHPAD_COLLECTION_ABI } from "@/lib/abis";
import { LAUNCHPAD_CONTRACT_ADDRESS, MARKETPLACE_CONTRACT_ADDRESS } from "@/lib/chain";
import { upsertPublishedCollection } from "@/lib/backendApi";
import { upsertDynamicCollections } from "@/lib/collections";
import { useUnifiedWallet } from "@/hooks/useUnifiedWallet";
import { fetchMetadata, resolveIPFS, shortAddress } from "@/lib/utils";

function deriveImageTemplate(imageUrl: string, tokenId: number): string | null {
  if (!imageUrl) return null;
  const token = String(tokenId);
  const patterns = [
    new RegExp(`/${token}(\\.[^/?#]+)([?#].*)?$`),
    new RegExp(`_${token}(\\.[^/?#]+)([?#].*)?$`),
    new RegExp(`-${token}(\\.[^/?#]+)([?#].*)?$`),
    new RegExp(`${token}(\\.[^/?#]+)([?#].*)?$`),
  ];

  for (const pattern of patterns) {
    if (pattern.test(imageUrl)) {
      return imageUrl.replace(pattern, (_match, ext: string, query: string = "") => `/{id}${ext}${query}`);
    }
  }

  return null;
}

export default function LaunchpadPage() {
  const router = useRouter();
  const { address, canTransact, isThirdwebOnlyConnected } = useUnifiedWallet();
  const { connect, connectors, isPending: isConnectingSigner } = useConnect();
  const publicClient = usePublicClient();
  const syncedCollectionsRef = useRef<Set<string>>(new Set());
  const preferredSignerConnector = useMemo(
    () =>
      connectors.find((connector) => connector.id === "metaMask") ??
      connectors.find((connector) => connector.id === "walletConnect") ??
      connectors[0],
    [connectors]
  );

  const isLaunchpadConfigured =
    isAddress(LAUNCHPAD_CONTRACT_ADDRESS) &&
    LAUNCHPAD_CONTRACT_ADDRESS !== "0x0000000000000000000000000000000000000000";

  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [maxSupply, setMaxSupply] = useState("");
  const [prerevealURI, setPrerevealURI] = useState("");
  const [contractURI, setContractURI] = useState("");
  const [payoutRecipient, setPayoutRecipient] = useState("");
  const [autoOpenAfterDeploy, setAutoOpenAfterDeploy] = useState(true);
  const [status, setStatus] = useState<string | null>(null);

  const deployArgsReady =
    name.trim().length > 0 &&
    symbol.trim().length > 0 &&
    Number(maxSupply) > 0 &&
    isAddress(payoutRecipient || address || "0x0000000000000000000000000000000000000000");

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const { data: creatorCollections, refetch: refetchCollections } = useReadContract({
    address: LAUNCHPAD_CONTRACT_ADDRESS,
    abi: MILADY_LAUNCHPAD_ABI,
    functionName: "getCreatorCollections",
    args: [address as `0x${string}`],
    query: {
      enabled: !!address && isLaunchpadConfigured,
    },
  });

  const collections = useMemo(
    () => ((creatorCollections ?? []) as `0x${string}`[]),
    [creatorCollections]
  );

  async function autoRegisterCollectionInMarketplace(collection: `0x${string}`) {
    if (!publicClient || !isAddress(MARKETPLACE_CONTRACT_ADDRESS)) return;
    const key = collection.toLowerCase();
    if (syncedCollectionsRef.current.has(key)) return;

    syncedCollectionsRef.current.add(key);

    try {
      const [nameResult, supplyResult, contractUriResult, tokenUriOneResult, tokenUriZeroResult] = await Promise.allSettled([
        publicClient.readContract({
          address: collection,
          abi: MILADY_LAUNCHPAD_COLLECTION_ABI,
          functionName: "name",
        }),
        publicClient.readContract({
          address: collection,
          abi: MILADY_LAUNCHPAD_COLLECTION_ABI,
          functionName: "maxSupply",
        }),
        publicClient.readContract({
          address: collection,
          abi: MILADY_LAUNCHPAD_COLLECTION_ABI,
          functionName: "contractURI",
        }),
        publicClient.readContract({
          address: collection,
          abi: MILADY_LAUNCHPAD_COLLECTION_ABI,
          functionName: "tokenURI",
          args: [1n],
        }),
        publicClient.readContract({
          address: collection,
          abi: MILADY_LAUNCHPAD_COLLECTION_ABI,
          functionName: "tokenURI",
          args: [0n],
        }),
      ]);

      const collectionName =
        String(nameResult.status === "fulfilled" ? nameResult.value : "").trim() ||
        `Launchpad ${collection.slice(0, 6)}...${collection.slice(-4)}`;
      const supply = Number(supplyResult.status === "fulfilled" ? supplyResult.value : 0n);
      const explorer = `https://explore.tempo.xyz/address/${collection}`;

      const contractUri = contractUriResult.status === "fulfilled" ? String(contractUriResult.value ?? "") : "";
      const tokenUriOne = tokenUriOneResult.status === "fulfilled" ? String(tokenUriOneResult.value ?? "") : "";
      const tokenUriZero = tokenUriZeroResult.status === "fulfilled" ? String(tokenUriZeroResult.value ?? "") : "";

      const tokenStart = tokenUriOne ? 1 : tokenUriZero ? 0 : 1;
      const tokenUri = tokenStart === 1 ? tokenUriOne : tokenUriZero;

      const contractMeta = contractUri ? await fetchMetadata(contractUri) : {};
      const tokenMeta = tokenUri ? await fetchMetadata(tokenUri) : {};

      const coverImage = resolveIPFS(tokenMeta.image || contractMeta.image || "/placeholder.svg");
      const imageUrlTemplate = deriveImageTemplate(coverImage, tokenStart) ?? coverImage;
      const imageExtension = (() => {
        const clean = imageUrlTemplate.split(/[?#]/)[0];
        const ext = clean.split(".").pop()?.toLowerCase();
        if (!ext || ext.length > 6) return "png";
        return ext;
      })();
      const description =
        String(contractMeta.description ?? "").trim() ||
        String(tokenMeta.description ?? "").trim() ||
        "Launchpad deployed collection.";

      const record = await upsertPublishedCollection({
        nftContract: collection,
        marketContract: MARKETPLACE_CONTRACT_ADDRESS,
        name: collectionName,
        description,
        supply,
        coverImage,
        imageUrlTemplate,
        imageExtension,
        startTokenId: tokenStart,
        explorer,
      });

      if (!record) return;

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
    } catch {
      syncedCollectionsRef.current.delete(key);
    }
  }

  function deployCollection() {
    if (!isLaunchpadConfigured) {
      setStatus("Launchpad contract is not configured.");
      return;
    }
    if (!deployArgsReady) {
      setStatus("Fill all required fields first.");
      return;
    }

    setStatus("Deploy transaction submitted...");

    writeContract({
      address: LAUNCHPAD_CONTRACT_ADDRESS,
      abi: MILADY_LAUNCHPAD_ABI,
      functionName: "deployCollection",
      args: [
        name,
        symbol,
        BigInt(maxSupply),
        prerevealURI,
        contractURI,
        (payoutRecipient || address) as `0x${string}`,
      ],
    });
  }

  function connectSignerWallet() {
    if (!preferredSignerConnector) {
      setStatus("No signer wallet connector available in this browser.");
      return;
    }

    setStatus(`Connecting signer wallet with ${preferredSignerConnector.name}...`);
    connect({ connector: preferredSignerConnector });
  }

  useEffect(() => {
    if (!isSuccess) return;

    let cancelled = false;

    async function openNewestCollection() {
      const refreshed = await refetchCollections();
      if (cancelled) return;

      const nextCollections = ((refreshed.data ?? creatorCollections ?? []) as `0x${string}`[]);
      const newest = nextCollections[nextCollections.length - 1];

      if (!newest) {
        setStatus("Deploy confirmed. Refresh and open your collection.");
        return;
      }

      setStatus("Deploy confirmed.");
      void autoRegisterCollectionInMarketplace(newest);
      if (autoOpenAfterDeploy) {
        router.push(`/launchpad/collection/${newest}`);
      }
    }

    openNewestCollection();
    return () => {
      cancelled = true;
    };
  }, [isSuccess, refetchCollections, creatorCollections, autoOpenAfterDeploy, router]);

  useEffect(() => {
    if (!collections.length) return;
    for (const collection of collections) {
      void autoRegisterCollectionInMarketplace(collection);
    }
  }, [collections]);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <section className="card p-6 space-y-3">
        <p className="text-milady-cream/50 text-xs uppercase tracking-wide">Studio</p>
        <h1 className="font-milady text-3xl text-milady-pink">Create Collection</h1>
        <p className="text-milady-cream/70 text-sm">
          Deploy first. Then open your collection studio page to edit metadata, add phases, and manage mint actions.
        </p>
        <p className="text-milady-cream/50 text-xs">Launchpad: {shortAddress(LAUNCHPAD_CONTRACT_ADDRESS)}</p>
        {!isLaunchpadConfigured && (
          <p className="text-yellow-300/90 text-xs">
            Launchpad contract is not configured. Set NEXT_PUBLIC_LAUNCHPAD_CONTRACT first.
          </p>
        )}
        {isThirdwebOnlyConnected && (
          <div className="rounded-xl border border-yellow-300/30 bg-yellow-300/10 p-3 space-y-2">
            <p className="text-yellow-300/90 text-xs">
              Connected via thirdweb. For creator transactions on this page, connect a wagmi wallet (MetaMask/WalletConnect) too.
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
      </section>

      <section className="card p-6 space-y-4">
        <h2 className="section-title">Deploy Contract</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Collection name" />
          <input className="input" value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="Symbol" />
          <input className="input" type="number" min="1" value={maxSupply} onChange={(e) => setMaxSupply(e.target.value)} placeholder="Max supply" />
          <input className="input" value={payoutRecipient} onChange={(e) => setPayoutRecipient(e.target.value)} placeholder="Payout recipient (defaults to wallet)" />
          <input className="input" value={prerevealURI} onChange={(e) => setPrerevealURI(e.target.value)} placeholder="Prereveal URI" />
          <input className="input" value={contractURI} onChange={(e) => setContractURI(e.target.value)} placeholder="Contract URI" />
        </div>

        <label className="flex items-center gap-2 text-sm text-milady-cream/70">
          <input
            type="checkbox"
            checked={autoOpenAfterDeploy}
            onChange={(e) => setAutoOpenAfterDeploy(e.target.checked)}
          />
          Open collection studio page after deploy
        </label>

        <button
          type="button"
          className="btn-primary"
          onClick={deployCollection}
          disabled={!canTransact || !isLaunchpadConfigured || !deployArgsReady || isPending || isConfirming}
        >
          {isPending || isConfirming ? "Submitting..." : "Deploy Collection"}
        </button>

        {status && <p className="text-xs text-milady-cream/70">{status}</p>}
      </section>

      <section className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="section-title">My Collections</h2>
          <button type="button" className="btn-ghost text-sm" onClick={() => refetchCollections()}>
            Refresh
          </button>
        </div>

        {!collections.length ? (
          <p className="text-milady-cream/60 text-sm">No deployed collections found for this wallet.</p>
        ) : (
          <div className="space-y-2">
            {collections.map((collection) => (
              <div
                key={collection}
                className="rounded-lg border border-milady-pink/10 px-3 py-2 flex items-center justify-between gap-3"
              >
                <a
                  href={`https://explore.tempo.xyz/address/${collection}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-milady-pink hover:underline text-sm"
                >
                  {collection}
                </a>
                <div className="flex items-center gap-2">
                  <Link href={`/mint/${collection}`} className="btn-ghost text-sm">
                    Public Mint
                  </Link>
                  <Link href={`/launchpad/collection/${collection}`} className="btn-secondary text-sm">
                    Open Studio
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
