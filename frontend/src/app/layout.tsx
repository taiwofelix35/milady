import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { Providers } from "./providers";
import { Navbar } from "@/components/Navbar";
import { MobileBottomNav } from "@/components/MobileBottomNav";

export const metadata: Metadata = {
  title: "Milady Marketplace – NFTs on Tempo",
  description: "Buy, sell, and make offers on Milady NFTs on the Tempo blockchain.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  openGraph: {
    title: "Milady Marketplace",
    description: "The premier NFT marketplace for Milady on Tempo network.",
    images: ["/og-banner.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700;900&family=Raleway:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-milady-charcoal text-milady-cream font-body">
        <Providers>
          <Suspense fallback={null}>
            <Navbar />
          </Suspense>
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
            {children}
          </main>
          <Suspense fallback={null}>
            <MobileBottomNav />
          </Suspense>
          <footer className="border-t border-milady-pink/10 mt-16 py-8 text-center text-milady-cream/40 text-sm">
            <p className="font-milady text-milady-pink/60 mb-1">✦ Milady Marketplace ✦</p>
            <p>Built on Tempo Network · Powered by love & pink</p>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
