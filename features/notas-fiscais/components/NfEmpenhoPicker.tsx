'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import type { Empenho } from '../../../lib/types';

interface Props {
  empenhos: Empenho[];
  selectedId: string;
  onSelect: (id: string) => void;
}

function simplify(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/**
 * Seletor local (sem novas leituras de rede) com resultados compactos.
 * Mostra apenas o código, o fornecedor e o pregão; a observação extensa
 * da NE não faz parte das opções do dropdown.
 */
export function NfEmpenhoPicker({ empenhos, selectedId, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const inputId = useId();

  const options = useMemo(() => empenhos
    .filter((emp) => emp.status === 'Ativo' || emp.id === selectedId)
    .sort((left, right) => right.id.localeCompare(left.id, 'pt-BR', { numeric: true })),
  [empenhos, selectedId]);

  const selected = empenhos.find((emp) => emp.id === selectedId) || null;
  const matches = useMemo(() => {
    const words = simplify(query).split(/\s+/).filter(Boolean);
    return options.filter((emp) => {
      const searchable = simplify([
        emp.id, emp.supplier, emp.pregao || '',
        emp.supplierCnpj || '', emp.classification || '',
      ].join(' '));
      return words.every((word) => searchable.includes(word));
    });
  }, [options, query]);
  const visible = matches.slice(0, 35);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function closeOnOutside(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', closeOnOutside);
    return () => document.removeEventListener('pointerdown', closeOnOutside);
  }, [open]);

  function choose(id: string) {
    onSelect(id);
    setOpen(false);
    setQuery('');
    setActiveIndex(0);
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((previous) => visible.length ? Math.min(visible.length - 1, previous + 1) : 0);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((previous) => Math.max(0, previous - 1));
    } else if (event.key === 'Enter' && visible[activeIndex]) {
      event.preventDefault();
      choose(visible[activeIndex].id);
    }
  }

  return (
    <div className="relative" ref={rootRef} data-testid="nf-empenho-picker">
      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">
        Nota de empenho vinculada
      </label>
      <button type="button" aria-haspopup="listbox" aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => { setOpen(!open); setQuery(''); setActiveIndex(0); }}
        className="flex w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3 text-left shadow-sm transition hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200">
        <span className="min-w-0 flex-1">
          {selected ? (
            <>
              <span className="block truncate text-sm font-extrabold text-[#00288e]">{selected.id}
                {selected.status !== 'Ativo' && <span className="ml-2 text-xs text-amber-700">Inativo</span>}
              </span>
              <span className="block truncate text-xs font-semibold text-slate-700">{selected.supplier}</span>
              {selected.pregao && selected.pregao !== 'Sem Pregão' && (
                <span className="block truncate text-[11px] text-slate-500">Pregão {selected.pregao}</span>
              )}
            </>
          ) : <span className="text-sm font-medium text-slate-500">Selecione um empenho ativo</span>}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-[#00288e] transition ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {open && (
        <div className="absolute inset-x-0 top-full z-40 mt-2 overflow-hidden rounded-xl border border-blue-200 bg-white shadow-xl"
          data-testid="nf-empenho-picker-list">
          <div className="flex items-center gap-2 border-b border-gray-100 p-3">
            <Search className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
            <input id={inputId} ref={searchRef}
              role="combobox" aria-autocomplete="list" aria-expanded={open}
              aria-controls={listId}
              aria-activedescendant={visible[activeIndex] ? listId + '-' + activeIndex : undefined}
              placeholder="Busque por NE, fornecedor, CNPJ ou pregão…"
              aria-label="Buscar Nota de Empenho"
              value={query} onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }}
              onKeyDown={onInputKeyDown}
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none"
            />
            {query && <button type="button" aria-label="Limpar busca" onClick={() => { setQuery(''); setActiveIndex(0); }}>
              <X className="h-4 w-4 text-slate-500" />
            </button>}
          </div>
          <div role="listbox" id={listId} aria-label="Empenhos disponíveis"
            className="max-h-72 overflow-y-auto overscroll-contain p-1.5">
            {visible.length === 0 && (
              <p className="p-4 text-center text-xs text-slate-500">Nenhum empenho encontrado. Tente outro número ou fornecedor.</p>
            )}
            {visible.map((emp, index) => (
              <button key={emp.id} type="button" role="option"
                id={listId + '-' + index}
                aria-selected={emp.id === selectedId}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(emp.id)}
                className={`flex w-full items-start justify-between gap-2 rounded-lg p-2.5 text-left transition
                  ${index === activeIndex ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-[#00288e]">{emp.id}</span>
                  <span className="block truncate text-xs text-slate-700" title={emp.supplier}>{emp.supplier}</span>
                  <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                    {emp.pregao && emp.pregao !== 'Sem Pregão' ? 'Pregão ' + emp.pregao : 'Sem pregão informado'}
                    {emp.status !== 'Ativo' ? ' · Inativo' : ''}
                  </span>
                </span>
                {emp.id === selectedId && <Check className="mt-1 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />}
              </button>
            ))}
          </div>
          <div className="border-t border-slate-100 px-3 py-2 text-[11px] text-slate-500">
            {matches.length} empenho(s) encontrado(s)
            {matches.length > visible.length ? ' · Exibindo os primeiros 35. Refine a busca.' : ''}
          </div>
        </div>
      )}
    </div>
  );
}
