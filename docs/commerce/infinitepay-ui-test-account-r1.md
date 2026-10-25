# EMPROVEX — QA da interface InfinitePay com usuário de teste

**PR:** #384 (interface). **Dependência:** PR #382 (motor financeiro, ainda não ligado à UI).
**Ambiente pretendido:** Vercel Preview isolado e autenticado, **não** a produção emprovex.com.br.
**Estado da integração:** somente leitura, sem emissão de links nem confirmação de pagamento.

## Conta de teste

Referência histórica: **Aprovisionamento Teste**, workspace esperado `aprovisionamento-teste`. Identificação canônica, UID e autorização devem ser **confirmados pela própria sessão** e pelo diretório atual; não confiar somente nesse nome, em texto digitado ou na API de cobrança.

O usuário tester deverá entrar pela tela de login normal do EMPROVEX, sem compartilhar senha, token de sessão, cookie ou API Key com terceiros.

## Passo a passo manual

1. No PR #384, confirme os status de CI, especialmente `InfinitePay Payment UI Preview` e `EMPROVEX Fast CI`.
2. Abra a **URL específica do Preview** que pertença ao projeto `controles-de-empenhos-aprov` e corresponda ao commit de #384. Não supor URL pela branch ou alterar domínio principal.
3. Entre com a conta de teste pelo fluxo normal do EMPROVEX.
4. No cabeçalho do aplicativo autenticado, clique em **Minha assinatura**. A navegação interna preserva o contexto de workspace que já foi validado na sessão.
5. Confira se a página mostra a identidade autenticada e o nome do workspace conforme a sessão. Se aparecer sessão sem workspace validado, volte ao login e reporte um bloqueio de integração de contexto; **não prossiga ao pagamento**.
6. Confira que a situação comercial é lida por `useWorkspaceBillingAccount` e pode mostrar `trial`, `active`, `pending`, `exempt`, `suspended`, `canceled` ou ausência de documento. Não alterar documentos para forçar PASS.
7. Confirme que a seção InfinitePay está em **homologação** e o botão **Pagar com InfinitePay** está desabilitado; o checkout legado, se cadastrado, continua como fluxo separado.
8. Confira a tabela indicativa de novos assinantes: meses 1–3 R$29,90; 4–6 R$39,90; 7–9 R$49,90; 10–12 R$59,90; mês 13+ R$69,90; a tabela NÃO substitui o preço real da conta até persistência do contrato.
9. Para testar o retorno da InfinitePay **sem transação real**, use uma query com identificadores fictícios em um Preview da página de regularização: `/regularizacao?order_nsu=ficticio&transaction_nsu=ficticio&slug=ficticio`. A tela deve mostrar aviso de **não verificado**, remover os parâmetros da URL e não alterar nenhum estado comercial.
10. Não refazer o Pix de R$1,00 já realizado. Esse Pix foi criado pelo utilitário isolado e não está ligado a `billingCycles`.

## Critérios de aceite

- Login/UID do tester e workspace resolvidos corretamente, sem permitir seleção arbitrária de tenant na URL.
- Dashboard do setor indica estado da assinatura (read-only) e valor cadastrado se disponível.
- Nenhum botão de checkout ativo; nenhuma API Key no bundle/navegador.
- Nenhuma conta adicional consultada, pagamento criado ou Firestore escrito pela nova tela.
- Retorno não muda estado para pago sem `payment_check` autenticado e ledger transacional.
- Mobile e desktop sem sobreposições; modo essencial e Central de Depósitos 3D permanecem intocados.

## Limitações antes de promoção à main

A página pronta é **UI de homologação**. Para pagar dentro dela e receber confirmação automática faltam backend de checkout por usuário autorizado, persistência de intents, ledger/Firestore transacional, tratamento de webhooks, reconciliação e ativação comercial. Não liberar a API Key na Vercel com essa UI isolada nem mesclar como integração financeira concluída.

A conexão Vercel disponível ao assistente apresentou `403 not authorized` ao consultar deployments da equipe e falhou ao obter autorização via conector. Assim, **não existe Preview confirmado pelo assistente**. Localize o Preview pela aba **Deployments** da equipe ou pelo check de deploy do PR, quando disponível.
