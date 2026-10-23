'use client';

import dynamic from 'next/dynamic';

const WarehouseCroquisR1Operational=dynamic(
  ()=>import('./WarehouseCroquisR1Operational').then(mod=>mod.WarehouseCroquisR1Operational)
);

/**
 * Entrada unica para administracao fisica.
 * A estrutura antiga fica preservada no codigo como fallback, mas deixa de
 * ser uma subaba paralela ou de competir por cadastros operacionais.
 */
export function WarehouseDepotsOperational({workspaceId}:{workspaceId:string}){
  return (
    <div className="mt-4 space-y-5" data-testid="warehouse-depots-operational">
      <WarehouseCroquisR1Operational workspaceId={workspaceId}/>
    </div>
  );
}
