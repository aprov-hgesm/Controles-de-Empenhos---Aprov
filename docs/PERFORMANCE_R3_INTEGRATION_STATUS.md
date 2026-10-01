# Performance R3 — Quadro de Integração

Última atualização: **2026-10-01**  
Responsável por atualização: **Chat Coordenador / Integrador / Avaliador**  
Branch integradora: `feat/performance-r3-commercializacao`

Este é o quadro operacional vivo da Performance R3. Ele não substitui o memorial; registra **quem está fazendo o quê e o que já pode ser integrado**.

## Estados permitidos

- `LIVRE` — ainda não atribuída/iniciada;
- `EM ANDAMENTO` — branch/chat ativo;
- `EM REVISÃO` — handoff entregue ao coordenador;
- `DEVOLVIDA` — requer correção pelo trabalhador;
- `BLOQUEADA` — depende de decisão/dependência;
- `APROVADA` — apta para integração;
- `INTEGRADA` — incorporada à branch integradora;
- `DISPENSADA` — medição demonstrou que a frente não é necessária.

## Quadro atual

| Frente | Branch prevista | Estado | Dependência | HEAD trabalhador | Observação |
| --- | --- | --- | --- | --- | --- |
| PERF-A | `perf-r3-a-core-bundle` | EM ANDAMENTO | baseline `076a233`; pausa coordenada para realinhamento | `5b92235` | Lazy root avançado; Core PASS/TS 0; não perseguir guards cruzados de PERF-E/B/C/H |
| PERF-B | `perf-r3-b-central-bundle` | INTEGRADA | baseline comum | `7b7aee1` | Bundle Central; -48,2% nas rotas principais |
| PERF-C | `perf-r3-c-outbound-demand-loading` | INTEGRADA | baseline `076a233` | `c263ce3` | Saída sob demanda integrada em `e33e260`; abertura fresca 0 reads específicos da superfície |
| PERF-D | `perf-r3-d-intake-queue` | EM ANDAMENTO | baseline `076a233` | `5a1edb2` | Intake seletivo avançado; último TS conhecido foi corrigido por tipagem explícita de snapshots; aguarda novo CI |
| PERF-E | `perf-r3-e-render-cpu` | INTEGRADA | baseline `076a233` | `149f7c3` | CPU/renderização integrada em `9d5ff58`; gates locais verdes |
| PERF-H | `perf-r3-h-metrics-budget` | INTEGRADA | baseline `076a233` | `fb5f452` | Métricas/budget integradas em `a686410`; CI bloqueante ainda não ativado |
| PERF-F | `perf-r3-f-memory-cache` | BLOQUEADA | PERF-C integrada; aguarda PERF-D | — | Metade da dependência satisfeita; iniciar somente após D estabilizar leituras restantes |
| PERF-G | `perf-r3-g-central-shell` | LIVRE | PERF-B integrada | — | Segunda onda liberada; preservar fronteiras dinâmicas da PERF-B |
| PERF-X | `perf-r3-x-hot-vs-history` | BLOQUEADA | medições A–G | — | Opcional |
| PERF-I | branch integradora | BLOQUEADA | frentes aprovadas | — | Integração final |
| PERF-J | branch integradora | BLOQUEADA | PERF-I concluída | — | Certificação |

## Coordenação especial — PERF-A

Em 2026-10-01 a PERF-A foi colocada em **pausa coordenada de realinhamento**, mantendo estado `EM ANDAMENTO`, porque o code splitting do root passou a expor falhas de guards de naturezas diferentes.

Regra aplicada:
- corrigir na PERF-A apenas regressões próprias e guards diretamente desatualizados pela mudança `app/page.tsx → OperationalWorkspace`;
- não alterar internals de outra frente para obter CI verde;
- falhas provocadas pela combinação com PERF-B/C/E/H já integradas são responsabilidade do coordenador/PERF-I;
- o HEAD `5b92235` não está aprovado nem integrado; será retomado com prompt específico e handoff novo.

