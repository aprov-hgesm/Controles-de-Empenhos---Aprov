# EMPROVEX — Memorial Oficial do Repositório

Última atualização: **2026-10-01**  
Baseline de produção consultada: `main@22d9fe5f86e2cfbb247eb21bae28e4b2c6cb2a2f`

Este documento é a **porta de entrada canônica para continuidade do EMPROVEX como produto**. Ele resume o estado vigente e aponta para os documentos históricos/especializados. O histórico detalhado não deve ser apagado; quando houver divergência, a implementação real em `main` prevalece.

## 1. Fontes da verdade

Ordem de consulta para um novo trabalho:

1. `main` — estado efetivo do código em produção;
2. este memorial — estado consolidado e prioridades atuais;
3. documentação especializada do domínio alterado;
4. decisões arquiteturais registradas;
5. histórico de fases/branches/PRs apenas como contexto.

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

Estado operacional consolidado:
- núcleo de Empenhos, Itens, Notas Fiscais, Comissão/Tesouraria, Cronogramas/Entregas, Avisos e Relatórios em produção;
- cadastro de empenho por PDF SIAFI disponível, preservando também as demais formas de cadastro existentes;
- edição segura de número/descritivo de item no detalhamento do empenho e antes da geração do cronograma;
- home operacional com snapshot agregado para reduzir leituras brutas;
- histórico de invoices em Relatórios consultado sob demanda/paginado;
- controle de sessão externo baseado em workspace/UG e lease;
- telemetria estimada de consumo por workspace + métricas globais separadas;
- Central de Depósitos integrada ao EMPROVEX e disponível para contextos de setor autenticados/autorizados, com isolamento por workspace/UG.

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
- refatoração estrutural concluída em 2026-10-01 sem mudança de contratos operacionais.

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

Objetivo:
> tornar o EMPROVEX perceptivelmente mais rápido e leve para comercialização sem reduzir qualidade visual, animações, transições ou identidade premium.

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

- **PERF-F — Cache curto em memória**, após C/D estabilizarem as leituras realmente necessárias;
- **PERF-G — Shell/Layout persistente da Central**, após B congelar a fronteira de carregamento;
- **PERF-X — Dados quentes vs histórico**, opcional e somente se medições justificarem.

### Fechamento

- **PERF-I — Integração Controlada**;
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


### Estado consolidado da primeira onda em 2026-10-01

Situação já incorporada à branch integradora:
- **PERF-B — Bundle da Central:** INTEGRADA; rotas principais da Central reduziram de 579 kB para 300 kB de First Load JS (~48,2%);
- **PERF-C — Saída sob demanda:** INTEGRADA; abertura fresca da superfície deixou de antecipar as 8 consultas específicas e o teto bounded de até 3.000 documentos;
- **PERF-E — CPU e Renderização:** INTEGRADA; grandes reduções estruturais de varreduras em Empenhos, Notas Fiscais e Consulta de Itens;
- **PERF-H — Métricas e Budget:** INTEGRADA; baseline, parser, comparação e budgets estão disponíveis, ainda sem transformar budgets experimentais em gate automático do Application CI.

Frentes ainda abertas:
- **PERF-A — Bundle do EMPROVEX principal:** INTEGRADA; a rota `/` reduziu de 460 kB para 333 kB de First Load JS (-27,61%), preservando shell/Home/auth e movendo as grandes superfícies operacionais para boundaries lazy;

Build combinado após PERF-A + PERF-B/C/E/H:
- `/`: **333 kB** First Load JS;
- principais rotas da Central: **300 kB**;
- `/admin`: **327 kB**;
- shared global: **104 kB**.

A incompatibilidade cruzada encontrada no guard de classes de empenho foi resolvida pelo coordenador alterando apenas a expectativa estrutural do guard para a derivação memoizada já vigente em Notas Fiscais; nenhuma regra funcional foi alterada.

- **PERF-D — Intake seletivo:** INTEGRADA; o caminho normal `A tratar` passou a usar índice derivado mínimo + NFs novas desde watermark + candidatos ativos, enquanto histórico/reconciliação ficam sob demanda. Cenários sintéticos registraram ~97,26% a ~99,69% de redução de documentos no steady-state para massas históricas grandes, preservando ausência de intake como PENDING e demais contratos.

A branch integradora, e não as branches trabalhadoras antigas, passa a ser a referência para compatibilidade cruzada entre frentes.

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

A dependência da PERF-F está satisfeita; PERF-F pode iniciar a partir da branch integradora atual.

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

## 8. Riscos/pendências que não devem ser esquecidos

- crescimento histórico das coleções operacionais exige consultas progressivamente mais seletivas;
- a fila logística ainda possui pontos de leitura ampla que devem ser eliminados na R3;
- segurança e dependências continuam como linha separada de hardening;
- falha crítica real de segurança sempre interrompe a ordem normal de prioridades;
- documentação antiga pode descrever estados históricos como founder-only ou E2E obrigatório; essas afirmações não representam mais a política vigente quando conflitarem com este memorial e a `main`.

## 9. Regra de atualização

Ao concluir uma rodada relevante:
- atualizar este memorial;
- atualizar STATUS/DECISIONS/ROADMAP do domínio afetado;
- registrar baseline e resultado mensurável quando houver performance/custo;
- nunca apagar decisões antigas: marcar como superadas quando necessário;
- nunca tratar conversa isolada como fonte oficial superior ao repositório.
