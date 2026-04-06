import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-milady-gradient border-t border-milady-blush mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-milady-button flex items-center justify-center">
                <span className="text-white">🎀</span>
              </div>
              <span className="font-display text-lg font-bold bg-gradient-to-r from-milady-pink-dark to-milady-purple-dark bg-clip-text text-transparent">
                Milady Market
              </span>
            </div>
            <p className="text-sm text-gray-500 max-w-xs">
              The premier NFT marketplace on Tempo, featuring OpenSea-standard trading with a kawaii aesthetic. ♡
            </p>
          </div>

          {/* Links */}
          <div>
            <h3 className="font-semibold text-gray-700 mb-3">Marketplace</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/" className="text-sm text-gray-500 hover:text-milady-pink-dark transition-colors">
                  Explore NFTs
                </Link>
              </li>
              <li>
                <Link href="/collections" className="text-sm text-gray-500 hover:text-milady-pink-dark transition-colors">
                  Collections
                </Link>
              </li>
            </ul>
          </div>

          {/* Chain Info */}
          <div>
            <h3 className="font-semibold text-gray-700 mb-3">Built on Tempo</h3>
            <ul className="space-y-2">
              <li>
                <a
                  href="https://explorer.tempo.xyz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-gray-500 hover:text-milady-pink-dark transition-colors"
                >
                  Block Explorer ↗
                </a>
              </li>
              <li>
                <a
                  href="https://rpc.tempo.xyz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-gray-500 hover:text-milady-pink-dark transition-colors"
                >
                  RPC Endpoint ↗
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-milady-blush flex flex-col sm:flex-row justify-between items-center gap-3">
          <p className="text-xs text-gray-400">
            © {new Date().getFullYear()} Milady Market. Built with ♡ on Tempo.
          </p>
          <p className="text-xs text-gray-400">
            Powered by{' '}
            <a
              href="https://docs.opensea.io/reference/seaport-overview"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-milady-pink-dark transition-colors"
            >
              OpenSea Seaport
            </a>{' '}
            protocol
          </p>
        </div>
      </div>
    </footer>
  )
}
