import type { LucideIcon } from 'lucide-react';
import {
  ArrowUpRight,
  Boxes,
  ClipboardPlus,
  MapPin,
  PackagePlus,
  PackageSearch,
  ScanLine,
  ShieldCheck,
  Warehouse,
  ArrowLeftRight,
} from 'lucide-react';
import Link from 'next/link';

interface OperatorAction {
  label: string;
  description: string;
  href: string;
  number: string;
  Icon: LucideIcon;
}

const MOVEMENT_ACTIONS: readonly OperatorAction[] = [
  {
    number: '01',
    label: 'Alocar recebimento',
    description: 'Da nota fiscal até a posição física.',
    href: '/operador-movel/alocar',
    Icon: ClipboardPlus,
  },
  {
    number: '02',
    label: 'Cadastrar avulso',
    description: 'Material, quantidade, validade e localização.',
    href: '/operador-movel/avulso',
    Icon: PackagePlus,
  },
  {
    number: '03',
    label: 'Transferir material',
    description: 'Mova itens entre posições do depósito.',
    href: '/operador-movel/transferir',
    Icon: ArrowLeftRight,
  },
  {
    number: '04',
    label: 'Saída de material',
    description: 'Separe e registre a retirada com rastreio.',
    href: '/operador-movel/saida',
    Icon: ScanLine,
  },
];

const CONTROL_ACTIONS: readonly OperatorAction[] = [
  {
    number: '05',
    label: 'Consultar localização',
    description: 'Leia uma posição e consulte seu conteúdo.',
    href: '/operador-movel/consultar-localizacao',
    Icon: MapPin,
  },
  {
    number: '06',
    label: 'Consultar item',
    description: 'Encontre posições, quantidades e lotes.',
    href: '/operador-movel/consultar-item',
    Icon: PackageSearch,
  },
  {
    number: '07',
    label: 'Inventário',
    description: 'Conte os itens por posição e material.',
    href: '/operador-movel/inventario',
    Icon: Boxes,
  },
  {
    number: '08',
    label: 'Conferir posição',
    description: 'Compare o estoque físico e o registro.',
    href: '/operador-movel/conferir',
    Icon: Warehouse,
  },
];

function OperatorActionCard({ action }: { action: OperatorAction }) {
  const Icon = action.Icon;

  return (
    <Link
      href={action.href}
      aria-label={'Abrir operação: ' + action.label}
      data-testid={'operator-mobile-action-' + action.number}
      className="group relative flex min-h-[172px] flex-col rounded-[22px] border border-slate-200/95 bg-white px-3.5 pb-3.5 pt-3.5 text-left shadow-[0_12px_30px_-25px_rgba(7,29,70,0.5)] transition-[transform,box-shadow,border-color] duration-200 active:scale-[0.985] hover:border-blue-200 hover:shadow-[0_18px_35px_-24px_rgba(7,29,70,0.35)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00288e] motion-reduce:transform-none motion-reduce:transition-none sm:min-h-[176px] sm:p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] border border-[#dce8f8] bg-[#f1f6fd] text-[#00288e]">
          <Icon className="h-[19px] w-[19px]" strokeWidth={1.9} aria-hidden="true" />
        </span>
        <span className="font-mono text-[10px] font-semibold tracking-[0.12em] text-slate-400" aria-hidden="true">
          {action.number}
        </span>
      </div>

      <h3 className="mt-3 text-[13px] font-bold leading-[1.3] tracking-[-0.015em] text-[#14233b] sm:text-sm">
        {action.label}
      </h3>
      <p className="mt-1.5 flex-1 text-[11px] font-medium leading-[1.5] text-slate-600 sm:text-xs">
        {action.description}
      </p>

      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[10px] font-bold text-[#00288e]">
        <span>Abrir operação</span>
        <ArrowUpRight
          className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transform-none"
          aria-hidden="true"
        />
      </div>
    </Link>
  );
}

function OperatorActionGroup({
  id,
  index,
  title,
  subtitle,
  actions,
}: {
  id: string;
  index: string;
  title: string;
  subtitle: string;
  actions: readonly OperatorAction[];
}) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <div className="flex items-start gap-3 px-0.5">
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-[#dae4f2] bg-white font-mono text-[11px] font-bold text-[#00288e]">
          {index}
        </span>
        <div className="min-w-0">
          <h2 id={id} className="text-[16px] font-extrabold tracking-[-0.025em] text-[#112541]">
            {title}
          </h2>
          <p className="mt-0.5 text-xs leading-[1.45] text-slate-600">{subtitle}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
        {actions.map((action) => (
          <OperatorActionCard key={action.href} action={action} />
        ))}
      </div>
    </section>
  );
}

