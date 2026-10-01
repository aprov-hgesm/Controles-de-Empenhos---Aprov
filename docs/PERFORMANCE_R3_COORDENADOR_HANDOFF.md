# Performance R3 — Memorial / Handoff do Chat Coordenador

Data: **2026-10-01**  
Programa: **Performance R3 — Comercialização**  
Repositório: `aprov-hgesm/Controles-de-Empenhos---Aprov`  
Branch integradora: `feat/performance-r3-commercializacao`  
Baseline original da rodada: `main@22d9fe5f86e2cfbb247eb21bae28e4b2c6cb2a2f`

> Este documento existe para permitir a troca de Chat Coordenador sem depender do histórico de conversa. O novo coordenador deve sempre conferir o HEAD real da branch integradora antes de agir.

## 1. Papel do Coordenador

O Chat Coordenador / Integrador / Avaliador:

- mantém visão global da Performance R3;
- não compete com chats trabalhadores;
- recebe handoffs, revisa diff, métricas, testes, segurança e contratos;
- decide se uma frente está apta a integrar;
- resolve conflitos semanticamente, nunca por `ours/theirs` automático;
- atualiza `docs/PERFORMANCE_R3_INTEGRATION_STATUS.md`;
- atualiza o Memorial Oficial em marcos estruturais;
- conduz PERF-I e PERF-J;
- não faz merge em `main` nem deploy de produção sem autorização explícita do usuário.

Documentos obrigatórios:
1. `docs/EMPROVEX_MEMORIAL_OFICIAL.md`;
2. `docs/PERFORMANCE_R3_COMERCIALIZACAO.md`;
3. `docs/PERFORMANCE_R3_EXECUCAO_PARALELA.md`;
4. `docs/PERFORMANCE_R3_INTEGRATION_STATUS.md`;
5. este documento;
6. `docs/TESTING_POLICY.md`;
7. `docs/DEVELOPMENT_CI_WORKFLOW.md`.

## 2. Estado consolidado

| Frente | Estado | HEAD trabalhador | Integração / referência | Resultado principal |
| --- | --- | --- | --- | --- |
| PERF-A | **INTEGRADA** | `3193b84` | `15eadb0` | root `/`: 460 → 333 kB |
| PERF-B | **INTEGRADA** | `7b7aee1` | incorporada na integradora | Central: 579 → 300 kB |
| PERF-C | **INTEGRADA** | `c263ce3` | `e33e260` | Saída abre sem as consultas específicas antecipadas |
| PERF-D | **INTEGRADA** | `022fae7` | `2e77af1` | intake seletivo + histórico sob demanda |
| PERF-E | **INTEGRADA** | `149f7c3` | `9d5ff58` | grande redução de CPU/varreduras |
| PERF-F | **LIVRE** | — | — | próxima frente ainda não integrada |
| PERF-G | **INTEGRADA** | `de870d1` | `238b813` | shell persistente; Central 300 → 106 kB |
| PERF-H | **INTEGRADA** | `fb5f452` | `a686410` | métricas/budgets reproduzíveis |
| PERF-X | **BLOQUEADA / OPCIONAL** | — | — | só abrir se medições justificarem hot vs history |
| PERF-I | **BLOQUEADA** | — | branch integradora | integração final após frentes necessárias |
| PERF-J | **BLOQUEADA** | — | branch integradora | certificação após PERF-I |

## 3. Build combinado certificado até PERF-G

Último build combinado validado após A/B/C/D/E/G/H:

- `/`: **333 kB First Load JS**;
- `/adm-deposito`: **106 kB**;
- `/adm-deposito/meus-depositos`: **106 kB**;
- `/adm-deposito/cadastro-de-itens`: **106 kB**;
- `/adm-deposito/saida-de-material`: **106 kB**;
- `/adm-deposito/controle-de-depositos`: **106 kB**;
- `/adm-deposito/controle-de-itens`: **106 kB**;
- `/admin`: **327 kB**;
- `/admin/backups`: **244 kB**;
- shared: **104 kB**.

Comparações:
- root: **460 → 333 kB** = -127 kB / **-27,61%**;
- Central: **579 → 300 → 106 kB**;
- Central vs baseline original: -473 kB / aproximadamente **-81,7%**;
- shared: 103 → 104 kB, praticamente estável.

## 4. O que cada frente já resolveu

### PERF-A — Bundle principal

- `app/page.tsx` deixou de carregar grandes superfícies antecipadamente;
- `OperationalWorkspace` funciona como host lazy;
- grandes views têm boundaries dinâmicos;
- shell/Home/auth permanecem no caminho inicial;
- incompatibilidade com guard de classes foi resolvida **no guard**, sem alterar a lógica memoizada da PERF-E;
- Application CI combinado e gates finais passaram.

