# WAREHOUSE-MOBILE-WRITE-FORENSICS-01

## Classificação executiva

**PARCIAL — CAUSA NÃO ISOLADA**

A auditoria reconstruiu os três caminhos de escrita e os pontos de decisão das Rules. Também reproduziu duas incompatibilidades de shape entre leitura canônica e documento bruto legado. Porém, a evidência física preservada não contém o input técnico completo de F06 nem os documentos Firestore brutos usados por F06/F09. F05 depende do estado/log server-side de Production, não acessível por esta conexão.

Por governança, esta frente não transforma hipótese em causa.

F05_CAUSE_PROVEN=false
F06_CAUSE_PROVEN=false
F09_CAUSE_PROVEN=false
repairRequired=false
rulesChangeRequired=false
runtimeChangeRequired=false
environmentChangeRequired=false

Os flags de mudança significam “não provado como necessário”, não “descartado”.

## Identidade

- Branch: warehouse-mobile-write-forensics-01
- HEAD inicial: 97556bb8eb04af070016f9e58ddc2d9cca36bb35
- Production auditada: main@97556bb8eb04af070016f9e58ddc2d9cca36bb35
- Rules principal: bc91185f34bcdcb4437a4de1078d1089a09292ba
- Rules Warehouse: 6e1f1050005314db4e17cb3136409abbddb0ee91
- Database Warehouse: emprovex-warehouse
- Workspace: hgesm-aprov
- Material-anchor: mat_272f2d996ee65ed3530ad2d7e27b66d7
- HEAD final: ver handoff/PR, pois este documento faz parte do commit final.

A branch foi verificada antes da alteração como idêntica à Production: 0 ahead / 0 behind.

## Evidência física

### F05

BLOCKER com WAREHOUSE_FAST_PATH_UNAVAILABLE. O código público não preserva a causa server-side subjacente.

### F06

BLOCKER. A transferência física não confirmou escrita real. A evidência disponível não preservou código técnico final, material, quantidade, source/destination IDs ou lotes da tentativa. Não é seguro assumir que F06 usou o material de F09.

### F09

BLOCKER com FIRESTORE_PERMISSION_DENIED; replay idempotente também falhou. Leitura independente pós-falha preservou 440 L físicos em DEP-001 / PAL-01, lotes 340 + 100 = 440 L, legado UNASSIGNED 5 L e aggregate conhecido 445 L. Logo, a baixa quantitativa não foi aplicada.

O repair anterior corrigiu a sobre-atribuição quantitativa do material-anchor, incluindo lot_670e1ca177804501b90bf8cdd669683f de 440 para 340, mas alterou somente quantity. Isso não prova normalização de shapes históricos.

## Arquitetura de escrita

### F06 — transferência

WarehouseMobileTransfer chama transferWarehouseStock. O fluxo cria movement TRANSFER com quantityDelta=0, decrementa source locationBalance, incrementa destination locationBalance e pode atualizar/mover/splitar lotes. O aggregate balance não é escrito, corretamente, porque a quantidade total não muda.

Portanto um DENY pode ocorrer no movement/locationBalances ou em validWarehouseLotUpdate / validWarehouseLotCreate.

### F09 — saída

WarehouseMobileOutbound chama finalizeWarehouseMaterialWithdrawal. O repository garante um header FINALIZING, depois executa applyWarehouseExpressOutbound, que escreve atomicamente movement OUTBOUND, aggregate balance, locationBalance e lote selecionado quando houver. Só depois vêm consumption, progresso e FINALIZED.

Isso explica como pode existir rastro preparatório sem qualquer baixa de estoque quando a transação quantitativa recebe PERMISSION_DENIED.

### F05 — fast path

O caminho é browser/mobile -> /api/adm-deposito/intake-action -> Firebase ID token + access -> getGoogleAccessToken -> Firestore REST GET -> preconditions -> documents:commit.

O route fixa WAREHOUSE_DATABASE_ID=emprovex-warehouse e usa o projectId do Firebase config. Não há evidência de database divergente.

## Matriz Rules — F06

