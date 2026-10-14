'use client';

import React from 'react';
import beamStyles from './OperationalNavigationBeam.module.css';
import { CalendarDays, FileSpreadsheet, FileText, Layers, TrendingUp } from 'lucide-react';

type ActiveTab = 'inicio' | 'painel' | 'empenhos' | 'fornecedores' | 'itens' | 'nova_nf' | 'relatorios' | 'itens_empenho' | 'cronogramas' | 'avisos';

interface MobileNavigationProps {
  activeTab: ActiveTab;
  setActiveTab: React.Dispatch<React.SetStateAction<ActiveTab>>;
  setSelectedEmpenhoDetailId: React.Dispatch<React.SetStateAction<string | null>>;
}

/** Navegação inferior mobile isolada para permitir evolução responsiva sem acoplar o page.tsx. */
export function MobileNavigation({ activeTab, setActiveTab, setSelectedEmpenhoDetailId }: MobileNavigationProps) {
  return (
    <nav aria-label="Navegação rápida" className="lg:hidden fixed bottom-0 left-0 w-full h-16 flex justify-around items-center bg-white/70 backdrop-blur-md border-t border-white/20 shadow-lg z-30 rounded-t-2xl">
      <button
        onClick={() => setActiveTab('painel')}
        data-active={activeTab === 'painel' ? 'true' : 'false'}
        className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${beamStyles.mobileItem} ${
          activeTab === 'painel' ? 'text-[#00288e] font-extrabold' : 'text-gray-400'
        }`}
      >
        <span className={beamStyles.beam} data-emprovex-nav-beam="true" aria-hidden="true" />
        <Layers className="w-5 h-5" />
        <span className="text-[10px] mt-0.5">Painel</span>
      </button>

      <button
        onClick={() => { setActiveTab('empenhos'); setSelectedEmpenhoDetailId(null); }}
        data-active={activeTab === 'empenhos' || activeTab === 'itens_empenho' ? 'true' : 'false'}
        className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${beamStyles.mobileItem} ${
          activeTab === 'empenhos' || activeTab === 'itens_empenho' ? 'text-[#00288e] font-extrabold' : 'text-gray-400'
        }`}
      >
        <span className={beamStyles.beam} data-emprovex-nav-beam="true" aria-hidden="true" />
        <FileSpreadsheet className="w-5 h-5" />
        <span className="text-[10px] mt-0.5">Empenhos</span>
      </button>

      <button
        onClick={() => setActiveTab('nova_nf')}
        data-active={activeTab === 'nova_nf' ? 'true' : 'false'}
        className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${beamStyles.mobileItem} ${
          activeTab === 'nova_nf' ? 'text-[#00288e] font-extrabold' : 'text-gray-400'
        }`}
      >
        <span className={beamStyles.beam} data-emprovex-nav-beam="true" aria-hidden="true" />
        <div className="p-2 bg-[#00288e] text-white rounded-xl shadow-md -translate-y-4 scale-110 active:scale-95 duration-100 transition-all border-4 border-white/70 backdrop-blur-sm">
          <FileText className="w-5 h-5" />
        </div>
        <span className="text-[10px] mt-0.5 -translate-y-3.5">Notas Fiscais</span>
      </button>

      <button
        onClick={() => setActiveTab('relatorios')}
        data-active={activeTab === 'relatorios' ? 'true' : 'false'}
        className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${beamStyles.mobileItem} ${
          activeTab === 'relatorios' ? 'text-[#00288e] font-extrabold' : 'text-gray-400'
        }`}
      >
        <span className={beamStyles.beam} data-emprovex-nav-beam="true" aria-hidden="true" />
        <TrendingUp className="w-5 h-5" />
        <span className="text-[10px] mt-0.5">Relatórios</span>
      </button>

      <button
        onClick={() => setActiveTab('cronogramas')}
        data-active={activeTab === 'cronogramas' ? 'true' : 'false'}
        className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${beamStyles.mobileItem} ${
          activeTab === 'cronogramas' ? 'text-[#00288e] font-extrabold' : 'text-gray-400'
        }`}
      >
        <span className={beamStyles.beam} data-emprovex-nav-beam="true" aria-hidden="true" />
        <CalendarDays className="w-5 h-5" />
        <span className="text-[10px] mt-0.5">Cronogramas</span>
      </button>
    </nav>
  );
}
