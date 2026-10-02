import {
  Boxes,
  ClipboardPlus,
  LayoutDashboard,
  ScanLine,
  Warehouse,
} from 'lucide-react';

import { WarehouseMobileScanner } from './WarehouseMobileScanner';

const FUTURE_CAPABILITIES = [
  {
    label: 'Alocar recebimento',
    description: 'NF → item → produto → posição.',
    Icon: ClipboardPlus,
  },
  {
    label: 'Transferir material',
    description: 'Origem → produto → destino.',
    Icon: Warehouse,
  },
  {
    label: 'Consultar localização',
    description: 'Leia a posição e veja o conteúdo físico.',
    Icon: LayoutDashboard,
  },
  {
    label: 'Inventário',
    description: 'Contagem orientada por posição e material.',
    Icon: Boxes,
  },
  {
    label: 'Saída de material',
    description: 'Separação e retirada com posição e lote.',
    Icon: ScanLine,
  },
  {
    label: 'Conferir posição',
    description: 'Compare o físico com o registro oficial.',
    Icon: Warehouse,
  },
] as const;

export function WarehouseMobileHome() {
  return (
    <div className="space-y-5">
      <section className="rounded-3xl bg-[linear-gradient(135deg,#03102a_0%,#00288e_100%)] px-5 py-6 text-white shadow-[0_24px_70px_-38px_rgba(0,40,142,0.65)]">
        <p className="font-mono text-[9px] font-black uppercase tracking-[0.22em] text-blue-200">
          Operação no ponto físico
        </p>
        <h1 className="mt-2 text-2xl font-black tracking-tight">
          Central Móvel
        </h1>
        <p className="mt-2 text-sm font-semibold leading-6 text-blue-100/90">
          Fundação móvel da Central de Depósitos com câmera e scanner carregados somente quando necessários.
        </p>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-4 px-1">
          <div>
            <p className="font-mono text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">
              Jornada R1
            </p>
            <h2 className="mt-1 text-lg font-black text-slate-950">
              Operações planejadas
            </h2>
          </div>
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black text-amber-800">
            Onda 1
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {FUTURE_CAPABILITIES.map(({ label, description, Icon }) => (
            <div
              key={label}
              className="min-h-36 rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_18px_45px_-36px_rgba(15,23,42,0.45)]"
            >
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-50 text-[#00288e]">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-3 text-sm font-black leading-5 text-slate-900">
                {label}
              </h3>
              <p className="mt-1 text-[11px] font-semibold leading-4 text-slate-500">
                {description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <WarehouseMobileScanner
        expectation="EXPECT_PRODUCT"
        title="Scanner de fundação"
      />

      <p className="px-2 text-center text-[11px] font-semibold leading-5 text-slate-500">
        Nesta frente o scanner apenas captura e valida o tipo esperado. Resolver posição, alocar, transferir, inventariar e retirar materiais pertencem às próximas frentes.
      </p>
    </div>
  );
}
