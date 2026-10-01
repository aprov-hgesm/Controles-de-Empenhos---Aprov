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
| PERF-X | **BLOQUEADA / OPCIONAL** | — | — | só abrir se medições justificarem hot vs history |
| PERF-I | **BLOQUEADA** | — | branch integradora | aguarda decisão objetiva sobre PERF-X; depois integração + UX |
| PERF-J | **BLOQUEADA** | — | branch integradora | certificação após PERF-I |


## 2.1. Ponto de retomada para os próximos chats

Estado canônico da rodada:
- branch integradora: `feat/performance-r3-commercializacao`;
- HEAD antes desta atualização documental: `8247b358d7ba118cd6be3cc9f10cee0b079b657b`;
- `main`: `22d9fe5f86e2cfbb247eb21bae28e4b2c6cb2a2f`;
- A/B/C/D/E/F/G/H: **INTEGRADAS**;
- PERF-X: **próxima decisão**, mas continua opcional e deve começar por auditoria/evidência;
- PERF-I: bloqueada até a decisão sobre PERF-X;
- PERF-J: bloqueada até PERF-I;
- nenhuma integração R3 em `main`;
- nenhum deploy consolidado R3 em produção.

Ordem obrigatória daqui em diante:
`PERF-X (auditar/decidir) → PERF-I (integração + UX) → PERF-J (certificação) → autorização explícita do usuário → main/release`.

Regra de retomada:
- novos trabalhos devem partir da integradora **atual**, nunca dos baselines históricos;
- A–H são contratos integrados e só podem ser tocadas por regressão objetiva;
- UX é critério bloqueante, não item cosmético;
- Browser E2E permanece sob demanda; validação manual/dirigida das jornadas de UX da PERF-I é obrigatória;
- evitar deploys Vercel intermediários quando CI/local forem suficientes.


## 3. Build combinado certificado após PERF-F

Último build combinado validado após A/B/C/D/E/F/G/H:

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

## 5. PERF-F — concluída

Status: **INTEGRADA**.

A PERF-F foi encerrada no commit de integração `14aaa2e747fffaf2427ea63f4cd52395545d9a22`. A documentação especializada está em `docs/PERFORMANCE_R3_MEMORY_CACHE.md`.

Não ampliar o cache automaticamente. Qualquer novo recurso candidato deve provar que é estrutural/estável e que não participa de decisão autoritativa. A separação entre APIs históricas uncached e APIs explícitas `Cached` é contrato a preservar.

## 6. PERF-X

**Próxima decisão do Coordenador. Não iniciar automaticamente.**

Com PERF-F integrada, revisar as medições combinadas e os reads/listeners históricos ainda existentes. Só abrir PERF-X se houver evidência objetiva de gargalo relevante de dados quentes vs. histórico.

Sem evidência suficiente: marcar PERF-X como **DISPENSADA** e liberar PERF-I.

## 7. PERF-I — Integração Controlada + Validação de UX

Quando as frentes necessárias estiverem fechadas:

1. confirmar quadro oficial;
2. rodar build combinado;
3. executar `perf:r3:collect`;
4. executar `perf:r3:compare`;
5. executar `perf:r3:budget`;
6. rever reads/consultas críticas;
7. executar regressão de segurança/Core;
8. resolver qualquer conflito restante;
9. decidir se PERF-X é necessária com base em evidência;
10. executar a validação integrada de experiência do usuário;
11. preparar estado candidato à certificação somente se performance **e** UX estiverem aprovadas.

### 7.1. Princípio de decisão

A experiência do usuário é a prioridade principal do EMPROVEX.

> **Nenhum ganho de performance é aprovado se tornar a operação menos clara, previsível, segura ou confortável para o usuário.**

CI verde, bundle menor, menos reads ou menor CPU não anulam uma regressão relevante de UX. Quando houver conflito entre ganho marginal de performance e ergonomia/previsibilidade, a experiência do usuário prevalece.

### 7.2. Checklist obrigatório de UX da PERF-I

A validação deve cobrir, no mínimo:

1. **Primeiro acesso vs. acesso subsequente**
   - abrir superfícies lazy/on-demand pela primeira vez;
   - repetir o acesso;
   - confirmar ausência de clique aparentemente ignorado, tela vazia ou espera sem feedback;
   - loaders/skeletons devem ser compreensíveis quando a espera for perceptível.

