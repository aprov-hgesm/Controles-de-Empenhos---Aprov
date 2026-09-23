import { ArrowRight, Boxes, Database, FileJson2, Layers3, MapPinned, PackageCheck, ShieldCheck } from 'lucide-react';

import { WAREHOUSE_MATERIAL_SCHEMA_VERSION, WAREHOUSE_MATERIAL_UNIT_CODES } from '../../../lib/warehouse/material';
import { WAREHOUSE_BALANCE_SCHEMA_VERSION, WAREHOUSE_MOVEMENT_SCHEMA_VERSION, WAREHOUSE_MOVEMENT_TYPES } from '../../../lib/warehouse/movement';
import { WAREHOUSE_DOMAIN_COLLECTIONS, WAREHOUSE_NAMESPACE_ROOT } from '../../../lib/warehouse/namespace';
import type { WarehouseSectionId } from '../navigation';

function FutureNotice({ phase, children }: { phase: string; children: string }) {
  return (
    <div className="rounded-2xl border border-amber-300/10 bg-amber-400/[0.04] p-4" data-testid="warehouse-future-state">
      <p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-amber-300/70">Capacidade futura · {phase}</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">{children}</p>
    </div>
  );
}

function ContractCard({ title, code, description }: { title: string; code: string; description: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-black/10 p-4 sm:p-5">
      <p className="text-xs font-bold text-slate-300">{title}</p>
      <code className="mt-3 block w-fit rounded-lg bg-black/25 px-2 py-1 text-xs text-blue-200">{code}</code>
      <p className="mt-3 text-xs leading-5 text-slate-500">{description}</p>
    </div>
  );
}

function PlannedItems({ items }: { items: readonly string[] }) {
  return (
    <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <div key={item} className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-xs text-slate-400">
          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-600" aria-hidden="true" />
          <span>{item}</span>
        </div>
      ))}
    </div>
  );
}

function OverviewContent() {
  return (
    <div className="mt-6 space-y-5">
      <div className="grid gap-3 md:grid-cols-3">
        <ContractCard title="Material canônico" code={WAREHOUSE_MATERIAL_SCHEMA_VERSION} description="Identidade única de material e unidades da FASE 1. Nenhum modelo concorrente foi criado." />
        <ContractCard title="Ledger auditável" code={WAREHOUSE_MOVEMENT_SCHEMA_VERSION} description="Histórico append-only da FASE 2, preservado como fonte de movimentos." />
        <ContractCard title="Saldo materializado" code={WAREHOUSE_BALANCE_SCHEMA_VERSION} description="Projeção do ledger para leitura rápida. Não existe segundo saldo no Walking Skeleton." />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-emerald-300/10 bg-emerald-400/[0.035] p-5">
          <div className="flex items-center gap-2 text-emerald-200"><ShieldCheck className="h-4 w-4" aria-hidden="true" /><p className="text-xs font-black uppercase tracking-[0.12em]">Piloto fundador preservado</p></div>
          <p className="mt-3 text-sm leading-6 text-slate-400">O módulo continua protegido pela feature flag, pelo gate de identidade fundadora, pela API segura e pelo namespace logístico isolado.</p>
        </div>
        <div className="rounded-2xl border border-blue-300/10 bg-blue-400/[0.035] p-5">
          <div className="flex items-center gap-2 text-blue-200"><Database className="h-4 w-4" aria-hidden="true" /><p className="text-xs font-black uppercase tracking-[0.12em]">Namespace existente</p></div>
          <p className="mt-3 text-sm leading-6 text-slate-400"><code className="text-blue-200">{WAREHOUSE_NAMESPACE_ROOT}/&#123;workspaceId&#125;/...</code>{' '}continua sendo a única fronteira de persistência logística.</p>
          <p className="mt-2 text-xs leading-5 text-slate-600">Domínios reservados: {Object.values(WAREHOUSE_DOMAIN_COLLECTIONS).join(', ')}.</p>
        </div>
      </div>
      <FutureNotice phase="FASES 4–11">Os indicadores operacionais serão adicionados somente quando as respectivas fontes reais existirem. Esta Visão Geral não exibe números fictícios de estoque, entregas, inventário ou conciliação.</FutureNotice>
    </div>
  );
}

