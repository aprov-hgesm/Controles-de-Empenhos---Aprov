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
- trata **experiência do usuário como prioridade principal do EMPROVEX e critério de aceitação da R3**;
- bloqueia a certificação quando um ganho técnico introduzir perda de dados digitados, estado inesperado, feedback insuficiente, dificuldade operacional nova ou regressão perceptível de ergonomia;
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
| PERF-F | **INTEGRADA** | `570661b` | `14aaa2e` | cache curto 30 s; isolamento por workspace; 8 → 2 loads no cenário sintético |
| PERF-G | **INTEGRADA** | `de870d1` | `238b813` | shell persistente; Central 300 → 106 kB |
| PERF-H | **INTEGRADA** | `fb5f452` | `a686410` | métricas/budgets reproduzíveis |
| PERF-X | **INTEGRADA E CERTIFICADA** | `8aac69a` | `2aca0dce` + correção `2b72d43` | hot/history certificado; CI #868 verde |
| PERF-I | **APROVADA E ENCERRADA** | — | branch integradora até `6ebbf45b` | integração + métricas + UX + segurança concluídas |
| PERF-J | **LIVRE / PRÓXIMA** | — | branch integradora | certificação final consolidada |


## 2.1. Ponto de retomada para os próximos chats

Estado canônico da rodada:
- branch integradora: `feat/performance-r3-commercializacao`;
- HEAD funcional certificado antes desta atualização documental: `6ebbf45b80748bdd17dbdf5a29c4a0dd7fd1dbeb`;
- `main`: `22d9fe5f86e2cfbb247eb21bae28e4b2c6cb2a2f`;
- A/B/C/D/E/F/G/H/X: **INTEGRADAS**; PERF-X também **CERTIFICADA**;
- PERF-I: **APROVADA E ENCERRADA**;
- PERF-J: **LIVRE / PRÓXIMA FASE**;
- nenhuma integração R3 em `main`;
- nenhum deploy consolidado R3 em produção.

Ordem obrigatória daqui em diante:
`PERF-J (certificação final) → autorização explícita do usuário → main/release`.

Regra de retomada:
- novos trabalhos devem partir da integradora **atual**, nunca dos baselines históricos;
- A–H são contratos integrados e só podem ser tocadas por regressão objetiva;
- UX é critério bloqueante, não item cosmético;
- Browser E2E permanece sob demanda; a validação manual/dirigida obrigatória da PERF-I já foi concluída;
- não reabrir PERF-I nem A–X sem regressão objetiva;
- evitar deploys Vercel intermediários quando CI/local forem suficientes.


## 3. Build combinado certificado pela PERF-I

Coleta final executada com `perf:r3:collect` no estado integrado:

- `/`: **335 kB First Load JS**;
- `/adm-deposito`: **106 kB**;
- `/adm-deposito/meus-depositos`: **106 kB**;
- `/adm-deposito/cadastro-de-itens`: **106 kB**;
- `/adm-deposito/saida-de-material`: **106 kB**;
- `/adm-deposito/controle-de-depositos`: **106 kB**;
- `/adm-deposito/controle-de-itens`: **106 kB**;
- `/admin`: **327 kB**;
- `/admin/backups`: **245 kB**;
- shared: **104 kB**.

Comparações finais:
- root: **460 → 335 kB** = **-27,17%**;
- Central: **579 → 106 kB** = **-81,69%**;
- `/admin`: **326 → 327 kB** = **+0,31%**;
- shared: **103 → 104 kB** = **+0,97%**;
- `perf:r3:budget`: **within configured budgets**.

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


### PERF-F — Cache curto em memória

Integração:
- branch trabalhadora: `perf-r3-f-memory-cache`;
- base do worker: `79f54e2fd4109b8c56cc2f8c0deb1234af1238f5`;
- HEAD revisado: `570661ba498edd37ba4c8f0240044d4ee6613bed`;
- PR #207;
- integração: `14aaa2e747fffaf2427ea63f4cd52395545d9a22`.

