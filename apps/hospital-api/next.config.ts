import type {NextConfig} from 'next';
const config:NextConfig={
  // A API foi extraida para este diretorio: nao rastrear as dependencias do monorepo EMPROVEX.
  outputFileTracingRoot:process.cwd(),
  output:'standalone',poweredByHeader:false,
  typescript:{ignoreBuildErrors:false},
  reactStrictMode:true
};
export default config;
