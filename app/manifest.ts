import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'EMPROVEX — Gestão Logística e Financeira',
    short_name: 'EMPROVEX',
    description: 'Plataforma integrada de gestão de empenhos, provimento logístico e execução financeira.',
    lang: 'pt-BR',
    start_url: '/central-empenhos',
    scope: '/',
    display: 'standalone',
    background_color: '#f8f9ff',
    theme_color: '#00288e',
    prefer_related_applications: false,
    icons: [
      {
        src: '/api/install-icon/192',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/api/install-icon/512',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/api/install-icon/512?maskable=1',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
