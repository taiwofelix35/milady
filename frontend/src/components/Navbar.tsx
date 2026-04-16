"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useDisconnect as useWagmiDisconnect } from "wagmi";
import {
  ConnectButton,
  darkTheme,
  useActiveWallet,
  useDisconnect as useThirdwebDisconnect,
} from "thirdweb/react";
import { useTrackedCollections } from "@/lib/collections";
import { getSelectedCollectionSlug, saveSelectedCollectionSlug } from "@/lib/collectionContext";
import { useUnifiedWallet } from "@/hooks/useUnifiedWallet";
import { thirdwebClient, thirdwebTempoChain, thirdwebWallets } from "@/lib/thirdweb";
import { shortAddress } from "@/lib/utils";

export function Navbar() {
  const { address: connectedAddress, isConnected, isWagmiConnected } = useUnifiedWallet();
  const { disconnect: disconnectWagmi } = useWagmiDisconnect();
  const thirdwebWallet = useActiveWallet();
  const { disconnect: disconnectThirdweb } = useThirdwebDisconnect();

  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const trackedCollections = useTrackedCollections();

  const [queryCollection, setQueryCollection] = useState("");
  const [navSearch, setNavSearch] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const profileHref = connectedAddress ? `/profile/${connectedAddress}` : null;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const slugFromQuery = params.get("collection") ?? "";
    const slug = slugFromQuery || getSelectedCollectionSlug();
    setQueryCollection(slug);
  }, [pathname]);

  useEffect(() => {
    if (pathname !== "/search") return;
    const q = searchParams.get("q") ?? "";
    setNavSearch(q);
  }, [pathname, searchParams]);

  const pathCollection = pathname.startsWith("/collection/") ? pathname.split("/")[2] ?? "" : "";
  const selectedSlug = pathCollection || queryCollection || trackedCollections[0]?.slug || "tempo-milady";

  useEffect(() => {
    saveSelectedCollectionSlug(selectedSlug);
  }, [selectedSlug]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = navSearch.trim();
    if (!q) {
      router.push("/search");
      return;
    }
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  function handleDisconnect() {
    if (isWagmiConnected) {
      disconnectWagmi();
      return;
    }
    if (thirdwebWallet) {
      disconnectThirdweb(thirdwebWallet);
    }
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-milady-pink/10 bg-milady-charcoal/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          <Link
            href="/"
            className="font-milady text-lg text-milady-pink hover:text-milady-pink-light transition-colors"
          >
            ✦ Milady Market
          </Link>

          <div className="hidden md:flex items-center gap-4 flex-1 justify-center">
            <form className="w-56" onSubmit={submitSearch}>
              <input
                className="input h-9 text-sm"
                type="search"
                value={navSearch}
                onChange={(event) => setNavSearch(event.target.value)}
                placeholder="Search token, wallet, tx"
              />
            </form>
            <Link href="/" className="btn-ghost text-sm">Collections</Link>
            <Link href="/explore" className="btn-ghost text-sm">Explore</Link>
            <Link href="/launchpad" className="btn-ghost text-sm">Launchpad</Link>
            {isConnected && profileHref && <Link href={profileHref} className="btn-ghost text-sm">My NFTs</Link>}
          </div>

          <div className="hidden md:block relative">
            {isConnected && profileHref ? (
              <div className="flex items-center gap-3">
                <Link
                  href={profileHref}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-milady-pink/30 hover:border-milady-pink/60 text-sm text-milady-pink transition-all"
                >
                  <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                  {connectedAddress ? shortAddress(connectedAddress) : "Connected"}
                </Link>
                <button type="button" onClick={handleDisconnect} className="btn-ghost text-sm">
                  Disconnect
                </button>
              </div>
            ) : (
              <>
                <ConnectButton
                  client={thirdwebClient}
                  chain={thirdwebTempoChain}
                  wallets={thirdwebWallets}
                  connectButton={{
                    className: "btn-primary text-sm",
                    label: "Connect",
                  }}
                  connectModal={{
                    title: "Sign in",
                    size: "compact",
                    showThirdwebBranding: true,
                  }}
                  theme={darkTheme()}
                />
              </>
            )}
          </div>

          <div className="md:hidden flex items-center gap-2">
            <button
              type="button"
              className="btn-ghost text-xs px-3 py-1.5"
              onClick={() => setMobileMenuOpen((value) => !value)}
              aria-expanded={mobileMenuOpen}
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? "Close" : "Menu"}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden py-3 border-t border-milady-pink/10 space-y-3">
            <form className="w-full" onSubmit={submitSearch}>
              <input
                className="input h-10 text-sm"
                type="search"
                value={navSearch}
                onChange={(event) => setNavSearch(event.target.value)}
                placeholder="Search token, wallet, tx"
              />
            </form>

            <div className="grid grid-cols-2 gap-2">
              <Link href="/" className="btn-ghost text-sm text-center">Collections</Link>
              <Link href="/explore" className="btn-ghost text-sm text-center">Explore</Link>
              <Link href="/launchpad" className="btn-ghost text-sm text-center col-span-2">Launchpad</Link>
              {isConnected && profileHref && <Link href={profileHref} className="btn-ghost text-sm text-center col-span-2">My NFTs</Link>}
            </div>

            <div className="card p-3">
              {isConnected && profileHref ? (
                <div className="flex items-center justify-between gap-3">
                  <Link href={profileHref} className="inline-flex items-center gap-2 text-sm text-milady-pink">
                    <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                    {connectedAddress ? shortAddress(connectedAddress) : "Connected"}
                  </Link>
                  <button type="button" onClick={handleDisconnect} className="btn-ghost text-sm">
                    Disconnect
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <ConnectButton
                    client={thirdwebClient}
                    chain={thirdwebTempoChain}
                    wallets={thirdwebWallets}
                    connectButton={{
                      className: "btn-primary text-sm w-full",
                      label: "Connect",
                    }}
                    connectModal={{
                      title: "Sign in",
                      size: "compact",
                      showThirdwebBranding: true,
                    }}
                    theme={darkTheme()}
                  />
                  <p className="text-[11px] text-milady-cream/60">
                    Passkey, phone, email, social login, and external wallets are available in the connect modal (Powered by thirdweb).
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
