"use client";

import { createConfig, http } from "wagmi";
import { metaMask, walletConnect } from "wagmi/connectors";
import { tempo } from "./chain";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "milady-marketplace";

export const wagmiConfig = createConfig({
  chains: [tempo],
  connectors: [
    metaMask(),
    walletConnect({ projectId }),
  ],
  transports: {
    [tempo.id]: http(),
  },
});
