# EMPROVEX — Implementação após Auditoria Billing R3 (26/10/2026)

**Branch:** `feat/billing-enforcement-grace48-r3` — **PR #398 DRAFT**.
**Estado:** Correções implementadas no GitHub, **SEM merge, deploy, modificação de Firestore de produção ou publicação de Rules**. A pedido do fundador, CI, Emulator, typecheck, autenticação real, testes financeiros e release foram reservados à certificação final. **O código não tem GO técnico sem essa certificação.**

## Objetivos agora endereçados no código

1. **Competências e oferta:** `lib/billing.ts` mantém `firstPaidAt` e `paidServicePeriod` por aniversário mensal exato, clamp em meses curtos; `billingAccess.ts`, `platformBillingAdminStore.ts` e painel usam essa referência. Períodos 1–3 = R$29,90; 4–6=R$39,90; 7–9=R$49,90; 10–12=R$59,90; 13+=R$69,90. Em vez de cobrar no dia 1 do calendário, período 1 inicia no término do trial, ou na criação se sem trial. Renovações têm tolerância de `gracePeriodDays` somente se a competência imediatamente anterior foi paga. Sem trial e sem pagamento inicial não há período gratuito implícito. Isentos e antigos contratos não são reprecificados automaticamente.
2. **Cohort histórico:** administração dispõe de `offer-ramp` por workspace **sem qualquer competência materializada**, não isento. O cliente precisa aceitar explicitamente todos os cinco preços na tela de pagamento. `pricingTermsAcceptedAt` e `pricingTermsVersion` ficam registrados. A tela inicial exibe benefícios do Plano Completo, sem tabela de preços; cotação do período ativo é obtida da API, não do R$50 global legado.
3. **Acesso:** leitura IAM autoritativa de workspace/conta/competência; login e abertura de coleções Core esperam pelo entitlement, acesso direto Warehouse e `parse-ne` verificam o servidor. VIP, trial, pagamento confirmado e 48h válido liberam. Legados sem política progressiva permanecem em contrato anterior e não são bloqueados sem classificação. Em modo `observe`, nada é bloqueado comercialmente. Ativação somente quando `EMPROVEX_BILLING_ENFORCEMENT_ENABLED=1`, `INFINITEPAY_BILLING_ENABLED=1`, `EMPROVEX_BILLING_RULES_CERTIFIED=1` e `platformBillingConfig/main` estiver em `billingMode=enforce/requirePayment=true`.
4. **Core Firestore:** regra candidata introduz `canAccessWorkspaceIdentity` (identidade independente da cobrança) e `canAccessWorkspace` com entitlement `workspace.billingEntitlementUntil`, verificado pela hora do servidor e política. Acesso à própria `billingAccounts` usa identidade sem entitlement, permitindo pagar quando bloqueado. As 5 antigas permissões de escrita direta do billing são mantidas `false`.
5. **Warehouse:** o outro banco (`emprovex-warehouse`) mantém `warehouseAccess/{workspaceId}`, com estado `billingEnforcementStatus` e `billingEntitlementUntil`. Rules candidatas bloqueiam acesso logístico após validade, sem substituir as permissões de lifecycle. O servidor IAM atualiza esse espelho por operação idempotente `warehouseBillingMirror.ts`; o sistema tenta entrega após commit Core e reparação no próximo acesso. `sectorLifecycleAdmin.ts` preserva campos financeiros ao alterar lifecycle. Dois bancos **não têm atomicidade cruzada**, então a certificação exige simular indisponibilidade e recuperação.
6. **Checkout InfinitePay:** pedido HMAC por workspace/competência, `billingPaymentIntents/<order_nsu>` e `billingCycles` gravados antes de chamar provedor. `/links` usa API Key server-only e callback em `POST /api/billing/portal?action=infinitepay-webhook`; NÃO cria Lambda adicional na Vercel. Callback exige token opaco server-only e **nunca confia em corpo do webhook para quitar**: chama `payment_check`, valida valor, meio, status, pedido/tenant e quita atomicamente com ledger SHA256 global para impedir replay. Retorno autenticado do navegador é segundo mecanismo. `recovered-checkout` é operação manual com evidência, sem reabrir pagamento automaticamente se pode existir cobrança anterior.
7. **48h e administração:** janela única por período `paidServicePeriod.referenceMonth`, jamais marca `paid`; pedido auditado e visível no painel. Dashboard recarrega apenas leituras a cada 60 segundos. Confirmação manual exige referência do pagamento e não pode modificar ciclo liquidado pela InfinitePay. `resolve-refund` registra revisão de estorno sem revogar automaticamente pagamento por notificação isolada.
8. **Governança:** preços históricos R$50 e VIPs preservados no banco. APIs públicas de regularização deixam de expor `monthlyPriceCents` global como suposta mensalidade nova. Termos/Privacidade atualizados para InfinitePay, cronograma progressivo, 48h, suspensão e dados de reconciliação.

