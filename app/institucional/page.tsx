import type { Metadata } from 'next';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Script from 'next/script';

export const metadata: Metadata = {
  title: 'EMPROVEX — Aprovisionamento com mais controle e menos estresse',
  description: 'Conheça o EMPROVEX: gestão de empenhos, cronogramas, notas fiscais e depósitos 3D. Solicite um mês de teste acompanhado.',
  openGraph: { title: 'EMPROVEX — Gestão de Aprovisionamento', description: 'Mais tranquilidade no trabalho e mais tempo para sua vida.', images: ['/emprovex-logo.png'] },
};

export default function InstitutionalHome() {
  // Conteúdo revisado e mantido em arquivo local versionado. Não há HTML de terceiros.
  const markup = readFileSync(join(process.cwd(), 'public/institucional/content.html'), 'utf8');
  return (
    <>
      <link rel="stylesheet" href="/institucional/site.css" />
      <div dangerouslySetInnerHTML={{ __html: markup }} />
      <Script src="/institucional/site.js" strategy="afterInteractive" />
    </>
  );
}