Contrato:
- somente memória;
- TTL: **30 s**;
- chave: workspace + variante/ID;
- in-flight dedupe;
- rejeições não são cacheadas;
- geração interna bloqueia repovoamento stale após invalidação;
- escrita bem-sucedida invalida depósitos/localizações/destinos conforme o domínio;
- nenhuma persistência local de cache.

Recursos incluídos:
- listagem de depósitos;
- listagem de localizações/subposições;
- leitura individual de depósito/localização somente para apresentação;
- listagem de destinos.

Excluídos deliberadamente:
- configuração logística;
- saldos, ledger, movimentos, lotes, intake, NF, empenhos, cronogramas, inventário, consumos, outbounds, histórico, barcode operacional, auth/autorização.

Autoridade:
- unicidade de código de depósito/localização continua Firestore uncached;
- destino ativo continua `getDoc()` autoritativo;
- APIs históricas sem sufixo `Cached` continuam uncached.

Métrica sintética:
- Início → Alocação → SISCOFIS → Meus Depósitos;
- 8 → 2 carregamentos estruturais dentro do TTL;
- 64 → 16 document-equivalents no conjunto sintético D=4/L=12;
- **75%** de redução no recorte, sem alegar contagem de produção.

Validação combinada:
- teste específico do cache: **11/11 PASS**;
- PR base: `481948fc1fe079fcd27c4e92585d8b8faf5d6ba3`;
- merge virtual: `3ea9eb6378de23a849ed84b331cac39de4a1ddd7`;
- Application CI #860 fez checkout explícito desse merge virtual e terminou **PASS**;
- Core Protection e Recovery Guardrails: **PASS**;
- build/TypeScript/Diff Hygiene e segurança afetada: **PASS**;
- bundle permaneceu estável: root 333 kB, Central 106 kB, admin 327 kB, shared 104 kB.

Risco residual:
- outra sessão pode deixar estrutura visual stale por até 30 s;
- isso não deve alterar decisão operacional crítica;
- comportamento entra obrigatoriamente no checklist de UX da PERF-I.

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

Fechamento PERF-H durante PERF-I:
- `perf:r3:collect`, `compare` e `budget`: **PASS**;
- correção Windows em `2c2da4ded5ffd38e243d8e03cac6f104bcf93c4a`: coletor usa `cmd.exe/ComSpec` em vez de `spawn('npm.cmd')`;
- correção do parser CI em `6ebbf45b80748bdd17dbdf5a29c4a0dd7fd1dbeb`: timestamp GitHub Actions removido corretamente;
- testes de métricas/parser/sanitização: **3/3 PASS**.

## 5. PERF-F — concluída

Status: **INTEGRADA**.

A PERF-F foi encerrada no commit de integração `14aaa2e747fffaf2427ea63f4cd52395545d9a22`. A documentação especializada está em `docs/PERFORMANCE_R3_MEMORY_CACHE.md`.

Não ampliar o cache automaticamente. Qualquer novo recurso candidato deve provar que é estrutural/estável e que não participa de decisão autoritativa. A separação entre APIs históricas uncached e APIs explícitas `Cached` é contrato a preservar.

## 6. PERF-X — concluída

Status: **INTEGRADA E CERTIFICADA**.

Referências:
- worker: `perf-r3-x-hot-vs-history@8aac69a92120ff97f0d4ab84e46a470b5c632843`;
- integração PR #208: `2aca0dce1d511d0cc8df329614fac93f4e917144`;
- correção semântica do Coordenador: `2b72d43ac2a387682fb1c0089d36bef2177d0f17`;
- validação final: PR técnico #209, fechado sem merge;
- Application CI #868: **PASS**;
- Core Protection #155: **PASS**;
- build, TypeScript final, Diff Hygiene e gates 16–21: **PASS**.