## Cutover único — NÃO executar nesta etapa
- **Rules do Core:** rebasear os novos predicados sobre o *ruleset realmente publicado* no banco nomeado `ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1`, preservando R1 de cinco escritas `false`. **NUNCA substituir cegamente** o ruleset ativo com o `firestore.rules` da branch. Validar as expressões e permissões da revisão efetiva.
- **Rules do Warehouse:** repetir abordagem de delta mínimo sobre as Rules publicadas em `emprovex-warehouse`. Nenhum deploy automático de Rules pela branch.
- **IAM:** validar `getGoogleAccessToken` nos dois bancos e permissões corretas para as novas coleções de intents e ledger.
- **Vercel / ambiente:** configurar server-only `INFINITEPAY_API_KEY`, `INFINITEPAY_HANDLE`, `INFINITEPAY_ORDER_SECRET` (>=32), `INFINITEPAY_WEBHOOK_TOKEN` (>=32), `INFINITEPAY_BILLING_ENABLED`, `EMPROVEX_BILLING_ENFORCEMENT_ENABLED`, `EMPROVEX_BILLING_RULES_CERTIFIED`. Jamais imprimir valores. Não configurar flags para `1` sem GO.
- **Preparação dos workspaces:** com operador fundador autenticado, executar “Preparar autorizações dos setores” no painel, que reconstrói Core + Warehouse e carimba `billingCutoverPreparedAt`; verificar contas já criadas antes da R3 e oferecer plano a cohorts elegíveis com consentimento. Dados dos 3 VIPs inalterados.
- **Ativação:** primeiro provar checkout e reconciliação reais, webhook, regras em dois bancos, 48h, adm sem trial, rollover e período de tolerância. Depois ativar via painel, que valida flags, credentials e preparation. Permitir reversão para `observe` sem apagar documentos.
- **Composição do release:** a branch deriva de PRs financeiros Draft #396/#397; **não publicar a branch inteira por cima do deployment ativo do EMPROVEX**, que possui hotfixes de navegação posteriores. Fazer composição de arquivos exata sobre release atual, sem alterações não intencionais, uma publicação staged `--skip-domain` e promoção manual após certificação.

## Riscos que exigem ensaio
- Firestore Rules candidatas podem ter limite de 1000 expressões ou incompatibilidade com versão publicada; medir antes de publicar.
- Mirror Warehouse é *eventualmente consistente* (dois bancos): testar falha e retry, reset de licença e concurrência com lifecycle; evitar desbloqueio falso ou bloqueio eterno.
- `billingPaymentIntents` adiciona leitura/escrita IAM; verificar escopo da função. Sem webhook entregue nem URL de retorno, os dados necessários ao `payment_check` podem não existir. Fluxo deve sinalizar ocorrência para admin em vez de garantir baixa automática impossível.
- Em `checkoutState=prepared` uma chamada /links com erro pode ter criado link no provedor; recuperação é manual mediante evidência de ausência de pagamento.
- Webhooks refund/canceled apenas criam solicitação de revisão; estorno efetivo exige conferência, pois `payment_check` se refere à confirmação original.
- Configuração `observe` mantém acesso histórico; `enforce` deve ser ativado conscientemente após etapas anteriores, não silenciosamente.
- Não gerar cargas/compromissos de pagamento reais para testes sem autorização específica do fundador e valor controlado.

