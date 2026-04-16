"use client";

import { useMemo } from "react";
import { useAccount, useChainId } from "wagmi";
import { useActiveAccount } from "thirdweb/react";
import { isAddress } from "viem";
import { TEMPO_CHAIN_ID } from "@/lib/chain";

export function useUnifiedWallet() {
  const { address: wagmiAddress, isConnected: isWagmiConnected } = useAccount();
  const chainId = useChainId();
  const thirdwebAccount = useActiveAccount();

  return useMemo(() => {
    const rawAddress = wagmiAddress ?? thirdwebAccount?.address;
    const address = rawAddress && isAddress(rawAddress) ? (rawAddress as `0x${string}`) : undefined;
    const isConnected = Boolean(address);
    const isWrongChain = isWagmiConnected && chainId !== TEMPO_CHAIN_ID;
    const canTransact = isWagmiConnected && !isWrongChain;

    return {
      address,
      isConnected,
      isWagmiConnected,
      chainId,
      isWrongChain,
      canTransact,
      isThirdwebOnlyConnected: isConnected && !isWagmiConnected,
    };
  }, [wagmiAddress, isWagmiConnected, thirdwebAccount?.address, chainId]);
}
