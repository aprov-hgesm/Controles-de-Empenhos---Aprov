# EMPROVEX — Memorial Oficial do Repositório

Última atualização: **2026-10-01 — SaaS R1 Onda 1 concluída / SAAS-DS liberada**
Produção vigente: `main@e90f92acae1514ee5cbc6ce95fed354bc1454330`
Branch integradora do SaaS R1: `feat/saas-r1-commercializacao`
Estado: **Performance R3 PUBLICADA E ENCERRADA; SAAS-A congelada; SAAS-B, SAAS-C, SAAS-DL e SAAS-E INTEGRADAS; Onda 1 CONCLUÍDA; SAAS-DS LIBERADA para Segurança/Enforcement**

Este documento é a **porta de entrada canônica para continuidade do EMPROVEX como produto**. Ele resume o estado vigente e aponta para os documentos históricos/especializados. O histórico detalhado não deve ser apagado. Para comportamento publicado, `main` prevalece. Para o ciclo SaaS R1 em desenvolvimento, prevalecem `feat/saas-r1-commercializacao`, este memorial e os quatro documentos canônicos `SAAS_R1_*`.

## 1. Fontes da verdade

Ordem de consulta para um novo trabalho:

1. `main` — estado efetivo do código atualmente em produção;
2. `feat/saas-r1-commercializacao` — estado integrador vigente do programa SaaS R1;
3. este memorial — síntese canônica de estado, contratos, prioridades e sequência de trabalho;
4. `docs/SAAS_R1_PLANO_MESTRE.md`, `docs/SAAS_R1_EXECUCAO_PARALELA.md`, `docs/SAAS_R1_INTEGRATION_STATUS.md` e `docs/SAAS_R1_COORDENADOR_HANDOFF.md` — fontes operacionais do SaaS R1;
5. documentação especializada do domínio alterado;
6. decisões arquiteturais registradas;
7. histórico de fases/branches/PRs apenas como contexto.

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
- concessão/remoção de VIP é exclusivamente administrativa e auditada;
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
- **SAAS-E — Operação/backup/uptime:** **INTEGRADA** via PR #215; health/recovery/runbooks certificados no repositório, com configuração externa de backup/restore/uptime ainda pendente.

**Onda 2 — LIBERADA**
- **SAAS-DS — Segurança/enforcement:** dependência B+C satisfeita; deve partir da integradora após o fechamento documental da Onda 1.

**Fechamento**
- SAAS-I — integração controlada;
- SAAS-P — piloto;
- SAAS-J — certificação comercial;
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
- pelo menos um pagamento real;
- trial → ativação;
- suspensão → reativação controlada;
- restauração testada;
- isolamento confirmado;
- custos medidos;
- suporte observado.

A meta de capacidade comercial é até 100 usuários registrados, distinguindo cadastrados, ativos e simultâneos.

### Regra de produção

Workers nunca fazem merge em `main`, deploy Vercel, deploy de Rules ou promoção de produção.

A branch integradora só chega à produção após SAAS-J e autorização explícita do usuário.

## 8. Riscos/pendências que não devem ser esquecidos

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
- SAAS-I, SAAS-P e SAAS-J permanecem pendentes;
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
- ativar/verificar PITR e delete protection nos dois bancos;
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
