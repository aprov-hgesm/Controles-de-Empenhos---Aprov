'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, ArrowRight, ChevronLeft, ChevronRight,
  Compass, Droplets, Home, Minus, Plus, Radio, RotateCcw, Sparkles, Users,
} from 'lucide-react';
import type { PlatformAccount } from '../../lib/platformIdentity';
import type { AdminWorkspaceSession } from '../../lib/platformAdminSessions';
import type { FirebaseGlobalUsageSnapshot } from '../../lib/platformCapacity';
import {
  buildNeighborhoodResidents, neighborhoodPages, neighborhoodQuota,
} from '../../lib/adminNeighborhoodModel.mjs';
import { AdminWorldScene } from './AdminWorldScene';
import styles from './AdminWorldHomePanel.module.css';

interface Props {
  accounts: PlatformAccount[];
  sessions: AdminWorkspaceSession[];
  loadingDirectory: boolean;
  directoryError: string | null;
  loadingSessions: boolean;
  sessionsError: string | null;
  globalUsage: FirebaseGlobalUsageSnapshot | null;
  globalUsageDataThrough: string | null;
  loadingGlobalUsage: boolean;
}

const count = (value: number) => new Intl.NumberFormat('pt-BR').format(value);
const ratio = (value: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value) + '%';

export function AdminWorldHomePanel({
  accounts, sessions, loadingDirectory, directoryError, loadingSessions, sessionsError,
  globalUsage, globalUsageDataThrough, loadingGlobalUsage,
}: Props) {
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [angle, setAngle] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [now, setNow] = useState(() => Date.now());

  // Read-only local clock for expiring session leases; no database polling.
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const sessionsAvailable = !loadingSessions && !sessionsError;
  const residents = useMemo(() => buildNeighborhoodResidents(accounts, sessions, {
    now, sessionsAvailable,
  }), [accounts, sessions, now, sessionsAvailable]);
  const block = useMemo(() => neighborhoodPages(residents, page), [residents, page]);
  const selected = residents.find((resident) => resident.id === selectedId) || null;
  const online = residents.filter((resident) => resident.presence === 'online').length;
  const quota = neighborhoodQuota(globalUsage);
  const hasDirectory = !loadingDirectory && !directoryError;
  const isKnown = quota.known && !loadingGlobalUsage;
  const totalPages = block.pageCount;

  const goPage = (nextPage: number) => {
    setPage(Math.max(0, Math.min(totalPages - 1, nextPage)));
    setSelectedId(null);
  };
  const lastSeen = selected?.lastSeenAt && Number.isFinite(Date.parse(selected.lastSeenAt))
    ? new Date(selected.lastSeenAt).toLocaleString('pt-BR') : 'Não informada';

  return (
    <section className={styles.worldRoot} data-testid="admin-world-home-panel"
      aria-label="Início: bairro digital administrativo">
      <div className={styles.worldHeader}>
        <div className={styles.headerCopy}>
          <div className={styles.eyebrow}><Sparkles size={14} /> EMPROVEX / DIGITAL DISTRICT · 01</div>
          <h3>Um universo em movimento<span>.</span></h3>
          <p>Uma representação visual dos acessos à plataforma e do consumo de leitura do Firestore.
            Cada casa corresponde a uma conta real. As luzes acendem quando há sessão monitorada válida.</p>
        </div>
        <div className={styles.headerPills}>
          <span><span className={styles.pulseDot}/> {sessionsAvailable ? 'Presença monitorada' : 'Presença indisponível'}</span>
          <span><Compass size={14}/> Vista isométrica</span>
        </div>
      </div>

      <div className={styles.statGrid} aria-label="Dados da vizinhança">
        <div className={styles.statCard}>
          <span className={styles.statIcon}><Home size={16}/></span>
          <div><p>Residências digitais</p><strong>{hasDirectory ? count(residents.length) : '—'}</strong>
            <small>uma por conta cadastrada</small></div>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statIcon}><Radio size={16}/></span>
          <div><p>Com luzes acesas</p><strong>{hasDirectory && sessionsAvailable ? count(online) : '—'}</strong>
            <small>sessões ainda válidas</small></div>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statIcon}><Users size={16}/></span>
          <div><p>Quarteirão exibido</p><strong>{block.page + 1} <span>/ {totalPages}</span></strong>
            <small>até 9 residências por vista</small></div>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statIcon}><Droplets size={16}/></span>
          <div><p>Reservatório Firestore</p><strong>{isKnown ? ratio(quota.percentage!) : '—'}</strong>
            <small>leitura / referência diária</small></div>
        </div>
      </div>

      <div className={styles.sceneryArea}>
        <div className={styles.scenery}>
          <AdminWorldScene
            residents={block.displayed}
            selectedId={selected?.id || null}
            onSelect={setSelectedId}
            waterLevel={isKnown ? quota.waterLevel : 0}
            waterKnown={isKnown}
            waterExceeded={quota.exceeded}
            viewAngle={angle}
            zoom={zoom}
          />
          <div className={styles.sceneWaterCard} aria-live="polite">
            <p><Droplets size={13}/> RESERVATÓRIO GLOBAL</p>
            <strong>{isKnown ? ratio(quota.percentage!) : 'SEM DADOS'}</strong>
            <div className={styles.waterTrack}><span style={{width: (isKnown ? quota.waterLevel * 100 : 0) + '%'}} /></div>
            <small>{!isKnown ? 'Aguardando medição do Google'
              : quota.exceeded ? 'Acima da referência diária'
                : 'Proporção da referência diária de Read Units'}</small>
          </div>
          <div className={styles.sceneCaption}>
            <span className={styles.captionStar}>✦</span> EXPLORER MODE
            <span> · </span> Quarteirão {block.page + 1}
          </div>
          {!hasDirectory && <div className={styles.emptyNotice}>
            {loadingDirectory ? 'Carregando cadastro de usuários...' : 'Não foi possível consultar o diretório de usuários.'}
          </div>}
          {hasDirectory && residents.length === 0 && <div className={styles.emptyNotice}>Nenhuma conta cadastrada para representar.</div>}
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.toolsLeft} role="group" aria-label="Controles da câmera">
          <span className={styles.toolLabel}>EXPLORAR</span>
          <button type="button" aria-label="Girar bairro à esquerda" title="Girar à esquerda"
            onClick={() => setAngle((a) => Math.max(-12, a-4))}><ArrowLeft size={16}/></button>
          <button type="button" aria-label="Girar bairro à direita" title="Girar à direita"
            onClick={() => setAngle((a) => Math.min(12, a+4))}><ArrowRight size={16}/></button>
          <span className={styles.toolDivider}/>
          <button type="button" aria-label="Afastar câmera" title="Afastar"
            onClick={() => setZoom((z) => Math.max(.83, Math.round((z-.07)*100)/100))}><Minus size={16}/></button>
          <button type="button" aria-label="Aproximar câmera" title="Aproximar"
            onClick={() => setZoom((z) => Math.min(1.18, Math.round((z+.07)*100)/100))}><Plus size={16}/></button>
          <button type="button" aria-label="Restaurar câmera" title="Restaurar"
            onClick={() => {setAngle(0);setZoom(1);}}><RotateCcw size={16}/></button>
        </div>
        <div className={styles.toolsRight} role="group" aria-label="Navegação por quarteirões">
          <span>Quarteirão {block.page + 1} de {totalPages}</span>
          <button type="button" aria-label="Quarteirão anterior" disabled={block.page === 0}
            onClick={() => goPage(block.page - 1)}><ChevronLeft size={17}/></button>
          <button type="button" aria-label="Próximo quarteirão" disabled={block.page >= totalPages - 1}
            onClick={() => goPage(block.page + 1)}><ChevronRight size={17}/></button>
        </div>
      </div>

      <div className={styles.worldFooter}>
        <div className={styles.legend}>
          <p className={styles.footerLabel}>COMO LER O BAIRRO</p>
          <div className={styles.legendItems}>
            <span><i className={styles.lit}/> Casa iluminada · sessão válida</span>
            <span><i className={styles.dark}/> Casa escura · sem sessão</span>
            <span><i className={styles.unknown}/> Cinza · dados indisponíveis</span>
          </div>
          <p className={styles.finePrint}>“Ativo” indica lease de sessão não expirado, não presença humana em tempo real.
            Cota exibida é referência diária de leitura, não limite de bloqueio nem valor da fatura.
            {!sessionsAvailable && ' Sessões indisponíveis: nenhuma casa é considerada offline com segurança.'}
            {' '}Medição do Google: {globalUsageDataThrough
              ? new Date(globalUsageDataThrough).toLocaleString('pt-BR')
              : 'sem horário confirmado'}.</p>
          {(directoryError || sessionsError) && <p className={styles.errorLine}>{directoryError || sessionsError}</p>}
        </div>
        <div className={styles.selectedCard} aria-live="polite">
          <p className={styles.footerLabel}>RESIDÊNCIA SELECIONADA</p>
          {selected ? (
            <>
              <strong>{selected.label}</strong>
              <span className={styles.selectedEmail}>{selected.email}</span>
              <div className={styles.selectedStatus}>
                <i className={selected.presence === 'online' ? styles.lit : selected.presence === 'unknown' ? styles.unknown : styles.dark} />
                {selected.presence === 'online' ? 'Sessão válida'
                  : selected.presence === 'unknown' ? 'Presença indisponível'
                    : selected.presence === 'disabled' ? 'Conta suspensa' : 'Sem sessão válida'}
              </div>
              <small>{selected.kind === 'admin' ? 'Administrador' : 'Usuário de setor'}
                {selected.ug ? ' · UG ' + selected.ug : ''} · Último registro: {lastSeen}</small>
            </>
          ) : (
            <span className={styles.selectHint}>Selecione uma casa no mapa para visualizar a conta correspondente.</span>
          )}
        </div>
      </div>
    </section>
  );
}
