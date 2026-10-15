# W3 — Integridade F05/F06/F09, recuperação e concorrência

## Caminhos rastreados
**F05:** app/api/central-depositos/intake-action/route.ts:480–963 lê entrada, material, saldo, posição, movimento e lote; :228–269 cria preconditions updateTime ou exists:false; :924–963 envia um commit REST para Warehouse. Conflito 409/412 é traduzido em WAREHOUSE_ITEM_INTAKE_CONCURRENT_MODIFICATION. Caminho legado lib/warehouse/intakeAllocationRepository.ts:678–1270 usa runTransaction SDK. lib/warehouse/intakeActionClient.ts:35–77 só recua ao legado sob WAREHOUSE_FAST_PATH_LEGACY, não sob 503; nunca presumir fallback universal.

**F06:** lib/warehouse/locationRepository.ts:1086–1437 calcula identidade de movimento determinística e executa runTransaction em :1175. O plano canônico de lotes é obtido antes da transação (:1117–1127), o que **exige prova** de revalidação em corrida com outra escrita, sem afirmar vulnerabilidade comprovada. mobileTransfer.ts executa preparação da UI, não é o motor transacional.

**F09 consumo imediato:** intake-action/route.ts:976–1155 usa consumptionId determinístico e faz commit atômico conjunto de intake + consumo. **Saída por retirada multi-linha é outra via:** lib/warehouse/withdrawalRepository.ts:994–1084 executa movimento, consumo e progresso sequencial por linha; em falha mantém progresso parcial e retry por chave. Não há atomicidade do conjunto de todas as linhas.

## Novos achados de código
- **W3-R19 (ALTO):** GET /api/central-depositos/status (status/route.ts:23–25) invoca verifyWarehouseRequest; para setor com claims divergentes warehouseAccess.ts:174–202 chama ensureSectorWarehouseClaims e sectorProvisioningAdmin.ts:486–518 alcança Identity Toolkit accounts:update. GET com possível escrita em Firebase Auth: NÃO usá-lo como smoke read-only com conta real.
- **W3-R20 (ALTO):** retirada multi-linha não possui commit global; entre movimento, consumo e progresso podem existir estados parciais recuperáveis. Evidência withdrawalRepository.ts:1029–1083. Falha observada em produção **não verificada**.
- **W3-R21 (MÉDIO):** erro 503 de fast-path não aciona fallback ao código cliente, por contrato atual intakeActionClient.ts:35–77. Não alterar sem estudo de segurança/Rules.

## Matriz de homologação sintética
| Prova | Evidência/resultado necessário |
|---|---|
| F05: mesma chave em 2 instâncias, replay igual | efeito único; saldo+lote+ledger+intake compatíveis |
| F05: mesma chave/payload divergente | 409, zero segundo efeito |
| F05: chaves distintas disputam saldo | commit íntegro ou conflito; sem saldo negativo |
| F05: entre leituras e commit, 412/503/retry | sem writes parciais e resposta estável |
| F06: duas operações mesma/diferente chave | saldo origem/destino, split lot e movimento coerentes |
| F06: lote muda após preplanning | revalidação ou rejeição sem divergência |
| F09: consumo simultâneo, replay, revogação | consumo único e acesso negado |
| Retirada de 3 linhas cai depois de linha 1 ou movimento antes do consumo | compensação/retry idempotente + reconcile completo |
| Cross-tenant com token de usuário válido | negação por workspace e IAM; sem bypass por Admin |
| Reinício, mudança de revision, perda de cache | idempotência no banco, não em RAM |

## Recovery
docs/SAAS_R1_OPERACAO_RECUPERACAO.md:40–72 registra que backup lógico NÃO inclui warehouse/* no segundo banco. scripts/firestore-recovery.mjs:168–235 contempla checagens de PITR, retenção, schedule e pelo menos um backup READY. **Não executado** e estado externo não provado. Executar restauração isolada de fixture com checklist de RPO/RTO, checksums de documentos e reconciliação read-only de ledger/saldos/consumos/lotes (scripts/warehouse-integrity-reconcile-readonly.mjs). Rollback de imagem/DNS não reverte dados Firestore.