Regra herdada:
- guard textual quebrado por refatoração pode ser atualizado quando a semântica é preservada;
- falha cruzada entre frentes é do coordenador, não do trabalhador.

### PERF-B — Bundle da Central

- `WarehouseSectionContent` carrega as seis superfícies por `dynamic()`;
- subtabs pesadas também foram desacopladas;
- as seis rotas principais caíram de ~579 para ~300 kB;
- os boundaries da PERF-B são contrato a preservar.

### PERF-C — Saída de Material sob demanda

- abertura fresca não antecipa as antigas consultas específicas da superfície;
- barcode/material/balance são buscados diretamente;
- posições/lotes só para o material necessário;
- destinos somente quando o carrinho exige;
- catálogo amplo apenas para busca manual/unknown barcode;
- FEFO, revalidação transacional, idempotência e proteção contra saldo negativo preservados.

### PERF-D — Fila leve de Recebimento / Intake

Arquitetura:
- caminho `A tratar` usa `intakeQueueIndex` derivado;
- discovery incremental por watermark;
- candidatos ativos paginados;
- NFs/intakes/empenhos buscados por IDs candidatos;
- histórico/reconciliação sob demanda;
- bootstrap histórico único preserva “sem intake = PENDING”.

Métricas sintéticas registradas:
- ~2.151 → ~59 docs: **~97,26%**;
- ~18.751 → ~59 docs: **~99,69%**;
- ~18.751 → ~500 docs: **~97,33%**.

Segurança:
- workspace/UG fail-closed;
- delete físico do índice negado;
- índice derivado não é autoridade de NF/intake/ledger/saldo.

Conflitos resolvidos pelo coordenador:
- PERF-B + D em `WarehouseItemRegistrationOperational.tsx`;
- PERF-H + D em `package.json`.

### PERF-E — CPU e Renderização

Otimizações principais:
- índices `Map`;
- memoização de agregações;
- busca deferida;
- remoção de `.filter/.reduce/.find` repetidos por card.

Benchmarks locais da frente:
- Empenhos: visitas 1.732.500 → 11.250 (**-99,35%**);
- NFs: 3.388.500 → 5.250 (**-99,85%**);
- Itens: 54.072 → 9.072 (**-83,22%**).

Preservar:
- aparência;
- filtros;
- ordenação;
- informação exibida.

### PERF-G — Shell persistente da Central

Arquitetura:
- novo `app/adm-deposito/layout.tsx`;
- `WarehouseProtectedLayout` persiste auth/workspace/status/session;
- `WarehouseWorkspaceProvider` disponibiliza contexto mínimo;
- `WarehouseModuleShell` persiste header/sidebar;
- páginas principais usam somente `WarehouseRouteContent`;
- `WarehouseSectionContent` continua lazy abaixo do shell.

Segurança:
- `/api/adm-deposito/status` com `cache: no-store`;
- fail-closed;
- mudança/revogação de sessão desmonta conteúdo, limpa lease/contexto e faz sign-out;
- layout persistente não vira autoridade de segurança.

Resultado:
- seis rotas principais: **300 → 106 kB**;
- nenhuma mudança visual intencional;
- Application CI combinado, Core, Recovery, build, TypeScript, Diff Hygiene e Blocks 16–21 verdes.

Pendência planejada:
- validação browser/manual de navegação persistente durante PERF-I/PERF-J:
  - entrada direta;
  - troca entre superfícies;
  - URL;
  - header/sidebar;
  - back/forward;
  - refresh direto;
  - usuário externo.

### PERF-H — Métricas e Budget

Baseline versionado:
- `/`: 460 kB;
- Central: 579 kB;
- `/admin`: 326 kB;
- shared: 103 kB.

Comandos:
- `npm run perf:r3:collect`;
- `npm run perf:r3:compare`;
- `npm run perf:r3:budget`;
- `npm run perf:r3:runtime:sanitize`.

Budgets v1:
- rota warning: +10% e +25 kB;
- rota bloqueante: +40% e +150 kB;
- shared warning: +15% e +20 kB;
- shared bloqueante: +50% e +75 kB.

Esses budgets **ainda não estão ligados automaticamente ao Application CI**.

## 5. PERF-F — próxima frente

Status: **LIVRE**.

Dependências satisfeitas:
- PERF-C integrada;
- PERF-D integrada.

Objetivo:
- cache curto **somente em memória** para leituras estáveis remanescentes;
- segregação obrigatória por workspace;
- TTL/invalidação explícita;
- mutação bem-sucedida deve invalidar/atualizar cache;
- nenhum dado operacional sensível em `localStorage`.

Candidatos originais:
- depósitos;
- localizações;
- destinos;
- configurações estáveis.

