'use client';

import type { ChangeEvent, MouseEvent } from 'react';
import { Camera, X } from 'lucide-react';

interface AppShellLogoProps {
  customLogo: string | null;
  onLogoUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveLogo: (event: MouseEvent) => void;
}

export function AppShellLogo({
  customLogo,
  onLogoUpload,
  onRemoveLogo,
}: AppShellLogoProps) {
  return (
    <div className="emprovex-header-logo-core group">
      <span className="emprovex-header-logo-core__halo" aria-hidden="true" />
      <span className="emprovex-header-logo-core__ring emprovex-header-logo-core__ring--outer" aria-hidden="true" />
      <span className="emprovex-header-logo-core__ring emprovex-header-logo-core__ring--inner" aria-hidden="true" />
      <span className="emprovex-header-logo-core__axis emprovex-header-logo-core__axis--horizontal" aria-hidden="true" />
      <span className="emprovex-header-logo-core__axis emprovex-header-logo-core__axis--vertical" aria-hidden="true" />

      <label
        className="emprovex-header-logo-core__surface"
        title="Clique para alterar o logotipo da plataforma"
      >
        <span className="emprovex-header-logo-core__mark">
          {customLogo ? (
            <img src={customLogo} alt="Logo EMPROVEX" className="h-full w-full object-contain" />
          ) : (
            <span className="font-montserrat text-[10px] font-black tracking-[0.12em] text-white">
              EMP
            </span>
          )}
        </span>
        <input
          type="file"
          accept="image/*"
          onChange={onLogoUpload}
          className="hidden"
          aria-label="Selecionar logotipo da plataforma"
        />
      </label>

      <label
        className="emprovex-header-logo-core__upload"
        title="Alterar logotipo"
      >
        <Camera className="h-2.5 w-2.5" />
        <input
          type="file"
          accept="image/*"
          onChange={onLogoUpload}
          className="hidden"
          aria-label="Selecionar logotipo da plataforma"
        />
      </label>

      {customLogo && (
        <button
          type="button"
          onClick={onRemoveLogo}
          className="emprovex-header-logo-core__remove"
          title="Restaurar logotipo padrão"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  );
}
