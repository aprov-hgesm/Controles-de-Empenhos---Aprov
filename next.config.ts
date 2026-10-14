import type {NextConfig} from 'next';
import firebaseBaseline from './firebase-applet-config.json';
import { assertPreviewServiceAccount, resolveFirebaseEnvironment } from './lib/firebaseEnvironment.mjs';

const deploymentEnvironment = process.env.VERCEL_ENV || 'local';
// Stop Preview builds before any route/client can inherit production targets.
const firebaseTarget = resolveFirebaseEnvironment(firebaseBaseline, {
  environment: deploymentEnvironment,
  publicConfigJson: process.env.NEXT_PUBLIC_EMPROVEX_FIREBASE_CONFIG_JSON,
  legacyWarehouseDatabaseId: process.env.NEXT_PUBLIC_EMPROVEX_WAREHOUSE_FIRESTORE_DATABASE_ID,
});

if (deploymentEnvironment === 'preview') {
  assertPreviewServiceAccount(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON, firebaseTarget.projectId);
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: { NEXT_PUBLIC_EMPROVEX_DEPLOYMENT_ENVIRONMENT: deploymentEnvironment },
  poweredByHeader: false,
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
  webpack: (config, {dev}) => {
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
