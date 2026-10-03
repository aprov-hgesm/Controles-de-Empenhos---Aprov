# EMPROVEX — Central Móvel R1 — Integration Status

Última atualização: **2026-10-02**
Integrador: `feat/central-mobile-r1`
Produção de referência: `main@e90f92acae1514ee5cbc6ce95fed354bc1454330`
Baseline upstream MOBILE-0: `78d3e9afeeb4176a8d6423cdd8e65d32435ba0a9`
Freeze documental / base comum da Onda 1: `53e28b81874ee1b7ce0bd484cc7a97537aa99473`
Freeze documental / base comum da Onda 2 após reconciliação SaaS: `6852963c7aa9a1c83133239f0b929715fd316530`
Freeze documental / base comum da Onda 3 após Integração 2 + reconciliação SaaS: `c971d5356c343a0819bf96ec016de73dd96a435d`

Estado global: **ONDAS 1–2 INTEGRADAS / INTEGRAÇÃO 2 CERTIFICADA / ONDA 3 LIBERADA — MOBILE-F + MOBILE-G + MOBILE-H**

## 1. Baseline

Origem:
`saas-r1-i-integration@78d3e9afeeb4176a8d6423cdd8e65d32435ba0a9`

Evidências:
- PR #219;
- Application CI #908 SUCCESS;
- Core Protection #195 SUCCESS;
- Recovery #595 SUCCESS;
- Legal Validation #20 SUCCESS.

Dependência:
- SAAS-I ainda pertence ao programa SaaS e não foi integrada pela MOBILE-R1;
- antes de MOBILE-I, reconciliar com o SaaS consolidado.

## 2. Quadro vivo

| Frente | Branch | Dependência | Estado | Integração |
| --- | --- | --- | --- | --- |
| MOBILE-0 Baseline/contratos | integradora | candidato SAAS-I verde | **CONGELADA** | contratos/documentação canônicos |
| MOBILE-A Plataforma/Scanner | `mobile-r1-a-platform-scanner` | 0 | **APROVADA COM PENDÊNCIA RUNTIME / INTEGRADA** | PR #221 / squash `19fc6be4...` |
| MOBILE-B Etiquetas/Resolver | `mobile-r1-b-location-labels` | 0 | **APROVADA E INTEGRADA** | PR #220 / squash `5edb19812...` |
| MOBILE-C Alocação | `mobile-r1-c-intake-allocation` | A+B+Int.1 | **APROVADA E INTEGRADA SEMANTICAMENTE** | worker PR #229; integração PR #232 / squash `1c523fe2...` |
| MOBILE-D Transferência | `mobile-r1-d-transfer` | A+B+Int.1 | **APROVADA E INTEGRADA SEMANTICAMENTE** | worker PR #231; integração PR #234 / squash `fc87bf8f...` |
| MOBILE-E Consulta | `mobile-r1-e-physical-query` | A+B+Int.1 | **APROVADA E INTEGRADA** | PR #230 / squash `e768ee5f...` |
| MOBILE-F Inventário | `mobile-r1-f-inventory` | Int.2 | **APROVADA / CONGELADA** | PR #239; HEAD `42954ada...`; aguarda G/H antes da ordem de integração |
| MOBILE-G Saída | `mobile-r1-g-outbound` | Int.2 | **ATIVADA — ONDA 3** | base `c971d5356...`; worker autorizado |
| MOBILE-H Conferência | `mobile-r1-h-position-check` | Int.2 | **APROVADA / CONGELADA** | PR #241; HEAD `f30f4dcb...`; aguarda G antes da ordem de integração |
| MOBILE-I Integração controlada | integradora | A–H | **BLOQUEADA** | — |
| MOBILE-J Certificação | integradora | I | **BLOQUEADA** | — |

## 3. Contratos congelados

- mesma autenticação;
- mesmo usuário;
- mesmo workspace/UG;
- ledger vigente;
- saldo vigente;
- localização vigente;
- barcode de produto vigente;
- lote vigente;
- intake vigente;
- inventário vigente;
- online-first;
- scanner compartilhado;
- position barcode como identificador, não autorização;
- sem app nativo;
- sem offline sync;
- sem fonte de verdade paralela.

