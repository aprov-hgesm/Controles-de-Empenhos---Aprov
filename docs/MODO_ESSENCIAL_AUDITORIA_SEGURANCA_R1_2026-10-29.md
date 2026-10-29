# EMPROVEX — Auditoria preventiva de segurança e continuidade — Modo Essencial R1

**Data:** 29/10/2026
**Branch examinada:** `feat/visual-mode-r1-session-navigation`
**Escopo:** navegação e alternância Normal/Essencial; rotas `/` e `/login`; autenticação e perfil fundador/setor; aceite legal; controle de assinatura e pagamentos; regras e listeners Firestore; sessão/lease; administração; Central de Depósitos e 3D; ações financeiras, drafts e documentação da R2.
**Natureza:** inspeção estática dirigida de arquivos atuais do GitHub. **Não** é pentest, auditoria de todas as APIs, execução de CI, emuladores, testes E2E, medição de leituras reais, prova de regra efetivamente implantada ou certificação de integridade em produção. Não houve acesso à configuração ativa Vercel/Firebase Console.
**Ação realizada:** apenas auditoria, verificação de contratos e documentação; **nenhuma alteração de código de aplicação, Firestore, Rules, API, produção ou deploy**.

> **Decisão:** **GO CONDICIONAL** para correções de compatibilidade/gates antes da R2-A. **NO-GO** para merge, deploy ou refatoração mais invasiva R2-B/R2-C enquanto os bloqueadores AS-01 e AS-02 não estiverem corrigidos e inspecionados. Não há evidência nesta auditoria de corrupção persistida ou de exploração de acesso causada pelo seletor; isso **não** comprova ausência de regressões.

## 1. Proteções confirmadas no código examinado

1. **Seleção é apresentação, não autoridade:** `components/visual-mode/VisualModeProvider.tsx` (linhas 16–72) usa exclusivamente `sessionStorage`, estado React e `document.documentElement.dataset.visualMode`. Não cria coleções, grava valores nem transmite ao Firebase um token de "modo". Valor inválido retorna ao Normal.
2. **Sessão e workspace independem da aparência:** `lib/platformAccess.ts` (~192–280) verifica provedor, conta, vínculo UID/e-mail e workspace; `lib/platformSessionControl.ts` (~90–200) observa mudanças de conta/UG, revogações e renova o lease. **Não remover ou condicionar esses controles ao Essencial**, incluindo as duas sessões independentes da mesma UG.
3. **Cobrança server-authoritative:** `lib/sectorBillingGate.ts` chama `GET /api/billing/portal?view=access`; `app/api/billing/portal/route.ts` obtém identidade da requisição através de `resolveBillingPortalSession`, deriva tenant do token/conta (não da preferência visual), e chama `readSectorBillingAccess`. `app/login/page.tsx` mantém estado `checking|allowed` com negação antes da superfície operacional.
4. **Firebase como data-plane:** `firestore.rules`, funções `canAccessWorkspaceIdentity` / `canAccessWorkspace` (linhas ~133–176), vinculam tenant, conta, status e, quando enforcement de cobrança está configurado, `billingEntitlementUntil`. Regras de `empenhos`, `invoices`, `comissoes`, `cronogramas`, snapshots e legal aceites permanecem no namespace do workspace (~2338–2470). Este é o **código** das regras, não a configuração efetiva da produção.
5. **Central de Depósitos protegida:** `app/central-depositos/layout.tsx` monta `WarehouseProtectedLayout`, cujo `WarehouseAccessBoundary` (~72–135) exige contexto de setor, verificação de assinatura e `GET /api/central-depositos/status` com token Firebase; `lib/server/warehouseAccess.ts` verifica o token, conta, UID, workspace, UG e claims no servidor. As funções server-side têm cache positivo **curto de 30s** de billing quando habilitado, sem depender do modo visual. Isto não substitui a revisão de todos os endpoints mutáveis.
6. **Dados operacionais possuem um plano de realtime por aba:** `lib/operationalSubscriptionPlan.ts` e `hooks/useOperationalRealtimeCollections.ts` (~333–430) distinguem cinco coleções, com unsubscribe na desmontagem dos efeitos. `useInicioOperationalSnapshot` tem fluxo próprio de snapshot. **Mudança de aba pode alterar o número de listeners**, mas mudança de preferência visual não deve, isoladamente, criar novas leituras, escritas ou assinaturas.
7. **3D preservado no diff:** a branch da R1 não alterou renderizadores, geometria, câmeras ou motor de movimentação. `WarehouseModuleShell.tsx` conserva a seção `overview` como imersiva; `AppBackground` não escolhe o fundo reduzido para `immersive`. `app/visual-mode-essential.css` tem seletores dirigidos à casca externa, não a `warehouse-emprovex-content`.

