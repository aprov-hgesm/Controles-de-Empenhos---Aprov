'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import type {
  InicioOperationalSnapshot,
  InicioSnapshotStar,
} from '../domain/homeOperationalSnapshot';
import styles from './InicioConstellation.module.css';

interface ConstellationNode extends InicioSnapshotStar {
  left: number;
  top: number;
  size: number;
  delay: number;
}

interface InicioConstellationProps {
  snapshot: InicioOperationalSnapshot | null;
  onSelectEmpenho: (empenhoId: string) => void;
}

interface StarExclusionZone {
  centerX: number;
  centerY: number;
  radiusX: number;
  radiusY: number;
  percentPerPixelX: number;
  percentPerPixelY: number;
}

const STAR_EXCLUSION_GAP_PX = {
  planet: 38,
  core: 50,
} as const;

const STAR_SEVERITY_GAP_BOOST_PX = {
  normal: 0,
  attention: 10,
  critical: 16,
} as const;

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

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  }).format(value);
}

function getSize(value: number, maxValue: number): number {
  if (value <= 0 || maxValue <= 0) return 3;
  const normalized = Math.log10(value + 1) / Math.log10(maxValue + 1);
  return 3 + normalized * 3.4;
}

function sameExclusionZones(
  left: StarExclusionZone[],
  right: StarExclusionZone[]
): boolean {
  if (left.length !== right.length) return false;

  return left.every((zone, index) => {
    const other = right[index];
    if (!other) return false;
    return (
      Math.abs(zone.centerX - other.centerX) < 0.05
      && Math.abs(zone.centerY - other.centerY) < 0.05
      && Math.abs(zone.radiusX - other.radiusX) < 0.05
      && Math.abs(zone.radiusY - other.radiusY) < 0.05
      && Math.abs(zone.percentPerPixelX - other.percentPerPixelX) < 0.001
      && Math.abs(zone.percentPerPixelY - other.percentPerPixelY) < 0.001
    );
  });
}

function keepStarClearOfExclusions(
  node: ConstellationNode,
  zones: StarExclusionZone[]
): ConstellationNode {
  if (zones.length === 0) return node;

  let left = node.left;
  let top = node.top;
  const boostPx = STAR_SEVERITY_GAP_BOOST_PX[node.severity];

  for (let pass = 0; pass < 4; pass += 1) {
    zones.forEach((zone, zoneIndex) => {
      const radiusX = zone.radiusX + boostPx * zone.percentPerPixelX;
      const radiusY = zone.radiusY + boostPx * zone.percentPerPixelY;
      let dx = left - zone.centerX;
      let dy = top - zone.centerY;
      let normalizedDistance =
        (dx * dx) / (radiusX * radiusX)
        + (dy * dy) / (radiusY * radiusY);

      if (normalizedDistance >= 1) return;

      if (normalizedDistance < 0.0001) {
        const angle =
          ((hashValue(node.id, 509 + zoneIndex) % 360) * Math.PI) / 180;
        dx = Math.cos(angle) * radiusX * 0.3;
        dy = Math.sin(angle) * radiusY * 0.3;
        normalizedDistance =
          (dx * dx) / (radiusX * radiusX)
          + (dy * dy) / (radiusY * radiusY);
      }

      const scale = 1.08 / Math.sqrt(Math.max(normalizedDistance, 0.0001));
      left = clamp(zone.centerX + dx * scale, 4, 96);
      top = clamp(zone.centerY + dy * scale, 5, 94);
    });
  }

  return {
    ...node,
    left,
    top,
  };
}

function buildNode(
  star: InicioSnapshotStar,
  index: number,
  maxValue: number
): ConstellationNode {
  const supplierHashX = hashValue(star.supplierKey || star.id, 101);
  const supplierHashY = hashValue(star.supplierKey || star.id, 211);
  const localHashX = hashValue(star.id, 307);
  const localHashY = hashValue(star.id, 401);
  const clusterX = 10 + (supplierHashX % 80);
  const clusterY = 10 + (supplierHashY % 78);
  const localX = ((localHashX % 1901) / 1900 - 0.5) * 15;
  const localY = ((localHashY % 1901) / 1900 - 0.5) * 13;

  return {
    ...star,
    left: clamp(clusterX + localX, 4, 96),
    top: clamp(clusterY + localY, 5, 94),
    size: getSize(star.value, maxValue),
    delay: -((index % 14) * 0.39),
  };
}

