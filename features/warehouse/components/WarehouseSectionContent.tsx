'use client';

import type { WarehouseSectionId } from '../navigation';
import { WarehouseDepotsOperational } from './WarehouseDepotsOperational';
import { WarehouseItemRegistrationOperational } from './WarehouseItemRegistrationOperational';
import { WarehouseMaterialWithdrawal } from './WarehouseMaterialWithdrawal';
import { WarehouseItemControlOperational } from './WarehouseItemControlOperational';
import { WarehouseHomeOperational } from './WarehouseHomeOperational';

function WarehouseModularR1Notice({ section }: { section: WarehouseSectionId }) {
  const labels: Record<WarehouseSectionId, string> = {
    overview: 'Início',
    registration: 'Alocação de Material',
    outbound: 'Saída de Material',
    depots: 'Meus Depósitos',
    control: 'Controle de Materiais',
  };

  return (
    <div
      className="mt-4 rounded-3xl border border-blue-200 bg-white p-6 shadow-sm"
      data-testid="warehouse-modular-r1-notice"
    >
      <p className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-[#00288e]/70">
        ADM-R1 · publicação modular
      </p>
      <h2 className="mt-2 text-xl font-black text-slate-900">
        {labels[section]} preservado para a próxima integração
      </h2>
      <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
        Esta superfície permanece no código completo do ADM Depósito, mas está
        temporariamente sem operações de estoque enquanto a fundação independente
        é publicada e validada. Nesta release, use Meus Depósitos para testar
        depósitos, localizações e croquis.
      </p>
    </div>
  );
}

export function WarehouseSectionContent({
  section,
  workspaceId,
}: {
  section: WarehouseSectionId;
  workspaceId: string;
}) {
  if (section === 'overview') {
    return <WarehouseHomeOperational workspaceId={workspaceId} />;
  }

  if (section === 'depots') {
    return <WarehouseDepotsOperational workspaceId={workspaceId} />;
  }

  if (section === 'registration') {
    return <WarehouseItemRegistrationOperational workspaceId={workspaceId} />;
  }

  if (section === 'outbound') {
    return <WarehouseMaterialWithdrawal workspaceId={workspaceId} />;
  }

  if (section === 'control') {
    return <WarehouseItemControlOperational workspaceId={workspaceId} />;
  }

  return <WarehouseModularR1Notice section={section} />;
}
