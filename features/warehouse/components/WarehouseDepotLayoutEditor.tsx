'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BringToFront,
  Copy,
  Grid3X3,
  Hand,
  Crosshair,
  RotateCcw,
  Redo2,
  RotateCw,
  SendToBack,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
  Ruler,
  Layers3,
  X,
} from 'lucide-react';

import type { WarehouseDepotLayoutObject } from '../../../lib/warehouse/layout';
import { turnWarehouseLayoutObject, warehouseObjectFaceLabels } from '../../../lib/warehouse/layoutOrientation';
import { warehouseFindFreePosition, warehouseIsPhysicalLocal, warehouseLocalHasCollision } from '../../../lib/warehouse/layoutCollision';
import { warehouseCroquiCardCode } from '../../../lib/warehouse/croquiCardLabel';

type EditorView = 'top' | 'perspective';
type InteractionMode = 'select' | 'pan';

const GRID_SIZE = 20;
const MIN_SIZE = 20;
const ROTATION_STEP = 90;
const ZOOM_MIN = 0.55;
const ZOOM_MAX = 2.2;
const CONTEXT_MENU_WIDTH = 224;
const CONTEXT_MENU_GAP = 8;

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
    transform: `translate(${depth * 0.35}px, ${-depth * 0.28 - yLift}px)`,
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
  onHistoryCheckpoint,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  scopeKey,
  lightTheme = false,
  allowResize = true,
  preventLocalOverlap = false,
  onDuplicateObject,
  onRemoveObject,
  onAddSubposition,
}: {
  logicalWidth: number;
  logicalHeight: number;
  objects: WarehouseDepotLayoutObject[];
  selectedObjectId: string | null;
  onSelectedObjectIdChange: (id: string | null) => void;
  onObjectsChange: (objects: WarehouseDepotLayoutObject[]) => void;
  onHistoryCheckpoint: (previousObjects: WarehouseDepotLayoutObject[]) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  scopeKey: string;
  lightTheme?: boolean;
  allowResize?: boolean;
  preventLocalOverlap?: boolean;
  onDuplicateObject?: (
    source: WarehouseDepotLayoutObject,
    copy: WarehouseDepotLayoutObject
  ) => WarehouseDepotLayoutObject;
  onRemoveObject?: (object: WarehouseDepotLayoutObject) => boolean | void;
  onAddSubposition?: (object: WarehouseDepotLayoutObject) => void;
}) {
  const editorRootRef = useRef<HTMLDivElement | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
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
  const zoomRef = useRef(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [spacePan, setSpacePan] = useState(false);
  const [collisionNotice, setCollisionNotice] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    objectId: string; left: number; top: number; cursorX: number; cursorY: number;
  } | null>(null);
  const [sizeDialog, setSizeDialog] = useState<{
    objectId: string; width: string; height: string; error: string | null;
  } | null>(null);
  const panning = mode === 'pan' || spacePan;

  useEffect(() => {
    interactionRef.current = null;
    copiedRef.current = null;
    setView('top');
    setMode('select');
    setZoom(1);
    zoomRef.current = 1;
    setPan({ x: 0, y: 0 });
    setCollisionNotice(null);
    setContextMenu(null);
    setSizeDialog(null);
    onSelectedObjectIdChange(null);
  }, [scopeKey, onSelectedObjectIdChange]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const updateSize = () => {
      const rect = viewport.getBoundingClientRect();
      setViewportSize({ width: rect.width, height: rect.height });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  const fitScale = useMemo(() => {
    if (viewportSize.width <= 0 || viewportSize.height <= 0) return 1;
    const horizontal = Math.max(0.01, (viewportSize.width - 48) / Math.max(1, logicalWidth));
    const vertical = Math.max(0.01, (viewportSize.height - 48) / Math.max(1, logicalHeight));
    return Math.min(horizontal, vertical);
  }, [logicalHeight, logicalWidth, viewportSize.height, viewportSize.width]);

  const effectiveScale = fitScale * zoom;
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  const centerCamera = useCallback(() => {
    zoomRef.current = 1;
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Zoom ancorado ao ponto sob o mouse: preserva o local que o operador
  // esta examinando, sem saltar para o centro a cada giro da roda.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const current = zoomRef.current;
      const next = clamp(+(current + (event.deltaY < 0 ? 0.12 : -0.12)).toFixed(3), ZOOM_MIN, ZOOM_MAX);
      if (next === current) return;
      const bounds = viewport.getBoundingClientRect();
      const cursorX = event.clientX - bounds.left - bounds.width / 2;
      const cursorY = event.clientY - bounds.top - bounds.height / 2;
      const ratio = next / current;
      setPan(previous => ({
        x: previous.x + (cursorX - previous.x) * (1 - ratio),
        y: previous.y + (cursorY - previous.y) * (1 - ratio),
      }));
      zoomRef.current = next;
      setZoom(next);
    };
    viewport.addEventListener('wheel', handleWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', handleWheel);
  }, []);

  // Segurar Espaco: deslocamento temporario sem abandonar a selecao.
  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat || isTextInput(event.target)) return;
      if (event.target instanceof HTMLElement && event.target.closest('button')) return;
      event.preventDefault();
      setSpacePan(true);
    };
    const keyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') setSpacePan(false);
    };
    const blur = () => setSpacePan(false);
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('blur', blur);
    };
  }, []);

  // A altura real varia com fontes e zoom. Medir o menu no portal antes de
  // posiciona-lo evita o salto visual observado ao clicar nas estantes baixas.
  useLayoutEffect(() => {
    if (!contextMenu || !contextMenuRef.current || !editorRootRef.current) return;
    const menu = contextMenuRef.current.getBoundingClientRect();
    const bounds = editorRootRef.current.getBoundingClientRect();
    const width = menu.width;
    const height = menu.height;
    const gap = CONTEXT_MENU_GAP;
    const leftEdge = Math.max(gap, bounds.left + gap);
    const rightEdge = Math.max(leftEdge, Math.min(window.innerWidth - width - gap,
      bounds.right - width - gap));
    const topEdge = Math.max(gap, bounds.top + gap);
    const bottomEdge = Math.max(topEdge, Math.min(window.innerHeight - height - gap,
      bounds.bottom - height - gap));
    const x = contextMenu.cursorX;
    const y = contextMenu.cursorY;
    const horizontal = x + width + gap <= bounds.right ? x + gap
      : x - width - gap >= bounds.left ? x - width - gap : x - width / 2;
    const vertical = y + height + gap <= bounds.bottom && y + height + gap <= window.innerHeight
      ? y + gap
      : y - height - gap >= bounds.top && y - height - gap >= gap
        ? y - height - gap : y - height / 2;
    const left = clamp(horizontal, leftEdge, rightEdge);
    const top = clamp(vertical, topEdge, bottomEdge);
    if (Math.abs(contextMenu.left - left) < 0.5 && Math.abs(contextMenu.top - top) < 0.5)
      return;
    setContextMenu(prev=>prev ? {...prev,left,top} : null);
  }, [contextMenu?.objectId, contextMenu?.cursorX, contextMenu?.cursorY]);

  // Fecha ao clicar fora, rolar, perder foco ou pressionar Escape.
  useEffect(() => {
    if (!contextMenu && !sizeDialog) return;
    const closeOutside = (event: PointerEvent) => {
      if (!contextMenu) return;
      if (event.target instanceof Element && event.target.closest('[data-warehouse-context-menu]')) return;
      setContextMenu(null);
    };
    const closeScroll = () => setContextMenu(null);
    const closeKeys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setContextMenu(null);
        setSizeDialog(null);
      }
    };
    document.addEventListener('pointerdown', closeOutside);
    window.addEventListener('keydown', closeKeys);
    window.addEventListener('resize', closeScroll);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      window.removeEventListener('keydown', closeKeys);
      window.removeEventListener('resize', closeScroll);
    };
  }, [contextMenu, sizeDialog]);

  const selected = useMemo(
    () => objects.find((item) => item.id === selectedObjectId) || null,
    [objects, selectedObjectId]
  );

  const commit = useCallback((next: WarehouseDepotLayoutObject[]) => {
    onHistoryCheckpoint(cloneObjects(objects));
    onObjectsChange(next);
  }, [objects, onHistoryCheckpoint, onObjectsChange]);

  const patchObject = useCallback((
    id: string,
    patch: Partial<WarehouseDepotLayoutObject>,
    withHistory = true
  ) => {
    const next = objects.map((item) => item.id === id ? { ...item, ...patch } : item);
    const changed = next.find(item => item.id === id);
    if (preventLocalOverlap && changed && warehouseLocalHasCollision(changed, next)) {
      setCollisionNotice('Espaço ocupado por outro local. Escolha uma posição livre.');
      return;
    }
    setCollisionNotice(null);
    if (withHistory) commit(next);
    else onObjectsChange(next);
  }, [commit, objects, onObjectsChange, preventLocalOverlap]);

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
    if (preventLocalOverlap) {
      const position = warehouseFindFreePosition(copy, objects, logicalWidth, logicalHeight,
        { x: copy.x, y: copy.y });
      if (!position) {
        setCollisionNotice('Não há espaço livre para duplicar este local no depósito.');
        return;
      }
      copy.x = position.x;
      copy.y = position.y;
    }
    const preparedCopy = onDuplicateObject ? onDuplicateObject(selected, copy) : copy;
    setCollisionNotice(null);
    commit([...objects, preparedCopy]);
    onSelectedObjectIdChange(preparedCopy.id);
  }, [commit, logicalHeight, logicalWidth, objects, onDuplicateObject, onSelectedObjectIdChange, selected, preventLocalOverlap]);

  const removeSelected = useCallback(() => {
    if (!selected) return;
    if (onRemoveObject?.(selected) === false) return;
    commit(objects.filter((item) => item.id !== selected.id));
    onSelectedObjectIdChange(null);
  }, [commit, objects, onRemoveObject, onSelectedObjectIdChange, selected]);

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
    if (preventLocalOverlap) {
      const position = warehouseFindFreePosition(copy, objects, logicalWidth, logicalHeight,
        { x: copy.x, y: copy.y });
      if (!position) {
        setCollisionNotice('Não há espaço livre para colar este local no depósito.');
        return;
      }
      copy.x = position.x;
      copy.y = position.y;
    }
    const preparedCopy = onDuplicateObject ? onDuplicateObject(source, copy) : copy;
    setCollisionNotice(null);
    commit([...objects, preparedCopy]);
    onSelectedObjectIdChange(preparedCopy.id);
  }, [commit, logicalHeight, logicalWidth, objects, onDuplicateObject, onSelectedObjectIdChange, preventLocalOverlap]);

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
        onUndo();
        return;
      }
      if ((modifier && event.key.toLowerCase() === 'y') || (modifier && event.shiftKey && event.key.toLowerCase() === 'z')) {
        event.preventDefault();
        onRedo();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [duplicateSelected, onRedo, onUndo, pasteCopied, removeSelected, selected]);

  const startInteraction = (
    event: React.PointerEvent,
    type: 'move' | 'resize' | 'rotate',
    object: WarehouseDepotLayoutObject
  ) => {
    if (type === 'resize' && !allowResize) return;
    if (event.button !== 0 || view !== 'top' || panning || sizeDialog) return;
    setContextMenu(null);
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
        onHistoryCheckpoint(cloneObjects(
          objects.map((item) => item.id === interaction.objectId ? interaction.startObject! : item)
        ));

        // A rotacao ja foi convertida em largura/profundidade e direcao persistente.
      }
    }
    interactionRef.current = null;
  };

  const rotateObject = (objectId: string, quarters: -1 | 1 | 2) => {
    const target = objects.find(item => item.id === objectId);
    if (!target) return;
    try {
      const rotated = turnWarehouseLayoutObject(target, quarters, logicalWidth, logicalHeight);
      patchObject(target.id, rotated);
    } catch {
      setCollisionNotice('O local não cabe nessa orientação dentro do depósito.');
    }
  };
  const rotateSelected = (quarters: -1 | 1) => {
    if (selected) rotateObject(selected.id, quarters);
  };

  const openSizeDialog = (objectId: string) => {
    const target = objects.find(item => item.id === objectId);
    if (!target) return;
    setContextMenu(null);
    setSizeDialog({
      objectId: target.id,
      width: String(target.width),
      height: String(target.height),
      error: null,
    });
  };

  const saveSizeDialog = () => {
    if (!sizeDialog) return;
    const target = objects.find(item => item.id === sizeDialog.objectId);
    if (!target) { setSizeDialog(null); return; }
    const width = Number(sizeDialog.width);
    const height = Number(sizeDialog.height);
    if (!Number.isFinite(width) || !Number.isFinite(height) ||
        width < MIN_SIZE || height < MIN_SIZE ||
        width > logicalWidth - target.x || height > logicalHeight - target.y) {
      setSizeDialog(prev => prev && {
        ...prev, error: 'Informe medidas de pelo menos 20 cm que caibam no depósito.',
      });
      return;
    }
    const candidate = { ...target, width, height };
    if (preventLocalOverlap && warehouseLocalHasCollision(candidate, objects)) {
      setSizeDialog(prev => prev && {
        ...prev, error: 'As dimensões ocupam o espaço de outro local.',
      });
      return;
    }
    patchObject(target.id, { width, height });
    setSizeDialog(null);
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
    <div ref={editorRootRef} className={`relative min-w-0 max-w-full overflow-hidden rounded-2xl border ${lightTheme ? 'border-slate-200 bg-white shadow-sm' : 'border-white/[0.08] bg-[#050b16]'}`} data-testid="warehouse-layout-professional-editor">
      <div className={`flex min-w-0 flex-wrap items-center justify-between gap-2 border-b px-3 py-2 ${lightTheme ? 'border-slate-200 bg-slate-50' : 'border-white/[0.07] bg-white/[0.025]'}`} data-testid="warehouse-croqui-editor-toolbar">
        <div className="flex flex-wrap items-center gap-1">
          <button type="button" aria-label="Alternar modo de pan" onClick={() => setMode(mode === 'pan' ? 'select' : 'pan')} aria-pressed={mode === 'pan'} className={`rounded-lg border px-2.5 py-2 text-[10px] font-bold transition ${mode === 'pan' ? 'border-[#00288e] bg-[#00288e] text-white shadow-sm' : lightTheme ? 'border-slate-200 bg-white text-slate-600 hover:bg-blue-50' : 'border-white/[0.07] text-slate-300 hover:bg-white/[0.05]'}`}>
            <Hand className="h-3.5 w-3.5" /> <span className="sr-only">Pan</span>
          </button>
          <button type="button" onClick={() => setShowGrid((value) => !value)} aria-pressed={showGrid} className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-[10px] font-bold transition ${showGrid ? 'border-[#00288e] bg-[#00288e] text-white shadow-sm' : lightTheme ? 'border-slate-200 bg-white text-slate-600 hover:bg-blue-50' : 'border-white/[0.07] text-slate-300 hover:bg-white/[0.05]'}`}>
            <Grid3X3 className="h-3.5 w-3.5" /> Grade
          </button>
          {preventLocalOverlap && (
            <span data-testid="warehouse-overlap-protection" className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-800">
              Sem sobreposição de locais
            </span>
          )}
          <button type="button" onClick={() => setSnapEnabled((value) => !value)} aria-pressed={snapEnabled} className={`rounded-lg border px-2.5 py-2 text-[10px] font-bold transition ${snapEnabled ? 'border-[#00288e] bg-[#00288e] text-white shadow-sm' : lightTheme ? 'border-slate-200 bg-white text-slate-600 hover:bg-blue-50' : 'border-white/[0.07] text-slate-300 hover:bg-white/[0.05]'}`}>
            Snap {snapEnabled ? 'on' : 'off'}
          </button>
          <span className="mx-1 h-5 w-px bg-white/[0.07]" />
          <button type="button" aria-label="Desfazer" disabled={!canUndo} onClick={onUndo} className={`rounded-lg p-2 disabled:opacity-30 ${lightTheme ? 'text-slate-500 hover:bg-slate-100' : 'text-slate-400 hover:bg-white/[0.05]'}`}><Undo2 className="h-3.5 w-3.5" /></button>
          <button type="button" aria-label="Refazer" disabled={!canRedo} onClick={onRedo} className={`rounded-lg p-2 disabled:opacity-30 ${lightTheme ? 'text-slate-500 hover:bg-slate-100' : 'text-slate-400 hover:bg-white/[0.05]'}`}><Redo2 className="h-3.5 w-3.5" /></button>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <button type="button" aria-label="Diminuir zoom" onClick={() => setZoom((value) => clamp(value - 0.1, ZOOM_MIN, ZOOM_MAX))} className={`rounded-lg p-2 ${lightTheme ? 'text-slate-500 hover:bg-slate-100' : 'text-slate-400 hover:bg-white/[0.05]'}`}><ZoomOut className="h-3.5 w-3.5" /></button>
          <span className="min-w-16 text-center text-[10px] font-bold text-slate-500">{Math.round(zoom * 100)}% · ajuste</span>
          <button type="button" aria-label="Aumentar zoom" onClick={() => setZoom((value) => clamp(value + 0.1, ZOOM_MIN, ZOOM_MAX))} className={`rounded-lg p-2 ${lightTheme ? 'text-slate-500 hover:bg-slate-100' : 'text-slate-400 hover:bg-white/[0.05]'}`}><ZoomIn className="h-3.5 w-3.5" /></button>
          <span className="mx-1 h-5 w-px bg-white/[0.07]" />
          <button type="button" aria-label="Centralizar croqui e ajustar zoom" onClick={centerCamera} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-slate-600 hover:bg-blue-50"><Crosshair className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={() => setView('top')} aria-pressed={view === 'top'} className={`rounded-lg border px-2.5 py-2 text-[10px] font-bold transition ${view === 'top' ? 'border-[#00288e] bg-[#00288e] text-white shadow-sm' : lightTheme ? 'border-slate-200 bg-white text-slate-600 hover:bg-blue-50' : 'border-white/[0.07] text-slate-300 hover:bg-white/[0.05]'}`}>Vista superior</button>
          <button type="button" onClick={() => setView('perspective')} aria-pressed={view === 'perspective'} className={`rounded-lg border px-2.5 py-2 text-[10px] font-bold transition ${view === 'perspective' ? 'border-[#00288e] bg-[#00288e] text-white shadow-sm' : lightTheme ? 'border-slate-200 bg-white text-slate-600 hover:bg-blue-50' : 'border-white/[0.07] text-slate-300 hover:bg-white/[0.05]'}`}>Perspectiva rápida (2,5D)</button>
        </div>
      </div>

      {collisionNotice && (
        <p role="status" data-testid="warehouse-croqui-collision-alert"
          className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-900">
          {collisionNotice}
        </p>
      )}
      <div
        ref={viewportRef}
        data-testid="warehouse-croqui-editor-viewport"
        className={`relative h-[clamp(440px,62vh,720px)] min-h-[440px] max-w-full overflow-hidden ${panning ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
        onPointerDown={(event) => {
          if (!panning) {
            if (event.target === event.currentTarget) onSelectedObjectIdChange(null);
            return;
          }
          if (event.button !== 0 || sizeDialog) return;
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
          const dx = (event.clientX - interaction.startClientX) / Math.max(0.001, effectiveScale);
          const dy = (event.clientY - interaction.startClientY) / Math.max(0.001, effectiveScale);
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
            const turns = Math.max(-1, Math.min(1, Math.round(delta * 0.6 / ROTATION_STEP)));
            if (turns !== 0) {
              try {
                const updated = turnWarehouseLayoutObject(start, turns, logicalWidth, logicalHeight);
                patchObject(interaction.objectId, updated, false);
              } catch {
                // A estante nao cabe girada. Nao mover nem corromper a planta.
              }
            } else patchObject(interaction.objectId, start, false);
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
            transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${effectiveScale})`,
            backgroundImage: showGrid
              ? lightTheme
                ? 'linear-gradient(rgba(148,163,184,0.20) 1px, transparent 1px),linear-gradient(90deg,rgba(148,163,184,0.20) 1px, transparent 1px)'
                : 'linear-gradient(rgba(148,163,184,0.09) 1px, transparent 1px),linear-gradient(90deg,rgba(148,163,184,0.09) 1px, transparent 1px)'
              : undefined,
            backgroundSize: showGrid ? `${GRID_SIZE}px ${GRID_SIZE}px` : undefined,
            backgroundColor: lightTheme ? '#ffffff' : '#07101f',
            border: lightTheme ? '1px solid rgb(203 213 225)' : '1px solid rgba(148,163,184,0.12)',
            transformStyle: 'preserve-3d',
          }}
        >
          {objects.slice().sort((a, b) => a.layer - b.layer).map((object) => {
            const active = object.id === selectedObjectId;
            const cardLabel = warehouseIsPhysicalLocal(object)
              ? warehouseCroquiCardCode(object.label) : object.label;
            const faces = warehouseObjectFaceLabels(object);
            const edgeStyle = (face: string): React.CSSProperties => {
              if (face === 'y-') return { top: 0, left: '50%', transform: 'translate(-50%,-50%)' };
              if (face === 'y+') return { bottom: 0, left: '50%', transform: 'translate(-50%,50%)' };
              if (face === 'x-') return { left: 0, top: '50%', transform: 'translate(-50%,-50%)' };
              return { right: 0, top: '50%', transform: 'translate(50%,-50%)' };
            };
            const style25d = view === 'perspective' ? perspectiveStyle(object, logicalHeight) : {};
            return (
              <div
                key={object.id}
                data-testid={'warehouse-editor-object-' + object.id}
                className={`absolute select-none rounded-lg border text-left shadow-sm ${active ? 'border-[#00288e] ring-2 ring-blue-200' : lightTheme ? 'border-slate-300' : 'border-slate-500/60'} ${object.visualVariant === 'zone' ? (lightTheme ? 'bg-blue-50/70' : 'bg-slate-500/10') : object.visualVariant === 'outline' ? 'bg-transparent' : (lightTheme ? 'bg-slate-100' : 'bg-slate-700/55')}`}
                style={{
                  left: object.x,
                  top: object.y,
                  width: object.width,
                  height: object.height,
                  zIndex: object.layer + 20,
                  transformOrigin: 'center',
                  ...(view === 'top' ? {} : style25d),
                }}
                onContextMenu={event => {
                  if (view !== 'top' || !warehouseIsPhysicalLocal(object)) return;
                  event.preventDefault();
                  event.stopPropagation();
                  interactionRef.current = null;
                  onSelectedObjectIdChange(object.id);
                  const root = editorRootRef.current;
                  if (!root) return;
                  const bounds = root.getBoundingClientRect();
                  // Coordenadas de viewport. O menu e montado em document.body
                  // para nao herdar transforms/overflow do croqui 2D.
                  const cx = event.clientX;
                  const cy = event.clientY;
                  // Monta junto ao clique e deixa o useLayoutEffect ajustar
                  // pela altura REAL do menu, antes da pintura da tela.
                  setContextMenu({
                    objectId: object.id,
                    cursorX: cx,
                    cursorY: cy,
                    left: cx,
                    top: cy,
                  });
                }}
                onPointerDown={(event) => {
                  if (event.button !== 0) return;
                  if (view !== 'top') {
                    event.stopPropagation();
                    onSelectedObjectIdChange(object.id);
                    return;
                  }
                  startInteraction(event, 'move', object);
                }}
              >
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden px-1.5">
                  <span data-testid={'warehouse-croqui-card-code-'+object.id}
                    className={`block max-w-full truncate text-center font-extrabold tracking-wide ${object.width < 78 ? 'text-[10px]' : 'text-xs'} ${lightTheme ? 'text-slate-800' : 'text-slate-100'}`}>
                    {cardLabel}
                  </span>
                </div>
                <span data-testid={'warehouse-editor-front-'+object.id}
                  title={'Frente voltada para '+faces.frontLabel}
                  aria-label={'Frente de '+object.label+': '+faces.frontLabel}
                  style={edgeStyle(faces.front)}
                  className={`pointer-events-none absolute z-10 rounded border border-white/80 bg-emerald-600 text-white shadow-sm ${active?'px-1.5 py-0.5 text-[9px] font-black':'h-1.5 w-4'}`}>
                  {active ? 'FRENTE' : ''}
                </span>
                {active && (
                  <span data-testid={'warehouse-editor-back-'+object.id}
                    title={'Costas voltadas para '+faces.backLabel}
                    style={edgeStyle(faces.back)}
                    className="pointer-events-none absolute z-10 rounded bg-slate-600 px-1 py-0.5 text-[8px] font-bold text-white">
                    TRÁS
                  </span>
                )}
                {active && view === 'top' && (
                  <>
                    {allowResize && (
                      <button
                        type="button"
                        aria-label="Redimensionar"
                        className="absolute -bottom-2 -right-2 h-4 w-4 cursor-nwse-resize rounded-sm border border-blue-200 bg-blue-400"
                        onPointerDown={(event) => startInteraction(event, 'resize', object)}
                      />
                    )}
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

      <div className={`flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2 ${lightTheme ? 'border-slate-200 bg-slate-50' : 'border-white/[0.07] bg-white/[0.02]'}`}>
        <p className={`text-[9px] ${lightTheme ? 'text-slate-500' : 'text-slate-600'}`}>
          Roda do mouse: zoom · Espaço + arrastar: mover mapa · faixa verde = frente · cinza = costas · planta {logicalWidth}×{logicalHeight} cm · snap {snapEnabled ? 'ativo' : 'livre'}
        </p>
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Girar local 90 graus para esquerda" title="Girar 90° para esquerda"
            disabled={!selected || view !== 'top'} onClick={() => rotateSelected(-1)}
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-slate-600 disabled:opacity-30"><RotateCcw className="h-3.5 w-3.5" /></button>
          <button type="button" aria-label="Girar local 90 graus para direita" title="Girar 90° para direita"
            disabled={!selected || view !== 'top'} onClick={() => rotateSelected(1)}
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-slate-600 disabled:opacity-30"><RotateCw className="h-3.5 w-3.5" /></button>
          <button type="button" disabled={!selected} onClick={duplicateSelected} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[9px] font-bold text-slate-400 hover:bg-white/[0.05] disabled:opacity-30"><Copy className="h-3 w-3" /> Duplicar</button>
          <button type="button" aria-label="Trazer objeto para frente" disabled={!selected} onClick={() => layerShift('front')} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/[0.05] disabled:opacity-30" title="Trazer para frente"><BringToFront className="h-3.5 w-3.5" /></button>
          <button type="button" aria-label="Enviar objeto para trás" disabled={!selected} onClick={() => layerShift('back')} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/[0.05] disabled:opacity-30" title="Enviar para trás"><SendToBack className="h-3.5 w-3.5" /></button>
          <button type="button" aria-label="Remover somente do croqui" disabled={!selected} onClick={removeSelected} className="rounded-lg p-1.5 text-rose-300 hover:bg-rose-400/[0.06] disabled:opacity-30" title="Excluir somente do croqui"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      {contextMenu && view === 'top' && objects.some(o => o.id === contextMenu.objectId) && createPortal((
        <div ref={contextMenuRef} data-warehouse-context-menu data-testid="warehouse-croqui-context-menu"
          role="menu" aria-label="Opções do local"
          style={{ position: 'fixed', left: contextMenu.left, top: contextMenu.top, zIndex: 90 }}
          className="w-[224px] overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 text-slate-800 shadow-xl"
          onContextMenu={event => event.preventDefault()}>
          <p className="px-2 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
            {warehouseCroquiCardCode(
              objects.find(o => o.id === contextMenu.objectId)?.label || ''
            )}
          </p>
          {([
            { label: 'Girar para esquerda', value: -1, icon: <RotateCcw className="h-4 w-4" /> },
            { label: 'Girar para direita', value: 1, icon: <RotateCw className="h-4 w-4" /> },
            { label: 'Meia-volta (180°)', value: 2, icon: <RotateCw className="h-4 w-4" /> },
          ] as const).map(item => (
            <button type="button" role="menuitem" key={item.value}
              data-testid={'warehouse-context-turn-'+item.value}
              onClick={() => { rotateObject(contextMenu.objectId, item.value); setContextMenu(null); }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold hover:bg-blue-50 focus:bg-blue-50">
              {item.icon} {item.label}
            </button>
          ))}
          <div className="my-1 border-t border-slate-100" />
          <button type="button" role="menuitem" data-testid="warehouse-context-edit-size"
            onClick={() => openSizeDialog(contextMenu.objectId)}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold hover:bg-blue-50 focus:bg-blue-50">
            <Ruler className="h-4 w-4" /> Editar tamanho
          </button>
          <button type="button" role="menuitem" data-testid="warehouse-context-add-subposition"
            disabled={!onAddSubposition}
            onClick={() => {
              const object = objects.find(o => o.id === contextMenu.objectId);
              setContextMenu(null);
              if (object) onAddSubposition?.(object);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold hover:bg-blue-50 focus:bg-blue-50 disabled:opacity-40">
            <Layers3 className="h-4 w-4" /> Incluir subposição
          </button>
        </div>
      ), document.body)}

      {sizeDialog && objects.some(o => o.id === sizeDialog.objectId) && createPortal((
        <div data-testid="warehouse-croqui-size-modal"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 px-4"
          onPointerDown={event => { if (event.target === event.currentTarget) setSizeDialog(null); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="warehouse-croqui-size-title"
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 id="warehouse-croqui-size-title" className="text-base font-extrabold">Editar tamanho</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {warehouseCroquiCardCode(objects.find(o => o.id === sizeDialog.objectId)?.label || '')}
                  {' · '}Medidas em centímetros
                </p>
              </div>
              <button type="button" aria-label="Fechar edição de tamanho"
                onClick={() => setSizeDialog(null)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={event => { event.preventDefault(); saveSizeDialog(); }}>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-bold text-slate-700">Comprimento (cm)
                  <input autoFocus type="number" min={MIN_SIZE} step="any" required
                    data-testid="warehouse-size-width" value={sizeDialog.width}
                    onChange={event => setSizeDialog(previous => previous && {
                      ...previous, width: event.target.value, error: null,
                    })}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                </label>
                <label className="text-xs font-bold text-slate-700">Profundidade (cm)
                  <input type="number" min={MIN_SIZE} step="any" required
                    data-testid="warehouse-size-depth" value={sizeDialog.height}
                    onChange={event => setSizeDialog(previous => previous && {
                      ...previous, height: event.target.value, error: null,
                    })}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                </label>
              </div>
              <p className="mt-3 text-[11px] text-slate-500">
                O tamanho altera apenas este local. Nenhum material ou saldo será modificado.
              </p>
              {sizeDialog.error && (
                <p role="alert" className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                  {sizeDialog.error}
                </p>
              )}
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={() => setSizeDialog(null)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700">
                  Cancelar
                </button>
                <button type="submit" data-testid="warehouse-size-save"
                  className="rounded-lg bg-[#00288e] px-4 py-2 text-xs font-extrabold text-white">
                  Aplicar tamanho
                </button>
              </div>
            </form>
          </div>
        </div>
      ), document.body)}
    </div>
  );
}
