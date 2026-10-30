# EMPROVEX — Mensalidade Compartilhada R1
**Status:** implementação em branch para homologação; não publicar cobrança compartilhada sem validação.
**Referência:** 29/10/2026.

## Decisão de negócio
Uma única conta compartilhada, um workspace e uma única assinatura por setor. A divisão ocorre **somente no pagamento** e não cria identidades, perfis, usuários, sessões, acessos nem licenças adicionais.

- Adesão opcional por competência, de 2 a 20 participantes identificados por nome (sem CPF/e-mail adicional).
- Cotas rigorosamente iguais, com arredondamento para cima ao próximo centavo.
- Taxa de divisão = (quantidade × valor da cota) − mensalidade. Exemplos: R$ 29,90/3 → R$ 9,97 cada, taxa R$ 0,01; R$ 29,90/4 → R$ 7,48, taxa R$ 0,02; R$ 69,90/4 → R$ 17,48, taxa R$ 0,02.
- A taxa é **do EMPROVEX, por arredondamento**, não tarifa da InfinitePay, e deve aparecer antes da aceitação e nos Termos.
- O aceite é expresso e imutável para a competência. A configuração não pode substituir uma cobrança integral já iniciada nem um rateio diferente.
- Os integrantes recebem links separáveis para copiar ou abrir; o pagamento por qualquer pessoa da cota pendente é permitido.
- Todas as cotas devem estar verificadas para que a mensalidade seja marcada como paga. Vencimento e tolerância seguem as políticas existentes.

## Implementação
- lib/server/payments/sharedBilling.mjs: cálculos inteiros e transições puras.
- lib/billing.ts: campo opcional sharedPayment no ciclo já existente.
- lib/server/platformBillingSharedStore.ts: configuração imutável, geração de um checkout/intent por cota, confirmação payment_check por transação e ledger idempotente em Firestore, com baixa coletiva transacional.
- app/api/billing/portal/route.ts: GET view=shared; POST configure-shared, POST shared-checkout; conciliação do retorno e do webhook por tipo de intent.
- components/billing/SharedBillingPanel.tsx: escolha de 2 a 20, nomes, prévia da taxa e dos valores, aceite, links individuais, progresso de quitação.
- app/terms/page.tsx: cláusula específica do arredondamento e da quitação coletiva.
- Controle de implantação: EMPROVEX_SHARED_BILLING_ENABLED=0 por padrão. Não inserir chave de API no navegador.
- O checkout tradicional permanece funcional para ciclos não compartilhados.

## Critérios de homologação
1. Testes unitários de rateio, testes InfinitePay existentes e TypeScript PASS.
2. Sem conta adicional ou alteração nas regras de login, no workspace ou no preço base.
3. Não permitir rateio sobre ciclo com checkout tradicional existente; não permitir checkout tradicional quando ciclo compartilhado.
4. Concorrência: duas chamadas do mesmo link não criam pedidos adicionais; timeout externo leva a conferência sem novo POST automático.
5. Conciliação: pagamento de uma cota não libera a competência; o último pagamento confirmado libera, atomizando ciclo, ledger e direitos.
6. Verificação de valor e identificador via API oficial; webhook/redirect não confirmam pagamentos isoladamente.
7. Repetição de webhook e múltiplos logins compartilhados não duplicam receita; reembolso/cancelamento exigem revisão sem suspensão automática.
8. VIPs, fundador e contratos legados não entram no rateio; políticas de preços progressivos permanecem.
9. Confirmar prestação de informações, recibos e incidência tributária da taxa com responsável jurídico-contábil antes de habilitar o piloto.

## Limites de R1
- Os participantes são identificações internas, não contas EMPROVEX.
- A configuração é feita por competência; não há reaproveitamento automático do grupo no mês seguinte.
- O piloto só pode ser ativado mediante flag e escopo da InfinitePay. Não fazer Pix em produção apenas para testar sem supervisão.
- Não há gateway split ou distribuição do dinheiro para diferentes recebedores.
