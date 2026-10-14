'use client';

import { useState } from 'react';
import {
  EmprovexBorderBeam,
  type EmprovexBeamIntensity,
  type EmprovexBeamTheme,
} from './EmprovexBorderBeam';
import styles from './EmprovexBorderBeamDemo.module.css';

const PRESETS: { intensity: EmprovexBeamIntensity; name: string; note: string }[] = [
  { intensity: 'low', name: 'Baixa', note: 'Recomendada para destaques pontuais.' },
  { intensity: 'medium', name: 'Média', note: 'Somente em contextos de atenção.' },
  { intensity: 'high', name: 'Alta', note: 'Comparação visual; não recomendada para produção.' },
];

/** Only rendered by the development-only route; no operational dependencies. */
export function EmprovexBorderBeamDemo() {
  const [theme, setTheme] = useState<EmprovexBeamTheme>('dark');
  const [active, setActive] = useState(true);
  const [clicks, setClicks] = useState(0);

  return (
    <main className={styles.lab} data-theme={theme} data-testid="border-beam-lab">
      <div className={styles.shell}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>EMPROVEX · VISUAL-R1 · WORKER 4</p>
          <h1>Border Beam / Destaques institucionais</h1>
          <p>Estudo isolado de bordas monocromáticas. Nenhum card operacional foi alterado.</p>
          <div className={styles.controls}>
            <button type="button" aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}>
              Fundo escuro
            </button>
            <button type="button" aria-pressed={theme === 'light'} onClick={() => setTheme('light')}>
              Fundo claro
            </button>
            <button type="button" aria-pressed={!active} onClick={() => setActive((value) => !value)}>
              {active ? 'Pausar destaque' : 'Ativar destaque'}
            </button>
          </div>
        </header>

        <section aria-label="Comparação de intensidades" className={styles.grid}>
          {PRESETS.map((preset) => (
            <EmprovexBorderBeam
              key={preset.intensity}
              intensity={preset.intensity}
              theme={theme}
              active={active}
              variant="travel"
              duration={24}
              borderRadius={18}
              testId={`border-beam-${preset.intensity}`}
            >
              <article className={styles.card}>
                <p className={styles.cardOverline}>INDICADOR · DEMONSTRAÇÃO</p>
                <h2>{preset.name}</h2>
                <p className={styles.metric}>94,8<span>%</span></p>
                <p className={styles.cardNote}>{preset.note}</p>
              </article>
            </EmprovexBorderBeam>
          ))}
        </section>

        <section aria-label="Interação e redução de movimento" className={styles.gridTwo}>
          <EmprovexBorderBeam theme={theme} active={active} variant="focus" intensity="low" borderRadius={14} testId="border-beam-focus">
            <div className={styles.utility}>
              <p>Foco de teclado · sem movimento</p>
              <button type="button" onClick={() => setClicks((value) => value + 1)} data-testid="border-beam-action">
                Ação de demonstração ({clicks})
              </button>
              <small>Tab para selecionar e Enter para acionar. O efeito não intercepta cliques.</small>
            </div>
          </EmprovexBorderBeam>
          <EmprovexBorderBeam theme={theme} active={active} variant="static" intensity="low" reducedMotion borderRadius={14} testId="border-beam-static">
            <div className={styles.utility}>
              <p>Modo estático · movimento reduzido</p>
              <strong>Informação principal sempre legível</strong>
              <small>Indicação visual preservada sem animação, adequada a reduced motion.</small>
            </div>
          </EmprovexBorderBeam>
        </section>
        <footer className={styles.footer}>
          Amostras fictícias, sem conexão com Firebase. Movimento de 24 s; borda de 1 px; sem WebGL.
        </footer>
      </div>
    </main>
  );
}
