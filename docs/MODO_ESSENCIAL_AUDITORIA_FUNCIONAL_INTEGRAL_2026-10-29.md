# EMPROVEX — AUDITORIA FUNCIONAL INTEGRAL DO MODO NORMAL/ESSENCIAL — 29/10/2026

**Escopo:** PR #411, branch `feat/visual-mode-r1-session-navigation`, código comparado com `main`, antes de qualquer merge/deploy. Auditoria de **não regressão**, não de performance prometida. **Decisão: NO-GO para publicação** até resolver inconformidades e completar testes reais com usuário autenticado. O sistema de produção permaneceu inalterado.

## 1. Confiabilidade e limites da prova

Métodos efetivamente executados:
1. `compare_commits(main...branch)` no GitHub: 28 caminhos alterados antes desta auditoria, com 47 commits adiante e zero atrás na leitura inicial. Nenhuma mudança em `firestore.rules`, `app/api/**`, `lib/server/**`, motor de lançamentos de NF/NE/NS, operações Warehouse/Operador Móvel, renderizador 3D, termo de recebimento, serviços de upload Google Drive ou gerador de relatórios. **Isso prova ausência de edição direta desses arquivos, não comportamento ponta a ponta.**
2. Inspeção dirigida de cadeia de entrada `/login` → `OperationalWorkspace` → `NotasFiscaisView`, `EmpenhosView`, `RelatoriosView`, `CronogramasView` → hooks/actions → documentos/serviços. Auditoria também do seletor, cache por sessão, cobrança, contexto UG/UID, scripts de testes e Central.
3. CI da PR #411: no commit anterior ao workflow de auditoria, `Core Protection PASS`, `typecheck PASS`, `Zero writes Warehouse SDK PASS`, `W4 visual/browser isolado PASS`, `W4 Five-Worker Evidence PASS`, `Fast CI FAIL`. O Fast CI executou **33 grupos PASS** e **quatro grupos FAIL**; algumas verificações referenciam a arquitetura pré-reexport `app/page.tsx`.
4. Workflow **VISUAL-R2 Integrity Audit (non-destructive)**, execução GitHub Actions **#40818642040**, adicionado especialmente para esta auditoria, com Node e código da PR, **sem credenciais reais, escrita em base remota, staging ou produção**. **48 comandos de teste/verify:** **36 PASS, 12 FAIL** (23 documentos: 17/6; 12 segurança: 10/2; 13 Warehouse/UI: 9/4).
5. Novo disparo W4 e prévia InfinitePay falhou ao instalar dependência de Playwright por **npm 404 em `@types/estree@1.0.10`**. É falha de instalação externa, **não resultado de teste de interface**. O W4 anterior tinha passado. O E2E autenticado e Application CI completo continuam **não executados**.

**Limitação decisiva:** nenhuma sessão autêntica foi usada para gerar TR/PDF com dados reais, enviar cronograma, subir arquivo no Drive, salvar NF, testar autorizações vigentes na nuvem, verificar a cena 3D em dois computadores ou comparar renderização/CPU em dispositivos fracos. Nenhuma prova de que *tudo funciona perfeitamente* é possível com a evidência disponível.

## 2. Matriz de preservação de funções críticas

