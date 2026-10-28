'use client';

import Image from 'next/image';

import type { InicioOperationalSnapshot, InicioSnapshotStar } from '../domain/homeOperationalSnapshot';
import styles from './InicioCore.module.css';

interface InicioCoreProps {
  snapshot: InicioOperationalSnapshot | null;
  performanceMode: 'full' | 'balanced' | 'static';
  ambientPaused: boolean;
}

function isPriority(star: InicioSnapshotStar): boolean {
  return star.invoicePendingStage !== 'none'
    || star.severity === 'attention'
    || star.severity === 'critical';
}

export function InicioCore({ snapshot, performanceMode, ambientPaused }: InicioCoreProps) {
  // Reaproveita o snapshot econômico existente, sem novas consultas.
  const stars = snapshot?.stars ?? [];
  const commission = stars.filter((star) => star.invoicePendingStage === 'commission');
  const treasury = stars.filter((star) => star.invoicePendingStage === 'treasury');
  const highlights = stars.filter(isPriority).slice(0, 3);
  const noticeCount = snapshot?.alerts.total ?? 0;
  const hasPending = commission.length > 0 || treasury.length > 0 || noticeCount > 0;
  const alertsLabel = snapshot
    ? noticeCount === 0
      ? 'Nenhum aviso pendente'
      : [
          snapshot.alerts.critical && snapshot.alerts.critical + ' crítico(s)',
          snapshot.alerts.attention && snapshot.alerts.attention + ' atenção',
        ].filter(Boolean).join(' · ') || 'Verificar na Central de Avisos'
    : 'Carregando informações operacionais';

  return (
    <div
      className={styles.root}
      data-testid="inicio-logo-core"
      data-inicio-star-exclusion="core"
      data-performance={performanceMode}
      data-ambient-paused={ambientPaused ? 'true' : 'false'}
      tabIndex={0}
      role="group"
      aria-label="EMPROVEX. Passe o cursor ou pressione Tab para consultar pendências e avisos operacionais."
    >
      <div className={styles.visual} aria-hidden="true">
        <span className={styles.aura} />
        <span className={styles.orbitOuter} />
        <span className={styles.orbitInner} />
        <span className={styles.orbitGold}>
          <i className={styles.satelliteOne} />
          <i className={styles.satelliteTwo} />
        </span>
        <span className={styles.float}>
          <Image
            src="/emprovex-logo-core.svg"
            alt=""
            width={500}
            height={500}
            sizes="(max-width: 640px) 150px, 178px"
            className={styles.logo}
            unoptimized
            priority
          />
        </span>
        <span className={styles.reflection} />
      </div>

      <div className={styles.tooltip} role="tooltip">
        <div className={styles.heading}>
          <span className={styles.eyebrow}>CENTRAL OPERACIONAL</span>
          <strong>Pendências e avisos</strong>
          <span className={styles.subheading}>Resumo dos empenhos em destaque</span>
        </div>

        {!snapshot ? (
          <p className={styles.empty}>Os avisos serão exibidos quando o resumo do setor estiver disponível.</p>
        ) : (
          <>
            <div className={styles.summary}>
              <div className={styles.summaryRow}>
                <i className={styles.goldDot} />
                <span>NFs para Comissão</span>
                <strong>{commission.length} <small>empenho(s)</small></strong>
              </div>
              <div className={styles.summaryRow}>
                <i className={styles.blueDot} />
                <span>NFs para Tesouraria</span>
                <strong>{treasury.length} <small>empenho(s)</small></strong>
              </div>
              <div className={styles.summaryRow}>
                <i className={styles.alertDot} />
                <span>Avisos pendentes</span>
                <strong>{noticeCount}</strong>
              </div>
            </div>

            {noticeCount > 0 && <p className={styles.alertNote}>{alertsLabel}</p>}

            {highlights.length > 0 ? (
              <div className={styles.highlights}>
                <span className={styles.highlightsTitle}>Sinais prioritários</span>
                {highlights.map((star) => (
                  <div className={styles.highlight} key={star.id}>
                    <span className={styles.reference}>{star.id}</span>
                    <span className={styles.message}>
                      {star.invoicePendingStage !== 'none'
                        ? star.invoicePendingMessage
                        : star.message}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className={styles.empty}>
                {hasPending
                  ? 'Consulte a Central de Avisos para os demais registros.'
                  : 'Nenhuma pendência em destaque no momento.'}
              </p>
            )}
            <span className={styles.hint}>Consulte as estrelas ou a Central de Avisos para detalhes.</span>
          </>
        )}
      </div>
    </div>
  );
}
