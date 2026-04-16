import { createThirdwebClient, defineChain } from "thirdweb";
import { createWallet, inAppWallet, walletConnect } from "thirdweb/wallets";
import { TEMPO_CHAIN_ID } from "./chain";

const thirdwebClientId =
  process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID ?? "fa4f5822295d6f0213552e471fbdcff4";

export const thirdwebClient = createThirdwebClient({ clientId: thirdwebClientId });

export const thirdwebTempoChain = defineChain({
  id: TEMPO_CHAIN_ID,
  name: "Tempo",
  rpc: process.env.NEXT_PUBLIC_TEMPO_RPC_URL ?? "https://rpc.tempo.xyz",
});

export const thirdwebWallets = [
  inAppWallet({
    auth: {
      options: ["passkey", "phone", "email", "google", "apple", "discord", "x", "telegram"],
      mode: "popup",
    },
    metadata: {
      name: process.env.NEXT_PUBLIC_APP_NAME ?? "Milady Marketplace",
    },
  }),
  createWallet("com.coinbase.wallet"),
  createWallet("io.metamask"),
  walletConnect(),
];