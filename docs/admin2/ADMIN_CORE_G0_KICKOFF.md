# EMPROVEX — Admin 2.0 CORE
## W00 — Início de integração e G0 (contratos em elaboração)

**Data da decisão visual:** 2026-10-18.
**Status:** ONDA 0 INICIADA / G0 EM ELABORAÇÃO; **não** é aprovação de contratos nem implementação funcional.
**Branch:** feat/admin2-core-integration
**Origem:** main@50fb01bff2718c913e63ac4082c13030d8f8e354 (verificar novamente a main antes de integrar).
**Preview aprovado:** PR DRAFT #339, \`feat/admin2-w01-sidebar-local-preview\`, HEAD registrado 85dffe51f575458ec742b7835f2bd26a054867ef.
**Ambiente de publicação:** Nenhum. \`emprovex.com.br\` e dados reais intocados por este registro.

## 1. Aceite visual do Fundador — V3 (congelar decisões, não código)

O Fundador aprovou o laboratório de identidade EMPROVEX Command em 2026-10-18:

- **Header azul-marinho em toda a largura** e marca EMPROVEX Command.
- **Sidebar escura, fixa na extremidade esquerda**, 288px em desktop, **sem botão de recolher**, com ícones + nomes e estado ativo marcado.
- **Rolagem interna elegante da sidebar**, scrollbar fina/arredondada, trilho discreto, contraste e rodapé persistente.
- **Área principal clara institucional**, fundo cinza-azulado com gradientes discretos, cards brancos e sombras premium; acentos azul/teal/verde/âmbar por significado.
- Mobile com drawer, backdrop, Escape, foco visível; navegação por URL/deep link.
- Montserrat, transições suaves e reduced-motion.

Essas decisões são o **contrato visual vigente para W01/W03/W04/W05/W09/W10**, substituindo trechos mais antigos que mencionam sidebar recolhível. **Não ampliar escopo com acesso administrativo aos dados operacionais de outro workspace, depósitos externos ou arquivos Drive de clientes.**

**Atenção:** o laboratório PR #339 ainda usa informação **fictícia** e \`/admin2-preview\` só em \`next dev\`; o aceite é da **direção visual**, não do CRUD/segurança/CI do produto completo. Não fazer merge dele na main neste momento.

## 2. Arquitetura real a respeitar

| Origem atual | Contrato constatado no repositório | Consequência |
|---|---|---|
| lib/platformIdentity.ts | Workspace contém \`id\`, \`ug?\`, \`authorizedEmail\`, \`institutionalProfile\`, \`status\`; SectorAccount possui exatamente um \`workspaceId\` | Novo Cliente comercial não altera identidade operacional nem agrega UID cross-tenant |
| lib/platformAdminStore.ts + hooks/usePlatformAdminDirectory.ts | Diretório atual usa \`workspaces\` e \`platformAccounts\`, com leitores globais | Ler **metadados administrativos**, propor paginação/índices antes de escalar |
| lib/billing.ts | Configuração \`billingMode\`, preço em centavos (7000), \`BillingAccount\` por workspace, ciclos por workspace | Preservar R$70/mês/workspace, trial 30d, VIP isento, observe, confirmação manual, sem suspensão automática |
| lib/platformBillingStore.ts + hooks/usePlatformAdminBilling.ts | Listener global e inicialização financeira acoplada ao mount | Nenhuma nova UI deve reproduzir consultas massivas ou fundação de billing por render |
| lib/server/sectorProvisioningAdmin.ts + app/api/admin/provision-sector/route.ts | Provisionamento server-side existente, validação da identidade do Fundador, regras de UG/ID | Reutilizar motor e verificações; **não** criar segundo fluxo de provisionamento |
| app/admin/page.tsx + components/admin/PlatformAdminView.tsx | Página Admin existente já opera sessões, setores, billing, backups, consumo e segurança | W00 deve preservar funções existentes e implementar compatibilidade de rotas |
| scripts/verify-admin-information-architecture.mjs | Guard exige marcadores literais da UI anterior | Atualizar proteção com testes reais antes de substituir o shell, nunca só desativar o guard |

## 3. G0 — Proposta de contratos, NÃO CONGELADA

G0 depende de revisão W02 (modelo de dados) e W11 (segurança/performance). Nada abaixo concede acesso ou altera Firestore automaticamente.

### Modelo administrativo/comercial proposto
- **Customer**: \`customerId\`, \`displayName\`, \`kind\` (pessoa responsável/conta comercial), contatos e estado comercial; NÃO é setor Firebase, OM nem workspace.
- **CustomerWorkspaceLink**: \`customerId\`, \`workspaceId\`, papel comercial, timestamps; **1 cliente para N workspaces é vínculo comercial, não autorização operacional**.
- **Workspace/OM**: estrutura atual continua source-of-truth para \`ug\`, \`authorizedEmail\`, \`institutionalProfile\`, \`status\`.
- **Billing**: \`billingAccounts\` e \`billingCycles\` continuam source-of-truth por workspace; Customer 360 usa **projeção derivada**; não escreve preço/status em cópias.
- **SupportTicket**: relacionamento por \`customerId\` e opcional \`workspaceId\`; histórico de transições/auditoria; minimização de dados pessoais.
- **AdminCustomerSummary**: projeção/materialização versionada sob demanda, com campo de frescor explícito; não hospedar dados operacionais privados.

**Compatibilidade legada:** até que haja dados comerciais separados e migração explicitamente aprovada, diretório deve suportar view somente-leitura baseada em workspaces atuais, sem inventar um Customer novo no banco por navegação e sem confundir "OM" com "cliente pagante".

### Endpoints e consulta
W02 proporá contratos versionados para:
- \`GET /api/admin/customers\` — limite de página, filtros validados, busca e cursor estável; não varrer histórico sem necessidade.
- \`GET /api/admin/customers/:customerId\` — composição 360 administrativa, com partes custosas sob demanda.
- \`POST/PATCH\` Cliente/contatos/vínculos somente após autenticação, contrato de idempotência e regras administrativas apropriadas.
- Agregação financeira (W04), suporte (W05), analytics (W09) em interfaces com mesmo \`customerId\`, sinalizando dados ausentes/frescor.

Público alvo das rotas: **conta administrativa autorizada**, verificada no servidor por token, tipo de conta e ação. Cliente comum deve receber negação; envio de \`workspaceId\` ou \`customerId\` no request **não** torna o solicitante administrador. Nada de autorização global de operações warehouse/empenhos.

### Convenções de integração visual
- W01 exporta shell e UI kit em \`components/admin2/shell/**\` e \`components/admin2/ui/**\`.
- W03 usa esses componentes na ficha e diretório, não duplica sidebar/topbar.
- W00 integra a navegação e os módulos administrativos existentes, sem eliminar as funções de provisionamento, cobrança, backup e sessões.
- O shell **não dispara listeners Firestore por montagem/abertura do menu**.

## 4. Execução com workers

| Onda | Workers | Entrega | Dependência |
|---|---|---|---|
| 0 (agora) | W00 + W02 + W11 | G0 contratos, fonte de verdade, políticas de consulta e matriz de teste | Nenhum G-1 cross-tenant |
| 0 (visual já aprovado) | W01 | Consolidar componentes reutilizáveis no laboratório aprovado, com a11y/QA | A aprovação da estética já foi dada |
| 1 | W03 | Diretório real + 360 UI tipada, com mock local antes das APIs | G0 API e shell W01 |
| 1 | W04 + W05 | Billing e CRM/atendimento | G0 Customer/Workspace |
| 1 | W09 + W10 | Métricas/consumo/auditoria administrativa | G0 dados, segurança e custo |
| 2 | W00 integra | Shell real + módulos legados e PRs em branch de integração | PRs DRAFT certificados |
| 3 | W11 + Fundador | Regressão/Emulator/Preview, smoke, certificar 13/13 e GO de publicação | Ações completas e medições |

**Ownership:** W00 exclusivamente \`app/admin/page.tsx\`, \`components/admin/PlatformAdminView.tsx\`, guards globais, workflows/infra, memorais e composição; W01 só shell/UI; W02 modelo/API clientes; W03 telas clientes; W04 financeiro; W05 atendimento; W09 analytics; W10 governança; W11 testes independentes. Nenhum worker faz merge na \`main\`/deploy por conta própria.

## 5. Critérios de G0 — checklist verificável

- [ ] Confirmação W02 de \`Customer\` vs Workspace/UG/conta e vínculo, sem criar identidade operacional adicional.
- [ ] Definida fonte autoritativa de cobrança, trial, VIP, status e eventos administrativos.
- [ ] API/paginação/filtros e autorização administrativa revisadas por W11.
- [ ] Matriz de dados/metadados permitidos na ficha 360, sem abrir dados operacionais do cliente.
- [ ] Contrato de cadastro reutilizando provisionamento existente, sem gravar em produção.
- [ ] Estratégia de leitura/performance com baseline e índices candidatos.
- [ ] Adaptador das funções atuais no shell novo e guard CI mapeado.
- [ ] Registros/PRs por worker, evidência de testes e \`main\`/produção inalteradas.

Somente após aprovação deste gate por W00/W02/W11 os demais workers codificam sobre contratos estáveis. Não chamar o G0 de PASS antes disso.

## 6. Handoff

**ONDE ESTAMOS:** visual V3 aceito pelo Fundador; PR DRAFT #339 preservado; branch central \`feat/admin2-core-integration\` criada para integrações futuras. G0 em elaboração, dados fictícios no laboratório.

**O QUE ESTAMOS FAZENDO:** estabelecendo modelo comercial, contratos administrativos e fontes de dados para transformar mockups em funcionalidades reais.

**QUEM ESTÁ FAZENDO:** W00 coordenação, W02 contratos/dados, W11 auditoria e W01 componentes visuais.

**O QUE FAZER A SEGUIR:** W02 submeter contrato versionado e plano de leitura/migração \`dry-run\` (sem writes); W11 submeter riscos/testes; W00 congelar G0, liberar W03/W04/W05/W09/W10.

**QUEM O FARÁ:** workers por ownership; Fundador valida versões funcionais locais antes de deploy.