## 4. Reserva inicial

### MOBILE-A
Reservado:
- novos componentes mobile/scanner;
- rota/shell mobile;
- hooks/helpers scanner.

Evitar:
- domínio de estoque;
- labels PDF;
- Rules sem autorização.

### MOBILE-B
Reservado:
- labels;
- PDF labels;
- helper/resolver de código de posição;
- testes específicos.

Evitar:
- shell/scanner;
- movimentos.

## 5. Métricas a capturar

Antes da primeira integração:
- build da rota desktop atual;
- baseline de bundle da Central;
- tamanho inicial da nova rota mobile quando existir;
- dependências do decoder;
- consultas necessárias ao resolver.

## 6. Gates

MOBILE-A:
- typecheck;
- build;
- testes scanner;
- smoke navegador;
- Core Protection;
- diff hygiene.

MOBILE-B:
- typecheck;
- build quando afetado;
- testes labels/resolver;
- segurança se houver acesso novo;
- Core Protection;
- diff hygiene.

## 7. Próxima ação do Coordenador

1. registrar o encerramento da Integração 2;
2. congelar o HEAD comum da Onda 3;
3. criar MOBILE-F, MOBILE-G e MOBILE-H na mesma base;
4. emitir prompts especializados;
5. receber handoffs independentes;
6. manter MOBILE-I/J bloqueadas até a Integração 3.

## 8. Produção

Nenhuma alteração MOBILE-R1 está em `main`.
Nenhum deploy está autorizado.
Nenhuma Rule será publicada por um worker.


## 9. Revisões do Coordenador

### Revisão MOBILE-A — 2026-10-02

Handoff recebido:
- branch: `mobile-r1-a-platform-scanner`;
- base: `53e28b81874ee1b7ce0bd484cc7a97537aa99473`;
- HEAD final revisado: `6abc35c60e5b0674f0e034b6da1476936345e41f`;
- HEAD de código certificado informado: `86aa9962f82f1d37ff4d19d4c33c859bf0d777cb`;
- PR #221: draft, mergeable, não integrado.

Evidências positivas:
- escopo preservado;
- final = código certificado + handoff documental;
- Application CI #914: SUCCESS;
- Core Protection #201: SUCCESS;
- Recovery #600: SUCCESS;
- SAAS-DL Legal Validation #25: SUCCESS;
- build/typecheck/diff hygiene verdes;
- decoder lazy e fora do caminho desktop.

Classificação coordenadora:
**DEVOLVIDA PARA CORREÇÃO MÍNIMA**.

Bloqueios:
1. `next.config.ts` aplica `Permissions-Policy: camera=()`, incompatível com a missão de câmera da rota móvel;
2. `WarehouseMobileScanner` não restaura `mountedRef.current=true` no setup do effect, embora `reactStrictMode=true`, tornando o lifecycle vulnerável ao ciclo extra de effects em desenvolvimento.

Integração do PR #221:
**NÃO AUTORIZADA neste HEAD**.

Correção foi delimitada no comentário coordenador do PR #221. MOBILE-B permanece independente e não é bloqueada por esta devolução.


### Integração MOBILE-B — 2026-10-02

- branch: `mobile-r1-b-location-labels`;
- base: `53e28b81874ee1b7ce0bd484cc7a97537aa99473`;
- worker HEAD: `948978e9e326ff6468643d44540a2a5337dff425`;
- PR #220;
- classificação: **APROVADA**;
- integração squash: `5edb19812b1121fdf867dc63c787bb2439ae68d5`;
- Application CI #913: SUCCESS;
- Core Protection #200: SUCCESS;
- Recovery #599: SUCCESS;
- SAAS-DL Legal Validation #24: SUCCESS;
- build/typecheck/diff hygiene/gates 16–21: PASS;
- nova persistência/coleção/banco: nenhum;
- Rules/ledger/saldo: inalterados;
- identidade física: namespace `EPX1`;
- simbologia: Code 128;
- LOCAL/SUBPOSITION: resolvem para `WarehouseStockPosition`;
- DEPOT: identidade física válida, mas não posição de estoque;
- validação física de impressão/leitura: pendente para Integração 1.

