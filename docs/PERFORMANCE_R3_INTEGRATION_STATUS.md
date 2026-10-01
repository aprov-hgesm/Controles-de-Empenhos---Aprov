# Performance R3 — Quadro de Integração

Última atualização: **2026-10-01**  
Responsável por atualização: **Chat Coordenador / Integrador / Avaliador**  
Branch integradora: `feat/performance-r3-commercializacao`

Este é o quadro operacional vivo da Performance R3. Ele não substitui o memorial; registra **quem está fazendo o quê e o que já pode ser integrado**.

## Estados permitidos

- `LIVRE` — ainda não atribuída/iniciada;
- `EM ANDAMENTO` — branch/chat ativo;
- `EM REVISÃO` — handoff entregue ao coordenador;
- `DEVOLVIDA` — requer correção pelo trabalhador;
- `BLOQUEADA` — depende de decisão/dependência;
- `APROVADA` — apta para integração;
- `INTEGRADA` — incorporada à branch integradora;
- `DISPENSADA` — medição demonstrou que a frente não é necessária.

## Quadro atual

| Frente | Branch prevista | Estado | Dependência | HEAD trabalhador | Observação |
| --- | --- | --- | --- | --- | --- |
| PERF-A | `perf-r3-a-core-bundle` | INTEGRADA | baseline `076a233` | `3193b84` | Bundle root integrado em `15eadb0`; `/` 460 → 333 kB (-27,61%); CI combinado verde |
| PERF-B | `perf-r3-b-central-bundle` | INTEGRADA | baseline comum | `7b7aee1` | Bundle Central; -48,2% nas rotas principais |
| PERF-C | `perf-r3-c-outbound-demand-loading` | INTEGRADA | baseline `076a233` | `c263ce3` | Saída sob demanda integrada em `e33e260`; abertura fresca 0 reads específicos da superfície |
| PERF-D | `perf-r3-d-intake-queue` | INTEGRADA | baseline `076a233` | `022fae7` | Intake seletivo integrado semanticamente em `2e77af1`; CI combinado/Core/Recovery verdes |
| PERF-E | `perf-r3-e-render-cpu` | INTEGRADA | baseline `076a233` | `149f7c3` | CPU/renderização integrada em `9d5ff58`; gates locais verdes |
| PERF-H | `perf-r3-h-metrics-budget` | INTEGRADA | baseline `076a233` | `fb5f452` | Métricas/budget integradas em `a686410`; CI bloqueante ainda não ativado |
| PERF-F | `perf-r3-f-memory-cache` | INTEGRADA | PERF-C + PERF-D integradas | `570661b` | Cache curto em memória integrado em `14aaa2e`; TTL 30 s; workspace isolado; CI combinado verde |
| PERF-G | `perf-r3-g-central-shell` | INTEGRADA | PERF-B integrada | `de870d1` | Shell persistente integrado em `238b813`; Central 300 → 106 kB; CI combinado/Core/Recovery verdes |
| PERF-X | `perf-r3-x-hot-vs-history` | EM ANDAMENTO | A/B/C/D/E/F/G/H integradas | `f4d9b848` | Auditoria aprovada: listener global de `invoices` é gargalo estrutural; implementação mínima autorizada |
| PERF-I | branch integradora | BLOQUEADA | PERF-X implementada, revisada e integrada | — | Integração final + validação obrigatória de UX |
| PERF-J | branch integradora | BLOQUEADA | PERF-I concluída | — | Certificação |


## Próxima ação coordenada

Com A/B/C/D/E/F/G/H integradas, **não há outra frente de implementação obrigatória aberta antes da decisão sobre PERF-X**.

Sequência:
1. auditoria objetiva da PERF-X: **CONCLUÍDA**;
2. decisão do Coordenador: **PERF-X NECESSÁRIA**;
3. implementar somente o recorte comprovado, começando por `invoices`, e integrar após revisão;
4. liberar PERF-I apenas depois da integração formal da PERF-X;
5. PERF-I deve combinar certificação técnica com o checklist obrigatório de UX;
6. PERF-J certifica o candidato final;
7. `main` e produção continuam proibidas sem autorização explícita do usuário.

Qualquer novo chat deve confirmar o HEAD real de `feat/performance-r3-commercializacao` antes de criar branch ou analisar métricas.



## Decisão do Coordenador — PERF-X

Auditoria recebida em 2026-10-01 e revisada contra o HEAD integrado `f4d9b848735d6ea58e7057ff5f7616bd535f643e`.

