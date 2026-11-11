import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, ClipboardList, PackageCheck, ChefHat, Building2, Info } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Portal de acessos | EMPROVEX',
  description: 'Entre no módulo de gestão correspondente à sua atividade no EMPROVEX.',
  robots: { index: true, follow: true },
};

const modules = [
  {
    name: 'Aprovisionamento',
    description: 'Empenhos, notas fiscais, cronogramas e acompanhamento financeiro.',
    href: '/aprovisionamento',
    icon: ClipboardList,
    detail: 'Gestão logística e financeira',
  },
  {
    name: 'Almoxarifado',
    description: 'Depósitos, materiais, movimentações e rastreabilidade do estoque.',
    href: '/almoxarifado',
    icon: PackageCheck,
    detail: 'Operações de estoque',
  },
  {
    name: 'Cozinha Dietética',
    description: 'Entrada hospitalar com acesso individual e restrito por unidade.',
    href: '/cozinha-dietetica',
    icon: ChefHat,
    detail: 'Ambiente hospitalar',
  },
  {
    name: 'Fornecedores',
    description: 'Informações sobre a futura entrada especializada de fornecedores.',
    href: '/fornecedores',
    icon: Building2,
    detail: 'Acesso empresarial',
  },
] as const;

export default function PortalPage() {
  return (
    <main className="min-h-screen bg-[#061324] px-5 py-10 text-white sm:px-8 lg:py-20">
      <div className="mx-auto max-w-6xl">
        <header className="mb-12 flex flex-wrap items-center justify-between gap-5">
          <Link href="/" aria-label="EMPROVEX: portal de acessos" className="text-xl font-extrabold tracking-[0.12em] text-blue-100">
            EMPROVEX
          </Link>
          <Link href="/info" className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-blue-100 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-300">
            <Info size={16} aria-hidden="true" /> Conheça a plataforma
          </Link>
        </header>
        <section aria-labelledby="portal-title" className="mb-10 max-w-3xl">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-sky-300">Um acesso para cada atividade</p>
          <h1 id="portal-title" className="text-4xl font-extrabold tracking-tight sm:text-5xl">Como deseja acessar o EMPROVEX?</h1>
          <p className="mt-5 text-base leading-7 text-slate-300">Selecione sua área. Cada módulo mantém suas próprias regras de identidade, autorização e acesso aos dados.</p>
        </section>
        <nav aria-label="Módulos EMPROVEX" className="grid gap-5 sm:grid-cols-2">
          {modules.map(({ name, description, href, icon: Icon, detail }) => (
            <Link key={href} href={href} className="group flex min-h-56 flex-col rounded-3xl border border-white/10 bg-white/[0.055] p-6 shadow-xl transition hover:border-sky-300/60 hover:bg-white/[0.09] focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300 sm:p-8">
              <span className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-400/15 text-sky-200">
                <Icon size={25} aria-hidden="true" />
              </span>
              <span className="text-xs font-bold uppercase tracking-[0.15em] text-sky-300">{detail}</span>
              <span className="mt-2 text-2xl font-bold">{name}</span>
              <span className="mt-3 flex-1 text-sm leading-6 text-slate-300">{description}</span>
              <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-sky-200">
                Acessar <ArrowRight size={16} aria-hidden="true" className="transition group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </nav>
        <footer className="mt-10 text-sm text-slate-400">Os módulos protegidos exigem credenciais válidas e autorização para o setor correspondente.</footer>
      </div>
    </main>
  );
}
