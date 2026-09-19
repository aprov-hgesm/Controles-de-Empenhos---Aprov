'use client';

interface AppShellLogoProps {
  customLogo: string | null;
}

export function AppShellLogo({ customLogo }: AppShellLogoProps) {
  return (
    <div className="emprovex-header-logo-core">
      <span className="emprovex-header-logo-core__halo" aria-hidden="true" />
      <span className="emprovex-header-logo-core__ring emprovex-header-logo-core__ring--outer" aria-hidden="true" />
      <span className="emprovex-header-logo-core__ring emprovex-header-logo-core__ring--inner" aria-hidden="true" />
      <span className="emprovex-header-logo-core__axis emprovex-header-logo-core__axis--horizontal" aria-hidden="true" />
      <span className="emprovex-header-logo-core__axis emprovex-header-logo-core__axis--vertical" aria-hidden="true" />

      <div
        className="emprovex-header-logo-core__surface"
        title="Logotipo institucional EMPROVEX"
      >
        <span className="emprovex-header-logo-core__mark">
          {customLogo ? (
            <img src={customLogo} alt="Logo EMPROVEX" className="h-full w-full object-contain" />
          ) : (
            <span
              aria-label="EMPROVEX"
              className="font-montserrat text-[10px] font-black tracking-[0.12em] text-white"
            >
              EMP
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