Conclusão: **PERF-X NECESSÁRIA — IMPLEMENTAÇÃO AUTORIZADA**.

Evidência confirmada:
- `useOperationalRealtimeCollections.ts` cria `onSnapshot(operationalCollectionRef(...))` sem filtro, limite ou paginação;
- o primeiro snapshot é contabilizado por `snapshot.size`;
- o plano de subscriptions ativa `invoices` nas superfícies normais **Empenhos** e **Nova NF**;
- portanto o snapshot inicial de `invoices` é proporcional ao total histórico da coleção e pode ser recriado ao sair/voltar da superfície;
- `historicalInvoiceQueries.ts` já demonstra o padrão correto para histórico: filtro server-side + paginação sob demanda.

Escopo autorizado:
- corrigir primeiro e prioritariamente **`invoices`**;
- separar conjunto operacional realtime de acesso histórico sob demanda;
- preservar integralmente NFs antigas ainda operacionais;
- preservar detalhes completos por empenho, contagens, totais, pendências, filtros, concluídas e edição;
- não usar corte temporal arbitrário;
- não reabrir A/B/C/D/E/F/G/H;
- não alterar ledger, intakeQueueIndex, cache PERF-F, shell PERF-G, Rules, auth, sessão/lease ou visual sem nova decisão do Coordenador.

A branch `perf-r3-x-hot-vs-history` foi criada da integradora em `f4d9b848...` e pode continuar dessa base. Se a integradora avançar apenas por esta documentação de coordenação, **não fazer merge/rebase apenas para acompanhar docs**; a integração semântica ficará com o Coordenador.

PERF-I permanece **BLOQUEADA** até a PERF-X ser implementada, revisada e integrada.


## Coordenação concluída — PERF-D

PERF-D integrada semanticamente em `2e77af1706a599152dff8ec43a197d68056d5ae2` após validação combinada no PR técnico #205.

Resoluções de conflito:
- `WarehouseItemRegistrationOperational.tsx`: preservados simultaneamente intake seletivo/histórico sob demanda da PERF-D e `dynamic import()` da PERF-B;
- `package.json`: preservados simultaneamente scripts/testes da PERF-D e scripts `perf:r3:*` da PERF-H.

Gates combinados:
- Application CI: **PASS**;
- Production build: **PASS**;
- Final TypeScript: **PASS**;
- Diff Hygiene: **PASS**;
- EMPROVEX Core Protection: **PASS**;
- Recovery Guardrails: **PASS**;
- Blocks 16, 17, 18, 19, 20 e 21: **PASS**.

PERF-F foi concluída e integrada posteriormente em `14aaa2e747fffaf2427ea63f4cd52395545d9a22`.

## Coordenação especial — PERF-A — encerrada

A pausa coordenada da PERF-A foi encerrada após handoff final no HEAD `3193b84117c6c4936ba774ee41c0d8df11b4e3fe`.

Resultado:
- ganho isolado confirmado: `/` **460 → 333 kB** de First Load JS (-127 kB / -27,61%);
- shared isolado: **103 kB**;
- Application CI isolado contra a base congelada: **PASS**;
- incompatibilidade cruzada de `verify:empenho-class-config` foi resolvida pelo coordenador atualizando apenas o guard para a derivação memoizada já válida da PERF-E;
- novo Application CI contra a integradora atual: **PASS** integral;
- Production build, TypeScript, Diff Hygiene e gates 16–21: **PASS**;
- integração técnica: `15eadb0f35f7420c88e6cefdf7cddba84db4cde2`.

Build combinado após reconciliação:
- `/`: **333 kB**;
- rotas principais da Central: **300 kB**;
- `/admin`: **327 kB**;
- shared: **104 kB**.

Decisão: **INTEGRADA**.

## Registro de propriedade

Antes de uma frente mudar de `LIVRE` para `EM ANDAMENTO`, o coordenador deve registrar:
- chat/frente atribuída;
- branch;
- base SHA;
- arquivos de propriedade preferencial;
- arquivos compartilhados previstos;
- dependências;
- métrica de sucesso.

## Revisões em andamento

## Registro de integração

Para cada frente integrada, acrescentar uma entrada:

```text
PERF-X
Branch:
HEAD revisado:
Commit/merge de integração:
Métrica antes:
Métrica depois:
Testes:
Conflitos resolvidos:
Pendências:
Decisão: INTEGRADA
```



