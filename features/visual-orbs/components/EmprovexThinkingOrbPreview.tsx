'use client';

import { useState } from 'react';
import {
  EmprovexThinkingOrb,
  type ThinkingOrbPerformance,
  type ThinkingOrbSize,
} from './EmprovexThinkingOrb';
import type { OrbState } from '../vendor/thinking-orbs/types';
import styles from './EmprovexThinkingOrbPreview.module.css';

const ANIMATIONS: OrbState[] = [
  'working', 'searching', 'solving', 'listening', 'connecting',
  'weaving', 'composing', 'breathing', 'shaping',
];

export function EmprovexThinkingOrbPreview() {
  const [animation, setAnimation] = useState<OrbState>('working');
  const [size, setSize] = useState<ThinkingOrbSize>('hero');
  const [performance, setPerformance] = useState<ThinkingOrbPerformance>('full');
  const [interactive, setInteractive] = useState(true);
  const [paused, setPaused] = useState(false);
  const [roundness, setRoundness] = useState(0.72);
  const [sparkle, setSparkle] = useState(0.68);
  return (
    <main className={styles.page}>
      <header className={styles.heading}>
        <p>EMPROVEX / VISUAL-R1 / WORKER 1</p>
        <h1>Thinking Orbs — partículas originais</h1>
        <span>Canvas 2D · Branco / amarelo / vermelho · MIT © Jakub Antalik · Sem integração à Home</span>
      </header>
      <section className={styles.layout} aria-label="Área de comparação visual">
        <div className={styles.stage}>
          <div className={styles.orb}>
            <EmprovexThinkingOrb
              size={size}
              performance={performance}
              animation={animation}
              interactive={interactive}
              paused={paused}
              roundness={roundness}
              sparkle={sparkle}
            />
          </div>
          <p>{animation} / {size} / {performance}</p>
          <small>Passe o ponteiro sobre as partículas (modo full) para reação sutil.</small>
        </div>
        <form className={styles.controls} onSubmit={(event) => event.preventDefault()}>
          <label>
            Estado nativo
            <select value={animation} onChange={(event) => setAnimation(event.target.value as OrbState)}>
              {ANIMATIONS.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <label>
            Escala
            <select value={size} onChange={(event) => setSize(event.target.value as ThinkingOrbSize)}>
              {(['hero', 'large', 'medium', 'small', 'mini'] as const).map((name) =>
                <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <label>
            Perfil
            <select value={performance} onChange={(event) => setPerformance(event.target.value as ThinkingOrbPerformance)}>
              {(['full', 'balanced', 'static'] as const).map((name) =>
                <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <label>
            Esfericidade · {Math.round(roundness * 100)}%
            <input type="range" min="0" max="1" step="0.05" value={roundness}
              disabled={animation !== 'working'}
              onChange={(event) => setRoundness(Number(event.target.value))} />
          </label>
          <label>
            Cintilação · {Math.round(sparkle * 100)}%
            <input type="range" min="0" max="1" step="0.05" value={sparkle}
              disabled={animation !== 'working'}
              onChange={(event) => setSparkle(Number(event.target.value))} />
          </label>
          <label className={styles.check}>
            <input type="checkbox" checked={interactive} onChange={(event) => setInteractive(event.target.checked)} />
            Reação sutil ao ponteiro
          </label>
          <label className={styles.check}>
            <input type="checkbox" checked={paused} onChange={(event) => setPaused(event.target.checked)} />
            Pausar
          </label>
        </form>
      </section>
      <section className={styles.samples} aria-label="Amostras nas dimensões de interface">
        {(['large', 'medium', 'small', 'mini'] as const).map((preset) => (
          <div className={styles.sample} key={preset}>
            <EmprovexThinkingOrb size={preset} animation={animation} performance={performance} paused={paused} roundness={roundness} sparkle={sparkle} />
            <span>{preset}</span>
          </div>
        ))}
      </section>
      <section className={styles.contrastGrid} aria-label="Verificação de contraste em superfícies claras e escuras">
        <div className={styles.contrastDark}>
          <span>SUPERFÍCIE ESCURA · orb transparente</span>
          <EmprovexThinkingOrb size="large" animation="working" performance={performance}
            paused={paused} roundness={roundness} sparkle={sparkle} />
        </div>
        <div className={styles.contrastLight}>
          <span>SUPERFÍCIE CLARA · orb sobre grafite fosco</span>
          <EmprovexThinkingOrb size="large" animation="working" performance={performance}
            paused={paused} roundness={roundness} sparkle={sparkle} contrastSurface="matte" />
        </div>
      </section>
      <p className={styles.note}>
        Protótipo de desenvolvimento: nenhum empenho, aviso, tooltip ou comando foi alterado.
        Partículas rápidas recebem cores determinísticas em proporção 70/30 aproximada pela contagem inteira; partículas lentas brancas. Nos controles 0% o desenho estrutural volta à geometria original, mantendo a paleta colorida aprovada.
      </p>
    </main>
  );
}