Evidência atual:
- EMPROVEX Core Protection no HEAD atual: **PASS**;
- TypeScript no último Application CI: **0 erros**;
- falha atual do Application CI: guard de configuração de classes de empenho, cuja expressão textual esperada não corresponde à forma reorganizada de Notas Fiscais já afetada por PERF-E;
- não autorizar a PERF-A a modificar Notas Fiscais para resolver essa incompatibilidade cruzada.

## Registro de propriedade

Antes de uma frente mudar de `LIVRE` para `EM ANDAMENTO`, o coordenador deve registrar:
- chat/frente atribuída;
- branch;
- base SHA;
- arquivos de propriedade preferencial;
- arquivos compartilhados previstos;
- dependências;
- métrica de sucesso.

## Revisões em andamento

## Registro de integração

Para cada frente integrada, acrescentar uma entrada:

```text
PERF-X
Branch:
HEAD revisado:
Commit/merge de integração:
Métrica antes:
Métrica depois:
Testes:
Conflitos resolvidos:
Pendências:
Decisão: INTEGRADA
```



### PERF-B — Bundle da Central de Depósitos

Branch: `perf-r3-b-central-bundle`  
HEAD revisado: `7b7aee100f21b6a67f8cb8f94cfdfb3508bc0d57`  
Integração: fast-forward da branch integradora para `7b7aee1`.

Métrica antes:
- rotas principais da Central: **579 kB First Load JS**.

Métrica depois:
- rotas principais da Central: **300 kB First Load JS**;
- redução: **279 kB / aproximadamente 48,2%**;
- shared global: 103 kB → 104 kB.

Testes/gates:
- Application CI: **PASS**;
- EMPROVEX Core Protection: **PASS**;
- Production build: **PASS**;
- TypeScript final: **PASS**;
- Diff hygiene: **PASS**;
- Vercel Preview: **Ready**;
- Browser E2E: não executado, conforme política sob demanda e natureza estrutural da mudança.

Conflitos resolvidos:
- nenhum; a branch era filha direta da integradora, 1 commit à frente e 0 atrás.

Pendências:
- nenhuma da PERF-B;
- PERF-G deve preservar `WarehouseSectionContent` como fronteira de carregamento dinâmico e não reintroduzir imports estáticos das grandes superfícies.

Decisão: **INTEGRADA**.



### PERF-E — CPU e Renderização

Branch: `perf-r3-e-render-cpu`  
HEAD revisado: `149f7c3945eae7cb046175499abe5bf6868eb9bb`  
Commit de integração: `9d5ff5834da61477a1f454a452eb32b19414d23e`.

Medição:
- Empenhos: **1.732.500 → 11.250 varreduras (-99,35%)**;
- Notas Fiscais: **3.388.500 → 5.250 varreduras (-99,85%)**;
- Consulta de Itens/digitação: **54.072 → 9.072 varreduras (-83,22%)**.

Validação executada pelo usuário no clone completo:
- guard PERF-E: **PASS**;
- benchmark/checksum: **PASS**;
- `npm run typecheck`: **PASS**;
- `npm run build`: **PASS**;
- `verify:empenhos-subtabs`: **PASS**;
- `verify:invoice-ns-lifecycle`: **PASS**;
- `verify:emprovex-core-protection`: **PASS**.

Observação de build isolado da PERF-E:
- `/`: 461 kB;
- rotas da Central ainda apareciam com 579 kB porque a branch PERF-E partiu do baseline anterior à integração da PERF-B; a integração combinada preserva a PERF-B na branch R3.

Conflitos resolvidos:
- nenhum conflito de arquivo com a PERF-B;
- integração feita por merge técnico com árvore combinada, preservando ambos os históricos.

Pendências:
- validar novamente build/métricas no estado combinado durante PERF-I/PERF-J.

Decisão: **INTEGRADA**.



### PERF-C — Saída de Material sob demanda

Branch: `perf-r3-c-outbound-demand-loading`  
HEAD revisado: `c263ce36407304867d3e92d9f0af6929d61b715c`  
Commit de integração: `e33e260fdd9dbc7f01b8c60b3d59aa0c7cf1c865`.