A integração da MOBILE-B **não libera MOBILE-C/D/E isoladamente**. A Integração 1 continua bloqueada até a MOBILE-A ser corrigida e aprovada.


### Integração MOBILE-A — 2026-10-02

- branch: `mobile-r1-a-platform-scanner`;
- base original: `53e28b81874ee1b7ce0bd484cc7a97537aa99473`;
- worker HEAD final: `44c4f013859230b5d490d2049c6b8dbf2cd3baa2`;
- PR #221;
- classificação final: **APROVADA COM PENDÊNCIA DE VALIDAÇÃO RUNTIME**;
- integração squash: `19fc6be4a1deb5de44ec6999ef42d1cf6ced576c`;
- Application CI #917: SUCCESS;
- Core Protection #204: SUCCESS;
- Recovery #603: SUCCESS;
- SAAS-DL Legal Validation #28: SUCCESS;
- Permissions-Policy: `camera=(self), microphone=(), geolocation=()`;
- Strict Mode lifecycle: corrigido e protegido;
- bundle: sem regressão observada.

Pendências transferidas:
- leitura HTTP real do header em ambiente Vercel acessível;
- câmera física Android/iPhone;
- feedback físico de som/vibração.

### Integração 1 — APROVADA em 2026-10-02

Gate certificado:
`scanner → EPX1 → resolver autoritativo → WarehouseStockPosition`.

Integração técnica:
- MOBILE-A squash `19fc6be4...`;
- MOBILE-B squash `5edb19812...`;
- glue read-only na integradora;
- branch técnica de certificação: `mobile-r1-integration-1-certification`;
- PR #224;
- certificação squash: `7c987676e0c089285e8bcd2bf5d34a6f54c717fa`;
- HEAD certificado do PR: `4b397d61bf4c8505ddf5b3c8fa14e3e8c2e91461`;
- Application CI #920: SUCCESS;
- Core Protection #207: SUCCESS;
- Production Build: SUCCESS;
- Final TypeScript: SUCCESS;
- Diff Hygiene: SUCCESS;
- scanner contract tests: SUCCESS;
- platform scanner guard: SUCCESS;
- Integration 1 domain tests: SUCCESS;
- Integration 1 guard: SUCCESS;
- Phase 6 locations: SUCCESS;
- Phase 8 barcode/outbound: SUCCESS.

Correção de integração:
- o primeiro CI detectou `workspace.ug: string | null`;
- glue corrigido para falhar fechado quando UG não estiver resolvida;
- revalidação final verde.

Pendências físicas:
- confirmar header HTTP efetivo;
- câmera real;
- imprimir e ler Code 128 nos presets COMPACT/MEDIUM/LARGE.

Essas pendências permanecem obrigatórias para certificação física/final, mas não bloqueiam o início da Onda 2.

**MOBILE-C, MOBILE-D e MOBILE-E estão liberadas.**


## 10. Reconciliação SaaS R1 ↔ MOBILE-R1 antes da Onda 2

Gate executado pelo Coordenador em 2026-10-02 após identificar nova orientação canônica no Memorial da integradora SaaS.

Estado SaaS observado:
- SAAS-I: integrada via squash `25dda4876fedabb498ad30139262b11943412273`;
- SAAS-P: **EM EXECUÇÃO**;
- PILOT-A/B/C/D ativados em paralelo;
- nenhuma promoção SaaS para `main`/produção.

Arquivos/contratos críticos comparados entre `feat/saas-r1-commercializacao` e `feat/central-mobile-r1`:

**Idênticos semanticamente e por conteúdo:**
- `components/legal/LegalAcceptanceGate.tsx`;
- `lib/workspaceContext.ts`;
- `lib/platformAccess.ts`;
- `lib/platformSessionControl.ts`;
- `lib/warehouse/featureFlag.ts`;
- `firestore.rules`;
- `firestore.warehouse.rules`;
- `app/layout.tsx`.

**Divergências esperadas e classificadas:**
- `features/warehouse/components/WarehouseProtectedSurface.tsx`: MOBILE-R1 adiciona `WarehouseAccessBoundary` para reutilizar o mesmo gate SaaS/Auth/legal com shell móvel; não altera semântica de autorização;
- `package.json`: SaaS possui tooling `test:gcloud-command`/recovery do piloto; Mobile possui scripts de scanner/Integração 1; sem conflito de runtime;
- `.github/workflows/application-ci.yml`: Mobile adiciona guards próprios da Central Móvel; divergência intencional de CI.

Classificação:
**RECONCILIAÇÃO SEMÂNTICA — PASS / SEM BLOQUEIO PARA ONDA 2**.

Não é necessário incorporar tooling operacional SAAS-P na base Mobile para C/D/E.

Regra nova permanente:
- worker Mobile que tocar domínio compartilhado deve registrar **Impacto SAAS-R1**;
- Coordenador deve repetir a checagem antes de integrar delta transversal, antes da Integração 2 se houver upstream SaaS novo, antes de MOBILE-I e MOBILE-J;
- nunca sincronizar integradoras por merge/rebase bruto.

A base anterior da Onda 2 será substituída por novo freeze documental para que C/D/E recebam estas orientações antes de iniciar.


### Revisão MOBILE-C — 2026-10-02

- branch: `mobile-r1-c-intake-allocation`;
- base: `6852963c7aa9a1c83133239f0b929715fd316530`;
- HEAD: `6828273ee4c957fa92e42922363d2e1dcf296d89`;
- PR #229: draft, mergeable, não integrado;
- classificação: **APROVADA / AGUARDANDO ORDEM DE INTEGRAÇÃO**;
- Application CI #928: SUCCESS;
- Core Protection #215: SUCCESS;
- Recovery #611: SUCCESS;
- SAAS-DL Legal #35: SUCCESS;
- build/typecheck/diff hygiene/release gates 16–21: SUCCESS.

Contratos confirmados:
- ALLOCATE oficial e transacional;
- snapshot concorrente;
- idempotência por operationId;
- barcode desconhecido somente no commit atômico;
- conflito de material bloqueado;
- EPX1/resolver oficial;
- nenhuma escrita client-side de saldo/ledger/barcode;
- nenhuma fonte de verdade paralela.

Performance:
- baseline Integração 1 da home móvel: ~249 kB First Load;
- MOBILE-C: 253 kB;
- delta aproximado: +4 kB;
- rota /central-mobile/alocar: 274 kB First Load.

Impacto SAAS-R1:
- sem impacto funcional;
- package/CI apenas registram gates da MOBILE-C;
- nenhuma reconciliação SaaS necessária neste ponto.

Decisão de integração:
**AGUARDAR MOBILE-E**, preservando a ordem preferencial E → C → D definida no Plano Mestre.


### Integração MOBILE-E — 2026-10-02

- branch: `mobile-r1-e-physical-query`;
- base: `6852963c7aa9a1c83133239f0b929715fd316530`;
- worker HEAD: `fff6fa3ca7588cec4ecf0c3c76d141dda357c626`;
- PR #230;
- classificação: **APROVADA**;
- integração squash: `e768ee5f554dc3016951bd7cebc54c69feba3bd3`;
- Application CI #930: SUCCESS;
- Core Protection #217: SUCCESS;
- Recovery #612: SUCCESS;
- SAAS-DL Legal #36: SUCCESS;
- Production Build / Final TypeScript / Diff Hygiene: SUCCESS.

Contratos:
- consulta física estritamente read-only;
- EPX1/resolver/posição reutilizados;
- reads bounded por posição;
- 0 listeners permanentes;
- sem escrita em estoque/saldo/ledger/lote;
- fail-closed em overflow ou inconsistência;
- sem impacto funcional no SaaS R1.