| Função protegida | Caminho de código encontrado | Evidência | Status de auditoria |
|---|---|---|---|
| Login e senha do setor | `EmprovexLogin` → `app/login/page` → `useOperationalData` | Inputs, Google, redefinição, gate de cobrança, aceite e controle de sessão mantidos; verify external-sector-login PASS | **Preservação estrutural; autenticação real pendente** |
| Assinatura, VIP, isenção, trial/expiração | `checkSectorBillingAccess` → `/api/billing/portal?view=access`; Rules no workspace | `verify:saas-r1-security-enforcement PASS`; backend sem alteração | **Gate estrutural; variação de entitlement no runtime pendente** |
| Permissões UID/UG/workspace | `platformAccess`, Firestore Rules, WarehouseAccessBoundary, server Warehouse | Multitenant/core auth verificados em CI; Rules e endpoints intactos | **Preservação estrutural; regras implantadas/emulador pendentes** |
| Emissão de TR | `NotasFiscaisView` → `TermoRecebimentoActions` → `handleTermoRecebimentoAction` → `buildTermoRecebimentoPdf` → `ensureTermoRecebimentoAssignment` e jsPDF | Quatro comandos gerar, visualizar, imprimir, baixar, numeração, comissão do mês e PDF presentes; módulos de backend não alterados | **Fluxo ligado; TR real NÃO testado** |
| Liquidação consolidada | `NotasFiscaisView` → `handleDownloadLiquidacaoConsolidada` | Mantém `pdf-lib` e ordem: NE, NF, espelho, TR condicional, busca Drive | **Fluxo ligado; PDF mesclado NÃO testado** |
| Upload NE | `EmpenhoDocumentActions` → `uploadEmpenhoPdf` → `uploadAndVerifyWorkspacePdf` → `handleEmpenhoDocumentUploaded` → `saveEmpenho` | Validação PDF, hash, vínculo por workspace, rollback de upload se metadado falhar; arquivos inalterados | **Fluxo ligado; upload OAuth real NÃO testado** |
| Upload NF e espelho | `InvoiceDocumentActions` / `InvoiceMirrorDocumentActions` → `invoiceDocuments` → hooks NF | Verificação PDF, upload, download, print e callbacks preservados; `verify:workspace-drive PASS`; `verify:invoice-mirror-document FAIL` por busca da antiga root | **Fluxo ligado; upload OAuth real NÃO testado** |
| Importação NE por PDF | `EmpenhosView` → `handleProcessEmpenhoPdf` → `/api/empenhos/parse-ne` → revisão e salvar | Parser/endpoint/ações não alterados. `verify:empenho-pdf-direct-import` falha **apenas na checagem de app/page** | **Revisão estrutural positiva; teste de PDF real pendente** |
| Emissão de relatórios NE | `RelatoriosView` → `RelatorioPorEmpenhoView` → `handleGenerateEmpenhoReportPDF` | Intervalo, histórico completo, abortar se truncado, consolidado, jsPDF e downloads mantidos; `verify:reporting-foundation/reports-shell/report-empenho-detail PASS`, `test:reporting-period PASS` | **Estrutura e contratos PASS; impressão real pendente** |
| Relatórios por fornecedor, SAG/NS, SPED/NUP | subabas de Relatórios; `useSagNsImportActions`, `useNotasFiscaisActions`, `useDocumentActions` | Testes fornecedor/SAG/NS/identidade PASS; verificação SPED/NUP falha na referência à root antiga | **Contratos parciais PASS; operações reais pendentes** |
| Cronogramas: salvar/PDF/email/anexos | `OperationalWorkspace` → `CronogramasView` → `useCronogramaActions` | Salvar, gerar PDF, resolver conta Drive, recuperar NE PDF, confirmação de e-mail, registrar envio; `test:cronograma-email PASS` | **Contratos PASS; envio real pendente** |
| Dados financeiros e NS/NF | `useNotasFiscaisActions`, `firebaseSync`, `nsIntegrityService` | `test:invoice-identity`, `test:ns-integrity`, `test:empenho-concurrency`, `verify:invoice-ns-lifecycle`, `test:financial-identity-v2` PASS | **Contratos de integridade PASS; fluxo autenticado pendente** |
| Backup/recuperação | `WorkspaceDriveControl` → lazy `WorkspaceBackupSection` → hooks existentes | `verify:backup-recovery PASS`, `test:recovery PASS`; hook Drive permanece montado antes de abrir popup | **Estrutura PASS; restaurar em ambiente de teste pendente** |
| Central 3D e croqui | `WarehouseModuleShell` → `WarehouseTabContent`, `WarehouseSectionContent` | Renderizador, escala, câmera, 3D não alterados; 3D/camera/croqui/collision/inventário/stock tests PASS | **Código e testes de domínio PASS; comparação visual operacional pendente** |
| Operador Móvel, estoque, etiquetas | módulos Warehouse e mobile sem alteração no diff | `test:mobile-outbound-unified`, inventory, outbound-return, NF stock, stock report PASS | **Contratos PASS; scanner físico pendente** |
| Troca Normal/Essencial | `VisualModeProvider` `sessionStorage` e `AppSidebar`/Warehouse/Admin | Nenhuma gravação Firestore no Provider; nenhuma mudança de API/Rules por modo | **Preferência isolada; testes de alternância/draft pendentes** |

