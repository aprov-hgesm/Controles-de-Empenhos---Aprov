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
  return (
    <main className={styles.page}>
      <header className={styles.heading}>
        <p>EMPROVEX / VISUAL-R1 / WORKER 1</p>
        <h1>Thinking Orbs — partículas originais</h1>
        <span>Canvas 2D · Monocromático · MIT © Jakub Antalik · Sem integração à Home</span>
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
            <EmprovexThinkingOrb size={preset} animation={animation} performance={performance} paused={paused} />
            <span>{preset}</span>
          </div>
        ))}
      </section>
      <p className={styles.note}>
        Protótipo de desenvolvimento: nenhum empenho, aviso, tooltip ou comando foi alterado.
        Use o seletor para comparar os nove estados originais e o desempenho nas diferentes escalas.
      </p>
    </main>
  );
}