Performance:
- /central-mobile: ~249 kB → ~252 kB First Load;
- delta aproximado: +3 kB;
- desktop/shared sem regressão observada.

Ordem da Onda 2:
**E integrada → C próxima → D depois.**


### Integração MOBILE-C — 2026-10-02

Worker aprovado:
- branch: `mobile-r1-c-intake-allocation`;
- base: `6852963c7aa9a1c83133239f0b929715fd316530`;
- HEAD: `6828273ee4c957fa92e42922363d2e1dcf296d89`;
- PR worker #229.

Após a MOBILE-E, o PR #229 passou a ter conflito mecânico esperado em:
- `package.json`;
- `.github/workflows/application-ci.yml`.

Integração semântica coordenada:
- branch técnica: `mobile-r1-integration-2-c`;
- PR #232;
- HEAD certificado: `82e9df17c83644acb969a7434e89ea2c6ea686de`;
- squash: `1c523fe2dccbd7248fd3f845d9169261da7edc65`.

Preservado:
- código funcional aprovado da MOBILE-C;
- gates e consulta read-only da MOBILE-E;
- ALLOCATE oficial;
- idempotência;
- revalidação concorrente;
- nenhuma escrita client-side de saldo/ledger/barcode;
- scripts/gates de E e C simultaneamente.

Certificação combinada:
- Application CI #931: SUCCESS;
- Core Protection #218: SUCCESS;
- Recovery #613: SUCCESS;
- SAAS-DL Legal #37: SUCCESS;
- MOBILE-E domain tests/guard: SUCCESS;
- MOBILE-C domain tests/guard: SUCCESS;
- Production Build: SUCCESS;
- Final TypeScript: SUCCESS;
- Diff Hygiene: SUCCESS;
- Release Gates 16–21: SUCCESS.

PR #229 foi encerrado sem merge direto porque seu conteúdo foi incorporado semanticamente pelo PR #232.

Estado da Onda 2:
- MOBILE-E: integrada;
- MOBILE-C: integrada;
- MOBILE-D: aguardando handoff/revisão;
- Integração 2: ainda não encerrada.


### Revisão MOBILE-D — 2026-10-02

Handoff:
- branch `mobile-r1-d-transfer`;
- base `6852963c7aa9a1c83133239f0b929715fd316530`;
- HEAD `4d3d75be98786d4470b593759580f50683a8f31b`;
- PR #231;
- Application CI #929: SUCCESS;
- Core Protection #216: SUCCESS.

Classificação:
**DEVOLVIDA PARA CORREÇÃO MÍNIMA DE INTEGRIDADE**.

Arquitetura principal aprovada:
- TRANSFER canônico;
- quantityDelta=0;
- idempotência/replay;
- revalidação de posições/material/saldo;
- nenhuma escrita direta client-side.

Bloqueios:
1. `listWarehouseLots` legado converte erro de leitura em `[]`; a MOBILE-D não pode interpretar falha como “sem lote” para autorizar parcial;
2. limite canônico de 24 lotes relocáveis precisa ser validado antes do TRANSFER;
3. token EPX1 malformado/reservado não pode ser promovido a PRODUCT.

Integração 2 permanece aberta. E+C continuam integradas e verdes; D deve voltar com novo HEAD sem rebase/merge.


### Integração MOBILE-D e Integração 2 — 2026-10-03

MOBILE-D corrigida:
- worker: `mobile-r1-d-transfer`;
- base: `6852963c7aa9a1c83133239f0b929715fd316530`;
- HEAD final: `4549b280b483d935373604a8c2b2a54a140684f0`;
- PR worker #231, fechado sem merge direto;
- Application CI #932: SUCCESS;
- Core Protection #219: SUCCESS.

