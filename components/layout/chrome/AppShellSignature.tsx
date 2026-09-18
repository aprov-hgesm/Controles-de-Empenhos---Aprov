interface AppShellSignatureProps {
  variant: 'header' | 'sidebar';
}

export function AppShellSignature({ variant }: AppShellSignatureProps) {
  if (variant === 'header') {
    return (
      <div className="emprovex-shell-signature emprovex-shell-signature--header" aria-hidden="true">
        <svg
          className="emprovex-shell-signature__network"
          viewBox="0 0 520 64"
          preserveAspectRatio="none"
          focusable="false"
        >
          <path d="M18 43 L104 43 L142 23 L236 23 L270 40 L354 40 L389 18 L501 18" />
          <path d="M78 14 L126 14 L159 33 L212 33" />
          <circle cx="18" cy="43" r="2.4" />
          <circle cx="142" cy="23" r="2.4" />
          <circle cx="270" cy="40" r="2.4" />
          <circle cx="389" cy="18" r="2.4" />
          <circle cx="501" cy="18" r="2.4" />
        </svg>

        <div className="emprovex-shell-signature__codes emprovex-shell-signature__codes--header">
          <span>NE</span>
          <span>NF</span>
          <span>TR</span>
          <span>LIQ</span>
          <span>EXEC</span>
        </div>
      </div>
    );
  }

  return (
    <div className="emprovex-shell-signature emprovex-shell-signature--sidebar" aria-hidden="true">
      <svg
        className="emprovex-shell-signature__network"
        viewBox="0 0 288 620"
        preserveAspectRatio="none"
        focusable="false"
      >
        <path d="M228 26 L228 92 L194 125 L194 224 L236 264 L236 350 L208 382 L208 520" />
        <path d="M46 168 L82 168 L103 190 L103 286 L128 312" />
        <path d="M162 72 L187 72 L203 88" />
        <circle cx="228" cy="92" r="3" />
        <circle cx="194" cy="224" r="3" />
        <circle cx="236" cy="350" r="3" />
        <circle cx="208" cy="520" r="3" />
        <circle cx="103" cy="286" r="3" />
        <circle cx="128" cy="312" r="3" />
      </svg>

      <div className="emprovex-shell-signature__codes emprovex-shell-signature__codes--sidebar">
        <span className="emprovex-shell-signature__code emprovex-shell-signature__code--ne">NE / PROV</span>
        <span className="emprovex-shell-signature__code emprovex-shell-signature__code--nf">NF / REC</span>
        <span className="emprovex-shell-signature__code emprovex-shell-signature__code--tr">TR / COM</span>
        <span className="emprovex-shell-signature__code emprovex-shell-signature__code--liq">LIQ / EXEC</span>
      </div>
    </div>
  );
}
