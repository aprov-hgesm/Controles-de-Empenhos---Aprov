# EMPROVEX — Central Móvel R1 — Integration Status

Última atualização: **2026-10-02**
Integrador: `feat/central-mobile-r1`
Produção de referência: `main@e90f92acae1514ee5cbc6ce95fed354bc1454330`
Baseline MOBILE-0: `78d3e9afeeb4176a8d6423cdd8e65d32435ba0a9`

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
| MOBILE-A Plataforma/Scanner | `mobile-r1-a-platform-scanner` | 0 | **LIBERADA PARA EXECUÇÃO** | aguardando worker |
| MOBILE-B Etiquetas/Resolver | `mobile-r1-b-location-labels` | 0 | **LIBERADA PARA EXECUÇÃO** | aguardando worker |
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