Arquitetura antes:
- 8 consultas iniciais;
- teto bounded de até **3.000 documentos** preparados antes do primeiro barcode.

Arquitetura depois:
- abertura fresca da `WarehouseMaterialWithdrawal`: **0 consultas Firestore específicas da Saída**;
- barcode por `getWarehouseBarcodeByCode()`;
- material e saldo consultados diretamente;
- location balances e lotes filtrados pelo material corrente;
- depósitos/localizações/subposições apenas das posições realmente usadas;
- destinos e catálogo manual somente sob demanda;
- cache local limitado a 12 barcodes recentes.

Contratos preservados:
- ledger append-only;
- `warehouse_movement_v1`;
- idempotência de saída;
- saldo não negativo;
- revalidação transacional;
- FEFO;
- lotes e posições;
- isolamento workspace/UG;
- fluxo barcode → quantidade → ENTER/TAB → próximo barcode.

Testes/gates:
- EMPROVEX Core Protection: **PASS**;
- Application CI: **PASS**;
- segurança multi-tenant e externa da Central: **PASS**;
- Phase 6 localizações/transferências: **PASS**;
- Phase 7 estoque/lotes/FEFO: **PASS**;
- Phase 8 barcode/outbound + guard de demand loading: **PASS**;
- Production build: **PASS**;
- Final TypeScript: **PASS**;
- Diff hygiene: **PASS**.

Conflitos:
- nenhum conflito de arquivo com PERF-B/PERF-E;
- os três arquivos da PERF-C estavam idênticos à base original na integradora antes da integração.

Dependência:
- PERF-C satisfaz sua parte da pré-condição da PERF-F;
- PERF-F continua bloqueada até a PERF-D estabilizar as leituras de intake/estruturas compartilhadas.

Decisão: **INTEGRADA**.



### PERF-H — Métricas e Budget

Branch: `perf-r3-h-metrics-budget`  
HEAD revisado: `fb5f45296e28bafcad5489860e143b434c1ebf77`  
Commit de integração: `a6864106c779382f5919a5f1a1dcea812bd896a5`.

Entregas:
- baseline versionado em `ops/performance-r3-baseline.json`;
- budgets em `ops/performance-r3-budgets.json`;
- cenários em `ops/performance-r3-scenarios.json`;
- parser do build Next.js;
- comparação baseline × candidato;
- budget checker;
- sanitização de observações runtime;
- relatório JSON/Markdown;
- scripts npm `perf:r3:*`;
- guard próprio e testes.

Baseline oficial:
- `/`: 460 kB;
- `/adm-deposito`: 579 kB;
- `/admin`: 326 kB;
- shared: 103 kB;
- fonte: Application CI bem-sucedido da `main@22d9fe5f...`.

Política:
- runtime/Web Vitals permanecem informativos/warning;
- thresholds bloqueantes existem apenas no checker explícito;
- **não foram ligados ao Application CI**;
- nenhum Firestore read/listener/write adicional;
- `.performance-r3/` é local e ignorado pelo Git.

Validação recebida:
- parser/budget/sanitização: **3/3 PASS**;
- formato real Next 15: **PASS**;
- log GitHub Actions timestampado: **PASS**;
- baseline real: **PASS**;
- comparação JSON/Markdown: **PASS**;
- guard PERF-H: **READY**;
- syntax check dos novos `.mjs`: **PASS**.

Revisão do coordenador:
- `package.json` e `.gitignore` estavam inalterados na integradora desde a base da PERF-H;
- Application CI não foi modificado;
- sem sobreposição com PERF-B/C/E;
- nenhum `.ts/.tsx` alterado.

Pendência planejada:
- executar `perf:r3:collect`, `perf:r3:compare` e `perf:r3:budget` sobre o estado combinado durante PERF-I/PERF-J.

Decisão: **INTEGRADA**.

## Regra

Chats trabalhadores **não atualizam este quadro para se autoaprovar**. Eles entregam o handoff; o chat coordenador atualiza o estado após revisão.
