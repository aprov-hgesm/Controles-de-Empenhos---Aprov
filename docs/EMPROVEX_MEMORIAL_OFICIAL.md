# EMPROVEX — Memorial Oficial do Repositório

Última atualização: **2026-10-02 — PROGRAM CONTROL instituído; Coordenador Geral definido; HARDENING PRÉ-PILOTO ativo; T0 pré-release completo; piloto real adiado até Release Candidate; Central Móvel R1 em desenvolvimento coordenado**
Produção vigente: `main@e90f92acae1514ee5cbc6ce95fed354bc1454330`
Branch integradora do SaaS R1: `feat/saas-r1-commercializacao`
Estado: **Performance R3 PUBLICADA E ENCERRADA; arquitetura de COORDENADOR GERAL/PROGRAM CONTROL OFICIAL; SaaS R1 em HARDENING PRÉ-PILOTO; MOBILE-R1 em desenvolvimento paralelo; piloto real NÃO INICIADO; SAAS-J AGUARDANDO**

Este documento é a **porta de entrada canônica para continuidade do EMPROVEX como produto**. Ele resume o estado vigente, a governança global e aponta para os documentos históricos/especializados. O histórico detalhado não deve ser apagado. Para comportamento publicado, `main` prevalece. Para coordenação global entre programas, prevalecem este Memorial e `docs/EMPROVEX_PROGRAM_CONTROL.md`. Cada programa mantém sua própria integradora e documentação especializada.

## 1. Fontes da verdade

Ordem de consulta para um novo trabalho:

1. `main` — estado efetivo do código atualmente em produção;
2. este Memorial — síntese canônica de estado, governança, contratos, prioridades e sequência global;
3. `docs/EMPROVEX_PROGRAM_CONTROL.md` — protocolo do Coordenador Geral e integração entre programas;
4. `feat/saas-r1-commercializacao` — integradora vigente do SaaS R1;
5. `feat/central-mobile-r1` — integradora vigente da Central Móvel R1;
6. documentação canônica do programa em que o trabalho ocorre, incluindo Integration Status/Handoff/Plano Mestre quando existentes;
7. documentação especializada do domínio alterado.
6. decisões arquiteturais registradas;
7. histórico de fases/branches/PRs apenas como contexto.
8. para a **Central Móvel R1**, já ativada em desenvolvimento coordenado, prevalecem operacionalmente a branch `feat/central-mobile-r1` e os documentos `CENTRAL_MOBILE_R1_*`; alterações transversais entre SaaS e Mobile devem seguir a regra de sincronização registrada neste Memorial.

Para a Central de Depósitos:
- `docs/adm-deposito/README.md`;
- `docs/adm-deposito/STATUS.md`;
- `docs/adm-deposito/DECISIONS.md`;
- `docs/adm-deposito/ROADMAP.md`.

Política de testes:
- `docs/TESTING_POLICY.md`;
- `docs/DEVELOPMENT_CI_WORKFLOW.md`.

## 2. Estado atual do produto

O EMPROVEX é uma aplicação Next.js 15 com Firebase Auth/Firestore, Vercel e integrações Google utilizadas pelos fluxos institucionais.

Estado operacional consolidado em produção e estado candidato vigente:
- núcleo de Empenhos, Itens, Notas Fiscais, Comissão/Tesouraria, Cronogramas/Entregas, Avisos e Relatórios em produção;
- cadastro de empenho por PDF SIAFI disponível, preservando também as demais formas de cadastro existentes;
- edição segura de número/descritivo de item no detalhamento do empenho e antes da geração do cronograma;
- home operacional com snapshot agregado para reduzir leituras brutas;
- histórico de invoices em Relatórios consultado sob demanda/paginado;
- controle de sessão externo baseado em workspace/UG e lease;
- telemetria estimada de consumo por workspace + métricas globais separadas;
- Central de Depósitos integrada ao EMPROVEX e disponível para contextos de setor autenticados/autorizados, com isolamento por workspace/UG;
- Performance R3 foi **PUBLICADA E ENCERRADA** em `main@e90f92acae1514ee5cbc6ce95fed354bc1454330`; Vercel publicou a release e as Rules necessárias do banco `emprovex-warehouse` foram publicadas; o ciclo ativo passa a ser o **EMPROVEX SaaS R1**.

## 3. Central de Depósitos — estado vigente

Nome de produto vigente: **Central de Depósitos**.
O caminho técnico `adm-deposito` e a documentação histórica são preservados por compatibilidade.

Superfícies principais:
- Início;
- Meus Depósitos;
- Alocação de Material;
- Saída de Material;
- Controle de Depósitos;
- Controle de Materiais.

Capacidades consolidadas:
- material canônico, ledger e saldos materializados;
- NF → pendência/entrada logística sem bloquear o núcleo EMPROVEX;
- depósitos, locais, subposições e croquis versionados;
- lotes, validade e FEFO;
- barcode e saída operacional;
- consumo imediato;
- inventário;
- SISCOFIS/Marco Zero via Mapa de Existência;
- relatórios logísticos;
- acesso externo multi-tenant já liberado;
- disposição visual dos depósitos personalizável por movimento, sem rotação/escala no fluxo atual;
- fluxo de recebimento simplificado/interativo;
- refatoração estrutural concluída em 2026-10-01 sem mudança de contratos operacionais;
- cache curto em memória para depósitos, localizações/subposições e destinos, com TTL de 30 s, isolamento por workspace e validações críticas permanecendo autoritativas.

## 4. Política de testes vigente

Browser E2E **não é gate permanente de merge/deploy**.

Gates automáticos prioritários:
- instalação reproduzível;
- TypeScript;
- build de produção;
- testes de domínio/contratos;
- guards estruturais e de segurança;
- testes Firestore/isolamento quando aplicáveis;
- EMPROVEX Core Protection;
- diff hygiene.

Browser E2E permanece disponível em workflow separado e é executado sob demanda quando o risco funcional/interativo justificar.

Validação manual assistida é parte legítima do processo para ergonomia, fluxo operacional, teclado/scanner, posicionamento visual e experiência real.

## 5. Performance e comercialização — prioridade atual

Branch oficial da rodada:
`feat/performance-r3-commercializacao`

Documentos obrigatórios da rodada:
- `docs/PERFORMANCE_R3_COMERCIALIZACAO.md` — objetivos técnicos e frentes;
- `docs/PERFORMANCE_R3_EXECUCAO_PARALELA.md` — arquitetura oficial de branches, chats, coordenação, handoff e integração;
- `docs/PERFORMANCE_R3_INTEGRATION_STATUS.md` — quadro vivo de frentes, propriedade, HEADs, dependências e situação de integração, mantido apenas pelo chat coordenador.
- `docs/PERFORMANCE_R3_COORDENADOR_HANDOFF.md` — memória operacional compacta para troca de Chat Coordenador, contendo estado corrente, integrações, conflitos resolvidos, próximos passos e protocolo de retomada.

Objetivo:
> tornar o EMPROVEX perceptivelmente mais rápido e leve para comercialização sem reduzir qualidade visual, animações, transições ou identidade premium.

### Princípio prioritário de experiência do usuário

A **experiência do usuário é a prioridade principal do EMPROVEX**. Performance, redução de bundle, redução de leituras, menor uso de CPU e economia de Firestore são meios para melhorar a operação; não são objetivos que possam justificar piora perceptível da experiência.

Regra de aceitação da R3:

> **nenhum ganho de performance é considerado aprovado se introduzir perda de dados digitados, informação visual enganosa, clique sem resposta perceptível, carregamento sem feedback adequado, estado de tela inesperado, necessidade nova de refresh manual, quebra de foco/teclado/scanner, navegação menos previsível ou dificuldade operacional nova.**

Quando houver conflito entre um ganho marginal de performance e uma experiência mais clara, previsível e segura para o operador, a experiência do usuário prevalece. Uma regressão relevante de UX pode bloquear PERF-I/PERF-J mesmo com TypeScript, build, CI, métricas e budgets verdes.

Baseline de build observado em 2026-10-01:
- `/`: **460 kB First Load JS**;
- `/adm-deposito`: **579 kB First Load JS**;
- várias rotas operacionais da Central: **579 kB First Load JS**;
- `/admin`: **326 kB First Load JS**;
- JS compartilhado global: **103 kB**.

Direção arquitetural:
- carregar código somente quando a superfície for usada;
- carregar dados somente quando a operação exigir;
- reduzir releituras e scans crescentes;
- preservar os contratos de negócio e segurança;
- medir antes/depois;
- impedir regressão futura por orçamento de performance.

## 6. Modelo oficial de execução — frentes paralelas + integração controlada

A Performance R3 **não deve ser executada como uma fila monolítica de fases dependentes**.

Modelo oficial:

> **baseline/contratos comuns → primeira onda de frentes independentes → segunda onda dependente → integração controlada → certificação final**

### Primeira onda paralela

Podem ser executadas simultaneamente em chats e branches diferentes:

- **PERF-A — Bundle do EMPROVEX principal**;
- **PERF-B — Bundle da Central de Depósitos**;
- **PERF-C — Saída de Material sob demanda**;
- **PERF-D — Fila leve de Recebimento/Intake**;
- **PERF-E — CPU e Renderização**;
- **PERF-H — Métricas e Budget**.

### Segunda onda

Mantém escopo próprio, mas começa somente após a dependência indicada:

- **PERF-F — Cache curto em memória**, após C/D estabilizarem as leituras realmente necessárias — **INTEGRADA**;
- **PERF-G — Shell/Layout persistente da Central**, após B congelar a fronteira de carregamento — **INTEGRADA**;
- **PERF-X — Dados quentes vs histórico**, originalmente opcional e condicionada a evidência; a auditoria comprovou gargalo em `invoices`, a frente foi executada, corrigida semanticamente e está **INTEGRADA E CERTIFICADA**.

### Fechamento

- **PERF-I — Integração Controlada + Validação de UX e Regressões Perceptíveis**;
- **PERF-J — Certificação Final**.

### Chat coordenador

Durante toda a R3 deve existir um **chat Coordenador / Integrador / Avaliador**. Ele:
- mantém a visão global;
- trabalha sobre a branch integradora;
- distribui/fronteiriza escopos;
- recebe handoffs dos chats trabalhadores;
- revisa diffs, métricas, testes e contratos;
- decide se cada frente está apta a integrar;
- resolve conflitos semanticamente;
- conduz PERF-I e PERF-J;
- não compete implementando em paralelo o mesmo escopo dos trabalhadores;
- não autoriza merge/deploy de produção sem a decisão explícita do usuário.

A especificação completa está em `docs/PERFORMANCE_R3_EXECUCAO_PARALELA.md`.

A independência das frentes é uma **regra arquitetural da rodada**: um chat não deve aproveitar sua frente para refatorar outra área. Dependências são registradas no handoff e resolvidas pelo coordenador.


### Estado consolidado da Performance R3 em 2026-10-01

Estado canônico da branch `feat/performance-r3-commercializacao`:

- **PERF-A — Bundle do EMPROVEX principal: INTEGRADA.** Worker `3193b84`; integração `15eadb0`. A rota `/` caiu de **460 kB para 333 kB** de First Load JS (-27,61%), preservando shell/Home/auth e movendo grandes superfícies para boundaries lazy.
- **PERF-B — Bundle da Central: INTEGRADA.** Worker `7b7aee1`. As rotas principais da Central caíram de **579 kB para ~300 kB** na etapa B, preservando os boundaries `dynamic()`.
- **PERF-C — Saída de Material sob demanda: INTEGRADA.** Worker `c263ce3`; integração `e33e260`. A abertura fresca deixou de antecipar as 8 consultas específicas e o teto bounded de até 3.000 documentos; barcode/material/saldo/posições/lotes/destinos são resolvidos apenas quando necessários.
- **PERF-D — Intake seletivo: INTEGRADA.** Worker `022fae7`; integração `2e77af1`. O caminho normal `A tratar` usa `intakeQueueIndex`, watermark e candidatos ativos; histórico/reconciliação ficam sob demanda. Cenários sintéticos registraram reduções aproximadas de **97,26% a 99,69%** no steady-state de massas históricas grandes.
- **PERF-E — CPU e Renderização: INTEGRADA.** Worker `149f7c3`; integração `9d5ff58`. Benchmarks estruturais da frente: Empenhos **1.732.500 → 11.250** varreduras, NFs **3.388.500 → 5.250**, Itens **54.072 → 9.072**, preservando filtros, ordenação, totais e informação exibida.
- **PERF-F — Cache curto em memória: INTEGRADA.** Worker `570661b`; integração `14aaa2e`. TTL 30 s, isolamento por workspace + variante, deduplicação in-flight e invalidação pós-mutação para depósitos/localizações/destinos; operações críticas permanecem uncached/autoritativas. Cenário sintético estrutural: **8 → 2** carregamentos dentro do TTL (75% no recorte).
- **PERF-G — Shell/Layout persistente da Central: INTEGRADA.** Worker `de870d1`; integração `238b813`. Auth/workspace/session/header/sidebar permanecem montados entre subrotas; os boundaries lazy da PERF-B foram preservados. As seis rotas principais da Central chegaram a **106 kB** First Load JS.
- **PERF-H — Métricas e Budget: INTEGRADA.** Worker `fb5f452`; integração `a686410`. Baseline, parser, comparação, sanitização e budgets estão versionados; budgets continuam deliberadamente fora do Application CI automático até a certificação final.
- **PERF-X — Dados quentes vs. histórico de invoices: INTEGRADA E CERTIFICADA.** Worker `8aac69a`; integração do PR #208 em `2aca0dce`; correções semânticas coordenadas em `2b72d43`; validação final no PR técnico #209 com **Application CI #868 verde**.
- **PERF-I — Integração Controlada + UX: APROVADA.** Validação final concluída sobre a integradora até `6ebbf45b80748bdd17dbdf5a29c4a0dd7fd1dbeb`.

Build combinado final coletado durante a PERF-I:
- `/`: **335 kB First Load JS** (**460 → 335 kB / -27,17%**);
- seis rotas principais da Central: **106 kB** (**579 → 106 kB / -81,69%**);
- `/admin`: **327 kB** (**326 → 327 kB / +0,31%**);
- `/admin/backups`: **245 kB**;
- shared global: **104 kB** (**103 → 104 kB / +0,97%**);
- `perf:r3:budget`: **within configured budgets**.

Esta coleta final substitui as referências intermediárias anteriores para a decisão de certificação.

#### PERF-X — arquitetura final integrada

A auditoria comprovou que `invoices` ainda era observada integralmente em realtime nas superfícies de Empenhos/Nova NF. A implementação final adotou separação semântica por estado operacional, **sem corte temporal**:

- após backfill certificado/marker READY, realtime = `localizacaoAtual IN [APROVISIONAMENTO, COMISSAO]`;
- NFs em `TESOURARIA` saem do listener operacional e permanecem acessíveis no histórico sob demanda;
- antes do READY, o runtime mantém o listener integral legado para não esconder documentos antigos sem `localizacaoAtual`;
- fallback legado resolve `tesourariaDate → TESOURARIA`, `comissaoDate → COMISSAO`, ausência dos campos → `APROVISIONAMENTO`;
- backfill é explícito, idempotente, com precondição de `updateTime`, sem apagar/renomear documentos e **sem alterar Firestore Rules**;
- Empenhos usa contagens agregadas e carrega histórico completo por `empenhoId` somente no detalhe/relatório quando necessário;
- Nova NF abre em **Em tramitação**, união de todas as NFs ainda operacionais, sem carregar o histórico concluído;
- `Todas` e `Concluídas / Tesouraria` carregam histórico sob demanda;
- a contagem de concluídas só usa a agregação `localizacaoAtual=TESOURARIA` depois do READY; antes disso deriva do conjunto legado integral já carregado;
- transição operacional → histórica é revalidada por `recordKey`, preservando conclusão em memória e distinguindo exclusão;
- NF histórica reaberta para estado operacional volta automaticamente ao realtime;
- cadastro/edição, identidade, migração de CNPJ, exclusão global, relatórios e numeração de TR possuem consultas históricas/limitadas próprias quando exigem visão integral;
- histórico continua reutilizando `lib/historicalInvoiceQueries.ts`; não foi criada fonte paralela de verdade.

Métrica sintética reproduzível da PERF-X, com 20 NFs operacionais:
- 100 documentos totais → 20 realtime (**-80%**);
- 1.000 → 20 (**-98%**);
- 10.000 → 20 (**-99,8%**);
- histórico carregado antes de solicitação explícita: **0**.

Esses percentuais são **sintéticos**, não consumo real de produção.

Certificação final da PERF-X:
- worker/merge virtual: Application CI #867 **PASS**;
- integração PR #208: `2aca0dce1d511d0cc8df329614fac93f4e917144`;
- revisão semântica encontrou dois bloqueios não cobertos pelo CI: filtro inicial que ocultava Comissão e contagem de concluídas incompatível com legado pré-READY;
- correção do Coordenador: `2b72d43ac2a387682fb1c0089d36bef2177d0f17`;
- PR técnico #209 validou exatamente `2aca0dce... → 2b72d43...`;
- Application CI #868: **SUCCESS**;
- Core Protection #155: **SUCCESS**;
- Production Build: **PASS**;
- Final TypeScript: **PASS**;
- Diff Hygiene: **PASS**;
- Block 17.4 e 17.5: **PASS**;
- segurança multi-tenant e acesso externo da Central: **PASS**;
- release gates 16–21: **PASS**;
- PR #209 foi fechado sem merge após cumprir sua função de validação.

#### Estado histórico das fases de fechamento — ENCERRADO

- **PERF-I — APROVADA E ENCERRADA.** Integração, métricas combinadas, budgets e validação obrigatória de UX concluídas.
- **PERF-J — APROVADA E ENCERRADA.** Certificação final consolidada concluída no HEAD `c08c6efa9931bf1df95aee86db51de1b8edb1912`.
- **`main` / produção — PUBLICADAS posteriormente.** A autorização foi concedida e a release R3 chegou a `main@e90f92acae1514ee5cbc6ce95fed354bc1454330`.

Durante a PERF-I ainda não houve merge/deploy por desenho do processo; esse bloqueio histórico foi encerrado depois da PERF-J e não representa o estado atual.

### PERF-I — checklist de experiência do usuário executado

Além de build, métricas, budgets, reads e segurança, a PERF-I validou explicitamente a experiência real do operador após a combinação das frentes. O objetivo foi provar que o sistema ficou **mais rápido sem ficar menos previsível, claro ou seguro de usar**.

Checklist mínimo executado/considerado na aprovação:

1. **Primeiro acesso vs. acesso subsequente:** validar superfícies carregadas sob demanda e confirmar que o primeiro acesso não aparenta travamento, clique ignorado ou tela vazia; quando houver espera perceptível, deve existir feedback visual compreensível.
2. **Persistência de estado:** sair e voltar de telas relevantes verificando filtros, ordenação, seleção, paginação, scroll e abas; o que deve persistir ou resetar precisa se comportar de maneira intuitiva e consistente.
3. **Proteção de formulários:** testar formulários parcialmente preenchidos — especialmente Alocação e Saída de Material — para impedir perda inesperada de dados durante navegação permitida.
4. **Shell persistente da Central:** confirmar que mudanças de rota não duplicam componentes, não exibem conteúdo antigo, não causam piscadas excessivas e mantêm corretamente header/sidebar/URL.
5. **Saída de Material e barcode:** validar foco automático, leituras consecutivas, ENTER, retorno de foco, carrinho e primeira busca de material ainda não carregado.
6. **PERF-F/cache curto:** validar primeira leitura, reutilização dentro do TTL, expiração, invalidação após mutação local e comportamento diante de alteração feita por outra sessão/aba; o cache nunca pode substituir revalidação autoritativa em operação crítica.
7. **Erros tardios do lazy/on-demand:** falhas de rede, permissão ou dado ausente devem produzir mensagem clara quando a função for utilizada, sem aparência de botão inoperante.
8. **Listas otimizadas pela PERF-E:** filtros, busca, ordenação, totais, contagens e informação exibida devem permanecer semanticamente equivalentes ao comportamento anterior.
9. **Máquina e conexão mais fracas:** executar ao menos a jornada principal em ambiente representativo de hardware/conectividade modestos para observar loading, CPU, responsividade, foco e transições.
10. **Jornada integrada completa:** validar EMPROVEX → Central → Meus Depósitos → Alocação → Saída → retorno à Central, além de uma jornada representativa no EMPROVEX principal.
11. **Usuário externo autorizado:** repetir fluxos principais compatíveis com seu perfil e confirmar que performance não alterou acesso, mensagens ou ergonomia.
12. **PERF-X / NFs:** validar abertura em **Em tramitação**, alternância para `Todas`/`Concluídas`, loader/erro do histórico, detalhe completo por empenho, transição operacional → histórica, reabertura de NF, comportamento pré-READY e pós-READY e ausência de contagens enganosas.
13. **Critério de bloqueio UX:** perda de dados digitados, informação enganosa, estado inesperado, necessidade nova de refresh manual, quebra operacional de teclado/scanner ou dificuldade perceptível criada pela R3 bloqueiam a aprovação até correção ou decisão explícita do usuário.

