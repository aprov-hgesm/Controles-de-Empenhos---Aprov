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
| PERF-A | `perf-r3-a-core-bundle` | EM ANDAMENTO | baseline comum | `640377a` | Bundle EMPROVEX; CI exige ajuste legítimo de guard SAG |
| PERF-B | `perf-r3-b-central-bundle` | INTEGRADA | baseline comum | `7b7aee1` | Bundle Central; -48,2% nas rotas principais |
| PERF-C | `perf-r3-c-outbound-demand-loading` | EM ANDAMENTO | baseline comum | `c263ce3` | Saída sob demanda; aguardando fechamento dos gates |
| PERF-D | `perf-r3-d-intake-queue` | EM ANDAMENTO | baseline comum | — | Intake seletivo |
| PERF-E | `perf-r3-e-render-cpu` | EM REVISÃO | baseline `076a233`; hoje 1 ahead / 2 behind da integradora | `149f7c3` | CPU/renderização; benchmark + guard próprios PASS; TypeScript/build/Core pendentes |
| PERF-H | `perf-r3-h-metrics-budget` | EM ANDAMENTO | baseline comum | — | Métricas/budget |
| PERF-F | `perf-r3-f-memory-cache` | BLOQUEADA | C/D estabilizados | — | Segunda onda |
| PERF-G | `perf-r3-g-central-shell` | LIVRE | PERF-B integrada | — | Segunda onda liberada; preservar fronteiras dinâmicas da PERF-B |
| PERF-X | `perf-r3-x-hot-vs-history` | BLOQUEADA | medições A–G | — | Opcional |
| PERF-I | branch integradora | BLOQUEADA | frentes aprovadas | — | Integração final |
| PERF-J | branch integradora | BLOQUEADA | PERF-I concluída | — | Certificação |

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

### PERF-E — CPU e Renderização

Branch: `perf-r3-e-render-cpu`  
HEAD: `149f7c3945eae7cb046175499abe5bf6868eb9bb`  
Base original: `076a233cf250c95882e78498e89dd2a44d034f74`

Estado do coordenador: **EM REVISÃO — NÃO INTEGRAR AINDA**.

Evidências recebidas:
- benchmark determinístico: PASS;
- equivalência por checksum: PASS;
- guard estrutural PERF-E: PASS;
- escopo restrito a Empenhos, Notas Fiscais e Consulta de Itens;
- nenhuma mudança de Firestore, estética ou regra de negócio intencional.

Relação atual com a integradora:
- 1 commit à frente;
- 2 commits atrás, porque a integradora já recebeu PERF-B e o registro de integração;
- arquivos da PERF-E não sobrepõem os arquivos alterados pela PERF-B.

Gates ainda obrigatórios antes de aprovação:
- TypeScript;
- production build;
- `verify:empenhos-subtabs`;
- `verify:invoice-ns-lifecycle`;
- `verify:emprovex-core-protection`.

Decisão provisória: **aguardar gates; não integrar**.

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

## Regra

Chats trabalhadores **não atualizam este quadro para se autoaprovar**. Eles entregam o handoff; o chat coordenador atualiza o estado após revisão.
