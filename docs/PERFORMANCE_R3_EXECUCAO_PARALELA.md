# Performance R3 — Execução Paralela e Coordenação

Data da decisão: **2026-10-01**  
Programa: **Performance R3 — Comercialização**  
Branch integradora: `feat/performance-r3-commercializacao`

Este documento define **como vários chats podem desenvolver melhorias de performance em paralelo sem prejuízo ao EMPROVEX**.

Ele deve ser lido junto com:
- `docs/EMPROVEX_MEMORIAL_OFICIAL.md`;
- `docs/PERFORMANCE_R3_COMERCIALIZACAO.md`;
- `docs/TESTING_POLICY.md`;
- `docs/DEVELOPMENT_CI_WORKFLOW.md`;
- `docs/PERFORMANCE_R3_INTEGRATION_STATUS.md` — quadro vivo mantido pelo coordenador;
- documentação específica da Central quando a frente tocar `adm-deposito`.

---

## 1. Princípio organizacional

A Performance R3 deixa de ser tratada como uma sequência monolítica.

O modelo oficial passa a ser:

> **baseline e contratos comuns → frentes independentes em paralelo → integração controlada → certificação final**

A justificativa é técnica e operacional:
- bundle, consultas, renderização, intake, saída e métricas são problemas diferentes;
- frentes independentes não precisam aguardar umas às outras;
- cada otimização pode ser medida isoladamente;
- regressão em uma frente não invalida automaticamente as demais;
- conflitos de código ficam concentrados na integração, não espalhados pelos chats;
- o usuário pode manter vários chats especializados e um chat coordenador permanente.

O paralelismo **não autoriza sobreposição descontrolada de escopo**.

Cada chat trabalhador recebe uma fronteira clara. Quando uma necessidade ultrapassar essa fronteira, deve registrar dependência no handoff em vez de implementar silenciosamente a área de outro chat.

---

## 2. Papéis oficiais

### 2.1 Chat Coordenador / Integrador / Avaliador

Um chat deve permanecer responsável pelo conjunto da Performance R3.

Esse chat é equivalente ao papel de **coordenação técnica do programa**.

Responsabilidades:
- consultar a `main` real e a branch integradora;
- manter este memorial e o estado consolidado atualizados;
- congelar/revalidar baseline comum;
- criar ou orientar a criação das branches das frentes;
- garantir que cada frente tenha escopo exclusivo;
- detectar sobreposição de arquivos/contratos antes de ocorrer conflito;
- receber os handoffs dos chats trabalhadores;
- revisar diff, testes, métricas e riscos de cada frente;
- classificar cada frente como `APROVADA`, `APROVADA COM PENDÊNCIA`, `DEVOLVIDA` ou `BLOQUEADA`;
- integrar somente frentes aprovadas na branch integradora;
- resolver conflitos semanticamente, nunca por escolha mecânica de "ours/theirs";
- executar regressão seletiva após integrações relevantes;
- medir efeitos combinados e detectar regressões cruzadas;
- decidir a ordem das frentes dependentes da segunda onda;
- conduzir PERF-I — Integração;
- conduzir PERF-J — Certificação;
- preparar o único merge/release consolidado para `main` quando autorizado pelo usuário.

O chat coordenador **não deve competir com os chats trabalhadores**:
- não implementar silenciosamente a mesma frente em paralelo;
- não reescrever uma solução aprovada apenas por preferência estética/técnica;
- não ampliar escopo durante a integração;
- limitar correções próprias a conflitos, glue code, regressões de integração e ajustes necessários para compatibilidade.

Se uma correção de integração se transformar em nova capacidade relevante, ela deve receber subfrente/branch própria.

### 2.2 Chats Trabalhadores

Cada chat trabalhador:
- possui uma única frente;
- usa branch própria;
- lê o memorial antes de alterar código;
- preserva os contratos globais;
- não faz merge em `main`;
- não faz deploy de produção;
- não integra outras frentes por conta própria;
- entrega código + testes + métricas + handoff.

### 2.3 Usuário / Fundador

O usuário continua sendo a autoridade final para:
- prioridades de produto;
- aceitação visual/operacional;
- decisão de release;
- mudanças de escopo;
- decisões arquiteturais que alterem contratos congelados.

---

## 3. Topologia oficial de branches

A branch:

`feat/performance-r3-commercializacao`

é a **branch integradora do programa**.