## 2. Achados por prioridade, impacto e correção segura

### AS-01 — BLOQUEADOR P0 — Duas portas de entrada com contratos diferentes de cobrança

**Evidência:**
- `hooks/useOperationalData.ts` linhas **107–154**: terceiro parâmetro `billingAccessGranted: boolean = false`, que compõe `operationalAccessEnabled`, exigido para assinar todas as coleções operacionais.
- `app/login/page.tsx` linhas **33–100**, **~239–244**: mantém `billingAccessState`, consulta o gate server-side e chama `useOperationalData(activeTab, acceptedLegalIdentityKey, billingAccessState === 'allowed')`.
- `app/page.tsx` linha **78**: chama `useOperationalData(activeTab, acceptedLegalIdentityKey)` **sem o terceiro parâmetro** e não possui gate `checking|allowed` equivalente.

**Conclusão de código:** na rota `/`, quando realmente renderizada como aplicação operacional, `billingAccessGranted` permanece `false`; as assinaturas operacionais não são habilitadas, com potencial de loading permanente/ausência de dados mesmo após login e aceite. Trata-se de **falha de disponibilidade por bloqueio (fail-closed)**, **não** de demonstração de bypass de cobrança. A divergência **já existia na `main`**; não foi introduzida pela simplificação da R1. O domínio pode apresentar landing/rewrite em `/`, não comprovados nesta revisão, mas o código não pode ser publicado acreditando que ambas as entradas são equivalentes.

**Correção obrigatória:** eleger **um único proprietário canônico do gate** e fazer `/` encaminhar de maneira segura à rota operacional aprovada (`/login`) ou consumir o mesmo gate com o mesmo estado de autorização; jamais "corrigir" passando `true` ou removendo `billingAccessGranted`. Não criar dupla cobrança/duplo `onSnapshot`. Não inferir acesso da aparência.

### AS-02 — BLOQUEADOR P0 — Modo Essencial não integrado à rota operacional `/login`

**Evidência:**
- `app/login/page.tsx` linhas **56–67** mantém `activeTab='inicio'` sem consultar `useVisualMode`; linhas **~323–344** renderizam `<InicioView />` por import estático; linha **~320** envia ao Warehouse `/central-depositos` sem respeitar destino Essencial.
- `app/page.tsx` linhas **60–74, 315, 330–344** implementou `modo Essencial -> Painel`, tela Início lazy e destino direto `/central-depositos/controle-de-itens`.
- `components/layout/AppSidebar.tsx` (~135–146) **oculta** Início no modo Essencial, por ser compartilhado pelas duas rotas.

**Impacto:** um usuário em `/login` pode selecionar Essencial, mas continuar no Início pesado com menu já ocultando a entrada; há disparidade entre módulos, consumo de recursos e navegação inconsistente. A seleção visual em si não eleva permissões.

**Correção obrigatória:** unificar a navegação operacional e seus handlers por um componente/entrypoint canônico, **preservando o gate de cobrança e `/login?tab=cronogramas`**. Remover duplicação perigosa das duas páginas, não simplesmente copiar trechos. Não perder estado de NF/emp em uma troca.

### AS-03 — ALTO P1 — Quantidades da NF podem ser zeradas por atualização de empenhos

**Evidência:** `app/login/page.tsx` linhas **~151–164** e `app/page.tsx` linhas **~155–168** usam `useEffect(..., [selectedNFCommitmentId, empenhos])` e chamam `setNfQuantities` para zerar todas as quantidades do empenho selecionado. Uma atualização da lista de empenhos pode disparar o efeito mesmo sem o usuário trocar de NF.

**Impacto possível:** perda de edição **não salva**; se o usuário depois confirmar sem perceber, os valores incorretos podem entrar no fluxo de cadastro. **Não há evidência de gravação indevida provocada pela alternância visual**, mas navegação/assinaturas e mudanças de identidade tornam essa fragilidade relevante antes da R2-B/R2-C.

**Correção segura:** inicializar apenas na troca **real da NE selecionada** ou na abertura explícita de novo cadastro; preservar o draft por entidade/sessão, proteger mudança de aba com dados alterados e validar quantidades na confirmação. Teste por atualização de snapshot durante digitação, troca de modo, volta de aba e envio.

