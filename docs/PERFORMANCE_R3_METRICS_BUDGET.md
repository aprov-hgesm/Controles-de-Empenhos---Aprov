# Performance R3 — Métricas e Budget

Frente: **PERF-H**  
Branch de trabalho: `perf-r3-h-metrics-budget`  
Base: `feat/performance-r3-commercializacao@076a233cf250c95882e78498e89dd2a44d034f74`  
Baseline de abertura: `main@22d9fe5f86e2cfbb247eb21bae28e4b2c6cb2a2f`

## Objetivo

Criar uma base objetiva, reproduzível e barata para comparar a Performance R3 antes/depois, sem transformar métricas ruidosas em gates frágeis e sem criar telemetria de produção que aumente o custo de Firestore.

A v1 mede diretamente o que é estável no build e define um formato estrito para observações runtime. O princípio é: métricas estáveis podem virar guard; métricas dependentes de máquina, dados, autenticação ou interação começam informativas/warning até demonstrarem repetibilidade suficiente.

## Baseline oficial

O baseline versionado fica em `ops/performance-r3-baseline.json`: `/` = **460 kB First Load JS**, `/adm-deposito` = **579 kB**, `/admin` = **326 kB**, JS compartilhado = **103 kB**. A família de rotas da Central foi observada em **579 kB** na abertura.

Web Vitals, tempo até superfície operacional e documentos por cenário não são inventados: como não existia captura reproduzível no baseline de abertura, permanecem `null` até medição local estável ou handoff objetivo.

## Ferramentas

### Coleta do build

Execute `npm run perf:r3:collect`. O comando executa `npm run build` com telemetria do Next desativada para a execução, preserva o log em `.performance-r3/next-build.log` e gera `.performance-r3/build-metrics.json` com rota, tamanho, First Load JS, JS compartilhado e chunks do resumo.

Também é possível analisar um log salvo sem novo build: `node scripts/performance-r3-build-metrics.mjs --input caminho/do/build.log`.

### Budget

Execute `npm run perf:r3:budget`. A política v1 em `ops/performance-r3-budgets.json` classifica: rota com aumento simultâneo de pelo menos 10% e 25 kB como **warning**; shared JS com pelo menos 15% e 20 kB como warning; rota com pelo menos 40% e 150 kB como **bloqueante**; shared JS com pelo menos 50% e 75 kB como bloqueante. Métrica ausente é warning, não bloqueio.

O bloqueio existe no checker, mas **não está ligado ao Application CI** nesta versão. A adoção no CI deve esperar evidência de baixa taxa de falso positivo durante as integrações A–E.

### Comparação antes/depois

Execute `npm run perf:r3:compare`. O comando gera `.performance-r3/comparison.json` e `.performance-r3/comparison.md`, permitindo ao coordenador comparar qualquer branch candidata contra o mesmo baseline.

### Observações runtime sanitizadas

Os cenários canônicos ficam em `ops/performance-r3-scenarios.json`. Para sanitizar um arquivo local: `npm run perf:r3:runtime:sanitize -- --input caminho/observacoes.json`.

Campos permitidos: `scenarioId`, `sampleCount`, `operationalReadyMs`, `lcpMs`, `inpMs`, `cls` e `documentsEstimated`. Campos livres extras são descartados, preservando somente **dados agregados**.

## Web Vitals

LCP, INP e CLS são observações locais e recebem apenas warning na v1: LCP acima de 2500 ms, INP acima de 200 ms e CLS acima de 0,1. Não são bloqueantes porque variam com hardware, massa de dados, cache, autenticação e interação. Para comparação, usar o mesmo ambiente e múltiplas amostras.

## Tempo até superfície operacional

`operationalReadyMs` é informativo até existir marcador estável por superfície. A PERF-H não altera views apenas para criar marcador artificial. Frentes A–E podem fornecê-lo no handoff quando houver ponto inequívoco de prontidão.

## Documentos carregados

`documentsEstimated` representa quantidade estimada de documentos necessários ao cenário, não cobrança oficial do Firestore. Preferir contrato/query limitada da frente, instrumentação estimada já existente ou observação local controlada. Nunca criar nova consulta de produção apenas para medir.

A telemetria existente continua separando estimativa por UG de Cloud Monitoring global real. A PERF-H não cria fonte concorrente.

## Privacidade e custo

A medição é **sem Firestore adicional**: nenhum novo listener, nenhum `getDoc/getDocs` para medir performance, nenhuma gravação de métricas em produção, nenhum conteúdo/número de NF, fornecedor/CNPJ/CPF, nome/e-mail/UID do operador, workspace/UG ou barcode/código operacional.

Os artefatos gerados ficam em `.performance-r3/`, ignorado pelo Git, e contêm somente dados agregados de performance.

## Gates da própria frente

Executar: `npm run test:performance-r3-metrics`, `npm run verify:performance-r3-metrics`, `npm run perf:r3:collect`, `npm run perf:r3:budget` e `npm run perf:r3:compare`.

A frente adiciona JavaScript `.mjs`, JSON, documentação e scripts de package; não adiciona TypeScript. O build de produção real é executado pelo coletor.

## Uso pelo coordenador

Para cada handoff A–E: fazer checkout da candidata/integrada, instalar dependências quando necessário, executar coleta, budget e comparação, anexar runtime sanitizado somente quando houver medição estável e registrar ganhos/regressões. Ausência de uma métrica ruidosa não invalida evidência estável em outro eixo; redução de bundle não compensa regressão funcional, de segurança ou de custo.