## 3. Resultado de CI, grupos falhos e classificação

**Bateria funcional isolada #40818642040:**
- **Documentos/Relatórios 17 PASS / 6 FAIL.** `verify:tr-workspace-documents`, `verify:workspace-drive-onboarding`, `verify:invoice-mirror-document`, `verify:empenho-pdf-direct-import`, `verify:sped-nup-reporting` falham porque ainda exigem marcadores de `app/page.tsx`, mas os comandos estão na rota canônica `app/login/page.tsx`. **A checagem foi invalidada pela nova estrutura**; isso NÃO prova upload/emissão quebrados, mas também NÃO é um PASS de ponta a ponta. `verify:central-avisos` falha tentando ler arquivo `InicioOrbitSystem.tsx` inexistente (referência obsoleta, independente desta PR).
- **Segurança 10 PASS / 2 FAIL.** `verify:hybrid-auth-model` e `verify:rc-rules-audit` (via verificação de aceite legal) procuram a antiga root, enquanto login e `LegalAcceptanceGate` estão em `app/login/page.tsx`. Revalidar guardas reais antes de considerar PASS.
- **Warehouse/UI 9 PASS / 4 FAIL.** `test:warehouse-react-tab-navigation` espera sequência literal `hasLocalTabNavigation ?`, substituída por `renderLocalSection = isPrimaryRoute && (hasLocalTabNavigation || activeSection.id !== routeSection.id)` devido ao redirecionamento Essencial; **novo comportamento requer teste real de URL/back/forward**. `verify:central-depositos-routes` busca clique na antiga `app/page` e href apenas Normal; `verify:performance-r3-central-shell` exige import `next/link` em sidebar que atualmente usa botões locais; `test:pwa-installability` exige `router.replace('/login')` embora admin use `window.location.replace('/login')`, alinhado ao outro teste `critical-cross-route-navigation`. São verificações incompatíveis com padrões atuais, **não uma aprovação de comportamento**.
- **CI principal no commit anterior:** TypeScript real PASS; zero writes diretos no cliente Warehouse PASS; Core Protection PASS; Fast CI FAIL nos 4 grupos correspondentes; W4 browser isolado PASS uma vez. No disparo com este workflow, W4/preview InfinitePay falharam por erro npm 404 ao instalar Playwright; não foram testes de aplicação.
- **Nenhum teste foi alterado nesta auditoria para fabricar PASS.** O workflow de auditoria mantém cada falha visível.

## 4. Defeitos e riscos reais identificados no código (não ocultados por testes obsoletos)

### AF-01 — P1, regressão visível: indicador de avisos no Painel Essencial
`app/login/page.tsx` calcula `pendingNoticeCount` com `inicioSnapshot?.alerts.total ?? 0` quando `activeTab='painel'`. `lib/operationalSubscriptionPlan.ts` define `painel.alerts=false` e `useInicioOperationalSnapshot.ts` só observa snapshot remoto quando `activeTab='inicio'`. Usuário que inicia diretamente no Essencial pode ver **0 avisos mesmo tendo pendências**. **Confirmado por encadeamento estático**, não reproduzido no browser. Corrigir com origem de contagem apropriada, autorizada e de baixo custo; não abrir coleção inteira de alerts por padrão nem fabricar `0`.

