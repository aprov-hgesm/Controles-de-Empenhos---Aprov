# EMPROVEX — Ensaio REAL de Pix na InfinitePay (R1, usuário próprio)

**Status:** script de homologação local opt-in, **não implantado** no site.  
**Receptor:** conta InfinitePay CPF informada pelo usuário (Checkout Integrado habilitado).  
**Emissor:** uma segunda conta bancária **do próprio usuário**, se o contrato da instituição permitir esse teste.  
**Valor recomendado da primeira execução:** R$ 1,00.  
**Escopo validado:** link criado pela API, Pix pago voluntariamente, `payment_check` autenticado e reconciliação de valor/ordem.  
**Escopo NÃO validado:** login do usuário teste, gravação Firestore, webhook em produção, conciliação automática, acesso pós-pagamento, assinatura do Plano Completo e apuração tributária da venda.

## 1. Por que esse teste vem antes da integração real

A base de código no PR #382 tem um adaptador de checkout, regras do Plano Completo e testes em memória. Ainda **não** possui rota pública autenticada de pagamento nem gravador Firestore transacional real. Testar agora uma transação usando a conta do usuário em um utilitário isolado evita simular que o acesso ao EMPROVEX seria liberado.

No ensaio, a compra é identificada de forma transparente como **teste técnico de pagamento, sem assinatura**. Não classificar como treinamento, nem gerar notas fiscais falsas. O provedor registra uma transação de dinheiro verdadeiro; confirme no app quaisquer tarifas, impedimentos a autopagamento e requisitos de declaração/registro.

## 2. Executar em PowerShell — sem revelar API Key

Não cole a chave no chat, no GitHub, em prints ou em comandos digitados em linha.

Use Node.js 22 ou 24, Git e uma pasta isolada no disco D:. Se o projeto não estiver clonado:

```powershell
git clone --depth 1 --single-branch --branch feat/billing-infinitepay-offline-adapter-r1 "https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov.git" "D:\EMPROVEX-INFINITEPAY-SMOKE-R1"
Set-Location "D:\EMPROVEX-INFINITEPAY-SMOKE-R1"
node --test scripts/infinitepay-live-smoke.test.mjs
```

O código usa apenas módulos internos do Node.js e **não exige npm install**.

### 2.1 Simulação offline (sem dinheiro e sem rede)

```powershell
node scripts/infinitepay-live-smoke.mjs dry-run --workspace usuario-teste --amount-cents 100
```

O campo `--workspace` é apenas uma etiqueta de correlação privada; **não autentica, consulta nem modifica** o workspace existente. Se souber o identificador real do workspace de teste, pode usá-lo como etiqueta.

### 2.2 Configurar a chave somente na sessão atual

```powershell
$env:INFINITEPAY_HANDLE = (Read-Host "Sua InfiniteTag sem @").TrimStart('@')
$seguro = Read-Host "Cole a API Key da InfinitePay (entrada oculta)" -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($seguro)
try {
  $env:INFINITEPAY_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  Remove-Variable ptr,seguro -ErrorAction SilentlyContinue
}
```

A variável fica disponível somente para processos iniciados pela sessão PowerShell atual; é um segredo em memória de processo, **não um cofre persistente**. Feche a janela/remova-a após o teste.

### 2.3 Criar voluntariamente um checkout real de R$ 1,00

```powershell
node scripts/infinitepay-live-smoke.mjs create --workspace usuario-teste --amount-cents 100 --authorize-real-pix-test
```

**Só este comando faz um pedido REAL à API**, após a autorização explícita no argumento. Ele grava ANTES da requisição um arquivo de correlação em `$env:TEMP\emprovex-infinitepay-smoke-v1` sem a API Key e imprime um link com validade de **30 minutos**. Se houver falha de rede após envio, não repita por impulso: a solicitação anterior pode ter criado um link. Verifique primeiro no painel do provedor.

### 2.4 Fazer o Pix manualmente

1. Abra o link retornado pelo utilitário.
2. Escolha Pix, revise nome do recebedor e **R$ 1,00**, e só então autorize pelo banco de origem.
3. Confira no app InfinitePay que a operação apareceu no seu extrato.
4. Na tela de conclusão da InfinitePay, clique em **Continuar** para voltar a `https://emprovex.com.br/regularizacao` com parâmetros de pagamento.
5. Copie a URL final completa para uso local. **Não compartilhe essa URL em chats ou prints**: ela pode conter referências de transação e comprovante.

Conforme documentação do provedor, a configuração de preferência por Pix **não elimina necessariamente a opção de cartão**; use especificamente Pix para validar esse cenário.

### 2.5 Confirmar pelo servidor da InfinitePay, sem confiar no redirect