Contrato:
- `invoices` realtime somente operacional após backfill READY;
- histórico completo sob demanda;
- fallback integral antes do READY;
- backfill idempotente/seguro, sem Rules;
- Empenhos: contagens agregadas + detalhe histórico por empenho;
- Nova NF: abre em **Em tramitação**; `Todas`/`Concluídas` sob demanda;
- compatibilidade legada preservada nas contagens antes do READY;
- operações críticas consultam histórico quando precisam visão integral.

Métrica sintética worker, com 20 operacionais:
- 100 → 20;
- 1.000 → 20;
- 10.000 → 20;
- histórico antes da solicitação: 0.
Não confundir com consumo real de produção.

Riscos/itens deliberadamente fora do escopo:
- `empenhos`, `alerts`, `comissoes` e `cronogramas` não foram migrados para hot/history;
- movimentos/ledger da Central permanecem fora deste recorte;
- redução seletiva só entra em vigor depois do backfill READY;
- PERF-I encerrou o contrato PERF-X combinando guards/testes automatizados de fallback/READY/hot-history com jornada manual integrada; reabrir somente diante de regressão objetiva.

**PERF-I foi APROVADA E ENCERRADA. PERF-J está LIBERADA.**

## 7. PERF-I — Integração Controlada + Validação de UX

Status final: **APROVADA E ENCERRADA em 2026-10-01**.

### 7.1. Gates e métricas finais

- TypeScript: **PASS**;
- production build: **PASS**;
- `perf:r3:collect`: **PASS**;
- `perf:r3:compare`: **PASS**;
- `perf:r3:budget`: **PASS**;
- parser/budget/sanitização: **3/3 PASS**;
- PERF-F cache: **11/11 PASS**;
- PERF-D intake: **7/7 PASS**;
- PERF-G shell persistente: **PASS**;
- PERF-X hot/history: **PASS**;
- `git diff --check`: limpo;
- `git status --short`: limpo.

### 7.2. Correções descobertas pela integração

1. **Fixture E2E de empenhos:** registros técnicos incompletos sem `items` quebravam Empenhos/Home no ambiente de validação. As fixtures fundador e externas foram tornadas operacionalmente válidas sem mudar regra de negócio.
2. **Coletor PERF-H no Windows:** `spawn('npm.cmd')` gerava `EINVAL`; correção em `2c2da4ded5ffd38e243d8e03cac6f104bcf93c4a`.
3. **Parser de logs CI:** regex de timestamp GitHub Actions estava escapada incorretamente; correção em `6ebbf45b80748bdd17dbdf5a29c4a0dd7fd1dbeb`.

### 7.3. Validação manual concluída

Foi validado, sem regressão bloqueante:
- primeiro acesso e acesso subsequente às superfícies lazy;
- Empenhos, Recebimentos/NF e Central;
- back/forward, URL, refresh direto, header/sidebar e shell persistente;
- reset de formulário da Alocação;
- persistência deliberada do rascunho da Saída entre navegação/F5;
- barcode desconhecido → associação → quantidade → ENTER/TAB → retorno de foco;
- cache PERF-F após mutação, sem necessidade de F5;
- usuário externo autorizado e isolamento de workspace;
- jornada EMPROVEX → Central → Meus Depósitos → Alocação → Saída → retorno;
- erros tardios/permissão no ambiente correto com Rules da branch;
- throttling artificial de rede, sem crash/tela branca e com recuperação normal ao voltar a `No throttling`.

### 7.4. Benchmark manual indicativo

No mesmo computador/Edge:
- publicada/Home parada: CPU Edge tipicamente **70–100**, picos em repouso até **129**, pico geral observado **162,1**;
- R3 standalone/Home parada: **30–40**, pico **41,6**;
- memória da aba: publicada chegou a ~**724.116 K (~707 MB)**; R3 Home ~**170.776 K (~167 MB)**;
- Empenhos R3: **26–40**, pico **55** ao detalhar, ~**174.624 K**;
- Central R3: pico transitório **143** na troca; Meus Depósitos pico **84**, estabilizando aproximadamente **26–60**, ~**215.672 K**.

