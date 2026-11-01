'use client';

import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';

import type { OperationalActiveTab } from '../../lib/operationalSubscriptionPlan';
import styles from './OperationalSurfaceTransition.module.css';
import { useVisualMode } from '../visual-mode/VisualModeProvider';

interface OperationalSurfaceTransitionProps {
  surfaceKey: OperationalActiveTab;
  children: ReactNode;
}

const SURFACE_LABELS: Record<OperationalActiveTab, string> = {
  inicio: 'INÍCIO',
  painel: 'PAINEL',
  empenhos: 'EMPENHOS',
  fornecedores: 'FORNECEDORES',
  itens: 'ITENS',
  nova_nf: 'NOTAS FISCAIS',
  relatorios: 'RELATÓRIOS',
  itens_empenho: 'ITENS DO EMPENHO',
  cronogramas: 'CRONOGRAMAS',
  avisos: 'CENTRAL DE AVISOS',
  eleonor: 'ELEONOR',
};

export function OperationalSurfaceTransition({
  surfaceKey,
  children,
}: OperationalSurfaceTransitionProps) {
  const reduceMotion = useReducedMotion();
  const { mode } = useVisualMode();

  // Essencial: sem motion, filtros, blur, feixe ou labels animados.
  // Não envolve qualquer renderizador da Central 3D.
  if (mode === 'essencial') {
    return (
      <section
        className={styles.root}
        data-surface={surfaceKey}
        data-visual-mode="essencial"
        aria-label={`Superfície operacional: ${SURFACE_LABELS[surfaceKey]}`}
      >
        <div className={styles.content}>{children}</div>
      </section>
    );
  }

  return (
    <motion.section
      key={surfaceKey}
      className={styles.root}
      data-surface={surfaceKey}
      aria-label={`Superfície operacional: ${SURFACE_LABELS[surfaceKey]}`}
      initial={
        reduceMotion
          ? false
          : {
              opacity: 0,
              y: 10,
              scale: 0.995,
              filter: 'blur(3px) saturate(0.92)',
            }
      }
      animate={{
        opacity: 1,
        y: 0,
        scale: 1,
        filter: 'blur(0px) saturate(1)',
      }}
      transition={
        reduceMotion
          ? { duration: 0 }
          : {
              duration: 0.34,
              ease: [0.16, 1, 0.3, 1],
            }
      }
    >
      <span className={styles.entryBeam} aria-hidden="true" />
      <span className={styles.edgeSignal} aria-hidden="true">
        <i />
        <b>{SURFACE_LABELS[surfaceKey]}</b>
      </span>
      <div className={styles.content}>{children}</div>
    </motion.section>
  );
}
