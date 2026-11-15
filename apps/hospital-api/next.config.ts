import type {NextConfig} from 'next';
const config:NextConfig={output:'standalone',poweredByHeader:false,
  typescript:{ignoreBuildErrors:false},
  reactStrictMode:true
};
export default config;