O comando de criação mostra `Pedido de teste: epx-AAAA...`. Use esse valor:

```powershell
node scripts/infinitepay-live-smoke.mjs verify --order COLE_AQUI_O_PEDIDO_DE_TESTE
```

O utilitário solicitará a URL final em modo interativo. Ele extrai os parâmetros e consulta `POST https://api.checkout.infinitepay.io/payment_check` com `X-Api-Key`. Confere `order_nsu`, `transaction_nsu`, `slug`, método Pix, status do provedor e valor. Somente se todas as verificações passarem aparecerá:

`PIX REAL CONFIRMADO COM A INFINITEPAY`

Esse status é **local**, e NÃO muda o pagamento do usuário no EMPROVEX. Se não houver URL de retorno, não invente parâmetros: registre como ensaio inconclusivo de confirmação e revise a transação no provedor.

### 2.6 Remover as variáveis sensíveis ao terminar

```powershell
Remove-Item Env:\INFINITEPAY_API_KEY -ErrorAction SilentlyContinue
Remove-Item Env:\INFINITEPAY_HANDLE -ErrorAction SilentlyContinue
```

Você pode compartilhar **somente** o resultado final sem dados sensíveis: criou link? Pix debitado? a InfinitePay confirmou? código de erro textual e número de testes aprovados. Nunca a chave, o URL completo de retorno nem dados bancários.

## 3. Critérios de aprovação

- **PASS — API:** retornou link HTTPS pertencente a domínio oficial InfinitePay.
- **PASS — Pagamento:** mostrou o receptor correto, o valor correto e pagamento Pix feito voluntariamente.
- **PASS — Consulta:** confirmou a mesma ordem e `paid=true`, `success=true`, `amount` em centavos e método Pix.
- **PASS — Isolamento:** nenhuma chamada ao Firestore, nenhuma modificação de usuário, nenhuma suspensão nem criação de assinatura.
- **NÃO AVALIADO:** sincronização com `billingAccounts`/`billingCycles`, webhook, tela autenticada, persistência real ou recuperação no Firestore.

Somente uma fase posterior, em ambiente Preview isolado e com autorização/autenticação de usuário e transações Firestore certificadas, permitirá marcar uma **competência real do usuário de teste** como paga. Não se deve ativar pagamento comercial nem expor a API Key em produção nesta fase.

## 4. Referências

- https://ajuda.infinitepay.io/pt-BR/articles/10766888-como-usar-o-checkout-integrado-da-infinitepay
- https://www.infinitepay.io/checkout-documentacao

## 5. Recuperação depois do pagamento, sem fazer outro Pix

Se o usuário colou um link `https://checkout.infinitepay.io/...` no comando `verify`, **isso é o endereço de abertura da cobrança, não o retorno após o pagamento**. O erro de URL, sozinho, NÃO indica falha do Pix; não criar outro link nem pagar de novo.

1. Voltar à aba de finalização do checkout. Se ainda houver a tela de sucesso, clicar em **Continuar**. A InfinitePay envia o navegador ao `redirect_url` fornecido na criação do link.
2. Copiar da barra de endereços o endereço `https://emprovex.com.br/regularizacao?...`, com os parâmetros `order_nsu`, `transaction_nsu` e `slug` (não enviar em chat). Repetir apenas `verify --order <mesmo-pedido>`.
3. Se a aba de checkout/retorno foi perdida, conferir a venda **já recebida** no app InfinitePay em **Vendas → Histórico de vendas**, filtrando por data, Pix e R$1,00. Conforme a interface da conta, talvez seja possível ver referências da venda; NÃO presumir que o ID Pix EndToEnd corresponde a `transaction_nsu`.
4. A documentação atual de `payment_check` exige quatro campos: `handle`, `order_nsu`, `transaction_nsu` e `slug`. NÃO inventar transaction_nsu ou slug, nem tratá-los como os últimos caracteres do link do checkout. Se a plataforma não expuser esses campos e o retorno estiver perdido, tratar a conferência da API como **INCONCLUSIVA**; pedir ao suporte InfinitePay orientações para recuperar as referências do pedido já pago.
5. Para ensaios **futuros**, preservar a URL completa de retorno em arquivo local seguro imediatamente após clicar em Continuar; nunca enviá-la por chat.

A versão posterior do utilitário trata o link inicial com mensagem específica: `Este e o link inicial do checkout. Nao pague novamente...`. O script não faz chamadas remotas quando os parâmetros de retorno não foram validados.

**Fontes:**
- https://ajuda.infinitepay.io/pt-BR/articles/10766888-como-usar-o-checkout-integrado-da-infinitepay
- https://ajuda.infinitepay.io/pt-BR/articles/6545817-como-acompanhar-suas-vendas-pelo-app-infinitepay