As frentes independentes devem nascer dela, e não diretamente de branches umas das outras, salvo dependência formal autorizada pelo coordenador.

Branches recomendadas:

- `perf-r3-a-core-bundle`
- `perf-r3-b-central-bundle`
- `perf-r3-c-outbound-demand-loading`
- `perf-r3-d-intake-queue`
- `perf-r3-e-render-cpu`
- `perf-r3-h-metrics-budget`

Segunda onda:
- `perf-r3-f-memory-cache`
- `perf-r3-g-central-shell`
- `perf-r3-x-hot-vs-history` — somente se medições justificarem R3.8.

Fluxo:

```text
main
  │
  └── feat/performance-r3-commercializacao   ← integração/documentação
        │
        ├── PERF-A
        ├── PERF-B
        ├── PERF-C
        ├── PERF-D
        ├── PERF-E
        └── PERF-H
              │
              ▼
        integração da 1ª onda
              │
        ├── PERF-F
        └── PERF-G
              │
              ▼
            PERF-I
        integração final
              │
              ▼
            PERF-J
         certificação
              │
              ▼
             main
```

Nenhuma branch de trabalhador deve ser mergeada diretamente em `main`.

---

## 4. Baseline comum

Baseline funcional original da R3:
`main@22d9fe5f86e2cfbb247eb21bae28e4b2c6cb2a2f`

Baseline de build observado:
- `/`: 460 kB First Load JS;
- `/adm-deposito`: 579 kB;
- várias rotas operacionais da Central: 579 kB;
- `/admin`: 326 kB;
- shared JS: 103 kB.

O coordenador pode atualizar o baseline de integração conforme frentes aprovadas forem incorporadas, mas:
- o baseline **original** nunca deve ser apagado;
- cada frente mede o que ela alterou em relação ao ponto de partida que recebeu;
- PERF-J compara a integração final também contra o baseline original de produção.

---

## 5. Contratos globais imutáveis

Todas as frentes devem preservar:

### Produto e visual
- identidade visual aprovada;
- animações e transições;
- composição premium;
- labels e ergonomia já aprovados;
- nenhuma "otimização" baseada em empobrecer a interface.

### Dados e negócio
- material canônico;
- ledger append-only;
- saldos como projeções oficiais;
- idempotência;
- FEFO como regra/recomendação já definida;
- NF/Empenho/Cronograma como autoridades de seus domínios;
- nenhuma nova fonte paralela de verdade;
- nenhuma mudança de significado de quantidade, saldo, lote, intake ou movimento sem decisão explícita.

### Segurança
- isolamento por workspace/UG;
- autenticação e provider enforcement;
- fail-closed;
- sessão/lease;
- segurança de usuário externo;
- Core Protection;
- Rules não podem ser relaxadas para ganhar velocidade.

### Infraestrutura
- permanecer em Next.js/Firebase/Vercel nesta rodada;
- não migrar banco/hospedagem;
- não introduzir dependência pesada sem justificativa mensurável;
- não persistir cache operacional sensível em `localStorage` como atalho.

### Testes
- TypeScript;
- build;
- testes/guards afetados;
- segurança quando houver mudança de dados/acesso;
- Core Protection;
- Browser E2E sob demanda conforme risco.

---

## 6. Primeira onda — frentes realmente paralelas

### PERF-A — Bundle do EMPROVEX principal

Responsabilidade:
- code splitting/lazy loading das grandes superfícies do root operacional;
- reduzir código inicial sem mudar regra de negócio.

Fronteira preferencial:
- `app/page.tsx`;
- wrappers/loaders estritamente necessários;
- imports do shell operacional.

Não deve:
- refatorar lógica interna de Empenhos/NF/Cronogramas;
- alterar consultas Firestore;
- redesenhar telas.

Resultado esperado:
- redução do First Load JS de `/`.

### PERF-B — Bundle da Central de Depósitos

Responsabilidade:
- code splitting por rota e subaba da Central;
- carregar somente a superfície ativa.

Fronteira preferencial:
- `WarehouseSectionContent`;
- roteamento/carregamento de superfícies;
- wrappers de subtabs.

Não deve:
- alterar semântica de estoque/intake/outbound;
- implementar cache;
- alterar regras de acesso.

Resultado esperado:
- redução dos 579 kB das rotas da Central.

### PERF-C — Saída de Material sob demanda

Responsabilidade:
- reduzir dados antecipados da Saída;
- barcode direto;
- lotes/posições do material atual;
- cache local pequeno apenas quando necessário para operação corrente.

