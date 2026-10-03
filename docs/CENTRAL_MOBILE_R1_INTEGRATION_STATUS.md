# EMPROVEX — Central Móvel R1 — Integration Status

Última atualização: **2026-10-02**
Integrador: `feat/central-mobile-r1`
Produção de referência: `main@e90f92acae1514ee5cbc6ce95fed354bc1454330`
Baseline upstream MOBILE-0: `78d3e9afeeb4176a8d6423cdd8e65d32435ba0a9`
Freeze documental / base comum da Onda 1: `53e28b81874ee1b7ce0bd484cc7a97537aa99473`
Freeze documental / base comum da Onda 2 após reconciliação SaaS: `6852963c7aa9a1c83133239f0b929715fd316530`

Estado global: **ONDA 1 INTEGRADA / INTEGRAÇÃO 1 APROVADA / ONDA 2 LIBERADA — MOBILE-C + MOBILE-D + MOBILE-E**

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
| MOBILE-C Alocação | `mobile-r1-c-intake-allocation` | A+B+Int.1 | **APROVADA / AGUARDANDO INTEGRAÇÃO** | PR #229; HEAD `6828273e...`; integrar após MOBILE-E |
| MOBILE-D Transferência | `mobile-r1-d-transfer` | A+B+Int.1 | **LIBERADA / BRANCH CRIADA** | base `6852963c7...`; aguardando worker |
| MOBILE-E Consulta | `mobile-r1-e-physical-query` | A+B+Int.1 | **APROVADA E INTEGRADA** | PR #230 / squash `e768ee5f...` |
| MOBILE-F Inventário | `mobile-r1-f-inventory` | Int.2 | **BLOQUEADA** | — |
| MOBILE-G Saída | `mobile-r1-g-outbound` | Int.2 | **BLOQUEADA** | — |
| MOBILE-H Conferência | `mobile-r1-h-position-check` | Int.2 | **BLOQUEADA** | — |
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

1. congelar o HEAD comum da Onda 2;
2. criar MOBILE-C, MOBILE-D e MOBILE-E na mesma base;
3. emitir prompts especializados;
4. receber handoffs independentes;
5. integrar preferencialmente E → C → D, salvo conflito real;
6. manter MOBILE-F/G/H bloqueadas até a Integração 2.

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
