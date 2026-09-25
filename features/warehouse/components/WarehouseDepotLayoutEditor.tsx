'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BringToFront,
  Copy,
  Grid3X3,
  Hand,
  Redo2,
  RotateCw,
  SendToBack,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

import type { WarehouseDepotLayoutObject } from '../../../lib/warehouse/layout';

type EditorView = 'top' | 'perspective';
type InteractionMode = 'select' | 'pan';
type HistoryState = { past: WarehouseDepotLayoutObject[][]; future: WarehouseDepotLayoutObject[][] };

const GRID_SIZE = 20;
const MIN_SIZE = 20;
const ROTATION_STEP = 45;
const ZOOM_MIN = 0.55;
const ZOOM_MAX = 2.2;

function cloneObjects(objects: WarehouseDepotLayoutObject[]): WarehouseDepotLayoutObject[] {
  return objects.map((item) => ({ ...item }));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function snap(value: number, enabled: boolean): number {
  return enabled ? Math.round(value / GRID_SIZE) * GRID_SIZE : Math.round(value);
}

function isTextInput(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement
    || (target instanceof HTMLElement && target.isContentEditable);
}

function perspectiveStyle(object: WarehouseDepotLayoutObject, logicalHeight: number) {
  const depth = Math.max(5, Math.min(18, object.elevation * 4 + 6));
  const yLift = ((logicalHeight - object.y) / logicalHeight) * 4;
  return {
    transform: `rotate(${object.rotation}deg) translate(${depth * 0.35}px, ${-depth * 0.28 - yLift}px)`,
    boxShadow: `${depth * 0.45}px ${depth * 0.55}px 0 rgba(15,23,42,0.42), 0 10px 24px rgba(2,8,23,0.18)`,
  };
}

export function WarehouseDepotLayoutEditor({
  logicalWidth,
  logicalHeight,
  objects,
  selectedObjectId,
  onSelectedObjectIdChange,
  onObjectsChange,
  scopeKey,
}: {
  logicalWidth: number;
  logicalHeight: number;
  objects: WarehouseDepotLayoutObject[];
  selectedObjectId: string | null;
  onSelectedObjectIdChange: (id: string | null) => void;
  onObjectsChange: (objects: WarehouseDepotLayoutObject[]) => void;
  scopeKey: string;
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const interactionRef = useRef<null | {
    type: 'move' | 'resize' | 'rotate' | 'pan';
    objectId?: string;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startPanX?: number;
    startPanY?: number;
    startObject?: WarehouseDepotLayoutObject;
    rectWidth?: number;
    rectHeight?: number;
  }>(null);
  const copiedRef = useRef<WarehouseDepotLayoutObject | null>(null);
  const [view, setView] = useState<EditorView>('top');
  const [mode, setMode] = useState<InteractionMode>('select');
  const [showGrid, setShowGrid] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [history, setHistory] = useState<HistoryState>({ past: [], future: [] });

  useEffect(() => {
    interactionRef.current = null;
    copiedRef.current = null;
    setHistory({ past: [], future: [] });
    setView('top');
    setMode('select');
    setZoom(1);
    setPan({ x: 0, y: 0 });
    onSelectedObjectIdChange(null);
  }, [scopeKey, onSelectedObjectIdChange]);

  const selected = useMemo(
    () => objects.find((item) => item.id === selectedObjectId) || null,
    [objects, selectedObjectId]
  );

  const commit = useCallback((next: WarehouseDepotLayoutObject[]) => {
    setHistory((current) => ({
      past: [...current.past.slice(-49), cloneObjects(objects)],
      future: [],
    }));
    onObjectsChange(next);
  }, [objects, onObjectsChange]);

  const patchObject = useCallback((
    id: string,
    patch: Partial<WarehouseDepotLayoutObject>,
    withHistory = true
  ) => {
    const next = objects.map((item) => item.id === id ? { ...item, ...patch } : item);
    if (withHistory) commit(next);
    else onObjectsChange(next);
  }, [commit, objects, onObjectsChange]);

  const undo = useCallback(() => {
    setHistory((current) => {
      const previous = current.past[current.past.length - 1];
      if (!previous) return current;
      onObjectsChange(cloneObjects(previous));
      return {
        past: current.past.slice(0, -1),
        future: [cloneObjects(objects), ...current.future.slice(0, 49)],
      };
    });
  }, [objects, onObjectsChange]);

  const redo = useCallback(() => {
    setHistory((current) => {
      const next = current.future[0];
      if (!next) return current;
      onObjectsChange(cloneObjects(next));
      return {
        past: [...current.past.slice(-49), cloneObjects(objects)],
        future: current.future.slice(1),
      };
    });
  }, [objects, onObjectsChange]);

  const duplicateSelected = useCallback(() => {
    if (!selected) return;
    const copy: WarehouseDepotLayoutObject = {
      ...selected,
      id: 'obj_' + crypto.randomUUID().replace(/-/g, ''),
      label: selected.label + ' (cópia)',
      x: clamp(selected.x + 24, 0, Math.max(0, logicalWidth - selected.width)),
      y: clamp(selected.y + 24, 0, Math.max(0, logicalHeight - selected.height)),
      layer: Math.max(...objects.map((item) => item.layer), 0) + 1,
      warehouseLocationId: null,
    };
    commit([...objects, copy]);
    onSelectedObjectIdChange(copy.id);
  }, [commit, logicalHeight, logicalWidth, objects, onSelectedObjectIdChange, selected]);

  const removeSelected = useCallback(() => {
    if (!selected) return;
    commit(objects.filter((item) => item.id !== selected.id));
    onSelectedObjectIdChange(null);
  }, [commit, objects, onSelectedObjectIdChange, selected]);

  const pasteCopied = useCallback(() => {
    const source = copiedRef.current;
    if (!source) return;
    const copy: WarehouseDepotLayoutObject = {
      ...source,
      id: 'obj_' + crypto.randomUUID().replace(/-/g, ''),
      label: source.label + ' (cópia)',
      x: clamp(source.x + 24, 0, Math.max(0, logicalWidth - source.width)),
      y: clamp(source.y + 24, 0, Math.max(0, logicalHeight - source.height)),
      layer: Math.max(...objects.map((item) => item.layer), 0) + 1,
      warehouseLocationId: null,
    };
    commit([...objects, copy]);
    onSelectedObjectIdChange(copy.id);
  }, [commit, logicalHeight, logicalWidth, objects, onSelectedObjectIdChange]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (isTextInput(event.target)) return;
      const modifier = event.ctrlKey || event.metaKey;
      if ((event.key === 'Delete' || event.key === 'Backspace') && selected) {
        event.preventDefault();
        removeSelected();
        return;
      }
      if (modifier && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        duplicateSelected();
        return;
      }
      if (modifier && event.key.toLowerCase() === 'c' && selected) {
        event.preventDefault();
        copiedRef.current = { ...selected };
        return;
      }
      if (modifier && event.key.toLowerCase() === 'v') {
        event.preventDefault();
        pasteCopied();
        return;
      }
      if (modifier && event.key.toLowerCase() === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
        return;
      }
      if ((modifier && event.key.toLowerCase() === 'y') || (modifier && event.shiftKey && event.key.toLowerCase() === 'z')) {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [duplicateSelected, pasteCopied, redo, removeSelected, selected, undo]);

  const startInteraction = (
    event: React.PointerEvent,
    type: 'move' | 'resize' | 'rotate',
    object: WarehouseDepotLayoutObject
  ) => {
    if (view !== 'top' || mode === 'pan') return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = viewport.getBoundingClientRect();
    interactionRef.current = {
      type,
      objectId: object.id,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startObject: { ...object },
      rectWidth: rect.width,
      rectHeight: rect.height,
    };
    onSelectedObjectIdChange(object.id);
  };

  const finishInteraction = () => {
    const interaction = interactionRef.current;
    if (interaction && interaction.type !== 'pan' && interaction.startObject && interaction.objectId) {
      const current = objects.find((item) => item.id === interaction.objectId);
      if (current && JSON.stringify(current) !== JSON.stringify(interaction.startObject)) {
        setHistory((state) => ({
          past: [...state.past.slice(-49), cloneObjects(
            objects.map((item) => item.id === interaction.objectId ? interaction.startObject! : item)
          )],
          future: [],
        }));
      }
    }
    interactionRef.current = null;
  };

  const layerShift = (direction: 'front' | 'back') => {
    if (!selected) return;
    const values = objects.map((item) => item.layer);
    const layer = direction === 'front'
      ? Math.max(...values, 0) + 1
      : Math.min(...values, 1) - 1;
    patchObject(selected.id, { layer });
  };

  return (
    <div className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-[#050b16]" data-testid="warehouse-layout-professional-editor">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-white/[0.07] bg-white/[0.025] px-3 py-2" data-testid="warehouse-croqui-editor-toolbar">
        <div className="flex flex-wrap items-center gap-1">
          <button type="button" aria-label="Alternar modo de pan" onClick={() => setMode(mode === 'pan' ? 'select' : 'pan')} aria-pressed={mode === 'pan'} className="rounded-lg border border-white/[0.07] px-2.5 py-2 text-[10px] font-bold text-slate-300 hover:bg-white/[0.05]">
            <Hand className="h-3.5 w-3.5" /> <span className="sr-only">Pan</span>
          </button>
          <button type="button" onClick={() => setShowGrid((value) => !value)} aria-pressed={showGrid} className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.07] px-2.5 py-2 text-[10px] font-bold text-slate-300 hover:bg-white/[0.05]">
            <Grid3X3 className="h-3.5 w-3.5" /> Grade
          </button>
          <button type="button" onClick={() => setSnapEnabled((value) => !value)} aria-pressed={snapEnabled} className="rounded-lg border border-white/[0.07] px-2.5 py-2 text-[10px] font-bold text-slate-300 hover:bg-white/[0.05]">
            Snap {snapEnabled ? 'on' : 'off'}
          </button>
          <span className="mx-1 h-5 w-px bg-white/[0.07]" />
          <button type="button" aria-label="Desfazer" disabled={!history.past.length} onClick={undo} className="rounded-lg p-2 text-slate-400 hover:bg-white/[0.05] disabled:opacity-30"><Undo2 className="h-3.5 w-3.5" /></button>
          <button type="button" aria-label="Refazer" disabled={!history.future.length} onClick={redo} className="rounded-lg p-2 text-slate-400 hover:bg-white/[0.05] disabled:opacity-30"><Redo2 className="h-3.5 w-3.5" /></button>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <button type="button" aria-label="Diminuir zoom" onClick={() => setZoom((value) => clamp(value - 0.1, ZOOM_MIN, ZOOM_MAX))} className="rounded-lg p-2 text-slate-400 hover:bg-white/[0.05]"><ZoomOut className="h-3.5 w-3.5" /></button>
          <span className="min-w-11 text-center text-[10px] font-bold text-slate-500">{Math.round(zoom * 100)}%</span>
          <button type="button" aria-label="Aumentar zoom" onClick={() => setZoom((value) => clamp(value + 0.1, ZOOM_MIN, ZOOM_MAX))} className="rounded-lg p-2 text-slate-400 hover:bg-white/[0.05]"><ZoomIn className="h-3.5 w-3.5" /></button>
          <span className="mx-1 h-5 w-px bg-white/[0.07]" />
          <button type="button" onClick={() => setView('top')} aria-pressed={view === 'top'} className="rounded-lg border border-white/[0.07] px-2.5 py-2 text-[10px] font-bold text-slate-300 aria-pressed:bg-blue-400/10 aria-pressed:text-blue-100">Vista superior</button>
          <button type="button" onClick={() => setView('perspective')} aria-pressed={view === 'perspective'} className="rounded-lg border border-white/[0.07] px-2.5 py-2 text-[10px] font-bold text-slate-300 aria-pressed:bg-blue-400/10 aria-pressed:text-blue-100">Prévia 2.5D</button>
        </div>
      </div>

      <div
        ref={viewportRef}
        data-testid="warehouse-croqui-editor-viewport"
        className={`relative h-[clamp(440px,62vh,720px)] min-h-[440px] max-w-full overflow-hidden ${mode === 'pan' ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
        onPointerDown={(event) => {
          if (mode !== 'pan') {
            if (event.target === event.currentTarget) onSelectedObjectIdChange(null);
            return;
          }
          event.currentTarget.setPointerCapture(event.pointerId);
          interactionRef.current = {
            type: 'pan',
            pointerId: event.pointerId,
            startClientX: event.clientX,
            startClientY: event.clientY,
            startPanX: pan.x,
            startPanY: pan.y,
          };
        }}
        onPointerMove={(event) => {
          const interaction = interactionRef.current;
          if (!interaction || interaction.pointerId !== event.pointerId) return;
          if (interaction.type === 'pan') {
            setPan({
              x: (interaction.startPanX || 0) + event.clientX - interaction.startClientX,
              y: (interaction.startPanY || 0) + event.clientY - interaction.startClientY,
            });
            return;
          }
          if (!interaction.objectId || !interaction.startObject || !interaction.rectWidth || !interaction.rectHeight) return;
          const start = interaction.startObject;
          const scaleX = logicalWidth / interaction.rectWidth / zoom;
          const scaleY = logicalHeight / interaction.rectHeight / zoom;
          const dx = (event.clientX - interaction.startClientX) * scaleX;
          const dy = (event.clientY - interaction.startClientY) * scaleY;
          if (interaction.type === 'move') {
            patchObject(interaction.objectId, {
              x: clamp(snap(start.x + dx, snapEnabled), 0, Math.max(0, logicalWidth - start.width)),
              y: clamp(snap(start.y + dy, snapEnabled), 0, Math.max(0, logicalHeight - start.height)),
            }, false);
          } else if (interaction.type === 'resize') {
            patchObject(interaction.objectId, {
              width: clamp(snap(start.width + dx, snapEnabled), MIN_SIZE, logicalWidth - start.x),
              height: clamp(snap(start.height + dy, snapEnabled), MIN_SIZE, logicalHeight - start.y),
            }, false);
          } else {
            const delta = (event.clientX - interaction.startClientX) + (event.clientY - interaction.startClientY);
            patchObject(interaction.objectId, {
              rotation: ((Math.round((start.rotation + delta * 0.6) / ROTATION_STEP) * ROTATION_STEP) % 360 + 360) % 360,
            }, false);
          }
        }}
        onPointerUp={finishInteraction}
        onPointerCancel={finishInteraction}
      >
        <div
          className="absolute left-1/2 top-1/2 origin-center"
          style={{
            width: logicalWidth,
            height: logicalHeight,
            transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom})`,
            backgroundImage: showGrid
              ? 'linear-gradient(rgba(148,163,184,0.09) 1px, transparent 1px),linear-gradient(90deg,rgba(148,163,184,0.09) 1px, transparent 1px)'
              : undefined,
            backgroundSize: showGrid ? `${GRID_SIZE}px ${GRID_SIZE}px` : undefined,
            backgroundColor: '#07101f',
            border: '1px solid rgba(148,163,184,0.12)',
            transformStyle: 'preserve-3d',
          }}
        >
          {objects.slice().sort((a, b) => a.layer - b.layer).map((object) => {
            const active = object.id === selectedObjectId;
            const style25d = view === 'perspective' ? perspectiveStyle(object, logicalHeight) : {};
            return (
              <div
                key={object.id}
                data-testid={'warehouse-editor-object-' + object.id}
                className={`absolute select-none rounded-lg border text-left ${active ? 'border-blue-300 ring-2 ring-blue-300/25' : 'border-slate-500/60'} ${object.visualVariant === 'zone' ? 'bg-slate-500/10' : object.visualVariant === 'outline' ? 'bg-transparent' : 'bg-slate-700/55'}`}
                style={{
                  left: object.x,
                  top: object.y,
                  width: object.width,
                  height: object.height,
                  zIndex: object.layer + 20,
                  transformOrigin: 'center',
                  ...(view === 'top' ? { transform: `rotate(${object.rotation}deg)` } : style25d),
                }}
                onPointerDown={(event) => {
                  if (view !== 'top') {
                    event.stopPropagation();
                    onSelectedObjectIdChange(object.id);
                    return;
                  }
                  startInteraction(event, 'move', object);
                }}
              >
                <div className="pointer-events-none truncate px-2 pt-2 text-[10px] font-black text-slate-100">{object.label}</div>
                {object.warehouseLocationId && <div className="pointer-events-none truncate px-2 pt-1 font-mono text-[8px] text-slate-400">{object.warehouseLocationId}</div>}
                {active && view === 'top' && (
                  <>
                    <button
                      type="button"
                      aria-label="Redimensionar"
                      className="absolute -bottom-2 -right-2 h-4 w-4 cursor-nwse-resize rounded-sm border border-blue-200 bg-blue-400"
                      onPointerDown={(event) => startInteraction(event, 'resize', object)}
                    />
                    <button
                      type="button"
                      aria-label="Girar"
                      className="absolute -right-2 -top-7 grid h-5 w-5 place-items-center rounded-full border border-blue-200 bg-[#10233f] text-blue-100"
                      onPointerDown={(event) => startInteraction(event, 'rotate', object)}
                    >
                      <RotateCw className="h-3 w-3" />
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.07] bg-white/[0.02] px-3 py-2">
        <p className="text-[9px] text-slate-600">
          Edição local · grade {showGrid ? 'visível' : 'oculta'} · snap {snapEnabled ? 'ativo' : 'livre'} · nenhum movimento grava no Firestore
        </p>
        <div className="flex items-center gap-1">
          <button type="button" disabled={!selected} onClick={duplicateSelected} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[9px] font-bold text-slate-400 hover:bg-white/[0.05] disabled:opacity-30"><Copy className="h-3 w-3" /> Duplicar</button>
          <button type="button" aria-label="Trazer objeto para frente" disabled={!selected} onClick={() => layerShift('front')} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/[0.05] disabled:opacity-30" title="Trazer para frente"><BringToFront className="h-3.5 w-3.5" /></button>
          <button type="button" aria-label="Enviar objeto para trás" disabled={!selected} onClick={() => layerShift('back')} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/[0.05] disabled:opacity-30" title="Enviar para trás"><SendToBack className="h-3.5 w-3.5" /></button>
          <button type="button" aria-label="Remover somente do croqui" disabled={!selected} onClick={removeSelected} className="rounded-lg p-1.5 text-rose-300 hover:bg-rose-400/[0.06] disabled:opacity-30" title="Excluir somente do croqui"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>
    </div>
  );
}
