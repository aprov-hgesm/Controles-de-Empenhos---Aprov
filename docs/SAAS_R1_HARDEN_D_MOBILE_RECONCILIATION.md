# SAAS R1 — HARDEN-D — Reconciliação SaaS ↔ MOBILE-R1

## 1. Identidade e escopo

Frente: **HARDEN-D — Reconciliação SaaS R1 ↔ MOBILE-R1 e Matriz de Contratos Compartilhados**

Branch trabalhadora:

`saas-harden-d-mobile-reconciliation`

Base congelada:

`f8d2a53bfadf2548a59f49cdfc3cdb3d420f0b11`

Alvo SaaS fixado pelo Program Control:

`4848643be85b30532f7f093c4ddb0e729facfad3`

Alvo MOBILE-R1 fixado pelo Program Control:

`7b745fa0b7979e643b83b7de94dd96a0290930ab`

Estado SaaS vivo consultado somente em leitura durante a auditoria:

`1216f8cf97edec55fd94c98e39f156a6f76cb056`

A branch HARDEN-D foi confirmada exatamente na base congelada antes da edição. O alvo SaaS `4848643b...` difere da base apenas por documentação; portanto, o runtime SaaS reconciliado continua sendo o runtime da base congelada. O SaaS vivo também avançou apenas em documentação de governança neste intervalo, sem alterar os contratos de runtime auditados.

## 2. Método

A reconciliação foi feita por contrato e conteúdo, não por ancestralidade Git.

Foram usados:

- comparação de commits/refs;
- comparação por blob SHA de arquivos compartilhados;
- leitura semântica dos guards e adapters Mobile;
- leitura dos documentos de certificação MOBILE-R1;
- inspeção do scanner e da política de browser;
- verificação de que módulos Mobile novos reutilizam repositórios e contratos canônicos;
- confirmação de que nenhuma Rules foi publicada e nenhum runtime foi alterado por esta frente.

Classificações:

- `SEM DELTA`;
- `DELTA COMPATÍVEL`;
- `CONFLITO`;
- `REQUER COORDENADOR GERAL`.

## 3. Resultado executivo

**Status da reconciliação: PASS, com uma correção transversal obrigatória antes do Release Candidate global.**

Não foi encontrado conflito material entre SaaS R1 e MOBILE-R1 em Auth, workspace/UG, sessão, legal gate, billing/lifecycle, `warehouseAccess`, Firestore Rules, fontes da verdade logísticas ou contratos canônicos de saldo/posição/lote/material.

Foi confirmado um delta global em `next.config.ts`:

- SaaS: `camera=(), microphone=(), geolocation=()`;
- Mobile: `camera=(self), microphone=(), geolocation=()`.

Esse delta é **compatível e reconciliável**, mas o Release Candidate global deve preservar a variante Mobile para não desabilitar o scanner. A correção deve ser aplicada fora da HARDEN-D, pela frente/coordenador responsável pelo RC.

## 4. Matriz de reconciliação

