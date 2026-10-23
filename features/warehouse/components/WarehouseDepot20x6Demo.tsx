'use client';

import { useState } from 'react';
import { Box, Layers3, Map, MousePointer2, Warehouse } from 'lucide-react';
import {
  DEMO_20X6_WIDTH_CM, DEMO_20X6_DEPTH_CM, DEMO_20X6_DEPOT_ID,
  WAREHOUSE_20X6_SCENARIOS,
  type Demo20x6Scenario,
} from '../../../lib/warehouse/demoDepot20x6';
import type { WarehouseDepotLayoutObject } from '../../../lib/warehouse/layout';
import { WarehouseIsometricPreview } from './WarehouseIsometricPreview';

type DisplayMode = '3d' | '2d';

function fixtureColor(kind: WarehouseDepotLayoutObject['kind']): string {
  if (kind === 'SHELF') return '#0f766e';
  if (kind === 'PALLET') return '#b45309';
  if (kind === 'REFRIGERATOR') return '#0369a1';
  if (kind === 'FREEZER') return '#7c3aed';
  return '#64748b';
}

export function WarehouseDepot20x6Demo() {
  const [scenarioId, setScenarioId] = useState<Demo20x6Scenario>('dense');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('3d');
  const [focusedLocationId, setFocusedLocationId] = useState<string | null>(null);
  const [queryText, setQueryText] = useState('');
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const scenario = WAREHOUSE_20X6_SCENARIOS[scenarioId];
  const focusedObject = scenario.objects.find((object) =>
    object.warehouseLocationId === focusedLocationId
  ) || null;

  const changeScenario = (next: Demo20x6Scenario) => {
    setScenarioId(next);
    setFocusedLocationId(null);
    setQueryText('');
    setSelectedMaterialId('');
  };

  return (
    <div data-testid="warehouse-demo-20x6" className="space-y-5">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: 'Comprimento', value: '20 metros' },
          { label: 'Profundidade', value: '6 metros' },
          { label: 'Locais', value: String(scenario.objects.length) },
          { label: 'Dados', value: '100% fictícios' },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 text-lg font-extrabold text-slate-900">{value}</p>
          </div>
        ))}
      </section>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Warehouse className="h-4 w-4 text-blue-700" /> Depósito demonstrativo · 2000 × 600 cm
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Escolha a densidade e compare a planta 2D com o mesmo renderizador 3D do EMPROVEX.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1" aria-label="Cenário simulado">
              {([
                ['simple', 'Simples'],
                ['dense', 'Denso'],
              ] as const).map(([key, label]) => (
                <button key={key} type="button" onClick={() => changeScenario(key)}
                  data-testid={'warehouse-demo-scenario-' + key}
                  aria-pressed={scenarioId === key}
                  className={scenarioId === key
                    ? 'rounded-lg bg-[#00288e] px-3 py-2 text-xs font-bold text-white shadow-sm'
                    : 'rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-white'}
                >{label}</button>
              ))}
            </div>
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1" aria-label="Modo de visualização">
              {([
                ['3d', 'Prévia 3D', Layers3],
                ['2d', 'Croqui 2D', Map],
              ] as const).map(([key, label, Icon]) => (
                <button key={key} type="button" onClick={() => setDisplayMode(key)}
                  data-testid={'warehouse-demo-mode-' + key}
                  aria-pressed={displayMode === key}
                  className={displayMode === key
                    ? 'flex items-center gap-1.5 rounded-lg bg-[#00288e] px-3 py-2 text-xs font-bold text-white shadow-sm'
                    : 'flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-white'}
                ><Icon className="h-3.5 w-3.5" />{label}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="min-w-[210px] flex-1 text-xs font-semibold text-slate-600">
            Destacar um local (opcional)
            <select
              data-testid="warehouse-demo-focus-location"
              value={focusedLocationId || ''}
              onChange={(event) => setFocusedLocationId(event.target.value || null)}
              className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800"
            >
              <option value="">Todos os locais</option>
              {scenario.objects.map((object) => (
                <option key={object.id} value={object.warehouseLocationId || ''}>
                  {object.label} · {object.kind === 'SHELF' ? 'Estante' : object.kind === 'PALLET'
                    ? 'Palete' : object.kind === 'FREEZER' ? 'Freezer'
                      : object.kind === 'REFRIGERATOR' ? 'Geladeira' : 'Bancada'}
                </option>
              ))}
            </select>
          </label>
          <div className="rounded-lg bg-blue-50 px-3 py-2.5 text-xs font-semibold text-blue-900">
            <MousePointer2 className="mr-1 inline h-3.5 w-3.5" />
            {focusedObject ? 'Destaque: ' + focusedObject.label : 'Destaque um local ou use as quatro vistas 3D'}
          </div>
        </div>
      </div>

      {displayMode === '3d' ? (
        <div data-testid="warehouse-demo-preview-3d">
          <WarehouseIsometricPreview
            key={scenarioId}
            logicalWidth={DEMO_20X6_WIDTH_CM}
            logicalHeight={DEMO_20X6_DEPTH_CM}
            objects={scenario.objects}
            locations={scenario.locations}
            balances={scenario.balances}
            materials={scenario.materials}
            selectedMaterialId={selectedMaterialId}
            queryText={queryText}
            onQueryTextChange={setQueryText}
            onSelectedMaterialIdChange={setSelectedMaterialId}
            depotId={DEMO_20X6_DEPOT_ID}
            depotName="Depósito 20 × 6 m · simulado"
            focusedLocationId={focusedLocationId}
            onFocusLocationChange={setFocusedLocationId}
          />
        </div>
      ) : (
        <section data-testid="warehouse-demo-preview-2d"
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Box className="h-4 w-4" /> Croqui 2D proporcional
            </p>
            <p className="mt-1 text-xs text-slate-500">Cada retângulo corresponde à mesma posição e medida utilizada no 3D.</p>
          </div>
          <div className="overflow-x-auto bg-[#101f35] p-4">
            <svg viewBox="0 0 2000 600" role="img" aria-label="Croqui 2D do depósito simulado de 20 por 6 metros"
              className="min-w-[850px] w-full rounded-lg">
              <rect width="2000" height="600" fill="#eaf1f6" stroke="#94a3b8" strokeWidth="4" />
              {Array.from({ length: 19 }, (_, i) => (
                <line key={'vertical-' + i} x1={(i + 1) * 100} x2={(i + 1) * 100}
                  y1="0" y2="600" stroke="#cbd5e1" strokeWidth="1" />
              ))}
              {Array.from({ length: 5 }, (_, i) => (
                <line key={'horizontal-' + i} x1="0" x2="2000"
                  y1={(i + 1) * 100} y2={(i + 1) * 100} stroke="#cbd5e1" strokeWidth="1" />
              ))}
              {scenario.objects.map((object) => {
                const active = focusedLocationId === object.warehouseLocationId;
                return (
                  <g key={object.id} onClick={() => setFocusedLocationId(object.warehouseLocationId)}
                    className="cursor-pointer" data-location-id={object.warehouseLocationId || ''}>
                    <title>{object.label} · {object.width} × {object.height} cm</title>
                    <rect x={object.x} y={object.y} width={object.width} height={object.height}
                      rx="6" fill={fixtureColor(object.kind)}
                      stroke={active ? '#facc15' : '#f8fafc'} strokeWidth={active ? 9 : 3} />
                    <text x={object.x + object.width / 2} y={object.y + object.height / 2 + 5}
                      textAnchor="middle" fontSize="19" fontWeight="700" fill="#ffffff">
                      {object.label}
                    </text>
                  </g>
                );
              })}
              <text x="20" y="590" fill="#334155" fontSize="14">20 m</text>
            </svg>
          </div>
        </section>
      )}

      <p className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-900">
        Laboratório somente visual: os locais, ocupações e materiais desta página são simulados.
        Nenhum login é necessário e esta prévia não consulta nem grava informações no Firestore.
        Para segurança, o laboratório só abre com o servidor no modo de desenvolvimento.
      </p>
    </div>
  );
}
