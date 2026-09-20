'use client';

import { Building2, Fingerprint, RadioTower, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import styles from './InicioIdentityPanel.module.css';

interface InicioIdentityPanelProps {
  userDisplayName: string;
  workspaceName: string;
  organizationName: string;
  organizationShortName: string | null;
  sectionName: string;
  workspaceUg: string | null;
  isFoundingWorkspace: boolean;
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

function hashUnitSignature(value: string): string {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(index);
  }
  return Math.abs(hash >>> 0).toString(16).toUpperCase().padStart(8, '0').slice(0, 8);
}

export function InicioIdentityPanel({
  userDisplayName,
  workspaceName,
  organizationName,
  organizationShortName,
  sectionName,
  workspaceUg,
  isFoundingWorkspace,
}: InicioIdentityPanelProps) {
  const [dayPhase, setDayPhase] = useState<DayPhase>('neutral');

  useEffect(() => {
    setDayPhase(resolveDayPhase(new Date().getHours()));
  }, []);

  const firstName = userDisplayName.trim().split(/\s+/)[0] || 'Operador';
  const unitKey = workspaceUg || workspaceName || organizationName || 'EMPROVEX';

  const signature = useMemo(
    () => hashUnitSignature(unitKey),
    [unitKey]
  );

  const unitLabel = organizationShortName || organizationName;
  const environmentLabel = isFoundingWorkspace ? 'Workspace fundador' : 'Workspace setorial';

  return (
    <header className={styles.root} data-phase={dayPhase}>
      <div className={styles.kicker}>
        <RadioTower aria-hidden="true" />
        <span>Mapa operacional</span>
        <i aria-hidden="true" />
        <span>{environmentLabel}</span>
      </div>

      <div className={styles.heading}>
        <p>{getGreeting(dayPhase)},</p>
        <h2>{firstName}.</h2>
      </div>

      <p className={styles.description}>
        O ambiente visual representa a operação da unidade ativa em tempo real,
        mantendo a análise detalhada no Painel.
      </p>

      <div className={styles.identityGrid}>
        <div className={styles.identityCard}>
          <span className={styles.identityIcon} aria-hidden="true">
            <Building2 />
          </span>
          <span className={styles.identityCopy}>
            <small>Organização</small>
            <strong>{unitLabel}</strong>
            <em>{organizationShortName ? `${organizationName} · ${sectionName}` : sectionName}</em>
          </span>
        </div>

        <div className={styles.identityCard}>
          <span className={styles.identityIcon} aria-hidden="true">
            <ShieldCheck />
          </span>
          <span className={styles.identityCopy}>
            <small>Ambiente</small>
            <strong>{workspaceName}</strong>
            <em>{workspaceUg ? `UG ${workspaceUg}` : 'UG não informada'}</em>
          </span>
        </div>
      </div>

      <div className={styles.signatureRow}>
        <span className={styles.online}>
          <i aria-hidden="true" />
          EMPROVEX ONLINE
        </span>

        <span className={styles.signature} title="Assinatura visual determinística desta unidade">
          <Fingerprint aria-hidden="true" />
          <span>UNIT {signature}</span>
        </span>

        {isFoundingWorkspace && (
          <span className={styles.founder}>
            NÓ FUNDADOR
          </span>
        )}
      </div>
    </header>
  );
}