function StockContent() {
  return (
    <div className="mt-6">
      <div className="grid gap-3 md:grid-cols-2">
        <ContractCard title="Identidade do material" code={WAREHOUSE_MATERIAL_SCHEMA_VERSION} description={'Unidades canônicas já previstas: ' + WAREHOUSE_MATERIAL_UNIT_CODES.join(', ') + '.'} />
        <ContractCard title="Fonte de saldo" code={WAREHOUSE_BALANCE_SCHEMA_VERSION} description="Toda leitura futura de saldo deverá partir da projeção oficial do ledger." />
      </div>
      <PlannedItems items={['Pesquisa por descrição e código','Saldo e empenhos associados','Lotes e validade','Depósito e localização','Fornecedor e Nota Fiscal','Ação “Localizar no depósito”']} />
      <div className="mt-5"><FutureNotice phase="FASE 7">Esta capacidade será disponibilizada em uma fase posterior. Nenhuma consulta automática ou listener é disparado apenas por abrir esta superfície.</FutureNotice></div>
    </div>
  );
}

function MovementsContent() {
  return (
    <div className="mt-6">
      <div className="rounded-2xl border border-white/[0.07] bg-black/10 p-5">
        <div className="flex items-center gap-2"><Layers3 className="h-4 w-4 text-blue-200" aria-hidden="true" /><p className="text-xs font-bold text-slate-300">Tipos já reconhecidos pelo ledger oficial</p></div>
        <div className="mt-4 flex flex-wrap gap-2">{WAREHOUSE_MOVEMENT_TYPES.map((movementType) => <code key={movementType} className="rounded-lg border border-white/[0.06] bg-white/[0.025] px-2 py-1 text-[11px] text-slate-400">{movementType}</code>)}</div>
        <p className="mt-4 text-xs leading-5 text-slate-500">Contrato {WAREHOUSE_MOVEMENT_SCHEMA_VERSION} · saldo {WAREHOUSE_BALANCE_SCHEMA_VERSION}.</p>
      </div>
      <div className="mt-5"><FutureNotice phase="FASES 4–10">A consulta do histórico será conectada ao ledger existente quando houver necessidade operacional. Esta fase não cria outro ledger e não oferece botões de entrada, saída, transferência ou ajuste.</FutureNotice></div>
    </div>
  );
}

function LocationsContent() {
  return (
    <div className="mt-6">
      <div className="rounded-2xl border border-white/[0.07] bg-black/10 p-5">
        <div className="flex items-center gap-2 text-slate-300"><MapPinned className="h-4 w-4 text-blue-200" aria-hidden="true" /><p className="text-xs font-bold">Modelo lógico previsto</p></div>
        <div className="mt-5 flex flex-wrap items-center gap-2 text-sm font-bold text-slate-300">
          <span className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2">Depósito</span><ArrowRight className="h-4 w-4 text-slate-600" aria-hidden="true" /><span className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2">Local</span><ArrowRight className="h-4 w-4 text-slate-600" aria-hidden="true" /><span className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2">Subposição opcional</span>
        </div>
      </div>
      <div className="mt-5"><FutureNotice phase="FASE 6">Esta capacidade será disponibilizada em uma fase posterior. O Walking Skeleton não cria CRUD, documentos de localização ou transferências antecipadamente.</FutureNotice></div>
    </div>
  );
}

function WarehouseViewContent() {
  return (
    <div className="mt-6">
      <div className="rounded-3xl border border-dashed border-blue-300/15 bg-[linear-gradient(135deg,rgba(59,130,246,0.035),rgba(255,255,255,0.015))] p-6 sm:p-8">
        <div className="mx-auto max-w-2xl text-center"><MapPinned className="mx-auto h-8 w-8 text-blue-200/60" aria-hidden="true" /><p className="mt-4 text-sm font-black text-slate-200">Área estrutural do futuro croqui operacional</p><p className="mt-2 text-xs leading-6 text-slate-500">O mapa será 2D com perspectiva tridimensional leve e representará locais, não produtos. Nenhum motor 3D, editor ou layout fictício foi criado nesta fase.</p></div>
      </div>
      <div className="mt-5"><FutureNotice phase="FASE 9">Pesquisa, destaque visual de locais, editor simplificado e persistência versionada serão implementados como uma fatia vertical própria.</FutureNotice></div>
    </div>
  );
}