Browser E2E continua sob demanda. A validação acima pode combinar testes automatizados, browser dirigido e operação manual assistida conforme o risco de cada fluxo.

A branch integradora, e não as branches trabalhadoras antigas, passa a ser a referência para compatibilidade cruzada entre frentes.

#### PERF-I — resultado final executado em 2026-10-01

Status: **APROVADA E ENCERRADA**.

Validação técnica:
- TypeScript: **PASS**;
- production build: **PASS**;
- `perf:r3:collect`: **PASS** no Windows;
- `perf:r3:compare`: **PASS**;
- `perf:r3:budget`: **PASS / within configured budgets**;
- métricas/parser/sanitização: **3/3 PASS**;
- PERF-F cache: **11/11 PASS**;
- PERF-D intake: **7/7 PASS**;
- PERF-G shell persistente: **PASS**;
- PERF-X hot/history: **PASS**;
- `git diff --check`: limpo;
- `git status --short`: limpo.

Achados/correções produzidos pela PERF-I:
1. fixture E2E de empenho incompleta causava `emp.items is not iterable` e `Cannot read properties of undefined (reading 'reduce')`; as fixtures fundador/externos foram tornadas operacionalmente válidas sem alterar regra de negócio;
2. o coletor PERF-H falhava no Windows com `spawn EINVAL`; correção em `2c2da4ded5ffd38e243d8e03cac6f104bcf93c4a` passou a usar `cmd.exe/ComSpec`;
3. o parser de logs timestampados do GitHub Actions tinha regex escapada incorretamente; correção em `6ebbf45b80748bdd17dbdf5a29c4a0dd7fd1dbeb`, com o teste real Next 15 + timestamp passando.

Validação manual assistida:
- primeiro/segundo acesso às superfícies lazy;
- Empenhos, Recebimentos/NF e Central sem erros;
- back/forward, URL, refresh direto e shell persistente;
- reset de formulário da Alocação e persistência deliberada do rascunho da Saída;
- barcode desconhecido → associação → quantidade → ENTER/TAB → retorno de foco;
- invalidação do cache após mutação sem F5;
- usuário externo autorizado com isolamento por workspace e sem vazamento do depósito HGeSM;
- jornada integrada EMPROVEX → Empenhos/NF → Central → Alocação → Saída → retorno;
- ausência de erros tardios/permission-denied no ambiente correto com Rules da branch;
- throttling de rede artificial: carregamento muito lento, porém concluído sem crash/tela branca; retorno a `No throttling` restaurou carregamento rápido.

Benchmark manual indicativo no mesmo computador/Edge:
- Home publicada parada: leitura de CPU do Edge tipicamente **70–100**, picos em repouso até **129**, pico geral observado **162,1**;
- Home R3 standalone parada: tipicamente **30–40**, pico **41,6**;
- memória observada da aba: publicada chegou a aproximadamente **724.116 K (~707 MB)**; R3 Home aproximadamente **170.776 K (~167 MB)**;
- Empenhos R3: **26–40** em repouso, pico **55** ao detalhar, ~**174.624 K**;
- Central R3: pico transitório **143** na troca EMPROVEX → Central; Meus Depósitos pico **84** e estabilização aproximada **26–60**, ~**215.672 K** na captura.

Essas leituras são **evidência manual indicativa, não benchmark laboratorial nem medição de produção**, porque publicada e R3 local standalone/emulada não são ambientes absolutamente idênticos. O dado relevante para a decisão foi a redução consistente do trabalho contínuo em repouso e a natureza transitória dos picos de navegação.

## 7. Restrições da Performance R3

Não fazem parte da rodada, salvo necessidade técnica comprovada:
- remover/reduzir animações;
- simplificar identidade visual;
- trocar Firebase/Vercel/Next.js;
- reescrever ledger;
- alterar sem necessidade contratos de NF/Empenho;
- criar caches persistentes sensíveis no navegador;
- misturar migração de infraestrutura com otimização de frontend.

Toda mudança de performance deve ser reversível, medida e compatível com os guards existentes.



### Realinhamento específico da PERF-D

A PERF-D foi concluída isoladamente sobre a base original `076a233cf250c95882e78498e89dd2a44d034f74` e posteriormente integrada semanticamente pelo coordenador no commit `2e77af1706a599152dff8ec43a197d68056d5ae2`.

Sobreposições já identificadas pelo coordenador:
- `WarehouseItemRegistrationOperational.tsx` também foi alterado pela PERF-B já integrada para preservar code splitting/lazy loading das subtelas;
- `package.json` também foi alterado pela PERF-H já integrada para adicionar os scripts `perf:r3:*`.

Essas sobreposições foram resolvidas pelo Chat Coordenador na integração certificada. Passaram a coexistir:
- o intake seletivo da PERF-D;
- os imports dinâmicos da PERF-B;
- os scripts de métricas da PERF-H;
- os testes/scripts específicos da PERF-D.

Resultado consolidado:
- intake seletivo da PERF-D preservado;
- `dynamic import()` da PERF-B preservado em `WarehouseItemRegistrationOperational.tsx`;
- scripts `perf:r3:*` da PERF-H preservados no `package.json`;
- scripts/testes da PERF-D adicionados;
- CI combinado, Core Protection e Recovery Guardrails verdes.

A dependência da PERF-F foi satisfeita e a PERF-F já foi concluída e integrada em `14aaa2e747fffaf2427ea63f4cd52395545d9a22`.

### Regra de guards em trabalho paralelo

Guards estruturais são contratos de regressão, mas muitos deles também codificam **onde** a implementação existia no momento em que foram criados. Durante uma refatoração estrutural como code splitting/lazy loading, é permitido ao chat trabalhador adaptar um guard **somente quando a falha decorre diretamente da sua própria mudança de localização/composição**, sem reduzir a proteção semântica existente.

É proibido ao trabalhador:
- alterar lógica funcional de outra frente apenas para satisfazer um guard textual;
- editar uma view de outro domínio quando a falha apareceu porque outra PERF já integrada reorganizou aquela implementação;
- enfraquecer um guard para obter CI verde;
- assumir responsabilidade por regressão cruzada criada pela combinação de branches independentes.

Quando um guard falhar por efeito combinado entre frentes, o trabalhador deve:
1. registrar a falha e a evidência;
2. confirmar que seu próprio contrato continua preservado;
3. **parar naquele ponto** sem invadir o escopo alheio;
4. entregar ao Chat Coordenador, que resolve a compatibilidade na branch integradora/PERF-I.

Exemplo vigente: a PERF-A pode atualizar guards que ainda procuram código movido de `app/page.tsx` para `OperationalWorkspace`. Porém, uma falha de guard provocada por reorganização interna de `NotasFiscaisView.tsx` já integrada pela PERF-E não deve ser corrigida pela PERF-A alterando Notas Fiscais; essa reconciliação pertence ao coordenador.


## 7.1. Retomada canônica para novos chats — estado pós-PERF-I / pré-PERF-J

Este bloco é o ponto de partida obrigatório para novos chats da Performance R3 enquanto a rodada não chegar à `main`.

### Referências atuais

- produção/`main`: `22d9fe5f86e2cfbb247eb21bae28e4b2c6cb2a2f`;
- branch integradora: `feat/performance-r3-commercializacao`;
- HEAD certificado pela PERF-J: `c08c6efa9931bf1df95aee86db51de1b8edb1912`;
- **A/B/C/D/E/F/G/H/X estão integradas**; PERF-X também certificada;
- PERF-I está **APROVADA E ENCERRADA**;
- PERF-J está **APROVADA**;
- não houve merge consolidado da R3 em `main`;
- não houve release consolidado da R3 em produção.

### Integrações consolidadas

- PERF-A: worker `3193b84` → integração `15eadb0`;
- PERF-B: worker `7b7aee1` → incorporada à integradora;
- PERF-C: worker `c263ce3` → integração `e33e260`;
- PERF-D: worker `022fae7` → integração `2e77af1`;
- PERF-E: worker `149f7c3` → integração `9d5ff58`;
- PERF-F: worker `570661b` → integração `14aaa2e`;
- PERF-G: worker `de870d1` → integração `238b813`;
- PERF-H: worker `fb5f452` → integração `a686410`;
- PERF-X: worker `8aac69a` → integração `2aca0dce` → correção semântica coordenadora `2b72d43`.

Essas frentes são base da PERF-I/PERF-J e não devem ser reabertas sem regressão objetiva.

### PERF-X — contrato final

- `invoices` operacional permanece realtime; histórico fica sob demanda;
- depois do backfill READY, realtime = `APROVISIONAMENTO` + `COMISSAO`;
- antes do READY, fallback integral legado permanece por segurança;
- NFs em `TESOURARIA` continuam acessíveis no histórico;
- nenhum corte por idade/ano foi adotado;
- Empenhos carrega NFs completas do detalhe sob demanda;
- contagens usam agregação sem download integral;
- Nova NF abre em **Em tramitação**, sem ocultar Comissão/Tesouraria pendentes;
- `Todas` e `Concluídas` carregam histórico sob demanda;
- contagem de concluídas é compatível com legado antes do READY;
- operações críticas consultam histórico completo quando necessário.

Métrica sintética com 20 NFs operacionais:
- 100 → 20 documentos realtime;
- 1.000 → 20;
- 10.000 → 20;
- histórico pré-solicitação = 0.
Não tratar esses percentuais como leitura real de produção.

Certificação final:
- PR #208 / CI #867 certificou a worker combinada;
- integração `2aca0dce...`;
- correções de UX/legado `2b72d43...`;
- PR técnico #209 certificou exatamente esse delta;
- Application CI #868, Core Protection #155, build, TypeScript, Diff Hygiene, segurança e release gates 16–21: **PASS**.

### Resultado técnico combinado certificado pela PERF-I

Coleta final:
- `/`: **335 kB First Load JS** contra baseline 460 kB (**-27,17%**);
- seis rotas principais da Central: **106 kB** contra baseline original 579 kB (**-81,69%**);
- `/admin`: **327 kB** contra baseline 326 kB (**+0,31%**);
- `/admin/backups`: **245 kB**;
- shared: **104 kB** contra baseline 103 kB (**+0,97%**);
- budget final: **within configured budgets**.

### Prioridade absoluta: experiência do usuário

> **performance só é aprovada quando melhora ou preserva a experiência real do operador.**

Critérios bloqueantes incluem perda de dados digitados, informação enganosa/stale sem tratamento, clique sem resposta, espera sem feedback, estado confuso, refresh manual novo, quebra de foco/ENTER/scanner, navegação menos previsível ou piora relevante em hardware/conectividade modestos.

### Sequência de fechamento da R3 — CONCLUÍDA

A sequência prevista pela PERF-I/PERF-J foi integralmente cumprida:
1. o usuário autorizou explicitamente a publicação;
2. a R3 foi integrada em `main` pelo PR #212;
3. o release final ficou em `main@e90f92acae1514ee5cbc6ce95fed354bc1454330`;
4. a Vercel publicou esse release com sucesso;
5. as Rules indispensáveis de `emprovex-warehouse` foram publicadas via Firebase CLI;
6. o ciclo Performance R3 foi encerrado;
7. o ciclo ativo passou a ser o **EMPROVEX SaaS R1**, detalhado na seção 7.2.

### Regra para qualquer novo chat

Antes de editar:
- conferir HEAD real da integradora;
- partir da integradora atual, salvo instrução expressa do Coordenador;
- ler Memorial, Handoff, Integration Status, Execução Paralela, Testing Policy e Development CI Workflow;
- A–H/X são contratos integrados;
- não fazer merge em `main`, deploy de produção ou promoção Vercel sem autorização;
- Browser E2E permanece sob demanda; a validação dirigida/manual obrigatória da PERF-I já foi concluída;
- `docs/PERFORMANCE_R3_PERF_X_HOT_HISTORY.md` registra a implementação da worker e pode conter texto anterior às correções semânticas do Coordenador; em caso de divergência sobre filtro inicial/contagem legada, prevalecem este Memorial, `PERFORMANCE_R3_INTEGRATION_STATUS.md` e o código integrado a partir de `2b72d43...`.

### Certificação PERF-J concluída — 2026-10-01

Status: **PERF-J — APROVADA**.

HEAD certificado:
`c08c6efa9931bf1df95aee86db51de1b8edb1912`

Baseline original:
`main@22d9fe5f86e2cfbb247eb21bae28e4b2c6cb2a2f`

Evidência final:
- PR técnico #210 foi usado somente para certificação e fechado **sem merge**;
- Application CI #871: **SUCCESS** após repetição dos jobs falhos no mesmo SHA;
- EMPROVEX Core Protection #158: **SUCCESS**;
- Recovery guardrails #559: **SUCCESS**;
- Production Build: **PASS**;
- Final TypeScript: **PASS**;
- Diff Hygiene: **PASS**;
- gates finais 16, 17, 18, 19, 20 e 21: **PASS**;
- segurança multi-tenant, Firestore, acesso externo da Central, Block 17.4, Block 17.5, Block 17.8, resiliência e backup: **PASS**;
- métricas/parser/sanitização: **3/3 PASS**;
- `perf:r3:collect`, `perf:r3:compare` e `perf:r3:budget`: **PASS**.

Métricas finais reproduzidas a partir do build bem-sucedido do HEAD certificado:
- `/`: **460 → 336 kB** = **-26,96%**;
- Central principal: **579 → 106 kB** = **-81,69%**;
- `/admin`: **326 → 327 kB** = **+0,31%**;
- shared: **103 → 104 kB** = **+0,97%**;
- `/admin/backups`: **245 kB**;
- budget: **within configured budgets**.

A coleta da PERF-J mostrou `/` em 336 kB, 1 kB acima dos 335 kB registrados na PERF-I. Não há regressão de budget nem mudança funcional associada; o valor final desta certificação é 336 kB e substitui 335 kB apenas para o relatório da PERF-J.

Ocorrências tratadas:
1. Application CI #869 encontrou somente trailing whitespace no diff. A correção mínima foi integrada em `c08c6efa...`, sem alteração funcional.
2. A primeira tentativa do Application CI #871 falhou no loader de `next/font` durante o build. `app/layout.tsx` permaneceu byte-identical entre o HEAD anterior e `c08c6efa...`; a repetição no mesmo SHA passou integralmente, classificando a ocorrência como falha transitória de ambiente/serviço externo, não regressão do produto.
3. Durante a certificação técnica, o status Vercel do candidato foi afetado pelo limite `build-rate-limit`; naquele momento nenhum deploy de produção foi executado. Posteriormente, a release autorizada `e90f92aca...` foi publicada com sucesso.

A validação manual da PERF-I não foi repetida porque, depois do HEAD funcional já aprovado, a PERF-J alterou apenas documentação e higiene de whitespace, sem mudança de comportamento. Browser E2E continuou sob demanda.

Riscos residuais permanecem os já documentados: cache estrutural cross-session pode ficar visualmente stale por até 30 s sem ser autoridade operacional; PERF-X depende do marcador READY para ativar o recorte seletivo; budgets ainda são gate explícito do Coordenador e não bloqueio automático do Application CI; benchmarks manuais de CPU/memória continuam indicativos, não laboratoriais.

## 7.2. EMPROVEX SaaS R1 — planejamento detalhado vigente

A condição de abertura do SaaS R1 foi cumprida: a Performance R3 chegou à produção em `main@e90f92acae1514ee5cbc6ce95fed354bc1454330` e as Rules indispensáveis da Central foram publicadas.

Branch integradora oficial:
`feat/saas-r1-commercializacao`

Fontes canônicas:
- `docs/SAAS_R1_PLANO_MESTRE.md`;
- `docs/SAAS_R1_EXECUCAO_PARALELA.md`;
- `docs/SAAS_R1_INTEGRATION_STATUS.md`;
- `docs/SAAS_R1_COORDENADOR_HANDOFF.md`.

### Decisão arquitetural

> **O SaaS R1 será uma camada comercial assistida sobre o EMPROVEX existente. Não haverá reconstrução de billing, autenticação, multi-tenancy, backup ou monitoramento sem necessidade comprovada.**

A auditoria confirmou que já existem:
- billing Bloco 22 em modo OBSERVE;
- billing Bloco 22 possui baseline técnico atual de R$ 50/mês; o contrato comercial do SaaS R1 foi atualizado para **R$ 70/mês no Plano Completo**, com trial 30 dias, 5º dia útil e tolerância 10 dias;
- painel de assinaturas e confirmação manual;
- provisionamento de workspace/UG/Auth;
- auditoria;
- Termos/Privacidade;
- backup lógico;
- Cloud Monitoring e telemetria de custo.

### Caminho de menor burocracia

R1:
- onboarding assistido pelo fundador;
- sem signup público;
- Link de Pagamento Mercado Pago e/ou Pix;
- confirmação administrativa;
- sem API/webhook do Mercado Pago;
- sem checkout próprio;
- suspensão manual;
- sem exclusão automática por inadimplência;
- reset de senha self-service via Firebase;
- aceite legal versionado;
- suporte simples;
- backup nativo dos dois bancos Firestore + backup lógico existente;
- uptime pelo Google Cloud Monitoring.

Plano de assinatura recorrente sem integração fica como evolução R1.1 se o piloto provar que a conciliação manual passou a causar atrito.

### Contratos comerciais congelados

- **Plano Completo EMPROVEX: R$ 70,00/mês por workspace**, sem tiers e sem módulos pagos à parte;
- workspace regular, trial válido e VIP recebem acesso integral ao sistema conforme suas permissões operacionais;
- VIP externo é isenção comercial: usa internamente `exempt`, custa R$ 0 e mantém o mesmo acesso funcional;
- **coorte VIP legado congelada em 2026-10-02:** todo workspace externo que já estava cadastrado no EMPROVEX nessa data deverá ser migrado para `exempt`, com R$ 0, sem trial/cobrança/inadimplência e com Plano Completo;
- a coorte VIP legado não será convertida automaticamente em pagante no futuro; qualquer retirada dessa isenção exige decisão administrativa explícita do fundador e auditoria;
- VIP legado recebe as mesmas funcionalidades presentes e futuras do Plano Completo, sem limitação comercial por módulo; continuam valendo apenas as restrições normais de segurança, tenant, UG e autorização operacional;
- novos workspaces cadastrados após o corte de 2026-10-02 seguem o contrato comercial vigente de **R$ 70,00/mês**, salvo concessão manual de VIP/`exempt`;
- concessão/remoção de VIP fora da coorte legada é exclusivamente administrativa e auditada;
- 1 workspace = 1 UG na R1;
- 1 conta operacional primária por workspace;
- fonte comercial = `billingAccounts/{workspaceId}`;
- estados existentes preservados;
- fundador isento;
- trial não bloqueia automaticamente ao expirar;
- atraso não suspende automaticamente;
- founder decide suspensão/reativação;
- suspension/cancelamento nunca apagam dados;
- status comercial e status de acesso permanecem conceitos separados.

