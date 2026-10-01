# EMPROVEX — Memorial Oficial do Repositório

Última atualização: **2026-10-01 — PERF-J aprovada / candidata final de release**
Baseline de produção consultada: `main@22d9fe5f86e2cfbb247eb21bae28e4b2c6cb2a2f`
Branch candidata da Performance R3: `feat/performance-r3-commercializacao`
HEAD certificado da Performance R3 pela PERF-J: `c08c6efa9931bf1df95aee86db51de1b8edb1912`
Estado de fechamento: **PERF-J APROVADA; candidata final pronta para decisão de release; sem merge consolidado em `main` e sem deploy consolidado da R3 em produção**

Este documento é a **porta de entrada canônica para continuidade do EMPROVEX como produto**. Ele resume o estado vigente e aponta para os documentos históricos/especializados. O histórico detalhado não deve ser apagado. Para comportamento já publicado, `main` prevalece; para a rodada Performance R3 ainda não publicada, prevalecem a branch integradora atual e os registros canônicos de integração deste memorial.

## 1. Fontes da verdade

Ordem de consulta para um novo trabalho:

1. `main` — estado efetivo do código atualmente em produção;
2. `feat/performance-r3-commercializacao` — estado candidato vigente da Performance R3 enquanto a rodada não chegar à `main`;
3. este memorial — síntese canônica de estado, contratos, prioridades e sequência de trabalho;
4. `docs/PERFORMANCE_R3_INTEGRATION_STATUS.md` e `docs/PERFORMANCE_R3_COORDENADOR_HANDOFF.md` — quadro operacional e handoff da R3;
5. documentação especializada do domínio alterado;
6. decisões arquiteturais registradas;
7. histórico de fases/branches/PRs apenas como contexto.

Para a Central de Depósitos:
- `docs/adm-deposito/README.md`;
- `docs/adm-deposito/STATUS.md`;
- `docs/adm-deposito/DECISIONS.md`;
- `docs/adm-deposito/ROADMAP.md`.

Modus operandi de desenvolvimento:
- `docs/DEVELOPMENT_MODUS_OPERANDI.md` — norma oficial para decomposição, desenvolvimento paralelo, integração, validação, certificação e release.

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
- Performance R3 está integralmente combinada na branch integradora; a **PERF-I foi APROVADA** após validação técnica e manual, e a **PERF-J foi APROVADA** após certificação final consolidada. A rodada **ainda não foi mergeada em `main` nem promovida como release consolidado**.

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

## 6. Modus operandi oficial de desenvolvimento — paralelo, coordenado e certificado

O método comprovado na Performance R3 passa a ser o **padrão oficial de engenharia do EMPROVEX para ciclos de média/alta complexidade**.

Norma geral:

`docs/DEVELOPMENT_MODUS_OPERANDI.md`

Modelo oficial:

> **baseline e contratos comuns → decomposição e mapa de dependências → workers independentes em ondas paralelas → handoffs → integração semântica controlada → validação integrada técnica e de UX → certificação final → autorização de release**

A Performance R3 foi a primeira aplicação completa desse modelo e permanece documentada em `docs/PERFORMANCE_R3_EXECUCAO_PARALELA.md`.

Regras estruturais permanentes:
- usar paralelismo apenas quando houver independência real;
- cada worker possui fronteira, branch, base SHA, contratos, métrica, gates e handoff próprios;
- workers não integram diretamente em `main` e não absorvem silenciosamente escopo de outras frentes;
- o Coordenador mantém a visão global, integra semanticamente e resolve conflitos cruzados;
- CI isolado do worker não substitui CI combinado quando houver divergência/risco de integração;
- toda rodada grande deve possuir fase de validação integrada, incluindo UX;
- certificação final deve ser logicamente separada da implementação;
- produção/release não ocorre automaticamente por merge ou certificação;
- tarefas pequenas podem usar fluxo simplificado, preservando baseline, testes, contratos e documentação proporcional.

### Aplicação histórica — Performance R3

A Performance R3 **não foi executada como uma fila monolítica de fases dependentes**.

Aplicação específica:

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

A especificação geral e permanente está em `docs/DEVELOPMENT_MODUS_OPERANDI.md`. A aplicação específica da Performance R3 está em `docs/PERFORMANCE_R3_EXECUCAO_PARALELA.md`.

