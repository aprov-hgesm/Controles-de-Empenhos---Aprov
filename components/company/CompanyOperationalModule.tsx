'use client';

import { useCallback } from 'react';
import { auth } from '../../lib/firebase';
import { useCompanySession } from './CompanySessionContext';
import { CompanyOrdersPanel } from '../../features/company/customer-orders/CompanyOrdersPanel';
import { CompanyCommitmentsPanel } from '../../features/company/commitments/CompanyCommitmentsPanel';
import { CompanyCustomersPanel } from '../../features/company/customers/CompanyCustomersPanel';
import { SourceSuppliersWorkspace } from '../../features/company/suppliers/SourceSuppliersWorkspace';
import { CatalogWorkspace } from '../../features/company/catalog/CatalogWorkspace';
import { CompanyPurchasesWorkspace } from '../../features/company/purchases/CompanyPurchasesWorkspace';
import { InventoryWorkspace } from '../../features/company/inventory/InventoryWorkspace';
import { AllocationWorkspace } from '../../features/company/allocation/AllocationWorkspace';
import { FinanceWorkspace } from '../../features/company/finance/FinanceWorkspace';
import { FinanceInsights } from '../../features/company/finance/FinanceInsights';
import { CompanyNeReview } from '../../features/company/documents/CompanyNeReview';
import { CompanyTeamWorkspace } from './CompanyTeamWorkspace';
import { CompanyScheduleWorkspace } from '../../features/company/schedule/CompanyScheduleWorkspace';
import { CompanyDeliveryWorkspace } from '../../features/company/delivery/CompanyDeliveryWorkspace';
import { RoutingWorkspace } from '../../features/company/routing/RoutingWorkspace';
import { companyShellModuleBySlug } from '../../features/company/shell/navigation';

export const COMPANY_ACTIVE_MODULE_SLUGS = [
  'pedidos-om', 'empenhos', 'compras', 'fornecedores', 'catalogo',
  'estoque', 'cronogramas', 'entregas', 'notas-fiscais', 'financeiro', 'clientes', 'configuracoes',
] as const;

export function CompanyOperationalModule({ slug }: { slug: string }) {
  const session = useCompanySession();
  const getIdToken = useCallback(async (): Promise<string> => {
    const user = auth.currentUser;
    if (!user || user.uid !== session?.firebaseUid) throw new Error('Sessão empresarial indisponível');
    return user.getIdToken();
  }, [session?.firebaseUid]);
  const module = companyShellModuleBySlug(slug);
  if (!module) return null;
  let content: React.ReactNode;
  switch (slug) {
    case 'pedidos-om': content = <CompanyOrdersPanel />; break;
    case 'empenhos': content = <div className="space-y-7"><CompanyCommitmentsPanel />
      <CompanyNeReview getIdToken={getIdToken} /></div>; break;
    case 'compras': content = <CompanyPurchasesWorkspace getIdToken={getIdToken} />; break;
    case 'fornecedores': content = <SourceSuppliersWorkspace getIdToken={getIdToken} />; break;
    case 'catalogo': content = <CatalogWorkspace getIdToken={getIdToken} />; break;
    case 'cronogramas': content = <CompanyScheduleWorkspace getIdToken={getIdToken} />; break;
    case 'entregas': content = <div className="space-y-8">
      <CompanyDeliveryWorkspace getIdToken={getIdToken} />
      <section aria-label="Planejamento de rotas" className="border-t border-slate-200 pt-8">
        <RoutingWorkspace getIdToken={getIdToken} />
      </section>
    </div>; break;
    case 'estoque': content = <div className="space-y-7"><InventoryWorkspace getIdToken={getIdToken} />
      <AllocationWorkspace getIdToken={getIdToken} /></div>; break;
    case 'notas-fiscais': content = <FinanceWorkspace getIdToken={getIdToken} />; break;
    case 'financeiro': content = <div className="space-y-7"><FinanceWorkspace getIdToken={getIdToken} />
      <FinanceInsights getIdToken={getIdToken} /></div>; break;
    case 'clientes': content = <CompanyCustomersPanel />; break;
    case 'configuracoes': content = <div className="space-y-7">
      <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-label="Identidade empresarial">
        <h2 className="font-semibold text-slate-900">Workspace verificado</h2>
        <p className="mt-2 text-sm text-slate-600">{session?.companyName}</p>
        <p className="mt-1 break-all text-xs text-slate-500">{session?.workspaceId}</p>
        <p className="mt-1 text-sm text-slate-600">{session?.authorizedEmail}</p>
      </section>
      <CompanyTeamWorkspace getIdToken={getIdToken} />
    </div>; break;
    default: return null;
  }
  return <main id="company-main" tabIndex={-1} className="space-y-6 outline-none">
    <nav aria-label="Localização" className="text-xs text-slate-500">
      <a href="/empresa" className="font-semibold hover:text-blue-700">Início</a>
      <span aria-hidden="true" className="px-2">/</span>
      <span aria-current="page">{module.label}</span>
    </nav>
    <header className="rounded-3xl border border-slate-200 bg-white px-6 py-6">
      <p className="text-xs font-bold uppercase tracking-widest text-blue-700">EMPROVEX Empresas · piloto restrito</p>
      <h1 className="mt-2 text-3xl font-bold text-slate-900">{module.label}</h1>
      <p className="mt-2 max-w-3xl text-sm text-slate-600">{module.description}</p>
      <p className="mt-2 text-xs text-slate-500">Dados exclusivos da empresa autenticada. Funcionalidades sujeitas às permissões e à flag do piloto.</p>
    </header>
    {content}
  </main>;
}