function InventoryContent() {
  return <div className="mt-6"><PlannedItems items={['Selecionar depósito/local','Registrar contagem','Comparar esperado x contado','Exibir divergência','Confirmar ajuste humano','Gerar ajuste auditável']} /><div className="mt-5"><FutureNotice phase="FASE 10">Esta capacidade será disponibilizada em uma fase posterior. INVENTORY_ADJUSTMENT permanece apenas como tipo reconhecido pelo ledger; nenhum ajuste operacional é disparado aqui.</FutureNotice></div></div>;
}

function SiscofisContent() {
  return (
    <div className="mt-6">
      <div className="rounded-2xl border border-white/[0.07] bg-black/10 p-5">
        <div className="flex items-center gap-2"><FileJson2 className="h-4 w-4 text-blue-200" aria-hidden="true" /><p className="text-xs font-bold text-slate-300">Fluxo arquitetural previsto</p></div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">{['Prompt oficial','JSON externo','Validação','Preview','Marco Zero / snapshot'].map((step) => <div key={step} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3 text-center text-[11px] font-bold text-slate-400">{step}</div>)}</div>
      </div>
      <div className="mt-5"><FutureNotice phase="FASE 5">A IA continuará externa. Importação, validação, Marco Zero, snapshots e conciliação ainda não estão operacionais nesta superfície.</FutureNotice></div>
    </div>
  );
}

function DeliveriesContent() {
  return (
    <div className="mt-6">
      <div className="rounded-2xl border border-white/[0.07] bg-black/10 p-5"><div className="flex items-center gap-2"><PackageCheck className="h-4 w-4 text-blue-200" aria-hidden="true" /><p className="text-xs font-bold text-slate-300">Integração sem duplicação</p></div><p className="mt-3 text-sm leading-6 text-slate-400">Esta área será conectada ao Planejamento/Cronograma existente. O Walking Skeleton não copia, migra ou mantém uma segunda fonte de entregas.</p></div>
      <div className="mt-5"><FutureNotice phase="FASE 11">Entrega → NF → estoque e os indicadores logísticos serão conectados somente quando as fatias anteriores estiverem operacionais.</FutureNotice></div>
    </div>
  );
}

function SettingsContent() {
  return (
    <div className="mt-6">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-emerald-300/10 bg-emerald-400/[0.035] p-5"><div className="flex items-center gap-2 text-emerald-200"><ShieldCheck className="h-4 w-4" aria-hidden="true" /><p className="text-xs font-bold">Escopo do piloto</p></div><p className="mt-3 text-sm leading-6 text-slate-400">A configuração efetiva continua no contrato founder-only existente. Nenhum novo papel externo foi criado.</p></div>
        <div className="rounded-2xl border border-blue-300/10 bg-blue-400/[0.035] p-5"><div className="flex items-center gap-2 text-blue-200"><Boxes className="h-4 w-4" aria-hidden="true" /><p className="text-xs font-bold">Configuração logística</p></div><p className="mt-3 text-sm leading-6 text-slate-400">Não existem toggles fictícios nesta fase. Parâmetros serão adicionados apenas quando possuírem contrato funcional e de segurança definido.</p></div>
      </div>
      <div className="mt-5"><FutureNotice phase="FASES 12–14">Configurações de operacionalização, telemetria e expansão externa serão tratadas nas fases específicas do roadmap.</FutureNotice></div>
    </div>
  );
}

export function WarehouseSectionContent({ section }: { section: WarehouseSectionId }) {
  switch (section) {
    case 'overview': return <OverviewContent />;
    case 'stock': return <StockContent />;
    case 'movements': return <MovementsContent />;
    case 'locations': return <LocationsContent />;
    case 'warehouseView': return <WarehouseViewContent />;
    case 'inventory': return <InventoryContent />;
    case 'siscofis': return <SiscofisContent />;
    case 'deliveries': return <DeliveriesContent />;
    case 'settings': return <SettingsContent />;
  }
}
