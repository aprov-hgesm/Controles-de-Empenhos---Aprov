# EMPROVEX — Auditoria de funcionalidades ADMIN da main e continuidade Admin 2.0

**Data:** 2026-10-18
**Fonte de código inspecionada:** branch \`main\`, especialmente \`app/admin/page.tsx\`, \`components/admin/PlatformAdminView.tsx\`, \`components/admin/AdminCreateSectorPanel.tsx\`, \`EditSectorModal.tsx\`, \`AdminBillingPanel.tsx\`, \`AdminConsumptionHub.tsx\`, \`AdminSessionsPanel.tsx\`, \`AdminBackupPanel.tsx\`, \`AdminSecurityPanel.tsx\` e os hooks/serviços importados.
**Branch de evolução:** \`feat/admin2-w01-sidebar-local-preview\`, PR #339 DRAFT.
**Premissa:** não remover funcionalidades pré-existentes; não duplicar assinaturas \`onSnapshot\`, credenciais nem motores de domínio; o novo shell V3 preserva desenho aprovado.

## 1. Inventário completo das oito áreas do painel atual

| Funcionalidade real da main | Origem atual | Integração Admin 2.0 | Estado funcional |
|---|---|---|---|
| Visão geral: totais workspace ativo/suspenso, sessões, alertas | \`PlatformAdminView\` | Novo dashboard visual V3 | **Apenas visual; indicadores ainda demonstrativos**; migrar dados reais com leituras limitadas |
| Lista de setores / workspaces, status, pesquisa, UG, e-mail | \`PlatformAdminView\`, \`usePlatformAdminDirectory\` | \`Workspaces\` e \`Clientes\` com diretório real paginado, Ficha 360° | **Nativo read-only**; os filtros novos são prefixo de nome, UG exata ou ID; não têm ainda busca universal da main |
| Edição nome/OM/sigla/seção, UG legado sem vínculo | \`EditSectorModal\`, \`updateSectorWorkspaceProfile\` | \`Gestão do cliente → Editar dados do workspace\` | **Nativo em prévia** (rascunho local; transação auditada **somente no Emulator demo-***). Respeitar ID, UG já vinculada e e-mail imutáveis |
| Criar setor, conta Firebase, UG/index, trial 30 dias | \`AdminCreateSectorPanel\`, \`provision-sector\` | \`Cadastrar cliente + workspace\` | **Prévia local** + backend preparado para incluir perfil comercial no commit. Ainda sem provisionamento Auth+Firestore E2E de homologação |
| Ciclo de vida operacional: suspender/reativar, exclusão protegida | \`usePlatformAdminDirectory\`, \`sector-lifecycle\`, \`delete-sector\` | Seção Segurança/Acesso na Gestão (ainda bloqueada); atalho para \`/admin?tab=setores\` | **Operacional apenas no painel da main**; não acionar mudanças reais do laboratório |
| Redefinir senha do setor | \`reset-sector-password\`, \`EditSectorModal\` | Gestão: botão ainda desabilitado, original acessível em \`/admin?tab=setores\` | **Operacional apenas no painel da main**; não expor credenciais na UI de prévia |
| Consumo global Google, cota diária, observação e diagnósticos | \`AdminConsumptionHub\`, \`AdminGlobalUsagePanel\` | \`Consumo e cotas\` + ponte explícita \`/admin?tab=consumo\` | **Operacional no legado, adaptação visual nativa pendente** |
| Consumo por UG, consolidação com sessões e limites | \`AdminUsagePanel\`, \`AdminConsolidatedUsagePanel\` | \`Consumo e cotas\` | Ponte para módulo existente; preservar proveniência dos dados e economia Firestore |
| Histórico e relatórios diário/semanal/mensal/anual, exportação | \`AdminUsageReportsPanel\` | \`Indicadores\` + ponte para Consumo | Ponte; painel novo ainda não gera relatórios nativos |
| Alertas e limites de consumo, política de notificação | \`AdminConsumptionHub\`, \`usePlatformAdminUsageAlertPolicy\` | \`Consumo e cotas\` | Ponte existente sem alterar as políticas atuais |
| Sessões por workspace e encerramento remoto | \`AdminSessionsPanel\`, \`usePlatformAdminSessions\` | \`Sessões\` → \`/admin?tab=sessoes\` | **Original operacional**, nova interface ainda sem painel nativo |
| Assinaturas: política de trial, preço, isenção VIP, status | \`AdminBillingPanel\`, \`usePlatformAdminBilling\` | \`Financeiro\` abre Gestão do cliente; atalho para \`/admin?tab=assinaturas\` | **Gestão simulada no localhost / persistência só Emulator**; painel completo legado permanece operacional |
| Ciclos por competência: confirmar, reabrir, dispensar, anotar | \`AdminBillingPanel\`, \`setBillingCycleStatus\` | Ficha 360 traz histórico paginado de ciclos (read-only); painel antigo mantém mutations | **Visualização nativa parcial**, ações ainda no legado |
| Saúde dos backups por workspace, diagnóstico e ações de recuperação | \`AdminBackupPanel\`, \`usePlatformAdminBackups\` | \`Backups\` → \`/admin?tab=backups\` | **Original operacional**, layout nativo pendente |
| Proteção das contas Auth/fundador e backup de identidades | \`useFounderAuthBackup\`, \`auth-backup\` | \`Backups\` | Ponte para painel original, preservando autorização server-side |
| Segurança, isolamento, diretório, Rules e telemetria | \`AdminSecurityPanel\` | \`Segurança\` → \`/admin?tab=seguranca\` | **Original operacional**, read-only/diagnóstico; interface nova pendente |
| Retornar ao perfil operacional, logout | \`PlatformAdminView\` / \`app/admin/page.tsx\` | Por enquanto o painel original mantém ações de sessão; Admin 2.0 permanece em rota de laboratório | **Ainda não migrado nativamente**; nunca copiar rotina que contorne auth |

## 2. Áreas novas que NÃO constam como módulos equivalentes completos na main

- **Atendimento/CRM, Pendências, Auditoria global, Configurações unificadas:** Admin 2.0 contém local na navegação e, quando não há motor correspondente, mostra **estado não implementado**. Não criar endpoints ou estatísticas falsas.
- **Indicadores comerciais, churn, MRR, clientes comerciais:** dependem de dados reais próprios da futura coleção e agregações com fontes/corte temporal. O dashboard atual da prévia é demonstrativo.
- **Acesso administrativo a registros operacionais externos, Central de Depósitos de terceiros, arquivos Google Drive de outros usuários:** **fora do escopo/deferidos**; não criar permissões de superadministrador cross-tenant.

## 3. Implementado neste marco

- \`lib/admin2/customers/workspaceProfileEditContract.ts\`: função pura de inicialização, validação e projeção das edições, respeitando UG já preenchida (imutável) e dados operacionais protegidos.
- \`components/admin2/customers/AdminWorkspaceProfileEditor.tsx\`: formulário premium (nome, OM, sigla, seção; UG apenas legada), com ID/e-mail/status protegidos e simulação explicitamente sinalizada.
- \`components/admin2/customers/AdminCustomerManagement.tsx\`: botão **Editar dados do workspace**, consumo sob demanda e reutilização da função existente \`updateSectorWorkspaceProfile\` **apenas quando Firebase Emulator demo-* habilitado**; fora dele os dados ficam na memória do navegador e só afetam a prévia. Essa função original atualiza de modo atômico workspace/conta/índice UG e registra auditoria.
- \`components/admin2/customers/AdminCustomersDirectory.tsx\`: rascunhos de edição mantidos em memória enquanto navega entre lista, Gestão e Ficha 360; sem writes no Firestore real.
- \`components/admin2/shell/AdminCommandPreview.tsx\`: **Workspaces** aponta para diretório real; **Financeiro** abre Gestão do cliente; outras áreas chamam a ponte catalogada.
- \`components/admin2/shell/AdminLegacyCapabilities.tsx\`: inventário navegável e atalho explícito aos módulos originais \`/admin?tab=...\`; **sem subscriptions globais, sem duplicar backend e sem fingir que a adaptação nativa está completa**. O administrador decide explicitamente se entra no painel antigo (onde ações reais continuam disponíveis).
- \`scripts/admin2-workspace-edit.test.mjs\`: testes de validação, UG imutável, proteção do fundador e inventário do legado; incluídos no Application CI.

## 4. Regras de negócio e gates preservados

- Workspace \`id\`, conta autorizada, senha, situação e autoria **não são alterados** no editor institucional.
- **UG existente é imutável** pelo contrato da main: mudança quebraria vínculo de identidade/índice; só é permitida atribuição inicial em workspace legado sem UG, sujeita ao motor transacional e Rules.
- **Conta/assinatura/segurança são domínios diferentes**: cancelamento comercial não suspende o acesso automaticamente; alterar credenciais ou suspender o acesso continua procedimento protegido.
- \`platformCustomers/{workspaceId}\` continua o modelo 1:1 comercial. O editor institucional não modifica o cadastro comercial nem altera BillingAccount.
- \`main\` e banco real inalterados; nenhuma migração, publicação, ou deploy.
- Teste humano no localhost e CI do HEAD são obrigatórios antes do próximo marco.
- Próxima migração nativa sugerida: **(1)** ações seguras do setor com autenticação/confirm, **(2)** sessões, **(3)** consumo/cotas e relatórios preservando fontes, **(4)** backup/auth e segurança, **(5)** billing completo com regras e auditoria. Executar **uma por vez** com validação local, não abrir workers paralelos.

## 5. Handoff

**ONDE ESTAMOS:** editor institucional implementado na branch isolada; auditadas as oito áreas administrativas da main, com ponte explícita para manter funções acessíveis.

**O QUE ESTAMOS FAZENDO:** migração progressiva para shell V3, sem regressões, dados duplicados ou aumento de custo Firebase por carregar toda a plataforma.

**QUEM ESTÁ FAZENDO:** chat executor técnico sequencial; Fundador avalia no localhost.

**O QUE FAZER A SEGUIR:** certificar testes do editor/CI, Fundador validar alterações e compatibilidade, então migrar primeira capacidade restante (segurança/sessões) em incremento separado.

**QUEM O FARÁ:** ChatGPT implementa/valida; Fundador aprova.
