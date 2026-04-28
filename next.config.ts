import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)

const nextConfig: NextConfig = {
  // Standalone output bundles only the runtime files needed to serve the app
  // into .next/standalone, which we copy into the production Docker image.
  // Drops image size from ~1GB (full node_modules) to ~150MB.
  output: 'standalone',
  // nodejieba is a native binding (.node file). Bundling it via webpack/turbopack
  // breaks the runtime require; treating it as an external lets Node load it directly.
  serverExternalPackages: ['nodejieba'],
  images: {
    localPatterns: [
      {
        pathname: '/api/media/file/**',
      },
    ],
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
  turbopack: {
    root: path.resolve(dirname),
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
