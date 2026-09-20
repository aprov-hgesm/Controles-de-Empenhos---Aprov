'use client';

import { useMemo, useState } from 'react';

import type { Alert, Empenho } from '../../../lib/types';
import styles from './InicioConstellation.module.css';

type StarSeverity = 'normal' | 'attention' | 'critical';
type StarStage = 'active' | 'stalled' | 'urgent' | 'closed';

interface ConstellationNode {
  id: string;
  supplier: string;
  supplierKey: string;
  classification: string;
  status: Empenho['status'];
  value: number;
  balance: number;
  receivedPct: number;
  left: number;
  top: number;
  size: number;
  delay: number;
  severity: StarSeverity;
  stage: StarStage;
  message: string;
}

interface InicioConstellationProps {
  empenhos: Empenho[];
  alerts: Alert[];
  onSelectEmpenho: (empenhoId: string) => void;
}

const MAX_VISIBLE_STARS = 72;
const ACTIVE_STAR_BUDGET = 60;
const CLOSED_STAR_BUDGET = MAX_VISIBLE_STARS - ACTIVE_STAR_BUDGET;

function hashValue(value: string, seed = 0): number {
  let hash = 2166136261 ^ seed;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeSupplierKey(empenho: Empenho): string {
  if (empenho.supplierCnpj) return empenho.supplierCnpj.replace(/\D/g, '');
  return empenho.supplier.trim().toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ');
}

function getEmpenhoTotals(empenho: Empenho) {
  return empenho.items.reduce(
    (acc, item) => {
      const total = item.quantity * item.unitPrice;
      const received = Math.min(item.received, item.quantity) * item.unitPrice;
      acc.total += total;
      acc.received += received;
      acc.balance += Math.max(0, item.quantity - item.received) * item.unitPrice;
      return acc;
    },
    { total: 0, received: 0, balance: 0 }
  );
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  }).format(value);
}

function getSeverity(empenho: Empenho, alertsByEmpenho: Map<string, Alert[]>): StarSeverity {
  const linkedAlerts = alertsByEmpenho.get(empenho.id) ?? [];
  if (
    empenho.status === 'Urgente'
    || linkedAlerts.some((alert) => alert.type === 'CRÍTICO' || alert.type === 'ESTOQUE ZERADO')
  ) {
    return 'critical';
  }

  if (
    empenho.status === 'Sem Movimentação'
    || (empenho.lastNFDaysAgo ?? 0) >= 10
    || linkedAlerts.some((alert) => alert.type === 'ATENÇÃO')
  ) {
    return 'attention';
  }

  return 'normal';
}

function getStage(empenho: Empenho): StarStage {
  if (empenho.status === 'Encerrado') return 'closed';
  if (empenho.status === 'Urgente') return 'urgent';
  if (empenho.status === 'Sem Movimentação') return 'stalled';
  return 'active';
}

function getMessage(empenho: Empenho, alertsByEmpenho: Map<string, Alert[]>): string {
  const linked = alertsByEmpenho.get(empenho.id) ?? [];
  const critical = linked.find((alert) => alert.type === 'CRÍTICO' || alert.type === 'ESTOQUE ZERADO');
  if (critical) return critical.subtitle || critical.title || critical.description;

  const attention = linked.find((alert) => alert.type === 'ATENÇÃO');
  if (attention) return attention.subtitle || attention.title || attention.description;

  if (empenho.status === 'Urgente') return 'Empenho marcado como urgente.';
  if (empenho.status === 'Sem Movimentação') return 'Empenho sem movimentação recente.';
  if ((empenho.lastNFDaysAgo ?? 0) >= 10) {
    return `Última nota fiscal registrada há ${empenho.lastNFDaysAgo} dias.`;
  }
  if (empenho.status === 'Encerrado') return 'Empenho encerrado — histórico operacional.';

  return 'Operação sem sinal de atenção ativo.';
}

function getSize(value: number, maxValue: number): number {
  if (value <= 0 || maxValue <= 0) return 3;
  const normalized = Math.log10(value + 1) / Math.log10(maxValue + 1);
  return 3 + normalized * 3.4;
}

function buildNode(
  empenho: Empenho,
  index: number,
  maxValue: number,
  alertsByEmpenho: Map<string, Alert[]>
): ConstellationNode {
  const supplierKey = normalizeSupplierKey(empenho);
  const supplierHashX = hashValue(supplierKey || empenho.id, 101);
  const supplierHashY = hashValue(supplierKey || empenho.id, 211);
  const localHashX = hashValue(empenho.id, 307);
  const localHashY = hashValue(empenho.id, 401);
  const clusterX = 10 + (supplierHashX % 80);
  const clusterY = 10 + (supplierHashY % 78);
  const localX = ((localHashX % 1901) / 1900 - 0.5) * 15;
  const localY = ((localHashY % 1901) / 1900 - 0.5) * 13;
  const totals = getEmpenhoTotals(empenho);

  return {
    id: empenho.id,
    supplier: empenho.supplier,
    supplierKey,
    classification: (empenho.classification || 'QR').trim().toUpperCase(),
    status: empenho.status,
    value: totals.total,
    balance: totals.balance,
    receivedPct: totals.total > 0 ? Math.round((totals.received / totals.total) * 100) : 0,
    left: clamp(clusterX + localX, 4, 96),
    top: clamp(clusterY + localY, 5, 94),
    size: getSize(totals.total, maxValue),
    delay: -((index % 14) * 0.39),
    severity: getSeverity(empenho, alertsByEmpenho),
    stage: getStage(empenho),
    message: getMessage(empenho, alertsByEmpenho),
  };
}

