import type {Metadata} from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css'; // Global styles

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'Controle de Empenhos - Aprov',
  description: 'Sistema institucional para controle de empenhos, conciliação de notas fiscais e relatórios logísticos hospitalares.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body suppressHydrationWarning className="bg-[#f8f9ff] text-[#0b1c30] antialiased min-h-screen font-sans">
        {children}
      </body>
    </html>
  );
}
