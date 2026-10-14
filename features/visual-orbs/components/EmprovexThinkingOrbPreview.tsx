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
        <span>Somente o núcleo central do Início será colorido; carregamentos usam tinta monocromática conforme o fundo. MIT © Jakub Antalik.</span>
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
              palette="colored"
              surface="dark"
            />
          </div>
          <p>{animation} / {size} / {performance}</p>
          <small>Prévia da futura Home: apenas o estado orbital working usa a paleta branca, amarela e vermelha. Outras animações são monocromáticas.</small>
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
            <EmprovexThinkingOrb size={preset} animation={animation} performance={performance} paused={paused} roundness={roundness} sparkle={sparkle} palette="monochrome" surface="dark" />
            <span>{preset}</span>
          </div>
        ))}
      </section>
      <section className={styles.contrastGrid} aria-label="Contraste monocromático para os carregamentos">
        <div className={styles.contrastDark}>
          <span>FUNDO ESCURO · partículas monocromáticas claras</span>
          <EmprovexThinkingOrb size="large" animation="working" performance={performance}
            paused={paused} roundness={roundness} sparkle={sparkle} palette="monochrome" surface="dark" />
        </div>
        <div className={styles.contrastLight}>
          <span>FUNDO CLARO · partículas monocromáticas escuras</span>
          <EmprovexThinkingOrb size="large" animation="working" performance={performance}
            paused={paused} roundness={roundness} sparkle={sparkle} palette="monochrome" surface="light" />
        </div>
      </section>
      <p className={styles.note}>
        Protótipo de desenvolvimento: nenhum empenho, aviso, tooltip ou comando foi alterado.
        Apenas a prévia do núcleo do Início utiliza cores por velocidade: lentas brancas, rápidas 70% amarelas e 30% vermelhas (arredondamento por partículas inteiras). Os exemplos de carregamento permanecem monocromáticos e contrastam com o fundo.
      </p>
    </main>
  );
}
