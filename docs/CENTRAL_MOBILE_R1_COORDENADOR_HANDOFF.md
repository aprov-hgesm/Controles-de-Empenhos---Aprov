# EMPROVEX — Central Móvel R1 — Handoff do Coordenador

Última atualização: **2026-10-02**
Programa: **MOBILE-R1**
Integrador: `feat/central-mobile-r1`

## 1. Missão

Governar a Central Móvel R1 pelo método oficial de execução paralela, sem duplicar domínio de estoque e sem competir com workers.

## 2. Leitura obrigatória

1. `docs/EMPROVEX_MEMORIAL_OFICIAL.md`;
2. `docs/CENTRAL_MOBILE_R1_PLANO_MESTRE.md`;
3. `docs/CENTRAL_MOBILE_R1_EXECUCAO_PARALELA.md`;
4. `docs/CENTRAL_MOBILE_R1_INTEGRATION_STATUS.md`;
5. este arquivo;
6. `docs/TESTING_POLICY.md`;
7. `docs/DEVELOPMENT_CI_WORKFLOW.md`;
8. documentação `docs/adm-deposito/*`.

## 3. Baseline congelado

Branch integradora criada de:
`saas-r1-i-integration@78d3e9afeeb4176a8d6423cdd8e65d32435ba0a9`

Freeze documental usado como base idêntica de MOBILE-A e MOBILE-B:
`feat/central-mobile-r1@53e28b81874ee1b7ce0bd484cc7a97537aa99473`

O baseline tinha:
- Application CI #908 verde;
- Core #195 verde;
- Recovery #595 verde;
- Legal #20 verde.

## 4. Dependência SaaS

A MOBILE-R1 não é proprietária de SAAS-I.

Razão do baseline:
- SAAS-I altera shell e Central;
- iniciar mobile sobre integradora SaaS anterior criaria conflito conhecido.

Obrigatório:
- antes de MOBILE-I, comparar/reconciliar com estado SaaS consolidado;
- workers móveis não editam billing/legal/lifecycle para “acompanhar” SaaS.

## 5. Decisões congeladas

- web mobile, não app nativo;
- mesmo login;
- mesma autorização;
- mesma base operacional;
- online-first;
- scanner único;
- location barcode separado de product barcode;
- etiqueta resolve posição estável;
- barcode não autoriza;
- C/D/E dependem da Integração 1;
- F/G/H dependem da Integração 2;
- MOBILE-I/J são do Coordenador.

## 6. Primeira onda

**LIBERADA após o freeze MOBILE-0.**

Branches já criadas na mesma base `53e28b818...`:
- MOBILE-A — `mobile-r1-a-platform-scanner`;
- MOBILE-B — `mobile-r1-b-location-labels`.

Não criar workers C–H antecipadamente se isso induzir desenvolvimento antes dos contratos compartilhados estarem integrados.

## 7. Papel de A

Fundação móvel/scanner.

Não mexer em ledger/intake/outbound/inventory.

## 8. Papel de B

Etiquetas/resolver.

Não mexer em scanner/ledger/movimentos.

## 9. Próximo gate

Receber e aprovar os handoffs independentes de MOBILE-A e MOBILE-B. Depois executar a Integração 1:
scanner → tipo → resolver → posição.

Sem estoque.

## 10. Estado de produção

Produção permanece:
`main@e90f92acae1514ee5cbc6ce95fed354bc1454330`

Nenhum release MOBILE autorizado.

## 11. Regra de comunicação

Ao receber worker:
- não aceitar “deu certo” sem evidência;
- verificar HEAD;
- verificar diff;
- verificar gates;
- verificar contratos;
- atualizar status.

## 12. Critério de troca

Antes de encerrar uma conversa Coordenadora:
- atualizar Status;
- atualizar Handoff;
- registrar novos HEADs;
- registrar bloqueios;
- registrar próxima ação exata.


## 13. Revisão MOBILE-A — devolução controlada

Em 2026-10-02 o Coordenador revisou o PR #221 / HEAD `6abc35c60e5b0674f0e034b6da1476936345e41f`.

Estado:
**DEVOLVIDA PARA CORREÇÃO MÍNIMA; NÃO INTEGRAR AINDA.**

Dois bloqueios:
- Permissions-Policy global `camera=()` impede a própria câmera da Central Móvel;
- lifecycle de `mountedRef` não é resiliente ao Strict Mode habilitado no projeto.

A trabalhadora recebeu autorização estreita para corrigir:
- header de câmera em `next.config.ts`;
- lifecycle do scanner;
- testes/guards correspondentes.

MOBILE-B segue independente.

Ao receber novo handoff A:
1. confirmar que o diff adicional ficou restrito;
2. confirmar header efetivo de `/central-mobile`;
3. confirmar Strict Mode resiliente;
4. revalidar gates;
5. somente então reclassificar/integrar.