Correções confirmadas:
- leitura crítica de lotes fail-closed;
- MAX 500 + FETCH_LIMIT 501 para saturação;
- erro de leitura não vira lista vazia;
- limite de 24 lotes pré-validado;
- 25 lotes bloqueiam antes do TRANSFER;
- EPX1 malformado/reservado permanece UNKNOWN;
- TRANSFER canônico, quantityDelta=0 e replay idempotente preservados.

Integração semântica da D:
- branch técnica: `mobile-r1-integration-2-d`;
- PR #234;
- HEAD certificado: `2469e08b90251a52431b83e6db07841f849dc69c`;
- squash: `fc87bf8f9e67bc4abea6332a09059cfcfd6260fe`;
- classificador da D passou a delegar ao helper canônico da MOBILE-C;
- Home preservou alocação + transferência + consulta física.

Certificação final da Integração 2:
- branch: `mobile-r1-integration-2-certification`;
- PR #235;
- HEAD certificado: `12df2f1ab6524e80322866ad8a5af59eeb51d49d`;
- squash: `d8148f01b877adad1e7880fc0b7fc6d4b3d60249`;
- Application CI #934: SUCCESS;
- Core Protection #221: SUCCESS;
- Recovery #614: SUCCESS;
- SAAS-DL Legal #38: SUCCESS;
- Integration 2 domain tests: SUCCESS;
- Integration 2 guard: SUCCESS;
- Phase 6/7/8: SUCCESS;
- MOBILE-E tests/guard: SUCCESS;
- MOBILE-C tests/guard: SUCCESS;
- Production Build: SUCCESS;
- Final TypeScript: SUCCESS;
- Diff Hygiene: SUCCESS;
- Release Gates 16–21: SUCCESS.

Jornada certificada:
`alocar → consultar A → transferir A→B → consultar A/B → preservar total físico`.

Build certificado:
- `/central-mobile`: 5.49 kB / 257 kB First Load;
- `/central-mobile/alocar`: 20.9 kB / 275 kB;
- `/central-mobile/transferir`: 6.93 kB / 261 kB;
- Shared First Load: 104 kB.

Classificação:
**INTEGRAÇÃO 2 APROVADA E CERTIFICADA**.

### Reconciliação SaaS R1 ↔ MOBILE-R1 antes da Onda 3

Estado SaaS observado:
- `feat/saas-r1-commercializacao@4848643be85b30532f7f093c4ddb0e729facfad3`;
- hardening pré-piloto ativo;
- piloto real adiado até RC;
- SAAS-J aguardando.

Contratos idênticos entre integradoras:
- LegalAcceptanceGate;
- workspaceContext;
- platformAccess;
- platformSessionControl;
- warehouse feature flag;
- firestore.rules;
- firestore.warehouse.rules;
- app/layout.tsx.

Divergências esperadas:
- Mobile mantém `WarehouseAccessBoundary` e guards/scanner/Integrações 1–2;
- SaaS mantém tooling de recovery/hardening;
- package/CI diferem apenas pelos gates próprios de cada programa.

Resultado:
**PASS — SEM BLOQUEIO TRANSVERSAL PARA MOBILE-F/G/H**.

A Onda 3 pode ser congelada e ativada. MOBILE-I/J permanecem bloqueadas.


### Freeze da Onda 3 — 2026-10-03

Base comum:
`c971d5356c343a0819bf96ec016de73dd96a435d`.

Branches criadas exatamente nesse SHA:
- `mobile-r1-f-inventory`;
- `mobile-r1-g-outbound`;
- `mobile-r1-h-position-check`.

MOBILE-I/J permanecem bloqueadas até Integração 3.


## 11. Adaptação ao EMPROVEX Program Control — 2026-10-03

A MOBILE-R1 passa a operar formalmente como **Coordenador de Programa** subordinado ao **EMPROVEX Program Control / Coordenador Geral** apenas para decisões globais/transversais.

Autonomia preservada do Coordenador Mobile:
- ondas Mobile;
- freezes;
- workers Mobile;
- revisão de HEAD/PR/diff/CI;
- devoluções;
- integração semântica local;
- documentação especializada Mobile;
- PASS/PARCIAL/BLOQUEADO dentro do programa.