Fronteira:
- Saída de Material;
- repositories diretamente necessários a barcode/lote/posição.

Não deve:
- alterar ledger;
- alterar algoritmo de baixa oficial;
- alterar idempotência;
- alterar fluxo visual barcode → quantidade → próximo.

Resultado esperado:
- menos documentos lidos e menor latência operacional.

### PERF-D — Fila leve de Recebimento / Intake

Responsabilidade:
- eliminar scans integrais crescentes;
- separar operação normal de auditoria/reconciliação;
- tornar limites/paginação reais.

Fronteira:
- intake queue;
- consultas necessárias à formação da fila;
- índices somente se indispensáveis e formalmente registrados.

Não deve:
- alterar significado do intake;
- alterar NF canônica;
- reescrever ledger;
- absorver Saída de Material.

Resultado esperado:
- custo proporcional às pendências relevantes, não ao histórico completo.

### PERF-E — CPU e Renderização

Responsabilidade:
- reduzir recomputação e trabalho de DOM nas grandes listas;
- criar índices em memória;
- memoização útil;
- busca diferida;
- avaliar `content-visibility`.

Fronteira:
- internals das grandes views já existentes.

Não deve:
- mudar layout;
- mudar filtros disponíveis;
- esconder dados;
- alterar regras de ordenação/financeiras.

Resultado esperado:
- digitação, filtros, scroll e renderização mais responsivos.

### PERF-H — Métricas e Budget

Responsabilidade:
- tornar performance mensurável;
- scripts/baselines/budgets;
- Web Vitals/tempos de superfície quando apropriado;
- medição de reads do cenário.

Fronteira preferencial:
- scripts;
- telemetria leve;
- docs/ops;
- CI somente com thresholds robustos.

Não deve:
- transformar métricas experimentais em gate instável;
- coletar conteúdo sensível;
- aumentar significativamente consumo Firestore.

Resultado esperado:
- antes/depois comprovável e proteção contra regressão.

---

## 7. Segunda onda — frentes independentes, mas dependentes do resultado da primeira

### PERF-F — Cache curto em memória

Iniciar após PERF-C/PERF-D estarem suficientemente estáveis.

Responsabilidade:
- cache de depósitos/localizações/destinos/configuração estável;
- segregação por workspace;
- TTL e invalidação explícita.

Motivo para não iniciar junto de C/D:
- C e D podem redefinir quais leituras realmente permanecem necessárias;
- antecipar cache pode mascarar consulta ruim em vez de removê-la.

### PERF-G — Shell/Layout persistente da Central

Iniciar após PERF-B estar integrado ou com contrato de carregamento congelado.

Responsabilidade:
- manter shell/auth/workspace/header/sidebar entre rotas quando seguro;
- remover reloads completos desnecessários;
- preservar fail-closed.

Motivo:
- PERF-B e PERF-G tocam a mesma fronteira de montagem/roteamento e seriam candidatos a conflito se desenvolvidos simultaneamente sem coordenação.

### PERF-X — Dados quentes vs histórico

É opcional.

Só iniciar se as medições após A–G mostrarem que listener/coleções históricas continuam sendo gargalo relevante.

---

## 8. Árvore de dependências

```text
PERF-0 baseline/contratos
   ├── A ───────────────┐
   ├── B ───────► G ───┤
   ├── C ───────► F ───┤
   ├── D ───────► F ───┤
   ├── E ───────────────┤
   └── H ───────────────┤
                        ▼
                      PERF-I
                        ▼
                      PERF-J
```

A, B, C, D, E e H são a primeira onda paralela.

F e G são frentes separadas, mas deliberadamente iniciadas depois das dependências indicadas.

---

## 9. Regra de propriedade de arquivos

Antes de começar, cada chat trabalhador deve registrar no handoff inicial:
- arquivos que pretende alterar;
- módulos que considera somente leitura;
- contratos que reutilizará;
- dependências esperadas.

Se dois chats precisarem editar o mesmo arquivo estrutural:
1. o coordenador decide qual frente é proprietária;
2. a outra frente cria adapter/helper em arquivo próprio ou registra dependência;
3. se não houver separação segura, as frentes deixam de ser paralelas naquele ponto.

Não usar edição concorrente do mesmo bloco de código como estratégia normal.

---

## 10. Protocolo de início do Chat Coordenador

