import type {Metadata} from 'next';
import Script from 'next/script';
import localFont from 'next/font/local';
import './globals.css'; // Global styles
import './visual-mode-essential.css'; // Escopo exclusivo do modo Essencial
import { VisualModeProvider } from '../components/visual-mode/VisualModeProvider';
import { VisualModeSafetyBoundary } from '../components/visual-mode/VisualModeSafetyBoundary';

const inter = localFont({
  src: './fonts/inter.woff2',
  variable: '--font-sans',
  weight: '100 900',
  display: 'swap',
});

const jetbrainsMono = localFont({
  src: './fonts/jetbrainsmono.woff2',
  variable: '--font-mono',
  weight: '100 800',
  display: 'swap',
  adjustFontFallback: false,
  fallback: ['monospace'],
});

const montserrat = localFont({
  src: './fonts/montserrat.woff2',
  variable: '--font-montserrat',
  weight: '600 900',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'EMPROVEX - Gestão Logística e Financeira',
  description: 'Plataforma integrada de Gestão de Empenhos, Provimento Logístico e Execução Financeira.',
  applicationName: 'EMPROVEX',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/api/install-icon/48?v=20261102-r4', sizes: '48x48', type: 'image/png' },
      { url: '/api/install-icon/32?v=20261102-r4', sizes: '32x32', type: 'image/png' },
    ],
    shortcut: [{ url: '/api/install-icon/48?v=20261102-r4', sizes: '48x48', type: 'image/png' }],
    apple: [{ url: '/api/install-icon/180?v=20261102-r4', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    title: 'EMPROVEX',
    statusBarStyle: 'default',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${jetbrainsMono.variable} ${montserrat.variable}`}>
      <body suppressHydrationWarning className="bg-[#f8f9ff] text-[#0b1c30] antialiased min-h-screen font-sans">
        <Script
          id="google-identity-services"
          src="https://accounts.google.com/gsi/client"
          strategy="afterInteractive"
        />
        <VisualModeProvider><VisualModeSafetyBoundary>{children}</VisualModeSafetyBoundary></VisualModeProvider>
      </body>
    </html>
  );
}