### AF-02 — P1, diferença de gate por identidade antes de subscriptions
`app/login/page.tsx` adicionou `billingIdentityAllowed` para bloquear **render** de superfície de outra UID/UG, mas chama `useOperationalData(..., billingAccessState === 'allowed')` com o booleano **anterior ao vínculo de identidade**. `useOperationalData` usa esse parâmetro em `operationalAccessEnabled`; o `acceptedLegalIdentityKey` limita adicionalmente o acesso, e Firestore Rules continuam a autoridade. **Risco de janela de assinaturas/requisições durante troca de identidade, não um bypass demonstrado.** Antes de publicar, usar autorização vinculada a identidade em toda a ativação de dados; validar UID/UG e revalidação de cobrança.

### AF-03 — P1, funcionalidade NF: rascunhos não certificados
`app/login/page.tsx` mantém `nfDraftsByEmpenhoRef` em memória, com atualização assíncrona via `useEffect([nfQuantities])` e restauração por `selectedNFCommitmentId`. O PDF selecionado, por outro lado, vive em `NotasFiscaisView` (`nfPdfFile` local) e pode ser perdido ao desmontar a aba; já existia parte desse comportamento antes da R1. **Sem teste de concorrência/snapshot nem mudança rápida de NE**, não certificar que os formulários jamais perdem entradas. Exigir teste digitando NF, trocando NE, aguardando snapshot, alternando modo e retornando, com arquivos.

### AF-04 — P2, logout Admin sem limpeza uniforme
`PlatformAdminView.tsx` tem dois controles de logout: cabeçalho executa `clearVisualMode(); void onLogout()`; botão na sidebar executa apenas `void onLogout()`. O handler do `app/admin/page.tsx` encerra perfil e Firebase, mas não limpa `sessionStorage` do modo. **Inconsistência funcional comprovada no código**, não falha de isolamento de banco. Centralizar em um único handler.

### AF-05 — P2, estilo Essencial parcialmente órfão
O CSS `app/visual-mode-essential.css` contém regras para `main[data-visual-surface='operational']`; a rota verdadeira `app/login/page.tsx` usa `data-testid='operational-active-content'`, não `data-visual-surface`. As simplificações dirigidas a esse atributo não se aplicam. **É ganho visual/performance não entregue, não prejuízo a operação**. Ajustar o seletor para a rota canônica, sem usar seletores globais.

### AF-06 — P1, Central: histórico/estado local sem prova de equivalência
A Central mantém `activeSectionId`, `usePathname`, `history.pushState/replaceState` e `hasLocalTabNavigation`; a troca Essencial em `home` exige `control`. Unitários de domínio 3D PASS, mas script de contrato antigo falha; nunca foi validado um usuário alternando modos em depósito durante operação. **Risco não reproduzido:** aba incorreta em F5/back/forward e eventual estado de formulário perdido. Não alterar 3D para corrigir roteamento.

### AF-07 — P1, R2-B financeira sem teste de equivalência monetária
`DashboardView.tsx` foi efetivamente alterado: `useMemo([empenhos])` calcula totais por empenho/classe/RPNP, e tabela mostra 60 linhas iniciais no Essencial. Código mantém fórmulas originais, busca e subtotal do conjunto completo; porém **nenhum teste comparativo com base real de muitos empenhos, edições in-place, dados vazios e arredondamento** foi executado. Não aprovar paridade monetária apenas por typecheck. Uma tabela não deve truncar exportação, itens ou acesso aos registros.

### AF-08 — P2, mensagens de stale/offline do Firestore
`useOperationalRealtimeCollections.ts` preserva a última coleção e marca readiness após certos erros. O comportamento preexiste, mas uma interface minimalista não pode mascarar o estado desatualizado; deve identificar se dados em tela são sincronizados e evitar confirmar operação crítica com acesso não verificado. Não refatorar listeners sem medir custo/identidade.

### AF-09 — P1, lacuna de prova end-to-end dos documentos
O código de TR, upload, Drive, relatórios e envio de cronogramas **não foi modificado**, e os callbacks continuam ligados. Contudo, o carregamento lazy dos painéis, a rota única `/login`, a montagem da primeira aba transacional e o estado de autenticação/Drive formam uma nova sequência. **Sem browser autenticado e Drive de testes, não é possível provar funcionamento perfeito**. Risco de integração, não bug demonstrado.

