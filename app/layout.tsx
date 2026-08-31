import type {Metadata} from 'next';
import { Inter, JetBrains_Mono, Montserrat } from 'next/font/google';
import './globals.css'; // Global styles

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['600', '700', '800', '900'],
  variable: '--font-montserrat',
});

export const metadata: Metadata = {
  title: 'EMPROVIUM - Gestão Logística e Financeira',
  description: 'Plataforma integrada de Gestão de Empenhos, Provimento Logístico e Execução Financeira.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${jetbrainsMono.variable} ${montserrat.variable}`}>
      <body suppressHydrationWarning className="bg-[#f8f9ff] text-[#0b1c30] antialiased min-h-screen font-sans">
        {children}
      </body>
    </html>
  );
}
