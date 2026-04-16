"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUnifiedWallet } from "@/hooks/useUnifiedWallet";

function navClass(active: boolean) {
  return active
    ? "text-milady-pink border-milady-pink/40 bg-milady-pink/10"
    : "text-milady-cream/70 border-transparent";
}

export function MobileBottomNav() {
  const pathname = usePathname();
  const { address, isConnected } = useUnifiedWallet();
  const profileHref = address ? `/profile/${address}` : null;

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-milady-pink/20 bg-milady-charcoal/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-4 gap-1 p-2">
        <Link href="/" className={`text-xs text-center py-2 rounded-lg border ${navClass(pathname === "/")}`}>
          Home
        </Link>
        <Link href="/explore" className={`text-xs text-center py-2 rounded-lg border ${navClass(pathname.startsWith("/explore"))}`}>
          Explore
        </Link>
        <Link href="/search" className={`text-xs text-center py-2 rounded-lg border ${navClass(pathname.startsWith("/search"))}`}>
          Search
        </Link>
        {isConnected && profileHref ? (
          <Link
            href={profileHref}
            className={`text-xs text-center py-2 rounded-lg border ${navClass(pathname.startsWith("/profile"))}`}
          >
            Profile
          </Link>
        ) : (
          <Link href="/launchpad" className={`text-xs text-center py-2 rounded-lg border ${navClass(pathname.startsWith("/launchpad"))}`}>
            Launchpad
          </Link>
        )}
      </div>
    </div>
  );
}
