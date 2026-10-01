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
| PERF-A | `perf-r3-a-core-bundle` | LIVRE | baseline comum | — | Bundle EMPROVEX |
| PERF-B | `perf-r3-b-central-bundle` | LIVRE | baseline comum | — | Bundle Central |
| PERF-C | `perf-r3-c-outbound-demand-loading` | LIVRE | baseline comum | — | Saída sob demanda |
| PERF-D | `perf-r3-d-intake-queue` | LIVRE | baseline comum | — | Intake seletivo |
| PERF-E | `perf-r3-e-render-cpu` | LIVRE | baseline comum | — | CPU/renderização |
| PERF-H | `perf-r3-h-metrics-budget` | LIVRE | baseline comum | — | Métricas/budget |
| PERF-F | `perf-r3-f-memory-cache` | BLOQUEADA | C/D estabilizados | — | Segunda onda |
| PERF-G | `perf-r3-g-central-shell` | BLOQUEADA | B integrada/contrato congelado | — | Segunda onda |
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

## Regra

Chats trabalhadores **não atualizam este quadro para se autoaprovar**. Eles entregam o handoff; o chat coordenador atualiza o estado após revisão.