Esses números são **indicativos e não laboratoriais**, porque publicada e R3 local standalone/emulada não são ambientes idênticos. Servem como evidência complementar de que a R3 reduziu trabalho contínuo em repouso e que os maiores picos observados na candidata foram transitórios.

### 7.5. Decisão

A PERF-I está **APROVADA**. Não houve merge em `main` nem deploy de produção. A próxima fase é exclusivamente **PERF-J — Certificação Final**.

## 8. PERF-J — Certificação Final

Status: **LIBERADA / PRÓXIMA FASE**.

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
- preservar a aprovação dos critérios de UX já obtida na PERF-I; repetir manualmente apenas o que a certificação final ou alguma regressão objetiva exigir;
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
- é parte obrigatória da PERF-I nos fluxos definidos na seção 7;
- deve cobrir interação, teclado/scanner, layout, navegação, formulários, estado, feedback de loading/erro e ergonomia;
- deve incluir ao menos uma jornada em ambiente representativo de hardware/conectividade modestos;
- regressão perceptível de UX pode bloquear a R3 mesmo com gates automáticos verdes.

## 11. Produção / main

Até este handoff, já após a aprovação da PERF-I:
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
2. conferir o HEAD real de `main` e `feat/performance-r3-commercializacao`;
3. conferir `docs/PERFORMANCE_R3_INTEGRATION_STATUS.md`;
4. confirmar A/B/C/D/E/F/G/H/X como integradas e PERF-X certificada;
5. confirmar PERF-I como **APROVADA E ENCERRADA** no estado funcional até `6ebbf45b80748bdd17dbdf5a29c4a0dd7fd1dbeb`;
6. não reabrir A–X/PERF-I sem regressão objetiva;
7. conduzir exclusivamente a **PERF-J — Certificação Final**;
8. não fazer merge em `main`, deploy ou promoção Vercel sem autorização explícita do usuário;
9. depois da PERF-J e da publicação autorizada da R3 em `main`/Vercel, abrir o programa **EMPROVEX SaaS R1** conforme o macroplanejamento do Memorial Oficial, sem continuar usando a R3 como branch de desenvolvimento comercial.

## 14. Missão do próximo Coordenador após a PERF-J e publicação da R3

Esta missão **não deve começar antes** da PERF-J concluída e da autorização do usuário para publicar.

Após merge consolidado em `main`, deploy Vercel e smoke test de produção:

1. registrar o HEAD/tag efetivamente publicado;
2. encerrar formalmente a Performance R3;
3. abrir um novo programa de desenvolvimento chamado provisoriamente **EMPROVEX SaaS R1**;
4. criar uma branch integradora própria para o SaaS R1, separada de `main`;
5. não desenvolver o SaaS diretamente na `main`;
6. transformar o macroplano abaixo em documentação detalhada antes de distribuir trabalho.

Sequência lógica definida pelo usuário:

> **Release R3 → cobrança/trial → onboarding → segurança/legal → operação/backup/monitoramento → piloto comercial → SaaS aberto**

### Diretriz de cobrança inicial

A cobrança inicial deve ser **deliberadamente simples**:
- preferência por **Mercado Pago**;
- link de pagamento e/ou Pix;
- trial controlado no EMPROVEX;
- conciliação/ativação manual ou assistida é aceitável na primeira versão;
- não construir assinatura recorrente complexa, checkout próprio, motor financeiro amplo ou integração excessiva antes de provar necessidade;
- API/webhook Mercado Pago só entra quando houver ganho operacional claro.

O objetivo é vender com segurança e baixa fricção, não transformar o EMPROVEX em um sistema financeiro.

### Método obrigatório de planejamento