O chat coordenador deve ser aberto com a seguinte missão conceitual:

```text
Você é o Chat Coordenador / Integrador / Avaliador da Performance R3 do EMPROVEX.

Repositório:
aprov-hgesm/Controles-de-Empenhos---Aprov

Branch integradora:
feat/performance-r3-commercializacao

Sua responsabilidade não é desenvolver uma frente especializada em concorrência com os demais chats.
Sua responsabilidade é governar o programa inteiro.

Antes de qualquer ação:
1. leia docs/EMPROVEX_MEMORIAL_OFICIAL.md;
2. leia docs/PERFORMANCE_R3_COMERCIALIZACAO.md;
3. leia docs/PERFORMANCE_R3_EXECUCAO_PARALELA.md;
4. leia docs/PERFORMANCE_R3_INTEGRATION_STATUS.md;
5. leia docs/TESTING_POLICY.md e docs/DEVELOPMENT_CI_WORKFLOW.md;
6. consulte main e a branch integradora reais;
7. confirme HEADs e divergências;
8. mantenha o quadro de integração atualizado.

Funções:
- atribuir e delimitar frentes;
- evitar sobreposição de arquivos/contratos;
- receber handoffs;
- revisar diff, métricas e testes;
- aprovar, devolver ou bloquear frentes;
- integrar somente trabalho aprovado;
- resolver conflitos semanticamente;
- rebaselinear o conjunto após integrações;
- conduzir PERF-I e PERF-J;
- preservar visual, segurança e contratos;
- não fazer merge/deploy em main sem autorização explícita do usuário.

Ao receber resultado de um trabalhador, nunca assumir que 'deu certo' apenas porque houve commit.
Verifique evidência objetiva.
```

### Estado mínimo que o coordenador deve manter

Para cada frente:
- branch;
- base SHA;
- HEAD atual;
- status;
- arquivos reservados;
- dependências;
- métricas antes/depois;
- gates executados;
- riscos/pêndencias;
- situação de integração.

Esse estado deve ser materializado em `docs/PERFORMANCE_R3_INTEGRATION_STATUS.md`.

### Regra de neutralidade técnica do coordenador

O coordenador avalia soluções contra os objetivos e contratos acordados, não contra preferência pessoal. Quando duas soluções forem válidas, deve privilegiar:
1. menor risco;
2. menor superfície alterada;
3. melhor ganho mensurável;
4. melhor compatibilidade com o restante das frentes;
5. menor custo operacional futuro.

Se uma frente estiver tecnicamente boa, mas conflitar com outra melhor já aprovada, o coordenador deve pedir adaptação em vez de integrar ambas de forma contraditória.

---
## 11. Protocolo obrigatório de início de um chat trabalhador

Mensagem-base conceitual:

```text
Você é o chat trabalhador da frente PERF-[X] da Performance R3 do EMPROVEX.

Repositório:
aprov-hgesm/Controles-de-Empenhos---Aprov

Branch integradora:
feat/performance-r3-commercializacao

Sua branch exclusiva:
[BRANCH]

Antes de alterar código:
1. leia docs/EMPROVEX_MEMORIAL_OFICIAL.md;
2. leia docs/PERFORMANCE_R3_COMERCIALIZACAO.md;
3. leia docs/PERFORMANCE_R3_EXECUCAO_PARALELA.md;
4. leia docs/TESTING_POLICY.md e docs/DEVELOPMENT_CI_WORKFLOW.md;
5. consulte a branch-base real e confirme o HEAD;
6. leia a documentação especializada dos arquivos que tocar;
7. declare os arquivos/fronteiras que pretende alterar;
8. preserve os contratos globais e não implemente escopo de outra frente.

Execute somente PERF-[X].

Ao concluir, não faça merge em main e não publique produção.
Entregue handoff completo ao chat coordenador.
```

---

## 12. Handoff obrigatório de um chat trabalhador

Todo trabalhador deve entregar:

```text
PERF-[X] — HANDOFF

Branch:
HEAD:
Base utilizada:

Status:
- APTO PARA REVISÃO / PARCIAL / BLOQUEADO

Objetivo executado:
- ...

Arquivos alterados:
- ...

Contratos preservados:
- ...

Mudanças funcionais intencionais:
- nenhuma / listar

Métrica antes:
- ...

Métrica depois:
- ...

Testes executados:
- comando → resultado

Gates não executados:
- ... + motivo

Riscos:
- ...

Dependências para outra frente:
- ...

Conflitos esperados na integração:
- ...

Documentação atualizada:
- ...

Não realizado:
- merge main
- deploy produção
- trabalho de outras frentes
```

