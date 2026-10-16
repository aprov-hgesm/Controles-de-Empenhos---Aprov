import { resolve } from 'node:path';
import baseline from './firebase-applet-config.json';
import { assertCloudRunBuildReady } from './lib/cloudRunIsolation.mjs';

// Opt-in Cloud Run build gate only. Vercel production remains unchanged.
// Explicit target alone is insufficient: static production imports must be removed.
if (process.env.K_SERVICE || process.env.EMPROVEX_RUNTIME_TARGET) {
  assertCloudRunBuildReady(baseline, process.env, process.cwd());
}

import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  // Build-time marker injected consistently into server and browser bundles.
  // In Cloud Run staging the server-side build gate still independently checks
  // project, app, banks and key absence. Never derive staging from VERCEL_ENV.
  env: {
    NEXT_PUBLIC_EMPROVEX_DEPLOYMENT_ENVIRONMENT:
      process.env.EMPROVEX_RUNTIME_TARGET === 'cloud-run-staging'
        ? 'cloud-run-staging'
        : 'legacy',
  },
  reactStrictMode: true,
  poweredByHeader: false,
  // Links históricos continuam abrindo o endereço canônico da Central de Depósitos.
  async redirects() {
    return [
      { source: '/adm-deposito', destination: '/central-depositos', permanent: true },
      { source: '/adm-deposito/:path*', destination: '/central-depositos/:path*', permanent: true },
      { source: '/central-mobile', destination: '/operador-movel', permanent: true },
      { source: '/central-mobile/:path*', destination: '/operador-movel/:path*', permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(), geolocation=()',
          },
          { key: 'X-DNS-Prefetch-Control', value: 'off' },
          { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
        ],
      },
    ];
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**', // This allows any path under the hostname
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  output: 'standalone',
  transpilePackages: ['motion'],
  webpack: (config, {dev, webpack}) => {
    // ONLY a cloud-run-staging build swaps legacy Firebase baseline imports in
    // compiled server/browser bundles for a structurally compatible redacted
    // stub. next.config.ts reads the true production baseline BEFORE webpack to
    // enforce the W4 comparison gate. Existing Vercel builds remain unchanged.
    if (process.env.EMPROVEX_RUNTIME_TARGET === 'cloud-run-staging') {
      config.plugins = config.plugins || [];
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /firebase-applet-config[.]json$/,
          (resource: {request: string}) => {
            resource.request = resolve(process.cwd(), 'lib/firebaseCloudRunRedactedBaseline.json');
          }
        )
      );
    }
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = {
        ignored: /.*/,
      };
    }
    return config;
  },
};

export default nextConfig;
