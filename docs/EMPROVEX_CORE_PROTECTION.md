# EMPROVEX — Core Operational Protection

Data de adoção: 2026-09-24.

## Objetivo

Garantir que módulos opcionais, integrações auxiliares ou infraestrutura complementar nunca impeçam as operações canônicas do EMPROVEX.

Princípio:

> O EMPROVEX funciona sozinho. Módulos complementares consomem seu estado; não controlam seu ciclo de vida.

## Incidente que originou o gate

A integração histórica da FASE 4 colocou gravações do ADM Depósito dentro da mesma transação do recebimento de Nota Fiscal. Uma falha/permissão do namespace logístico passou a impedir o cadastro da NF.

O hotfix #184 removeu essa dependência e restaurou o fluxo operacional independente.

## Resultado da auditoria de 2026-09-24

### Confirmado como protegido

- `lib/nsIntegrityService.ts` não importa implementação warehouse;
- criação/edição/exclusão de NF não grava `warehouse/*`;
- Empenhos, Cronogramas e seus serviços críticos não importam warehouse;
- `lib/operationalPaths.ts` não conhece o namespace warehouse;
- Firestore Rules do bloco operacional `workspaces/{workspaceId}/...` não referenciam warehouse;
- telemetria de consumo captura falha internamente e permanece best-effort;
- listeners operacionais são independentes do ADM Depósito.

### Riscos encontrados e tratados nesta proteção

1. **Alerta informativo dentro da transação crítica da NF**
   - risco: regressão/permissão em `alerts` poderia bloquear NF;
   - correção: alerta passa a ser efeito auxiliar após o commit crítico.

2. **Upload do PDF antes do commit da NF**
   - risco: indisponibilidade/autorização do Google Drive poderia impedir a NF;
   - correção: NF é confirmada primeiro; upload e vínculo do PDF acontecem depois e podem ser repetidos.

3. **Shell principal importando implementação warehouse**
   - risco: acoplamento estrutural desnecessário;
   - correção: política de acesso a módulos opcionais passa por `lib/platformModuleAccess.ts`.

4. **Contrato histórico da FASE 4 incentivando acoplamento**
   - risco: desenvolvimento futuro reintroduzir a mesma arquitetura;
   - correção: D-002 e D-033 foram substituídas pelas regras de projeção unidirecional.

### Dívidas compatíveis que permanecem isoladas

- `lib/types.ts` ainda possui campos logísticos opcionais legados;
- `lib/warehouse/invoiceIntegrationService.ts` permanece como implementação histórica/interna do ADM;
- esses elementos não são utilizados pelo lifecycle operacional e ficam protegidos pelo firewall de dependências;
- limpeza/migração destrutiva não deve ocorrer enquanto existirem documentos históricos possivelmente contendo esses campos.

## Estado crítico mínimo

Operações consideradas canônicas:

- criar/editar/excluir Empenho;
- alterar itens e saldos recebidos;
- criar/editar/excluir Nota Fiscal;
- identidade e lock de NS;
- Cronogramas;
- Comissão e fluxos de liquidação já pertencentes ao núcleo;
- autenticação e isolamento do workspace;
- auditoria necessária à integridade.

Essas operações podem depender apenas de serviços classificados como críticos.

## Efeitos auxiliares

São não bloqueantes, salvo decisão futura explicitamente documentada:

- alertas puramente informativos;
- PDF/Google Drive e demais anexos;
- telemetria estimada;
- dashboard derivado;
- projeções do ADM Depósito;
- sincronizações complementares;
- indicadores e cache derivados.

Falha auxiliar deve gerar aviso/reconciliação, nunca rollback de uma operação operacional já confirmada.

## Fronteira EMPROVEX → ADM Depósito

Direção permitida:

`EMPROVEX (fonte canônica) → leitura/projeção → ADM Depósito → warehouse/{workspaceId}/...`

Direções proibidas:

- `ADM → saveInvoice/saveEmpenho/saveAlert/saveCronograma`;
- `ADM → commitInvoice*/removeEmpenho`;
- transação operacional do EMPROVEX escrevendo `warehouse/*`;
- Rules operacionais consultando autorização/estado warehouse;
- ADM exigido para login, carregamento ou uso do EMPROVEX.

## Gates automáticos

### 1. `scripts/verify-emprovex-core-protection.mjs`

Firewall estrutural que valida:

- imports proibidos;
- ausência de estado warehouse no núcleo;
- NF antes de efeitos auxiliares;
- ADM sem comandos de mutação do núcleo;
- Rules operacionais sem warehouse;
- telemetria best-effort;
- shell sem dependência da implementação warehouse.

### 2. Workflow rápido `EMPROVEX Core Protection`

Executa sem `npm ci`, antes da suíte longa:

- Core Operational Firewall;
- isolation guard EMPROVEX/ADM;
- guard da fundação/isolamento do ADM.

### 3. Application CI

Repete o guard dentro da validação completa.

### 4. Firestore Emulator

Mantém cenário real que prova NF + empenho sem escrita warehouse e, a partir desta proteção, sem depender do alerta informativo na transação crítica.

## Política para as FASES restantes do ADM Depósito

A proteção-base é obrigatória **antes** de retomar a FASE 11.

FASE 11:
- somente lê Empenhos, NFs e Cronogramas canônicos;
- escreve alertas/projeções no namespace warehouse;
- não altera Rules operacionais para atender logística;
- não duplica Cronogramas nem recebimento.

FASE 11.5:
- estética/UX; não altera contratos de negócio ou fronteira.

FASE 12:
- ampliar o escudo com testes de falha/chaos controlados:
  - Drive indisponível;
  - warehouse negado;
  - telemetria indisponível;
  - alertas auxiliares negados;
  - APIs opcionais com timeout;
  - confirmação de continuidade dos fluxos críticos.

FASE 13:
- executar validação integrada final e confirmar que desabilitar o ADM Depósito não altera a operacionalidade do EMPROVEX.

## Regra de emergência

Se uma regressão futura colocar o EMPROVEX em risco:

1. preservar o núcleo operacional;
2. desabilitar/isolar a integração opcional responsável;
3. não afrouxar Firestore Rules do núcleo para fazer módulo opcional funcionar;
4. restaurar o fluxo crítico;
5. só então corrigir/reconciliar o módulo complementar.
