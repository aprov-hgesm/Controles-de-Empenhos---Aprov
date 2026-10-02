# EMPROVEX — Central Móvel R1 — Integration Status

Última atualização: **2026-10-02**
Integrador: `feat/central-mobile-r1`
Produção de referência: `main@e90f92acae1514ee5cbc6ce95fed354bc1454330`
Baseline upstream MOBILE-0: `78d3e9afeeb4176a8d6423cdd8e65d32435ba0a9`
Freeze documental / base comum da Onda 1: `53e28b81874ee1b7ce0bd484cc7a97537aa99473`

Estado global: **MOBILE-0 CONGELADA / ONDA 1 LIBERADA — SOMENTE MOBILE-A + MOBILE-B**

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
| MOBILE-A Plataforma/Scanner | `mobile-r1-a-platform-scanner` | 0 | **DEVOLVIDA — CORREÇÃO MÍNIMA** | PR #221; câmera bloqueada por Permissions-Policy + lifecycle Strict Mode |
| MOBILE-B Etiquetas/Resolver | `mobile-r1-b-location-labels` | 0 | **APROVADA E INTEGRADA** | PR #220 / squash `5edb19812...` |
| MOBILE-C Alocação | `mobile-r1-c-intake-allocation` | A+B+Int.1 | **BLOQUEADA** | — |
| MOBILE-D Transferência | `mobile-r1-d-transfer` | A+B+Int.1 | **BLOQUEADA** | — |
| MOBILE-E Consulta | `mobile-r1-e-physical-query` | A+B+Int.1 | **BLOQUEADA** | — |
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

1. criar as branches MOBILE-A e MOBILE-B no mesmo HEAD congelado;
2. registrar o SHA comum de ativação;
3. emitir prompts especializados para os dois workers;
4. receber handoffs independentes;
5. manter C–H bloqueadas;
6. conduzir a Integração 1 somente após A+B aprovadas.

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
