# EMPROVEX — ADMIN 2.0
## Auditoria Técnica Independente 01 — Viabilidade e Ajustes Prévios
**Data:** 2026-10-18
**Repo:** aprov-hgesm/Controles-de-Empenhos---Aprov
**Baseline auditada:** main@a0725ad8462f2eec9b3969cd872e2c7b1a7fa428 (leitura de fonte; sem confirmação de estado de produção ou ambiente externo).
**Documento avaliado:** docs/ADMIN_2_0_PLANO_MESTRE_WORKERS.md (A01–A15; W00–W12).
**Método:** inspeção estática do repositório via integração GitHub: código e Firestore Rules (dois bancos), APIs, Auth, hooks, queries, billing, Google Drive, guards de CI, documentação e fluxos da interface. Pesquisa pontual de documentação oficial Firebase e Google Drive. **Não** foram executados testes locais, Actions, navegador, Firebase Emulator ou mutações em dados reais: esta é uma **auditoria técnica de viabilidade e dependências**, não homologação dinâmica.
**Veredito:** **VIÁVEL COM AJUSTES PRÉVIOS — NO-GO PARA IMPLEMENTAÇÃO MASSIVA CONCORRENTE ATÉ G-1 PASS.** GO para design isolado, contratos, fixtures e protótipos não invasivos. Não exigir migração Cloud Run, troca Firebase/Firestore ou deploy para iniciar.

---

## 1. Achados classificados por severidade

