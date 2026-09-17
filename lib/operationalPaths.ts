import {
  collection,
  doc,
  type CollectionReference,
  type DocumentReference,
} from 'firebase/firestore';

import { auth, db } from './firebase';
import {
  isOperationalSectorContext,
  resolveWorkspaceContext,
  type ResolvedWorkspaceContext,
} from './workspaceContext';

export type OperationalCollectionName =
  | 'empenhos'
  | 'alerts'
  | 'invoices'
  | 'comissoes'
  | 'cronogramas';

export interface OperationalDataScope {
  workspaceId: string;
  legacyDataMode: boolean;
  legacySettingsMode: boolean;
}

/**
 * Após o cutover do HGeSM, o runtime normal não aceita mais scopes legados.
 * Os dados raiz permanecem disponíveis apenas por ferramentas de manutenção,
 * auditoria e recuperação executadas fora do frontend operacional.
 */
function assertWorkspaceScopedRuntime(context: ResolvedWorkspaceContext): void {
  if (!isOperationalSectorContext(context)) return;

  if (context.legacyDataMode || context.legacySettingsMode) {
    throw new Error(
      'Compatibilidade legada bloqueada no runtime operacional. Execute recuperação por procedimento administrativo controlado.'
    );
  }
}

export function operationalScopeFromContext(
  context: ResolvedWorkspaceContext
): OperationalDataScope {
  if (!isOperationalSectorContext(context)) {
    throw new Error('O contexto atual não possui acesso operacional a um workspace.');
  }

  assertWorkspaceScopedRuntime(context);

  return {
    workspaceId: context.workspaceId,
    legacyDataMode: context.legacyDataMode,
    legacySettingsMode: context.legacySettingsMode,
  };
}

/**
 * Resolve o workspace operacional da sessão Firebase atual antes de qualquer write.
 * O UID esperado evita que uma ação iniciada por uma sessão antiga seja reaproveitada
 * depois de uma troca de conta no navegador.
 */
export function getCurrentOperationalScope(expectedUid?: string): OperationalDataScope {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Não existe sessão Firebase ativa para executar esta operação.');
  }

  if (expectedUid && currentUser.uid !== expectedUid) {
    throw new Error('A sessão Firebase mudou antes da conclusão da operação.');
  }

  return operationalScopeFromContext(resolveWorkspaceContext(currentUser.email));
}

/**
 * Bloco 13: o legado permanece apenas para compatibilidade/recuperação.
 * Qualquer write iniciado pelo runtime normal deve ser workspace-scoped.
 * Estas travas também protegem chamadas construídas manualmente com um scope.
 */
export function assertWorkspaceScopedDataWrite(scope: OperationalDataScope): void {
  if (scope.legacyDataMode) {
    throw new Error(
      'Escrita operacional bloqueada: coleções legadas são somente leitura. Use o workspace ativo.'
    );
  }
}

export function assertWorkspaceScopedSettingsWrite(scope: OperationalDataScope): void {
  if (scope.legacySettingsMode) {
    throw new Error(
      'Escrita de settings bloqueada: settings operacionais legados são somente leitura. Use o workspace ativo.'
    );
  }
}

export function getOperationalCollectionPath(
  scope: OperationalDataScope,
  collectionName: OperationalCollectionName
): string {
  return scope.legacyDataMode
    ? collectionName
    : `workspaces/${scope.workspaceId}/${collectionName}`;
}

export function getOperationalDocumentPath(
  scope: OperationalDataScope,
  collectionName: OperationalCollectionName,
  documentId: string
): string {
  return `${getOperationalCollectionPath(scope, collectionName)}/${documentId}`;
}

/**
 * Settings operacionais possuem um eixo de migração independente das coleções.
 * Isso permite mover contadores/configurações por workspace antes de redirecionar
 * empenhos, NFs, alertas, comissões e cronogramas.
 */
export function getOperationalSettingsCollectionPath(scope: OperationalDataScope): string {
  return scope.legacySettingsMode
    ? 'settings'
    : `workspaces/${scope.workspaceId}/settings`;
}

export function getOperationalSettingsDocumentPath(
  scope: OperationalDataScope,
  documentId: string
): string {
  return `${getOperationalSettingsCollectionPath(scope)}/${documentId}`;
}

export function operationalCollectionRef(
  scope: OperationalDataScope,
  collectionName: OperationalCollectionName
): CollectionReference {
  return collection(db, getOperationalCollectionPath(scope, collectionName));
}

export function operationalDocRef(
  scope: OperationalDataScope,
  collectionName: OperationalCollectionName,
  documentId: string
): DocumentReference {
  assertWorkspaceScopedDataWrite(scope);
  return doc(db, getOperationalCollectionPath(scope, collectionName), documentId);
}

export function operationalSettingsDocRef(
  scope: OperationalDataScope,
  documentId: string
): DocumentReference {
  assertWorkspaceScopedSettingsWrite(scope);
  return doc(db, getOperationalSettingsCollectionPath(scope), documentId);
}
