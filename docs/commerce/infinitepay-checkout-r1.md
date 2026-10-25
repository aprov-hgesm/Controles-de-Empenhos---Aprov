# EMPROVEX — InfinitePay Checkout R1 (adaptação técnica desativada)

**Estado:** código preparatório OFFLINE, sem endpoint público e sem publicação  
**Princípio:** GOV-SIMP-01. A adaptação técnica não altera atividades comerciais, CNAEs ou titularidade.

## 1. Passos da conta / homologação

1. A titular do MEI realiza pessoalmente o cadastro com CNPJ na InfinitePay, com documentos e validação autênticos.
2. Após aprovação, no app: Vendas > Checkout > Configurações > Habilitar Checkout Integrado.
3. Verificar se o painel habilita a API Key; a chave deve ser mantida apenas em cofre de segredos ou variável no servidor (não compartilhar no chat, no GitHub nem no navegador).
4. Obter confirmação comercial de que o produto/serviço efetivo e a conta recebedora estão autorizados. O Plano Completo do EMPROVEX permanece SaaS.
5. Antes de receber por esse CNPJ, definir o enquadramento fiscal e a atuação empresarial do provedor legítimo. A existência de um módulo de tutoriais não converte a assinatura do SaaS em treinamento.

**ATENÇÃO:** esta implementação não usa nem solicita credenciais reais e não inicia transações. Não instalar a API Key em Preview/produção até revisão de autorização, privacidade e provisionamento do servidor.

Fontes oficiais:
- https://ajuda.infinitepay.io/pt-BR/articles/4844473-como-faco-o-meu-cadastro-na-infinitepay
- https://ajuda.infinitepay.io/pt-BR/articles/8177697-como-criar-um-cadastro-de-pessoa-juridica
- https://ajuda.infinitepay.io/pt-BR/articles/10766888-como-usar-o-checkout-integrado-da-infinitepay

## 2. Conteúdo do módulo

`lib/server/payments/infinitepayCheckout.mjs` implementa:

- `makeOrderNsu`: HMAC SHA-256 do workspace + competência, opaco e determinístico, usando segredo de servidor de >=32 caracteres.
- `buildCheckoutRequest`: cobrança avulsa verdadeira do Plano Completo, valor em centavos; URLs HTTPS; `single_payment`; validade e eventos.
- `classifyPaymentNotification`: aceita sinais de webhook **sem** reconhecer pagamento ou alterar acesso.
- `eventFingerprint`: chave idempotente por pedido, transação e evento.
- `assessPaymentCheck`: exige resposta aprovada, valor previsto, valor pago suficiente e método conhecido.
- `callInfinitePay`: cliente HTTP com `X-Api-Key`, **bloqueado** por padrão e acessível apenas com habilitação explícita.

Esse módulo **não** é implementação final de conciliação financeira, e não prova autenticação criptográfica de webhook. Na futura integração, `payment_check` deve receber o pedido original e as referências de transação verificadas; toda atualização de competência deve usar transação persistente, idempotência e verificação da identidade do workspace.

## 3. Como testar localmente

Executar a partir da raiz do repositório:

```powershell
node --test scripts/infinitepay-checkout.test.mjs
```

Os testes usam um `fetchImpl` falso, sem API Key real e sem emitir cobranças. O comando não usa Docker, WSL, rede nem banco de produção.

## 4. Gatilhos obrigatórios antes da integração operacional

- Confirmar contrato comercial da conta recebedora e descrição verdadeira da oferta no checkout e na NFS-e.
- Validar assinatura/autenticação das notificações ou usar `payment_check` com credenciais protegidas.
- Definir referências `handle`, `slug`, `transaction_nsu` e persistência da cobrança antes de devolver link ao cliente.
- Implementar transação atômica para `billingCycles` + ledger/auditoria, idempotente e com controle de corrida.
- Confirmar o estado financeiro sem usar somente parâmetros de redirect nem body de webhook.
- Implementar reembolso, chargeback, cancelamento, concorrência e reconciliação periódica.
- Proteger fundador e VIPs, preservar `billingMode='observe'` e deixar `automaticSuspension=false`.
- Testar com simulador ou valores autorizados, sem alterar dados/contas de clientes reais.
- Aprovar o CI e revisar a composição com CORE LEAN R2 antes de publicar.

## 5. O que esta branch NÃO muda