| Domínio | Classificação | Evidência principal | Impacto | Correção? | Responsável |
|---|---|---|---|---|---|
| Auth | SEM DELTA | `lib/platformAccess.ts`, `lib/platformIdentity.ts` com blobs idênticos | Mobile usa a mesma identidade autenticada | NÃO | — |
| Workspace / UG | SEM DELTA | `lib/workspaceContext.ts`, `lib/platformAccess.ts`, Rules idênticas | Mesmo escopo operacional e mesma validação de UG | NÃO | — |
| Sessão / Lease / Heartbeat | SEM DELTA | `lib/platformSessionControl.ts`, `lib/platformSessionLease.ts`, `lib/platformCapacity.ts` idênticos | Mesmo enforcement; founder continua isento da capacidade | NÃO | — |
| Legal Gate | SEM DELTA | `components/legal/LegalAcceptanceGate.tsx`, `hooks/useLegalAcceptance.ts`, `lib/legalAcceptance.ts`, `lib/legalVersions.ts` idênticos | Mobile não cria bypass ou aceite paralelo | NÃO | — |
| Billing / Lifecycle | SEM DELTA | `lib/billing.ts` e `lib/platformBillingStore.ts` idênticos | Trial/active/pending/suspended/exempt/VIP continuam na mesma fonte | NÃO | — |
| `warehouseAccess` | SEM DELTA | `lib/server/warehouseAccess.ts` e `app/api/adm-deposito/status/route.ts` idênticos | Mesmos claims, workspace, UG e status | NÃO | — |
| Firestore Rules | SEM DELTA | `firestore.rules` com blob idêntico nos dois alvos | Nenhuma autorização paralela foi criada | NÃO | — |
| Schema da Central | DELTA COMPATÍVEL | Novos módulos Mobile; contratos canônicos de material/local/lote/repositories permanecem idênticos | Extensão Mobile sem ruptura de schema | NÃO | — |
| Source of Truth | DELTA COMPATÍVEL | resolver físico lê `getWarehouseDepot/getWarehouseLocation`; operações reutilizam repositories canônicos | Não existe saldo, posição, lote ou permissão paralelos | NÃO | — |
| Shell / Guards | DELTA COMPATÍVEL | `WarehouseProtectedSurface.tsx` extrai `WarehouseAccessBoundary`; Mobile o reutiliza | Refatoração reutilizável sem mudar o fluxo de autorização | NÃO | — |
| APIs / serviços compartilhados | DELTA COMPATÍVEL | Mobile usa `allocateWarehousePendingItemFast`, `transferWarehouseStock`, repositories canônicos e status API existente | Mobile atua como adapter/UI, não como backend paralelo | NÃO | — |
| `next.config.ts` / Permissions-Policy | DELTA COMPATÍVEL | diferença exclusiva da câmera | SaaS bloqueia scanner; Mobile habilita apenas same-origin | **SIM** | RC / Coordenador |
| Segurança do browser | DELTA COMPATÍVEL | scanner usa `getUserMedia`; decoder solicita `audio: false` e câmera traseira preferencial | Necessidade legítima de câmera; microfone/geolocalização seguem bloqueados | NÃO além da policy | RC / Coordenador |
| Telemetria / observabilidade | DELTA COMPATÍVEL | `lib/warehouse/telemetry.ts` e `lib/operationalPaths.ts` idênticos | Novos leitores Mobile reutilizam telemetria existente; sem listener permanente novo | NÃO | — |

## 5. Auth

Os seguintes contratos têm conteúdo idêntico entre SaaS e Mobile:

- `lib/platformAccess.ts`;
- `lib/platformIdentity.ts`;
- `lib/workspaceContext.ts`;
- `lib/server/warehouseAccess.ts`.

A Mobile não introduz uma segunda estratégia de autenticação. O boundary móvel começa pelo mesmo `onAuthStateChanged`, resolve o mesmo contexto autenticado e consulta o mesmo endpoint `/api/adm-deposito/status`.

**Classificação: SEM DELTA.**

## 6. Workspace / UG

O resolver de contexto, a fonte da verdade do workspace e a validação de UG permanecem idênticos.

Os resolvers Mobile de identidade física revalidam:

- workspace;
- UG;
- entidade atual;
- status ativo;
- hierarquia.

Não há fallback Mobile alternativo para selecionar workspace/UG.

**Classificação: SEM DELTA.**

## 7. Sessão / Lease / Heartbeat

`lib/platformSessionControl.ts`, `lib/platformSessionLease.ts` e `lib/platformCapacity.ts` têm blobs idênticos.

No estado auditado:

- limite externo padrão: 2 sessões;
- slots: `slot-1` e `slot-2`;
- lease: 30 minutos;
- heartbeat nominal: 15 minutos;
- founder: capacidade isenta.

A Central Mobile reutiliza o mesmo `startWorkspaceSessionControl` através do boundary compartilhado.

**Classificação: SEM DELTA.**

## 8. Legal Gate

O gate, hook e contratos de versões legais são idênticos.

A Mobile não cria:

- aceite paralelo;
- versão legal paralela;
- bypass por rota móvel;
- fonte alternativa de aceite.

O `WarehouseAccessBoundary` continua envolvendo o conteúdo com `LegalAcceptanceGate`.

**Classificação: SEM DELTA.**

## 9. Billing / Lifecycle

`lib/billing.ts` e `lib/platformBillingStore.ts` são idênticos.

Permanecem canônicos os estados:

- `trial`;
- `active`;
- `pending`;
- `suspended`;
- `exempt`;
- `canceled`.

Também permanece canônica a isenção por `founder`, `manual` ou `legacy_vip`.

A Mobile não cria lifecycle ou autorização comercial paralelos.

**Classificação: SEM DELTA.**

## 10. warehouseAccess

O servidor `lib/server/warehouseAccess.ts` é idêntico e continua exigindo:

- conta ativa;
- workspace ativo;
- autorização para a Central;
- claims `emprovexWarehouse`;
- role `sector`;
- workspaceId e UG coerentes.

O endpoint `app/api/adm-deposito/status/route.ts` também é idêntico.

**Classificação: SEM DELTA.**

## 11. Firestore Rules