## 5. Critérios de aprovação antes de qualquer merge ou deploy

**Portão A — automação confiável:** adaptar os verificadores legados a uma função de resolução da rota canônica `app/login/page.tsx`, sem relaxar requisitos de OAuth, billing, TR, backup, URL ou Rules; deixar CI Fast/funcional completamente verde em commit subsequente. Separar falhas de npm registry/instalação de falhas de produto; executar typecheck, build e proteção.

**Portão B — fluxos reais com identidades de TESTE:** fundador, setor externo, UG A/UG B, billing VIP, em teste, vencido, suspenso, conta revogada, primeiro aceite legal, duas sessões simultâneas. Confirmar que trocar modo não faz gravação Firestore, não troca workspace, não invalida sessão nem vaza dados.

**Portão C — documentos (testes sem afetar produção):** cadastrar NE manual e PDF, anexar/baixar/imprimir NE; cadastrar NF e anexar NF + espelho; fechar/abrir painel Drive; emitir TR original e regenerar preservando número, com comissão mensal, visualizar/baixar/imprimir; produzir liquidação consolidada com/sem TR; emitir relatório em período, fornecedor, SAG/NS; editar e salvar NS; salvar cronograma, gerar PDF e testar confirmação de envio com mock/conta sandbox. Validar bytes e conteúdo PDF, não apenas cliques.

**Portão D — modo visual, navegação e integridade:** 20 alternâncias Normal↔Essencial, durante NF digitada, NE aberta, revisão PDF, cronograma em preenchimento, diálogo Drive aberto, upload em progresso, Central de Depósitos e Admin. Testar F5, volta/avança, deep links, equipamento móvel, foco, leitores de código, contrassenha, aviso pendente e terminais lentos/offline. Nenhum comando destrutivo causado pela escolha do modo.

**Portão E — paridade quantitativa e 3D:** comparar lista completa de registros e somas com snapshots controlados, RPNP, classificação e 0/1/60/61/500+ linhas; sem diferença de centavos. Confirmar 3D com câmeras, croqui, scanner, busca, zoom, colisão e edição em PC fraco, FPS/resolução inalterados. Checar ausência de leaks de listeners e dupla subscrição em alternância.

**Portão F — publicação:** somente após A–E aprovados, emitir GO técnico; merge/release por método Vercel autorizado do memorial, com rollback ensaiado. Até então **PR #411 DRAFT / NO-GO**, sem deploy, sem alterar regras Firestore nem motores de NF/estoque.

## 6. Prioridade objetiva dos ajustes

1. **P0 para aceite:** resolver AF-01 (avisos), AF-02 (gate integral), e validar AF-03/AF-06 (drafts/rotas), além de restaurar CI funcional sem enfraquecer as asserções.
2. **P1:** executar os testes da cadeia TR/Drive/relatórios e corrigir inconsistências de logout e CSS órfão.
3. **P2:** paridade financeira e 3D, autorização sandbox/multitenant, performance em hardware modesto e assinatura. **Nenhum percentual de ganho é afirmado sem benchmark.**

## 7. Links e rastreabilidade

- PR: https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/411
- Workflow manual/na PR: `.github/workflows/visual-r2-integrity-audit.yml` (execução ID `40818642040`).
- Registro de implementação: `docs/MODO_ESSENCIAL_MEMORIAL_OFICIAL.md`.
- Auditoria preventiva prévia: `docs/MODO_ESSENCIAL_AUDITORIA_SEGURANCA_R1_2026-10-29.md`.
- Nenhuma alteração de fonte de operações/deploy foi feita nesta auditoria. O único artefato de execução adicionado foi o workflow de teste não destrutivo.

**Conclusão executiva:** os controles internos e a arquitetura das funcionalidades essenciais não foram diretamente simplificados, e há muitos testes de domínio bem-sucedidos; **não há prova de integridade total da experiência do usuário**. Existem achados que justificam NO-GO e testes de contrato legados bloqueando a certificação. A PR deve continuar DRAFT até correções e validação autenticamente operacional.