| Write | Regra principal | Condição | Estado |
| --- | --- | --- | --- |
| movement TRANSFER | validWarehouseTransferMovementCreate | shape, actor, scope, quantityDelta=0, createdAt, material e locationBalances pós-write | INDETERMINADO |
| source locationBalance | warehouseLocationBalanceMatchesTransfer | qty - q, revision+1, lastMovementId | INDETERMINADO |
| destination locationBalance | warehouseLocationBalanceMatchesTransfer | qty + q / create, revision coerente, lastMovementId | INDETERMINADO |
| lote inteiro | validWarehouseLotUpdate | revalida documento completo, posição e origin | CANDIDATO, NÃO PROVADO |
| split de lote | validWarehouseLotUpdate + validWarehouseLotCreate | shape integral, posição ativa, origin coerente | CANDIDATO, NÃO PROVADO |
| aggregate | n/a | sem write porque quantityDelta=0 | ESPERADO |

Primeira condição causal incompatível de F06: **não provada**.

Pista reproduzível: lib/warehouse/readCompatibility.ts pode completar campos legados ausentes, como subpositionId:null e campos nullable de origin. validWarehouseLotUpdate revalida o documento completo. Um update parcial pode, portanto, deixar no documento bruto um shape que a leitura aceita/projeta, mas a Rule de escrita rejeita. Falta provar que o lote efetivamente usado em F06 contém essa diferença.

## Matriz Rules — F09

| Write | Regra principal | Condição | Estado |
| --- | --- | --- | --- |
| withdrawal header | regras de withdrawal | preparação/auditoria | NÃO É A BAIXA |
| movement OUTBOUND | validWarehouseExpressOutboundMovementCreate | source + aggregate after + LB after + barcode + lote | DENY EM ALGUM PONTO DO CONJUNTO; EXPRESSÃO NÃO ISOLADA |
| aggregate balance | warehouseMovementHasMatchingBalanceAfter | delta, revision+1, lastMovementId | NÃO APLICADO |
| locationBalance | warehouseLocationBalanceMatchesExpressOutbound | posição, delta, revision+1 | NÃO APLICADO |
| barcode | warehouseExpressOutboundBarcodeMatches | em SCANNER compara source canônico ao raw barcode | CANDIDATO, NÃO PROVADO |
| selected lot | warehouseExpressOutboundSelectedLotMatchesAfter + validWarehouseLotUpdate | qty/code/position + shape integral | CANDIDATO, NÃO PROVADO |
| consumption/finalize | fluxo posterior | só depois do stock transaction | NÃO ALCANÇADO SE A TRANSAÇÃO FALHOU |

Primeira condição causal incompatível de F09: **não provada**.

Dois mecanismos foram reproduzidos localmente:
1. apresentação barcode raw {code} vira {code,label:null} na projeção canônica; em SCANNER a igualdade de mapas da Rule pode falhar;
2. LOCATION raw sem subpositionId vira LOCATION com subpositionId:null na projeção; um write sujeito a shape estrito pode falhar.

Isso prova o mecanismo, não que o documento real de F09 possua esse shape.

## Diagnóstico F05

WAREHOUSE_FAST_PATH_UNAVAILABLE é um envelope amplo.

- CONFIGURATION: FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON ausente/inválido/incompleto/project mismatch é convertido em falha server-side e chega ao catch genérico.
- AUTH/TOKEN: falha de OAuth/token também pode cair no mesmo envelope.
- REST/PERMISSION: GET Firestore não-404 e commit não classificado podem gerar o mesmo código.
- PRECONDITION: 409/412/FAILED_PRECONDITION do commit possui código específico WAREHOUSE_ITEM_INTAKE_CONCURRENT_MODIFICATION, portanto o generic observado não aponta diretamente para essa branch reconhecida.
- NETWORK/SERVER/UNKNOWN: exceções não classificadas caem no catch genérico.

A conexão Vercel disponível ao worker não expõe o team/project EMPROVEX de Production. Não foi possível provar presença/ausência do secret nem ler Runtime Logs da requisição. Nenhum secret/token foi exibido.

F05_CAUSE_PROVEN=false.

## Publicado vs repositório

