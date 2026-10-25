# EMPROVEX — Portal de assinatura e pagamento InfinitePay R1

**Integração:** PR #385 (composição de #382 e #384).  
**Estado:** DRAFT, ainda sem publicação.  
**Ciclo de faturamento normal:** DESATIVADO, `billingMode='observe'`, `requirePayment=false`, `automaticSuspension=false`.

## O que a interface já faz

- O operador abre `Minha assinatura` no cabeçalho e vê sua conta e workspace previamente verificados por login Firebase.
- Caso a página seja recarregada, reconsulta pelo UID e e-mail da sessão, `platformAccounts/<email>`, `workspaces/<workspaceId-da-conta>` e `billingAccounts/<workspaceId>`. Nenhum tenant pode ser passado via query/body.
- Exibe status de trial, VIP/isento, ativo, pendente, suspenso e cancelado.
- Mostra política INDIVIDUAL progressiva *planejada para novos clientes* após 30 dias de teste gratuito, sem substituir preço antigo ou reescrever competências já emitidas.
- Métodos antigos de Pix/links continuam opcionais e recolhidos. Falta de credencial de servidor nessa consulta não derruba a área de assinatura.
- Consulta histórico de até 24 competências materializadas do próprio workspace com IAM após validação da sessão. Caso a credencial administrativa não esteja configurada, mostra histórico indisponível, não inventa pagamentos.
- Permite visualizar um primeiro ciclo de R$29,90 apenas na simulação LOCAL `next dev` de conta isenta.
- Suporta o retorno da InfinitePay, remove parâmetros privados da URL e **não considera o retorno como prova financeira**.

## Piloto financeiro real (R$1)

O checkout de R$1 é uma transação **real**, mas **não é uma mensalidade**. O recebedor pode ter taxas e obrigações aplicáveis. O cliente confirma o valor no checkout e efetua Pix voluntariamente.

Somente um setor autorizado consegue acessar `/api/billing/portal`, `/api/billing/pilot-checkout` e `/api/billing/pilot-verify`; o servidor valida token Firebase, diretório, UID vinculado, workspace e UG (Security Rules do Firestore continuam aplicadas à busca). O piloto verifica *duplamente* email e workspace nos segredos do servidor.

O cliente marca o checkbox de confirmação, gera um link de pagamento **sem movimentar dinheiro automaticamente**, abre o endereço InfinitePay oficial e, após o Pix, pressiona **Continuar**. O EMPROVEX capta o retorno e solicita verificação autenticada pelo endpoint `payment_check`; exige HMAC de pedido correspondente à identidade, status aprovado, valor integral de R$1,00 e Pix. O resultado é **somente** `PILOT_PIX_AUTHENTICATED`: nunca marca `billingCycles` como paga ou muda privilégios.

O checkout anterior, gerado com o script offline, não é reconhecido por esta nova rota porque não possui o mesmo segredo/pedido de piloto. **Não realizar novo Pix apenas para repetir teste anterior.**

## Configuração privada de teste

Sem essas variáveis o servidor não cria nenhum pagamento:

- `INFINITEPAY_PILOT_ENABLED=1` — **somente durante o piloto**.
- `INFINITEPAY_PILOT_EMAIL=<e-mail autorizado>` — o da conta testada, não um e-mail de recebedor genérico.
- `INFINITEPAY_PILOT_WORKSPACE=<workspace id autorizado>` — conferir com Firebase.
- `INFINITEPAY_HANDLE=<InfiniteTag sem $>`.
- `INFINITEPAY_API_KEY=<API Key>` — **secreta**, usar apenas Environment Variables server-side na Vercel; nunca `NEXT_PUBLIC_`.
- `INFINITEPAY_ORDER_SECRET=<segredo aleatório e estável com 32+ caracteres>` — chave HMAC independente da API Key.

Nunca publicar a chave em Git, logs, prints, navegador ou ChatGPT. Para desligar o piloto, definir `INFINITEPAY_PILOT_ENABLED=0`, desabilitando imediatamente *novas* emissões e verificações via UI.

**Atenção à elegibilidade comercial:** o SaaS deve ser descrito como tal e a conta recebedora precisa estar autorizada para a atividade real, sem simulação de outro produto.

## Limitações da primeira versão

1. A baixa automática de mensalidades **NÃO está habilitada**. Os contratos SaaS ainda requerem um conector transacional real do Firestore, idempotência do `transaction_nsu`, geração de competências por política e conciliação assíncrona. O contrato transacional do PR #382 ainda é mock no CI.
2. Não enviar webhook para esse piloto: a confirmação depende do retorno do usuário e de `payment_check`.
3. O checkout piloto tem `order_nsu` HMAC determinístico por **UID/workspace/dia**: clicar repetidamente pode encontrar o mesmo pedido. Não criar novo link após erro ambíguo sem conferir cobranças da InfinitePay.
4. O único valor permitido no piloto é R$1,00 e o pagamento é de uso único; alterações de `amountCents` fornecidas pelo navegador são rejeitadas.
5. O modo preview/local só confirma visualização; não é prova da autorização de dados de produção nem de uma transferência real.

## Verificações antes de release

- `InfinitePay Portal Integration R1`: Node suite + TypeScript.
- `InfinitePay Payment UI Preview`: unit tests + Chromium real browser.
- `EMPROVEX Fast CI`, `EMPROVEX Core Protection`, Application CI completo quando PR sair de Draft.
- Login real com **Aprovisionamento Teste** e inspeção de status **Isento**; não alterar a isenção da conta.
- Configuração de secrets Vercel revisada para a equipe e projeto certos, sem copiar automaticamente valores de Preview para Produção.
- Estágio de uma compilação certificada com `vercel deploy --prod --skip-domain --archive=tgz --scope aprov-hgesms-projects`, inspeção do URL e `vercel curl /api/health --deployment <url> --scope aprov-hgesms-projects`; só então promoção do **mesmo** deployment com `vercel promote <url> --yes --scope aprov-hgesms-projects`. Não construir de novo na promoção.
- A conexão de Vercel deste assistente retornou 403 para essa equipe; nenhum deploy foi realizado.

## Regra de publicação

A interface read-only pode ir à `main` com o piloto **desligado** após CI e validação; isso NÃO autoriza ativar cobrança SaaS. A ativação do piloto precisa de configuração explícita do workspace/email e aceitação da realização de Pix real pela pessoa pagadora. Em nenhuma etapa remover VIPs ou ativar suspensão automática.