Propriedade documental:
- documentos `CENTRAL_MOBILE_R1_*`: Coordenador Mobile;
- estado global do `EMPROVEX_MEMORIAL_OFICIAL.md`: propriedade lógica do Coordenador Geral;
- o Coordenador Mobile passa a fornecer **delta certificado** em vez de editar por padrão o estado global.

### Auditoria viva na adaptação

Produção:
- `main@e90f92acae1514ee5cbc6ce95fed354bc1454330`;
- não alterada pela MOBILE-R1.

Integradora Mobile:
- `feat/central-mobile-r1@64de6a414d00e0b151a5e07a1f2add7606936165`;
- HEAD atual é documental;
- último estado operacional certificado da Integração 2 foi incorporado pelo squash `d8148f01b877adad1e7880fc0b7fc6d4b3d60249`.

Integradora SaaS:
- `feat/saas-r1-commercializacao@4848643be85b30532f7f093c4ddb0e729facfad3`.

Workers da Onda 2:
- MOBILE-E: concluída/integrada;
- MOBILE-C: concluída/integrada semanticamente;
- MOBILE-D: concluída/corrigida/integrada semanticamente;
- handoffs pendentes C/D/E: nenhum.

Onda 3:
- branches F/G/H existem em `c971d5356c343a0819bf96ec016de73dd96a435d`;
- F/G/H continuam **idênticas ao freeze e ainda não iniciadas**;
- após adoção do Program Control, a ativação fica aguardando decisão da barreira global, sem recriar ou mover branches.

### Delta transversal identificado

`next.config.ts`:
- Mobile: `Permissions-Policy: camera=(self), microphone=(), geolocation=()`;
- SaaS: `Permissions-Policy: camera=(), microphone=(), geolocation=()`;
- classificação: **DELTA COMPATÍVEL, MAS TRANSVERSAL / REQUER COORDENADOR GERAL**;
- razão: câmera same-origin é requisito funcional da Central Móvel; `next.config.ts` e Permissions-Policy são contrato global de navegador;
- nenhuma reconciliação automática será feita pelo Coordenador Mobile.

Outras divergências esperadas:
- `WarehouseProtectedSurface.tsx`: extensão Mobile `WarehouseAccessBoundary`;
- package/CI: tooling e gates próprios de cada programa.

Contratos críticos sem delta:
- Auth;
- workspace/UG;
- sessão/lease;
- LegalAcceptanceGate;
- warehouse feature flag/access;
- `firestore.rules`;
- `firestore.warehouse.rules`.

### HARDEN-D

Branch:
`saas-harden-d-mobile-reconciliation`.

Base:
`f8d2a53bfadf2548a59f49cdfc3cdb3d420f0b11`.

Estado na auditoria:
- identical à base;
- não iniciada.

Recomendação do Coordenador Mobile:
**MOBILE-R1 está suficientemente estável para HARDEN-D: SIM.**

Esta é a barreira preferencial porque:
- C/D/E já fecharam;
- Integração 2 está certificada;
- F/G/H ainda não começaram;
- existe um delta transversal concreto de Permissions-Policy para reconciliar.

Semáforo recomendado:
- MOBILE-R1: **AMARELO** — localmente estável, aguardando decisão transversal;
- MOBILE-C: **VERDE / CONCLUÍDA**;
- MOBILE-D: **VERDE / CONCLUÍDA**;
- MOBILE-E: **VERDE / CONCLUÍDA**;
- F/G/H: **AGUARDAR ATIVAÇÃO** até decisão do Coordenador Geral sobre a barreira HARDEN-D.

Nenhuma autorização de produção é necessária neste momento.


### Liberação formal da Onda 3 pelo Program Control — 2026-10-03

HARDEN-D:
- concluída;
- auditada pelo Coordenador SaaS;
- aceita pelo Program Control;
- resultado: PASS técnico.