### Arquitetura de banco para o SaaS R1

**Não será criado um terceiro banco Firestore apenas para as novas Rules do SaaS.**

O banco principal continuará concentrando identidade, workspace, billing, legal e lifecycle. A Central de Depósitos continua isolada em `emprovex-warehouse`.

As Rules são implantadas por banco e um banco adicional traria novo target, SDK, backup, monitoramento e sincronização sem benefício proporcional nesta fase. Novo banco só será reavaliado diante de um domínio realmente independente ou necessidade objetiva de isolamento/escala/regionalização.

### Enforcement

Não adicionar billing como dependência de cada Firestore Rule.

A fase SAAS-DS, depois de billing/onboarding integrados, sincronizará suspensão manual com `workspaces.status` e `platformAccounts.status`, já usados pelas Rules. Assim:
- segurança continua server/rules enforced;
- não há nova leitura de billing em toda operação;
- reativação é reversível;
- dados não são modificados;
- sessões podem ser revogadas de forma controlada.

### Ondas

**SAAS-A — Fundação/contratos: CONGELADA.**

**Onda 1 paralela: INICIADA em 2026-10-01**
- autorização explícita do usuário registrada;
- quatro workers devem partir da mesma base da integradora;
- cada worker tem branch e escopo exclusivos;
- nenhum worker publica `main`, Vercel ou Rules em produção;
- o Chat Coordenador permanece responsável por handoffs, conflitos, integração semântica e atualização deste memorial.

Frentes ativadas:
- **SAAS-B — Billing/regularização:** **INTEGRADA** na branch coordenadora via PR #216; Plano Completo R$ 70, VIP/Isento, regularização pública e confirmação manual certificados;
- **SAAS-C — Onboarding:** **INTEGRADA semanticamente** na branch coordenadora em `cf320ce3...`; reset self-service, troca de senha, mensagens humanas, Minha conta e checklist curto incorporados;
- **SAAS-DL — Legal/aceite:** **INTEGRADA semanticamente** na branch coordenadora; Termos/Privacidade R1, versões legais, aceite tenant-scoped e Rules create-only incorporados; glue do `LegalAcceptanceGate` permanece deliberadamente para depois da SAAS-C/SAAS-I;
- **SAAS-E — Operação/backup/uptime:** **INTEGRADA** via PR #215; PITR, delete protection e backup diário já foram aplicados nos dois bancos em 2026-10-02; permanecem pendentes backup READY, restore real isolado e uptime/alertas externos.

**Onda 2 — CONCLUÍDA**
- **SAAS-DS — Segurança/enforcement:** **INTEGRADA** via PR #218 / squash `726436ac...`; suspensão/reativação server-side, revogação de sessões e enforcement da Central incorporados, sem publicação de Rules em produção.

**Fechamento**
- **SAAS-I — integração controlada: APROVADA E INTEGRADA via PR #219 / squash `25dda487...`**;
- **SAAS-P — piloto real: ADIADO até Release Candidate congelado**;
- SAAS-J — certificação final pós-piloto;
- SaaS aberto somente com decisão explícita do usuário.

### Operação/backup

O backup lógico no Drive é preservado, mas não será a única proteção comercial.

Antes do SaaS aberto:
- backup nativo diário do banco operacional principal;
- backup nativo diário do `emprovex-warehouse`;
- pelo menos uma restauração real em banco novo;
- endpoint de health sem consulta operacional;
- uptime HTTPS/SSL no Cloud Monitoring;
- runbook de incidente.

### Legal

Termos/Privacidade comerciais e o domínio de aceite versionado já estão integrados. O `LegalAcceptanceGate` continua deliberadamente sem glue no shell até a integração controlada SAAS-I.

O software não declarará conformidade jurídica absoluta nem presumirá enquadramento como agente de pequeno porte. Validação legal/contábil externa permanece um gate antes da abertura pública quando aplicável.

### Piloto

Piloto inicial recomendado:
- 3 a 5 workspaces externos;
- a coorte VIP legado pode participar do piloto funcional, mas **não serve como evidência de cobrança**, pois permanece isenta;
- pelo menos um pagamento real deve ser validado com workspace **não pertencente à coorte VIP legado**;
- trial → ativação;
- suspensão → reativação controlada;
- restauração testada;
- isolamento confirmado;
- custos medidos;
- suporte observado.

A meta de capacidade comercial é até 100 usuários registrados, distinguindo cadastrados, ativos e simultâneos.

### Regra de produção

Workers nunca fazem merge em `main`, deploy Vercel, deploy de Rules ou promoção de produção.

A **release final / abertura comercial** da branch integradora só ocorre após SAAS-J e autorização explícita do usuário. Antes disso, o Release Candidate pode ser disponibilizado em ambiente de piloto controlado — preview/staging ou, se tecnicamente necessário, publicação controlada no ambiente existente — somente com autorização explícita, rollback definido e sem abertura comercial ampla.

## 8. Programa ativo — Central Móvel R1

### 8.1 Estado e objetivo

A **Central Móvel R1** foi ativada em 2026-10-02 como programa funcional coordenado da Central de Depósitos. Sua integradora é `feat/central-mobile-r1`; a MOBILE-0 foi congelada e a primeira onda MOBILE-A/MOBILE-B foi liberada. Essa ativação não autoriza merge em `main`, deploy de produção, publicação de Rules ou migração produtiva sem os gates e autorizações próprios da rodada.

Nome de produto provisório:
**EMPROVEX — Central Móvel R1**

Código interno da rodada:
`MOBILE-R1`

Branch integradora recomendada, a ser criada somente pelo Coordenador quando o baseline for formalmente congelado:
`feat/central-mobile-r1`

Objetivo:
> permitir que o mesmo usuário autenticado do EMPROVEX execute, pelo navegador do celular e no próprio ponto físico da operação, alocação de recebimentos, transferências, consultas, inventário, saídas e conferências por leitura de códigos de barras de produtos e posições, reutilizando integralmente as autoridades de dados já existentes da Central de Depósitos.

A Central Móvel **não é um segundo sistema**, não cria um segundo usuário e não cria outra fonte de verdade. Ela é uma nova superfície operacional sobre os mesmos contratos do EMPROVEX.

### 8.2 Princípio de produto

No desktop, a Central de Depósitos permanece responsável pelas superfícies completas de administração, cadastro, supervisão, relatórios, configuração, croqui, controle de materiais e demais operações já existentes.

No celular, o mesmo usuário autenticado recebe uma experiência própria, simplificada e orientada à operação física, com foco em:
- câmera;
- leitura de códigos;
- botões grandes;
- etapas sequenciais claras;
- confirmação explícita;
- feedback sonoro/visual/tátil quando suportado;
- mínimo de navegação administrativa;
- carregamento somente do que for necessário para a tarefa corrente.

A experiência móvel não deve aparecer como uma nova conta ou novo módulo de autorização. Ela deve reutilizar autenticação, workspace, UG, sessão, isolamento e permissões vigentes.

Detecção de dispositivo não é mecanismo de segurança. A rota móvel pode ficar ausente da navegação desktop e exibir aviso de interface móvel quando acessada por computador, mas toda autorização continua sendo validada por identidade, workspace, UG e regras do domínio.

### 8.3 Modus operandi obrigatório

A Central Móvel R1 deve seguir o modelo oficial de desenvolvimento paralelo do EMPROVEX:

> **baseline + contratos comuns → frentes independentes → ondas paralelas → handoffs → integração semântica controlada → validação integrada → certificação final**

A rodada não deve ser executada como uma fila monolítica em um único chat.

Regras obrigatórias:
- existir um **Chat Coordenador / Integrador / Avaliador** permanente;
- existir uma **branch integradora exclusiva** da MOBILE-R1, separada de `main`;
- cada worker possuir branch e escopo exclusivos;
- cada worker declarar arquivos/áreas que pretende alterar antes de editar;
- nenhum worker fazer merge direto em `main`;
- nenhum worker fazer deploy de produção;
- nenhum worker integrar outra frente por conta própria;
- nenhum worker invadir outra frente para resolver conflito;
- sobreposições de arquivos/contratos voltam para o Coordenador;
- o Coordenador recebe handoffs e classifica cada frente;
- conflitos são resolvidos semanticamente na integradora, nunca por escolha mecânica global de `ours/theirs`;
- integração não pode ser usada para adicionar features novas;
- certificação ocorre somente sobre o conjunto integrado;
- merge/release final exige decisão explícita do usuário.

Status possíveis de uma frente ao ser recebida pelo Coordenador:
- `APROVADA`;
- `APROVADA COM PENDÊNCIA`;
- `DEVOLVIDA`;
- `BLOQUEADA`.

### 8.4 Documentos canônicos da rodada

Antes da liberação dos primeiros workers, o Chat Coordenador deve criar e versionar:

- `docs/CENTRAL_MOBILE_R1_PLANO_MESTRE.md`;
- `docs/CENTRAL_MOBILE_R1_EXECUCAO_PARALELA.md`;
- `docs/CENTRAL_MOBILE_R1_INTEGRATION_STATUS.md`;
- `docs/CENTRAL_MOBILE_R1_COORDENADOR_HANDOFF.md`.

O Coordenador deve manter esses quatro documentos coerentes com este Memorial.

`CENTRAL_MOBILE_R1_INTEGRATION_STATUS.md` deve ser o quadro vivo da rodada e deve registrar, por frente:
- branch;
- base SHA;
- HEAD;
- status;
- proprietário;
- arquivos reservados;
- dependências;
- contratos reutilizados;
- testes/gates;
- métricas;
- riscos;
- situação de integração.

Somente o Coordenador mantém o estado global da rodada.

As decisões permanentes que alterarem a arquitetura da Central devem também ser consolidadas em `docs/adm-deposito/DECISIONS.md`.

### 8.5 MOBILE-0 — baseline e contratos comuns

Antes de abrir qualquer worker, o Coordenador executa a etapa **MOBILE-0**.

MOBILE-0 não é uma feature. É a fundação e o congelamento de contratos.

O Coordenador deve:
1. consultar `main`, a branch integradora vigente do programa anterior e o estado real de produção;
2. escolher e registrar o baseline exato da MOBILE-R1;
3. preservar o baseline original durante toda a rodada;
4. conferir a documentação atual da Central;
5. mapear arquivos potencialmente compartilhados;
6. congelar interfaces comuns antes da primeira onda;
7. definir métricas iniciais de performance e leituras;
8. registrar riscos conhecidos;
9. somente depois criar/liberar as branches trabalhadoras.

Contratos mínimos a congelar:

| Domínio | Autoridade/decisão |
| --- | --- |
| usuário | mesmo usuário EMPROVEX |
| autenticação | Firebase Auth vigente |
| workspace/UG | mesmos contratos multi-tenant |
| sessão | mesma política de sessão/lease |
| material | material canônico existente |
| saldo agregado | `warehouse_balance_v1` |
| distribuição física | `warehouse_location_balance_v1` |
| movimentações | ledger append-only vigente |
| barcode de produto | `warehouse_barcode_v1` |
| lote/validade | contratos vigentes |
| posição | `WarehouseStockPosition` |
| transferência | `TRANSFER` vigente |
| saída | `OUTBOUND` vigente |
| inventário | contratos `warehouse_inventory_v1` e `warehouse_inventory_item_v1` |
| NF/intake | contratos atuais de intake |
| segurança | workspace/UG + fail-closed |
| scanner | infraestrutura compartilhada |
| câmera | captura local; não armazenar vídeo |
| desktop | não carregar scanner/câmera sem necessidade |
| mobile | superfície operacional própria |
| escrita offline | fora da R1 |
| fonte de verdade | nunca duplicada |

Nenhuma frente posterior pode inventar seu próprio saldo, catálogo, modelo de posição, fluxo de inventário, transferência ou mecanismo de autorização.

### 8.6 Regra online-first

A MOBILE-R1 deve ser **online-first**.

Não implementar na R1:
- fila persistente de movimentações offline;
- confirmação tardia automática de transferência;
- saída armazenada localmente para sincronização posterior;
- inventário que gere ajuste sem revalidação online.

Motivo: operações físicas são sensíveis a concorrência e saldo. Uma operação preparada offline pode ficar obsoleta antes de ser sincronizada.

Quando houver perda de conexão:
- não considerar operação crítica confirmada sem resposta autoritativa;
- preservar rascunho local apenas quando seguro;
- recuperar a conexão;
- revalidar estado;
- exigir confirmação coerente;
- manter idempotência.

Offline completo pode ser avaliado em rodada futura separada.

### 8.7 Contrato compartilhado do scanner

Deve existir uma infraestrutura única de scanner móvel, reutilizada pelas demais frentes.

Conceito:
`WarehouseMobileScanner`

Tipos de leitura:
- `PRODUCT`;
- `LOCATION`;
- `UNKNOWN`.

Estados de expectativa:
- `EXPECT_PRODUCT`;
- `EXPECT_LOCATION`;
- `EXPECT_SOURCE_LOCATION`;
- `EXPECT_DESTINATION_LOCATION`.

Fluxo conceitual:
**câmera → decoder → normalização → identificação → resolver → evento validado**

O scanner:
- não altera saldo;
- não cria movimento;
- não confirma operação de negócio;
- não substitui validação de backend;
- deve prevenir double scan;
- deve permitir entrada manual como fallback;
- deve desmontar câmera corretamente ao sair da superfície;
- deve ser carregado sob demanda, evitando regressão no bundle desktop.

Não depender exclusivamente de uma API experimental de navegador se isso comprometer compatibilidade Android/iPhone. A implementação deve possuir estratégia de fallback validada pelo Coordenador.

### 8.8 Contrato compartilhado das etiquetas físicas

Código de produto e código de posição são identidades diferentes.

As etiquetas físicas devem evoluir a infraestrutura existente de:
- depósito;
- local;
- subposição;
- PDF de etiquetas.

Cada etiqueta deve continuar legível por humanos e também conter identificador escaneável.

O identificador de posição deve resolver de forma inequívoca:
- workspace/escopo validado;
- UG;
- `depotId`;
- `locationId`;
- `subpositionId`, quando existir.

O barcode não deve depender do nome visível da posição.

Renomear uma prateleira/local não deve alterar sua identidade técnica.

A etiqueta é identificador, **não autorização**. Toda operação continua revalidando usuário, workspace, UG, status ativo e relação correta da estrutura física.

### 8.9 Topologia oficial da MOBILE-R1

A topologia planejada é:

```text
                    MOBILE-0
             BASELINE + CONTRATOS
                       |
              +--------+--------+
              |                 |
          MOBILE-A          MOBILE-B
      Plataforma/Scanner  Etiquetas/Resolver
              |                 |
              +--------+--------+
                       |
                  INTEGRAÇÃO 1
                       |
          +------------+------------+
          |            |            |
      MOBILE-C     MOBILE-D      MOBILE-E
      Alocação    Transfer.      Consulta
          |            |            |
          +------------+------------+
                       |
                  INTEGRAÇÃO 2
                       |
          +------------+------------+
          |            |            |
      MOBILE-F     MOBILE-G      MOBILE-H
      Inventário     Saída       Conferência
          |            |            |
          +------------+------------+
                       |
                   MOBILE-I
           INTEGRAÇÃO CONTROLADA
                       |
                   MOBILE-J
             CERTIFICAÇÃO FINAL
                       |
                decisão do usuário
                       |
                merge/release
```

Desenvolvimento paralelo e ordem de integração são conceitos diferentes. O Coordenador pode alterar a ordem de integração quando isso reduzir conflito, desde que registre a justificativa.

### 8.10 Primeira onda — fundação técnica

#### MOBILE-A — Plataforma Móvel e Scanner

Branch recomendada:
`mobile-r1-a-platform-scanner`

Responsabilidade:
- rota/shell móvel;
- experiência responsiva exclusiva;
- acesso à câmera;
- preferência pela câmera traseira quando possível;
- decoder;
- lazy loading;
- feedback de leitura;
- prevenção de leituras duplicadas;
- tratamento de permissão negada;
- fallback manual;
- feedback sonoro/tátil quando suportado;
- gerenciamento dos estados `EXPECT_*`;
- desmontagem correta da câmera;
- não contaminar bundle desktop com dependência pesada do scanner.

Não deve:
- alterar ledger;
- alterar intake;
- implementar alocação;
- movimentar estoque;
- criar inventário;
- alterar regra de transferência/saída;
- assumir propriedade das etiquetas.

#### MOBILE-B — Identidade Física, Etiquetas e Resolver

Branch recomendada:
`mobile-r1-b-location-labels`

Responsabilidade:
- formato do identificador escaneável de posição;
- evolução das etiquetas;
- barcode no PDF;
- suporte a depósito/local/subposição;
- resolver código → posição;
- validação de posição ativa;
- contrato de erros;
- compatibilidade com renomeação;
- proteção contra colisão;
- testes de identidade.

Não deve:
- criar fluxo de câmera;
- movimentar saldo;
- implementar transferência;
- implementar inventário;
- criar UI operacional completa.

### 8.11 Integração 1

Após handoff e aprovação de MOBILE-A e MOBILE-B, o Coordenador integra ambas e valida:

**câmera/leitura → decoder → identificação → resolver → `WarehouseStockPosition`**

Essa integração **não deve movimentar estoque**.

Somente depois de essa fundação ser aprovada os contratos compartilhados são considerados congelados para a segunda onda.

### 8.12 Segunda onda — operações independentes

Depois de A+B integradas/congeladas, podem avançar em paralelo:

- **MOBILE-C — Alocação Móvel**;
- **MOBILE-D — Transferência Móvel**;
- **MOBILE-E — Consulta Física**.

#### MOBILE-C — Alocação Móvel

Branch recomendada:
`mobile-r1-c-intake-allocation`

Reutiliza o intake atual, NF pendente, item pendente, material, barcode, lote/validade, `WarehouseStockPosition` e operação oficial de alocação.

Fluxo:
**NF → item → quantidade → scan produto → associação/cadastro de barcode quando necessário → validade/lote → scan posição → revalidação → confirmação → ALLOCATE**

Requisitos:
- permitir alocação parcial;
- um mesmo item pode ser dividido em várias posições;
- código desconhecido pode ser associado ao material selecionado apenas pelos contratos oficiais;
- conflito de barcode com outro material é bloqueante;
- validade pertence ao lote/enriquecimento logístico, não à identidade global do material;
- backend revalida pendência e posição antes do commit;
- resultado deve refletir automaticamente no depósito virtual/desktop.

Exemplo:
10 unidades de café podem ser alocadas como 5 na Prateleira 1 e 5 na Prateleira 4 sem criar saldo paralelo.

#### MOBILE-D — Transferência Móvel

Branch recomendada:
`mobile-r1-d-transfer`

Fluxo:
**scan origem → scan produto → quantidade → scan destino → revalidar origem/destino/saldo → confirmar → TRANSFER**

Invariantes:
- transferência não altera saldo agregado;
- origem e destino devem ser posições válidas e ativas;
- quantidade deve existir na origem;
- operação permanece idempotente;
- não substituir `TRANSFER` por OUTBOUND + entrada artificial.

#### MOBILE-E — Consulta Física

Branch recomendada:
`mobile-r1-e-physical-query`

Capacidade predominantemente read-only.

Fluxo:
**scan posição → resolver → carregar distribuição física → materiais → lotes/validade → visualização**

Pode mostrar:
- materiais registrados na posição;
- quantidades;
- lote;
- validade;
- origem quando disponível;
- outras posições do material;
- histórico curto/bounded quando apropriado.

Por ser leitura, é a candidata preferencial para primeira integração da segunda onda.

### 8.13 Integração 2

Após aprovação de C/D/E, o Coordenador deve executar regressão cruzada.

Jornada mínima:
1. alocar material em uma posição;
2. consultar a posição;
3. transferir parte para outra posição;
4. consultar origem e destino;
5. confirmar que o saldo agregado não mudou na transferência;
6. confirmar que a distribuição física mudou corretamente;
7. verificar reflexo no desktop.

