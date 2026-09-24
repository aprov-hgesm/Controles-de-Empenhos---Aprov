'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Map, MapPin } from 'lucide-react';

import { WarehouseDepotViewOperational } from './WarehouseDepotViewOperational';
import { WarehouseLocationsOperational } from './WarehouseLocationsOperational';

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
        ? <WarehouseLocationsOperational workspaceId={workspaceId} />
        : <WarehouseDepotViewOperational workspaceId={workspaceId} />}
    </div>
  );
}