A independência das frentes é uma **regra arquitetural do método**: um chat não deve aproveitar sua frente para refatorar outra área. Dependências são registradas no handoff e resolvidas pelo Coordenador.


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

#### Estado das fases de fechamento

- **PERF-I — APROVADA E ENCERRADA.** Integração, métricas combinadas, budgets e validação obrigatória de UX concluídas.
- **PERF-J — APROVADA.** Certificação final consolidada concluída no HEAD `c08c6efa9931bf1df95aee86db51de1b8edb1912`; candidata pronta para decisão de merge/release.
- **`main` / produção — BLOQUEADAS.** Merge/release somente depois da PERF-J e de autorização explícita do usuário.

Não houve merge consolidado da Performance R3 em `main` nem promoção de produção durante a PERF-I.

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

### Próxima sequência obrigatória

1. **Autorização explícita do usuário para release da R3.**
   - a PERF-J já está aprovada;
   - não há autorização implícita para publicar;
   - preservar o HEAD certificado até a decisão de release.

2. **`main` / produção.**
   - somente após autorização explícita;
   - fazer um único merge/release consolidado quando possível;
   - confirmar o HEAD efetivamente publicado;
   - executar smoke test curto de produção;
   - aplicar Rules/Indexes/migrações apenas se forem indispensáveis à release e após conferência específica.

3. **EMPROVEX SaaS R1.**
   - só abrir depois da R3 efetivamente publicada e do smoke de produção;
   - seguir o planejamento da seção 7.2.

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
3. O status Vercel do candidato permaneceu afetado pelo limite `build-rate-limit`; nenhum deploy de produção foi executado.

A validação manual da PERF-I não foi repetida porque, depois do HEAD funcional já aprovado, a PERF-J alterou apenas documentação e higiene de whitespace, sem mudança de comportamento. Browser E2E continuou sob demanda.

Riscos residuais permanecem os já documentados: cache estrutural cross-session pode ficar visualmente stale por até 30 s sem ser autoridade operacional; PERF-X depende do marcador READY para ativar o recorte seletivo; budgets ainda são gate explícito do Coordenador e não bloqueio automático do Application CI; benchmarks manuais de CPU/memória continuam indicativos, não laboratoriais.

## 7.2. Planejamento oficial pós-PERF-J — EMPROVEX SaaS R1

Este planejamento **só começa depois** de:
1. PERF-J concluída e aprovada;
2. autorização explícita do usuário;
3. merge consolidado da Performance R3 em `main`;
4. publicação consolidada na Vercel;
5. aplicação das Rules/Indexes/migrações indispensáveis à release, quando houver;
6. smoke test curto de produção e registro do HEAD/tag efetivamente publicado.

A publicação da R3 encerra a rodada **Performance R3**. A etapa seguinte deixa de ser uma rodada de otimização e passa a ser um novo programa de produto/comercialização, provisoriamente chamado **EMPROVEX SaaS R1**.

### Sequência lógica obrigatória do produto

> **Release R3 publicada → cobrança/trial → onboarding → segurança/legal → operação/backup/monitoramento → piloto comercial → SaaS aberto**

Essa sequência expressa os **gates de maturidade do produto**, mas não obriga desenvolvimento monolítico ou estritamente serial. Depois de congelados os contratos comuns do SaaS, frentes independentes devem ser executadas em paralelo sempre que isso reduzir tempo sem gerar conflito semântico.

### Princípio de simplicidade comercial inicial

A primeira versão comercial deve evitar construir uma plataforma financeira complexa antes de validar vendas reais.

Preferência atual:
- **Mercado Pago** como meio inicial;
- cobrança por **link de pagamento e/ou Pix**;
- confirmação e conciliação inicialmente simples/assistidas pelo administrador quando necessário;
- trial controlado pelo próprio EMPROVEX;
- estados mínimos de ciclo de vida, por exemplo: `TRIAL`, `ATIVO`, `PENDENTE/ATRASO`, `SUSPENSO`, `ENCERRADO`;
- suspensão/reativação devem ser explícitas, auditáveis e reversíveis;
- webhook, assinatura recorrente automática, split, checkout próprio e motor financeiro completo **não são pré-requisitos da primeira comercialização**; só entram depois se o uso real justificar.