Nenhum worker isolado é responsável por certificar essa jornada combinada.

### 8.14 Terceira onda — operações avançadas

Depois da integração 2, podem avançar em paralelo:

- **MOBILE-F — Inventário Móvel**;
- **MOBILE-G — Saída Móvel**;
- **MOBILE-H — Conferência Física/Digital**.

#### MOBILE-F — Inventário Móvel

Branch recomendada:
`mobile-r1-f-inventory`

Reutiliza `warehouse_inventory_v1` e `warehouse_inventory_item_v1`.

Fluxo:
**abrir/selecionar inventário → scan posição → mostrar esperado → scan/selecionar material → informar contagem → salvar contado → revisar → confirmação humana → INVENTORY_ADJUSTMENT quando necessário**

Invariantes:
- salvar contagem não altera estoque;
- diferença = contado - esperado;
- ajuste somente após revisão/confirmação;
- concorrência/revisão de posição continuam protegidas;
- item obsoleto deve seguir a política de `STALE/RECONCILIATION_REQUIRED` vigente;
- nenhuma segunda autoridade quantitativa.

Evolução permitida dentro da R1: contagem orientada por leitura de produto dentro de uma posição, desde que continue alimentando o inventário oficial e não crie mecanismo paralelo.

#### MOBILE-G — Saída Móvel

Branch recomendada:
`mobile-r1-g-outbound`

Reutiliza `OUTBOUND`, saldos, posições, lotes e FEFO existentes.

Fluxo:
**destino/retirado por → scan produto → quantidade → mostrar posições → recomendar FEFO → operador chega à posição → scan posição → confirmar lote quando aplicável → revalidar saldo → OUTBOUND**

A interface pode orientar fisicamente:
- posição recomendada;
- lote;
- validade;
- FEFO.

Mas FEFO continua seguindo a regra oficial já existente e não autoriza baixa silenciosa.

#### MOBILE-H — Conferência Física/Digital

Branch recomendada:
`mobile-r1-h-position-check`

Objetivo:
responder à pergunta **“este material está registrado nesta posição?”**

Fluxo:
**scan posição → scan produto → comparar distribuição oficial → indicar correto/incorreto**

Se incorreto:
- mostrar posição registrada;
- oferecer navegação para a Transferência Móvel;
- **não criar mecanismo próprio de transferência**.

Regra:
**Conferência detecta; MOBILE-D corrige.**

### 8.15 Integração 3

Após F/G/H:
- combinar fluxos;
- conferir que nenhuma frente duplicou scanner/resolver;
- validar navegação entre conferência e transferência;
- validar inventário sem mutação prematura;
- validar saída com posição/lote;
- executar regressão seletiva das capacidades anteriores.

### 8.16 MOBILE-I — Integração Controlada

MOBILE-I é conduzida pelo Chat Coordenador e **não é frente de feature**.

Objetivos:
- integrar somente frentes aprovadas;
- resolver conflitos semânticos;
- produzir glue code mínimo;
- remover duplicações;
- verificar interações cruzadas;
- proteger contratos comuns;
- medir impacto combinado;
- corrigir regressões de integração.

Não usar MOBILE-I para expandir escopo.

Verificações mínimas:
- login e sessão;
- workspace/UG;
- acesso móvel;
- navegação;
- câmera e permissões;
- scanner;
- troca de estados;
- barcode de produto;
- barcode de posição;
- intake;
- alocação;
- transferência;
- consulta;
- inventário;
- saída;
- conferência;
- idempotência;
- concorrência;
- isolamento;
- performance;
- bundle desktop;
- bundle mobile;
- reflexo desktop ↔ mobile.

Jornada integrada obrigatória:
1. login no celular;
2. selecionar NF pendente;
3. alocar 5 unidades de um item em uma posição;
4. alocar as restantes em outra;
5. consultar a primeira posição;
6. transferir parte para uma terceira;
7. consultar as três posições;
8. executar conferência material × posição;
9. realizar uma contagem de inventário sem alterar saldo prematuramente;
10. executar uma saída;
11. consultar distribuição final;
12. abrir a Central no desktop;
13. confirmar que o estado é o mesmo.

### 8.17 MOBILE-J — Certificação Final

Somente depois da MOBILE-I.

Gates técnicos obrigatórios:
- instalação reproduzível quando aplicável;
- TypeScript;
- build de produção;
- diff hygiene;
- EMPROVEX Core Protection;
- testes de domínio/contratos;
- guards estruturais;
- Firestore/segurança/isolamento aplicáveis;
- idempotência;
- concorrência;
- contratos barcode/location;
- regressão das operações de estoque afetadas.

Métricas mínimas:
- First Load JS do desktop antes/depois;
- First Load JS da rota móvel;
- peso do decoder/scanner;
- confirmação de lazy loading;
- tempo aproximado para ativar câmera;
- tempo leitura → identificação;
- tempo confirmação → persistência;
- estimativa de reads/writes por jornada;
- ausência de listener desnecessário.

Compatibilidade mínima:
- Android + Chrome;
- iPhone + Safari quando disponível para validação;
- desktop sem carregar scanner quando não usado;
- câmera concedida;
- câmera negada;
- câmera indisponível;
- entrada manual;
- conexão degradada;
- reload/navegação quando relevante.

Browser E2E continua **sob demanda conforme risco**, seguindo `docs/TESTING_POLICY.md`; não volta a ser gate permanente.

### 8.18 Validação manual obrigatória da experiência física

A MOBILE-R1 possui risco operacional que não pode ser certificado apenas por testes automatizados.

Validação manual com celular real deve fazer parte formal da certificação, especialmente para:
- ergonomia com uma mão;
- tamanho dos botões;
- legibilidade;
- enquadramento;
- velocidade de leitura;
- double scan;
- comportamento com mais de um barcode visível;
- foco;
- feedback visual;
- som;
- vibração;
- iluminação real do depósito;
- sequência de passos;
- clareza entre “ler material” e “ler local”;
- perda/retorno de conexão;
- uso durante deslocamento entre posições.

Sempre que possível, o teste manual deve receber uma build já protegida por typecheck, build, testes de domínio, guards e segurança.

### 8.19 Regra de propriedade de arquivos

Antes de editar, cada worker registra:
- arquivos que pretende alterar;
- arquivos apenas consultados;
- contratos reutilizados;
- dependências esperadas.

Se duas frentes precisarem editar o mesmo arquivo estrutural:
1. o Coordenador define proprietário;
2. a outra frente cria adapter/helper próprio quando seguro;
3. se a separação não for segura, aquele ponto deixa de ser paralelo.

Exemplo de regra planejada:
- MOBILE-A deve ser proprietária do shell/scanner compartilhado;
- C/D/E/F/G/H devem preferir componentes operacionais próprios;
- nenhuma frente operacional deve reescrever o shell apenas por conveniência.

### 8.20 Handoff obrigatório

Todo worker deve entregar:

```text
MOBILE-[X] — HANDOFF

Branch:
HEAD:
Base utilizada:

Status:
- APTO PARA REVISÃO / PARCIAL / BLOQUEADO

Objetivo executado:

Arquivos alterados:

Arquivos apenas consultados:

Contratos reutilizados:

Contratos novos:

Mudanças funcionais intencionais:

Testes executados:
- comando -> resultado

Gates não executados:
- motivo

Métricas:

Riscos:

Dependências:

Conflitos esperados:

Documentação atualizada:

Não realizado:
- merge main
- deploy produção
- trabalho de outra frente
```

Sem handoff suficiente, o Coordenador não integra a frente.

### 8.21 Regra de interrupção

Qualquer worker deve interromper a própria frente e devolver o problema ao Coordenador se descobrir:
- vulnerabilidade crítica;
- risco de perda/corrupção de dados;
- quebra de isolamento multi-tenant;
- possibilidade de duplicação de saldo;
- necessidade de alterar ledger canônico;
- quebra de idempotência;
- barcode ambíguo sem solução dentro do contrato congelado;
- necessidade real de alterar contrato compartilhado;
- dependência circular;
- conflito estrutural com outra frente;
- necessidade de implementar sincronização offline para concluir seu escopo;
- baseline incorreto que invalide testes/métricas.

O worker não deve ampliar a própria missão silenciosamente.

### 8.22 Escopo explicitamente fora da R1

Não pertencem à Central Móvel R1:
- aplicativo nativo Android;
- aplicativo nativo iOS;
- Play Store/App Store;
- operação integral offline;
- sincronização tardia de movimentos offline;
- RFID;
- NFC;
- reconhecimento visual por IA;
- OCR automático de validade;
- parsing GS1 avançado como requisito obrigatório;
- rastreamento Bluetooth;
- mapa indoor;
- rastreamento da localização física do operador;
- movimentação automática baseada apenas em leitura sem confirmação;
- armazenamento de fotos ou vídeos das operações.

Esses itens exigem rodada futura própria se o uso real justificar.

### 8.23 Critério objetivo de sucesso

A Central Móvel R1 estará **funcionalmente concluída** quando:

> um usuário autenticado puder executar pelo navegador de um celular alocação, transferência, consulta física, inventário, saída e conferência utilizando leitura de códigos de produto e posição, sobre as mesmas autoridades de dados, segurança, ledger, estoque, lotes e localizações da Central de Depósitos, sem fonte paralela de verdade e com reflexo coerente na versão desktop.

A rodada estará **tecnicamente certificada** somente quando coexistirem:
- workers aprovados;
- integrações semânticas concluídas;
- MOBILE-I encerrada;
- gates técnicos verdes;
- segurança/isolamento preservados;
- métricas registradas;
- teste real de câmera;
- validação operacional do usuário;
- MOBILE-J aprovada;
- decisão explícita do usuário sobre release.

### 8.24 Ordem recomendada de integração

A ordem de desenvolvimento não obriga a mesma ordem de merge.

Recomendação inicial:
1. MOBILE-A;
2. MOBILE-B;
3. Integração 1;
4. MOBILE-E;
5. MOBILE-C;
6. MOBILE-D;
7. Integração 2;
8. MOBILE-F/MOBILE-G/MOBILE-H em ordem decidida pelo Coordenador conforme conflitos reais;
9. Integração 3;
10. MOBILE-I;
11. MOBILE-J.

A justificativa para integrar MOBILE-E primeiro na segunda onda é seu caráter predominantemente read-only, útil para validar scanner + resolver com menor risco antes de operações mutáveis.

### 8.25 Papel do Chat Coordenador

O Chat Coordenador da MOBILE-R1:
- consulta HEADs reais antes de qualquer atribuição;
- mantém a branch integradora;
- congela MOBILE-0;
- cria/atualiza os quatro documentos canônicos;
- reserva propriedades de arquivos;
- emite prompts dos workers;
- recebe handoffs;
- revisa diff, testes, segurança, UX e métricas;
- classifica frentes;
- integra somente trabalho aprovado;
- resolve conflitos semanticamente;
- executa regressão após ondas;
- conduz MOBILE-I;
- conduz MOBILE-J;
- prepara o release consolidado;
- não faz merge/deploy em produção sem autorização do usuário.

O Coordenador não deve competir com os workers implementando silenciosamente o mesmo escopo.

### 8.26 Papel dos Chats Trabalhadores

Cada worker:
- lê este Memorial e os documentos `CENTRAL_MOBILE_R1_*`;
- confirma branch/base/HEAD antes de editar;
- executa apenas uma frente;
- preserva contratos globais;
- respeita propriedade de arquivos;
- executa testes proporcionais ao risco;
- registra métricas quando aplicável;
- entrega handoff;
- não integra outra frente;
- não publica produção.

### 8.27 Próximo passo autorizado de planejamento

Antes de qualquer implementação funcional da Central Móvel R1, o próximo Chat Coordenador deve:
1. conferir o HEAD real da base escolhida;
2. criar a branch integradora da rodada;
3. criar os quatro documentos `CENTRAL_MOBILE_R1_*`;
4. transformar esta macroarquitetura em contratos técnicos e critérios de aceite detalhados;
5. registrar o quadro vivo;
6. criar/liberar somente MOBILE-A e MOBILE-B como primeira onda;
7. manter MOBILE-C a MOBILE-H bloqueadas até a Integração 1 congelar os contratos compartilhados.

Esta seção é o **contexto mestre da Central Móvel R1** até que os documentos especializados sejam criados. Em caso de divergência futura, prevalecem: código integrado + este Memorial + documentos canônicos da rodada, conforme o estágio vigente.


## 9. Riscos/pendências que não devem ser esquecidos

- crescimento histórico das coleções operacionais continua exigindo disciplina de consultas seletivas; PERF-D resolveu o intake e PERF-X resolveu o histórico de `invoices` no caminho operacional normal, mas `empenhos`, `alerts`, `comissoes`, `cronogramas` e movimentos/ledger não devem ser migrados automaticamente sem nova evidência;
- PERF-F está integrada: o cache deve permanecer restrito a dados estruturais estáveis e nunca ser ampliado para mascarar query inadequada; o risco residual aceito é stale visual de até 30 s entre sessões, sempre com validações operacionais críticas consultando a fonte oficial;
- o layout persistente da PERF-G foi validado manualmente em navegação, back/forward, refresh direto e acesso externo durante a PERF-I;
- a redução seletiva da PERF-X só entra em vigor por workspace depois do backfill/marker READY; antes disso, o fallback integral permanece deliberado e deve continuar protegido pela certificação;
- `docs/PERFORMANCE_R3_PERF_X_HOT_HISTORY.md` descreve a worker pré-correção coordenadora; o contrato final de UX/legado está neste Memorial e no Integration Status;
- a PERF-I concluiu a validação de primeira abertura lazy, feedback, persistência/reset de estado, formulários, foco de barcode/teclado, cache curto, mensagens de erro, usuário externo e jornada em hardware/conectividade modestos;
- os budgets da PERF-H ainda são deliberadamente não bloqueantes no Application CI; adoção como gate permanente depende da certificação final;
- segurança e dependências continuam como linha separada de hardening;
- falha crítica real de segurança sempre interrompe a ordem normal de prioridades;
- documentação antiga pode descrever estados históricos como founder-only ou E2E obrigatório; essas afirmações não representam mais a política vigente quando conflitarem com este memorial e a `main`.

## 9. Regra de atualização

Ao concluir uma rodada relevante:
- atualizar este memorial;
- atualizar STATUS/DECISIONS/ROADMAP do domínio afetado;
- registrar baseline e resultado mensurável quando houver performance/custo;
- nunca apagar decisões antigas: marcar como superadas quando necessário;
- para Performance R3, manter este Memorial, `PERFORMANCE_R3_INTEGRATION_STATUS.md` e `PERFORMANCE_R3_COORDENADOR_HANDOFF.md` coerentes entre si;
- nunca tratar conversa isolada como fonte oficial superior ao repositório.


## 9. Início oficial da Onda 1 do SaaS R1 — 2026-10-01

O usuário autorizou o início imediato do desenvolvimento paralelo coordenado.

Chats trabalhadores autorizados:
- SAAS-B — Billing, Plano Completo, VIP e regularização — **CONCLUÍDA E INTEGRADA**;
- SAAS-C — Onboarding e credenciais — **CONCLUÍDA E INTEGRADA SEMANTICAMENTE**;
- SAAS-DL — Legal, Privacidade e aceite versionado — **CONCLUÍDA E INTEGRADA SEMANTICAMENTE**;
- SAAS-E — Operação, backup, uptime e recuperação — **CONCLUÍDA E INTEGRADA no repositório; configuração externa permanece pendente antes da abertura comercial**.

Regras de largada:
- todos partem da mesma revisão da branch `feat/saas-r1-commercializacao` que registra esta ativação;
- cada chat trabalha somente na própria branch;
- cada chat deve ler os cinco documentos canônicos antes de alterar código;
- nenhuma frente pode redefinir preço, trial, VIP, arquitetura de banco ou estados compartilhados;
- SAAS-DS permanece bloqueada até B e C estarem integradas;
- SAAS-I está **CONCLUÍDA E INTEGRADA**; a fase corrente é **HARDENING PRÉ-PILOTO**; o piloto real da SAAS-P foi adiado até o Release Candidate; SAAS-J permanece **AGUARDANDO** o piloto e as correções finais;
- handoff completo é obrigatório para integração;
- somente o Coordenador integra;
- nenhuma publicação em produção ocorre sem autorização explícita posterior do usuário.


### Registro de integração SAAS-B — 2026-10-01

Worker:
- branch: `saas-r1-b-billing-payment`;
- base: `32872d3fc6a781ff129eb4e41ae9b0d45658024a`;
- HEAD certificado: `7e288e79e1514f91c9f0099392302ec7efd5cefe`;
- PR #216;
- integração squash na coordenadora: `f91cda64582cc148bac340086be56163d366dd35`.

Certificação da worker:
- Application CI #886: **SUCCESS**;
- EMPROVEX Core Protection #173: **SUCCESS**;
- Recovery guardrails #573: **SUCCESS**;
- Production Build: **PASS**;
- TypeScript: **PASS**;
- Diff Hygiene: **PASS**;
- Firestore multi-tenant security: **PASS**;
- testes SAAS-B: **6/6 PASS**.

Resultado funcional integrado:
- Plano Completo = R$ 70/mês;
- VIP externo = `exempt` / R$ 0 / acesso completo;
- fundador = `exempt` / R$ 0;
- competências antigas preservam valor histórico;
- Link de Pagamento/Pix continuam externos ao EMPROVEX;
- rota pública `/regularizacao`;
- confirmação administrativa idempotente;
- billing permanece `observe`, sem enforcement operacional.

O status Vercel do PR falhou apenas por `build-rate-limit`; isso não foi classificado como regressão de código e não houve deploy de produção.

Na revisão do Coordenador, o único ajuste pós-merge foi de apresentação: o cabeçalho operacional passou a distinguir `Fundador / Isento` de `VIP / Isento`. O domínio comercial não foi alterado.


### Registro de integração SAAS-E — 2026-10-01

Worker:
- branch: `saas-r1-e-ops-recovery`;
- base: `32872d3fc6a781ff129eb4e41ae9b0d45658024a`;
- HEAD funcional certificado: `e650191a52656347b45c2769f1d93be9d21b2eac`;
- handoff documental inicial: `d7eb0075f7db35e9e826bd7b2e8dc4a83d4ff897`;
- correção exclusiva de Diff Hygiene feita pelo Coordenador: `8fb8e3ff3cd61bbc090a6a180528758930fdbd0f`;
- PR #215;
- integração squash na coordenadora: `82f2e6432b979634cae8023a773e31efa8f0cd65`.

Certificação final:
- Application CI #896: **SUCCESS**;
- EMPROVEX Core Protection #183: **SUCCESS**;
- Recovery guardrails #583: **SUCCESS**;
- Production Build: **PASS**;
- TypeScript: **PASS**;
- Diff Hygiene: **PASS**;
- guards de backup/recovery e disaster test em emulador: **PASS**.

Resultado integrado:
- endpoint público `GET /api/health` sem Firestore/segredos;
- política de backup nativo preparada para o banco principal e `emprovex-warehouse`;
- backup diário com retenção inicial de 14 semanas;
- PITR + delete protection contemplados no tooling;
- restore sempre planejado para database novo/isolado;
- backup lógico existente preservado;
- Central de Depósitos reconhecida como dependente de backup nativo para recuperação global;
- runbook de incidente, recuperação e suporte;
- runbook de uptime HTTPS/SSL no Cloud Monitoring;
- nenhum terceiro banco criado.

Pendências externas obrigatórias antes do SaaS aberto:
- **CONCLUÍDO em 2026-10-02:** ativar/verificar PITR e delete protection nos dois bancos;
- criar/verificar backup diário nos dois bancos;
- obter pelo menos um backup `READY` por banco;
- executar restore real em database isolado;
- publicar e validar `/api/health` na release consolidada;
- criar uptime check, alert policy e notification channel no Cloud Monitoring.

SAAS-E está **integrada no código**, mas essas pendências externas continuam gates de SAAS-J/abertura comercial.


