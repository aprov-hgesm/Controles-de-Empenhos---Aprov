'use client';

import {
  CheckCircle2,
  Database,
  FileCheck2,
  Gauge,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  Users,
} from 'lucide-react';

interface AdminSecurityPanelProps {
  directoryReady: boolean;
  workspaceCount: number;
  activeWorkspaceCount: number;
  suspendedWorkspaceCount: number;
  globalUsageConfigured: boolean | null;
}

const safeguards = [
  {
    icon: KeyRound,
    title: 'Acesso administrativo',
    detail:
      'A área permanece protegida pelo perfil fundador/plataforma e pelo gate de contexto administrativo existente.',
  },
  {
    icon: LockKeyhole,
    title: 'Isolamento por workspace',
    detail:
      'UID, workspace e UG continuam sendo os identificadores usados para separar a operação dos setores.',
  },
  {
    icon: FileCheck2,
    title: 'Defesa de documentos',
    detail:
      'A reorganização visual não altera as validações centralizadas de PDF nem as regras de upload já implantadas.',
  },
  {
    icon: Database,
    title: 'Firestore Rules',
    detail:
      'As regras de segurança e o modelo multi-tenant permanecem fora da camada de navegação administrativa.',
  },
];

export function AdminSecurityPanel({
  directoryReady,
  workspaceCount,
  activeWorkspaceCount,
  suspendedWorkspaceCount,
  globalUsageConfigured,
}: AdminSecurityPanelProps) {
  return (
    <div data-testid="admin-security-panel" className="space-y-5">
      <section className="rounded-[2rem] border border-white/[0.08] bg-[#071225]/65 p-5 shadow-[0_22px_70px_rgba(0,8,28,0.18)] backdrop-blur-xl sm:p-6">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl border border-emerald-300/15 bg-emerald-400/[0.07] text-emerald-200">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="font-mono text-[8px] font-bold uppercase tracking-[0.20em] text-emerald-200/60">
              Governança técnica
            </p>
            <h3 className="mt-1 text-xl font-extrabold text-white">
              Segurança e integridade
            </h3>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-400">
              Esta visão reúne os controles já presentes no baseline do
              EMPROVEX. Ela não substitui auditoria de segurança nem declara
              disponibilidade de um serviço externo quando não existe
              telemetria própria para comprová-la.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <StatusCard
          icon={Users}
          label="Diretório administrativo"
          value={directoryReady ? 'Disponível' : 'Atenção'}
          detail={
            workspaceCount
              + ' setores · '
              + activeWorkspaceCount
              + ' ativos · '
              + suspendedWorkspaceCount
              + ' suspensos'
          }
          healthy={directoryReady}
        />
        <StatusCard
          icon={Gauge}
          label="Telemetria Firebase"
          value={
            globalUsageConfigured === false
              ? 'Não configurada'
              : globalUsageConfigured === true
                ? 'Configurada'
                : 'Verificando'
          }
          detail="Métricas globais reais permanecem separadas das estimativas por UG."
          healthy={globalUsageConfigured !== false}
        />
        <StatusCard
          icon={ShieldCheck}
          label="Modelo administrativo"
          value="Fundador"
          detail="Acesso administrativo separado da operação normal dos setores."
          healthy
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {safeguards.map((item) => {
          const Icon = item.icon;
          return (
            <article
              key={item.title}
              className="rounded-3xl border border-white/[0.08] bg-[#071225]/55 p-5 backdrop-blur-xl"
            >
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl border border-blue-300/15 bg-blue-400/[0.06] text-blue-200">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-white">
                    {item.title}
                  </h4>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">
                    {item.detail}
                  </p>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}

function StatusCard({
  icon: Icon,
  label,
  value,
  detail,
  healthy,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  detail: string;
  healthy: boolean;
}) {
  return (
    <article className="rounded-2xl border border-white/[0.08] bg-[#071225]/60 p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.035]">
          <Icon className="h-4 w-4 text-blue-200" />
        </div>
        <span
          className={
            'inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-wide '
            + (healthy
              ? 'border-emerald-300/15 bg-emerald-400/[0.07] text-emerald-200'
              : 'border-amber-300/15 bg-amber-400/[0.07] text-amber-200')
          }
        >
          <CheckCircle2 className="h-3 w-3" />
          {healthy ? 'OK' : 'Verificar'}
        </span>
      </div>
      <p className="mt-4 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-lg font-black text-white">{value}</p>
      <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
        {detail}
      </p>
    </article>
  );
}