## Critério final de GO
Typecheck Next/TypeScript, Application CI, CI focado R3, testes de regra efetiva dos dois bancos com emulator, E2E de identidade e dados diretos, simulação concorrente com Firestore transactions, gateway de InfinitePay e idempotência, webhook autenticado sem retorno, devoluções, 48h, on/off, cadastro com e sem trial, VIP, contrato legado, trial renovado, rollover/fev 28/ano bissexto, recuperação/rollback da Vercel e regras. Somente depois da evidência objetiva autorizar produção.

Relatório original: `docs/BILLING_R3_INTEGRATION_AUDIT_NO_GO_20261026.md`. O presente documento registra **implementação das remediações**, não certificação nem publicação.


## Correção direcionada — criação de checkout e corrida com webhook (27/10/2026)

Arquivos alterados: `lib/server/platformBillingAdminStore.ts`, `lib/billing.ts`, `components/billing/InfinitePayReadinessPanel.tsx` e recuperação administrativa em `components/admin/AdminBillingPanel.tsx`.

**Estados comerciais retornados pela API**: `ready` (URL já persistida), `paid` (competência quitada/regularizada), `pending_review` (uma criação já foi iniciada, resultado externo incerto) e `reserved` (estado interno, não deve sair da API ao usuário). No cliente, `paid` não exige URL e `pending_review` indica conferência, sem gerar pagamento adicional.

**Fluxo de duas fases sem reemissão cega:** (1) salvar reserva `checkoutState='prepared'`, `checkoutAttemptVersion=2` e `billingPaymentIntents/{orderNsu}`, sem tocar a InfinitePay; (2) reivindicar exclusivamente a transição atômica `prepared → dispatching` com marca temporal antes do POST externo. Interrupção antes da fase 2 pode ser retomada automaticamente pela próxima tentativa. Após `dispatching`, erro de rede, timeout ou ausência da resposta **não causam novo POST**. API responde `pending_review` e o mesmo `order_nsu` fica rastreável para conciliação e conferência.

**Callback antes de persistir URL:** o webhook pode fechar a competência como `paid` mesmo que `checkoutUrl` ainda esteja ausente. A gravação tardia da URL consulta status e não sobrescreve `paid`. Conflitos ou falhas de persistência são tratados com leitura do estado atual; se a competência já foi quitada, o servidor retorna `paid`, não `BILLING_CHECKOUT_CHANGED`. O botão de pagamento mostra sucesso de regularização sem URL. Se o URL já tiver sido salvo, ele é reutilizado e não é emitida nova cobrança.

**Limites conscientes:** a documentação da InfinitePay NÃO assegura idempotência de `POST /links` apenas com o mesmo `order_nsu`. Por isso, `dispatching` incerto não pode ser simplesmente reenviado. O admin pode recuperar um `prepared` legado ou `dispatching` com referência de conferência; se o prazo do link antigo ainda estiver vigente, deve registrar `LINK_CANCELADO` junto da evidência após cancelá-lo na InfinitePay. Nunca marcar `paid` por suposição; a quitação exige `payment_check` válido ou evidência administrativa conferida. A janela de 48h permanece disponível pela política comercial ao cliente elegível durante a análise.

**Cenários obrigatórios de certificação focalizada**, sem mexer na produção nesta etapa:
1. Queda logo após reserva e antes da reivindicação: a segunda tentativa faz um único POST externo.
2. Duas tentativas simultâneas do mesmo workspace/competência: no máximo uma reivindicação ganha e envia um POST; a outra não duplica.
3. Queda após `dispatching` e antes de salvar a URL: novo clique recebe `pending_review`, jamais outro `POST /links`.
4. Webhook validado e quitação antes da persistência da URL: preserva `paid`, retorno `paid` e nenhuma reversão para `linked`.
5. Transação da URL falha ou retorna 409 após confirmação pelo provedor: leitura do Firestore retorna `paid` quando já confirmado; caso ambíguo, `pending_review`.
6. Cliente tenta pagar competência já quitada: recebe `paid`, sem link novo.
7. URL gravada e ainda válida: reutilizar; URL expirada não oferecer pagamento antigo.
8. Recuperação administrativa com link potencialmente válido e não cancelado: rejeição; somente depois de vencido/cancelado e com conferência.

