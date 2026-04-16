"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThirdwebProvider } from "thirdweb/react";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/lib/wagmi";
import { useEffect, useState } from "react";
import { fetchPublishedCollections } from "@/lib/backendApi";
import { upsertDynamicCollections } from "@/lib/collections";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  useEffect(() => {
    let cancelled = false;

    async function hydratePublishedCollections() {
      const collections = await fetchPublishedCollections();
      if (cancelled || collections.length === 0) return;
      upsertDynamicCollections({
        collections: collections.map((collection) => ({
          nftContract: collection.nftContract,
          marketContract: collection.marketContract,
          name: collection.name,
          description: collection.description,
          supply: collection.supply,
          coverImage: collection.coverImage,
          imageUrlTemplate: collection.imageUrlTemplate,
          imageExtension: collection.imageExtension,
          startTokenId: collection.startTokenId,
          explorer: collection.explorer,
        })),
      });
    }

    hydratePublishedCollections();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ThirdwebProvider>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </WagmiProvider>
    </ThirdwebProvider>
  );
}