export function WarehouseMobileHome() {
  return (
    <div className="space-y-6" data-testid="operator-mobile-premium-home">
      <section
        aria-labelledby="operator-mobile-intro"
        className="relative isolate overflow-hidden rounded-[24px] border border-[#102b5a] bg-[linear-gradient(120deg,#071a3a_0%,#092753_58%,#063477_100%)] px-5 py-5 text-white shadow-[0_18px_45px_-30px_rgba(0,33,91,0.7)]"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage: 'linear-gradient(rgba(173,202,240,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(173,202,240,0.08) 1px, transparent 1px)',
            backgroundSize: '26px 26px',
            maskImage: 'linear-gradient(90deg, transparent 15%, black 100%)',
          }}
        />
        <div className="relative z-10">
          <p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-blue-200">
            Central de Depósitos / Operador Móvel
          </p>
          <h1 id="operator-mobile-intro" className="mt-2.5 max-w-[280px] text-[22px] font-extrabold leading-[1.16] tracking-[-0.035em]">
            Operações no ponto físico
          </h1>
          <p className="mt-2 max-w-[310px] text-xs font-medium leading-[1.6] text-blue-100">
            Cadastre, movimente e confira materiais no local de armazenamento.
          </p>
          <div className="mt-4 flex flex-wrap gap-1.5" aria-label="Recursos disponíveis">
            <span className="rounded-md border border-blue-200/20 bg-white/[0.08] px-2.5 py-1.5 text-[10px] font-semibold text-blue-50">
              Leitura por etiqueta
            </span>
            <span className="rounded-md border border-blue-200/20 bg-white/[0.08] px-2.5 py-1.5 text-[10px] font-semibold text-blue-50">
              Posição física
            </span>
          </div>
        </div>
      </section>

      <section
        aria-label="Status da experiência operacional"
        className="flex items-center justify-between gap-3 rounded-2xl border border-[#dce6f2] bg-white px-3.5 py-3 shadow-[0_8px_25px_-23px_rgba(7,29,70,0.3)]"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
            <ShieldCheck className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden="true" />
          </span>
          <div>
            <p className="text-[11px] font-bold text-[#14233b]">Acesso autorizado</p>
            <p className="mt-0.5 text-[10px] text-slate-600">Ambiente operacional protegido</p>
          </div>
        </div>
        <span className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-slate-600">
          Leitor sob demanda
        </span>
      </section>

      <OperatorActionGroup
        id="operator-mobile-movements"
        index="01"
        title="Movimentações"
        subtitle="Entradas, transferências e retiradas de materiais."
        actions={MOVEMENT_ACTIONS}
      />

      <OperatorActionGroup
        id="operator-mobile-control"
        index="02"
        title="Consulta e conferência"
        subtitle="Localizações, saldos, contagens e conferência física."
        actions={CONTROL_ACTIONS}
      />

      <p className="px-3 pb-2 text-center text-[11px] font-medium leading-[1.6] text-slate-600">
        As consultas não alteram o estoque. Entradas, saídas, transferências e contagens seguem confirmações próprias.
      </p>
    </div>
  );
}
