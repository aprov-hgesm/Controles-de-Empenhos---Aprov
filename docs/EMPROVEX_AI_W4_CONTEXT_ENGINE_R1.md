# EMPROVEX AI W4 R1 — Context Engine isolado

**Base:** main `657a2b4f49e4a43383fda51fffdfece88b94c62c`.
**Código:** `lib/emprovex-ai/context/`. **PR:** #427 DRAFT.

## Limite de responsabilidade
O W4 interpreta texto em pt-BR, sem I/O. Não lê Firestore, não calcula saldo, não altera registros e não autentica usuários.
A aplicação deverá injetar `scope` exclusivamente de uma sessão autenticada no servidor; jamais enviar `scope` do cliente.
`previous` é estado estruturado, com até quatro referências, TTL de 10 minutos e isolamento de sessão/workspace.
Mesmo com continuidade, o W3 revalida acesso e tenant a cada consulta.

## Entrada e saída
`interpret({message,now?,scope?,previous?})` retorna domínio, rota, intenção,
10 dimensões, entidades candidatas, métricas e, somente no roteamento determinístico,
`query: {version:'emprovex.ai.query.v1',intent,params}`.
Não existem chamadas a Qwen ou Firestore. `MODEL_ELIGIBLE` produz apenas uma proposta limitada;
o futuro W5 deve revalidar a resposta como entrada não confiável contra W4 e W3.

Rotas: `DETERMINISTIC`, `CLARIFY`, `MODEL_ELIGIBLE`, `UNSUPPORTED`,
`REJECT_MUTATION`, `OUT_OF_SCOPE`. O motor reconhece 26 famílias e oito intenções P0.
Intenções de emissão fiscal, NF por material e período, fornecedor por NE, materiais
por depósito, vencimentos e movimentações são explicitamente indisponíveis.

## Compatibilidade W3
Enquanto a PR #425 não estiver mesclada, `adapter.ts` reflete o schema P0
do W3 sem importar arquivos ausentes da main. O check isolado faz checkout da branch
`feat/emprovex-ai-r0-w3-query-core` em `.w3-reference` e
executa `parseAiQuery` real sobre exemplos W4.
Uma futura integração exigirá verificação exaustiva e deve preferir delegar à
validação definitiva de `lib/emprovex-ai/contracts.ts` após merge autorizado.

## Avaliação
Corpus JSON estático, versão 520 casos: 120 canônicos, 100 digitação, 80 informais,
70 temporais/contextuais, 50 ambiguidades, 100 fora do domínio/adversariais;
360 dev e 160 holdout. A métrica de acerto exige simultaneamente domínio,
roteamento, intenção e os parâmetros esperados declarados; não conta esclarecimento
como consulta atendida. As variações partem de 52 estruturas base e, portanto,
os resultados devem ser complementados por casos reais anonimizados antes da produção.
Os 160 holdouts foram versionados antes do primeiro relatório; correções gerais de
algoritmo não devem ser calibradas individualmente no holdout.

### Comandos
```sh
npm ci
npm run typecheck
npx --no-install tsc lib/emprovex-ai/context/index.ts --module commonjs --moduleResolution node --target es2022 --skipLibCheck --esModuleInterop --outDir .w4-dist
cp .w4-dist/index.js .w4-dist/index.cjs
W4_REQUIRE_W3=1 node --test scripts/emprovex-ai-w4.test.mjs
node scripts/emprovex-ai-w4-evaluate.mjs
```
W3 checkout adicional necessário ao teste de paridade, conforme workflow.

## Integração futura
O W5 deve receber apenas catálogo resumido, texto sanitizado e referências
estruturadas autorizadas, com limite de saída 128 tokens e JSON fechado;
não autorizar decisões de negócio, cálculos, dados do workspace ou mutações pelo modelo.
Nenhuma regra experimental Oracle R6/R7 foi promovida a regra operacional.

**Gates:** CI real, análise independente de segurança e integração W3/W4.
Não realizar merge, Rules, deploy ou exposição de endpoint nesta fase.