### Registro de integração SAAS-DL — 2026-10-01

Worker:
- branch: `saas-r1-dl-legal-acceptance`;
- base: `32872d3fc6a781ff129eb4e41ae9b0d45658024a`;
- HEAD funcional certificado: `4806adfb35d4bad29f32695ae6a9de327fe1f40d`;
- HEAD final/handoff: `b460d1a41ca63c9e14b0c7004bbedfe4954fb633`;
- PR #214;
- PR fechado sem merge automático porque a integradora já havia avançado com SAAS-B/SAAS-E;
- integração semântica feita pelo Coordenador em `733885c1729d43623058b2dcfe4bea82f4eacabe`.

Certificação da worker:
- Application CI #892: **SUCCESS**;
- SAAS-DL Legal Validation #8: **SUCCESS**;
- EMPROVEX Core Protection #179: **SUCCESS**;
- Recovery guardrails #579: **SUCCESS**;
- Production Build: **PASS**;
- TypeScript: **PASS**;
- Diff Hygiene: **PASS**;
- Firestore Emulator/cross-tenant: **PASS**.

Integração semântica:
- preservou os testes de billing da SAAS-B em `verify:block-22-billing`;
- preservou os comandos de health/recovery da SAAS-E;
- adicionou apenas os dois scripts legais da SAAS-DL ao `package.json`;
- preservou as Rules de billing e acrescentou somente `validLegalAcceptanceCreate` + `legalAcceptances`;
- não criou terceiro banco;
- não ativou enforcement;
- não publicou Rules em produção.

Contrato legal integrado:
- `legalBundleVersion = saas-r1-2026-10-01`;
- `termsVersion = terms-2026-10-01-r1`;
- `privacyVersion = privacy-2026-10-01-r1`;
- caminho `workspaces/{workspaceId}/legalAcceptances/{uid}__{legalBundleVersion}`;
- aceite create-only, sem update/delete/list pelo tenant;
- UID/e-mail/UG/workspace validados;
- `acceptedAt == request.time`;
- VIP/isento segue o mesmo contrato legal de cliente pagante.

Pendência deliberada:
- `LegalAcceptanceGate` **ainda não está conectado ao shell/login**;
- o glue deve ocorrer somente depois de Auth + workspace + UG estarem resolvidos pela SAAS-C;
- integração final do gate pertence ao Coordenador/SAAS-I, sem bloquear reset de senha nem rotas públicas;
- as novas Rules legais ainda não foram publicadas em produção.

A SAAS-DL está integrada no código, mas revisão jurídica humana qualificada continua recomendada antes da abertura comercial ampla.


### Registro de integração SAAS-C — 2026-10-01

Worker:
- branch: `saas-r1-c-onboarding`;
- base original: `32872d3fc6a781ff129eb4e41ae9b0d45658024a`;
- HEAD funcional submetido aos gates: `524432969c0bc07acdbce9539830e703a8374226`;
- correção de teardown E2E: `8c7fc09912b7b01208fda9f5c0b3be848641e0c4`;
- HEAD final documental: `8bd5f38ce31073bd01b43e05fb46c103a9fe696d`;
- PR original #213 fechado sem merge;
- PR técnico #217 fechado sem merge;
- integração semântica do Coordenador: `cf320ce33f8bb9e667cf0eb59fcf456214109ed3`.

Certificação:
- Application CI #894: **SUCCESS**;
- EMPROVEX Core Protection #181: **SUCCESS**;
- Recovery guardrails #581: **SUCCESS**;
- Production Build: **PASS**;
- TypeScript: **PASS**;
- Diff Hygiene: **PASS**;
- release gates 16–21: **PASS**;
- segurança multi-tenant/Firebase Emulator: **PASS**.

Browser E2E dirigido:
- run #3 / id `36939984021`, attempt 2;
- login → relatório → NS por UG → reload: **PASS**;
- usuário externo vê Central de Depósitos: **PASS**;
- isolamento do segundo workspace: **PASS**;
- Playwright registrou **3 passed (30.9s)**.

O workflow terminou posteriormente como `cancelled` porque subprocessos do runner E2E permaneceram vivos no teardown até o timeout de 18 minutos. Não houve assert funcional falho após o `3 passed`. O patch `8c7fc099...` endureceu o encerramento da árvore de processos no Linux; a estratégia de process-group shutdown foi reproduzida isoladamente pelo Coordenador. O conector usado na coordenação não disparou novo GitHub Actions para esse commit, portanto **não existe run verde pós-teardown e isso não deve ser alegado**.

Resultado funcional integrado:
- onboarding continua assistido, sem signup público;
- reset de senha externo via Firebase Auth com resposta neutra;
- fundador continua Google-only;
- externo continua password-only;
- troca de senha exige reautenticação e provider correto;
- nenhuma senha/token é persistida no Firestore;
- mensagens técnicas de autorização ficam fora da UX;
- `Minha conta` disponível ao setor externo;
- checklist de primeiro acesso inicia fechado, é local ao navegador e não bloqueante;
- Drive continua opcional;
- nenhuma Rule/Index/env/banco novo;
- enforcement comercial continua reservado à SAAS-DS.

Com B+C integradas, a dependência da **SAAS-DS está satisfeita**.

Pendência transversal:
- conectar o `LegalAcceptanceGate` depois que Auth/workspace/UG estiverem resolvidos, na SAAS-I, preservando reset de senha e superfícies públicas.


### Registro de integração SAAS-DS — 2026-10-02

Worker:
- branch: `saas-r1-ds-security-enforcement`;
- base: `73c22a441249cd87b6d6e1dfeb69bcb005d663e9`;
- HEAD funcional certificado: `476efffaf60e5276e6d68ac9c2a425848b9fff66`;
- HEAD final/handoff: `073b96886d54b33e7e188265eb1e53672fbd9b1c`;
- PR #218;
- integração squash na coordenadora: `726436ac9db13eb5e0195cc33ac432005f3f113a`.

Certificação final do HEAD:
- Application CI #901: **SUCCESS**;
- EMPROVEX Core Protection #188: **SUCCESS**;
- Recovery guardrails #588: **SUCCESS**;
- SAAS-DL Legal Validation #13: **SUCCESS**;
- Production Build: **PASS**;
- TypeScript final: **PASS**;
- Diff Hygiene: **PASS**;
- multi-tenant Firestore Emulator: **PASS**;
- Central de Depósitos external workspace security: **PASS**.

Arquitetura integrada:
- billing permanece verdade comercial e não foi acoplado às Rules operacionais;
- `workspaces.status` + `platformAccounts.status` continuam sendo a verdade de autorização;
- suspensão é exclusivamente administrativa e explícita;
- endpoint founder-only: `POST /api/admin/sector-lifecycle`;
- suspensão materializa `disabled`, revoga sessões e remove leases ativos;
- reativação retorna a `active` sem recriar tenant, Auth, trial, billing ou dados;
- operações usam precondições `updateTime` e compensação entre os dois bancos;
- auditoria `sector.status_change` preservada;
- founder continua protegido;
- VIP/`exempt` não é transformado em estado de autorização nem suspenso automaticamente.

Central de Depósitos:
- novo espelho mínimo server-only: `emprovex-warehouse/warehouseAccess/{workspaceId}`;
- schema `warehouse_workspace_access_v1`;
- Rules logísticas passam a negar acesso quando o lifecycle materializado está `disabled`;
- billing não foi copiado;
- ausência do documento mantém compatibilidade com tenants anteriores até a primeira ação lifecycle;
- nenhum terceiro banco foi criado.

Rules:
- banco principal: nenhuma mudança funcional da SAAS-DS; tamanho certificado ~90,64 KiB;
- Central: ~152,38 KiB; delta ~853 bytes;
- nenhuma Rule foi publicada por esta worker.

Pendências transferidas para SAAS-I:
- integração/validação combinada B+C+DL+E+DS;
- executar uma **migração única, idempotente e auditável da coorte VIP legado**, identificando todos os workspaces externos já existentes no corte de 2026-10-02 e materializando `billingAccounts.status = exempt` sem reprecificar histórico;
- a migração VIP legado deve preservar workspace, UG, UID, dados operacionais, histórico de billing e competências já materializadas; não deve criar novo trial, nova conta ou novo tenant;
- validar que nenhum workspace da coorte legada aparece como devedor, pendente ou sujeito a suspensão financeira e que todos mantêm Plano Completo;
- conectar o `LegalAcceptanceGate` ao shell depois de Auth/workspace/UG resolvidos;
- validar que aceite não bloqueia reset de senha, Termos/Privacidade ou `/regularizacao`;
- preparar publicação coordenada da aplicação + Rules da Central;
- decidir se haverá atalho administrativo adicional entre billing e suspensão manual, sem automação;
- manter pendências externas da SAAS-E como gates para SAAS-J.

Com a SAAS-DS integrada, a **SAAS-I está formalmente liberada**.


### Decisão comercial — coorte VIP legado — 2026-10-02

Fica congelada como contrato oficial do EMPROVEX SaaS R1 a seguinte regra:

> **Todos os workspaces externos já cadastrados no EMPROVEX em 2 de outubro de 2026 são clientes VIP legados e não serão cobrados pelo uso do sistema.**

Implementação canônica:
- estado interno de billing: `exempt`;
- preço efetivo: R$ 0,00;
- Plano Completo;
- sem trial obrigatório;
- sem vencimento, inadimplência ou suspensão por falta de pagamento;
- sem limitação comercial de funcionalidades;
- mesma evolução funcional do Plano Completo dos clientes pagantes;
- segurança, isolamento multi-tenant, UG, lifecycle e demais controles operacionais continuam normalmente aplicáveis.

A isenção é vinculada ao **workspace**, que é a unidade comercial vigente da R1. Ela não transforma o usuário em administrador, não ignora Rules e não cria bypass de segurança.

A coorte deve ser identificada e migrada na **SAAS-I** por operação única, idempotente e auditável. O processo deve registrar quais workspaces foram incluídos no corte, preservar histórico e impedir cobrança acidental.

Workspaces criados **após 2026-10-02** entram no Plano Completo de R$ 70,00/mês por padrão, salvo concessão manual posterior de VIP/`exempt`.

Nenhuma remoção automática da condição VIP legado será permitida. Eventual alteração futura exige ação administrativa explícita e auditada do fundador.

### Registro de execução SAAS-I — 2026-10-02

A SAAS-I foi implementada em branch técnica `saas-r1-i-integration`, criada exatamente de `feat/saas-r1-commercializacao@71ed87932f17b8acd9fab9c30006970b59079c42`, com PR técnico **#219** apontando somente para a integradora.

Contratos incorporados:
- `LegalAcceptanceGate` ligado ao shell após Auth + platform account + workspace + UG;
- subscriptions operacionais e snapshot do Início não iniciam antes do aceite vigente;
- acesso direto à Central também exige aceite, depois da autorização básica;
- login, reset de senha, `/terms`, `/privacy` e `/regularizacao` permanecem fora do gate;
- billing continua separado de lifecycle/enforcement;
- coorte VIP legado usa `status=exempt`, R$ 0,00 e metadata mínima `exemptionSource=legacy_vip`;
- isenção VIP legado não pode ser removida pelo fluxo administrativo normal e passa a ser protegida também pelas Rules;
- migração VIP legado é explícita, idempotente, auditável e exige allowlist para execução;
- nenhum workspace com timestamp posterior a 2026-10-02 pode entrar; timestamp não confiável não autoriza inclusão automática;
- nenhuma competência histórica é reprecificada;
- nenhum terceiro banco foi criado.

Rules no candidato:
- principal: **92,11 KiB**;
- Central: **152,38 KiB**.

A quantidade real da coorte não é inferida do código: deve ser obtida por leitura autenticada/dry-run do Firestore e congelada antes da execução real.

Handoff detalhado: `docs/SAAS_R1_I_INTEGRATION_HANDOFF.md`.

Estado neste registro: **candidato em validação no PR #219; não publicado em main, Vercel, Rules ou migração de produção**.


### Registro de integração SAAS-I — 2026-10-02

Etapa técnica:
- branch: `saas-r1-i-integration`;
- base: `71ed87932f17b8acd9fab9c30006970b59079c42`;
- HEAD final certificado: `78d3e9afeeb4176a8d6423cdd8e65d32435ba0a9`;
- PR #219;
- integração squash na coordenadora: `25dda4876fedabb498ad30139262b11943412273`.

Certificação final:
- Application CI #908: **SUCCESS**;
- EMPROVEX Core Protection #195: **SUCCESS**;
- Recovery guardrails #595: **SUCCESS**;
- SAAS-DL Legal Validation #20: **SUCCESS**;
- SAAS-C Browser Validation: **SKIPPED por escopo**, não falha;
- Production Build: **PASS**;
- Final TypeScript: **PASS**;
- Diff Hygiene: **PASS**;
- Firestore multi-tenant security: **PASS**;
- Central de Depósitos external workspace security: **PASS**;
- release gates 16–21: **PASS**.

Integração combinada aprovada:
- `LegalAcceptanceGate` conectado somente depois de Auth + workspace/account + UG/autorização básica;
- listeners e snapshot operacional ficam bloqueados até aceite vigente;
- `/terms`, `/privacy`, login/reset e `/regularizacao` permanecem fora do gate;
- acesso direto à Central também exige aceite legal depois da autorização básica;
- billing continua separado do enforcement;
- suspensão/reativação e revogação de sessão continuam conforme SAAS-DS;
- VIP manual e VIP legado continuam `exempt`, sem novo status `vip`.

VIP legado:
- metadata mínima canônica: `exemptionSource = legacy_vip` + `legacyVipCutoff = 2026-10-02`;
- Rules impedem remoção administrativa da isenção legada;
- migração implementada em `scripts/saas-r1-legacy-vip.mjs`;
- exige allowlist explícita, dry-run, confirmação literal e auditoria;
- billing + auditoria são gravados atomicamente por workspace;
- `billingCycles` não são varridos/reprecificados;
- migração **NÃO EXECUTADA EM PRODUÇÃO**;
- quantidade real da coorte deve ser obtida por leitura autenticada e congelada antes do apply.

Rules candidatas:
- principal: ~92,11 KiB;
- Central: ~152,38 KiB;
- nenhuma Rule nova foi publicada nesta etapa.

Produção:
- `main` continua em `e90f92acae1514ee5cbc6ce95fed354bc1454330`;
- nenhum deploy Vercel produção;
- nenhuma migração VIP produtiva;
- nenhum deploy de Rules.

Com a integração e certificação da SAAS-I, a SAAS-P havia sido inicialmente liberada para preparação de piloto. **Essa ordem foi posteriormente substituída pela reorganização oficial de 2026-10-02:** backup READY/restore, segurança, health/release e reconciliação Mobile passam a ser hardening obrigatório antes do piloto real.


### Coordenação obrigatória SaaS R1 ↔ Central Móvel R1 — desenvolvimento paralelo — 2026-10-02

O **SaaS R1** e a **Central Móvel R1** estão autorizados a evoluir em paralelo. Nenhum dos dois programas precisa aguardar o encerramento integral do outro quando não houver conflito real de contrato ou de código.

Branches integradoras:
- SaaS R1: `feat/saas-r1-commercializacao`;
- Central Móvel R1: `feat/central-mobile-r1`.

A Central Móvel R1 foi fundada sobre o candidato certificado da SAAS-I `78d3e9afeeb4176a8d6423cdd8e65d32435ba0a9`. A SAAS-I foi depois integrada por squash na branch SaaS em `25dda4876fedabb498ad30139262b11943412273`. Por isso, **história Git diferente não significa automaticamente contrato funcional diferente**. A reconciliação deve ser semântica e baseada nos arquivos/contratos vigentes, nunca em merge/rebase cego.

#### Regra permanente de sincronização

Antes de abrir, integrar ou certificar qualquer frente SaaS que toque domínio compartilhado, o Chat Coordenador deve consultar o estado vivo da MOBILE-R1, no mínimo:
- `docs/CENTRAL_MOBILE_R1_INTEGRATION_STATUS.md`;
- `docs/CENTRAL_MOBILE_R1_COORDENADOR_HANDOFF.md`;
- branch `feat/central-mobile-r1`.

Domínios que exigem verificação cruzada obrigatória:
- autenticação e resolução de identidade;
- workspace/UG e isolamento multi-tenant;
- sessão/lease;
- lifecycle/status de workspace/conta;
- `LegalAcceptanceGate` e proteção de rotas;
- autorização da Central e `warehouseAccess`;
- Firestore Rules compartilhadas;
- shell/roteamento da aplicação;
- contratos compartilhados da Central de Depósitos;
- tipos/helpers compartilhados usados por desktop e mobile;
- dependências/package scripts que afetem build, CI ou bundle comum.

Se uma frente SaaS alterar qualquer item acima, seu handoff deve conter uma seção explícita **“Impacto MOBILE-R1”** informando:
1. arquivos/contratos afetados;
2. se há mudança comportamental ou apenas documental;
3. se a MOBILE-R1 precisa incorporar delta;
4. gate/teste que deve ser repetido no Mobile;
5. se existe bloqueio real para a próxima onda Mobile.

O inverso também vale: mudança Mobile em domínio compartilhado deve ser tratada como upstream relevante para SAAS-P/SAAS-J e reconciliada antes da certificação final do SaaS.

#### Regras de não interferência

- não fazer merge/rebase automático de uma integradora dentro da outra apenas para “sincronizar”;
- não usar `ours`/`theirs` global para resolver divergência entre programas;
- não sobrescrever código Mobile com versão SaaS mais antiga nem o inverso;
- billing, trial, VIP e regularização continuam propriedade do SaaS e não devem ser reimplementados pelo Mobile;
- scanner, etiquetas e fluxos móveis continuam propriedade da MOBILE-R1 e não devem ser reimplementados pelo SaaS;
- contrato comum deve ter **uma única fonte de verdade**;
- conflito transversal pertence aos dois Coordenadores e deve ser resolvido por integração semântica documentada.

#### Gates de reconciliação obrigatórios

A sincronização entre os programas deve ser verificada:
- antes de integrar mudança SaaS em Auth/legal/lifecycle/sessão/Rules/Central;
- antes de liberar nova onda Mobile quando houver upstream SaaS relevante;
- antes da SAAS-J;
- antes da MOBILE-I;
- antes da MOBILE-J;
- antes de qualquer release conjunta ou promoção para `main`.

A existência do desenvolvimento paralelo **não é, por si só, motivo para bloquear SaaS-P nem MOBILE-A/B ou ondas futuras**. O bloqueio só deve ocorrer quando existir conflito técnico ou contratual concreto que possa causar regressão, perda de segurança, duplicação de fonte de verdade ou comportamento diferente entre desktop e mobile.

Ao gerar novos prompts de worker/coordenador SaaS, incluir sempre a instrução: **“verifique o estado da Central Móvel R1 e preserve/reconcilie os contratos compartilhados antes de alterar domínio transversal.”**

### Atualização operacional — SAAS-P iniciada em 2026-10-02

A etapa **SAAS-P — Piloto Comercial Controlado** foi aberta após auditoria P0.

Documento vivo específico:
- `docs/SAAS_R1_P_PILOTO_CONTROLADO.md`.

O snapshot de abertura confirmou:
- `feat/saas-r1-commercializacao@f8fc2b60...`;
- `main@e90f92ac...`;
- PR #219 mergeado;
- gates técnicos SAAS-I verdes;
- recovery parcialmente concluído externamente: PITR, delete protection e schedules diários ativos; ainda pendem primeiro backup READY por banco, restore real isolado e uptime/alertas;
- MOBILE-B já foi aprovada e integrada via PR #220 / squash `5edb19812...`; MOBILE-A permanece no PR #221 em correção/revisão controlada antes da Integração 1.

A SAAS-P pode avançar em preparação, inventário e auditoria. Piloto real completo depende de participantes reais e de autorização explícita para as mudanças produtivas indispensáveis.

### Atualização operacional — SAAS-P P2/P3 — checkpoint histórico antes do apply — 2026-10-02

