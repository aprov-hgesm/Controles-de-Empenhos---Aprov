'use client';

import React from 'react';
import { CalendarDays, FileSpreadsheet, FileText, Layers, TrendingUp } from 'lucide-react';

type ActiveTab = 'inicio' | 'painel' | 'empenhos' | 'itens' | 'nova_nf' | 'relatorios' | 'itens_empenho' | 'cronogramas' | 'avisos';

interface MobileNavigationProps {
  activeTab: ActiveTab;
  setActiveTab: React.Dispatch<React.SetStateAction<ActiveTab>>;
  setSelectedEmpenhoDetailId: React.Dispatch<React.SetStateAction<string | null>>;
}

/** Navegação inferior mobile isolada para permitir evolução responsiva sem acoplar o page.tsx. */
export function MobileNavigation({ activeTab, setActiveTab, setSelectedEmpenhoDetailId }: MobileNavigationProps) {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 w-full h-16 flex justify-around items-center bg-white/70 backdrop-blur-md border-t border-white/20 shadow-lg z-30 rounded-t-2xl">
      <button
        onClick={() => setActiveTab('painel')}
        className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
          activeTab === 'painel' ? 'text-[#00288e] font-extrabold' : 'text-gray-400'
        }`}
      >
        <Layers className="w-5 h-5" />
        <span className="text-[10px] mt-0.5">Painel</span>
      </button>

      <button
        onClick={() => { setActiveTab('empenhos'); setSelectedEmpenhoDetailId(null); }}
        className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
          activeTab === 'empenhos' || activeTab === 'itens_empenho' ? 'text-[#00288e] font-extrabold' : 'text-gray-400'
        }`}
      >
        <FileSpreadsheet className="w-5 h-5" />
        <span className="text-[10px] mt-0.5">Empenhos</span>
      </button>

      <button
        onClick={() => setActiveTab('nova_nf')}
        className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
          activeTab === 'nova_nf' ? 'text-[#00288e] font-extrabold' : 'text-gray-400'
        }`}
      >
        <div className="p-2 bg-[#00288e] text-white rounded-xl shadow-md -translate-y-4 scale-110 active:scale-95 duration-100 transition-all border-4 border-white/70 backdrop-blur-sm">
          <FileText className="w-5 h-5" />
        </div>
        <span className="text-[10px] mt-0.5 -translate-y-3.5">Notas Fiscais</span>
      </button>

      <button
        onClick={() => setActiveTab('relatorios')}
        className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
          activeTab === 'relatorios' ? 'text-[#00288e] font-extrabold' : 'text-gray-400'
        }`}
      >
        <TrendingUp className="w-5 h-5" />
        <span className="text-[10px] mt-0.5">Relatórios</span>
      </button>

      <button
        onClick={() => setActiveTab('cronogramas')}
        className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
          activeTab === 'cronogramas' ? 'text-[#00288e] font-extrabold' : 'text-gray-400'
        }`}
      >
        <CalendarDays className="w-5 h-5" />
        <span className="text-[10px] mt-0.5">Cronogramas</span>
      </button>
    </nav>
  );
}