O próximo Coordenador deve reutilizar o padrão que funcionou na Performance R3:

> **contratos comuns → workers independentes → ondas paralelas → handoffs → integração controlada → validação integrada → certificação**

Ele deve criar, no mínimo:
- `docs/SAAS_R1_PLANO_MESTRE.md`;
- `docs/SAAS_R1_EXECUCAO_PARALELA.md`;
- `docs/SAAS_R1_INTEGRATION_STATUS.md`;
- `docs/SAAS_R1_COORDENADOR_HANDOFF.md`.

O plano detalhado deve definir:
- frentes independentes;
- dependências reais;
- quais frentes podem rodar simultaneamente;
- branch de cada worker;
- base SHA de cada worker;
- propriedade preferencial de arquivos/domínios;
- contratos compartilhados;
- critérios de aceite;
- gates técnicos;
- validações manuais;
- segurança/isolamento;
- métricas de custo/performance;
- handoff obrigatório;
- integração semântica;
- plano de rollback;
- certificação final.

### Estrutura sugerida de ondas

A sequência de maturidade do produto continua sendo a definida pelo usuário, mas a implementação deve aproveitar paralelismo seguro.

**Fundação comum**
- modelo cliente/workspace/UG/usuário;
- estados de trial/cobrança/acesso;
- regras de ativação/suspensão/reativação/encerramento;
- auditoria;
- fronteira entre domínio operacional e domínio comercial.

**Onda paralela 1**
- cobrança/trial simplificados;
- onboarding;
- segurança/legal;
- operação/backup/monitoramento.

Essas frentes podem caminhar em chats diferentes **depois** que a fundação comum estiver congelada, desde que o Coordenador evite que cada uma crie um modelo diferente de cliente/status.

**Integração SaaS**
- combinar ciclo comercial + acesso + onboarding + observabilidade;
- validar que suspensão comercial não apaga/corrompe dados;
- confirmar fail-closed sem prejudicar recuperação/reativação;
- executar regressão do núcleo EMPROVEX.

**Piloto comercial**
- poucos clientes reais assistidos;
- suporte próximo;
- consumo/custos reais;
- problemas reais de onboarding/cobrança;
- capacidade/custo orientada à meta inicial de até **100 usuários**, distinguindo cadastrados, ativos e simultâneos.

**Certificação comercial**
- cobrança/trial;
- onboarding;
- segurança/isolamento;
- documentação legal vigente;
- backup + restauração;
- monitoramento/alertas;
- suporte/incidente;
- custo/capacidade;
- pendências conhecidas;
- decisão explícita do usuário.

**SaaS aberto**
- somente depois da certificação e autorização do usuário.

### Restrições para o SaaS R1

- não migrar Firebase/Vercel/Next.js por antecipação;
- não criar arquitetura de microsserviços/Kubernetes apenas por expectativa de escala;
- não automatizar cobrança além do necessário para a primeira operação comercial;
- não misturar novas features grandes do domínio operacional com o fechamento comercial;
- não reduzir isolamento multi-tenant ou segurança para facilitar onboarding;
- não apagar dados por atraso de pagamento;
- não transformar Browser E2E em gate permanente sem necessidade;
- não permitir que workers façam merge/deploy direto em produção.

O Memorial Oficial, após atualizado com a publicação da R3, será a fonte superior desse novo programa até que os quatro documentos SaaS R1 sejam criados e aprovados.

## 15. Regra para atualização deste documento

Atualizar este handoff quando:
- uma frente for integrada/devolvida/dispensada;
- surgir conflito importante;
- mudar a ordem das dependências;
- houver nova métrica combinada;
- iniciar/concluir PERF-J;
- a R3 for publicada em `main`/Vercel;
- o programa SaaS R1 for formalmente aberto;
- ocorrer troca de Chat Coordenador.

Não transformar este documento em diário de commits. Ele deve continuar compacto e suficiente para retomada.