A auditoria autenticada da coorte VIP legado foi executada com sucesso.

Coorte/allowlist congelada após revisão humana:

- `aprovisionamento-2-b-fv`;
- `aprovisionamento-3-gac-ap`;
- `aprovisionamento-teste`.

Decisão permanente para `aprovisionamento-teste`: ele permanece VIP legado e serve como perfil real de teste funcional de usuário externo. Um eventual perfil de teste não-VIP será criado futuramente apenas para validar trial/cobrança e não altera esta coorte.

Naquele checkpoint, a migração VIP produtiva ainda **não havia sido aplicada**. O estado posterior e definitivo está registrado em **SAAS-P — coorte VIP legado materializada** abaixo.

A auditoria de recovery confirmou:

- naquele checkpoint: banco principal sem PITR, delete protection, agenda diária e backup READY;
- naquele checkpoint: `emprovex-warehouse` com delete protection já ativa, porém sem PITR, agenda diária e backup READY;
- zero backups READY nos dois bancos no momento da auditoria.

Também foi integrada a correção PILOT-OPS de compatibilidade do `gcloud` com Windows/PowerShell:

- PR #222;
- squash `ea2d389f726ae989ae88f7fc7359c690b23dfb13`;
- Application CI/Core Protection/Recovery/Legal verdes;
- sem alteração em Rules, schema, Auth, billing, lifecycle ou contratos Mobile.

A exigência comercial permanece: o piloto precisa de pelo menos um workspace novo **não-VIP** para provar trial, pagamento e regularização; a coorte VIP legado não comprova cobrança.

Dry-run da allowlist VIP legado foi concluído com sucesso em 2026-10-02, selecionando exatamente os 3 workspaces congelados e sem qualquer escrita. **Naquele momento**, o `apply` permanecia pendente; ele foi posteriormente autorizado, executado e verificado, conforme a seção seguinte.

### SAAS-P — coorte VIP legado materializada — 2026-10-02

A migração produtiva da coorte VIP legado foi executada após autorização explícita e validada pelo comando de verificação.

Workspaces:

- `aprovisionamento-2-b-fv`;
- `aprovisionamento-3-gac-ap`;
- `aprovisionamento-teste`.

Os 3 retornaram `READY` após a aplicação. A P2 da SAAS-P está concluída.

A coorte passa a permanecer permanentemente isenta segundo o contrato já definido: `exempt`, R$ 0, `legacy_vip`, sem cobrança financeira automática.

### SAAS-P — recovery produtivo configurado — 2026-10-02

Após autorização explícita, PITR, delete protection e backup diário com retenção de 14 semanas foram ativados nos dois bancos Firestore da plataforma.

Estado imediatamente após aplicação:
- principal: proteções e agenda OK, 0 backup READY;
- `emprovex-warehouse`: proteções e agenda OK, 0 backup READY.

A P3 ainda não está certificada: falta o primeiro backup READY em cada banco, a verificação consolidada e um restore real em banco isolado. Nenhum novo `apply` deve ser repetido apenas por `backupReady=false`.

### Vercel durante desenvolvimento ativo — decisão de 2026-10-02

Durante a fase atual de desenvolvimento, Preview Deployments da Vercel não são requisito de avanço quando falham exclusivamente por `build-rate-limit`.

A política passa a ser:
- desenvolvimento continua normalmente com CI/testes/gates do repositório;
- Vercel Preview pode ser ignorada quando o único bloqueio for limite de builds;
- `main` e produção permanecem protegidas por autorização explícita do fundador;
- publicação deve ser consolidada em momentos deliberados de release, não a cada branch/PR.

### Conferência de consistência SAAS-P / MOBILE-R1 — 2026-10-02

Auditoria coordenadora após P2/P3 confirmou o estado corrente:

- **SAAS-P naquele checkpoint:** em preparação/execução documental; estado corrente posteriormente reorganizado para HARDENING PRÉ-PILOTO;
- **P2 VIP legado:** concluída e verificada 3/3;
- **P3 recovery:** PITR + delete protection + backup diário de 14 semanas ativos nos dois bancos; aguardando primeiro backup READY em cada banco, `recovery:verify` verde e restore real isolado;
- **health:** PR #223 (`saas-p-ops-health-endpoint`) preparado diretamente de `main`, draft, mergeable e com Application CI, Core Protection e Recovery guardrails em SUCCESS; não mergeado e não publicado;
- **Vercel:** preview com `build-rate-limit` é não bloqueante durante desenvolvimento; nenhuma promoção produtiva foi autorizada;
- **main:** permanece na release Performance R3 `e90f92acae1514ee5cbc6ce95fed354bc1454330`;
- **MOBILE-B:** PR #220 integrado na integradora Mobile via squash `5edb19812...`;
- **MOBILE-A:** PR #221 continua aberto/draft e mergeable; HEAD auditado `44c4f013859230b5d490d2049c6b8dbf2cd3baa2`, com Application CI, Core Protection, Recovery e Legal em SUCCESS;
- **Integração 1 Mobile:** continua dependente da aprovação final da MOBILE-A;
- **SAAS-J:** ainda não iniciada; exige encerramento do piloto, recovery/uptime comprovados e reconciliação final SaaS ↔ Mobile.

Esta conferência substitui snapshots antigos apenas como **estado corrente**; os registros anteriores permanecem como histórico datado.

### SAAS-P — topologia paralela oficial da fase de piloto — 2026-10-02
A próxima etapa da SAAS-P deve seguir uma topologia controlada de **até 5 chats simultâneos**:

- **1 Chat Coordenador / Integrador / Avaliador**;
- **PILOT-A — Participantes e Jornadas VIP**;
- **PILOT-B — Piloto Comercial Não-VIP**;
- **PILOT-C — Operação, Recovery, Health e Uptime**;
- **PILOT-D — Custos, Observabilidade e Matriz de Evidências**.

Esse número é um **limite operacional recomendado para esta fase**, não um limite técnico da plataforma. O objetivo é maximizar paralelismo sem criar concorrência em Auth, lifecycle, billing, Rules, shell ou contratos compartilhados da Central.

#### Papel do Coordenador

O Coordenador permanece proprietário de:

- estado global da SAAS-P;
- definição/ativação de branches;
- emissão dos prompts;
- leitura dos handoffs;
- classificação de falhas;
- integração semântica;
- atualização do Memorial, Integration Status e Handoff;
- autorização de mudanças transversais;
- reconciliação obrigatória com MOBILE-R1;
- decisão sobre gates para SAAS-J.

O Coordenador **não deve competir com os workers implementando silenciosamente o mesmo escopo**.

#### PILOT-A — Participantes e Jornadas VIP

Objetivo:
- formalizar P-01/P-02;
- executar jornadas funcionais seguras com workspaces VIP legado;
- validar login, reset/troca de senha quando aplicável, aceite legal, acesso ao EMPROVEX, Central, sessão/permissões, condição VIP/R$0 e evidências;
- registrar J02–J09 e demais jornadas aplicáveis.

Não é proprietário de:
- criação do novo pagante;
- alteração de billing;
- recovery/uptime;
- correções transversais improvisadas.

#### PILOT-B — Piloto Comercial Não-VIP

Objetivo:
- preparar P-03 novo e não isento;
- validar onboarding, trial de 30 dias, preço de R$70/mês, pagamento externo simples, confirmação administrativa, regularização, suspensão/reativação e preservação do tenant/dados;
- registrar principalmente J01 e J10–J20.

Enquanto não houver participante real autorizado, este worker pode preparar roteiro, evidência e validações não produtivas, mas **não deve criar cliente fictício em produção apenas para satisfazer gate**.

#### PILOT-C — Operação, Recovery, Health e Uptime

Objetivo:
- acompanhar backup READY dos dois bancos;
- executar/verificar `recovery:verify` quando houver backup;
- preparar e conduzir restore real em banco isolado quando autorizado;
- manter o PR #223 de `/api/health` preparado;
- conduzir uptime check, alert policy e notification channel quando houver publicação autorizada;
- registrar J23/J24.

Não deve repetir `apply` de recovery quando os controles já estiverem ativos.

#### PILOT-D — Custos, Observabilidade e Evidências

Objetivo:
- manter baseline e registros de leituras/custos;
- consolidar a matriz J01–J24;
- registrar incidentes, dúvidas, resultados e evidências;
- verificar completude documental do piloto;
- preparar a visão de encerramento para SAAS-J.

Não deve alterar código funcional para “fazer a evidência passar”.

#### Regras de paralelismo

Os quatro workers podem avançar simultaneamente somente enquanto seus escopos permanecerem independentes.

Se qualquer worker detectar necessidade de alterar:
- Auth;
- workspace/UG;
- sessão/lease;
- legal gate;
- lifecycle;
- billing compartilhado;
- Firestore Rules;
- shell;
- `warehouseAccess`;
- contratos comuns desktop/mobile;
- schema/fonte de verdade compartilhada;

deve **interromper a expansão daquele ponto e devolver ao Coordenador**.

O Coordenador então decide se:
1. abre uma branch curta `saas-p-fix-<dominio>-<slug>`;
2. designa um único proprietário;
3. exige seção **Impacto MOBILE-R1**;
4. reconcilia semanticamente antes de integração.

Nenhum worker:
- faz merge direto em `main`;
- publica Vercel produção;
- publica Rules;
- executa mudança produtiva irreversível sem autorização aplicável;
- integra outra frente por conta própria.

#### Estado de ativação

Neste registro:
- topologia **PLANEJADA E APROVADA COMO MÉTODO**;
- PILOT-A/B/C/D **AINDA NÃO ATIVADOS COMO CHATS TRABALHADORES**;
- branches exclusivas devem ser criadas/congeladas somente no momento da ativação coordenada.

### SAAS-P — onda paralela PILOT-A/B/C/D ativada

Em 2026-10-02, os quatro chats trabalhadores previstos para a fase de piloto foram efetivamente ativados:

- PILOT-A — Participantes e Jornadas VIP;
- PILOT-B — Piloto Comercial Não-VIP;
- PILOT-C — Recovery, Health e Uptime;
- PILOT-D — Custos, Observabilidade e Matriz de Evidências.

Todos partiram da base comum congelada `4d87370e5ee7f2697ab4901e0c045a9ab4910fe9`.

O Chat Coordenador continua como autoridade de integração, conflito, correções transversais, sincronização com MOBILE-R1 e fechamento da SAAS-P.

### SAAS-P — PILOT-A recebida como PARCIAL

O Coordenador revisou e integrou o handoff documental da PILOT-A via PR #226 / squash `8459a59aefc0f846d9c7e2f5ee78888c4fa2abd5`.

Estado aceito:
- J08 VIP legado/R$0: PASS;
- J21 isolamento cross-workspace: PASS por evidência automatizada específica;
- J02/J03/J04/J05/J06/J07/J16: preparados, ainda sem evidência humana suficiente para PASS;
- J15/J17/J18/J19/J20: bloqueados até autorização de cenário seguro;
- **naquele checkpoint**, participantes humanos P-01/P-02 ainda não estavam confirmados; posteriormente foram formalizados como P-01=`aprovisionamento-3-gac-ap` e P-02=`aprovisionamento-2-b-fv`, ambos protegidos contra testes disruptivos;
- nenhum defeito novo PILOT-*;
- nenhuma correção funcional;
- Impacto MOBILE-R1: nenhum delta funcional.

A PILOT-A permanece **PARCIAL**, aguardando coleta de evidências humanas.

### SAAS-P — PILOT-B recebida como preparação concluída

O Coordenador revisou a PILOT-B e integrou semanticamente seu handoff no commit `ecc74f14968ca1d45f8b17eb292b68cc057171e9`. O PR #227 foi fechado sem merge porque a integradora avançou após o freeze dos workers.

Estado aceito:
- P-03: ainda não selecionado;
- J01/J10/J11/J18: preparados;
- J12: depende de pagamento real;
- J13/J14: dependem do pagamento real e confirmação administrativa;
- J15–J20: dependem de suspensão/reativação real autorizada;
- contrato comercial preservado: R$70/mês, trial 30 dias, vencimento administrativo no 5º dia útil, tolerância 10 dias, cobrança externa e sem suspensão automática;
- nenhum defeito PILOT-*;
- nenhuma alteração funcional;
- Impacto MOBILE-R1: nenhum delta funcional.

Snapshot Mobile corrigido na revisão:
- MOBILE-A e MOBILE-B integradas;
- Integração 1 certificada;
- MOBILE-C/D/E liberadas;
- freeze vigente da Onda 2: `6852963c7aa9a1c83133239f0b929715fd316530`.

A PILOT-B permanece aguardando **participante real não-VIP** e janela produtiva autorizada para evidência comercial.

### SAAS-P — PILOT-D integrada semanticamente

A PILOT-D foi revisada pelo Coordenador e seu método de evidência, baseline de custos e matriz J01–J24 foram aceitos.

Worker:
- branch `saas-p-d-evidence-observability`;
- HEAD `ae8ae4a810da24a273e0231ba5f31c915720d504`;
- PR #228.

Como a integradora avançou após o freeze comum, o PR passou a conflitar documentalmente e foi fechado sem merge. A integração semântica ocorreu nos commits:
- `7d7e697828ad4bd541344512c9d96acf7bb8158d` — matriz;
- `4a746a6997a1484901813775f929a3c24105b404` — handoff.

Estado corrente da matriz, já reconciliado com PILOT-A e PILOT-B:
- PASS: 2;
- PREPARADO: 13;
- BLOQUEADO: 7;
- EM EXECUÇÃO: 1;
- N/A: 1;
- FAIL: 0.

PASS atuais:
- J08 — VIP legado/R$0;
- J21 — isolamento entre workspaces.

O baseline oficial de observabilidade do piloto passa a usar:
- Cloud Monitoring para operação real;
- `emprovex-workspace-estimate` apenas como estimativa por UG;
- Google Cloud Billing como fonte monetária oficial;
- acompanhamento separado do `emprovex-warehouse`;
- T0/T1/T2 para comparação do piloto;
- nenhum listener novo apenas para medir consumo.

A checklist SAAS-J está **preparada**, porém a SAAS-J permanece **não liberada** até completar evidências humanas/comerciais, custos reais, recovery/restore, uptime e reconciliação final SaaS ↔ Mobile.

### SAAS-P — PILOT-C recebida e onda A/B/C/D encerrada no escopo das workers

A PILOT-C foi revisada e integrada semanticamente.

Worker:
- branch `saas-p-c-recovery-uptime`;
- HEAD `5e1a1541630e9b7b8d1ff4bb33dc3a5c2dd48322`;
- PR #225.

Integrações coordenadoras:
- `227a27ac5a9e626db73d61b67ec6829d708c61c7` — handoff;
- `5163520aecc50a21d67c4e374ded6cd55069ba03` — matriz J23/J24.

Estado aceito:
- PITR, delete protection e backup diário/14 semanas: ativos nos dois bancos;
- último estado conhecido: nenhum backup READY;
- restore isolado: pendente;
- PR #223 health: preparado, gates verdes, sem merge/deploy;
- J23: PREPARADO;
- J24: EM EXECUÇÃO;
- nenhum bug PILOT-OPS novo;
- Impacto MOBILE-R1: nenhum delta funcional.

Com o recebimento da PILOT-C, a onda paralela SAAS-P A/B/C/D fica **ENCERRADA NO ESCOPO DAS WORKERS**.

Resumo:
- PILOT-A: parcial, faltando evidência humana;
- PILOT-B: preparação concluída, faltando P-03/pagamento/jornadas reais;
- PILOT-C: parcial por dependências externas;
- PILOT-D: matriz, observabilidade e checklist SAAS-J preparados.

A próxima fase não exige abrir novas frentes de desenvolvimento por padrão. O foco passa a ser coleta de evidência real, participante P-03, custos T0/T1/T2, backup READY/restore, health/uptime e posterior reconciliação final SaaS ↔ Mobile antes da SAAS-J.

### SAAS-P — P-01 confirmado como usuário operacional crítico

P-01 foi formalmente definido como `aprovisionamento-3-gac-ap`.

Características registradas:
- usuário externo real;
- VIP legado;
- uso ativo do EMPROVEX;
- dependência operacional do setor;
- **acesso contínuo é requisito do piloto**.

Regra de segurança operacional:
- P-01 não deve ser usado para testes de suspensão, revogação de sessão, bloqueio, alteração artificial de lifecycle ou qualquer cenário que possa interromper o acesso;
- reset/troca de senha só pode ocorrer por necessidade real do próprio usuário, não para gerar evidência;
- aceite legal não deve ser apagado/recriado;
- billing/status/UID/workspace/UG/permissões não devem ser manipulados para fabricar cenário;
- a coleta de evidência em P-01 deve ser preferencialmente observacional e sobre uso normal;
- cenários destrutivos/disruptivos devem usar `aprovisionamento-teste`, P-03 ou outro ambiente controlado autorizado.

Essa restrição prevalece sobre qualquer roteiro genérico anterior que pudesse sugerir usar P-01 em J15–J20.

### SAAS-P — P-02 protegido e `aprovisionamento-teste` designado para cenários disruptivos

P-02 foi definido como `aprovisionamento-2-b-fv`.

Características:
- VIP legado;
- usuário externo real;
- está iniciando o uso operacional do EMPROVEX;
- não deve ser exposto a testes que possam interromper o acesso.

P-01 (`aprovisionamento-3-gac-ap`) e P-02 (`aprovisionamento-2-b-fv`) passam a ser **participantes reais protegidos**.

Regra:
- não usar P-01/P-02 para suspensão, revogação, bloqueio, lifecycle disruptivo, reset forçado ou manipulação artificial de estado;
- validar neles apenas fluxos normais e não disruptivos;
- preservar acesso contínuo.

`aprovisionamento-teste` passa a ser o **workspace preferencial para testes disruptivos**, incluindo J15–J20, revogação de sessão, bloqueio e reativação, desde que a operação específica seja autorizada quando necessário.

Essa decisão substitui qualquer orientação genérica anterior que permitisse usar P-01/P-02 em cenários de indisponibilidade.

### SAAS-P — planejamento completo convertido em execução operacional

O planejamento da fase real do piloto foi convertido em dois artefatos canônicos:

- `docs/SAAS_P_EXECUCAO_REAL_PILOTO.md` — runbook completo de T0, participantes, lifecycle, P-03, recovery, health, T1/T2 e gate SAAS-J;
- `docs/SAAS_P_REGISTRO_EXECUCAO.md` — ficha auditável para registrar evidências reais sem segredos.

A execução passa a seguir estas regras:

- P-01 = `aprovisionamento-3-gac-ap`, protegido e não disruptivo;
- P-02 = `aprovisionamento-2-b-fv`, protegido e não disruptivo;
- `aprovisionamento-teste` = ambiente preferencial para J15–J20 e outros testes de indisponibilidade;
- P-03 = futuro participante real não-VIP;
- comandos locais do piloto devem usar worktree separado para não interferir com a MOBILE-R1;
- T0/T1/T2 usam fontes existentes e não criam listeners adicionais;
- recovery não repete apply;
- health permanece estacionado até janela de publicação autorizada;
- SAAS-J continua bloqueada até evidência real suficiente.

O que ainda não pode ser executado automaticamente pelo Coordenador sem ação externa: valores privados T0/T1/T2, uso humano P-01/P-02, seleção/pagamento P-03, suspensão real do workspace de teste, restore real e configuração externa de uptime/alerta.

### SAAS-P — T0 técnico certificado

Em 2026-10-02 foi criado e utilizado o worktree isolado `C:\Users\marco\Projetos\emprovex-saas-pilot`, no snapshot `f25089b8`, preservando o desenvolvimento MOBILE-R1 em diretório/branch separados.

Foram executados com sucesso os seis guards do baseline técnico:
- Bloco 16.3 Workspace Telemetry: READY;
- Bloco 16.4 Global Cloud Monitoring: READY;
- Bloco 16.5 Consolidated Usage: READY;
- Bloco 17.6 Telemetry Fidelity: READY;
- Bloco 17.8 Consumption/Regression: READY;
- UG Telemetry v2 Reconciliation: READY.