### A-01 — BLOQUEANTE (P0): acesso Global Superadmin incompatível com paths/Rules atuais
**Evidência:**
- firestore.rules: \`isPlatformAdmin()\` funda-se em identidade Google específica, mas coleções operacionais como \`workspaces/{workspaceId}/empenhos\`, \`invoices\`, \`auditEvents\` continuam exigindo \`canAccessWorkspace(workspaceId)\`, sem bypass para outros tenants.
- lib/workspaceContext.ts: \`platformAdmin\` tem \`workspaceId:null\` e \`canLoadOperationalData:false\`; o contexto de setor fica vinculado a conta+workspace.
- lib/operationalPaths.ts: \`getCurrentOperationalScope()\` resolve exclusivamente a sessão operacional; gravações com escopo incorreto falham.
- hooks/useOperationalRealtimeCollections.ts: assinaturas \`onSnapshot\` com escopo operacional da sessão.
- features/operational/components/OperationalWorkspace.tsx: ações chamam hooks/repositórios cliente diretamente.

**Impacto:** W06 com “token do admin + seletor de workspace” sozinho não habilita interface real para outros tenants; W07/W08/W12 codificariam sobre um contrato impossível/incompleto.

**Ajuste obrigatório:** G-1 spike técnico isolado: fundador autenticado -> ler/editar dado fictício de outro workspace do banco principal -> registrar ator real -> trocar A/B sem vazamento -> usuário comum negativo. Decidir no gate uma arquitetura única: (a) camada backend delegada com adaptadores UI/repos; ou (b) híbrido de leituras estritamente autorizadas e mutações server-side; **não** adotar bypass geral de Rules nem Admin SDK sem invariantes. Tratar token expirada/revogado por consulta server-side apropriada em ações privilegiadas. Sem aceite individual ou deadline funcional Superadmin, conforme decisão do Fundador.

### A-02 — BLOQUEANTE (P0): Central de Depósitos usa outra base e outro gate de identidade
**Evidência:**
- lib/firebase.ts: \`db\` = databaseId nominal principal; \`warehouseDb\` = \`emprovex-warehouse\`.
- firestore.warehouse.rules: \`canAccessWarehouseModule\` aceita fundador somente em \`hgesm-aprov\`, ou setor com claims \`emprovexRole:'sector'\` e workspaceId+UG equivalentes.
- firestore.warehouse.rules: \`warehouseUgMatchesAccess\` também exige provider e pares de UG/workspace.
- lib/server/warehouseAccess.ts: \`verifyWarehouseRequest()\` retorna HGeSM para fundador; setor externo é validado pelo diretório e claims.
- features/warehouse/components/WarehouseProtectedSurface.tsx: gate exige \`SectorWorkspaceContext\` e \`status\` correto ou redireciona para raiz.
- app/api/central-depositos/intake-action/route.ts: POST rejeita \`workspaceId !== access.workspaceId\`, usa REST administrativo e requisitos de idempotência; \`intakeActionClient\` inicia ação com ID token do usuário atual.
- lib/warehouse/inventoryRepository.ts e outros repositórios operam com Auth, \`getCurrentOperationalScope\` e SDK Firestore cliente.

**Impacto:** W08 é maior do que “criar algumas APIs”. Um acesso global aparente não permite alocação, inventário, consulta, transferência e saída com a UX real; a integração toca proteções de ambas as bases e muitas chamadas diretas.

**Ajuste obrigatório:** G-1 inclui spike equivalente no banco Warehouse com material/posição sintéticos; matriz de CRUD por operação, retorno/erro, idempotência F05/F06/F09, claims e auditoria. Plano explícito de data-access bridge e adaptadores para telas antes de paralelizar W07 e W08. Ownership dedicado ao **W13 — Bridge Operacional** ou subfrente separada de W00, com arquivos antigos atribuídos nominalmente.

### A-03 — BLOQUEANTE DE ESCOPO (P0): Google Drive de terceiros não segue autorização Firebase/Firestore
**Evidência:**
- lib/googleDriveWorkspace.ts: OAuth \`drive.file\`, acesso ao token no navegador e em memória, verificação do email Google do setor; conexão exige que email Firebase ativo coincida com o autorizado.
- hooks/useWorkspaceDriveStorage.ts: só ativa ao receber \`SectorWorkspaceContext\`; sessão Drive tem expiração própria.
- lib/documentStorage.ts: documentos PDF estão vinculados ao Google Drive, não embutidos no Firestore.

**Impacto:** ser Superadmin do EMPROVEX NÃO concede automaticamente permissão aos arquivos privados das contas Google dos clientes. Um plano que prometesse leitura e manutenção dos anexos sem compartilhamento/autorizações anteriores teria escopo tecnicamente falso.

**Ajuste obrigatório:** fixar contrato de documentos:
1. Superadmin sempre vê/edita os metadados internos autorizados e registros transacionais.
2. O arquivo físico no Drive só pode ser lido/modificado se já houver delegação/compartilhamento/propriedade permitida pelo Google; nunca por impersonação ou captura de senha/token.
3. Para experiência futura sem aceite por **sessão de suporte**, avaliar compartilhamento persistente no onboarding, pasta compartilhada gerenciada, contas organizacionais com delegação legalmente aplicável ou armazenamento sob controle contratual. O usuário não precisa aprovar cada entrada no EMPROVEX, mas a permissão Google externa continua necessária.
4. W12 entrega matriz \`suportado / requer configuração anterior / não suportado\`; não marcar A12/A15 100% enquanto estiver em conflito com a expectativa explícita de anexos.

### A-04 — ALTO (P1): arquitetura de Cliente Comercial ainda não existe; identidade e preço são workspace-centric
**Evidência:**
- lib/platformIdentity.ts: \`SectorAccount\` aponta exatamente um \`workspaceId\`; \`Workspace\` possui \`authorizedEmail\`, UG e institutionalProfile, sem Cliente comercial.
- lib/platformBillingStore.ts e lib/billing.ts: \`billingAccounts\` keyed por workspace e ciclos \`billingCycles\` também por workspace/competência.
- app/api/admin/provision-sector/route.ts e lib/server/sectorProvisioningAdmin.ts: provisionamento atômico híbrido Firebase/Firestore e regras de identidade/UG.

**Impacto:** tela Cliente 360 exige novo agregador/composição de entidades; um Cliente com vários workspaces só é permitido como **agrupamento comercial**, não como identidade operacional múltipla imediata. Novo onboarding mal conectado pode criar divergência com cobrança, auth/UG.

**Ajuste:** W02 primeiro define \`Customer\`/link estável, ownership de backfill, source-of-truth, vínculo 1:N comercial, prevenção de duplicidade e migration dry-run reversível sem tocar usuários reais. \`workspaces\`/billing atual permanecem operacionais autoritativos. MRR por workspace; contatos comerciais separados do login operacional.

### A-05 — ALTO (P1): dashboard administrativo atual cresce linearmente com a base
**Evidência:**
- lib/platformAdminStore.ts: dois \`onSnapshot(collection(...))\` sem filtro/paginação em \`workspaces\` e \`platformAccounts\`.
- lib/platformBillingStore.ts: listeners globais de \`billingAccounts\` e \`billingCycles\`.
- lib/platformAdminSessions.ts: \`onSnapshot(collectionGroup('sessionSlots'))\` global.
- lib/platformAdminUsage.ts: \`Promise.all\` de \`getDoc(workspaces/{id}/usageEstimates/{day})\` para cada setor.
- hooks/usePlatformAdminBilling.ts: chama \`ensurePlatformBillingFoundation(workspaces,...)\` ao variar assinatura do diretório.
- lib/platformBillingStore.ts: \`ensurePlatformBillingFoundation\` percorre workspaces com transações individuais.

**Impacto:** dezenas ou centenas de workspaces são plausíveis; milhares exigem paginação, resumos e separação da inicialização financeira do carregamento de uma tela. Comportamento \`N\`-reads de abertura contraria economia Firestore.

**Ajuste:** W09/W02 estabelecem baseline, estratégia de resumos materializados, paginação, indexação e retries idempotentes; finance foundation migra para job/versioned explicitamente executado, não efeito passivo do mount. Nenhum worker pode retirar listeners históricos sem preservar funções de sessão/cobrança.

### A-06 — ALTO (P1): ownership W00 gera gargalo para integração real de módulos antigos
**Evidência:** Plano Mestre reserva W00 para \`app/admin/page.tsx\`, \`PlatformAdminView\`, Rules, context, CI, package. Mas W07/W08/W12 necessariamente precisam adaptar \`app/page.tsx\`, \`features/operational/**\`, \`features/warehouse/**\`, \`lib/firebaseSync.ts\`, repositórios, hooks e ligações de auth.

**Impacto:** módulos compilam isoladamente, mas funções reais não aparecem na interface; W00 torna-se único executor de modificações críticas e bloqueia paralelismo.

**Ajuste:** incluir **W13 — Bridge Operacional/Adapter Integration**, proprietário da camada de adaptação da UI antiga sob lista de arquivos negociada/registrada por W00; W06 exclusivamente policy/auth; W07/W08 serviços de operações por domínio; W00 apenas composition root, Rules e merges. Congelar contratos G0 **após**, não antes, da prova G-1.

### A-07 — ALTO (P1): guards e gates existentes dependem de arquitetura antiga
**Evidência:**
- scripts/verify-admin-information-architecture.mjs exige marcadores textuais como \`type AdminTabId =\`, \`data-testid=...\`, \`<AdminCreateSectorPanel\`, \`<AdminConsumptionHub\` e imports em arquivo monolítico.
- .github/workflows/application-ci.yml executa centenas de verificações e \`verify:admin-information-architecture\`.
- ops/typescript-error-budget.json = \`maxErrors:0\`. Vários CI gates protegem isolamento, Domain e Recovery.

**Impacto:** uma refatoração válida de shell pode falhar em guard textual legado. Não silenciar o teste sem substituir prova de comportamento, nem duplicar componentes falsos só para passar CI.

**Ajuste:** W00 + W11 mapear guards existentes e construir matrizes de compatibilidade; substituir asserts textuais pontuais por contratos/integração quando inevitável, preservando proteção. Validar typecheck sem novos erros e as duas suites de Rules/Emulator em QA.

### A-08 — MÉDIO (P2): identidade global atual é uma conta fundadora, não RBAC multiadmin
**Evidência:** firestore.rules/\`firestore.warehouse.rules\` conferem e-mail/provedor específicos; \`lib/profileMode.ts\`/context tratam perfil dual do fundador.

**Impacto:** Superadmin único é viável. Múltiplas equipes/papéis futuros precisariam de identidade/claims/rotas novas, mas **não são P0** da Admin 2.0 atual.

**Ajuste:** abstrair predicado server-side Superadmin e estruturar interface de policy para futuro RBAC sem já criar uma hierarquia complexa de papéis.

### A-09 — MÉDIO (P2): atual limite de rate-limit admin é local ao processo; observabilidade de novas APIs
**Evidência:** lib/server/requestSecurity.ts explicita que \`enforceBestEffortBurstLimit\` é in-memory em instâncias serverless; kill switches existentes só cobrem rotas administrativas específicas.

**Impacto:** novas operações privilegiadas exigem proteção proporcional e desativação emergencial, especialmente ações destrutivas. Isso não requer Redis ou infraestrutura nova para protótipo; proteção distribuída a avaliar quando houver evidência de escala/risco.

**Ajuste:** policy uniforme por endpoint, logs sem payload sensível, idempotência e kill switch específico para escrituras globais administrativas.

### A-10 — MÉDIO (P2): promessas de 100% e métricas não podem preceder prova
**Evidência:** Plano Mestre A01–A15 exige 100%, mas anexos Drive, assinaturas alheias e integrações externas têm limites de identidade; custos de 5.000 workspaces não estão medidos; não foi realizado QA dinâmico nesta auditoria.

**Impacto:** risco de falsa certificação e expansão ilimitada do escopo.

**Ajuste:** matriz \`requisito / operação / ambiente / evidência / estado / exceção\`. Bloquear “100%” se fluxo contratado não tiver prova ou exceção explicitamente aprovada pelo Fundador. Documentos fisicamente inacessíveis por Google não devem ser mascarados como sucesso; exceção de serviços terceiros precisa de decisão de produto.

---

## 2. Matriz de viabilidade por worker (pré-correções)

| Worker | Viabilidade | Condição |
|---|---|---|
| W00 Coordenação | SIM, já | Não iniciar mass merge antes de G-1 |
| W01 Design Shell | SIM, já | Componentes isolados e validação humana |
| W02 Clientes/Data | SIM, contrato primeiro | Cliente comercial + links, migração sem writes reais |
| W03 Clientes UI | SIM, com mocks/contratos | Backend tipado W02 e shell W01 |
| W04 Financeiro | SIM, com adaptação | VIP/observe/cycles e resumos sem regressão |
| W05 Atendimento | SIM | Modelo, privacidade e logs |
| W06 Superadmin | CONDICIONAL/G-1 | Sem duplicação de identidade e com dois bancos |
| W07 Empenhos assistidos | BLOQUEADO até G-1 + bridge | Hooks cliente e Rules |
| W08 Depósitos assistidos | BLOQUEADO até G-1 + bridge | Banco extra, Auth/claims, regras e operadores |
| W09 Analytics | SIM, condicionado a fonte | Resolver listeners globais e baseline |
| W10 Governança | SIM, parcial | Fatos auditáveis, sem promessas de legalidade universal |
| W11 QA | SIM, já | Ambiente isolado e bateria negativa |
| W12 Drive/Integrações | PARCIAL/G-1 externo | Autorização Google específica |
| **W13 NOVO — Bridge Operacional** | NECESSÁRIO para executar o plano com paralelismo | Adaptadores nos componentes/hooks/repositórios legados, sob contrato W06 |

---

## 3. Ajuste de sequência recomendado

### G-1 — Spikes obrigatórios antes de G0
W00 + W06 + W11 e W13 (novo) investigam e demonstram em QA sintético:
1. Leitura e alteração entre workspaces no Firestore principal sob identidade Superadmin real; usuário comum negado.
2. Leitura e operação transacional idempotente no \`emprovex-warehouse\` de outro workspace sob identidade Superadmin real; usuário comum negado.
3. Troca de contexto Admin -> A -> B -> Admin sem abrir assinaturas/Cache de outro tenant e sem se passar pelo cliente.
4. Auditoria verdadeira com before/after/correlation e logs estáveis nos bancos relevantes.
5. Operação exemplar completa pela UI (não só API): uma Gestão de Empenhos e uma Central de Depósitos.
6. Contracto Drive: visibilidade de metadados versus arquivo físico, alternativa permitida de acesso previamente compartilhado; nunca acessar Drive alheio sem autorização adequada.
7. Spike IAM/QA: servidor em ambiente isolado tem credenciais e papéis mínimos funcionais para ambos os bancos; não presumir pela presença de variáveis no código.

**G-1 resultado:** PASS COM ARQUITETURA ESCOLHIDA (A ou B) ou NO-GO + lista objetiva. NÃO modificar regras de produção para concluir o spike.

### G0 — Congelar contratos agora fundamentados
W00 + W02 + W06 + W11 fixam Cliente/Workspace/UG, API/auth/audit, bridge operacional, perf, UI, estado legal/Drive. W13 assume ownership explícito de arquivos antigos e APIs de adaptação. Ajustar prompts W06–W08/W12 para referenciar resultado G-1.

### Onda 1 paralela
W01 (estética/shell), W02 (backend clientes), W04 (financeiro), W05 (atendimento), W09 (analytics), W10 (governança), W11 (testes) conforme contratos. Máximo prático 4–6 frentes de código conforme conflitos.

### Onda 2 integrada
W03 Clientes UI e W06+W13 fundação de seleção/bridge; em seguida W07, W08 e W12 por cobertura de operações, matrizes e testes.

### Onda 3/4
Integração sequencial, gates de segurança, Firestore queries, CI, Browser QA, UX, Cloud/Google IAM, regressões e homologação. Só depois declarar produto completo; produção separada por GO explícito.

---

## 4. Critérios mínimos para o GO do desenvolvimento em massa

- [ ] G-1 passou no Firestore principal e warehouse (duas bases).
- [ ] Um fluxo de escrita de Empenhos e um de Depósitos funcionou de ponta a ponta sem impersonação e com log real.
- [ ] Definidos explicitamente ownership e adaptadores W13; W00 deixou de ser gargalo para todos os hooks antigos.
- [ ] Definida política de acesso ao documento físico Google Drive de terceiros (não confundir com autorização EMPROVEX).
- [ ] Cliente/UG/workspace/assinatura e migration/backfill foram contratados, compatíveis e reversíveis.
- [ ] Definido tratamento dos guardrails de CI acoplados a strings do componente antigo.
- [ ] Ambiente Emulator/QA preparado para testes das duas bases, com usuário comum e Superadmin reais sintéticos.
- [ ] Política de custo e baseline Firestore aceitos como critério de aceite, sem inventar orçamento.
- [ ] Escopo de QA/rollback e exclusão de produção definidos.

**Sem esses pontos:** manter implementação restrita a protótipos isolados, estudo e provas técnicas.

---

## 5. Evidências de código inspecionadas

- \`firestore.rules\`: predicado isPlatformAdmin, canAccessWorkspace e coleções operacionais.
- \`firestore.warehouse.rules\`: canAccessWarehouseModule, warehouseUgMatchesAccess e CRUD Warehouse.
- \`lib/server/warehouseAccess.ts\`: verifyWarehouseRequest; \`app/api/central-depositos/intake-action/route.ts\` POST.
- \`lib/firebase.ts\`: \`db\` e \`warehouseDb\`, emulators.
- \`lib/workspaceContext.ts\`, \`lib/operationalPaths.ts\`, \`hooks/useOperationalData.ts\`, \`hooks/useOperationalRealtimeCollections.ts\`, \`features/warehouse/components/WarehouseProtectedSurface.tsx\`.
- \`features/operational/components/OperationalWorkspace.tsx\`; \`features/empenhos/hooks/useEmpenhoActions.ts\`; \`features/notas-fiscais/hooks/useNotasFiscaisActions.ts\`.
- \`lib/googleDriveWorkspace.ts\`, \`hooks/useWorkspaceDriveStorage.ts\`, \`lib/documentStorage.ts\`.
- \`lib/platformIdentity.ts\`, \`lib/billing.ts\`, \`lib/platformBillingStore.ts\`, \`hooks/usePlatformAdminBilling.ts\`.
- \`lib/platformAdminStore.ts\`, \`lib/platformAdminSessions.ts\`, \`lib/platformAdminUsage.ts\`.
- \`scripts/verify-admin-information-architecture.mjs\`, \`.github/workflows/application-ci.yml\`, \`ops/typescript-error-budget.json\`, \`firebase.security-test.json\`, \`firebase.warehouse-security-test.json\`, \`lib/server/requestSecurity.ts\`.
- Documentos Firebase Firestore Rules (server bypass/IAM): https://firebase.google.com/docs/firestore/security/rules-conditions .
- Documentos Google Drive OAuth/escopos: https://developers.google.com/workspace/drive/api/guides/api-specific-auth .

---

## 6. Handoff da auditoria

**ONDE ESTAMOS:** auditoria estática encerrada em baseline main@a0725ad8. Plano Admin 2.0 documentado, NÃO executado; risco arquitetural real identificado. Produção intocada.

**O QUE ESTAMOS FAZENDO:** reordenar plano para G-1 antes de G0 e reconhecer necessidade de W13/bridge. A auditoria não comprova PASS de segurança/UX em runtime.

**QUEM ESTÁ FAZENDO:** auditoria técnica de planejamento; futuros W00/W06/W11/W13 responsáveis pelos spikes; W02 pelo contrato cliente.

**O QUE FAZER A SEGUIR:** criar G-1 em branch isolada, usar Emulator com os dois bancos e fixtures sintéticas, provar operações e revisar contratos; decidir e registrar GO/NO-GO para implementação em massa.

**QUEM FARÁ:** Coordenador W00 designa execução; W06/W13 implementam prova; W11 certifica independência; Fundador valida escopo Drive e acabamento visual.

**STATUS FINAL DA AUDITORIA:** **PASS de viabilidade conceitual; NO-GO de implementação massiva na ordem antiga, até ajustes e G-1 demonstrado.**