CT-01:
- `Permissions-Policy`;
- contrato obrigatório do futuro RC: `camera=(self), microphone=(), geolocation=()`;
- propriedade: integração SaaS/composição do RC;
- não é blocker de F/G/H;
- não alterar `next.config.ts` na Onda 3 por causa da CT-01.

Onda 3:
- MOBILE-F: ATIVADA;
- MOBILE-G: ATIVADA;
- MOBILE-H: ATIVADA;
- freeze preservado: `c971d5356c343a0819bf96ec016de73dd96a435d`;
- branches não foram recriadas, movidas, rebaseadas ou fast-forwarded.

MOBILE-I/J permanecem bloqueadas até Integração 3 e decisão do Program Control.


### Revisão MOBILE-F — 2026-10-03

Worker:
- branch `mobile-r1-f-inventory`;
- base `c971d5356c343a0819bf96ec016de73dd96a435d`;
- HEAD `42954adab43694816262720581abad2bc0761d4c`;
- PR #239;
- estado: draft / mergeable / não mergeado.

Classificação:
**APROVADA / CONGELADA — AGUARDANDO MOBILE-G E MOBILE-H**.

Evidências:
- Application CI #935 SUCCESS;
- Core #222 SUCCESS;
- Recovery #615 SUCCESS;
- Legal #39 SUCCESS;
- MOBILE-F tests/guard SUCCESS;
- Phase 10 inventory tests/guard SUCCESS;
- Integration 2 SUCCESS;
- Production Build / Final TypeScript / Diff Hygiene SUCCESS.

Contratos preservados:
- inventário canônico;
- salvar contagem não altera saldo;
- confirmação humana antes do INVENTORY_ADJUSTMENT;
- STALE/RECONCILIATION_REQUIRED fail-closed;
- sem saldo/ledger paralelo;
- sem schema persistente novo;
- 0 listeners realtime novos.

Performance:
- /central-mobile: 5.03 kB / 257 kB;
- /central-mobile/inventario: 16.7 kB / 271 kB;
- Shared First Load: 104 kB.

Impacto transversal:
**SEM NOVO DELTA TRANSVERSAL**.
Package/CI possuem apenas gates aditivos da MOBILE-F.

Integração:
- não executar ainda;
- aguardar handoffs/revisões de G e H;
- definir ordem semântica somente com as três frentes conhecidas.


### Revisão MOBILE-H — 2026-10-03

Worker:
- branch `mobile-r1-h-position-check`;
- base `c971d5356c343a0819bf96ec016de73dd96a435d`;
- HEAD `f30f4dcbb1d03d15230fa4414a7d1b95e231253e`;
- PR #241;
- estado: draft / mergeable / não mergeado.

Classificação:
**APROVADA / CONGELADA — AGUARDANDO MOBILE-G**.

Evidências:
- Application CI #937 SUCCESS;
- Core #224 SUCCESS;
- Recovery #616 SUCCESS;
- Legal #40 SUCCESS;
- MOBILE-H tests/guard SUCCESS;
- physical query SUCCESS;
- Phase 6/7/8 SUCCESS;
- Integration 2 SUCCESS;
- Production Build / Final TypeScript / Diff Hygiene SUCCESS.

Contratos preservados:
- jornada read-only posição → material → CORRETO/INCORRETO;
- MOBILE-E como projeção física oficial;
- alternativas por materialId bounded 60+1;
- saturação e concorrência fail-closed;
- revalidação EPX1 das alternativas;
- nenhuma mutação, ledger ou operação de estoque;
- navegação para MOBILE-D sem execução;
- 0 listeners e nenhuma coleção/índice novo.

Performance:
- /central-mobile/conferir: 8.81 kB / 260 kB;
- /central-mobile: 257 kB;
- Shared First Load: 104 kB.

Impacto transversal:
**SEM NOVO DELTA TRANSVERSAL**.

Integração:
- não executar ainda;
- F e H permanecem congeladas nos HEADs aprovados;
- aguardar handoff/revisão de G;
- definir ordem semântica F/G/H somente depois.