export function InicioConstellation({
  snapshot,
  onSelectEmpenho,
}: InicioConstellationProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [exclusionZones, setExclusionZones] = useState<StarExclusionZone[]>([]);

  useEffect(() => {
    const root = rootRef.current;
    const scene = root?.closest('[data-testid="inicio-scene"]') as HTMLElement | null;
    if (!root || !scene) return;

    let frame = 0;

    const measure = () => {
      frame = 0;
      const rootRect = root.getBoundingClientRect();
      if (rootRect.width <= 0 || rootRect.height <= 0) return;

      const percentPerPixelX = 100 / rootRect.width;
      const percentPerPixelY = 100 / rootRect.height;
      const nextZones = Array.from(
        scene.querySelectorAll<HTMLElement>('[data-inicio-star-exclusion]')
      ).map((element) => {
        const rect = element.getBoundingClientRect();
        const kind =
          element.dataset.inicioStarExclusion === 'core' ? 'core' : 'planet';
        const gap = STAR_EXCLUSION_GAP_PX[kind];

        return {
          centerX:
            ((rect.left + rect.width / 2 - rootRect.left) / rootRect.width) * 100,
          centerY:
            ((rect.top + rect.height / 2 - rootRect.top) / rootRect.height) * 100,
          radiusX: (rect.width / 2 + gap) * percentPerPixelX,
          radiusY: (rect.height / 2 + gap) * percentPerPixelY,
          percentPerPixelX,
          percentPerPixelY,
        };
      });

      setExclusionZones((current) =>
        sameExclusionZones(current, nextZones) ? current : nextZones
      );
    };

    const scheduleMeasure = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(measure);
    };

    const observer = new ResizeObserver(scheduleMeasure);
    observer.observe(root);
    observer.observe(scene);
    scene
      .querySelectorAll<HTMLElement>('[data-inicio-star-exclusion]')
      .forEach((element) => observer.observe(element));

    scheduleMeasure();
    const settleTimer = window.setTimeout(scheduleMeasure, 900);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.clearTimeout(settleTimer);
      observer.disconnect();
    };
  }, []);

  const nodes = useMemo(() => {
    const stars = snapshot?.stars ?? [];
    const maxValue = stars.reduce(
      (currentMax, star) => Math.max(currentMax, star.value),
      0
    );

    return stars
      .map((star, index) => buildNode(star, index, maxValue))
      .map((node) => keepStarClearOfExclusions(node, exclusionZones));
  }, [exclusionZones, snapshot]);

  const hoveredNode = hoveredId
    ? nodes.find((node) => node.id === hoveredId) ?? null
    : null;

  const relatedNodes = useMemo(() => {
    if (!hoveredNode?.supplierKey) return [];
    return nodes.filter(
      (node) => node.id !== hoveredNode.id && node.supplierKey === hoveredNode.supplierKey
    );
  }, [hoveredNode, nodes]);

  const counts = useMemo(
    () => ({
      regular: nodes.filter(
        (node) => node.severity === 'normal' && node.stage !== 'closed'
      ).length,
      attention: nodes.filter((node) => node.severity === 'attention').length,
      critical: nodes.filter((node) => node.severity === 'critical').length,
      closed: nodes.filter((node) => node.stage === 'closed').length,
    }),
    [nodes]
  );

  const totalEmpenhos = snapshot?.metrics.totalEmpenhos ?? 0;

  return (
    <div
      ref={rootRef}
      className={styles.root}
      data-testid="inicio-constellation"
      aria-label="Constelação operacional de empenhos"
    >
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
              <span className={styles.tooltipMessage}>
                <small>{node.severity === 'normal' ? 'Situação' : 'Pendência identificada'}</small>
                {node.message}
              </span>
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

      <div
        className={styles.legend}
        data-testid="inicio-constellation-legend"
        aria-label="Legenda da constelação"
      >
        <span><i data-severity="normal" /> Regular <b>{counts.regular}</b></span>
        <span><i data-severity="attention" /> Atenção <b>{counts.attention}</b></span>
        <span><i data-severity="critical" /> Crítico <b>{counts.critical}</b></span>
        <span><i data-stage="closed" /> Encerrado <b>{counts.closed}</b></span>
        {totalEmpenhos > nodes.length && (
          <span className={styles.densityNote}>
            {nodes.length} de {totalEmpenhos} estrelas em primeiro plano
          </span>
        )}
      </div>
    </div>
  );
}