`firestore.rules` tem o mesmo blob SHA nos dois alvos.

Não houve publicação, relaxamento ou fork de Rules pela Mobile.

**Classificação: SEM DELTA.**

## 12. Schema e fontes da verdade da Central

Os seguintes contratos/repositories canônicos permanecem idênticos:

- `lib/warehouse/barcode.ts`;
- `lib/warehouse/barcodeRepository.ts`;
- `lib/warehouse/location.ts`;
- `lib/warehouse/locationRepository.ts`;
- `lib/warehouse/material.ts`;
- `lib/warehouse/materialRepository.ts`;
- `lib/warehouse/lot.ts`;
- `lib/warehouse/intakeActionClient.ts`;
- `lib/warehouse/intakeStateRepository.ts`;
- `lib/warehouse/namespace.ts`;
- `lib/warehouse/invoiceIntegration.ts`.

A Mobile adiciona adapters e serviços específicos de UI/consulta, mas mantém as entidades canônicas.

### Identidade física

`lib/warehouse/locationBarcode.ts` introduz o contrato `EPX1` para identidade física de:

- depósito;
- local;
- subposição.

O código é derivado do ID técnico e, ao ser resolvido, é revalidado contra as entidades autoritativas atuais por `locationBarcodeResolver.ts`.

Ele não vira uma segunda coleção de posição nem uma segunda fonte da verdade.

### Intake

A tela Mobile reutiliza:

- `loadWarehouseInvoiceIntakeQueue`;
- `allocateWarehousePendingItemFast`;
- barcode repository canônico;
- resolver canônico de posição.

Não existe escrita client-side paralela de saldo/ledger.

### Transferência

A tela Mobile reutiliza:

- `listWarehouseLocationBalances`;
- `transferWarehouseStock`;
- material repository canônico;
- lotes canônicos.

A leitura crítica de lotes é fail-closed e a certificação Mobile preservou o TRANSFER canônico.

### Consulta física

A MOBILE-E é somente leitura e consulta:

- saldo oficial;
- material oficial;
- lotes oficiais;
- posição oficial.

Não cria coleção, saldo, índice lógico paralelo ou listener permanente.

**Classificação geral: DELTA COMPATÍVEL.**

## 13. Shell / Guards

A diferença em `features/warehouse/components/WarehouseProtectedSurface.tsx` é estrutural:

- SaaS tinha o fluxo dentro de `WarehouseProtectedLayout`;
- Mobile extraiu `WarehouseAccessBoundary`;
- `WarehouseProtectedLayout` passou a consumir esse boundary;
- `WarehouseMobileProtectedLayout` consome o mesmo boundary.

A lógica de autenticação, workspace, `warehouseAccess`, sessão e Legal Gate permanece a mesma.

**Classificação: DELTA COMPATÍVEL.**

## 14. Permissions-Policy

### SaaS

`camera=(), microphone=(), geolocation=()`

### Mobile

`camera=(self), microphone=(), geolocation=()`

A diferença foi confirmada diretamente em `next.config.ts`.

A implementação Mobile precisa da câmera para o scanner. O decoder solicita:

- `audio: false`;
- vídeo com preferência por câmera traseira (`facingMode: environment`).

Não foi identificada necessidade de microfone nem geolocalização.

`camera=(self)` limita a permissão da feature à própria origem e não equivale a conceder automaticamente acesso físico à câmera: o navegador continua aplicando os requisitos do `getUserMedia`, inclusive contexto seguro e permissão do usuário.

Referência técnica externa:

- MDN Permissions-Policy camera: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy/camera
- MDN getUserMedia: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia

### Classificação

**DELTA COMPATÍVEL.**

### Contrato que deve prevalecer no RC global

`camera=(self), microphone=(), geolocation=()`

### Motivo

É o menor relaxamento capaz de preservar o scanner Mobile sem liberar câmera para origens cruzadas e sem liberar microfone/geolocalização.

### Correção transversal necessária

**SIM.**

A HARDEN-D não altera `next.config.ts`.

O Coordenador SaaS/Geral deve determinar a branch curta ou etapa de integração do RC que carregará esse contrato.

## 15. Segurança do browser

A Mobile introduz necessidade legítima de câmera, mas não de microfone/geolocalização.

O scanner:

- só inicia a câmera por ação da interface;
- usa `navigator.mediaDevices.getUserMedia`;
- solicita `audio: false`;
- possui parada explícita da sessão da câmera;
- mantém entrada manual como fallback quando a câmera não está disponível.

Não foi encontrada justificativa para ampliar outras diretivas.