### PERF-B — Bundle da Central de Depósitos

Branch: `perf-r3-b-central-bundle`  
HEAD revisado: `7b7aee100f21b6a67f8cb8f94cfdfb3508bc0d57`  
Integração: fast-forward da branch integradora para `7b7aee1`.

Métrica antes:
- rotas principais da Central: **579 kB First Load JS**.

Métrica depois:
- rotas principais da Central: **300 kB First Load JS**;
- redução: **279 kB / aproximadamente 48,2%**;
- shared global: 103 kB → 104 kB.

Testes/gates:
- Application CI: **PASS**;
- EMPROVEX Core Protection: **PASS**;
- Production build: **PASS**;
- TypeScript final: **PASS**;
- Diff hygiene: **PASS**;
- Vercel Preview: **Ready**;
- Browser E2E: não executado, conforme política sob demanda e natureza estrutural da mudança.

Conflitos resolvidos:
- nenhum; a branch era filha direta da integradora, 1 commit à frente e 0 atrás.

Pendências:
- nenhuma da PERF-B;
- PERF-G deve preservar `WarehouseSectionContent` como fronteira de carregamento dinâmico e não reintroduzir imports estáticos das grandes superfícies.

Decisão: **INTEGRADA**.



### PERF-E — CPU e Renderização

Branch: `perf-r3-e-render-cpu`  
HEAD revisado: `149f7c3945eae7cb046175499abe5bf6868eb9bb`  
Commit de integração: `9d5ff5834da61477a1f454a452eb32b19414d23e`.

Medição:
- Empenhos: **1.732.500 → 11.250 varreduras (-99,35%)**;
- Notas Fiscais: **3.388.500 → 5.250 varreduras (-99,85%)**;
- Consulta de Itens/digitação: **54.072 → 9.072 varreduras (-83,22%)**.

Validação executada pelo usuário no clone completo:
- guard PERF-E: **PASS**;
- benchmark/checksum: **PASS**;
- `npm run typecheck`: **PASS**;
- `npm run build`: **PASS**;
- `verify:empenhos-subtabs`: **PASS**;
- `verify:invoice-ns-lifecycle`: **PASS**;
- `verify:emprovex-core-protection`: **PASS**.

Observação de build isolado da PERF-E:
- `/`: 461 kB;
- rotas da Central ainda apareciam com 579 kB porque a branch PERF-E partiu do baseline anterior à integração da PERF-B; a integração combinada preserva a PERF-B na branch R3.

Conflitos resolvidos:
- nenhum conflito de arquivo com a PERF-B;
- integração feita por merge técnico com árvore combinada, preservando ambos os históricos.

Pendências:
- validar novamente build/métricas no estado combinado durante PERF-I/PERF-J.

Decisão: **INTEGRADA**.



### PERF-C — Saída de Material sob demanda

Branch: `perf-r3-c-outbound-demand-loading`  
HEAD revisado: `c263ce36407304867d3e92d9f0af6929d61b715c`  
Commit de integração: `e33e260fdd9dbc7f01b8c60b3d59aa0c7cf1c865`.

Arquitetura antes:
- 8 consultas iniciais;
- teto bounded de até **3.000 documentos** preparados antes do primeiro barcode.

Arquitetura depois:
- abertura fresca da `WarehouseMaterialWithdrawal`: **0 consultas Firestore específicas da Saída**;
- barcode por `getWarehouseBarcodeByCode()`;
- material e saldo consultados diretamente;
- location balances e lotes filtrados pelo material corrente;
- depósitos/localizações/subposições apenas das posições realmente usadas;
- destinos e catálogo manual somente sob demanda;
- cache local limitado a 12 barcodes recentes.

Contratos preservados:
- ledger append-only;
- `warehouse_movement_v1`;
- idempotência de saída;
- saldo não negativo;
- revalidação transacional;
- FEFO;
- lotes e posições;
- isolamento workspace/UG;
- fluxo barcode → quantidade → ENTER/TAB → próximo barcode.

Testes/gates:
- EMPROVEX Core Protection: **PASS**;
- Application CI: **PASS**;
- segurança multi-tenant e externa da Central: **PASS**;
- Phase 6 localizações/transferências: **PASS**;
- Phase 7 estoque/lotes/FEFO: **PASS**;
- Phase 8 barcode/outbound + guard de demand loading: **PASS**;
- Production build: **PASS**;
- Final TypeScript: **PASS**;
- Diff hygiene: **PASS**.

