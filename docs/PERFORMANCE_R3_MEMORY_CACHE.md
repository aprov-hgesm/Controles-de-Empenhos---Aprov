# Performance R3 — PERF-F — Cache curto em memória

Data: 2026-10-01.

## Escopo

A PERF-F reduz releituras redundantes de estruturas pequenas e relativamente estáveis da Central de Depósitos sem criar nova fonte de verdade.

Recursos cacheados:
- listagem de depósitos;
- leitura individual de depósito para apresentação da Saída de Material;
- listagem de localizações/subposições;
- leitura individual de localização para apresentação da Saída de Material;
- listagem de destinos.

A configuração logística foi avaliada e deliberadamente não foi incluída. Ela representa um único documento e participa da derivação/reconciliação de alertas; o benefício marginal não justifica introduzir uma janela stale nessa decisão.

## Contrato do cache

- somente memória do processo JavaScript;
- TTL: **30 segundos** para todos os recursos da PERF-F;
- chave segregada por **workspaceId + variante da consulta**;
- variante inclui o limite bounded ou o ID individual;
- nenhuma gravação em localStorage, sessionStorage, IndexedDB ou Firestore;
- nenhum listener ou coleção nova;
- requests idênticos simultâneos compartilham a mesma Promise em voo;
- rejeição nunca é convertida em entrada válida;
- invalidação remove também requests em voo do workspace e usa geração interna para impedir que uma resposta anterior à mutação repovoe o cache depois dela.

O cache desaparece naturalmente em reload ou nova sessão JavaScript.

## Autoridade e invalidação

Unicidade de código de depósito e de localização usa loaders Firestore **uncached**. Uma falha de leitura autoritativa aborta a validação em vez de aceitar a ausência de conflito a partir de cache.

A validação de destino ativo (requireActiveDestination) continua fazendo getDoc() diretamente no documento oficial durante Saída de Material e consumo imediato.

Após escrita bem-sucedida:
- criar/editar depósito invalida depósitos do workspace;
- criar/editar localização invalida localizações do workspace;
- criar destino ou alterar seu status invalida destinos do workspace.

Falha de escrita não invalida nem produz estado de cache que simule persistência.

Nenhum saldo, ledger, movimento, lote, intake, NF, empenho, cronograma, inventário, consumo, outbound, histórico, barcode operacional, autenticação ou autorização entra no cache.

## Evidência reproduzível

Cenário representativo dentro do TTL, sem mutação estrutural:

Início → Alocação → SISCOFIS → Meus Depósitos

Cada superfície pode solicitar a mesma listagem de depósitos e localizações.

Antes:
- 4 superfícies × 2 queries estruturais = **8 carregamentos reais**;
- para D depósitos e L localizações, leituras documentais = **4 × (D + L)**.

Depois:
- primeiro par carrega Firestore; os três pares seguintes reutilizam memória;
- **2 carregamentos reais**;
- leituras documentais = **D + L**;
- redução teórica nesse recorte: **75%**, sem assumir valores reais para D ou L.

O teste test:performance-r3-memory-cache usa um conjunto sintético controlado de 4 depósitos e 12 localizações apenas para tornar a fórmula executável: 64 document-equivalents antes versus 16 depois. Esses números são dados de teste, não contagens de produção.

Para destinos, duas superfícies dentro do TTL passam de 2 carregamentos para 1, mantendo requireActiveDestination() autoritativo na operação crítica.