Conclusão:
- **T0 técnico = PASS**;
- arquitetura de telemetria/consumo pronta;
- nenhum listener administrativo adicional;
- nenhuma publicação/deploy/Rules;
- **T0 numérico permanece pendente** de captura real em Monitoring, Painel de Consumo e Google Cloud Billing;
- J22 continua PREPARADO até existirem T0/T1/T2 reais.

Durante `npm ci` foram reportados advisories de dependências. Nenhum `npm audit fix` ou `--force` foi executado para não introduzir alterações fora do escopo do piloto.

### SAAS-P — T0 por UG capturado

Foi realizada uma única atualização manual do painel de estimativas por UG.

Snapshot:
- P-01 `aprovisionamento-3-gac-ap`: 111 reads, 3 writes, 0 deletes, 7 snapshots, pico listeners 4, 2 flushes; última consolidação exibida 02/10 13:01;
- P-02 `aprovisionamento-2-b-fv`: 0 em todas as métricas e sem consolidação no momento;
- `aprovisionamento-teste`: 0 em todas as métricas e sem consolidação no momento.

A estimativa por UG continua explicitamente separada do faturamento oficial.

Estado T0:
- técnico: PASS;
- global numérico: capturado;
- por UG: capturado;
- monetário Google Cloud Billing: pendente;
- J22: PREPARADO até completar T0 monetário e T1/T2.

### SAAS-P — T0 monetário capturado / baseline inicial completo

A fotografia oficial do Google Cloud Billing foi capturada em 2026-10-02.

Valores exibidos:
- custo atual: **R$ 0,16**;
- economia: **R$ 0,00**;
- custo total: **R$ 0,16**;
- previsão mensal: **R$ 2,30**;
- serviço com custo atual listado: **App Engine — R$ 0,16**.

O resumo da própria tela menciona Cloud Firestore Read Ops no comparativo, porém nenhuma cobrança positiva separada de Firestore aparece na tabela corrente. Não foi inferido custo não exibido.

Estado do T0:
- técnico: PASS;
- global: capturado;
- por UG: capturado;
- monetário: capturado;
- **T0 inicial: COMPLETO**.

J22 continua PREPARADO até T1/T2 após as jornadas reais do piloto.

### SAAS-P — continuidade do piloto sem disponibilidade imediata de P-01/P-02

Foi decidido que a ausência temporária dos operadores reais P-01/P-02 não deve paralisar a SAAS-P.

`aprovisionamento-teste` passa a ser usado para o máximo de validações funcionais/controladas possíveis, inclusive login, shell, Central, sessão, credenciais controladas e lifecycle J15–J20.

Restrições preservadas:
- P-01/P-02 continuam participantes reais protegidos e sua evidência humana não é substituída;
- `aprovisionamento-teste` não pode comprovar P-03, trial ou pagamento porque pertence à coorte VIP legado;
- aceite legal não deve ser artificialmente apagado/recriado apenas para fabricar evidência;
- resultados do workspace de teste devem ser classificados como evidência funcional/controlada, não como evidência de cliente real.

Assim, o desenvolvimento/piloto pode prosseguir agora sem aguardar disponibilidade dos usuários reais.

### SAAS-P — primeira evidência funcional controlada em `aprovisionamento-teste`

Foi validada visualmente uma sessão autenticada do perfil `Aprovisionamento Teste`:
- acesso autorizado;
- Home carregada;
- shell/navegação disponível;
- Central de Depósitos exposta no menu;
- ambiente visualmente operacional.

A evidência é classificada como smoke funcional/controlado e não substitui as futuras evidências humanas de P-01/P-02 nem comprova novo aceite legal.

### Correção crítica — site produtivo atual não contém o candidato SaaS R1

Em conferência viva de 2026-10-02:
- `main` = `e90f92acae1514ee5cbc6ce95fed354bc1454330`;
- `feat/saas-r1-commercializacao` = `46fba355227e715c553484b2d65b7c52fcf30d39`;
- integradora SaaS = **117 commits à frente e 0 atrás da main**.

Não houve deploy autorizado do candidato SaaS R1 nesta rodada.

Regra de interpretação:
- o domínio produtivo atualmente acessado pelos usuários representa **produção pré-SaaS / Performance R3** enquanto não houver publicação controlada do candidato;
- T0 coletado no site atual é o **baseline pré-release correto**;
- screenshots de login/shell/Central no site atual validam a produção vigente, mas não certificam as features SaaS ainda não publicadas;
- materialização VIP e controles de recovery já aplicados externamente permanecem válidos porque independem de deploy Vercel;
- Rules/features SaaS não devem ser presumidas em produção sem publicação explícita;
- antes de validar J01–J20 como SaaS real é necessário disponibilizar o candidato em ambiente compatível, respeitando a política de deploy e reconciliação com MOBILE-R1.

### REORGANIZAÇÃO OFICIAL DA RETA FINAL DO SAAS R1 — 2026-10-02

**Esta seção é a orientação corrente e prevalece sobre trechos históricos anteriores que tratavam o piloto real como etapa já em execução.**

Decisão do fundador:
> O piloto real deve ser a **última grande prova operacional antes da validação/correção de detalhes e da finalização completa do lançamento da nova versão**.

Nova sequência obrigatória:

1. **Hardening pré-piloto**;
2. **Reconciliação SaaS R1 ↔ MOBILE-R1**;
3. **Segurança/dependências + recovery/restore + health/Rules/release**;
4. **Freeze do Release Candidate**;
5. **Publicação controlada do RC e smoke técnico**;
6. **Piloto real final**;
7. **Correções finais pós-piloto**;
8. **SAAS-J — Certificação Final**;
9. **Lançamento completo / abertura comercial**, somente com autorização explícita.

#### Estado atual

- produção: Performance R3 em `main@e90f92acae1514ee5cbc6ce95fed354bc1454330`;
- candidato SaaS R1: integradora `feat/saas-r1-commercializacao`;
- T0 pré-release: **COMPLETO** e preservado;
- P-01/P-02: confirmados e protegidos;
- `aprovisionamento-teste`: reservado para lifecycle disruptivo no **piloto final**;
- P-03: ainda não selecionado;
- piloto real: **NÃO INICIADO / ADIADO**;
- fase vigente: **HARDENING PRÉ-PILOTO**;
- SAAS-J: aguardando piloto + correções pós-piloto;
- lançamento final: não autorizado.

#### Gates obrigatórios antes de iniciar o piloto real

- triagem/correção controlada dos advisories de dependências, sem `npm audit fix --force` cego;
- Application CI/build/typecheck/Core Protection/Recovery/Legal e guards aplicáveis verdes no candidato;
- backup READY nos dois bancos;
- `recovery:verify` verde;
- restore real em database isolado, mediante autorização específica, com validação de dados/IAM/Rules/TTL;
- health integrado ao candidato;
- estratégia de uptime/alert/channel pronta e validada quando o RC for publicado;
- pacote exato de Rules e ordem de rollout/rollback;
- reconciliação semântica atualizada com a integradora MOBILE-R1;
- incidentes técnicos pré-piloto bloqueantes resolvidos;
- commit exato do Release Candidate congelado.

#### Piloto real final

Somente após os gates acima:
- P-01 `aprovisionamento-3-gac-ap`: observação não disruptiva;
- P-02 `aprovisionamento-2-b-fv`: observação não disruptiva;
- `aprovisionamento-teste`: J15–J20 e cenários controlados;
- P-03: cliente real novo não-VIP para onboarding/trial/pagamento;
- T1/T2: coletados sobre o RC publicado;
- nenhum PASS fabricado.

Durante o piloto, não expandir produto. Correções imediatas apenas para segurança, perda de dados ou indisponibilidade crítica. Demais achados são congelados para a etapa seguinte.

#### Pós-piloto e SAAS-J

Ao terminar o piloto:
1. congelar evidências e lista de achados;
2. classificar bugs/UX/custo/operação;
3. corrigir em branches curtas coordenadas;
4. repetir apenas os gates/jornadas afetados;
5. congelar o candidato final corrigido;
6. executar SAAS-J;
7. somente com SAAS-J aprovada e autorização do fundador, realizar lançamento completo.

#### Desenvolvimento paralelo coordenado permanece oficial

A nova fase continua usando o método oficial de 1 Coordenador + até 4 workers:
- **HARDEN-A:** segurança, dependências, CI e regressão;
- **HARDEN-B:** backup READY, recovery e restore isolado;
- **HARDEN-C:** health, Rules, pacote de release/Vercel e rollback;
- **HARDEN-D:** reconciliação SaaS↔Mobile, matriz e evidências;
- **Coordenador:** integração, conflitos, Memorial, freeze do RC e liberação do piloto.

Regras:
- branches exclusivas e base congelada;
- sem merge/rebase cruzado;
- handoff obrigatório;
- nenhum worker publica main/Vercel/Rules ou executa restore real sem autorização;
- conflitos em Auth, workspace/UG, sessão, legal, lifecycle, Rules, shell, Central ou schema retornam ao Coordenador;
- toda mudança compartilhada contém **Impacto MOBILE-R1**.

Documento detalhado da fase:
`docs/SAAS_R1_PRE_PILOTO_HARDENING.md`.

O T0 já coletado não é descartado: ele é o **baseline oficial pré-release** para comparação com T1/T2 durante/depois do piloto final.

### ONDA HARDEN A/B/C/D — PLANO OPERACIONAL DETALHADO ANTES DA ATIVAÇÃO

Esta seção é **normativa** para a próxima onda e complementa a seção de reorganização da reta final.

A onda ainda não representa piloto. Seu objetivo é entregar um **Release Candidate SaaS R1 tecnicamente fechado**.

#### Topologia

Máximo:
- 1 Chat Coordenador;
- até 4 workers em paralelo.

Branches planejadas:
- HARDEN-A: `saas-harden-a-security-dependencies`;
- HARDEN-B: `saas-harden-b-recovery-restore`;
- HARDEN-C: `saas-harden-c-release-health-rules`;
- HARDEN-D: `saas-harden-d-mobile-reconciliation`.

Todas as branches devem nascer do **mesmo HEAD congelado** da `feat/saas-r1-commercializacao`, imediatamente antes da ativação. Nenhum worker pode recriar a branch, rebasing/merging da integradora ou incorporar outra worker.

Snapshot Mobile de preparação desta onda:
- `feat/central-mobile-r1@22fb276a502e3475d579c3b1874e4c0353fc2e35`.

Esse HEAD Mobile é apenas fotografia de preparação. HARDEN-D deve reconsultar a integradora Mobile viva ao iniciar e antes do handoff.

#### Regras comuns obrigatórias

Todo HARDEN deve:
1. confirmar branch e HEAD antes de editar;
2. permanecer no escopo exclusivo;
3. não fazer merge em `main`;
4. não publicar Vercel;
5. não publicar Rules;
6. não executar restore real sem autorização explícita;
7. não criar P-03;
8. não executar J01–J20 como piloto final;
9. não alterar P-01/P-02;
10. não usar `npm audit fix --force`;
11. parar e reportar colisão transversal;
12. entregar handoff auditável.

Mudanças compartilhadas devem conter seção **Impacto MOBILE-R1**.

#### Matriz de ownership da onda

- `package.json`, lockfile e correções de dependências: **HARDEN-A**.
- recovery scripts/tests e estado externo backup/restore: **HARDEN-B**.
- `/api/health`, health tests, pacote Rules, release, Vercel e rollback: **HARDEN-C**.
- comparação SaaS↔Mobile e matriz de compatibilidade: **HARDEN-D**.
- Memorial, Integration Status global, integração entre workers e freeze do RC: **Coordenador**.

HARDEN-D é **auditivo por padrão**. Se encontrar incompatibilidade em Auth, workspace/UG, sessão/lease, legal, billing/lifecycle, Rules, shell, Central, schema ou source of truth, não deve corrigir o runtime dentro da própria branch. Deve devolver o conflito ao Coordenador, que abre uma branch curta `saas-harden-fix-<dominio>-<slug>`.

#### HARDEN-A — Segurança, Dependências, CI e Regressão

Missão:
- auditar os 22 advisories observados durante `npm ci`;
- identificar pacote, versão, cadeia transitiva, severidade, runtime/dev e exposição real;
- diferenciar advisory de vulnerabilidade alcançável;
- aplicar somente a correção mínima necessária e compatível;
- certificar regressão após qualquer alteração.

Obrigatório:
- `npm audit` ou inspeção equivalente sem `--force`;
- relatório antes/depois;
- TypeScript;
- production build;
- `git diff --check`;
- Application CI equivalente;
- Core Protection;
- Recovery guardrails;
- Legal Validation/guards relevantes;
- segurança/multitenancy afetada.

Proibições específicas:
- upgrade major oportunista;
- refatoração fora do advisory;
- alterar billing/onboarding/lifecycle para aproveitar a onda;
- mascarar advisory;
- declarar segurança apenas porque um comando automático sugeriu fix.

Critério PASS:
- advisories classificados;
- vulnerabilidades relevantes corrigidas ou justificadamente aceitas com evidência;
- nenhum alto/crítico alcançável fica aberto sem decisão explícita;
- gates pós-correção verdes.

#### HARDEN-B — Backup, Recovery e Restore

Missão:
fechar recovery real **antes do piloto**.

Estado herdado:
- PITR ativo nos dois bancos;
- delete protection ativa;
- backup diário ativo;
- retenção 14 semanas;
- **não repetir `apply`**.

Obrigatório:
- `recovery:status`;
- `recovery:verify`;
- confirmar backup `READY` nos dois bancos;
- registrar backup resource name, location, snapshot e expiração;
- selecionar backup real;
- preparar `restore-plan` para database novo e isolado;
- validar explicitamente que o target não é produção;
- preparar checklist de IAM/Rules/TTL e amostragem.

Restore real:
- somente após autorização explícita;
- nunca sobre banco produtivo;
- nunca remover delete protection de produção para facilitar teste.

Critério PASS:
- ambos com backup READY;
- verify verde;
- restore isolado real concluído;
- dados amostrados;
- IAM/Rules/TTL conferidos;
- evidência registrada.

Se depender apenas da autorização de restore, status = **PARCIAL**, não PASS.

#### HARDEN-C — Health, Rules, Release e Rollback

Missão:
montar o pacote exato de publicação controlada do RC.

Responsabilidades:
- auditar PR #223/health contra a base congelada;
- integrar semanticamente health na branch HARDEN-C se continuar válido;
- confirmar HTTP 200 + `status=ok` + `no-store`;
- confirmar zero leitura Firestore/segredos;
- executar health tests;
- identificar exatamente as Rules candidatas necessárias;
- comparar Rules produtivas versus candidatas;
- definir ordem de rollout;
- definir smoke pós-publicação;
- definir rollback de aplicação e Rules;
- listar env/config necessárias;
- preparar estratégia Vercel considerando `build-rate-limit`;
- preparar uptime/alert/channel para serem ativados quando o endpoint estiver vivo.

Proibições específicas:
- merge cego do PR #223;
- publicação real;
- promoção para `main`;
- deploy de Rules;
- alterar lógica comercial para resolver conflito de release.

Critério PASS:
- health integrado e testado no candidato;
- manifest de release completo;
- Rules candidatas validadas;
- rollout/rollback reproduzíveis;
- smoke checklist pronta;
- nenhuma dependência oculta para publicação.

#### HARDEN-D — Reconciliação SaaS ↔ MOBILE-R1 e Evidências

Missão:
provar semanticamente que o candidato SaaS e a Mobile vigente continuam compatíveis.

Deve registrar:
- HEAD SaaS congelado;
- HEAD Mobile vivo no início;
- HEAD Mobile vivo no handoff;
- branches/PRs Mobile relevantes.

Comparação mínima obrigatória:
- Auth;
- workspace/UG;
- sessão/lease/heartbeat;
- legal gate;
- billing/lifecycle;
- `warehouseAccess`;
- Firestore Rules;
- schema/source of truth da Central;
- shell/guards;
- contratos desktop/mobile;
- `next.config.ts` e Permissions-Policy quando relevante;
- APIs/serviços compartilhados.

Cada domínio deve receber uma classificação:
- `SEM DELTA`;
- `DELTA COMPATÍVEL`;
- `CONFLITO`;
- `REQUER COORDENADOR`.

Critério PASS:
- todos os domínios compartilhados classificados;
- nenhum conflito material aberto;
- impacto Mobile do RC explicitado;
- evidência suficiente para freeze.

#### Formato obrigatório do handoff HARDEN

Cada worker deve entregar:
- Frente;
- Branch;
- Base congelada;
- HEAD final;
- PR draft;
- Status: PASS / PARCIAL / BLOQUEADO;
- arquivos alterados;
- diff resumido;
- o que foi confirmado;
- o que foi alterado;
- o que **não** foi executado;
- comandos/testes e resultados;
- incidentes;
- riscos/pendências;
- Impacto MOBILE-R1;
- dependência de autorização externa;
- recomendação ao Coordenador;
- critério objetivo para próxima etapa.

Nenhum handoff pode resumir a conclusão apenas como “deu certo”.

#### Critérios de status

**PASS**
- todo o escopo da frente foi fechado com evidência reproduzível;
- nenhum blocker da própria frente permanece.

**PARCIAL**
- parte segura concluída, mas existe evento/ação externa ou autorização explícita ainda pendente.

**BLOQUEADO**
- existe impedimento concreto que impede conclusão segura; o blocker deve ser identificado nominalmente.

#### Protocolo de integração do Coordenador

O Coordenador:
1. audita HEAD, PR e diff real;
2. compara com a integradora viva;
3. não aceita handoff apenas por texto;
4. decide merge, integração semântica ou devolução;
5. resolve sobreposição de arquivos;
6. reexecuta gates combinados necessários;
7. atualiza Memorial/Integration Status/Handoff;
8. reconsulta MOBILE-R1 viva;
9. somente então decide sobre o freeze do RC.

Ordem lógica preferida:
- HARDEN-D deve devolver cedo qualquer conflito compartilhado;
- HARDEN-A integra correções de dependência antes da certificação combinada;
- HARDEN-B fecha recovery quando o evento externo permitir;
- HARDEN-C fecha pacote de release depois de considerar deltas de A/D;
- o Coordenador executa a certificação combinada final.

A ordem cronológica dos handoffs **não substitui análise de dependência**.

#### Gate obrigatório para congelar o Release Candidate

O Coordenador só pode registrar **RC FROZEN** quando coexistirem:
- HARDEN-A sem blocker relevante;
- HARDEN-B PASS;
- HARDEN-C PASS;
- HARDEN-D PASS;
- TypeScript/build/Application CI/diff hygiene verdes;
- Core Protection/Recovery/Legal e segurança aplicável verdes;
- Rules + rollout + rollback definidos;
- backup/restore real comprovados;
- Mobile reconciliada;
- nenhum incidente pré-piloto bloqueante;
- HEAD único da integradora registrado.

Depois do freeze, a próxima ação ainda **não é lançamento comercial**. É autorização explícita para disponibilizar o RC em ambiente de piloto controlado, executar smoke e somente então iniciar o piloto real final.

Documento especializado de apoio:
`docs/SAAS_R1_HARDENING_EXECUCAO_PARALELA.md`.

### ONDA HARDEN — BASE CONGELADA E BRANCHES PRONTAS

A preparação estrutural da onda HARDEN foi concluída.

**Base comum congelada:**
`f8d2a53bfadf2548a59f49cdfc3cdb3d420f0b11`

As quatro branches foram criadas exatamente nesse HEAD e verificadas:

- HARDEN-A — `saas-harden-a-security-dependencies@f8d2a53bfadf2548a59f49cdfc3cdb3d420f0b11`;
- HARDEN-B — `saas-harden-b-recovery-restore@f8d2a53bfadf2548a59f49cdfc3cdb3d420f0b11`;
- HARDEN-C — `saas-harden-c-release-health-rules@f8d2a53bfadf2548a59f49cdfc3cdb3d420f0b11`;
- HARDEN-D — `saas-harden-d-mobile-reconciliation@f8d2a53bfadf2548a59f49cdfc3cdb3d420f0b11`.

