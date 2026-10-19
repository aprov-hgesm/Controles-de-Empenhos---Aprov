'use client';

import { ArrowUpRight, BookOpenCheck, LockKeyhole, ShieldCheck } from 'lucide-react';
import type { AdminCommandSectionId } from './AdminCommandSidebar';
import styles from './AdminCommandPreview.module.css';

/**
 * Migração incremental das capacidades EXISTENTES na main.
 * Não exibir informação inventada nem montar subscriptions globais numa tela
 * que o fundador apenas abriu para navegar. A implementação antiga continua
 * disponível e protegida em /admin?tab=... até adaptação nativa certificada.
 */
export const LEGACY_ADMIN_CAPABILITIES = {
  usage: {
    title: 'Consumo e cotas',
    tab: 'consumo',
    source: 'AdminConsumptionHub',
    features: [
      'Google real: métricas oficiais Cloud Monitoring e atualização',
      'Visão consolidada de consumo, sessões e limites',
      'Consumo por UG e atribuição instrumentada',
      'Histórico diário/semanal/mensal/anual e exportação',
      'Alertas, limites e política de referência',
    ],
  },
  sessions: {
    title: 'Sessões operacionais',
    tab: 'sessoes',
    source: 'AdminSessionsPanel',
    features: [
      'Sessões simultâneas por workspace',
      'Estados ativo/inativo e limite de sessões',
      'Encerramento remoto com confirmação e controle do fundador',
    ],
  },
  backups: {
    title: 'Backups e recuperação',
    tab: 'backups',
    source: 'AdminBackupPanel',
    features: [
      'Estado do backup por workspace e último sucesso',
      'Saúde de proteção e diagnósticos de falhas',
      'Backup de identidades Firebase Auth e recuperação administrativa',
    ],
  },
  security: {
    title: 'Segurança da plataforma',
    tab: 'seguranca',
    source: 'AdminSecurityPanel',
    features: [
      'Isolamento e proteção multi-tenant',
      'Diretório e integridade da identidade de workspaces',
      'Postura de regras Firestore e telemetria',
    ],
  },
  finance: {
    title: 'Faturamento e assinaturas',
    tab: 'assinaturas',
    source: 'AdminBillingPanel',
    features: [
      'Política e configurações de faturamento',
      'Trial e isenções VIP',
      'Status comercial e pagamento manual por competência',
      'Consulta e confirmação de ciclos de cobrança',
    ],
  },
  reports: {
    title: 'Relatórios operacionais',
    tab: 'consumo',
    source: 'AdminUsageReportsPanel',
    features: [
      'Relatórios de consumo com períodos e exportação',
      'Separação de fontes oficiais e estimativas internas',
    ],
  },
  settings: {
    title: 'Configurações comerciais',
    tab: 'assinaturas',
    source: 'AdminBillingPanel',
    features: [
      'Políticas existentes de trial e cobrança',
      'Parâmetros de faturamento administrativo',
      'Controles de alerta de consumo no módulo Consumo e Cotas',
    ],
  },
} as const;

type CapabilityId = keyof typeof LEGACY_ADMIN_CAPABILITIES;

export function AdminLegacyCapabilities({ area }: { area: AdminCommandSectionId }) {
  const known = area in LEGACY_ADMIN_CAPABILITIES;
  const item = known ? LEGACY_ADMIN_CAPABILITIES[area as CapabilityId] : null;
  return <div data-testid={'admin2-capability-' + area} className="space-y-4">
    <section className={styles.sectionCard + ' p-5 sm:p-7'}>
      <p className={styles.sectionEyebrow + ' font-mono uppercase'}>MIGRAÇÃO ADMIN 2.0 · FUNÇÕES PRESERVADAS</p>
      <h2 className="mt-2 text-[18px] font-black text-[#1b375e]">{item?.title || 'Área em implementação'}</h2>
      <p className="mt-2 text-[12px] leading-6 text-[#617b99]">
        {item
          ? 'A função original da Administração atual está operacional e permanece acessível enquanto sua adaptação visual nativa é certificada. Abrir este módulo não dispara leituras globais ou comandos de alteração.'
          : 'Esta área ainda não possui equivalente completo na Administração existente. Será implementada em etapa específica; não há dados demonstrativos apresentados como reais.'}
      </p>
      {item ? <>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {item.features.map(feature=><div key={feature} className="flex items-start gap-2 rounded-xl border border-[#dae6f3] bg-[#f8fbff] px-4 py-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#2c64ab]" aria-hidden="true"/>
            <span className="text-[11px] leading-5 font-semibold text-[#3c587b]">{feature}</span>
          </div>)}
        </div>
        <div className="mt-5 rounded-xl border border-[#cfdeef] bg-[#f1f6fd] px-4 py-4">
          <p className="text-[11px] leading-5 text-[#4e6e90]">O painel original utiliza os mesmos controles de autorização, auditoria, consultas e regras atualmente adotados pela <code className="font-mono">main</code>. Ao abri-lo você sairá temporariamente da prévia. Operações reais só ocorrerão após ações explícitas no painel original.</p>
          <a href={'/admin?tab=' + item.tab} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#1b519c] px-5 py-3 text-[12px] font-bold text-white hover:bg-[#286bb9]">
            <ArrowUpRight className="h-4 w-4" aria-hidden="true"/> Abrir módulo administrativo existente
          </a>
        </div>
      </> : <div className="mt-5 rounded-xl border border-dashed border-[#cbdbea] p-5 text-xs text-[#667e9c]">
        Esta funcionalidade integra o roteiro de evolução da Administração 2.0 e ainda não foi anunciada como concluída.
      </div>}
    </section>
  </div>;
}
