'use client';

import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';

import styles from './InicioEntrySequence.module.css';

const STORAGE_KEY = 'emprovex.home.cinematic-intro.v1';

export function InicioEntrySequence() {
  const reduceMotion = useReducedMotion();
  const [mode, setMode] = useState<'full' | 'short' | 'hidden'>('hidden');

  useEffect(() => {
    if (reduceMotion) {
      setMode('short');
      return;
    }

    try {
      const seen = sessionStorage.getItem(STORAGE_KEY) === 'seen';
      setMode(seen ? 'short' : 'full');
      if (!seen) sessionStorage.setItem(STORAGE_KEY, 'seen');
    } catch {
      setMode('short');
    }
  }, [reduceMotion]);

  if (mode === 'hidden') return null;

  if (mode === 'short') {
    return (
      <motion.div
        aria-hidden="true"
        className={`${styles.root} ${styles.short}`}
        initial={{ opacity: 0.32 }}
        animate={{ opacity: 0 }}
        transition={{ duration: reduceMotion ? 0.08 : 0.34, ease: [0.22, 1, 0.36, 1] }}
      />
    );
  }

  return (
    <motion.div
      aria-hidden="true"
      className={styles.root}
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      transition={{ duration: 0.44, delay: 1.05, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        className={styles.aperture}
        initial={{ scaleY: 1 }}
        animate={{ scaleY: 0 }}
        transition={{ duration: 0.92, delay: 0.42, ease: [0.16, 1, 0.3, 1] }}
      />

      <div className={styles.beam} />

      <motion.div
        className={styles.copy}
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: [0, 1, 1, 0], y: [10, 0, 0, -8], scale: [0.98, 1, 1, 1.02] }}
        transition={{ duration: 1.25, times: [0, 0.2, 0.72, 1], ease: 'easeOut' }}
      >
        <span>EMPROVEX</span>
        <strong>Mapa operacional</strong>
        <small>Sincronizando constelação da unidade</small>
      </motion.div>

      <motion.div
        className={styles.pulse}
        initial={{ scale: 0.15, opacity: 0.75 }}
        animate={{ scale: 4.8, opacity: 0 }}
        transition={{ duration: 1.05, delay: 0.28, ease: [0.16, 1, 0.3, 1] }}
      />
    </motion.div>
  );
}
