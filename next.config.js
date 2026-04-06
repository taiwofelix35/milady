/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      'ipfs.io',
      'cloudflare-ipfs.com',
      'gateway.pinata.cloud',
      'arweave.net',
      'i.seadn.io',
      'openseauserdata.com',
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.ipfs.io',
      },
      {
        protocol: 'https',
        hostname: '**.nftstorage.link',
      },
    ],
  },
}

module.exports = nextConfig
