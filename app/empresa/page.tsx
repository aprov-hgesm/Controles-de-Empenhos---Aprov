import { ArrowUpRight, Building2, PackageCheck, Truck } from 'lucide-react';

export default function CompanyHomePage() {
  return (
    <main>
      <div className="rounded-3xl bg-gradient-to-br from-[#0b2348] via-[#133c79] to-[#1453a0] px-6 py-9 text-white shadow-lg sm:px-10">
        <p className="text-xs font-bold uppercase tracking-[.24em] text-blue-200">EMPROVEX Empresas · R0</p>
        <h1 className="mt-4 max-w-2xl font-montserrat text-3xl font-extrabold leading-tight sm:text-4xl">
          Sua operação empresarial começa aqui.
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-7 text-blue-100">
          Um ambiente próprio para acompanhar empenhos, clientes, fornecedores, compras, logística e financeiro.
          Os módulos operacionais serão ativados nas próximas etapas.
        </p>
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {[
          { href: '/empresa/empenhos', name: 'Empenhos', detail: 'Compromissos dos clientes', Icon: Building2 },
          { href: '/empresa/fornecedores', name: 'Fornecedores', detail: 'Sua cadeia de abastecimento', Icon: PackageCheck },
          { href: '/empresa/logistica', name: 'Logística', detail: 'Preparação e entregas', Icon: Truck },
        ].map(({ href, name, detail, Icon }) => (
          <a href={href} key={href}
            className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-blue-300 hover:shadow-md">
            <div className="flex items-start justify-between">
              <span className="rounded-xl bg-blue-50 p-3 text-blue-700"><Icon size={22} /></span>
              <ArrowUpRight size={18} className="text-slate-400 transition group-hover:text-blue-600" />
            </div>
            <h2 className="mt-5 text-lg font-bold">{name}</h2>
            <p className="mt-1 text-sm text-slate-500">{detail}</p>
            <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-blue-700">Em preparação</p>
          </a>
        ))}
      </div>
      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <h2 className="text-lg font-bold">Próximos passos da plataforma</h2>
        <p className="mt-2 text-sm leading-7 text-slate-500">
          O portal está preparado para receber funcionalidades empresariais independentes, sem usar
          o ambiente militar de Aprovisionamento. Os dados aparecerão somente quando forem
          implementados e autorizados em cada módulo.
        </p>
      </section>
    </main>
  );
}
