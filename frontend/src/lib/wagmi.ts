"use client";

import { createConfig, http } from "wagmi";
import { coinbaseWallet, metaMask, walletConnect } from "wagmi/connectors";
import { tempo } from "./chain";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim();
const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Milady Marketplace";

const connectors = [
  coinbaseWallet({
    appName,
    preference: "smartWalletOnly",
  }),
  metaMask(),
];

if (projectId) {
  connectors.push(walletConnect({ projectId }));
}

export const wagmiConfig = createConfig({
  chains: [tempo],
  connectors,
  transports: {
    [tempo.id]: http(),
  },
});