Conflitos:
- nenhum conflito de arquivo com PERF-B/PERF-E;
- os três arquivos da PERF-C estavam idênticos à base original na integradora antes da integração.

Dependência:
- PERF-C satisfaz sua parte da pré-condição da PERF-F;
- PERF-F continua bloqueada até a PERF-D estabilizar as leituras de intake/estruturas compartilhadas.

Decisão: **INTEGRADA**.



### PERF-H — Métricas e Budget

Branch: `perf-r3-h-metrics-budget`  
HEAD revisado: `fb5f45296e28bafcad5489860e143b434c1ebf77`  
Commit de integração: `a6864106c779382f5919a5f1a1dcea812bd896a5`.

Entregas:
- baseline versionado em `ops/performance-r3-baseline.json`;
- budgets em `ops/performance-r3-budgets.json`;
- cenários em `ops/performance-r3-scenarios.json`;
- parser do build Next.js;
- comparação baseline × candidato;
- budget checker;
- sanitização de observações runtime;
- relatório JSON/Markdown;
- scripts npm `perf:r3:*`;
- guard próprio e testes.

Baseline oficial:
- `/`: 460 kB;
- `/adm-deposito`: 579 kB;
- `/admin`: 326 kB;
- shared: 103 kB;
- fonte: Application CI bem-sucedido da `main@22d9fe5f...`.

Política:
- runtime/Web Vitals permanecem informativos/warning;
- thresholds bloqueantes existem apenas no checker explícito;
- **não foram ligados ao Application CI**;
- nenhum Firestore read/listener/write adicional;
- `.performance-r3/` é local e ignorado pelo Git.

Validação recebida:
- parser/budget/sanitização: **3/3 PASS**;
- formato real Next 15: **PASS**;
- log GitHub Actions timestampado: **PASS**;
- baseline real: **PASS**;
- comparação JSON/Markdown: **PASS**;
- guard PERF-H: **READY**;
- syntax check dos novos `.mjs`: **PASS**.

Revisão do coordenador:
- `package.json` e `.gitignore` estavam inalterados na integradora desde a base da PERF-H;
- Application CI não foi modificado;
- sem sobreposição com PERF-B/C/E;
- nenhum `.ts/.tsx` alterado.

Pendência planejada:
- executar `perf:r3:collect`, `perf:r3:compare` e `perf:r3:budget` sobre o estado combinado durante PERF-I/PERF-J.

Decisão: **INTEGRADA**.



### PERF-A — Bundle do EMPROVEX principal

Branch: `perf-r3-a-core-bundle`  
HEAD revisado: `3193b84117c6c4936ba774ee41c0d8df11b4e3fe`  
Commit de integração: `15eadb0f35f7420c88e6cefdf7cddba84db4cde2`.

Métrica:
- `/`: **460 kB → 333 kB** First Load JS;
- redução: **127 kB / 27,61%**;
- shared isolado: **103 kB**.

Arquitetura:
- `app/page.tsx` deixou de importar antecipadamente as grandes superfícies operacionais;
- `OperationalWorkspace` passou a ser host lazy;
- grandes views usam boundaries dinâmicos próprios;
- shell/Home/auth permanecem no caminho inicial;
- estado efêmero continua fora do boundary lazy para preservar continuidade de UI.

Validação:
- Application CI isolado: **PASS**;
- Core Protection: **PASS**;
- TypeScript: **PASS**;
- production build: **PASS**;
- guards estruturais próprios: **PASS**;
- incompatibilidade cruzada com o guard de classes foi resolvida apenas no guard, preservando a lógica memoizada da PERF-E;
- novo Application CI combinado contra a integradora: **PASS**;
- Diff Hygiene e gates 16–21: **PASS**.

Build combinado:
- `/`: 333 kB;
- Central principal: 300 kB;
- `/admin`: 327 kB;
- shared: 104 kB.

Conflitos:
- nenhum dos 10 arquivos da PERF-A havia sido alterado por B/C/E/H;
- conflito era semântico em guard textual, resolvido pelo coordenador.

Decisão: **INTEGRADA**.




### PERF-D — Fila leve de Recebimento / Intake

Branch: `perf-r3-d-intake-queue`  
HEAD revisado: `022fae7a48def20f9279ad6223ce42cd4f539b8c`  
Commit certificado de integração: `2e77af1706a599152dff8ec43a197d68056d5ae2`.

