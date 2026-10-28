'use client';

import type { InicioOperationalSnapshot } from '../domain/homeOperationalSnapshot';
import { useInicioPerformanceProfile } from '../hooks/useInicioPerformanceProfile';
import { InicioAtmosphere } from './InicioAtmosphere';
import { InicioConstellation } from './InicioConstellation';
import { InicioCore } from './InicioCore';
import { InicioEntrySequence } from './InicioEntrySequence';
import { InicioIdentityPanel } from './InicioIdentityPanel';
import { InicioSceneChrome } from './InicioSceneChrome';
import styles from './InicioView.module.css';

interface InicioViewProps {
  snapshot: InicioOperationalSnapshot | null;
  userDisplayName: string;
  onSelectEmpenho: (empenhoId: string) => void;
}

export function InicioView({ snapshot, userDisplayName, onSelectEmpenho }: InicioViewProps) {
  const { mode: performanceMode, ambientPaused } = useInicioPerformanceProfile();

  return (
    <section
      className={styles.scene}
      data-testid="inicio-scene"
      data-ready="true"
      data-snapshot={snapshot ? 'ready' : 'empty'}
      data-performance={performanceMode}
      data-ambient-paused={ambientPaused ? 'true' : 'false'}
      data-lean-home="true"
      aria-label="Início EMPROVEX"
    >
      <InicioEntrySequence />
      <InicioAtmosphere />
      <InicioSceneChrome />
      <div className={styles.ambientGlow} aria-hidden="true" />
      <div className={styles.texture} aria-hidden="true" />
      <div className={styles.grid} aria-hidden="true" />

      <InicioConstellation
        snapshot={snapshot}
        onSelectEmpenho={onSelectEmpenho}
      />

      <InicioIdentityPanel userDisplayName={userDisplayName} />

      <div className={styles.system} data-testid="inicio-system">
        <InicioCore
          snapshot={snapshot}
          performanceMode={performanceMode}
          ambientPaused={ambientPaused}
        />
      </div>

      {!snapshot && (
        <div className={styles.snapshotNotice} role="status">
          <strong>Seu painel está pronto para começar</strong>
          <span>
            À medida que o setor cadastrar empenhos e notas fiscais, os avisos
            operacionais aparecerão ao passar o cursor sobre o logotipo.
          </span>
        </div>
      )}
    </section>
  );
}
