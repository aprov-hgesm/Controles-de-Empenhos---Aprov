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
