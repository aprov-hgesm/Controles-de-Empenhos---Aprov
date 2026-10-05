import {
  Boxes,
  ClipboardPlus,
  MapPin,
  PackageSearch,
  ScanLine,
  Warehouse,
} from 'lucide-react';
import Link from 'next/link';

const MOBILE_CAPABILITIES = [
  {
    label: 'Alocar recebimento',
    description: 'NF → item → produto → posição.',
    Icon: ClipboardPlus,
    href: '/central-mobile/alocar',
  },
  {
    label: 'Transferir material',
    description: 'Origem → produto → destino.',
    Icon: Warehouse,
    href: '/central-mobile/transferir',
  },
  {
    label: 'Consultar localização',
    description: 'Leia um local e veja o que existe nele.',
    Icon: MapPin,
    href: '/central-mobile/consultar-localizacao',
  },
  {
    label: 'Consultar item',
    description: 'Leia o item e veja locais e quantidades.',
    Icon: PackageSearch,
    href: '/central-mobile/consultar-item',
  },
  {
    label: 'Inventário',
    description: 'Contagem orientada por posição e material.',
    Icon: Boxes,
    href: '/central-mobile/inventario',
  },
  {
    label: 'Saída de material',
    description: 'Separação e retirada com posição e lote.',
    Icon: ScanLine,
    href: '/central-mobile/saida',
  },
  {
    label: 'Conferir posição',
    description: 'Compare o físico com o registro oficial.',
    Icon: Warehouse,
    href: '/central-mobile/conferir',
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
              Operações
            </h2>
          </div>
          <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-black text-blue-800">
            Onda 3
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {MOBILE_CAPABILITIES.map(({ label, description, Icon, href }) => {
            const card = (
              <>
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-50 text-[#00288e]">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-3 text-sm font-black leading-5 text-slate-900">
                  {label}
                </h3>
                <p className="mt-1 text-[11px] font-semibold leading-4 text-slate-500">
                  {description}
                </p>
                <span className={href
                  ? 'mt-3 inline-flex rounded-full bg-emerald-100 px-2 py-1 text-[9px] font-black text-emerald-800'
                  : 'mt-3 inline-flex rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black text-slate-500'
                }>
                  {href ? 'Disponível' : 'Próxima frente'}
                </span>
              </>
            );

            return href ? (
              <Link
                key={label}
                href={href}
                className="min-h-36 rounded-3xl border border-blue-200 bg-white p-4 shadow-[0_18px_45px_-36px_rgba(15,23,42,0.45)]"
              >
                {card}
              </Link>
            ) : (
              <div
                key={label}
                className="min-h-36 rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_18px_45px_-36px_rgba(15,23,42,0.45)]"
              >
                {card}
              </div>
            );
          })}
        </div>
      </section>

      <p className="px-2 text-center text-[11px] font-semibold leading-5 text-slate-500">
        Cada operação tem uma única responsabilidade. Consultas e conferência são somente leitura; alocação, transferência, inventário e saída só movimentam dados em suas confirmações próprias.
      </p>
    </div>
  );
}