- Não altera cadastro, MEI, CPF, CNPJ, CNAE, contrato comercial ou descrição fiscal.
- Não gera cobranças, não registra pagamentos, não ativa webhooks nem envia transações reais.
- Não altera Firestore Rules, Vercel, dados dos workspaces, telas ou status de assinatura.
- Não incorpora produto educacional fictício nem renomeia o Plano Completo como curso.
- Não usa testes com chaves reais.

Ao final da homologação, abrir PR separado para interface, rotas autenticadas, armazenamento transacional e observabilidade.

## 6. Integração offline com competências (25/10/2026)

Os módulos adicionais implementados nesta branch são:

- `lib/server/payments/infinitepayBillingBridge.mjs`
  - `prepareWorkspaceCheckout`: confere autorização delegada ao chamador confiável, vínculo `workspaceId` + `billingCycles`, plano de R$ 70, isenção de VIP/fundador, trial, `observe` e prazo máximo de validade.
  - `prepareVerification`: vincula `order_nsu`, `transaction_nsu`, `invoice_slug` e `handle` para requisição oficial `payment_check`. Nunca considera redirect/webhook como prova financeira.
  - `planVerifiedSettlement`: apenas sugere uma transição de competência após `paid=true`, `success=true` e valores conferidos; não altera o banco.
  - `planFinancialException`: sinaliza estornos, falhas e cancelamentos para revisão sem suspender contas automaticamente.
- `lib/server/payments/infinitepayTransactionalSettlement.mjs`
  - `transactionLedgerId`: identidade global determinística e opaca de cada transação InfinitePay.
  - `commitVerifiedSettlementWithStore`: contrato de persistência atômica com `runTransaction`, leitura da conta/competência/ledger, registro único e detecção de concorrência, inconsistência e pagamento já registrado.
  - **IMPORTANTE:** este módulo é uma **porta transacional abstrata**. Não existe ainda uma implementação ligada ao Firestore de produção.
- `scripts/infinitepay-billing-bridge.test.mjs`: testes sintéticos do vínculo financeiro, autorizações, valores, validade, VIPs e eventos.
- `scripts/infinitepay-transactional-settlement.test.mjs`: testes de transação **simulada em memória**, incluindo notificações concorrentes, idempotência, queda de commit, isolamento de tenants e proteção de VIP.

A documentação oficial atual utilizada na preparação de requests é:
https://ajuda.infinitepay.io/pt-BR/articles/10766888-como-usar-o-checkout-integrado-da-infinitepay

Ela descreve os endpoints `POST /links` e `POST /payment_check` em `api.checkout.infinitepay.io`, com `X-Api-Key`; o segundo precisa de `handle`, `order_nsu`, `transaction_nsu` e `slug`. **Nenhuma requisição foi enviada ao provedor nessa fase**.

### Teste offline completo

```powershell
node --test scripts/infinitepay-checkout.test.mjs scripts/infinitepay-billing-bridge.test.mjs scripts/infinitepay-transactional-settlement.test.mjs
```

O workflow `InfinitePay Adapter Unit Tests` roda essas suites com dados e chaves **fictícios**. A aprovação dos testes de transação em memória NÃO significa que o adapter Firestore real tenha passado testes no Emulator.

### Gates ainda pendentes (NO-GO para cobrança real)

1. Homologar forma de contratação, conta recebedora e tratamento fiscal do SaaS.
2. Obter confirmação formal de elegibilidade e documentação de segurança do checkout/webhook.
3. Implementar autorização de usuário/admin no servidor e persistência de intent ANTES da criação de link.
4. Implementar `runTransaction` real com atomicidade Firestore de `billingCycles` + ledger, unique `transaction_nsu` global e CAS no ciclo; testar no Emulator com falhas e concorrência.
5. Implementar endpoints de checkout, webhook e reconciliação autenticada; bloquear em produção por feature flag desabilitada.
6. Restringir credenciais InfinitePay à configuração de servidor, com rotação; nunca enviar API Key por chat, GitHub ou front-end.
7. Certificar pagamentos de homologação somente quando autorizados; não realizar cobrança real automaticamente.
8. Concluir CI completo, auditoria independente e aprovação de publicação. `billingMode='observe'` e VIPs permanecem protegidos.

### Estado garantido

**Sem endpoints públicos, sem valores reais, sem credenciais, sem gravações em Firestore, sem deploy e sem criação de links operacionais.** O projeto não transforma uma assinatura SaaS em treinamento por alterar o texto fiscal ou um módulo educacional.