### AS-04 — ALTO P1 — Risco de corridas na navegação local da Central

**Evidência:** `WarehouseModuleShell.tsx` linhas **40–130** mantém `routeSection` do Next `usePathname`, estado local `activeSectionId`, `hasLocalTabNavigation`, `history.pushState/replaceState`, listener `popstate` e efeitos dependentes do modo, incluindo redirecionamento de `home` para `control`.

**Impacto possível:** estados/URLs brevemente inconsistentes ao alternar modos com navegação pendente; render da seção errada, perda de estado de formulários montados dentro de seção ou ida indevida à landing em retorno por histórico. **Hipótese de risco, não falha reproduzida**. `WarehouseAccessBoundary` continua protegendo a rota.

**Correção segura:** tornar URL/rota uma fonte de verdade, não dois estados concorrentes; redirecionar de forma idempotente, guardar estado de formulário antes de desmontar seção, verificar `history.state`, `popstate`, query/hash, cliques rápidos, F5, back/forward, links diretos e 3D. Não alterar renderizador nem remover controles de acesso.

### AS-05 — MÉDIO P1 — Listener marca a coleção pronta mesmo sob erro

**Evidência:** `hooks/useOperationalRealtimeCollections.ts` linhas **~145–168** e **~248–305** encaminham falha a `handleFirestoreError` mas também executam `setCollectionReady(..., true)`, preservando a última coleção em memória. Este comportamento já é anterior à R1.

**Impacto possível:** usuário pode visualizar dado **stale** quando a assinatura falhou por permissão expirada, cobrança, rede ou conta desativada. Não é acesso adicional conferido pelo modo; é clareza de integridade e disponibilidade. Alterar o modo não pode ser usado para "reanimar" dados que o Firebase passou a negar.

**Correção segura:** separar `ready`, `fresh/stale`, `permission-denied`, `offline`; mostrar estado de sincronização inequívoco e bloquear confirmações perigosas quando a autoridade/versão é desconhecida, sem levar a spinner eterno nem apagar drafts. Não remover `onSnapshot` necessários por estética.

### AS-06 — MÉDIO P1 — Mudança de modo com operações abertas/drafts/modais

**Evidência:** `app/page.tsx` atual altera `activeTab` ao escolher Essencial a partir de Início; `PlatformAdminView.tsx` redireciona Início para `overview`, e `WarehouseModuleShell.tsx` redireciona `home` para `control`. O plano R2-C propõe particionar hooks e telas já dinâmicas de `OperationalWorkspace`.

**Risco:** desmontagem de componentes pode perder anexos selecionados, inputs, prévias, escolhas de itens, NS/NF, modal de confirmação, upload em curso ou callbacks em voo, caso futuras refatorações mudem `key`/fronteiras de montagem. **Nenhuma corrupção efetiva foi observada**. Trocar **apenas aparência** em qualquer tela operacional não deve trocar `workspaceId`, UID, corpo de requisição, validação ou estado de transação.

**Diretriz:** permitir alternância **in situ** de modo quando houver trabalho em progresso; nunca remontar o app inteiro por `key={mode}`, nunca reemitir post/save/delete, e não bloquear artificialmente a sessão. Em redirecionamentos apenas de landing, preservar o estado das telas operacionais existentes.

### AS-07 — MÉDIO P1 — Consistência do entitlement durante a sessão

**Evidência:** `app/login/page.tsx` consulta `/api/billing/portal?view=access` no carregamento/mudança de identidade; `AppHeader.tsx` observa o status comercial via `useWorkspaceBillingAccount`; `firestore.rules` contém `billingEntitlementUntil`; `WarehouseProtectedSurface` tem gate adicional e o server warehouse revalida billing quando enforcement está ativo, com cache positivo de 30s.

**Risco:** vencimento, suspensão, cancelamento ou regularização enquanto o usuário já está no app podem produzir discrepância temporária entre banner, dados e acesso à Central. Não substituir gates por checagem de `billingAccount.status` no client, nem permitir acesso por valor em `sessionStorage`. Verificar também contratos legados, VIP, trial, 48h, expiração e pagamento confirmado.

**Diretriz:** contrato canônico de assinatura validado no servidor/data-plane, estado visível de revalidação e invalidação segura de operações após perda de entitlement. Troca Normal/Essencial não deve executar checkout, renovar assinatura ou materializar créditos.

### AS-08 — MÉDIO P2 — Revogação, mudança de perfil e limpeza de preferências