Snapshot Mobile no momento do freeze:
`feat/central-mobile-r1@22fb276a502e3475d579c3b1874e4c0353fc2e35`.

Estado:
- branches: **CRIADAS**;
- base comum: **VERIFICADA**;
- escopos/gates/handoffs: **DOCUMENTADOS**;
- chats trabalhadores: **AINDA NÃO ATIVADOS**;
- nenhum PR HARDEN aberto ainda;
- nenhuma alteração de produção autorizada por este freeze.

Regra de ativação:
- todo prompt HARDEN deve declarar explicitamente a base `f8d2a53bfadf2548a59f49cdfc3cdb3d420f0b11`;
- o worker deve confirmar HEAD inicial exatamente igual;
- se o HEAD inicial divergir, deve parar antes de editar;
- não atualizar a branch worker para acompanhar novos commits da integradora;
- deltas posteriores da integradora pertencem ao Coordenador e serão reconciliados no fechamento.

Com esse freeze, o próximo ato permitido é gerar/usar os quatro prompts de ativação HARDEN-A/B/C/D.

## 18. EMPROVEX PROGRAM CONTROL — COORDENADOR GERAL

### 18.1 Instituição e finalidade

A partir de 2026-10-02, o EMPROVEX adota formalmente uma camada de **Program Control**, exercida por um **Coordenador Geral do EMPROVEX** acima dos Coordenadores de Programa.

Motivação:
- SaaS R1 e MOBILE-R1 evoluem simultaneamente;
- existem múltiplos workers em bases congeladas distintas;
- Auth, workspace/UG, sessão, legal, lifecycle, Rules, Central e outros contratos são compartilhados;
- o volume de documentação e decisões ultrapassou o que um único coordenador especializado deve centralizar;
- o risco principal deixou de ser apenas implementação local e passou a incluir **integração entre programas, estado desatualizado, WIP excessivo e release incorreto**.

Princípio:

> **O Coordenador Geral controla o sistema de desenvolvimento; os Coordenadores de Programa controlam seus programas; os workers executam tarefas.**

Estado desta camada:
- arquitetura: **OFICIAL**;
- regras: **DOCUMENTADAS**;
- documento operacional: `docs/EMPROVEX_PROGRAM_CONTROL.md`;
- chat Coordenador Geral: **AINDA NÃO ATIVADO neste checkpoint**.

### 18.2 Hierarquia oficial

```text
FUNDADOR
   │
COORDENADOR GERAL EMPROVEX
   │
   ├── COORDENADOR MOBILE-R1
   │      └── workers MOBILE
   │
   └── COORDENADOR SAAS-R1
          └── workers SAAS / HARDEN
```

Não criar hierarquia adicional acima do Coordenador Geral.

Hierarquia máxima:
**Fundador → Coordenador Geral → Coordenadores de Programa → Workers**.

### 18.3 Regra de comunicação

Fluxo normal:

```text
WORKER
  ↓ handoff + evidência
COORDENADOR DO PROGRAMA
  ↓ auditoria + integração + estado consolidado
COORDENADOR GERAL
  ↓ reconciliação global + Memorial + próximo gate
FUNDADOR
  ↓ autorizações/decisões quando necessárias
```

Regras:
- worker não reporta rotineiramente ao Coordenador Geral;
- worker não coordena outro worker;
- Coordenador Geral não executa trabalho de worker;
- Coordenador Geral não substitui revisão técnica do Coordenador de Programa;
- detalhes locais permanecem no nível mais baixo capaz de resolvê-los.

### 18.4 Autoridade do Fundador permanece intacta

O Coordenador Geral **não recebe autorização implícita de produção**.

Continuam dependentes de decisão/autorização do fundador quando aplicável:
- release final;
- promoção/merge protegido para produção;
- publicação Vercel produtiva;
- publicação de Rules produtivas;
- restore real;
- ações disruptivas em usuários/workspaces reais;
- GO/NO-GO de RC/piloto/lançamento;
- mudanças comerciais fundamentais não delegadas.

O Coordenador Geral organiza evidências e recomenda o próximo gate; a decisão humana final permanece com o fundador.

### 18.5 Responsabilidades exclusivas do Coordenador Geral

#### Estado global
Manter visão viva e compacta de:
- `main`/produção;
- integradora SaaS;
- integradora Mobile;
- outros programas futuros;
- bases congeladas;
- workers ativos/concluídos;
- handoffs aguardando revisão;
- PRs transversais;
- blockers;
- incidentes globais;
- último ponto de reconciliação;
- próximo gate;
- estado do Release Candidate;
- autorização de produção.

#### Controle de WIP e concorrência
O Coordenador Geral decide se novas frentes podem ser abertas.

Regra:

> **A capacidade de revisão determina o paralelismo; a capacidade de abrir chats não.**

Se os Coordenadores de Programa acumularem handoffs não auditados, conflitos não classificados ou integrações pendentes, novas waves podem ser seguradas mesmo que existam recursos para abrir mais chats.

#### Integração transversal
O Coordenador Geral arbitra mudanças que cruzem programas.

Zona de contratos compartilhados:
- Auth;
- workspace/UG;
- sessão/lease/heartbeat;
- legal gate;
- billing/lifecycle;
- Firestore Rules;
- `warehouseAccess`;
- Central de Depósitos;
- schemas/source of truth;
- shell/guards;
- APIs/serviços comuns;
- políticas de navegador/configuração com efeito compartilhado;
- telemetria comum.

#### Release management
Coordenadores de Programa podem declarar:
- `PROGRAMA PASS`;
- `PROGRAMA CERTIFICADO`;
- `HANDOFF INTEGRÁVEL`.

Somente o Coordenador Geral pode declarar no nível global:
- `PROGRAMAS RECONCILIADOS`;
- `EMPROVEX RC CANDIDATO`;
- `RC FROZEN`;
- `PRONTO PARA SOLICITAR PUBLICAÇÃO CONTROLADA`;
- `PRONTO PARA PILOTO`;
- `PRONTO PARA CERTIFICAÇÃO/RELEASE FINAL`.

Nenhuma dessas declarações equivale por si só a autorização produtiva.

### 18.6 Coordenadores de Programa

Cada programa mantém autonomia local.

Responsabilidades:
- planejar waves;
- congelar bases;
- ativar workers;
- revisar HEAD/PR/diff real;
- validar testes/gates;
- devolver worker quando necessário;
- integrar local/semanticamente;
- atualizar documentação especializada;
- consolidar estado para o Coordenador Geral.

O Coordenador de Programa deve escalar apenas:
- conflito transversal;
- decisão de prioridade global;
- colisão entre programas;
- risco de release/produção;
- alteração de contrato compartilhado sem solução local segura.

### 18.7 Workers

Workers continuam sendo unidades de execução.

Devem:
- trabalhar apenas na branch/base atribuída;
- permanecer no escopo;
- registrar testes e evidências;
- declarar impacto transversal;
- declarar impacto MOBILE-R1/SaaS quando pertinente;
- produzir handoff auditável.

Não devem:
- editar estado global do Memorial por padrão;
- decidir prioridade entre programas;
- negociar merges cruzados;
- publicar produção;
- redefinir contratos globais silenciosamente.

### 18.8 Pacote consolidado que sobe ao Coordenador Geral

Cada Coordenador de Programa deve fornecer um resumo objetivo contendo:
- Programa;
- Integrador + HEAD;
- Base(s) congelada(s);
- Workers ativos;
- Workers concluídos;
- Handoffs pendentes;
- PRs relevantes;
- gates e status;
- deltas em contratos compartilhados;
- incidentes;
- risco atual;
- próximo gate;
- produção alterada? SIM/NÃO;
- autorização externa necessária?;
- recomendação objetiva.

O Coordenador Geral não deve depender de logs brutos para reconstruir o estado normal de um programa.

### 18.9 Classificação oficial de problemas

#### LOCAL
Afeta apenas uma worker.
Responsável: worker.

#### DE PROGRAMA
Afeta múltiplas frentes do mesmo programa.
Responsável: Coordenador do Programa.

#### TRANSVERSAL
Afeta dois ou mais programas ou contrato compartilhado.
Responsável: Coordenador Geral.

#### RELEASE / PRODUÇÃO
Afeta `main`, Vercel, Rules produtivas, restore, usuários reais, dados ou lançamento.
Responsável: Coordenador Geral + fundador quando houver autorização necessária.

Escalonar somente até o nível necessário.

### 18.10 Semáforo global

O Coordenador Geral mantém semáforo por programa/frente:

**VERDE**
- pode continuar independentemente.

**AMARELO**
- existe delta compartilhado ou risco conhecido;
- trabalho local pode continuar até a próxima barreira.

**VERMELHO**
- continuar naquela unidade produziria risco, retrabalho material ou inconsistência;
- aguardar resolução.

Aplicar vermelho à menor unidade possível. Não bloquear SaaS ou Mobile inteiros se apenas uma frente precisa aguardar.

### 18.11 Barreiras de sincronização

Não reconciliar continuamente todas as branches.

Barreiras deliberadas:
1. antes de abrir nova wave relevante;
2. após um conjunto de handoffs;
3. antes de frente explicitamente transversal;
4. antes de freeze de RC;
5. antes de publicação controlada;
6. após piloto;
7. antes de certificação/release final.

Entre barreiras, programas VERDES continuam independentes.

Esse modelo preserva o ganho do desenvolvimento paralelo e reduz merge/rebase/revalidação desnecessários.

### 18.12 Protocolo para contratos compartilhados

Toda alteração compartilhada deve declarar:
- arquivos afetados;
- contrato anterior;
- contrato novo;
- backward compatibility;
- impacto no outro programa;
- migração necessária;
- risco de fonte de verdade duplicada;
- necessidade de coordenação.

Classificação:
- `SEM DELTA`;
- `DELTA COMPATÍVEL`;
- `CONFLITO`;
- `REQUER COORDENADOR GERAL`.

Nenhum conflito compartilhado é resolvido por merge/rebase cego.

### 18.13 Governança do Memorial Oficial

O Memorial Oficial passa a ter **propriedade lógica do Coordenador Geral**.

Isso não significa que apenas um chat possa escrever documentação. Significa que a coerência global e a versão vigente das regras são responsabilidade do Coordenador Geral.

#### Quem altera o quê

**Coordenador Geral**
- topo/estado vivo;
- governança;
- programas ativos;
- decisões transversais;
- release/freeze;
- índice mestre;
- reconciliações globais.

**Coordenador de Programa**
- documentação especializada do próprio programa;
- pode propor/fornecer delta certificado ao Memorial;
- só altera seção global diretamente quando autorizado pelo protocolo vigente.

**Worker**
- documentação da própria frente;
- não altera estado global por padrão.

#### Tipos de conteúdo

O Memorial deve distinguir explicitamente:
- **ESTADO VIGENTE**;
- **DECISÃO PERMANENTE**;
- **CHECKPOINT HISTÓRICO**;
- **DETALHE DE PROGRAMA**.

Quando uma regra for substituída:
- preservar histórico relevante;
- marcar regra antiga como histórica/superada;
- escrever nova regra inequívoca;
- atualizar topo/índice quando necessário.

#### Auditoria de coerência obrigatória

Em cada grande barreira, pesquisar contradições como:
- EM EXECUÇÃO vs ADIADO;
- PUBLICADO vs NÃO PUBLICADO;
- PASS vs PENDENTE;
- branch/HEAD antigo apresentado como vivo;
- regra histórica descrita como vigente;
- autorização antiga interpretada fora do escopo.

### 18.14 Memorial V2 — responsabilidade futura do Coordenador Geral

O Memorial atual ultrapassou o papel de simples histórico e funciona como:
- wiki técnica;
- ADR;
- runbook;
- release book;
- estado de programa;
- histórico de decisões.

A futura reorganização estrutural será conduzida pelo Coordenador Geral.

Objetivo:
- reduzir o Memorial principal;
- manter estado atual e decisões permanentes fáceis de localizar;
- mover detalhes extensos para documentos especializados;
- preservar histórico integral;
- criar índice mestre confiável;
- impedir perda de contexto.

Estratégia:
- não reorganizar estruturalmente durante waves críticas;
- inventário/projeto pode ocorrer em paralelo;
- migração real ocorre numa barreira de sincronização;
- validar links/referências;
- comparar conteúdo antes/depois;
- nunca apagar história apenas para reduzir tamanho.

Arquitetura-alvo sugerida:

```text
docs/
├── EMPROVEX_MEMORIAL_OFICIAL.md
├── EMPROVEX_PROGRAM_CONTROL.md
├── program-control/
│   ├── EMPROVEX_GLOBAL_STATUS.md
│   ├── EMPROVEX_SHARED_CONTRACTS.md
│   ├── EMPROVEX_DECISION_LOG.md
│   └── EMPROVEX_RELEASE_HISTORY.md
├── saas/
├── mobile/
├── performance/
└── archive/
```

A criação/migração dessa estrutura deve ser uma operação documental controlada, não uma movimentação oportunista durante waves.

### 18.15 Registro Global do EMPROVEX

O Coordenador Geral deve manter um painel operacional pequeno, contendo no mínimo:
- produção + HEAD;
- SaaS integradora + HEAD;
- Mobile integradora + HEAD;
- workers ativos;
- bases congeladas;
- semáforos;
- blockers;
- conflitos transversais;
- último sync;
- próximo sync;
- próximo gate;
- estado do RC;
- autorização de produção.

O Registro Global responde rapidamente:
> **“Onde está o EMPROVEX agora?”**

O Memorial responde:
> **“Como o EMPROVEX chegou aqui, quais regras governam o projeto e por quê?”**

### 18.16 Relação com SaaS HARDEN e MOBILE-R1

No checkpoint de instituição do Program Control:
- MOBILE-R1 possui desenvolvimento paralelo ativo;
- existem três chats Mobile em curso sob seu Coordenador de Programa;
- SaaS R1 está em HARDENING PRÉ-PILOTO;
- branches HARDEN-A/B/C/D estão preparadas em base congelada `f8d2a53bfadf2548a59f49cdfc3cdb3d420f0b11`;
- HARDEN-D é transversal e deve reconciliar um estado Mobile suficientemente estável, não perseguir continuamente uma integradora em movimento.

O Coordenador Geral decidirá a barreira correta para HARDEN-D e outras reconciliações futuras.

### 18.17 Política de ativação de novas waves

Antes de autorizar nova wave, verificar:
- existem handoffs sem auditoria?
- existem conflitos transversais abertos?
- a capacidade dos Coordenadores suporta mais resultados?
- a base congelada está correta?
- o paralelismo reduz tempo real?
- a frente depende de alvo ainda em movimento?
- há sobreposição de ownership?

Se a resposta indicar saturação, adiar novas ativações.

### 18.18 Ativação inicial do chat Coordenador Geral

O prompt inicial do Coordenador Geral deve obrigatoriamente instruí-lo a:
1. ler este Memorial;
2. ler `docs/EMPROVEX_PROGRAM_CONTROL.md`;
3. ler os handoffs/estados correntes SaaS e Mobile;
4. consultar HEADs vivos de `main`, integradora SaaS e integradora Mobile;
5. montar o primeiro Registro Global;
6. classificar semáforo de cada programa;
7. identificar conflitos transversais;
8. identificar handoffs/revisões pendentes;
9. estabelecer próxima barreira global;
10. **não editar código funcional**;
11. **não assumir workers**;
12. **não publicar produção**;
13. manter o Memorial global coerente dali em diante.

### 18.19 Princípio final do Program Control

O Coordenador Geral existe para **reduzir coordenação acidental, não para criar burocracia**.

Deve:
- receber sínteses;
- intervir por exceção;
- bloquear somente o necessário;
- proteger a autonomia dos programas;
- preservar paralelismo seguro;
- limitar WIP pela capacidade de revisão;
- transformar contexto disperso em estado pequeno e confiável;
- conduzir a coerência do Memorial;
- impedir que “programa localmente PASS” seja confundido com “EMPROVEX globalmente pronto”.

### 18.20 Documentação canônica versus branches congeladas

Uma branch worker pode ter sido congelada antes de uma atualização documental global posterior.

Regra:
- **não rebasear, mergear ou mover a branch worker apenas para obter documentação nova**;
- a base congelada continua imutável;
- o prompt do worker deve fornecer as regras globais novas relevantes;
- quando necessário, o worker consulta a versão viva do Memorial/Program Control diretamente na integradora sem incorporá-la à branch.

Exemplo de consulta somente leitura:

```powershell
git fetch origin
git show origin/feat/saas-r1-commercializacao:docs/EMPROVEX_MEMORIAL_OFICIAL.md
git show origin/feat/saas-r1-commercializacao:docs/EMPROVEX_PROGRAM_CONTROL.md
```

Essa leitura:
- não altera o HEAD da worker;
- não faz merge;
- não faz rebase;
- permite obedecer governança publicada após o freeze.

Nos prompts de waves já congeladas, o Coordenador deve indicar explicitamente qual documentação é **base-local** e qual deve ser consultada como **governança canônica viva**.

### PROGRAM CONTROL — HARDEN-D LIBERADA APÓS CHECKPOINT MOBILE PÓS-INTEGRAÇÃO 2

Decisão oficial recebida e auditada.

Checkpoint Mobile estável:
- integradora: `feat/central-mobile-r1`;
- HEAD: `7b745fa0b7979e643b83b7de94dd96a0290930ab`;
- último estado operacional certificado informado pelo Program Control: `d8148f01b877adad1e7880fc0b7fc6d4b3d60249`;
- MOBILE-C, MOBILE-D e MOBILE-E: **CONCLUÍDAS E INTEGRADAS**;
- handoffs Mobile pendentes: **NENHUM**;
- MOBILE-F/G/H: **NÃO INICIADAS / BLOQUEADAS** até handoff HARDEN-D e nova decisão global.

HARDEN-D:
- branch: `saas-harden-d-mobile-reconciliation`;
- base congelada obrigatória: `f8d2a53bfadf2548a59f49cdfc3cdb3d420f0b11`;
- verificação: branch permanece **IDÊNTICA** à base;
- estado: **LIBERADA PARA ATIVAÇÃO**;
- não recriar;
- não rebasear;
- não mover para a integradora;
- não incorporar HARDEN-A/B/C;
- documentação pós-freeze somente em leitura.

Alvos de reconciliação:
- Mobile: `feat/central-mobile-r1@7b745fa0b7979e643b83b7de94dd96a0290930ab`;
- SaaS vivo para contexto: `feat/saas-r1-commercializacao@4848643be85b30532f7f093c4ddb0e729facfad3`.

Delta transversal obrigatório:
- arquivo: `next.config.ts`;
- Mobile: `camera=(self), microphone=(), geolocation=()`;
- SaaS: `camera=(), microphone=(), geolocation=()`.

Contrato esperado:
- preservar **câmera same-origin** necessária à Central Móvel;
- manter **microfone bloqueado**;
- manter **geolocalização bloqueada**;
- classificar semanticamente o delta antes de qualquer correção;
- HARDEN-D permanece **auditiva por padrão**.

Matriz obrigatória HARDEN-D:
- `SEM DELTA`;
- `DELTA COMPATÍVEL`;
- `CONFLITO`;
- `REQUER COORDENADOR GERAL`.

Se detectar conflito funcional em Auth, workspace/UG, sessão, legal, lifecycle, `warehouseAccess`, Rules, shell, schema ou qualquer contrato compartilhado:
- não corrigir silenciosamente na HARDEN-D;
- registrar evidência;
- devolver ao Coordenador SaaS/Program Control.

Esta decisão não autoriza:
- merge em `main`;
- deploy;
- publicação de Rules;
- restore;
- ação produtiva.

Após handoff, o Coordenador SaaS audita HEAD/PR/matriz e envia pacote consolidado ao Coordenador Geral.

