# EMPROVEX — Billing Enforcement & InfinitePay R3

## Estado

Branch `feat/billing-enforcement-grace48-r3` baseada na R2 `feat/billing-progressive-r2` (PR #397), que inclui o Billing Server R1 (#396). Alterações são de código; **não houve deploy, alteração das Firestore Rules, IAM ou dados comerciais da produção**.

A pedido do fundador: implementar primeiro e **não executar suítes de testes ou validações de release nesta fase**. O PR deve permanecer DRAFT. Nenhuma funcionalidade abaixo foi certificada em produção.

## Contratos

- Nova contratação por workspace: R$29,90 nas competências 1–3; R$39,90 4–6; R$49,90 7–9; R$59,90 10–12; R$69,90 desde a 13ª. Competência 1 começa no mês do fim do trial, ou no mês do cadastro sem trial.
- Isenções VIP e fundadora intactas, registros financeiros materializados jamais reprecificados. A configuração global antiga R$50 não define o preço de novos setores; o cliente vê somente valores da própria conta e, no consentimento de pagamento inicial, a programação contratual completa.
- O fluxo de **assentimento explícito** em Minha assinatura é obrigatório antes do primeiro checkout. A vitrine da assinatura exibe as ferramentas do Plano Completo, não o calendário de reajustes.
- Acesso: consulta autenticada `GET /api/billing/portal?view=access` lê conta + competência do mês com IAM. VIP/trial vigente/pagamento confirmado/janela 48h válida liberam; inadimplente retorna à Central de Assinaturas. O navegador não escolhe preço/mês/workspace.
- `POST /api/billing/portal?action=request-grace48`: uma janela temporária de 48h **por competência**, atômica, auditada, sem quitação. Pedido com `grace48ReviewStatus='pending'` aparece no painel administrativo. Fundador verifica a conta e confirma o pagamento real para liberar a competência. Vencido o prazo, não há renovação automática.
- Login operacional e acesso direto à Central de Depósitos consultam o entitlement. O verificador de operações API do Warehouse tem camada IAM opcional, habilitada somente por `EMPROVEX_BILLING_ENFORCEMENT_ENABLED=1`, com cache positivo de 30 segundos; validar operacionalmente antes de ativar essa flag.
- Checkout real: `POST /api/billing/portal?action=subscription-checkout`, mediante `INFINITEPAY_BILLING_ENABLED=1`, credenciais `INFINITEPAY_API_KEY`, `INFINITEPAY_HANDLE` e `INFINITEPAY_ORDER_SECRET` (mín. 32 caracteres). Um pedido HMAC por workspace e competência, salvo no `billingCycles` antes de solicitar checkout `/links`. Sem débito recorrente automático.
- Retorno: `POST /api/billing/portal?action=verify-subscription`; servidor usa `payment_check` com API Key, verifica status, valor integral e identidade do pedido. Transação Firestore atômica altera `billingCycles` para `paid`, conta para `active`, grava `billingPaymentLedger/infinitepay_<sha256(transactionNsu)>` e auditoria. Webhooks não são utilizados nesta R3 (sem confiar em notificações não autenticadas). Reembolso/chargeback não muda acesso automaticamente.
- Nenhuma alteração em Firestore Rules: credencial IAM do servidor efetua as mutações do billing. Leitura do portal segue as regras por sessão Firebase já existente.

## Antes da publicação — bloqueios deliberados

1. Conciliar a fonte com o deployment realmente ativo (não promover uma branch antiga; preservar navegação e outros hotfixes).
2. **Certificar** TypeScript, contratos, integração Firebase Auth/Firestore named DB, concorrência/atomicidade, idempotência, regras e permissões por tenant e funções Vercel Hobby. Suíte financeira incluindo reinício de checkout, perda de conexão e duplicidade.
3. Verificar Firestore Rules publicadas efetivas, sem substituir pelo arquivo do GitHub; assegurar que não existe atalho cliente ou API que contorne o bloqueio. O gate do app não substitui regras de autorização persistentes.
4. Verificar contrato fiscal e comercial, especialmente cobrança no final do trial no mesmo mês, vencimento e acesso de 48h; validar transparência das faixas no aceite.
5. Confirmar ambiente de produção Vercel (credenciais secretas server-only já configuradas) e habilitar `INFINITEPAY_BILLING_ENABLED=1` **somente após** go-live de integração autenticada/real. Não imprimir segredos.
6. Avaliar `EMPROVEX_BILLING_ENFORCEMENT_ENABLED=1` somente após validar Warehouse e rotas de backend protegidas; fallback e rollback previamente disponíveis. Conexão Vercel do assistente continua sem autorização para o team.
7. Fazer um único release remoto `--prod --skip-domain`, confirmar health, login setorial VIP e não VIP, teste de baixo valor explícito na InfinitePay, admin release manual e rollback; promover o mesmo deployment.
8. A manutenção do valor legado nos dados antigos NÃO significa que o preço inicial dos novos clientes seja R$50; não sobrescrever a configuração histórica ou os VIPs somente para esconder um rótulo.

## Limitações conhecidas da implementação a certificar

- Usuários antigos sem `pricingPolicyId` continuam na política legada. A migração automática silenciosa de clientes existentes não faz parte desta R3.
- Concessão de 48h é imediata mediante pedido autenticado; o dashboard administrativo não envia mensagem externa/push/email, e a leitura do painel requer nova consulta.
- O checkout preparado sem URL por falha entre gravação Firestore e resposta da InfinitePay é bloqueado para reabertura automática a fim de evitar cobranças duplicadas; requer suporte/reconciliação.
- Proteção de dados via Firebase client SDK e outros motores fora do Warehouse depende de suas Rules e motores originais; end-to-end authorization deve ser certificado antes de ativar a cobrança real.