**Evidência:** `startWorkspaceSessionControl` mantém listeners e heartbeat independentes do modo; `VisualModeProvider.clear()` remove preferência; `app/login/page.tsx` não chama esse `clear` no próprio logout, ao contrário de `app/page.tsx`; `PlatformAdminView` possui pelo menos duas superfícies de logout com handlers diferentes (cabeçalho e sidebar). A configuração do modo vive na aba, não no workspace.

**Risco:** aparência pode persistir após um logout em algumas rotas, apesar da política documental de limpeza; o seletor pode reiniciar ao trocar de identidade sem intenção. Isso **não equivale a vazamento de dados**, mas o contrato fica inconsistente. Não limpar leases ou derrubar identidade quando o usuário apenas muda visual.

**Diretriz:** centralizar `signOut + clearVisualMode` por identidade e fazer toda superfície chamar o mesmo handler; sessão revogada sempre limpa tokens/contexto e data stores; trocar apenas modo não remove lease nem listeners de segurança.

### AS-09 — MÉDIO P2 — Custos e sincronização Firebase por troca indireta de aba

**Evidência:** `useOperationalRealtimeCollections` seleciona plano por `activeTab`; `useInicioOperationalSnapshot` mantém projeção de Início, pode publicar snapshot quando Empenhos/NF/Avisos estão ativos; `useWorkspaceDriveStorage` e `useWorkspaceBillingAccount` têm efeitos próprios.

**Risco:** transição automática de Início para Painel altera assinaturas de forma legítima; remount de providers/camadas por modo poderia disparar consultas redundantes, listeners simultâneos e estados perdidos. Refatoração de UI não deve invalidar cache do tenant, atualizar `homeSnapshot`, reabrir Google Drive nem provocar new writes por preferência.

**Diretriz:** manter provider visual fora dos hooks de dados; não usar modo em dependências de `resolveAuthenticatedWorkspaceContext`, cache, IAM, cobranças ou operações; medir leituras antes/depois em cenários de troca 20x e duas sessões na mesma UG.

### AS-10 — MÉDIO P2 — Preservação da área 3D, mobile e acessibilidade

**Evidência:** `WarehouseModuleShell` mantém `overview` como imersiva; CSS Essencial atual toca apenas casca. `MobileNavigation` e `WarehouseSidebar` mantêm botões operacionais.

**Risco:** futura regra global `animation:none`, `pointer-events:none`, `display:none`, `opacity:0` ou `will-change` sobre DOM comum pode atingir loaders, feedback de erro, scanner, mapa 2D/3D ou elementos interativos, mesmo sem modificar arquivos do renderizador.

**Diretriz:** nenhum CSS universal, nenhum descendente `warehouse-emprovex-content`/3D, nenhum corte de FPS, câmera, geometrias, rótulos, zoom/pan, barcode ou filtros operacionais. Alternância de modo nunca deve recriar/reiniciar cena 3D nem alterar visualização de um depósito.

### AS-11 — MÉDIO P2 — Administração: permissão de ação e navegação

**Evidência:** `app/admin/page.tsx` checa contexto `platformAdmin`; `PlatformAdminView.tsx` oculta só a landing administrativa no Essencial. Outros painéis serão candidatos a `React.lazy` na R2-A, inclusive assinaturas, backup, sessões, setores e segurança.

**Risco:** lazy-load e refatorações podem criar botão visível antes da autorização resolvida, modais sem feedback ou duplicar side effects. **Somente** a checagem server-side/Firestore Rules constitui permissão; esconder uma aba não revoga nem confere direitos.

**Diretriz:** mesma autorização independente da aba e do modo; não prefetch/consultar dados de outro tenant; fallback de loading sem duplicação de requisição; preservar revogação, pagamento e recuperação íntegros.

## 3. Provas rápidas de código (não testes executados de fluxo)

Inspeção automatizada de **14 contratos estáticos** na branch:
- **9/9 salvaguardas identificadas**: modo no `sessionStorage` sem Firebase; Warehouse com token e billing; backend valida conta/UID/UG; regras por workspace/entitlement; gate de cobrança em `/login`; bloqueio da UI até acesso; 3D fora de estilos decorativos; controle de revogação; listeners por aba.
- **5 lacunas confirmadas**: `/` não repassa billing/guard; `/login` não integra o modo à aba ativa; Início de `/login` não é lazy; efeito de quantidades NF zera em snapshots. Essas inspeções verificam presença/ausência de contratos **no código**, não comportamento no navegador.

