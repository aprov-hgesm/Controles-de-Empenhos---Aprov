'use client';

import type { ChangeEvent, MouseEvent } from 'react';
import { Camera, Loader2, Menu, X } from 'lucide-react';

interface AppHeaderProps {
  customLogo: string | null;
  syncing: boolean;
  userDisplayName: string;
  onOpenSidebar: () => void;
  onLogoUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveLogo: (event: MouseEvent) => void;
}

export function AppHeader({
  customLogo,
  syncing,
  userDisplayName,
  onOpenSidebar,
  onLogoUpload,
  onRemoveLogo,
}: AppHeaderProps) {
  return (
    <header className="bg-white/70 backdrop-blur-md border-b border-white/30 shadow-sm fixed top-0 w-full h-16 z-40 flex justify-between items-center px-6 transition-all duration-300">
      <div className="flex items-center gap-4">
        <button
          onClick={onOpenSidebar}
          className="lg:hidden text-[#00288e] p-1.5 hover:bg-blue-50/50 rounded-lg active:scale-95 duration-150 transition-all"
          id="menu-toggle-btn"
        >
          <Menu className="w-6 h-6" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="relative group">
            <label
              className="w-8 h-8 rounded-lg bg-[#00288e] text-white flex items-center justify-center font-extrabold text-xs tracking-wider shadow-xs flex-shrink-0 font-montserrat cursor-pointer overflow-hidden p-1 hover:ring-2 hover:ring-blue-400 transition-all block"
              title="Clique para alterar o logotipo da plataforma"
            >
              {customLogo ? (
                <img src={customLogo} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <span>EMP</span>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={onLogoUpload}
                className="hidden"
              />
            </label>

            <label
              className="absolute -bottom-1 -right-1 p-0.5 bg-white text-[#00288e] border border-blue-200 rounded-full shadow-xs cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-50 flex items-center justify-center"
              title="Upload de logotipo"
            >
              <Camera className="w-2.5 h-2.5" />
              <input
                type="file"
                accept="image/*"
                onChange={onLogoUpload}
                className="hidden"
              />
            </label>

            {customLogo && (
              <button
                type="button"
                onClick={onRemoveLogo}
                className="absolute -top-1 -right-1 p-0.5 bg-rose-500 text-white rounded-full shadow-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-600 flex items-center justify-center"
                title="Restaurar logotipo padrão"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            )}
          </div>

          <div className="flex flex-col">
            <h1 className="font-extrabold text-base sm:text-lg text-[#00288e] tracking-wider uppercase font-montserrat leading-none">
              EMPROVEX
            </h1>
            <span className="text-[9px] sm:text-[10px] font-bold text-gray-500 tracking-wider uppercase font-montserrat mt-0.5">
              Gestão Logística e Financeira
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {syncing && (
          <div role="status" aria-live="polite" className="flex items-center gap-1 text-xs font-semibold text-blue-600 animate-pulse bg-blue-50/70 backdrop-blur-sm px-3 py-1 rounded-full">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Sincronizando...
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-700 hidden md:inline">
            {userDisplayName}
          </span>
        </div>
      </div>
    </header>
  );
}
