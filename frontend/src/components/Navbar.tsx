"use client";

import Link from "next/link";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { shortAddress } from "@/lib/utils";
import { useState } from "react";

export function Navbar() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [showConnectors, setShowConnectors] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-milady-pink/10 bg-milady-charcoal/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link
            href="/"
            className="font-milady text-lg text-milady-pink hover:text-milady-pink-light transition-colors"
          >
            ✦ Milady Market
          </Link>

          {/* Nav links */}
          <div className="hidden md:flex items-center gap-6">
            <Link href="/" className="btn-ghost text-sm">
              Gallery
            </Link>
            {isConnected && (
              <Link href={`/profile/${address}`} className="btn-ghost text-sm">
                My NFTs
              </Link>
            )}
          </div>

          {/* Wallet */}
          <div className="relative">
            {isConnected ? (
              <div className="flex items-center gap-3">
                <Link
                  href={`/profile/${address}`}
                  className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg
                             border border-milady-pink/30 hover:border-milady-pink/60
                             text-sm text-milady-pink transition-all"
                >
                  <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                  {shortAddress(address!)}
                </Link>
                <button onClick={() => disconnect()} className="btn-ghost text-sm">
                  Disconnect
                </button>
              </div>
            ) : (
              <div className="relative">
                <button
                  className="btn-primary text-sm"
                  onClick={() => setShowConnectors((v) => !v)}
                  disabled={isPending}
                >
                  {isPending ? "Connecting…" : "Connect Wallet"}
                </button>
                {showConnectors && (
                  <div
                    className="absolute right-0 mt-2 w-52 card p-2 z-50"
                    onMouseLeave={() => setShowConnectors(false)}
                  >
                    {connectors.map((connector) => (
                      <button
                        key={connector.uid}
                        onClick={() => {
                          connect({ connector });
                          setShowConnectors(false);
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg text-sm
                                   hover:bg-milady-pink/10 text-milady-cream/80
                                   hover:text-milady-cream transition-colors"
                      >
                        {connector.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
