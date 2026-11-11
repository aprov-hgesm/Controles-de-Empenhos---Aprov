import type { Metadata } from 'next';
import InstitutionalHome, { metadata as institutionalMetadata } from '../institucional/page';

export const metadata: Metadata = {
  ...institutionalMetadata,
  alternates: { canonical: '/info' },
};

export default function InfoPage() {
  return (
    <>
      <div className="relative z-50 bg-[#081a30] px-5 py-3 text-center text-sm text-white">
        <a href="/" className="rounded px-2 py-1 font-semibold underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-300">
          Voltar ao portal de acessos
        </a
      </div>
      <InstitutionalHome />
    </>
  );
}
