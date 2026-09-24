# FASE 11 — Entregas, Dashboard Logístico e Alertas

## Escopo

A FASE 11 implementa DEP-22, DEP-22.1, DEP-23, DEP-23.1 e DEP-23.2 do ADM Depósito sem criar fontes paralelas de verdade.

## Fontes de verdade preservadas

- **Cronograma** continua sendo o cronograma operacional existente em `workspaces/{workspaceId}/cronogramas`.
- **Nota Fiscal** continua sendo o evento de recebimento já existente no EMPROVEX.
- **Estoque** continua derivado do ledger/aggregate do ADM Depósito e da integração NF → estoque criada na FASE 4.
- A FASE 11 **não cria um segundo recebimento** e **não cria associação artificial NF ↔ remessa**.
- NFs anteriores ao cutoff continuam visíveis operacionalmente, mas não são retrointegradas silenciosamente ao estoque.

## Entregas

A visão de Entregas combina Empenho + Cronograma + NFs. O progresso recebido é derivado do próprio Empenho, atualizado pelo fluxo oficial de NF. O atraso é calculado cumulativamente por item: quantidade prevista até a data menos quantidade efetivamente recebida, sem permitir que excesso de um item masque falta de outro.

## Dashboard logístico

O Dashboard usa dados reais e consultas bounded. Não introduz listeners globais em tempo real. Exibe, entre outros, estoque zerado, baixo estoque quando configurado, materiais sem localização, lotes vencidos/próximos do vencimento, entregas vencidas/próximas, inventários com atenção e divergências SISCOFIS.

## Alertas

A FASE 11 reutiliza a **Central de Avisos** existente. Alertas logísticos possuem IDs determinísticos no prefixo `warehouse-logistics-`, são reconciliados de forma idempotente e são resolvidos em vez de apagados quando a causa deixa de existir.

O alerta de estoque zerado é objetivo. O alerta de baixo estoque só é habilitado quando o fundador configura explicitamente um limiar em `warehouse/{workspaceId}/settings/logistics-alerts`; não existe limiar arbitrário embutido.

## Segurança e desempenho

O ADM Depósito permanece founder-only. As regras do Firestore não concedem acesso ao módulo a usuários externos. As leituras operacionais da FASE 11 são limitadas (bounded) e não adicionam `onSnapshot` globais.

## Gates

A fase mantém teste de domínio próprio, guard permanente, testes de segurança Firestore e Browser E2E antes do merge funcional. O encerramento documental posterior é docs-only e não deve disparar Application CI.
