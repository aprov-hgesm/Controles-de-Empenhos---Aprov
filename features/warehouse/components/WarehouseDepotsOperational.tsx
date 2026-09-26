'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Map, MapPin } from 'lucide-react';

import { WarehouseLocationsR1Operational } from './WarehouseLocationsR1Operational';

type DepotTab = 'structure' | 'layout';

export function WarehouseDepotsOperational({ workspaceId }: { workspaceId: string }) {
  const searchParams = useSearchParams();
  const requested = searchParams.get('aba');
  const [tab, setTab] = useState<DepotTab>(requested === 'croquis' ? 'layout' : 'structure');

  useEffect(() => {
    setTab(requested === 'croquis' ? 'layout' : 'structure');
  }, [requested]);

  return (
    <div className="mt-4 space-y-5" data-testid="warehouse-depots-operational">
      <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setTab('structure')}
          className={tab === 'structure' ? 'inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-black text-[#00288e] shadow-sm' : 'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold text-slate-500'}
        >
          <MapPin className="h-3.5 w-3.5" />
          Depósitos e localizações
        </button>
        <button
          type="button"
          onClick={() => setTab('layout')}
          className={tab === 'layout' ? 'inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-black text-[#00288e] shadow-sm' : 'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold text-slate-500'}
        >
          <Map className="h-3.5 w-3.5" />
          Croquis
        </button>
      </div>

      {tab === 'structure'
        ? <WarehouseLocationsR1Operational workspaceId={workspaceId} />
        : (
            <div className="rounded-2xl border border-amber-300/10 bg-amber-400/[0.035] p-5 text-sm text-slate-300">
              <p className="font-black text-amber-100">Croquis preservados, temporariamente isolados na ADM-R1</p>
              <p className="mt-2 leading-6 text-slate-500">
                O editor completo permanece no código, mas sua tela ainda consulta saldos físicos e lotes.
                Ele será reativado após receber uma leitura R1 independente de operações de estoque.
              </p>
            </div>
          )}
    </div>
  );
}
