# PROMPT — MOBILE-H — CONFERÊNCIA FÍSICA/DIGITAL

Você é o chat trabalhador responsável **exclusivamente** pela frente:

**MOBILE-H — Conferência Física/Digital da Central Móvel R1 do EMPROVEX**

## Governança obrigatória

Repositório: `aprov-hgesm/Controles-de-Empenhos---Aprov`
Branch integradora: `feat/central-mobile-r1`
Base comum congelada da Onda 3: `c971d5356c343a0819bf96ec016de73dd96a435d`

A branch trabalhadora já existe exatamente nessa base. Não recrie, não rebaseie, não faça merge da integradora e não incorpore outras workers.

Antes de editar:
```powershell
git fetch origin
git switch mobile-r1-h-position-check
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


## Pergunta principal

> **Este material está registrado nesta posição?**

## Missão

Implementar jornada estritamente de conferência:

```text
LER POSIÇÃO
→ resolver posição
→ LER MATERIAL
→ resolver material
→ consultar projeção física oficial
→ comparar
→ CORRETO / INCORRETO
```

Se incorreto:
- mostrar posição/posições registradas quando disponíveis;
- explicar a divergência;
- oferecer navegação para `/central-mobile/transferir`;
- não criar mutação própria.

Regra imutável:

> **Conferência detecta; Transferência corrige.**

## Reutilizar

- `WarehouseMobileScanner`;
- EXPECT_LOCATION / EXPECT_PRODUCT;
- classificador compartilhado;
- EPX1/resolver;
- `WarehouseStockPosition`;
- contratos/read-model da MOBILE-E quando aplicável;
- `warehouse_location_balance_v1`;
- material/barcode/lotes oficiais;
- rota MOBILE-D para correção.

## Segurança e performance

- read-only;
- workspace/UG revalidados;
- DEPOT recusado como posição;
- nenhuma leitura cross-workspace;
- consulta bounded/on-demand;
- 0 listener permanente;
- fail-closed em erro/saturação;
- não varrer estoque inteiro;
- não criar índice/coleção paralela.

## UX

Resultado deve ser inequívoco:
- **CORRETO — material registrado aqui**;
- **INCORRETO — material não registrado nesta posição**;
- se registrado em outro local, mostrar a posição oficial;
- botão opcional **Transferir material** deve apenas navegar à MOBILE-D com contexto seguro; não executar transferência automaticamente.

## Fronteira

Não implementar TRANSFER, OUTBOUND, inventário ou ajuste.

Não duplicar a consulta física da MOBILE-E; reutilizar helpers/modelos/adapters quando semanticamente adequado.

## Testes

Cobrir:
- posição correta;
- posição incorreta;
- material sem saldo físico;
- material em múltiplas posições;
- LOCATION/SUBPOSITION;
- DEPOT;
- workspace/UG divergente;
- posição inativa/inexistente;
- barcode inválido/EPX1 malformado;
- fail-closed em erro de leitura;
- ausência de writes;
- 0 listener contínuo;
- navegação para MOBILE-D sem mutação.

Executar regressões physical query, Phase 6/7/8 pertinentes, scanner, Integrações 1–2, TypeScript, build, diff hygiene, Core Protection e Application CI.

## Handoff

Entregar `MOBILE-H — HANDOFF` com branch, HEAD, base, PR, resultados CORRETO/INCORRETO, reads/listeners/bundle, testes, riscos, **Impacto SAAS-R1** e confirmação de ausência de mutação/merge/deploy/Rules.