2. **Persistência e reset de estado**
   - filtros;
   - ordenação;
   - seleção;
   - paginação;
   - scroll;
   - abas/subabas;
   - confirmar que persistência ou reset seguem comportamento intuitivo, sem esconder dados do usuário.

3. **Proteção de formulários**
   - preencher parcialmente Alocação de Material;
   - preencher parcialmente Saída de Material;
   - navegar conforme permitido e retornar;
   - verificar que não existe perda inesperada de dados digitados ou seleção operacional.

4. **Shell persistente da Central**
   - entrada direta em `/adm-deposito`;
   - Início → Meus Depósitos;
   - Alocação de Material;
   - Saída de Material;
   - URL correta;
   - header/sidebar persistentes;
   - back;
   - forward;
   - refresh direto em subrota;
   - ausência de componente duplicado, conteúdo antigo ou piscada excessiva.

5. **Barcode, teclado e foco**
   - foco automático;
   - leituras consecutivas;
   - ENTER;
   - retorno do foco ao barcode;
   - criação/edição do carrinho;
   - primeira busca de material ainda não carregado;
   - scanner/teclado não podem ficar menos previsíveis por lazy loading ou remontagem.

6. **PERF-F — cache curto**
   - primeira leitura;
   - segunda leitura dentro do TTL;
   - expiração;
   - invalidação/atualização após mutação local bem-sucedida;
   - alteração feita por outra sessão/aba;
   - nenhuma operação crítica pode confiar no cache como autoridade quando exigir revalidação oficial.

7. **Erros tardios de carregamento sob demanda**
   - rede;
   - permissão;
   - dado ausente/inconsistente;
   - a falha deve gerar mensagem clara quando a função for usada, sem aparência de botão quebrado ou clique sem efeito.

8. **Listas otimizadas pela PERF-E**
   - filtros;
   - busca;
   - ordenação;
   - totais;
   - contagens;
   - informação exibida;
   - comparar semanticamente com o comportamento esperado anterior.

9. **Máquina e conexão mais fracas**
   - executar pelo menos a jornada principal em hardware/conectividade modestos;
   - observar loading, CPU, responsividade, foco, transições e sensação de travamento;
   - não aprovar apenas com base em máquina de desenvolvimento rápida.

10. **Jornada integrada completa**
    - EMPROVEX → Central;
    - Central → Meus Depósitos;
    - Meus Depósitos → Alocação;
    - Alocação → Saída;
    - retorno à Central;
    - executar também uma jornada representativa no EMPROVEX principal.

11. **Usuário externo autorizado**
    - repetir os principais fluxos permitidos;
    - conferir acesso, mensagens, navegação e ergonomia;
    - confirmar que otimizações não alteraram isolamento nem experiência esperada.

### 7.3. Critérios de bloqueio por UX

A PERF-I deve bloquear o candidato até correção ou decisão explícita do usuário quando detectar:

- perda de dados digitados;
- informação visual enganosa ou aparentemente desatualizada sem tratamento adequado;
- clique sem resposta perceptível;
- carregamento sem feedback quando houver espera relevante;
- filtro/estado persistido de forma confusa;
- reset inesperado de estado necessário;
- necessidade nova de refresh manual para continuar;
- quebra de foco, ENTER, teclado ou scanner;
- regressão perceptível de navegação, ergonomia ou previsibilidade;
- comportamento significativamente pior em hardware/conectividade modestos.

Browser E2E permanece **sob demanda**. A PERF-I pode combinar testes automatizados, browser dirigido e validação manual assistida conforme o risco de cada fluxo.

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
- aprovação dos critérios de UX da PERF-I, incluindo primeiro acesso lazy, estado, formulários, barcode/teclado, cache, erros e jornada em ambiente modesto;
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
5. confirmar que PERF-F segue integrada em `14aaa2e`;
6. não reabrir A/D/F/G sem regressão objetiva;
7. avaliar objetivamente se PERF-X é necessária ou deve ser DISPENSADA;
8. após essa decisão, conduzir PERF-I/PERF-J com a validação obrigatória de UX.

## 14. Regra para atualização deste documento

Atualizar este handoff quando:
- uma frente for integrada/devolvida/dispensada;
- surgir conflito importante;
- mudar a ordem das dependências;
- houver nova métrica combinada;
- iniciar PERF-I/PERF-J;
- ocorrer troca de Chat Coordenador.

Não transformar este documento em diário de commits. Ele deve continuar compacto e suficiente para retomada.