Verificação estática:
- firebase.json liga emprovex-warehouse a firestore.warehouse.rules;
- lib/firebase.ts usa warehouseDb no database dedicado;
- intake-action fixa emprovex-warehouse;
- não foi encontrada evidência de fallback acidental ao database principal.

## Compatibilidade legada

A leitura canônica pode normalizar:
- presentation.label ausente -> null;
- position.subpositionId ausente em LOCATION -> null;
- chaves nullable de origin ausentes -> null.

As Rules de write usam shapes estritos e, em pontos específicos, igualdade de mapas. Logo, LEGACY DATA INCOMPATIBILITY e/ou RULE/CODE MISMATCH são candidatos técnicos concretos, mas ainda não causa comprovada.

## Instrumentação criada

Foram adicionados:
- scripts/warehouse-mobile-write-forensics-readonly.mjs
- scripts/warehouse-mobile-write-forensics.test.mjs

O coletor:
- é GET-only;
- fixa project gen-lang-client-0982077967, database emprovex-warehouse e workspace hgesm-aprov;
- usa cap 200 por coleção listada;
- lê material/balance exatos e coleta locationBalances/lots/barcodes do material;
- não imprime o token;
- registra contagem de HTTP requests/document reads e sinaliza coleção capped.

Validação local antes do commit:
- node --check: PASS;
- node --test: 3/3 PASS;
- guard estático rejeita POST/PUT/PATCH/DELETE/documents:commit/batchWrite e primitivas SDK de escrita;
- dois mecanismos de shape legado reproduzidos.

Não foi alegada reprodução Firebase Emulator do caso físico, porque o raw fixture real ainda falta. O repositório já contém fixtures canônicos de TRANSFER/EXPRESS_OUTBOUND em warehouse-modular-r1-security.test.mjs; o próximo Emulator válido deve usar os dados reais coletados.

## Dados reais lidos nesta frente

Production Firestore reads executadas: 0.
Collections consultadas ao vivo: nenhuma.
Production Firestore writes: 0.

A frente usou evidência histórica preservada por auditorias/repair anteriores, sem atribuir seus reads a esta execução.

## Fix plan determinístico

### F06
1. Rodar o coletor GET-only com o material real do teste.
2. Preservar source/destination locationBalances raw, lotes da origem, quantity, IDs/revisions/lastMovementId e erro técnico.
3. Construir fixture Emulator 1:1.
4. Localizar a primeira expressão DENY.
5. Alterar um único campo/shape por vez para obter ALLOW diagnóstico.

### F09
1. Preservar barcode raw, presentation raw, selected lot raw, lotId/lotCode, locationBalance, interface SCANNER/MANUAL_SEARCH, quantidade e posição.
2. Reproduzir no Emulator.
3. Se remover uma única diferença de shape gerar ALLOW, a causa estará isolada.

### F05
1. No projeto Vercel correto, confirmar somente presença/configuração do secret para Production sem exibir valor.
2. Encontrar o Runtime Log da requisição F05.
3. Classificar em CONFIGURATION/TOKEN/REST/PERMISSION/NETWORK/SERVER.
4. Não executar commit Firestore de diagnóstico.

Somente depois da prova o Coordenador escolhe owner: runtime, Rules, environment ou repair/migração allowlisted.

## O que NÃO deve ser alterado

Até a causa ser isolada:
- não alterar Rules;
- não reduzir segurança;
- não alterar dados reais;
- não repetir repair;
- não alterar runtime nesta branch;
- não tocar main;
- não tocar rc-r1-physical-fix-01;
- não repetir operação real só para observar novo erro.

## Próximo teste real necessário

Nenhum write real agora. Primeiro: coleta read-only + reprodução Emulator causal. Depois da correção validada, executar um único reteste dirigido por fluxo, preservando IDs, input, código técnico e before/after.

## Governança / handoff

Executado: inspeção de código/Rules, comparação branch vs Production, evidência documental, instrumentação GET-only e testes locais.

Não executado: transferência real, saída real, alocação real, repair, Rules deploy, app deploy, main merge, escrita Firestore, leitura de secret/token ou leitura Firestore viva.

Classificação final: **PARCIAL — CAUSA NÃO ISOLADA**.