export function InicioConstellation({
  empenhos,
  alerts,
  onSelectEmpenho,
}: InicioConstellationProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const alertsByEmpenho = useMemo(() => {
    const map = new Map<string, Alert[]>();
    alerts.forEach((alert) => {
      if (!alert.empenhoId) return;
      const current = map.get(alert.empenhoId) ?? [];
      current.push(alert);
      map.set(alert.empenhoId, current);
    });
    return map;
  }, [alerts]);

  const nodes = useMemo(() => {
    const severityWeight: Record<StarSeverity, number> = {
      critical: 0,
      attention: 1,
      normal: 2,
    };

    const active = empenhos
      .filter((empenho) => empenho.status !== 'Encerrado')
      .sort((left, right) => {
        const severityDelta =
          severityWeight[getSeverity(left, alertsByEmpenho)]
          - severityWeight[getSeverity(right, alertsByEmpenho)];
        if (severityDelta !== 0) return severityDelta;
        return (right.updatedAt || right.date || '').localeCompare(left.updatedAt || left.date || '');
      })
      .slice(0, ACTIVE_STAR_BUDGET);

    const closed = empenhos
      .filter((empenho) => empenho.status === 'Encerrado')
      .sort((left, right) =>
        (right.updatedAt || right.date || '').localeCompare(left.updatedAt || left.date || '')
      )
      .slice(0, CLOSED_STAR_BUDGET);

    const selected = [...active, ...closed];
    const maxValue = selected.reduce(
      (currentMax, empenho) => Math.max(currentMax, getEmpenhoTotals(empenho).total),
      0
    );

    return selected.map((empenho, index) =>
      buildNode(empenho, index, maxValue, alertsByEmpenho)
    );
  }, [alertsByEmpenho, empenhos]);

  const hoveredNode = hoveredId ? nodes.find((node) => node.id === hoveredId) ?? null : null;

  const relatedNodes = useMemo(() => {
    if (!hoveredNode?.supplierKey) return [];
    return nodes.filter(
      (node) => node.id !== hoveredNode.id && node.supplierKey === hoveredNode.supplierKey
    );
  }, [hoveredNode, nodes]);

  const counts = useMemo(
    () => ({
      regular: nodes.filter((node) => node.severity === 'normal' && node.stage !== 'closed').length,
      attention: nodes.filter((node) => node.severity === 'attention').length,
      critical: nodes.filter((node) => node.severity === 'critical').length,
      closed: nodes.filter((node) => node.stage === 'closed').length,
    }),
    [nodes]
  );

  return (
    <div className={styles.root} aria-label="Constelação operacional de empenhos">
      <svg
        className={styles.relationships}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {hoveredNode && relatedNodes.map((related) => (
          <line
            key={related.id}
            x1={hoveredNode.left}
            y1={hoveredNode.top}
            x2={related.left}
            y2={related.top}
          />
        ))}
      </svg>

      {nodes.map((node) => {
        const isHovered = hoveredId === node.id;
        const isRelated =
          hoveredNode !== null
          && hoveredNode.id !== node.id
          && hoveredNode.supplierKey === node.supplierKey;

        return (
          <button
            key={node.id}
            type="button"
            className={styles.star}
            data-severity={node.severity}
            data-stage={node.stage}
            data-related={isRelated ? 'true' : 'false'}
            data-dimmed={hoveredNode && !isHovered && !isRelated ? 'true' : 'false'}
            style={{
              left: `${node.left}%`,
              top: `${node.top}%`,
              width: node.size,
              height: node.size,
              animationDelay: `${node.delay}s`,
            }}
            onMouseEnter={() => setHoveredId(node.id)}
            onMouseLeave={() => setHoveredId(null)}
            onFocus={() => setHoveredId(node.id)}
            onBlur={() => setHoveredId(null)}
            onClick={() => onSelectEmpenho(node.id)}
            aria-label={`${node.id}. ${node.message}. Abrir empenho.`}
          >
            <span className={styles.halo} aria-hidden="true" />
            <span className={styles.core} aria-hidden="true" />

            <span className={styles.tooltip}>
              <span className={styles.tooltipEyebrow}>
                <i data-severity={node.severity} />
                {node.classification} · {node.status}
              </span>
              <strong>{node.id}</strong>
              <span className={styles.tooltipMessage}>{node.message}</span>
              <span className={styles.tooltipSupplier}>{node.supplier}</span>
              <span className={styles.metrics}>
                <span>
                  <small>Valor</small>
                  <b>{formatCurrency(node.value)}</b>
                </span>
                <span>
                  <small>Saldo</small>
                  <b>{formatCurrency(node.balance)}</b>
                </span>
                <span>
                  <small>Execução</small>
                  <b>{node.receivedPct}%</b>
                </span>
              </span>
              {relatedNodes.length > 0 && isHovered && (
                <em>{relatedNodes.length} outro(s) empenho(s) deste fornecedor</em>
              )}
              <span className={styles.openHint}>Abrir empenho →</span>
            </span>
          </button>
        );
      })}

      <div className={styles.legend} aria-label="Legenda da constelação">
        <span><i data-severity="normal" /> Regular <b>{counts.regular}</b></span>
        <span><i data-severity="attention" /> Atenção <b>{counts.attention}</b></span>
        <span><i data-severity="critical" /> Crítico <b>{counts.critical}</b></span>
        <span><i data-stage="closed" /> Encerrado <b>{counts.closed}</b></span>
        {empenhos.length > nodes.length && (
          <span className={styles.densityNote}>
            {nodes.length} de {empenhos.length} estrelas em primeiro plano
          </span>
        )}
      </div>
    </div>
  );
}

export { MAX_VISIBLE_STARS };