A cobrança nunca deve ser acoplada de modo a apagar dados ou corromper o workspace. Bloqueio por situação comercial deve ser uma camada de autorização/estado, preservando os dados institucionais conforme a política vigente.

### Macroblocos do SaaS R1

#### SAAS-A — Fundação e contratos comuns

Antes dos workers paralelos, o Chat Coordenador deve congelar:
- conceito de cliente/assinante;
- relação entre cliente, workspace, UG e usuários;
- estados de trial/cobrança/acesso;
- quem pode ativar, suspender, reativar e encerrar;
- datas e eventos auditáveis;
- regras de retenção e preservação de dados;
- fronteira entre painel administrativo interno e experiência do cliente;
- quais dados pertencem ao núcleo EMPROVEX e quais pertencem apenas à camada comercial.

Nenhuma frente posterior pode inventar seu próprio modelo de cliente ou status comercial.

#### SAAS-B — Cobrança e trial simplificados

Objetivo:
- permitir vender sem criar um billing engine complexo.

Escopo inicial desejado:
- trial;
- data de início/fim;
- ativação manual/assistida;
- geração/registro de link de pagamento ou Pix Mercado Pago;
- registro de pagamento confirmado;
- status comercial;
- aviso de proximidade de vencimento/atraso quando pertinente;
- suspensão e reativação controladas;
- histórico mínimo/auditoria administrativa;
- possibilidade de conciliação manual enquanto a base comercial for pequena.

Automação com API/webhook do Mercado Pago é **evolução posterior opcional**, não condição para abrir o SaaS, salvo se o Coordenador demonstrar que simplifica mais do que a solução assistida.

#### SAAS-C — Onboarding e ciclo de vida do cliente

Deve cobrir:
- criação/provisionamento de workspace/UG;
- criação ou convite do primeiro usuário;
- primeiro acesso;
- definição/troca/reset de senha quando aplicável;
- associação correta a workspace/UG;
- início e término do trial;
- ativação após contratação;
- suspensão/reativação;
- encerramento;
- orientação inicial curta e compreensível;
- tratamento claro de erro de acesso, workspace inválido ou situação comercial bloqueada.

O onboarding inicial pode continuar **assistido pelo administrador**. Self-service completo não é requisito para os primeiros clientes.

#### SAAS-D — Segurança e legal

Deve fechar, sem transformar a rodada em burocracia excessiva:
- revisão final de autenticação/autorização multi-tenant;
- revisão de endpoints e ações administrativas;
- proteção de segredos/tokens;
- auditoria das dependências e vulnerabilidades relevantes;
- Política de Privacidade e Termos vigentes;
- versionamento/registro de aceite quando necessário;
- política de cancelamento/encerramento;
- retenção, exportação e exclusão de dados conforme regra definida;
- preparação para solicitações relacionadas a dados pessoais;
- revisão LGPD/jurídica quando necessária, sem o sistema se autoatribuir “conformidade legal” sem validação adequada.

Segurança crítica continua tendo precedência sobre a ordem normal das fases.

#### SAAS-E — Operação, backup e monitoramento

Deve transformar o sistema publicado em uma operação sustentável:
- backup automatizado ou rotina formalizada;
- **teste real de restauração**, não apenas existência de backup;
- registro de RPO/RTO práticos para a escala inicial;
- monitoramento de erros relevantes;
- alertas de quota/custo Firebase;
- visibilidade de reads/writes/listeners e tendências;
- monitoramento de disponibilidade e falhas de deploy;
- rotina de incidente e recuperação;
- canal/processo simples de suporte;
- procedimento para acesso, cobrança, indisponibilidade e recuperação;
- acompanhamento de custo por cliente/workspace quando tecnicamente viável sem criar telemetria excessiva.

Não migrar Firebase/Vercel/Next.js por antecipação. Migração de infraestrutura só deve ser aberta com evidência de custo, limite, disponibilidade ou operação que justifique a mudança.

#### SAAS-P — Piloto comercial controlado