Sem handoff suficiente, o coordenador não deve integrar a frente.

---

## 13. Checklist do chat coordenador ao receber uma frente

Para cada handoff:

1. confirmar branch e HEAD;
2. comparar com a base declarada;
3. verificar arquivos fora do escopo;
4. procurar quebra de contratos globais;
5. confirmar que a melhoria reduz trabalho real e não apenas desloca loading;
6. revisar métricas antes/depois;
7. validar testes;
8. checar segurança/Rules quando aplicável;
9. classificar dependências;
10. verificar conflito com frentes ainda abertas;
11. decidir:
   - `APROVADA`;
   - `APROVADA COM PENDÊNCIA`;
   - `DEVOLVIDA`;
   - `BLOQUEADA`.

Aprovação técnica de uma frente não significa autorização para produção.

---

## 14. Ordem recomendada de integração

A ordem exata é responsabilidade do coordenador, mas o padrão recomendado é:

1. PERF-H, quando seus scripts forem puramente observacionais;
2. PERF-A;
3. PERF-B;
4. PERF-E;
5. PERF-C;
6. PERF-D;
7. rebaseline integrado;
8. PERF-F;
9. PERF-G;
10. PERF-X somente se necessário;
11. PERF-I;
12. PERF-J.

O coordenador pode mudar a ordem para reduzir conflitos, mas deve registrar a razão.

---

## 15. PERF-I — Integração Controlada

PERF-I não é uma frente de feature.

Objetivo:
- unir as melhorias aprovadas;
- resolver interações cruzadas;
- remover duplicações criadas independentemente;
- garantir que otimizações se somem em vez de se anularem;
- corrigir glue code estritamente necessário.

Verificações:
- navegação;
- auth/workspace;
- isolamento;
- NF/Empenho/Cronograma;
- intake;
- estoque/ledger;
- Saída;
- listas/filtros;
- métricas;
- bundle final.

Não aproveitar PERF-I para adicionar nova funcionalidade.

---

## 16. PERF-J — Certificação Final

Somente depois da integração.

Obrigatório:
- build de produção;
- TypeScript;
- testes de domínio;
- guards estruturais;
- segurança/isolamento aplicável;
- Core Protection;
- diff hygiene;
- comparação de bundle;
- comparação de reads/tempo nos cenários definidos;
- validação manual do usuário nas jornadas relevantes.

Browser E2E:
- executar apenas onde risco/interação justificar;
- não voltar a ser gate permanente apenas por ser a certificação final.

Saída da PERF-J:
- relatório antes/depois;
- pendências conhecidas;
- decisão explícita do usuário sobre merge/release;
- um único release consolidado quando possível.

---

## 17. Regras de conflito e integração

Nunca:
- usar `ours` ou `theirs` globalmente sem análise;
- resolver conflito apagando otimização de outra frente;
- alterar contrato de domínio apenas para facilitar merge;
- enfraquecer guard/teste para obter verde;
- adicionar compatibilidade temporária sem registrar remoção futura.

Preferir:
- adapters pequenos;
- helpers compartilhados;
- interfaces estáveis;
- rebases/merges controlados;
- conflitos resolvidos pelo coordenador com base no objetivo de cada frente.

---

## 18. Regra de interrupção

Qualquer chat deve interromper sua frente e reportar ao coordenador se descobrir:
- vulnerabilidade crítica;
- risco de perda/corrupção de dados;
- quebra de isolamento multi-tenant;
- necessidade real de alterar ledger/contrato canônico;
- dependência circular entre frentes;
- baseline incorreto de forma que invalide a métrica.

O coordenador decide se:
- corrige antes de continuar;
- abre subfrente;
- replaneja dependências;
- bloqueia integração.

---

## 19. Critério de sucesso do modelo paralelo

O modelo é considerado bem-sucedido quando:
- frentes podem ser desenvolvidas isoladamente;
- cada ganho é mensurável;
- branches não alteram escopo umas das outras;
- integração não exige reescrever frentes inteiras;
- contratos de produto/segurança permanecem intactos;
- o sistema integrado fica mais leve sem perda visual;
- existe um único estado consolidado mantido pelo chat coordenador.

A independência das frentes é uma **regra arquitetural de execução**, não apenas conveniência de conversa.