Arquitetura:
- caminho normal `A tratar` usa índice derivado mínimo `intakeQueueIndex`;
- novas NFs são descobertas desde watermark com sobreposição de 5 minutos;
- candidatos ativos são paginados;
- NFs/intakes/empenhos são buscados apenas pelos IDs candidatos;
- histórico, tratadas e reconciliação são carregados sob demanda;
- bootstrap histórico permanece possível uma única vez para preservar o contrato “sem intake = PENDING”.

Métricas sintéticas registradas:
- cenário A: ~2.151 → ~59 docs (**~97,26%**);
- cenário B: ~18.751 → ~59 docs (**~99,69%**);
- cenário C: ~18.751 → ~500 docs (**~97,33%**).

Limites principais:
- candidatos: 250/página × 20 páginas = até 5.000;
- discovery/bootstrap: 200 NFs/página;
- consultas por ID: lotes de até 30 IDs;
- movimentos legados: até 51 por NF candidata;
- histórico NFs: 300 × 40 páginas;
- histórico intakes: 500 × 40 páginas.

Segurança:
- Rules do `intakeQueueIndex` preservam workspace/UG e fail-closed;
- delete físico negado;
- índice derivado não é autoridade de NF, intake, ledger ou saldo;
- testes multi-tenant/Firestore: **PASS**.

Validação:
- CI isolado da PERF-D: **PASS**;
- CI combinado da integração semântica: **PASS**;
- Core Protection combinado: **PASS**;
- Recovery Guardrails combinado: **PASS**;
- Production build, TypeScript e Diff Hygiene: **PASS**;
- Blocks 16–21 finais: **PASS**.

Conflitos resolvidos:
- PERF-B + PERF-D em `WarehouseItemRegistrationOperational.tsx`;
- PERF-H + PERF-D em `package.json`.

Dependência:
- PERF-F foi posteriormente concluída e **INTEGRADA**.

Decisão: **INTEGRADA**.


### PERF-G — Shell/Layout persistente da Central

Branch: `perf-r3-g-central-shell`  
HEAD revisado: `de870d1cb81f5d0eab2faba2fcabed354f35953b`  
Commit de integração semântica: `238b813795be05ad7142973f1566b8fead9d055d`.

Arquitetura integrada:
- `app/adm-deposito/layout.tsx` passou a hospedar o boundary persistente da Central;
- auth/workspace/status continuam fail-closed no `WarehouseProtectedLayout`;
- sessão/lease de usuário externo permanece monitorada enquanto o layout está montado;
- `WarehouseModuleShell` persiste entre as rotas principais;
- cada página entrega somente `WarehouseRouteContent`;
- `WarehouseSectionContent` continua abaixo do boundary e preserva os `dynamic()` da PERF-B;
- a PERF-D permanece integralmente dentro do chunk de `WarehouseItemRegistrationOperational`.

Conflito resolvido semanticamente:
- `package.json`: preservados scripts/testes da PERF-D, scripts `perf:r3:*` da PERF-H e adicionado `verify:performance-r3-central-shell`;
- nenhum outro arquivo da PERF-G havia sido alterado pela integradora desde sua base.

Build combinado após A/B/C/D/E/G/H:
- `/`: **333 kB** First Load JS;
- seis rotas principais da Central: **106 kB** cada;
- shared global: **104 kB**;
- `/admin`: **327 kB**;
- `/admin/backups`: **244 kB**.

Impacto da PERF-G sobre as rotas principais da Central:
- **300 kB → 106 kB**;
- redução adicional aproximada: **194 kB / 64,7%**;
- referência pré-R3: aproximadamente **579 kB**.

Validação:
- Application CI isolado da PERF-G: **PASS**;
- Application CI combinado no PR técnico #206: **PASS**;
- Production Build: **PASS**;
- Final TypeScript: **PASS**;
- Diff Hygiene: **PASS**;
- Blocks 16–21: **PASS**;
- Core Protection combinado: **PASS**;
- Recovery Guardrails combinado: **PASS**;
- segurança externa, walking skeleton e fases da Central afetadas: **PASS**.

Observação:
- Preview Vercel da branch trabalhadora não foi produzido por limite diário da conta, não por falha de build;
- validação browser/manual da navegação persistente continua indicada para PERF-I/PERF-J quando houver ambiente disponível.

Decisão: **INTEGRADA**.


### PERF-F — Cache curto em memória

