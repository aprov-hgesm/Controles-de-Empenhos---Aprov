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

Branch criada de:
`saas-r1-i-integration@78d3e9afeeb4176a8d6423cdd8e65d32435ba0a9`

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

Liberar apenas:
- MOBILE-A;
- MOBILE-B.

Não criar workers C–H antecipadamente se isso induzir desenvolvimento antes dos contratos compartilhados estarem integrados.

## 7. Papel de A

Fundação móvel/scanner.

Não mexer em ledger/intake/outbound/inventory.

## 8. Papel de B

Etiquetas/resolver.

Não mexer em scanner/ledger/movimentos.

## 9. Próximo gate

Integração 1:
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
