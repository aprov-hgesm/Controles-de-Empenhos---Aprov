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
import { WarehouseDepotLayoutEditor } from './WarehouseDepotLayoutEditor';

type DisplayMode = '3d' | '2d';

type LocalHistory = {
  objects: WarehouseDepotLayoutObject[];
  past: WarehouseDepotLayoutObject[][];
  future: WarehouseDepotLayoutObject[][];
};

function copyObjects(items:WarehouseDepotLayoutObject[]):WarehouseDepotLayoutObject[]{
  return items.map(item=>({...item}));
}
function createDraft(scenario:Demo20x6Scenario):LocalHistory{
  return {objects:copyObjects(WAREHOUSE_20X6_SCENARIOS[scenario].objects),past:[],future:[]};
}

export function WarehouseDepot20x6Demo() {
  const [scenarioId, setScenarioId] = useState<Demo20x6Scenario>('dense');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('2d');
  const [draft, setDraft] = useState<LocalHistory>(()=>createDraft('dense'));
  const [selectedObjectId, setSelectedObjectId] = useState<string|null>(null);
  const [focusedLocationId, setFocusedLocationId] = useState<string | null>(null);
  const [queryText, setQueryText] = useState('');
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const scenario = WAREHOUSE_20X6_SCENARIOS[scenarioId];
  const focusedObject = draft.objects.find((object) =>
    object.warehouseLocationId === focusedLocationId
  ) || null;

  const changeScenario = (next: Demo20x6Scenario) => {
    setScenarioId(next);
    setDraft(createDraft(next));
    setSelectedObjectId(null);
    setFocusedLocationId(null);
    setQueryText('');
    setSelectedMaterialId('');
  };

  const checkpoint=(old:WarehouseDepotLayoutObject[])=>setDraft(current=>({
    ...current,past:[...current.past.slice(-29),copyObjects(old)],future:[],
  }));
  const undo=()=>setDraft(current=>{
    if(!current.past.length)return current;
    const previous=current.past[current.past.length-1];
    return {objects:copyObjects(previous),past:current.past.slice(0,-1),
      future:[copyObjects(current.objects),...current.future]};
  });
  const redo=()=>setDraft(current=>{
    if(!current.future.length)return current;
    const [next,...rest]=current.future;
    return {objects:copyObjects(next),past:[...current.past,copyObjects(current.objects)],future:rest};
  });

  return (
    <div data-testid="warehouse-demo-20x6" className="space-y-5">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: 'Comprimento', value: '20 metros' },
          { label: 'Profundidade', value: '6 metros' },
          { label: 'Objetos no croqui', value: String(draft.objects.length) },
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
              Experimente o editor real: zoom com roda, Espaço para mover, seleção e giro de 90°. Tudo aqui é simulado.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1" aria-label="Cenário simulado">
              {([
                ['simple', 'Simples'],
                ['dense', 'Denso'],
                ['operational', 'Operacional'],
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
                ['3d', 'Prévia 3D oficial', Layers3],
                ['2d', 'Editor 2D', Map],
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
              {draft.objects.map((object) => (
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
            objects={draft.objects}
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
          <div className="border-b border-slate-200 p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Box className="h-4 w-4" /> Editor 2D oficial · PR #366 · dados fictícios
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Selecione uma estante, gire usando os botões de 90°, teste o zoom,
              duplique ou arraste. A faixa verde indica a frente física.
              Alterne para Prévia 3D para comparar a orientação.
            </p>
          </div>
          <div className="bg-slate-50 p-3">
            <WarehouseDepotLayoutEditor
              scopeKey={'lab-20x6-'+scenarioId}
              logicalWidth={DEMO_20X6_WIDTH_CM}
              logicalHeight={DEMO_20X6_DEPTH_CM}
              objects={draft.objects}
              selectedObjectId={selectedObjectId}
              onSelectedObjectIdChange={setSelectedObjectId}
              onObjectsChange={objects=>setDraft(current=>({...current,objects:copyObjects(objects)}))}
              onHistoryCheckpoint={checkpoint}
              canUndo={draft.past.length>0}
              canRedo={draft.future.length>0}
              onUndo={undo}
              onRedo={redo}
              lightTheme
              preventLocalOverlap
              onDuplicateObject={(source,copy)=>({
                ...copy,
                warehouseLocationId:null,
                label:'Cópia fictícia · '+source.label.slice(0,72),
              })}
            />
          </div>
          <div className="flex flex-wrap justify-between gap-2 border-t border-slate-200 px-4 py-3">
            <span className="text-xs font-semibold text-slate-600">
              Sem integração com contas, depósitos ou saldos reais.
            </span>
            <button type="button" onClick={()=>{setDraft(createDraft(scenarioId));setSelectedObjectId(null);}}
              data-testid="warehouse-demo-reset-draft"
              className="rounded-lg bg-blue-100 px-3 py-2 text-xs font-bold text-blue-800">
              Restaurar cenário
            </button>
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
