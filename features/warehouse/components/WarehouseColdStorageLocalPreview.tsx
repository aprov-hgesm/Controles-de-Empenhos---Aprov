'use client';

import { useState } from 'react';

import type { WarehouseDepotLayoutObject } from '../../../lib/warehouse/layout';
import { WarehouseIsometricPreview } from './WarehouseIsometricPreview';

// Independent sample geometry: no authentication, queries, Firestore or writes.
// The exact same isometric preview and 4 camera controls are used by the depot.
const SAMPLE_OBJECTS: WarehouseDepotLayoutObject[] = [
  {
    id: 'obj_local_fridge_demo',
    kind: 'REFRIGERATOR',
    label: 'GEL-01 · Geladeira industrial inox',
    x: 80,
    y: 175,
    width: 205,
    height: 92,
    rotation: 0,
    layer: 0,
    elevation: 0,
    visualVariant: 'solid',
    warehouseLocationId: null,
  },
  {
    id: 'obj_local_freezer_demo',
    kind: 'FREEZER',
    label: 'FRZ-01 · Freezer horizontal',
    x: 345,
    y: 165,
    width: 258,
    height: 110,
    rotation: 0,
    layer: 0,
    elevation: 0,
    visualVariant: 'solid',
    warehouseLocationId: null,
  },
];

export function WarehouseColdStorageLocalPreview() {
  const [filter, setFilter] = useState<'both' | 'fridge' | 'freezer'>('both');
  const [queryText, setQueryText] = useState('');
  const [selectedMaterialId, setSelectedMaterialId] = useState('');

  const objects = filter === 'both'
    ? SAMPLE_OBJECTS
    : SAMPLE_OBJECTS.filter((object) =>
      filter === 'fridge' ? object.kind === 'REFRIGERATOR' : object.kind === 'FREEZER'
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2" aria-label="Filtrar demonstração">
        {([
          ['both', 'Geladeira + Freezer'],
          ['fridge', 'Somente geladeira'],
          ['freezer', 'Somente freezer'],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            aria-pressed={filter === value}
            className={
              'rounded-xl border px-4 py-2 text-xs font-bold transition '
              + (filter === value
                ? 'border-blue-800 bg-[#00288e] text-white'
                : 'border-slate-200 bg-white text-slate-700 hover:border-blue-400')
            }
          >
            {label}
          </button>
        ))}
      </div>
      <WarehouseIsometricPreview
        logicalWidth={700}
        logicalHeight={440}
        objects={objects}
        locations={[]}
        balances={[]}
        materials={[]}
        selectedMaterialId={selectedMaterialId}
        queryText={queryText}
        onQueryTextChange={setQueryText}
        onSelectedMaterialIdChange={setSelectedMaterialId}
        embedded
      />
      <p className="text-xs leading-5 text-slate-500">
        As dimensões exemplificam apenas a geometria do croqui (em centímetros).
        Esta prévia utiliza os componentes reais da visualização 3D, sem carregar
        dados de usuários ou cadastrar estruturas. A altura exibida ainda segue
        o padrão visual do motor isométrico.
      </p>
    </div>
  );
}