**Status:** implementação commitada no PR #398 Draft. As provas executáveis e a integração real continuam reservadas à certificação de release. **Sem merge, promoção Vercel, alteração de Rules ou operação real com a InfinitePay.**


## Pré-piloto Pix R$ 29,90 — isolamento e responsabilidades (27/10/2026)

**Alteração aplicada no PR #398, sem deploy:** a criação de links pela InfinitePay agora exige, além de `INFINITEPAY_BILLING_ENABLED=1`, um escopo explícito:
- `INFINITEPAY_BILLING_SCOPE=pilot` com `INFINITEPAY_BILLING_PILOT_WORKSPACE_ID=<workspace ID>`: **somente** este setor autenticado pode emitir link real;
- `INFINITEPAY_BILLING_SCOPE=all`: somente quando o fundador aprovar a abertura comercial integral;
- variável ausente ou valor diferente: checkout negado mesmo que haja API Key configurada.

`EMPROVEX_BILLING_PUBLIC_ORIGIN` agora define a origem HTTPS canônica do `redirect_url` e da URL de webhook. Não se usam cabeçalhos Host/X-Forwarded-Host controláveis pelo cliente. **Exemplo para piloto em produção com domínio real:** `https://emprovex.com.br`. Se um staging tiver proteção de acesso Vercel, a InfinitePay pode não conseguir enviar eventos àquela origem; a URL deve ser publicamente alcançável e roteada para a versão do servidor que entende o pedido. Não assumir que URL de preview protegido serve como webhook.

**Configuração exclusiva do operador da conta (sem passar segredos no chat):**
1. Em sua conta InfinitePay, habilitar Checkout Integrado, ativar Pix e gerar API Key server-only vinculada ao recebedor correto. Confirmar favorecido e tarifas no app. A API Key aparece apenas na criação.
2. No projeto Vercel `aprov-hgesms-projects/controles-de-empenhos-aprov`, cadastrar/revisar com privilégio do proprietário: `INFINITEPAY_API_KEY`, `INFINITEPAY_HANDLE`, `INFINITEPAY_ORDER_SECRET` (mín. 32 caracteres), `INFINITEPAY_WEBHOOK_TOKEN` (mín. 32 caracteres), `INFINITEPAY_BILLING_ENABLED=1`, `INFINITEPAY_BILLING_SCOPE=pilot`, `INFINITEPAY_BILLING_PILOT_WORKSPACE_ID`, `EMPROVEX_BILLING_PUBLIC_ORIGIN`. Não usar prefixo `NEXT_PUBLIC_` nem colar valores aqui.
3. Não ativar `EMPROVEX_BILLING_ENFORCEMENT_ENABLED=1`, `EMPROVEX_BILLING_RULES_CERTIFIED=1` ou `billingMode=enforce` como pré-requisito de um **checkout Pix isolado**: o teste de cobrança funciona em `observe`, sem bloquear os demais usuários.
4. Autorizar o pagamento Pix real de R$29,90, conferir valor e recebedor antes da transferência e comprovar no app InfinitePay o registro da venda e o crédito conforme o plano da conta.

**Tarefas de desenvolvimento que antecedem a autorização do teste real:**
- Integrar o PR #398 sobre o release efetivamente publicado (não substituir hotfixes de navegação), fazer typecheck e certificação focalizada de checkout/refund/reconciliação sem dinheiro;
- Verificar que o endpoint do webhook é realmente alcançável pelo provedor e recebe o payload esperado; um redirect apenas não garante baixa;
- Garantir criação da competência em Firestore nomeado, ledger de quitação, não duplicação e resultado `paid` de forma auditável;
- Publicar primeiro uma única versão coerente com o domínio e com a origem configurada, mantendo `billingMode=observe`.

**Limite de acesso do assistente nesta conversa:** a conexão Vercel atualmente disponibilizada não expõe o team `aprov-hgesms-projects`; o usuário pode autorizar a equipe à conexão, ou executar as alterações de variáveis e o deploy com a Vercel CLI autenticada, pelo método memorial. Nenhum segredo deve ser impresso no console.

Documentação oficial: https://ajuda.infinitepay.io/pt-BR/articles/10766888-como-usar-o-checkout-integrado-da-infinitepay