**Não realizado:** build, CI, replay E2E, emulador Firestore, pentest, teste de regras implantadas, observação do tráfego HTTPS, autenticação real, operações de estoque reais, testes de faturamento ou benchmark de hardware. Não há dado suficiente para dizer que existe uma vulnerabilidade explorável em produção, nem para dizer que o sistema está certificado seguro.

## 4. Portões mínimos antes de avançar R2

**GATE-0 (bloqueante para R2-A/R2-B/C):** resolver AS-01 e AS-02 em código: um caminho canônico de entrada; gate de assinatura servidor equivalente e `fail-closed`; mesmo comportamento Essencial em `/login`, `/` e Central; `?tab=cronogramas` preservado. Após corrigir, fazer um build básico ou no mínimo typecheck de todas as rotas modificadas **antes do primeiro merge**.

**GATE-1 (antes de R2-B/C):** proteger draft de NF (AS-03), não remontar formulários por modo, não transformar paginar/filtrar visualização em alteração dos dados/cálculos. Alertas, erros, confirmação, retries, idempotência e rollback permanecem presentes.

**GATE-2 (antes de mexer em listeners/API):** executar pequeno teste de autorização com duas UGs, usuário ativo, trial expirado, suspenso/VIP, sessão revogada, conta com acesso restrito, e verificação de isolamento. Não usar conta de produção para ações destrutivas.

**GATE-3 (antes de habilitar modo em produção):** alternar Normal↔Essencial 20 vezes com NF/NE em rascunho, envio em andamento, Central/3D aberta, falha de rede, F5/back/forward, `/login?tab=cronogramas`, duas máquinas numa UG; verificar que nenhuma mutação é disparada por clique de preferência, que o draft se mantém e que 3D não regrede.

**GATE-4 (antes de qualquer deploy):** build/CI, emulador Rules ou testes de permissão equivalentes, controles financeiros, diferença de payload/listeners, screenshot/inspeção funcional da Central 3D e rollback/release documentado, com autorização expressa do Fundador. Sem atalho de `billingAccessGranted=true`, alteração de Rules ou desligamento de sessão.

## 5. Matriz de invariantes para o implementador

| Aspecto | Invariante nos dois modos |
|---|---|
| Identidade | Mesmo UID/e-mail verificado/provedor, contexto, UG e workspace |
| Permissões | Mesma decisão server-side + Rules, sem exceção por aparência |
| Assinatura | Mesmo entitlement ativo, trial, VIP, 48h, suspenso, cancelado e regularização |
| Leitura Firebase | Mesma consulta necessária para a mesma aba; sem duplicação indevida |
| Escrita Firebase | **Zero escrituras disparadas por alternância visual**; mesmas transações quando o usuário executa ação |
| Sessões | Mesmo lease, heartbeat, expiração e revogação |
| Drafts | Não zerar form sem escolha explícita; não perder dados por remount/visual mode |
| Navegação | IDs, URLs, histórico e autorização equivalentes, salvo landing visual suprimida no Essencial |
| Central 3D | Mesmos objetos, comandos, FPS/resolução/configuração, disponibilidade e detalhes |
| Admin/Drive | Mesmos direitos, upload, exclusão, backup, regularização e controles de segurança |
| Feedback | Busy/error/success, confirmações, status stale/offline, foco e teclado visíveis |
| Recuperação | Erro visual não modifica base; modo volta ao Normal por ação do usuário |

## 6. Encaminhamento

1. **Pausar as otimizações R2-A/B/C como estão**, mas não bloquear o desenvolvimento de correção dos gates e rotas identificados.
2. Iniciar **hardening de compatibilidade AS-01 + AS-02**, sem mudar regras, servidor, Firestore ou operações. Em seguida proteger drafts/estado (AS-03) antes da segmentação financeira/administrativa.
3. Só após inspeção do fluxo crítico iniciar lazy loading de telas da R2-A e pré-agregação da R2-B; nunca presumir que front-end mais simples seja mais seguro sem testes.
4. Manter esta auditoria como **pendência de segurança e disponibilidade**, não como certificado de que todas as rotas estão livres de bugs.

**Bibliografia primária:** código-fonte atual da branch (rotas e hooks acima) e [Memorial Oficial do Modo Essencial](./MODO_ESSENCIAL_MEMORIAL_OFICIAL.md). Links para os arquivos seguem o prefixo `https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/feat/visual-mode-r1-session-navigation/`.