Antes da abertura ampla:
- iniciar com pequeno grupo de clientes reais assistidos;
- observar onboarding, dúvidas, falhas, comportamento de cobrança e suporte;
- medir consumo real de Firestore/Vercel;
- confirmar que nenhum workspace acessa dados de outro;
- acompanhar performance em hardware/conectividade modestos;
- registrar bugs e atritos operacionais;
- executar uma **certificação de capacidade/custo voltada à meta inicial de até 100 usuários**, distinguindo usuários cadastrados, ativos e simultâneos;
- corrigir somente problemas necessários à comercialização, evitando expansão descontrolada de escopo.

O piloto deve produzir critérios objetivos de “pronto para abrir”, e não apenas uma impressão subjetiva.

#### SAAS-J — Certificação comercial final

Antes do SaaS aberto:
- confirmar cobrança/trial;
- onboarding;
- segurança/isolamento;
- legal/documentos;
- backup e restauração;
- monitoramento/alertas;
- suporte/incidente;
- custo/capacidade;
- regressão funcional do EMPROVEX;
- pendências conhecidas e aceitáveis;
- documentação do operador/admin;
- decisão explícita do usuário para abertura comercial.

#### SaaS aberto

Somente depois da certificação:
- habilitar entrada comercial de forma controlada;
- acompanhar os primeiros ciclos de cobrança;
- preservar rollback e capacidade de suspensão segura;
- manter monitoramento de custo, erros e crescimento;
- criar novas automações somente quando a operação real demonstrar necessidade.

### Modelo obrigatório de execução do SaaS R1

O próximo Chat Coordenador **não deve executar este macroplano como uma sequência monolítica em um único chat**.

Depois da publicação da R3, ele deve primeiro elaborar e versionar um plano detalhado usando o mesmo padrão aprovado na Performance R3:

> **baseline + contratos comuns → frentes independentes → ondas paralelas → handoffs → integração semântica controlada → validação integrada → certificação final**

Diretrizes obrigatórias:
- criar uma branch integradora exclusiva do programa SaaS R1, separada de `main`;
- criar um quadro vivo de frentes/status/dependências;
- cada worker recebe branch e escopo exclusivos;
- cada worker deve ler o memorial e os contratos comuns antes de editar;
- nenhum worker faz merge direto em `main`;
- nenhum worker invade outra frente para “resolver” conflito;
- sobreposições são devolvidas ao Coordenador;
- o Coordenador recebe handoffs, revisa diffs, testes, segurança, UX e métricas;
- conflitos são resolvidos semanticamente na integradora;
- validações combinadas ocorrem após cada onda relevante;
- Browser E2E permanece sob demanda conforme risco;
- release/deploy de produção continua sob autorização explícita do usuário.

Arquivos recomendados para o novo programa, a serem criados pelo próximo Coordenador quando a R3 estiver publicada:
- `docs/SAAS_R1_PLANO_MESTRE.md`;
- `docs/SAAS_R1_EXECUCAO_PARALELA.md`;
- `docs/SAAS_R1_INTEGRATION_STATUS.md`;
- `docs/SAAS_R1_COORDENADOR_HANDOFF.md`.

O Chat Coordenador deve **detalhar** nesses documentos:
- frentes e nomes;
- dependências;
- ondas paralelas;
- arquivos/áreas de propriedade;
- contratos compartilhados;
- critérios de aceite;
- testes/gates por frente;
- métricas;
- riscos;
- estratégia de integração;
- plano de rollback;
- ordem de certificação;
- definição objetiva de “SaaS aberto”.

Até esse detalhamento ser aprovado, este bloco do Memorial é a fonte canônica do **macroplanejamento pós-R3**.

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

O `docs/DEVELOPMENT_MODUS_OPERANDI.md` é norma permanente do repositório. Mudanças no método de desenvolvimento devem ser atualizadas nele e refletidas neste Memorial quando alterarem papéis, fluxo de integração, certificação ou release.


Ao concluir uma rodada relevante:
- atualizar este memorial;
- atualizar STATUS/DECISIONS/ROADMAP do domínio afetado;
- registrar baseline e resultado mensurável quando houver performance/custo;
- nunca apagar decisões antigas: marcar como superadas quando necessário;
- para Performance R3, manter este Memorial, `PERFORMANCE_R3_INTEGRATION_STATUS.md` e `PERFORMANCE_R3_COORDENADOR_HANDOFF.md` coerentes entre si;
- nunca tratar conversa isolada como fonte oficial superior ao repositório.