Branch: `perf-r3-f-memory-cache`  
Base original do worker: `79f54e2fd4109b8c56cc2f8c0deb1234af1238f5`  
HEAD revisado: `570661ba498edd37ba4c8f0240044d4ee6613bed`  
PR de validação: **#207**  
Commit de integração: `14aaa2e747fffaf2427ea63f4cd52395545d9a22`.

Escopo integrado:
- cache exclusivamente em memória para depósitos, localizações/subposições e destinos;
- leituras individuais de depósito/localização cacheadas apenas para apresentação da Saída;
- TTL explícito de **30 segundos**;
- chave por `workspaceId + variante`;
- deduplicação de requests simultâneos;
- geração interna para impedir repovoamento stale após invalidação;
- configuração logística deliberadamente não cacheada;
- nenhum uso de `localStorage`, `sessionStorage`, IndexedDB, listener ou coleção nova.

Autoridade preservada:
- `assertDepotCodeAvailable()` usa leitura Firestore uncached;
- `assertLocationCodeAvailable()` usa leitura Firestore uncached;
- `requireActiveDestination()` continua com `getDoc()` autoritativo;
- APIs históricas sem sufixo `Cached` continuam uncached;
- auth, workspace/UG, sessão, lease, ledger, saldos, lotes, intake, NF, empenhos, cronogramas e demais dados operacionais críticos permanecem fora do cache.

Invalidação:
- criação/edição de depósito invalida depósitos;
- criação/edição de localização invalida localizações;
- criação/alteração de status de destino invalida destinos;
- invalidação ocorre apenas depois da escrita bem-sucedida;
- resposta antiga já em voo não pode repovoar o cache depois da mutação.

Métrica sintética controlada:
- jornada Início → Alocação → SISCOFIS → Meus Depósitos;
- antes: **8 carregamentos estruturais** / fórmula `4 × (D + L)`;
- depois, dentro do TTL: **2 carregamentos** / fórmula `D + L`;
- conjunto sintético do teste: 64 → 16 document-equivalents;
- redução do recorte: **75%**;
- números explicitamente sintéticos, não apresentados como contagem de produção.

Validação:
- teste específico PERF-F: **11/11 PASS** no harness do worker;
- PR #207 foi aberto contra a integradora já em `481948f`;
- merge virtual validado: `3ea9eb6378de23a849ed84b331cac39de4a1ddd7`;
- o log do Application CI #860 confirma checkout de `refs/pull/207/merge`, portanto o CI foi executado sobre **PERF-F + os commits de UX da integradora**;
- Application CI #860: **PASS**;
- Production Build: **PASS**;
- Final TypeScript: **PASS**;
- Diff Hygiene: **PASS**;
- Core Protection: **PASS**;
- Recovery Guardrails: **PASS**;
- segurança multi-tenant/externa e fases afetadas da Central: **PASS**.

Build combinado após A/B/C/D/E/F/G/H:
- `/`: **333 kB**;
- rotas principais da Central: **106 kB**;
- `/admin`: **327 kB**;
- `/admin/backups`: **244 kB**;
- shared: **104 kB**.

Risco residual conhecido:
- mudança feita por outra sessão/navegador pode permanecer visualmente stale por até 30 segundos;
- operações críticas não usam esse cache como autoridade;
- PERF-I deve validar esse comportamento como parte do checklist obrigatório de UX.

Conflitos:
- nenhum conflito de código com os dois commits que avançaram a integradora durante a execução da PERF-F; eles alteravam apenas Memorial Oficial e Handoff do Coordenador.

Decisão: **INTEGRADA**.

## Handoff do Coordenador — 2026-10-01

A coordenação desta conversa foi consolidada para troca de chat.

Fonte de retomada:
- `docs/PERFORMANCE_R3_COORDENADOR_HANDOFF.md`.

Estado consolidado no momento do handoff:
- A/B/C/D/E/F/G/H: **INTEGRADAS**;
- PERF-F: **INTEGRADA** em `14aaa2e`;
- PERF-X: **BLOQUEADA / OPCIONAL**;
- PERF-I: **BLOQUEADA** até decisão objetiva sobre PERF-X;
- PERF-J: **BLOQUEADA** até PERF-I;
- sem merge consolidado em `main`;
- sem deploy consolidado de produção da R3.

O novo coordenador deve conferir HEADs reais antes de agir e não deve reconstruir estado a partir de chats antigos quando a documentação oficial já registrar a decisão.

## Regra

Chats trabalhadores **não atualizam este quadro para se autoaprovar**. Eles entregam o handoff; o chat coordenador atualiza o estado após revisão.
