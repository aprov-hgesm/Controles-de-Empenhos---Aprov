# PROMPT — MOBILE-G — SAÍDA MÓVEL

Você é o chat trabalhador responsável **exclusivamente** pela frente:

**MOBILE-G — Saída Móvel da Central Móvel R1 do EMPROVEX**

## Governança obrigatória

Repositório: `aprov-hgesm/Controles-de-Empenhos---Aprov`
Branch integradora: `feat/central-mobile-r1`
Base comum congelada da Onda 3: `c971d5356c343a0819bf96ec016de73dd96a435d`

A branch trabalhadora já existe exatamente nessa base. Não recrie, não rebaseie, não faça merge da integradora e não incorpore outras workers.

## Liberação do Program Control

A HARDEN-D SaaS ↔ MOBILE-R1 foi concluída, auditada e aceita. A MOBILE-R1 está **VERDE** e esta worker está formalmente liberada para a Onda 3.

CT-01 permanece registrada para o futuro Release Candidate global:

`Permissions-Policy: camera=(self), microphone=(), geolocation=()`

Nesta worker:
- NÃO alterar `next.config.ts`;
- NÃO alterar Permissions-Policy;
- NÃO criar correção para CT-01;
- CT-01 não bloqueia esta frente;
- qualquer novo delta transversal deve ser marcado no handoff e escalado ao Coordenador Mobile / Program Control.

Antes de editar:
```powershell
git fetch origin
git switch mobile-r1-g-outbound
git branch --show-current
git rev-parse HEAD
git status
```

HEAD inicial esperado: `c971d5356c343a0819bf96ec016de73dd96a435d`.

Leitura obrigatória:
1. `docs/EMPROVEX_MEMORIAL_OFICIAL.md`;
2. `docs/CENTRAL_MOBILE_R1_PLANO_MESTRE.md`;
3. `docs/CENTRAL_MOBILE_R1_EXECUCAO_PARALELA.md`;
4. `docs/CENTRAL_MOBILE_R1_INTEGRATION_STATUS.md`;
5. `docs/CENTRAL_MOBILE_R1_COORDENADOR_HANDOFF.md`;
6. `docs/CENTRAL_MOBILE_R1_INTEGRATION_1_VALIDATION.md`;
7. `docs/CENTRAL_MOBILE_R1_INTEGRATION_2_VALIDATION.md`;
8. `docs/CENTRAL_MOBILE_R1_WAVE3_FREEZE.md`;
9. `docs/TESTING_POLICY.md`;
10. `docs/DEVELOPMENT_CI_WORKFLOW.md`;
11. documentação específica da Central de Depósitos para sua frente.

A SAAS-R1 segue em hardening pré-piloto na `feat/saas-r1-commercializacao`. Não faça merge/rebase entre integradoras. Se tocar Auth, workspace/UG, sessão/lease, legal gate, lifecycle, warehouseAccess, Rules, shell, contratos compartilhados, package ou CI comum, registre no handoff **Impacto SAAS-R1** e devolva conflitos transversais ao Coordenador.

Contratos congelados da Mobile:
- scanner único `WarehouseMobileScanner`;
- EPX1/resolver;
- `WarehouseStockPosition`;
- classificador compartilhado PRODUCT/LOCATION/UNKNOWN;
- ALLOCATE oficial;
- consulta física read-only;
- TRANSFER oficial;
- lotes críticos fail-closed;
- saldo/ledger canônicos;
- online-first;
- nenhuma fonte de verdade paralela.

Nenhum worker faz merge na integradora/main, deploy, promoção Vercel ou publicação de Rules.


## Missão

Implementar a jornada móvel usando exclusivamente o **OUTBOUND canônico**:

```text
destino / retirado por
→ LER MATERIAL
→ quantidade
→ mostrar posições disponíveis
→ recomendar FEFO
→ chegar ao local
→ LER POSIÇÃO
→ lote quando aplicável
→ revisar
→ confirmação humana
→ OUTBOUND oficial
```

Reutilizar:
- scanner compartilhado;
- classificador de produto canônico;
- EPX1/resolver;
- `WarehouseStockPosition`;
- barcode/material/lote oficiais;
- saldo agregado e distribuição física oficiais;
- FEFO vigente;
- `prepareWarehouseExpressOutbound`;
- `applyWarehouseExpressOutbound`;
- `createWarehouseOutboundIdempotencyKey`;
- movimento `OUTBOUND`.

## Invariantes

- quantidade > 0;
- saldo agregado suficiente;
- saldo na posição suficiente;
- lote ativo, coerente e na posição quando utilizado;
- FEFO é recomendação conforme contrato vigente, não regra inventada;
- nenhuma baixa apenas pela leitura;
- confirmação humana obrigatória;
- idempotência/replay;
- nenhuma quantidade negativa;
- barcode/material devem coincidir;
- workspace/UG revalidados;
- operação deve falhar fechado em leitura crítica incompleta;
- client não escreve saldo/ledger/locationBalance diretamente.

Nunca implementar OUTBOUND por composição de outras operações.

## UX

Mostrar claramente:
- destino;
- retirado por;
- material;
- quantidade;
- posições disponíveis;
- posição recomendada;
- lote/validade;
- posição escaneada;
- resumo;
- confirmação.

A posição escaneada deve corresponder à posição utilizada no OUTBOUND.

## Fronteira

Preferir componentes/helpers MOBILE-G. Não alterar o contrato `applyWarehouseExpressOutbound` sem decisão coordenada.

Não mexer em inventário F, transferência D ou conferência H.

## Testes

Cobrir:
- LOCATION/SUBPOSITION;
- saldo agregado insuficiente;
- saldo da posição insuficiente;
- barcode/material incompatível;
- lote inválido/inativo/posição divergente;
- FEFO;
- posição escaneada divergente;
- quantidade zero/negativa;
- concorrência;
- idempotência/replay;
- ausência de saldo negativo;
- ausência de writes diretos;
- erro de conexão antes/depois da confirmação.

Executar Phase 8/outbound, Phase 7/lotes, scanner, Integrações 1–2, TypeScript, build, diff hygiene, Core Protection e Application CI.

## Handoff

Entregar `MOBILE-G — HANDOFF` completo com evidência do OUTBOUND oficial, métricas de reads/writes/listeners/bundle, riscos, **Impacto SAAS-R1** e confirmação de que não houve merge/deploy/Rules.