**Classificação: DELTA COMPATÍVEL.**

## 16. Telemetria / Observabilidade

`lib/warehouse/telemetry.ts`, `lib/operationalPaths.ts` e `lib/firebase.ts` permanecem idênticos.

A consulta física Mobile registra leituras utilizando a telemetria existente e não cria listener permanente novo.

**Classificação: DELTA COMPATÍVEL.**

## 17. Evidência Mobile já certificada consultada

Os documentos de integração MOBILE-R1 registram, entre outros:

- Application CI verde;
- Core Protection verde;
- Recovery verde;
- Legal validation verde;
- build/typecheck/diff hygiene verdes;
- gates 16–21 verdes;
- jornada C → E → D → E certificada;
- leitura crítica de lotes fail-closed;
- ausência de escrita direta de saldo/ledger;
- reconciliação anterior de Auth/workspace/sessão/legal/`warehouseAccess`/Rules sem conflito concreto.

Essas evidências foram usadas como apoio. A HARDEN-D também confirmou diretamente os conteúdos dos contratos compartilhados.

## 18. Conflitos

**Nenhum conflito funcional material foi encontrado.**

O delta de câmera não é classificado como CONFLITO porque existe uma convergência segura e clara: preservar `camera=(self)` no RC global.

## 19. Correções transversais necessárias

### CT-01 — Permissions-Policy do Release Candidate

Aplicar no RC global:

`camera=(self), microphone=(), geolocation=()`

Sem outras ampliações.

Executor: branch de integração/RC definida pelo Coordenador SaaS e pelo Coordenador Geral.

A HARDEN-D apenas registra a necessidade.

## 20. Riscos restantes

1. O RC global ainda pode sobrescrever `next.config.ts` se integrar o estado SaaS sem reconciliar a linha de câmera.
2. A habilitação da câmera deve ser verificada novamente no header HTTP efetivo do deployment candidato, não apenas no arquivo-fonte.
3. MOBILE-F/G/H não fazem parte desta auditoria e podem introduzir novos contratos compartilhados; exigem novo checkpoint conforme Program Control.
4. Qualquer alteração futura em Auth, Rules, lifecycle, `warehouseAccess` ou schemas canônicos exige nova reconciliação.

## 21. Testes e verificações desta frente

Executado:

- confirmação da branch HARDEN-D na base congelada;
- confirmação dos alvos SaaS/Mobile;
- comparação base → SaaS;
- comparação base → Mobile;
- comparação de blobs dos contratos compartilhados;
- inspeção semântica de guards e serviços Mobile;
- inspeção de `next.config.ts`;
- inspeção do scanner e decoder;
- leitura das certificações Mobile relevantes;
- validação do conteúdo deste documento sem trailing whitespace.

Não executado, por desenho da frente:

- merge;
- rebase;
- cherry-pick;
- deploy;
- publicação Vercel;
- publicação de Rules;
- restore;
- ação produtiva;
- alteração de runtime;
- incorporação HARDEN-A/B/C;
- integração de MOBILE-F/G/H.

Como esta frente altera apenas documentação, não foi disparado CI pesado apenas para produzir checks artificiais.

## 22. Impacto MOBILE-R1

MOBILE-R1 pode coexistir com o SaaS R1 auditado.

Os módulos Mobile já integrados preservam os contratos de segurança e de dados existentes. O scanner depende apenas de uma reconciliação global do header de câmera antes do RC.

## 23. Recomendação ao Coordenador SaaS

Aceitar a HARDEN-D como **PASS com CT-01 pendente de aplicação no RC**.

Não incorporar código Mobile inteiro ao SaaS por esta branch.

Criar/aplicar somente a correção transversal necessária na etapa de RC/integrador apropriada e validar o header efetivo.

## 24. Recomendação ao Coordenador Geral

- considerar encerrada a reconciliação C/D/E contra o candidato SaaS auditado;
- exigir CT-01 antes do freeze do Release Candidate global;
- manter MOBILE-F/G/H sob a governança já definida até decisão formal do Program Control;
- exigir nova reconciliação se F/G/H alterarem contratos compartilhados;
- não interpretar este PASS como autorização de deploy ou release produtivo.

## 25. Conclusão

**PASS — SaaS R1 e MOBILE-R1 podem coexistir com segurança no mesmo EMPROVEX no escopo auditado.**

Não existe conflito material aberto nos contratos compartilhados auditados.

Existe uma única correção transversal obrigatória antes do Release Candidate global:

`Permissions-Policy: camera=(self), microphone=(), geolocation=()`

A HARDEN-D registra e prova essa necessidade, mas não altera runtime.
