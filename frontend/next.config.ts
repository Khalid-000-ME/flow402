import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Mark 0G SDKs + ethers as server-only to prevent webpack from bundling
  // their CJS internals into the client bundle (they're Node.js only).
  serverExternalPackages: [
    '@0gfoundation/0g-compute-ts-sdk',
    '@0gfoundation/0g-storage-ts-sdk',
    'ethers',
    'openai',
  ],
  turbopack: {},
}

export default nextConfig