Regra crítica:
> PERF-F não pode usar cache para esconder consulta ampla ou incorreta. Primeiro confirmar quais reads estáveis realmente sobraram após C/D/G.

PERF-F deve nascer da **branch integradora atual**, não dos baselines antigos da primeira onda.

## 6. PERF-X

Não iniciar automaticamente.

Só abrir se, depois de PERF-F e das medições combinadas, houver evidência de que listeners/dados históricos continuam sendo gargalo relevante.

Sem evidência: marcar como **DISPENSADA**.

## 7. PERF-I — Integração Controlada

Quando as frentes necessárias estiverem fechadas:

1. confirmar quadro oficial;
2. rodar build combinado;
3. executar `perf:r3:collect`;
4. executar `perf:r3:compare`;
5. executar `perf:r3:budget`;
6. rever reads/consultas críticas;
7. executar regressão de segurança/Core;
8. resolver qualquer conflito restante;
9. fazer validação manual/browser da PERF-G;
10. decidir se PERF-X é necessária;
11. preparar estado candidato à certificação.

## 8. PERF-J — Certificação Final

Deve validar:
- TypeScript;
- production build;
- domínio/contratos;
- Core Protection;
- segurança multi-tenant/Firestore;
- Diff Hygiene;
- Blocks finais;
- bundle por rota;
- métricas/budget;
- experiência visual/manual afetada;
- ausência de regressão de reads;
- documentação final.

Browser E2E continua **sob demanda**, não gate permanente.

## 9. Método de integração que funcionou

Para workers divergentes de bases antigas:

1. confirmar HEAD real da integradora;
2. comparar worker vs sua base e integradora vs mesma base;
3. identificar arquivos exclusivos e sobreposições;
4. não fazer rebase/merge no worker só para “ficar mergeable”;
5. montar integração semântica sobre o tree da integradora;
6. nos arquivos sobrepostos, combinar comportamentos intencionalmente;
7. criar commit com integradora como primeiro parent e worker como parent adicional;
8. usar branch/PR técnico temporário para rodar CI combinado;
9. só promover para a integradora após CI combinado verde;
10. atualizar quadro e Memorial.

Casos já resolvidos:
- PERF-A: guard textual antigo vs lógica reorganizada pela PERF-E;
- PERF-D: B + D no componente de intake e H + D no `package.json`;
- PERF-G: scripts H/D + guard G no `package.json`.

Nunca resolver conflito funcional por escolha mecânica de `ours`/`theirs`.

## 10. Política de CI/Testes

Gates automáticos:
- TypeScript;
- build;
- testes de domínio;
- guards estruturais;
- Firestore/isolamento quando aplicável;
- Core Protection;
- Diff Hygiene;
- release gates existentes.

Browser E2E:
- manual/on-demand;
- não tornar gate permanente sem decisão explícita.

Validação manual:
- legítima e recomendada para interação, teclado/scanner, layout, navegação e ergonomia.

## 11. Produção / main

Até este handoff:
- **não houve merge consolidado da Performance R3 em `main`**;
- **não houve deploy consolidado da R3 em produção**;
- o usuário deseja concentrar publicação para evitar limites de deploy da Vercel;
- qualquer merge/release para `main` depende de autorização explícita do usuário.

A `main`/produção continua tendo como baseline da abertura da R3:
`22d9fe5f86e2cfbb247eb21bae28e4b2c6cb2a2f`, salvo alterações externas que o novo coordenador deve conferir.

## 12. Estado da Vercel

Durante PERF-G o Preview automático não foi criado por:
`api-deployments-free-per-day`.

Isso **não foi falha de build**.

Não gastar deploys apenas para validação intermediária quando CI/local forem suficientes.

## 13. Primeiras ações do novo Coordenador

Ao assumir:

1. ler os documentos obrigatórios;
2. executar/fazer consulta do HEAD real de:
   - `main`;
   - `feat/performance-r3-commercializacao`;
   - `perf-r3-f-memory-cache`, se já existir;
3. conferir `docs/PERFORMANCE_R3_INTEGRATION_STATUS.md`;
4. confirmar que A/B/C/D/E/G/H seguem integradas;
5. confirmar se PERF-F ainda está LIVRE ou já foi iniciada;
6. não reabrir A/D/G sem regressão objetiva;
7. preparar/acompanhar PERF-F;
8. depois avaliar PERF-X e conduzir PERF-I/PERF-J.

## 14. Regra para atualização deste documento

Atualizar este handoff quando:
- uma frente for integrada/devolvida/dispensada;
- surgir conflito importante;
- mudar a ordem das dependências;
- houver nova métrica combinada;
- iniciar PERF-I/PERF-J;
- ocorrer troca de Chat Coordenador.

Não transformar este documento em diário de commits. Ele deve continuar compacto e suficiente para retomada.
