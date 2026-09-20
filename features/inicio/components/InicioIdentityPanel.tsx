'use client';

import { useEffect, useState } from 'react';

import styles from './InicioIdentityPanel.module.css';

interface InicioIdentityPanelProps {
  userDisplayName: string;
}

type DayPhase = 'morning' | 'afternoon' | 'evening' | 'neutral';

function resolveDayPhase(hour: number): DayPhase {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  if (hour >= 18 || hour < 5) return 'evening';
  return 'neutral';
}

function getGreeting(phase: DayPhase): string {
  if (phase === 'morning') return 'Bom dia';
  if (phase === 'afternoon') return 'Boa tarde';
  if (phase === 'evening') return 'Boa noite';
  return 'Bem-vindo';
}

export function InicioIdentityPanel({
  userDisplayName,
}: InicioIdentityPanelProps) {
  const [dayPhase, setDayPhase] = useState<DayPhase>('neutral');

  useEffect(() => {
    setDayPhase(resolveDayPhase(new Date().getHours()));
  }, []);

  const firstName = userDisplayName.trim().split(/\s+/)[0] || 'Operador';

  return (
    <header
      className={styles.root}
      data-testid="inicio-identity"
      data-phase={dayPhase}
    >
      <div className={styles.heading}>
        <p>{getGreeting(dayPhase)},</p>
        <h2>{firstName}.</h2>
      </div>
    </header>
  );
}
